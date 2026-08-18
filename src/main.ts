import {
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	TFile,
	WorkspaceLeaf,
	debounce,
	normalizePath,
} from "obsidian";
import { generateImage } from "./ai";
import { AddCardModal, type AddCardPrefill } from "./addCardModal";
import { AboutModal } from "./aboutModal";
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
	type LearningSkill,
} from "./types";
import { State } from "./srs";
import { checkBadges } from "./badges";
import { VocabForgeSettingTab } from "./settingsTab";
import {
	detectAiCliProviders,
	runAiCli,
	type AiCliProvider,
} from "./aiCli";
import {
	buildSmartCapturePrompt,
	parseSmartCaptureSuggestions,
	SmartCaptureModal,
} from "./smartCaptureModal";

export default class VocabForgePlugin extends Plugin {
	data!: VocabForgeData;
	settings!: VocabForgeSettings;
	store!: CardStore;
	scheduler!: FSRS;
	private statusEl!: HTMLElement;
	private readonly aiSessions = new Map<string, { provider: AiCliProvider; id: string }>();
	private autoAiProvider: AiCliProvider | null = null;
	private readonly autoAiFailures = new Set<AiCliProvider>();
	private aiWorkingDirectory = "";

	async onload(): Promise<void> {
		const raw = (await this.loadData()) as Partial<VocabForgeData> | null;
		const emptySkill = () => ({ attempts: 0, totalScore: 0, lastAt: "" });
		const savedSkills = raw?.skillStats;
		this.data = {
			settings: { ...DEFAULT_SETTINGS, ...(raw?.settings ?? {}) },
			stats: raw?.stats ?? {},
			xp: raw?.xp ?? 0,
			freezes: raw?.freezes ?? 1,
			frozenDays: raw?.frozenDays ?? [],
			questRewardDates: raw?.questRewardDates ?? [],
			story: raw?.story ?? null,
			badges: raw?.badges ?? {},
			lastReminder: raw?.lastReminder ?? "",
			skillStats: {
				memory: { ...emptySkill(), ...(savedSkills?.memory ?? {}) },
				listening: { ...emptySkill(), ...(savedSkills?.listening ?? {}) },
				speaking: { ...emptySkill(), ...(savedSkills?.speaking ?? {}) },
				writing: { ...emptySkill(), ...(savedSkills?.writing ?? {}) },
			},
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
			id: "smart-capture",
			name: "Smart Capture từ YouTube / transcript",
			callback: () => this.openSmartCapture(),
		});
		this.addCommand({
			id: "open-about",
			name: "Thông tin tác giả & plugin (About)",
			callback: () => this.openAboutModal(),
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
		this.registerInterval(window.setInterval(() => this.maybeRemind(), 60_000));
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

	openAboutModal(): void {
		new AboutModal(this.app, this).open();
	}

	openSmartCapture(initialTranscript = ""): void {
		new SmartCaptureModal(this.app, this.store, {
			initialTranscript,
			initialCategory: this.settings.learningGoal === "cambridge"
				? "cambridge-c2"
				: this.settings.learningGoal === "daily"
					? "casual"
					: this.settings.learningGoal,
			ytDlpPath: "yt-dlp",
			extractor: async (context) => {
				const raw = await this.runAI(buildSmartCapturePrompt(context), 180_000);
				return parseSmartCaptureSuggestions(raw);
			},
			onCardsCreated: () => {
				this.invalidateKnownWords();
				this.refreshStatusBar();
			},
		}).open();
	}

	private aiPath(provider: AiCliProvider): string | undefined {
		const configured = ({
			grok: this.settings.grokPath,
			claude: this.settings.claudePath,
			codex: this.settings.codexPath,
			gemini: this.settings.geminiPath,
		})[provider].trim();
		return configured && configured !== provider ? configured : undefined;
	}

	private aiPaths(): Partial<Record<AiCliProvider, string>> {
		const paths: Partial<Record<AiCliProvider, string>> = {};
		for (const provider of ["grok", "claude", "codex", "gemini"] as AiCliProvider[]) {
			const configured = this.aiPath(provider);
			if (configured) paths[provider] = configured;
		}
		return paths;
	}

	private getAiWorkingDirectory(): string {
		if (this.aiWorkingDirectory) return this.aiWorkingDirectory;
		const requireFn = (window as unknown as { require?: (name: string) => unknown }).require;
		if (!requireFn) return "";
		const fs = requireFn("fs") as { mkdirSync(path: string, options: { recursive: boolean }): void };
		const os = requireFn("os") as { tmpdir(): string };
		const path = requireFn("path") as { join(...parts: string[]): string };
		this.aiWorkingDirectory = path.join(os.tmpdir(), "vocab-forge-ai-sandbox");
		fs.mkdirSync(this.aiWorkingDirectory, { recursive: true });
		return this.aiWorkingDirectory;
	}

	private async selectedAiProvider(): Promise<AiCliProvider> {
		if (this.settings.aiProvider !== "auto") return this.settings.aiProvider;
		if (this.autoAiProvider) return this.autoAiProvider;
		const preferred: AiCliProvider[] = ["claude", "grok", "gemini", "codex"];
		const statuses = await detectAiCliProviders({
			paths: this.aiPaths(),
		});
		const found = preferred.find((provider) =>
			!this.autoAiFailures.has(provider) && statuses.some((s) => s.provider === provider && s.available)
		);
		if (!found) throw new Error("Chưa tìm thấy Claude, Codex, Gemini hoặc Grok CLI đã đăng nhập");
		this.autoAiProvider = found;
		return found;
	}

	async runAI(prompt: string, timeoutMs = 120_000, sessionKey?: string): Promise<string> {
		const previous = sessionKey ? this.aiSessions.get(sessionKey) : undefined;
		const provider = previous?.provider ?? await this.selectedAiProvider();
		const session = previous && previous.provider === provider
			? { mode: "resume" as const, id: previous.id }
			: sessionKey
				? { mode: "new" as const }
				: { mode: "none" as const };
		let result;
		try {
			result = await runAiCli(prompt, {
				provider,
				executablePath: this.aiPath(provider),
				cwd: this.getAiWorkingDirectory() || undefined,
				timeoutMs,
				session,
			});
		} catch (error) {
			// Auto mode may find an installed but logged-out CLI. For a new request,
			// remember that failure and try the next locally signed-in provider.
			if (this.settings.aiProvider === "auto" && !previous && this.autoAiFailures.size < 3) {
				this.autoAiFailures.add(provider);
				this.autoAiProvider = null;
				return this.runAI(prompt, timeoutMs, sessionKey);
			}
			throw error;
		}
		if (sessionKey && result.sessionId) this.aiSessions.set(sessionKey, { provider, id: result.sessionId });
		return result.text;
	}

	clearAiSession(sessionKey: string): void {
		this.aiSessions.delete(sessionKey);
	}

	resetAiProvider(): void {
		this.autoAiProvider = null;
		this.autoAiFailures.clear();
		this.aiSessions.clear();
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_VOCAB)) {
			if (leaf.view instanceof VocabReviewView) leaf.view.resetAiConversation();
		}
	}

