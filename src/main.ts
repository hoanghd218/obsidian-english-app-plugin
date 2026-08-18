import { Editor, MarkdownView, Notice, Plugin, WorkspaceLeaf, debounce } from "obsidian";
import { AddCardModal, type AddCardPrefill } from "./addCardModal";
import { VocabReviewView, VIEW_TYPE_VOCAB } from "./reviewView";
import { makeScheduler } from "./srs";
import type { FSRS } from "ts-fsrs";
import { CardStore } from "./store";
import {
	DEFAULT_SETTINGS,
	MAX_FREEZES,
	todayKey,
	type VocabCard,
	type VocabForgeData,
	type VocabForgeSettings,
} from "./types";
import { State } from "./srs";
import { VocabForgeSettingTab } from "./settingsTab";

export default class VocabForgePlugin extends Plugin {
	data!: VocabForgeData;
	settings!: VocabForgeSettings;
	store!: CardStore;
	scheduler!: FSRS;
	private statusEl!: HTMLElement;

	async onload(): Promise<void> {
		const raw = (await this.loadData()) as Partial<VocabForgeData> | null;
		this.data = {
			settings: { ...DEFAULT_SETTINGS, ...(raw?.settings ?? {}) },
			stats: raw?.stats ?? {},
			xp: raw?.xp ?? 0,
			freezes: raw?.freezes ?? 1,
			frozenDays: raw?.frozenDays ?? [],
			questRewardDates: raw?.questRewardDates ?? [],
			story: raw?.story ?? null,
		};
		this.settings = this.data.settings;
		this.autoFreeze();
		this.store = new CardStore(this.app, () => this.settings);
		this.scheduler = makeScheduler(this.settings.requestRetention);

		this.registerView(VIEW_TYPE_VOCAB, (leaf) => new VocabReviewView(leaf, this));

		this.addRibbonIcon("graduation-cap", "Vocab Forge: Ôn tập", () => {
			void this.activateView();
		});

		this.addCommand({
			id: "open-review",
			name: "Mở màn ôn tập",
			callback: () => void this.activateView(),
		});
		this.addCommand({
			id: "add-card",
			name: "Thêm thẻ mới",
			callback: () => this.openAddCardModal(),
		});
		this.addCommand({
			id: "card-from-selection",
			name: "Tạo thẻ từ vùng bôi đen",
			editorCallback: (editor, view) => this.cardFromSelection(editor, view as MarkdownView),
		});

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, view) => {
				if (!editor.getSelection().trim()) return;
				menu.addItem((item) =>
					item
						.setTitle("Vocab Forge: Tạo thẻ từ vùng chọn")
						.setIcon("graduation-cap")
						.onClick(() => this.cardFromSelection(editor, view as MarkdownView))
				);
			})
		);

		// Highlight từ đã học trong reading mode (immersion)
		this.registerMarkdownPostProcessor((el, ctx) => {
			if (ctx.sourcePath.startsWith(this.settings.cardsFolder)) return;
			try {
				this.highlightElement(el);
			} catch (e) {
				console.error("Vocab Forge highlight:", e);
			}
		});

		// Status bar
		this.statusEl = this.addStatusBarItem();
		this.statusEl.addClass("vf-statusbar", "mod-clickable");
		this.statusEl.onclick = () => void this.activateView();
		const refresh = debounce(() => {
			this.invalidateKnownWords();
			this.refreshStatusBar();
		}, 2000, true);
		this.registerEvent(this.app.metadataCache.on("resolved", refresh));
		this.registerEvent(this.app.vault.on("modify", refresh));
		this.registerInterval(window.setInterval(() => this.refreshStatusBar(), 60_000));
		this.app.workspace.onLayoutReady(() => this.refreshStatusBar());

		this.addSettingTab(new VocabForgeSettingTab(this.app, this));
	}

	onunload(): void {
		window.speechSynthesis.cancel();
	}

	async saveAll(): Promise<void> {
		await this.saveData(this.data);
	}

	rebuildScheduler(): void {
		this.scheduler = makeScheduler(this.settings.requestRetention);
	}

	// ------------------------------------------------------------------ VIEW

	async activateView(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_VOCAB);
		let leaf: WorkspaceLeaf;
		if (existing.length) {
			leaf = existing[0];
		} else {
			leaf = this.app.workspace.getLeaf("tab");
			await leaf.setViewState({ type: VIEW_TYPE_VOCAB, active: true });
		}
		await this.app.workspace.revealLeaf(leaf);
		const view = leaf.view;
		if (view instanceof VocabReviewView) view.renderHome();
	}

	openAddCardModal(prefill?: AddCardPrefill): void {
		new AddCardModal(this.app, this, prefill).open();
	}

	private cardFromSelection(editor: Editor, view: MarkdownView): void {
		const sel = editor.getSelection().trim();
		const file = view.file;
		const prefill: AddCardPrefill = { word: sel };
		if (sel.split(/\s+/).length >= 7) prefill.type = "sentence";
		else if (sel.split(/\s+/).length >= 2) prefill.type = "phrase";
		if (file) {
			prefill.source = `[[${file.basename}]]`;
			const url = this.app.metadataCache.getFileCache(file)?.frontmatter?.source;
			if (typeof url === "string" && /^https?:\/\//.test(url)) prefill.sourceUrl = url;
		}
		this.openAddCardModal(prefill);
	}

	// ----------------------------------------------------------------- STATS

	/** Còn được học bao nhiêu thẻ mới hôm nay */
	newRemainingToday(): number {
		const used = this.data.stats[todayKey()]?.newCards ?? 0;
		return Math.max(0, this.settings.newPerDay - used);
	}

	recordReview(wasNew: boolean): void {
		const key = todayKey();
		const stat = (this.data.stats[key] ??= { reviews: 0, newCards: 0 });
		stat.reviews++;
		if (wasNew) stat.newCards++;
		this.data.xp += 10;
		this.maybeGrantQuestReward();
		void this.saveAll();
	}

	recordPractice(correct: boolean): void {
		const key = todayKey();
		const stat = (this.data.stats[key] ??= { reviews: 0, newCards: 0 });
		stat.practice = (stat.practice ?? 0) + 1;
		this.data.xp += correct ? 5 : 2;
		this.maybeGrantQuestReward();
		void this.saveAll();
	}

	// ------------------------------------------------------- QUEST & STREAK

	/** 3 nhiệm vụ mỗi ngày: [tên, tiến độ, mục tiêu] */
	questProgress(): Array<{ icon: string; name: string; cur: number; goal: number }> {
		const s = this.data.stats[todayKey()];
		return [
			{ icon: "📖", name: "Ôn tập", cur: s?.reviews ?? 0, goal: this.settings.dailyReviewGoal },
			{ icon: "✨", name: "Thẻ mới", cur: s?.newCards ?? 0, goal: this.settings.dailyNewGoal },
			{ icon: "🎯", name: "Luyện tập", cur: s?.practice ?? 0, goal: this.settings.dailyPracticeGoal },
		].filter((q) => q.goal > 0);
	}

	questsAllDone(): boolean {
		const qs = this.questProgress();
		return qs.length > 0 && qs.every((q) => q.cur >= q.goal);
	}

	questRewardClaimed(): boolean {
		return this.data.questRewardDates.includes(todayKey());
	}

	private maybeGrantQuestReward(): void {
		if (this.questRewardClaimed() || !this.questsAllDone()) return;
		this.data.questRewardDates.push(todayKey());
		this.data.xp += 50;
		if (this.data.freezes < MAX_FREEZES) this.data.freezes++;
		new Notice("🏆 Hoàn thành nhiệm vụ ngày! +50 XP, +1 🧊 streak freeze");
	}

	/** Tự dùng streak freeze để vá các ngày nghỉ (nếu đủ freeze vá kín) */
	private autoFreeze(): void {
		const stats = this.data.stats;
		const isActive = (k: string) => (stats[k]?.reviews ?? 0) > 0 || this.data.frozenDays.includes(k);
		const gap: string[] = [];
		const d = new Date();
		d.setDate(d.getDate() - 1);
		for (let i = 0; i < 30; i++) {
			const k = todayKey(d);
			if (isActive(k)) {
				if (gap.length > 0 && gap.length <= this.data.freezes) {
					this.data.frozenDays.push(...gap);
					this.data.freezes -= gap.length;
					new Notice(`🧊 Đã dùng ${gap.length} streak freeze để giữ chuỗi ngày!`);
					void this.saveAll();
				}
				return;
			}
			gap.push(k);
			d.setDate(d.getDate() - 1);
		}
	}

	isFrozen(day: string): boolean {
		return this.data.frozenDays.includes(day);
	}

	// --------------------------------------------------- HIGHLIGHT (immersion)

	private knownRegexCache: { re: RegExp | null; map: Map<string, VocabCard>; at: number } | null = null;

	/** Regex + map các từ đã học (state != New) để highlight trong reading mode */
	getKnownWords(): { re: RegExp | null; map: Map<string, VocabCard> } {
		const now = Date.now();
		if (this.knownRegexCache && now - this.knownRegexCache.at < 60_000) return this.knownRegexCache;
		const map = new Map<string, VocabCard>();
		const parts: string[] = [];
		const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const cards = this.store
			.getAllCards()
			.filter(
				(c) =>
					c.fsrs.state !== State.New &&
					c.type !== "sentence" &&
					c.type !== "passage" &&
					c.type !== "grammar" &&
					c.word.length >= 3 &&
					c.word.split(/\s+/).length <= 4
			)
			.sort((a, b) => b.word.length - a.word.length);
		for (const c of cards) {
			const tokens = c.word.trim().split(/\s+/);
			const pattern = tokens
				.map((t, i) => (i === tokens.length - 1 ? `${esc(t)}(?:s|es|ed|d|ing)?` : esc(t)))
				.join("\\s+");
			parts.push(pattern);
			map.set(c.word.toLowerCase(), c);
			for (const suf of ["s", "es", "ed", "d", "ing"]) map.set(c.word.toLowerCase() + suf, c);
		}
		const re = parts.length ? new RegExp(`\\b(${parts.join("|")})\\b`, "gi") : null;
		this.knownRegexCache = { re, map, at: now };
		return this.knownRegexCache;
	}

	invalidateKnownWords(): void {
		this.knownRegexCache = null;
	}

	private lookupKnown(matched: string): VocabCard | undefined {
		const map = this.knownRegexCache?.map;
		if (!map) return undefined;
		const m = matched.toLowerCase().replace(/\s+/g, " ");
		return map.get(m);
	}

	highlightElement(el: HTMLElement): void {
		if (!this.settings.highlightEnabled) return;
		const { re } = this.getKnownWords();
		if (!re) return;
		const SKIP = new Set(["CODE", "PRE", "A", "BUTTON", "INPUT", "TEXTAREA", "SVG", "STYLE"]);
		const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
			acceptNode: (node) => {
				let p: HTMLElement | null = node.parentElement;
				while (p && p !== el) {
					if (SKIP.has(p.tagName) || p.classList.contains("vf-known")) return NodeFilter.FILTER_REJECT;
					p = p.parentElement;
				}
				return NodeFilter.FILTER_ACCEPT;
			},
		});
		const targets: Text[] = [];
		let n: Node | null;
		while ((n = walker.nextNode())) targets.push(n as Text);
		let budget = 200;
		for (const textNode of targets) {
			if (budget <= 0) break;
			const text = textNode.textContent ?? "";
			if (text.length < 3) continue;
			re.lastIndex = 0;
			if (!re.test(text)) continue;
			re.lastIndex = 0;
			const frag = document.createDocumentFragment();
			let last = 0;
			let m: RegExpExecArray | null;
			while ((m = re.exec(text)) && budget > 0) {
				frag.appendChild(document.createTextNode(text.slice(last, m.index)));
				const card = this.lookupKnown(m[1]);
				const span = document.createElement("span");
				span.textContent = m[0];
				const learning =
					card && (card.fsrs.state === State.Learning || card.fsrs.state === State.Relearning);
				span.className = `vf-known ${learning ? "vf-known-learning" : "vf-known-review"}`;
				if (card) span.setAttribute("aria-label", card.meaningVi || card.meaningEn);
				frag.appendChild(span);
				last = m.index + m[0].length;
				budget--;
			}
			frag.appendChild(document.createTextNode(text.slice(last)));
			textNode.replaceWith(frag);
		}
	}

	refreshStatusBar(): void {
		if (!this.statusEl) return;
		try {
			const due = this.store.getDueCards().length;
			const newAvail = Math.min(this.store.getNewCards().length, this.newRemainingToday());
			this.statusEl.setText(due + newAvail > 0 ? `📚 ${due} due · ${newAvail} mới` : "📚 xong ✓");
		} catch {
			// vault chưa sẵn sàng — bỏ qua
		}
	}

	// ------------------------------------------------------------------- TTS

	speak(text: string): void {
		if (!text) return;
		const synth = window.speechSynthesis;
		synth.cancel();
		const u = new SpeechSynthesisUtterance(text);
		u.lang = "en-US";
		u.rate = this.settings.ttsRate;
		if (this.settings.ttsVoice) {
			const voice = synth.getVoices().find((v) => v.name === this.settings.ttsVoice);
			if (voice) u.voice = voice;
		} else {
			const voice = synth.getVoices().find((v) => v.lang === "en-US") ??
				synth.getVoices().find((v) => v.lang.startsWith("en"));
			if (voice) u.voice = voice;
		}
		synth.speak(u);
	}
}