	async aiStatusSummary(): Promise<string> {
		const statuses = await detectAiCliProviders({
			paths: this.aiPaths(),
		});
		return statuses
			.map((s) => `${s.available ? "✅" : "○"} ${s.provider}${s.version ? ` · ${s.version}` : ""}`)
			.join("\n");
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

	/** passed: true/false nếu thẻ đang ở trạng thái Review/Relearning (tính retention); null nếu thẻ mới/learning */
	recordReview(wasNew: boolean, passed: boolean | null = null): void {
		const key = todayKey();
		const stat = (this.data.stats[key] ??= { reviews: 0, newCards: 0 });
		stat.reviews++;
		if (wasNew) stat.newCards++;
		if (passed === true) stat.pass = (stat.pass ?? 0) + 1;
		else if (passed === false) stat.fail = (stat.fail ?? 0) + 1;
		if (passed !== null) {
			const memory = this.data.skillStats.memory;
			memory.attempts++;
			memory.totalScore += passed ? 100 : 0;
			memory.lastAt = new Date().toISOString();
		}
		this.data.xp += 10;
		this.maybeGrantQuestReward();
		this.checkBadges();
		void this.saveAll();
	}

	recordPractice(correct: boolean): void {
		const key = todayKey();
		const stat = (this.data.stats[key] ??= { reviews: 0, newCards: 0 });
		stat.practice = (stat.practice ?? 0) + 1;
		this.data.xp += correct ? 5 : 2;
		this.maybeGrantQuestReward();
		this.checkBadges();
		void this.saveAll();
	}

	recordSkill(skill: LearningSkill, score: number): void {
		const stat = this.data.skillStats[skill];
		const bounded = Math.max(0, Math.min(100, score));
		stat.attempts++;
		stat.totalScore += bounded;
		stat.recentScore = stat.recentScore == null ? bounded : stat.recentScore * 0.72 + bounded * 0.28;
		stat.lastAt = new Date().toISOString();
		this.data.xp += score >= 80 ? 8 : score >= 60 ? 5 : 2;
		void this.saveAll();
	}

	computeStreak(): number {
		const stats = this.data.stats;
		const active = (k: string) => (stats[k]?.reviews ?? 0) > 0 || this.isFrozen(k);
		let streak = 0;
		const d = new Date();
		if (!active(todayKey(d))) d.setDate(d.getDate() - 1);
		while (active(todayKey(d))) {
			streak++;
			d.setDate(d.getDate() - 1);
		}
		return streak;
	}

	private checkBadges(): void {
		try {
			const fresh = checkBadges(
				{ data: this.data, cards: this.store.getAllCards(), streak: this.computeStreak() },
				todayKey()
			);
			for (const b of fresh) new Notice(`${b.icon} Huy hiệu mới: ${b.name} — ${b.desc}!`, 7000);
		} catch (e) {
			console.error("Vocab Forge badges:", e);
		}
	}

	/** Nhắc học hằng ngày: đúng giờ đã đặt, còn thẻ due, chưa nhắc hôm nay */
	private maybeRemind(): void {
		const hour = this.settings.reminderHour;
		if (hour < 0) return;
		const now = new Date();
		if (now.getHours() !== hour) return;
		const key = todayKey();
		if (this.data.lastReminder === key) return;
		try {
			const due = this.store.getDueEntries(this.settings.reverseEnabled).length;
			if (due === 0) return;
			this.data.lastReminder = key;
			void this.saveAll();
			new Notice(`📚 Vocab Forge: ${due} thẻ đang chờ ôn — giữ chuỗi ${this.computeStreak()} ngày 🔥`, 10000);
			if (typeof Notification !== "undefined" && Notification.permission !== "denied") {
				const fire = () =>
					new Notification("Vocab Forge 🎓", {
						body: `${due} thẻ đang chờ ôn hôm nay — vào học thôi!`,
					});
				if (Notification.permission === "granted") fire();
				else void Notification.requestPermission().then((p) => p === "granted" && fire());
			}
		} catch (e) {
			console.error("Vocab Forge reminder:", e);
		}
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
			const due = this.store.getDueEntries(this.settings.reverseEnabled).length;
			const revNew = this.settings.reverseEnabled ? this.store.getRevNewCards().length : 0;
			const totalNew = this.store.getNewCards().length + revNew;
			const newAvail = Math.min(totalNew, this.newRemainingToday());
			if (due + newAvail > 0) {
				this.statusEl.setText(`📚 ${due} due · ${newAvail} mới`);
			} else if (totalNew > 0) {
				this.statusEl.setText(`📚 0 due · ${totalNew} mới`);
			} else {
				this.statusEl.setText("📚 xong ✓");
			}
		} catch {
			// vault chưa sẵn sàng — bỏ qua
		}
	}

	// --------------------------------------------------------------- IMAGES

	/** Sinh ảnh minh hoạ bằng grok /imagine rồi gắn vào frontmatter thẻ. Chạy nền, trả true nếu thành công. */
	async generateCardImage(file: TFile, word: string, meaningEn: string): Promise<boolean> {
		try {
			const tmp = await generateImage(word, meaningEn, this.settings.grokPath);
			if (!tmp) return false;
			const req = (window as unknown as { require: (m: string) => unknown }).require;
			const fs = req("fs") as { readFileSync(p: string): { buffer: ArrayBuffer; byteOffset: number; byteLength: number } };
			const data = fs.readFileSync(tmp);
			const folder = "5. Toolbox/Attachments/Vocab";
			if (!this.app.vault.getAbstractFileByPath(normalizePath(folder))) {
				try {
					await this.app.vault.createFolder(normalizePath(folder));
				} catch {
					// đã tồn tại
				}
			}
			const imgName = `${file.basename}.png`;
			await this.app.vault.adapter.writeBinary(
				normalizePath(`${folder}/${imgName}`),
				data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
			);
			await this.app.fileManager.processFrontMatter(file, (fm) => {
				fm.image = `[[${imgName}]]`;
			});
			return true;
		} catch (e) {
			console.error("Vocab Forge image:", e);
			return false;
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
