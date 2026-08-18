import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type VocabForgePlugin from "./main";
import { formatInterval, Rating, State, type Grade } from "./srs";
import {
	categoryEmoji,
	endOfToday,
	todayKey,
	type ReviewEntry,
	type VocabCard,
} from "./types";
import {
	buildPracticeQueue,
	fuzzyEqual,
	makeChoice,
	MODE_INFO,
	shuffle,
	sample,
	type MatchItem,
	type PracticeItem,
	type PracticeMode,
} from "./practice";
import {
	extractJson,
	grammarPrompt,
	mnemonicPrompt,
	runGrok,
	sentenceCheckPrompt,
	storyPrompt,
	type SentenceCheck,
} from "./ai";
import { XP_PER_LEVEL } from "./types";

export const VIEW_TYPE_VOCAB = "vocab-forge-review";

type Section =
	| "dashboard"
	| "decks"
	| "deck-detail"
	| "review"
	| "done"
	| "practice"
	| "practice-run"
	| "practice-done"
	| "story"
	| "settings";

const TYPE_LABELS: Record<string, string> = {
	word: "Từ",
	phrase: "Cụm từ",
	idiom: "Thành ngữ",
	collocation: "Collocation",
	sentence: "Câu",
	passage: "Đoạn",
	grammar: "Ngữ pháp",
};

const STATE_LABELS: Record<number, string> = {
	[State.New]: "Mới",
	[State.Learning]: "Đang học",
	[State.Review]: "Ôn tập",
	[State.Relearning]: "Học lại",
};

export class VocabReviewView extends ItemView {
	private section: Section = "dashboard";
	private currentDeck = "";
	private deckSearch = "";
	private deckLayout: "grid" | "list" = "grid";

	private queue: ReviewEntry[] = [];
	private current: ReviewEntry | null = null;
	private flipped = false;
	private sessionDone = 0;
	private sessionTotal = 0;
	private sessionCategory: string | null = null;
	private rating = false;

	// --- luyện tập
	private practiceDeck: string | null = null;
	private practiceSize = 10;
	private practiceQueue: PracticeItem[] = [];
	private practiceIdx = 0;
	private practiceScore = 0;
	private practiceWrong: PracticeItem[] = [];
	private practiceMode: PracticeMode = "cloze";
	private practicePhase: "question" | "feedback" = "question";
	private practiceCorrect = false;
	private builderPicked: number[] = [];
	private practiceInput: HTMLInputElement | null = null;

	// --- AI production
	private aiSentence = "";
	private aiResult: SentenceCheck | null = null;
	private aiBusy = false;
	private storyBusy = false;

	// --- nối cặp (match)
	private matchSel: { kind: "w" | "m"; idx: number } | null = null;
	private matchDone = new Set<number>();
	private matchMistaken = new Set<number>();
	private matchWrongFlash: { w: number; m: number } | null = null;
	private matchLocked = false;

	constructor(leaf: WorkspaceLeaf, private plugin: VocabForgePlugin) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_VOCAB;
	}
	getDisplayText(): string {
		return "Vocab Forge";
	}
	getIcon(): string {
		return "graduation-cap";
	}

	async onOpen(): Promise<void> {
		this.registerDomEvent(document, "keydown", (evt) => this.onKey(evt));
		this.render();
	}

	renderHome(): void {
		this.section = "dashboard";
		this.render();
	}

	// ================================================================ SHELL

	private render(): void {
		const root = this.contentEl;
		root.empty();
		root.addClass("vf-root");
		const app = root.createDiv({ cls: "vf-app" });
		this.renderNav(app);
		const main = app.createDiv({ cls: "vf-main" });
		switch (this.section) {
			case "dashboard": this.renderDashboard(main); break;
			case "decks": this.renderDecks(main); break;
			case "deck-detail": this.renderDeckDetail(main); break;
			case "review": this.renderCard(main); break;
			case "done": this.renderDone(main); break;
			case "practice": this.renderPracticeHub(main); break;
			case "practice-run": this.renderPracticeRun(main); break;
			case "practice-done": this.renderPracticeDone(main); break;
			case "story": this.renderStory(main); break;
			case "settings": this.renderSettings(main); break;
		}
	}

	private renderNav(app: HTMLElement): void {
		const nav = app.createDiv({ cls: "vf-nav" });
		const brand = nav.createDiv({ cls: "vf-brand" });
		brand.createSpan({ text: "🎓", cls: "vf-brand-icon" });
		brand.createSpan({ text: "Vocab Forge", cls: "vf-brand-name" });

		const items: Array<{ id: Section | "study" | "add"; icon: string; label: string }> = [
			{ id: "dashboard", icon: "🏠", label: "Dashboard" },
			{ id: "study", icon: "▶️", label: "Học ngay" },
			{ id: "practice", icon: "🎯", label: "Luyện tập" },
			{ id: "decks", icon: "🗂️", label: "Bộ thẻ" },
			{ id: "add", icon: "➕", label: "Thêm thẻ" },
			{ id: "settings", icon: "⚙️", label: "Cài đặt" },
		];
		for (const it of items) {
			const active =
				it.id === this.section ||
				(it.id === "study" && (this.section === "review" || this.section === "done")) ||
				(it.id === "practice" && (this.section === "practice-run" || this.section === "practice-done")) ||
				(it.id === "decks" && this.section === "deck-detail");
			const el = nav.createDiv({ cls: `vf-nav-item ${active ? "vf-nav-active" : ""}` });
			el.createSpan({ text: it.icon, cls: "vf-nav-icon" });
			el.createSpan({ text: it.label, cls: "vf-nav-label" });
			el.onclick = () => {
				if (it.id === "study") this.startSession(null);
				else if (it.id === "add") this.plugin.openAddCardModal();
				else {
					this.section = it.id;
					this.render();
				}
			};
		}

		const foot = nav.createDiv({ cls: "vf-nav-foot" });
		const xp = this.plugin.data.xp;
		const level = Math.floor(xp / XP_PER_LEVEL) + 1;
		const lvlBox = foot.createDiv({ cls: "vf-nav-level" });
		lvlBox.createDiv({ text: `⭐ Level ${level}`, cls: "vf-nav-level-name" });
		const lvlBar = lvlBox.createDiv({ cls: "vf-nav-level-bar" });
		lvlBar.createDiv({ cls: "vf-nav-level-fill" }).style.width =
			`${Math.round(((xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100)}%`;
		lvlBox.createDiv({ text: `${xp} XP`, cls: "vf-nav-xp" });
		const chips = foot.createDiv({ cls: "vf-nav-chips" });
		chips.createSpan({ text: `🔥 ${this.computeStreak()}`, cls: "vf-nav-streak" });
		chips.createSpan({ text: `🧊 ×${this.plugin.data.freezes}`, cls: "vf-nav-freeze" });
	}

	// ============================================================ DASHBOARD

	private renderDashboard(main: HTMLElement): void {
		const due = this.plugin.store.getDueEntries(this.plugin.settings.reverseEnabled);
		const news = this.plugin.store.getNewCards();
		const revNews = this.plugin.settings.reverseEnabled
			? this.plugin.store.getRevNewCards()
			: [];
		const newAvailable = Math.min(news.length + revNews.length, this.plugin.newRemainingToday());
		const all = this.plugin.store.getAllCards();
		const learned = all.filter((c) => c.fsrs.state !== State.New).length;
		const today = this.plugin.data.stats[todayKey()];
		const total = due.length + newAvailable;

		// --- Hero
		const hero = main.createDiv({ cls: "vf-hero" });
		const heroLeft = hero.createDiv({ cls: "vf-hero-left" });
		heroLeft.createDiv({ text: this.greeting(), cls: "vf-hero-hi" });
		heroLeft.createDiv({
			text:
				total > 0
					? `Hôm nay có ${due.length} thẻ đến hạn và ${newAvailable} thẻ mới đang chờ bạn.`
					: "Bạn đã hoàn thành mục tiêu hôm nay. Tuyệt vời! 🎉",
			cls: "vf-hero-sub",
		});
		const heroBtns = heroLeft.createDiv({ cls: "vf-hero-btns" });
		const startBtn = heroBtns.createEl("button", {
			text: total > 0 ? `▶  Học ngay · ${total} thẻ` : "✓ Đã xong hôm nay",
			cls: "vf-btn-hero",
		});
		startBtn.disabled = total === 0;
		startBtn.onclick = () => this.startSession(null);
		const practiceBtn = heroBtns.createEl("button", { text: "🎯 Luyện tập", cls: "vf-btn-hero-ghost" });
		practiceBtn.onclick = () => { this.section = "practice"; this.render(); };
		const storyBtn = heroBtns.createEl("button", { text: "📖 Story hôm nay", cls: "vf-btn-hero-ghost" });
		storyBtn.onclick = () => { this.section = "story"; this.render(); };
		const ring = hero.createDiv({ cls: "vf-hero-ring" });
		const pct = today ? Math.min(100, Math.round((today.reviews / Math.max(1, today.reviews + total)) * 100)) : total > 0 ? 0 : 100;
		ring.style.setProperty("--vf-pct", String(pct));
		ring.createDiv({ text: `${pct}%`, cls: "vf-hero-ring-text" });

		// --- Stat tiles
		const tiles = main.createDiv({ cls: "vf-tiles" });
		this.tile(tiles, "⏰", String(due.length), "Đến hạn", "vf-tile-due");
		this.tile(tiles, "✨", String(newAvailable), "Thẻ mới", "vf-tile-new");
		this.tile(tiles, "📖", String(today?.reviews ?? 0), "Lượt ôn hôm nay", "");
		this.tile(tiles, "🏆", `${learned}/${all.length}`, "Đã học / tổng", "");

		// --- Decks tóm tắt
		const decks = this.groupByCategory(all);
		if (decks.size) {
			const head = main.createDiv({ cls: "vf-section-head" });
			head.createEl("h4", { text: "Bộ thẻ" });
			const more = head.createEl("a", { text: "Xem tất cả →", cls: "vf-link" });
			more.onclick = () => { this.section = "decks"; this.render(); };
			const row = main.createDiv({ cls: "vf-deck-row" });
			let i = 0;
			for (const [cat, cards] of [...decks.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 4)) {
				this.deckCard(row, cat, cards, i++);
			}
		}

		// --- Nhiệm vụ ngày
		const quests = this.plugin.questProgress();
		if (quests.length) {
			const qhead = main.createDiv({ cls: "vf-section-head" });
			qhead.createEl("h4", { text: "Nhiệm vụ hôm nay" });
			if (this.plugin.questRewardClaimed())
				qhead.createSpan({ text: "🏆 Đã nhận thưởng", cls: "vf-quest-done-tag" });
			const qbox = main.createDiv({ cls: "vf-quest-box" });
			for (const q of quests) {
				const row = qbox.createDiv({ cls: "vf-quest-row" });
				row.createSpan({ text: q.icon, cls: "vf-quest-icon" });
				const mid2 = row.createDiv({ cls: "vf-quest-mid" });
				const lr = mid2.createDiv({ cls: "vf-quest-label-row" });
				lr.createSpan({ text: q.name, cls: "vf-quest-name" });
				lr.createSpan({
					text: q.cur >= q.goal ? "✓" : `${q.cur}/${q.goal}`,
					cls: q.cur >= q.goal ? "vf-quest-check" : "vf-quest-count",
				});
				const qb = mid2.createDiv({ cls: "vf-quest-bar" });
				qb.createDiv({ cls: "vf-quest-fill" }).style.width =
					`${Math.min(100, Math.round((q.cur / q.goal) * 100))}%`;
			}
			qbox.createDiv({
				text: "Hoàn thành cả 3 → +50 XP và +1 🧊 streak freeze",
				cls: "vf-quest-hint",
			});
		}

		// --- Heatmap
		main.createEl("h4", { text: "Hoạt động 17 tuần" });
		this.renderHeatmap(main.createDiv({ cls: "vf-heatmap" }));

		// --- Dự báo 30 ngày
		main.createEl("h4", { text: "Dự báo thẻ đến hạn — 30 ngày tới" });
		this.renderForecast(main.createDiv({ cls: "vf-forecast" }), all);

		// --- Từ khó
		const hard = all
			.filter((c) => c.fsrs.lapses >= 2)
			.sort((a, b) => b.fsrs.lapses - a.fsrs.lapses)
			.slice(0, 6);
		if (hard.length) {
			main.createEl("h4", { text: "😤 Từ khó nhằn" });
			const list = main.createDiv({ cls: "vf-hard-list" });
			for (const c of hard) {
				const item = list.createDiv({ cls: "vf-hard-item" });
				item.createSpan({ text: c.word, cls: "vf-hard-word" });
				item.createSpan({ text: `quên ${c.fsrs.lapses} lần`, cls: "vf-hard-count" });
				item.onclick = () => this.app.workspace.openLinkText(c.file.path, "", true);
			}
		}
	}

	private greeting(): string {
		const h = new Date().getHours();
		if (h < 11) return "Chào buổi sáng, Hoàng! ☀️";
		if (h < 14) return "Chào buổi trưa, Hoàng! 🌤";
		if (h < 18) return "Chào buổi chiều, Hoàng! 🌇";
		return "Chào buổi tối, Hoàng! 🌙";
	}

	private tile(parent: HTMLElement, icon: string, value: string, label: string, cls: string): void {
		const t = parent.createDiv({ cls: `vf-tile ${cls}`.trim() });
		t.createDiv({ text: icon, cls: "vf-tile-icon" });
		const right = t.createDiv({ cls: "vf-tile-body" });
		right.createDiv({ text: value, cls: "vf-tile-value" });
		right.createDiv({ text: label, cls: "vf-tile-label" });
	}

	// ================================================================ DECKS

	private groupByCategory(all: VocabCard[]): Map<string, VocabCard[]> {
		const m = new Map<string, VocabCard[]>();
		for (const c of all) {
			const arr = m.get(c.category) ?? [];
			arr.push(c);
			m.set(c.category, arr);
		}
		return m;
	}

	private deckStats(cards: VocabCard[]): { due: number; fresh: number } {
		const cutoff = endOfToday().getTime();
		let due = 0, fresh = 0;
		for (const c of cards) {
			if (c.fsrs.state === State.New) fresh++;
			else if (c.fsrs.due.getTime() <= cutoff) due++;
		}
		return { due, fresh };
	}

	private deckCard(parent: HTMLElement, cat: string, cards: VocabCard[], index: number): void {
		const { due, fresh } = this.deckStats(cards);
		const el = parent.createDiv({ cls: `vf-deck vf-deck-c${index % 6}` });
		const top = el.createDiv({ cls: "vf-deck-top" });
		top.createSpan({ text: categoryEmoji(cat), cls: "vf-deck-emoji" });
		top.createSpan({ text: cat, cls: "vf-deck-name" });
		el.createDiv({ text: `${cards.length} thẻ`, cls: "vf-deck-count" });
		const badges = el.createDiv({ cls: "vf-deck-badges" });
		if (due) badges.createSpan({ text: `${due} due`, cls: "vf-badge-due" });
		if (fresh) badges.createSpan({ text: `${fresh} mới`, cls: "vf-badge-fresh" });
		if (!due && !fresh) badges.createSpan({ text: "✓ xong", cls: "vf-badge-done" });
		el.onclick = () => {
			this.currentDeck = cat;
			this.deckSearch = "";
			this.section = "deck-detail";
			this.render();
		};
	}

	private renderDecks(main: HTMLElement): void {
		main.createEl("h3", { text: "🗂️ Bộ thẻ theo chủ đề" });
		const all = this.plugin.store.getAllCards();
		const decks = this.groupByCategory(all);
		if (!decks.size) {
			main.createDiv({ text: "Chưa có thẻ nào. Bấm ➕ Thêm thẻ để bắt đầu.", cls: "vf-empty" });
			return;
		}
		const grid = main.createDiv({ cls: "vf-deck-grid" });
		let i = 0;
		for (const [cat, cards] of [...decks.entries()].sort((a, b) => b[1].length - a[1].length)) {
			this.deckCard(grid, cat, cards, i++);
		}
	}

	private renderDeckDetail(main: HTMLElement): void {
		const cat = this.currentDeck;
		const cards = this.plugin.store.getAllCards().filter((c) => c.category === cat);
		const { due, fresh } = this.deckStats(cards);

		const head = main.createDiv({ cls: "vf-deck-head" });
		const backBtn = head.createEl("button", { text: "←", cls: "vf-btn-icon" });
		backBtn.onclick = () => { this.section = "decks"; this.render(); };
		head.createEl("h3", { text: `${categoryEmoji(cat)} ${cat}` });
		head.createSpan({ text: `${cards.length} thẻ · ${due} due · ${fresh} mới`, cls: "vf-muted" });

		const actions = main.createDiv({ cls: "vf-actions" });
		const total = due + Math.min(fresh, this.plugin.newRemainingToday());
		const study = actions.createEl("button", {
			text: total > 0 ? `▶  Học deck này (${total})` : "✓ Deck đã xong hôm nay",
			cls: "vf-btn-hero vf-btn-hero-small",
		});
		study.disabled = total === 0;
		study.onclick = () => this.startSession(cat);

		const toolbar = main.createDiv({ cls: "vf-list-toolbar" });
		const search = toolbar.createEl("input", {
			cls: "vf-search",
			attr: { type: "text", placeholder: "🔍 Tìm trong deck…", value: this.deckSearch },
		});
		search.oninput = () => {
			this.deckSearch = search.value;
			this.renderDeckList(listEl, cards);
		};
		const toggle = toolbar.createDiv({ cls: "vf-layout-toggle" });
		const gridBtn = toggle.createEl("button", { text: "⊞", cls: "vf-btn-icon" });
		const listBtn = toggle.createEl("button", { text: "☰", cls: "vf-btn-icon" });
		const syncToggle = () => {
			gridBtn.toggleClass("vf-toggle-active", this.deckLayout === "grid");
			listBtn.toggleClass("vf-toggle-active", this.deckLayout === "list");
		};
		gridBtn.onclick = () => { this.deckLayout = "grid"; syncToggle(); this.renderDeckList(listEl, cards); };
		listBtn.onclick = () => { this.deckLayout = "list"; syncToggle(); this.renderDeckList(listEl, cards); };
		syncToggle();

		const listEl = main.createDiv();
		this.renderDeckList(listEl, cards);
	}

	/** Ảnh đại diện thẻ: image trong frontmatter, fallback thumbnail YouTube từ source_url */
	private thumbnailFor(card: VocabCard): string | null {
		if (card.image) {
			let src = card.image.trim().replace(/^!?\[\[|\]\]$/g, "");
			if (/^https?:\/\//.test(src)) return src;
			const f = this.app.metadataCache.getFirstLinkpathDest(src, card.file.path);
			if (f) return this.app.vault.getResourcePath(f);
		}
		const m = card.sourceUrl.match(/(?:v=|youtu\.be\/|\/shorts\/)([\w-]{11})/);
		if (m) return `https://i.ytimg.com/vi/${m[1]}/mqdefault.jpg`;
		return null;
	}

	private renderDeckList(listEl: HTMLElement, cards: VocabCard[]): void {
		listEl.empty();
		listEl.className = this.deckLayout === "grid" ? "vf-card-grid" : "vf-card-list";
		const q = this.deckSearch.toLowerCase();
		const filtered = cards.filter(
			(c) => !q || c.word.toLowerCase().includes(q) || c.meaningVi.toLowerCase().includes(q)
		);
		if (!filtered.length) {
			listEl.createDiv({ text: "Không có thẻ nào khớp.", cls: "vf-empty" });
			return;
		}
		const sorted = filtered.sort((a, b) => a.word.localeCompare(b.word));
		if (this.deckLayout === "list") {
			for (const c of sorted) {
				const row = listEl.createDiv({ cls: "vf-card-row" });
				const left = row.createDiv({ cls: "vf-card-row-left" });
				left.createDiv({ text: c.word, cls: "vf-card-row-word" });
				left.createDiv({ text: c.meaningVi || c.meaningEn, cls: "vf-card-row-meaning" });
				const right = row.createDiv({ cls: "vf-card-row-right" });
				right.createSpan({ text: TYPE_LABELS[c.type] ?? c.type, cls: "vf-pill" });
				right.createSpan({
					text: STATE_LABELS[c.fsrs.state] ?? "?",
					cls: `vf-pill vf-pill-state-${c.fsrs.state}`,
				});
				row.onclick = () => this.app.workspace.openLinkText(c.file.path, "", true);
			}
			return;
		}
		// --- dạng lưới
		for (const c of sorted) {
			const tile = listEl.createDiv({ cls: "vf-tile-card" });
			const thumbBox = tile.createDiv({ cls: "vf-tile-thumb" });
			const thumb = this.thumbnailFor(c);
			if (thumb) {
				thumbBox.createEl("img", { attr: { src: thumb, loading: "lazy" } });
			} else {
				thumbBox.addClass("vf-tile-thumb-empty");
				thumbBox.createSpan({ text: categoryEmoji(c.category), cls: "vf-tile-thumb-emoji" });
			}
			thumbBox.createSpan({
				text: STATE_LABELS[c.fsrs.state] ?? "?",
				cls: `vf-pill vf-pill-float vf-pill-state-${c.fsrs.state}`,
			});
			const body = tile.createDiv({ cls: "vf-tile-body2" });
			body.createDiv({ text: c.word, cls: "vf-tile-word" });
			body.createDiv({ text: c.meaningVi || c.meaningEn, cls: "vf-tile-meaning" });
			const foot = body.createDiv({ cls: "vf-tile-foot" });
			foot.createSpan({ text: TYPE_LABELS[c.type] ?? c.type, cls: "vf-pill" });
			const speak = foot.createEl("button", { text: "🔊", cls: "vf-btn-tiny" });
			speak.onclick = (e) => { e.stopPropagation(); this.plugin.speak(c.word); };
			tile.onclick = () => this.app.workspace.openLinkText(c.file.path, "", true);
		}
	}

	// =============================================================== REVIEW

	startSession(category: string | null): void {
		this.sessionCategory = category;
		let due = this.plugin.store.getDueEntries(this.plugin.settings.reverseEnabled);
		let news = this.plugin.store.getNewCards();
		let revNews = this.plugin.settings.reverseEnabled ? this.plugin.store.getRevNewCards() : [];
		if (category) {
			due = due.filter((e) => e.card.category === category);
			news = news.filter((c) => c.category === category);
			revNews = revNews.filter((c) => c.category === category);
		}
		const budget = this.plugin.newRemainingToday();
		const newEntries: ReviewEntry[] = [
			...news.map((c): ReviewEntry => ({ card: c, dir: "fwd" })),
			...revNews.map((c): ReviewEntry => ({ card: c, dir: "rev" })),
		].slice(0, budget);
		this.queue = [...due, ...newEntries];
		this.sessionTotal = this.queue.length;
		this.sessionDone = 0;
		if (!this.queue.length) {
			this.section = "dashboard";
			this.render();
			new Notice("Không còn thẻ để học 🎉");
			return;
		}
		this.section = "review";
		this.nextCard();
	}

	private nextCard(): void {
		if (!this.queue.length) {
			this.section = "done";
			this.render();
			return;
		}
		const now = Date.now();
		const fsrsOf = (e: ReviewEntry) => (e.dir === "fwd" ? e.card.fsrs : e.card.fsrsRev);
		let idx = this.queue.findIndex(
			(e) => fsrsOf(e).state === State.New || fsrsOf(e).due.getTime() <= now
		);
		if (idx === -1) idx = 0;
		this.current = this.queue.splice(idx, 1)[0];
		this.flipped = false;
		this.aiSentence = "";
		this.aiResult = null;
		this.render();
	}

	// --------------------------------------------------------- AI (mặt sau)

	private renderAiSection(back: HTMLElement, card: VocabCard): void {
		const box = back.createDiv({ cls: "vf-ai-box" });

		if (card.mnemonic) {
			const mn = box.createDiv({ cls: "vf-ai-note vf-ai-mnemonic" });
			mn.createSpan({ text: "🧠 ", cls: "vf-ai-note-icon" });
			mn.createSpan({ text: card.mnemonic });
		}
		if (card.grammarNote) {
			const gr = box.createDiv({ cls: "vf-ai-note vf-ai-grammar" });
			gr.createSpan({ text: "📖 ", cls: "vf-ai-note-icon" });
			gr.createSpan({ text: card.grammarNote });
		}
		if (card.myExample) {
			const ex = box.createDiv({ cls: "vf-ai-note vf-ai-example" });
			ex.createSpan({ text: "✍️ ", cls: "vf-ai-note-icon" });
			ex.createSpan({ text: card.myExample });
		}

		const btnRow = box.createDiv({ cls: "vf-ai-btn-row" });
		const mnBtn = btnRow.createEl("button", {
			text: card.mnemonic ? "🧠 Mẹo nhớ mới" : "🧠 Tạo mẹo nhớ",
			cls: "vf-btn-icon vf-btn-ai",
		});
		mnBtn.onclick = () =>
			void this.aiAction(mnBtn, async () => {
				const out = await runGrok(
					mnemonicPrompt(card.word, card.meaningVi || card.meaningEn),
					this.plugin.settings.grokPath
				);
				if (out) await this.plugin.store.saveExtraField(card, "mnemonic", out.split("\n")[0].trim());
			});
		if (card.quote) {
			const grBtn = btnRow.createEl("button", {
				text: card.grammarNote ? "📖 Giải thích lại" : "📖 Giải thích ngữ pháp",
				cls: "vf-btn-icon vf-btn-ai",
			});
			grBtn.onclick = () =>
				void this.aiAction(grBtn, async () => {
					const out = await runGrok(grammarPrompt(card.quote), this.plugin.settings.grokPath);
					if (out) await this.plugin.store.saveExtraField(card, "grammar_note", out.trim());
				});
		}

		// --- đặt câu → AI chấm
		const writeBox = box.createDiv({ cls: "vf-ai-write" });
		const input = writeBox.createEl("input", {
			cls: "vf-practice-input vf-ai-input",
			attr: { type: "text", placeholder: `✍️ Đặt câu của bạn với "${card.word}"…`, spellcheck: "false" },
		});
		input.value = this.aiSentence;
		input.oninput = () => (this.aiSentence = input.value);
		input.onkeydown = (e) => e.stopPropagation();
		const checkBtn = writeBox.createEl("button", { text: "AI chấm", cls: "vf-btn-icon vf-btn-ai" });
		checkBtn.onclick = () =>
			void this.aiAction(checkBtn, async () => {
				if (!this.aiSentence.trim()) {
					new Notice("Gõ câu của bạn trước đã");
					return;
				}
				const raw = await runGrok(
					sentenceCheckPrompt(card.word, card.meaningEn, this.aiSentence.trim()),
					this.plugin.settings.grokPath
				);
				this.aiResult = extractJson<SentenceCheck>(raw);
				if (!this.aiResult) new Notice("AI trả lời không đúng định dạng — thử lại");
			});

		if (this.aiResult) {
			const r = this.aiResult;
			const res = box.createDiv({
				cls: `vf-feedback ${r.score >= 7 ? "vf-feedback-ok" : "vf-feedback-no"} vf-ai-result`,
			});
			res.createDiv({ text: `${r.score >= 7 ? "👍" : "🛠"} ${r.score}/10 — ${r.explain_vi}`, cls: "vf-feedback-text" });
			if (r.corrected && r.corrected.trim() && r.corrected.trim() !== this.aiSentence.trim())
				res.createDiv({ text: `→ ${r.corrected}`, cls: "vf-feedback-meaning" });
			const save = res.createEl("button", { text: "💾 Lưu câu vào thẻ", cls: "vf-btn-icon" });
			save.onclick = async () => {
				const sentence = (r.score >= 7 ? this.aiSentence : r.corrected).trim();
				await this.plugin.store.saveExtraField(card, "my_example", sentence);
				new Notice("Đã lưu câu của bạn vào thẻ ✍️");
				this.render();
			};
		}
	}

	private async aiAction(btn: HTMLButtonElement, fn: () => Promise<void>): Promise<void> {
		if (this.aiBusy) return;
		this.aiBusy = true;
		const orig = btn.textContent ?? "";
		btn.disabled = true;
		btn.setText("⏳ Đang hỏi AI…");
		try {
			await fn();
		} catch (e) {
			console.error("Vocab Forge AI:", e);
			new Notice("Lỗi gọi Grok CLI — kiểm tra đường dẫn grok trong Cài đặt");
		} finally {
			this.aiBusy = false;
			btn.disabled = false;
			btn.setText(orig);
			this.render();
		}
	}

	private renderCard(main: HTMLElement): void {
		const entry = this.current;
		if (!entry) {
			this.section = "dashboard";
			this.render();
			return;
		}
		const card = entry.card;
		const dir = entry.dir;
		const fsrs = dir === "fwd" ? card.fsrs : card.fsrsRev;
		main.addClass("vf-main-review");

		// --- top bar
		const top = main.createDiv({ cls: "vf-topbar" });
		const backBtn = top.createEl("button", { text: "✕", cls: "vf-btn-icon" });
		backBtn.onclick = () => { this.section = "dashboard"; this.render(); };
		const mid = top.createDiv({ cls: "vf-topbar-mid" });
		const bar = mid.createDiv({ cls: "vf-progress-bar" });
		bar.createDiv({ cls: "vf-progress-fill" }).style.width =
			`${Math.round((this.sessionDone / Math.max(1, this.sessionTotal)) * 100)}%`;
		mid.createDiv({
			text: `${this.sessionDone}/${this.sessionTotal}${this.sessionCategory ? ` · ${categoryEmoji(this.sessionCategory)} ${this.sessionCategory}` : ""}`,
			cls: "vf-progress-text",
		});
		const editBtn = top.createEl("button", { text: "✏️", cls: "vf-btn-icon" });
		editBtn.onclick = () => this.app.workspace.openLinkText(card.file.path, "", true);

		// --- flashcard
		const cardEl = main.createDiv({ cls: "vf-card vf-anim-pop" });
		const front = cardEl.createDiv({ cls: "vf-card-front" });
		const badgeRow = front.createDiv({ cls: "vf-badge-row" });
		badgeRow.createSpan({ text: `${categoryEmoji(card.category)} ${card.category}`, cls: "vf-chip-cat" });
		badgeRow.createSpan({ text: TYPE_LABELS[card.type] ?? card.type, cls: "vf-chip-type" });
		if (dir === "rev") badgeRow.createSpan({ text: "🔁 VI → EN", cls: "vf-chip-rev" });
		if (fsrs.state === State.New) badgeRow.createSpan({ text: "✨ mới", cls: "vf-chip-new" });

		if (dir === "rev" && !this.flipped) {
			// mặt trước chiều ngược: hiện nghĩa, đố từ
			front.createDiv({ text: card.meaningVi || card.meaningEn, cls: "vf-word vf-word-long vf-rev-meaning" });
			if (card.meaningVi && card.meaningEn)
				front.createDiv({ text: card.meaningEn, cls: "vf-hint" });
			front.createDiv({
				text: `→ Từ tiếng Anh nào? (${card.word.trim().split(/\s+/).length} từ)`,
				cls: "vf-hint vf-rev-prompt",
			});
		} else {
			front.createDiv({
				text: card.word,
				cls: card.word.length > 60 ? "vf-word vf-word-long" : "vf-word",
			});
			if (card.ipa) front.createDiv({ text: card.ipa, cls: "vf-ipa" });
			const speakBtn = front.createEl("button", { text: "🔊", cls: "vf-btn-speak" });
			speakBtn.onclick = (e) => {
				e.stopPropagation();
				this.plugin.speak(card.word);
			};
		}

		if (!this.flipped) {
			const flipBtn = main.createEl("button", {
				text: dir === "rev" ? "Xem đáp án 👆  ·  Space" : "Lật thẻ 👆  ·  Space",
				cls: "vf-btn-flip",
			});
			flipBtn.onclick = () => this.flip();
			cardEl.onclick = () => this.flip();
			if (dir === "fwd") this.plugin.speak(card.word);
			return;
		}

		// --- back
		const back = cardEl.createDiv({ cls: "vf-card-back" });
		if (card.meaningEn) {
			const en = back.createDiv({ cls: "vf-meaning-en" });
			en.createSpan({ text: "EN", cls: "vf-lang-tag" });
			en.createSpan({ text: card.meaningEn });
		}
		if (card.meaningVi) {
			const vi = back.createDiv({ cls: "vf-meaning-vi" });
			vi.createSpan({ text: "VI", cls: "vf-lang-tag vf-lang-vi" });
			vi.createSpan({ text: card.meaningVi });
		}
		if (card.quote) {
			const q = back.createDiv({ cls: "vf-quote" });
			this.renderQuoteWithHighlight(q, card.quote, card.word);
			const qs = q.createEl("button", { text: "🔊", cls: "vf-btn-tiny" });
			qs.onclick = () => this.plugin.speak(card.quote);
		}
		if (card.collocations.length) {
			const chips = back.createDiv({ cls: "vf-chips" });
			for (const c of card.collocations) chips.createSpan({ text: c, cls: "vf-chip" });
		}
		if (card.forms.length) {
			const fr = back.createDiv({ cls: "vf-chips vf-forms-row" });
			fr.createSpan({ text: "🔤", cls: "vf-forms-icon" });
			for (const f of card.forms) fr.createSpan({ text: f, cls: "vf-chip vf-chip-form" });
		}
		this.renderImage(back, card);
		const srcRow = back.createDiv({ cls: "vf-source-row" });
		const sourceName = card.source.replace(/^\[\[|\]\]$/g, "");
		if (sourceName) {
			const link = srcRow.createEl("a", { text: `📄 ${sourceName}`, cls: "vf-source-link" });
			link.onclick = (e) => {
				e.preventDefault();
				this.app.workspace.openLinkText(sourceName, card.file.path, true);
			};
		}
		if (card.sourceUrl) {
			const yt = srcRow.createEl("a", { text: "▶️ Xem video", cls: "vf-source-link" });
			yt.onclick = (e) => {
				e.preventDefault();
				window.open(card.sourceUrl);
			};
		}
		this.renderAiSection(back, card);

		// --- rating
		const now = new Date();
		const preview = this.plugin.scheduler.repeat(fsrs, now);
		const btnRow = main.createDiv({ cls: "vf-rate-row" });
		const defs: Array<{ grade: Grade; label: string; key: string; cls: string }> = [
			{ grade: Rating.Again, label: "Quên", key: "1", cls: "vf-rate-again" },
			{ grade: Rating.Hard, label: "Khó", key: "2", cls: "vf-rate-hard" },
			{ grade: Rating.Good, label: "Nhớ", key: "3", cls: "vf-rate-good" },
			{ grade: Rating.Easy, label: "Dễ", key: "4", cls: "vf-rate-easy" },
		];
		for (const d of defs) {
			const b = btnRow.createEl("button", { cls: `vf-rate ${d.cls}` });
			b.createDiv({ text: d.label, cls: "vf-rate-label" });
			b.createDiv({
				text: formatInterval(now, preview[d.grade].card.due),
				cls: "vf-rate-interval",
			});
			b.onclick = () => void this.rate(d.grade);
		}
		main.createDiv({ text: "Phím tắt: 1 · 2 · 3 · 4  —  S: phát âm", cls: "vf-kbd-hint" });
	}

	private renderQuoteWithHighlight(el: HTMLElement, quote: string, word: string): void {
		const container = el.createSpan({ cls: "vf-quote-text" });
		container.appendText("“");
		if (!word || word.length > 60) {
			container.appendText(quote);
		} else {
			const re = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
			let last = 0;
			for (const m of quote.matchAll(re)) {
				container.appendText(quote.slice(last, m.index));
				container.createSpan({ text: m[0], cls: "vf-quote-hit" });
				last = (m.index ?? 0) + m[0].length;
			}
			container.appendText(quote.slice(last));
		}
		container.appendText("”");
	}

	private renderImage(parent: HTMLElement, card: VocabCard): void {
		if (!card.image) return;
		let src = card.image.trim().replace(/^!?\[\[|\]\]$/g, "");
		if (!/^https?:\/\//.test(src)) {
			const f = this.app.metadataCache.getFirstLinkpathDest(src, card.file.path);
			if (!f) return;
			src = this.app.vault.getResourcePath(f);
		}
		parent.createEl("img", { cls: "vf-image", attr: { src } });
	}

	private flip(): void {
		if (this.section !== "review" || this.flipped) return;
		this.flipped = true;
		if (this.current?.dir === "rev") this.plugin.speak(this.current.card.word);
		this.render();
	}

	private async rate(grade: Grade): Promise<void> {
		const entry = this.current;
		if (!entry || this.rating) return;
		const card = entry.card;
		this.rating = true;
		try {
			const fsrs = entry.dir === "fwd" ? card.fsrs : card.fsrsRev;
			const wasNew = fsrs.state === State.New;
			const next = this.plugin.scheduler.repeat(fsrs, new Date())[grade].card;
			await this.plugin.store.saveFsrs(card, next, entry.dir);
			this.plugin.recordReview(wasNew);
			this.sessionDone++;
			if (next.due.getTime() <= endOfToday().getTime()) {
				this.queue.push(entry);
				this.sessionTotal++;
			}
			// leech: quên quá nhiều lần → gợi ý mẹo nhớ
			if (grade === Rating.Again && next.lapses >= 4 && !card.mnemonic) {
				new Notice(`😤 "${card.word}" đã quên ${next.lapses} lần — bấm 🧠 Tạo mẹo nhớ ở mặt sau thẻ!`, 6000);
			}
		} catch (e) {
			console.error("Vocab Forge: lỗi khi lưu thẻ", e);
			new Notice("Vocab Forge: không lưu được thẻ — xem console");
		} finally {
			this.rating = false;
		}
		this.plugin.refreshStatusBar();
		this.nextCard();
	}

	private renderDone(main: HTMLElement): void {
		const done = main.createDiv({ cls: "vf-done" });
		done.createEl("div", { text: "🎉", cls: "vf-done-emoji" });
		done.createEl("h2", { text: "Xong phiên hôm nay!" });
		done.createEl("div", {
			text: `Bạn đã ôn ${this.sessionDone} lượt. Chuỗi ngày: ${this.computeStreak()} 🔥`,
			cls: "vf-muted",
		});
		const btn = done.createEl("button", { text: "← Về Dashboard", cls: "vf-btn-hero vf-btn-hero-small" });
		btn.onclick = () => { this.section = "dashboard"; this.render(); };
	}

	// ============================================================= PRACTICE

	private renderPracticeHub(main: HTMLElement): void {
		main.createEl("h3", { text: "🎯 Luyện tập" });
		main.createDiv({
			text: "Luyện sâu ngoài giờ ôn — không ảnh hưởng lịch FSRS của thẻ.",
			cls: "vf-muted",
		});

		// chọn deck
		main.createEl("h4", { text: "Chọn bộ thẻ" });
		const deckRow = main.createDiv({ cls: "vf-chip-select" });
		const cats = [...this.groupByCategory(this.plugin.store.getAllCards()).keys()].sort();
		const mkDeckChip = (label: string, value: string | null) => {
			const chip = deckRow.createEl("button", {
				text: value ? `${categoryEmoji(value)} ${label}` : label,
				cls: `vf-select-chip ${this.practiceDeck === value ? "vf-select-chip-on" : ""}`,
			});
			chip.onclick = () => {
				this.practiceDeck = value;
				this.render();
			};
		};
		mkDeckChip("🌐 Tất cả", null);
		for (const c of cats) mkDeckChip(c, c);

		// số câu
		main.createEl("h4", { text: "Số câu mỗi phiên" });
		const sizeRow = main.createDiv({ cls: "vf-chip-select" });
		for (const n of [10, 20]) {
			const chip = sizeRow.createEl("button", {
				text: `${n} câu`,
				cls: `vf-select-chip ${this.practiceSize === n ? "vf-select-chip-on" : ""}`,
			});
			chip.onclick = () => {
				this.practiceSize = n;
				this.render();
			};
		}

		// 4 chế độ
		main.createEl("h4", { text: "Chọn chế độ để bắt đầu" });
		const grid = main.createDiv({ cls: "vf-mode-grid" });
		(Object.keys(MODE_INFO) as PracticeMode[]).forEach((mode, i) => {
			const info = MODE_INFO[mode];
			const tile = grid.createDiv({ cls: `vf-mode-tile vf-mode-${mode}` });
			tile.createDiv({ text: info.icon, cls: "vf-mode-icon" });
			tile.createDiv({ text: info.name, cls: "vf-mode-name" });
			tile.createDiv({ text: info.desc, cls: "vf-mode-desc" });
			tile.onclick = () => this.startPractice(mode);
		});
	}

	private startPractice(mode: PracticeMode): void {
		let cards = this.plugin.store.getAllCards();
		if (this.practiceDeck) cards = cards.filter((c) => c.category === this.practiceDeck);
		const queue = buildPracticeQueue(mode, cards, this.practiceSize);
		if (queue.length < 3) {
			new Notice("Deck này chưa đủ thẻ phù hợp cho chế độ đó (cần ≥ 3)");
			return;
		}
		this.practiceMode = mode;
		this.practiceQueue = queue;
		this.practiceIdx = 0;
		this.practiceScore = 0;
		this.practiceWrong = [];
		this.practicePhase = "question";
		this.section = "practice-run";
		this.render();
	}

	private currentPractice(): PracticeItem | null {
		return this.practiceQueue[this.practiceIdx] ?? null;
	}

	private renderPracticeRun(main: HTMLElement): void {
		const item = this.currentPractice();
		if (!item) {
			this.section = "practice-done";
			this.render();
			return;
		}
		main.addClass("vf-main-review");
		const info = MODE_INFO[item.mode];

		// topbar
		const top = main.createDiv({ cls: "vf-topbar" });
		const backBtn = top.createEl("button", { text: "✕", cls: "vf-btn-icon" });
		backBtn.onclick = () => { this.section = "practice"; this.render(); };
		const mid = top.createDiv({ cls: "vf-topbar-mid" });
		const bar = mid.createDiv({ cls: "vf-progress-bar" });
		bar.createDiv({ cls: "vf-progress-fill" }).style.width =
			`${Math.round((this.practiceIdx / this.practiceQueue.length) * 100)}%`;
		mid.createDiv({
			text: `${info.icon} ${info.name} · ${this.practiceIdx + 1}/${this.practiceQueue.length}`,
			cls: "vf-progress-text",
		});
		top.createSpan({ text: `⭐ ${this.practiceScore}`, cls: "vf-score" });

		const cardEl = main.createDiv({ cls: "vf-card vf-anim-pop vf-practice-card" });
		this.practiceInput = null;

		if (item.mode === "cloze") this.renderClozeQ(cardEl, item);
		else if (item.mode === "typing") this.renderTypingQ(cardEl, item);
		else if (item.mode === "builder") this.renderBuilderQ(cardEl, item);
		else if (item.mode === "match") this.renderMatchQ(cardEl, item);
		else this.renderChoiceQ(cardEl, item);

		// feedback + nút
		if (this.practicePhase === "feedback") {
			const fb = main.createDiv({
				cls: `vf-feedback ${this.practiceCorrect ? "vf-feedback-ok" : "vf-feedback-no"}`,
			});
			fb.createSpan({
				text: this.practiceCorrect ? "🎉 Chính xác!" : `😅 Đáp án: ${this.practiceAnswerText(item)}`,
				cls: "vf-feedback-text",
			});
			const meaning = item.card.meaningVi || item.card.meaningEn;
			if (meaning) fb.createDiv({ text: meaning, cls: "vf-feedback-meaning" });
			const btn = main.createEl("button", { text: "Tiếp tục  ·  Enter", cls: "vf-btn-flip" });
			btn.onclick = () => this.practiceNext();
			window.setTimeout(() => btn.focus(), 30);
		} else if (item.mode === "cloze" || item.mode === "typing") {
			const btn = main.createEl("button", { text: "Kiểm tra  ·  Enter", cls: "vf-btn-flip" });
			btn.onclick = () => this.practiceCheck();
		}
	}

	private practiceAnswerText(item: PracticeItem): string {
		if (item.mode === "cloze") return item.surface;
		if (item.mode === "builder") return item.tokens.join(" ");
		if (item.mode === "choice") return item.options[item.correctIndex];
		return item.card.word;
	}

	// --- nối cặp (match)

	private renderMatchQ(cardEl: HTMLElement, item: MatchItem): void {
		cardEl.addClass("vf-match-card");
		cardEl.createDiv({
			text: `Nối từ với nghĩa — còn ${item.pairs.length - this.matchDone.size} cặp`,
			cls: "vf-hint",
		});
		const board = cardEl.createDiv({ cls: "vf-match-board" });
		const wordCol = board.createDiv({ cls: "vf-match-col" });
		const meanCol = board.createDiv({ cls: "vf-match-col" });

		// thứ tự cố định theo vòng: xáo bằng seed đơn giản từ index để không đổi chỗ mỗi lần render
		const wordOrder = this.stableOrder(item.pairs.length, this.practiceIdx * 7 + 3);
		const meanOrder = this.stableOrder(item.pairs.length, this.practiceIdx * 13 + 5);

		const mkTile = (col: HTMLElement, kind: "w" | "m", pairIdx: number, text: string) => {
			let cls = "vf-match-tile";
			if (this.matchDone.has(pairIdx)) cls += " vf-match-done";
			if (this.matchSel?.kind === kind && this.matchSel.idx === pairIdx) cls += " vf-match-sel";
			if (
				this.matchWrongFlash &&
				((kind === "w" && this.matchWrongFlash.w === pairIdx) ||
					(kind === "m" && this.matchWrongFlash.m === pairIdx))
			)
				cls += " vf-match-wrong";
			const b = col.createEl("button", { text, cls });
			b.onclick = () => this.matchClick(item, kind, pairIdx);
		};
		for (const i of wordOrder) mkTile(wordCol, "w", i, item.pairs[i].word);
		for (const i of meanOrder) mkTile(meanCol, "m", i, item.pairs[i].meaning);
	}

	private stableOrder(n: number, seed: number): number[] {
		const arr = Array.from({ length: n }, (_, i) => i);
		// xáo trộn tất định theo seed (giữ nguyên giữa các lần render trong 1 vòng)
		let s = seed;
		for (let i = n - 1; i > 0; i--) {
			s = (s * 9301 + 49297) % 233280;
			const j = s % (i + 1);
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
		return arr;
	}

	private matchClick(item: MatchItem, kind: "w" | "m", pairIdx: number): void {
		if (this.matchLocked || this.matchDone.has(pairIdx)) return;
		if (!this.matchSel || this.matchSel.kind === kind) {
			this.matchSel = { kind, idx: pairIdx };
			this.render();
			return;
		}
		// đã chọn 1 bên khác loại → kiểm tra cặp
		const w = kind === "w" ? pairIdx : this.matchSel.idx;
		const m = kind === "m" ? pairIdx : this.matchSel.idx;
		this.matchSel = null;
		if (w === m) {
			this.matchDone.add(w);
			this.plugin.speak(item.pairs[w].word);
			if (this.matchDone.size === item.pairs.length) this.finishMatchRound(item);
			this.render();
		} else {
			this.matchMistaken.add(w).add(m);
			this.matchWrongFlash = { w, m };
			this.render();
			window.setTimeout(() => {
				this.matchWrongFlash = null;
				if (this.section === "practice-run") this.render();
			}, 450);
		}
	}

	private finishMatchRound(item: MatchItem): void {
		this.matchLocked = true;
		for (let i = 0; i < item.pairs.length; i++) {
			const correct = !this.matchMistaken.has(i);
			this.plugin.recordPractice(correct);
			if (correct) this.practiceScore++;
			else {
				// câu sai → tạo item trắc nghiệm để luyện lại
				const retry = makeChoice(item.pairs[i].card, this.plugin.store.getAllCards());
				if (retry) this.practiceWrong.push(retry);
			}
		}
		window.setTimeout(() => this.practiceNext(), 700);
	}

	private renderClozeQ(cardEl: HTMLElement, item: PracticeItem & { mode: "cloze" }): void {
		const c = item.card;
		cardEl.createDiv({ text: `${categoryEmoji(c.category)} ${c.category}`, cls: "vf-chip-cat" });
		const q = cardEl.createDiv({ cls: "vf-cloze-quote" });
		q.appendText("“" + item.pre);
		if (this.practicePhase === "feedback") {
			q.createSpan({
				text: item.surface,
				cls: this.practiceCorrect ? "vf-cloze-hit-ok" : "vf-cloze-hit-no",
			});
		} else {
			q.createSpan({ text: "＿".repeat(Math.max(4, Math.min(10, item.surface.length))), cls: "vf-cloze-blank" });
		}
		q.appendText(item.post + "”");
		if (c.meaningVi) cardEl.createDiv({ text: `💡 ${c.meaningVi}`, cls: "vf-hint" });
		if (this.practicePhase === "question") this.makePracticeInput(cardEl, "Gõ từ còn thiếu…");
	}

	private renderTypingQ(cardEl: HTMLElement, item: PracticeItem & { mode: "typing" }): void {
		const c = item.card;
		cardEl.createDiv({ text: `${categoryEmoji(c.category)} ${c.category}`, cls: "vf-chip-cat" });
		if (c.meaningVi) {
			const vi = cardEl.createDiv({ cls: "vf-meaning-vi vf-typing-meaning" });
			vi.createSpan({ text: "VI", cls: "vf-lang-tag vf-lang-vi" });
			vi.createSpan({ text: c.meaningVi });
		}
		if (c.meaningEn) {
			const en = cardEl.createDiv({ cls: "vf-meaning-en" });
			en.createSpan({ text: "EN", cls: "vf-lang-tag" });
			en.createSpan({ text: c.meaningEn });
		}
		const hint = c.word.trim();
		cardEl.createDiv({
			text: `Gợi ý: ${hint.split(/\s+/).length} từ · bắt đầu bằng "${hint[0].toUpperCase()}"`,
			cls: "vf-hint",
		});
		if (this.practicePhase === "question") this.makePracticeInput(cardEl, "Gõ từ tiếng Anh…");
		else {
			cardEl.createDiv({
				text: c.word,
				cls: this.practiceCorrect ? "vf-cloze-hit-ok vf-typing-answer" : "vf-cloze-hit-no vf-typing-answer",
			});
			if (c.ipa) cardEl.createDiv({ text: c.ipa, cls: "vf-ipa" });
		}
	}

	private renderBuilderQ(cardEl: HTMLElement, item: PracticeItem & { mode: "builder" }): void {
		const c = item.card;
		cardEl.createDiv({ text: `${categoryEmoji(c.category)} ${c.category}`, cls: "vf-chip-cat" });
		cardEl.createDiv({ text: "Bấm các từ theo đúng thứ tự:", cls: "vf-hint" });

		// dòng đã xếp
		const built = cardEl.createDiv({ cls: "vf-builder-line" });
		for (let k = 0; k < this.builderPicked.length; k++) {
			const idx = this.builderPicked[k];
			const chip = built.createEl("button", { text: item.shuffled[idx], cls: "vf-token vf-token-placed" });
			chip.onclick = () => {
				if (this.practicePhase !== "question") return;
				this.builderPicked.splice(k, 1);
				this.render();
			};
		}
		if (!this.builderPicked.length) built.createSpan({ text: "…", cls: "vf-muted" });

		// kho chip
		if (this.practicePhase === "question") {
			const bank = cardEl.createDiv({ cls: "vf-builder-bank" });
			item.shuffled.forEach((tok, idx) => {
				if (this.builderPicked.includes(idx)) return;
				const chip = bank.createEl("button", { text: tok, cls: "vf-token" });
				chip.onclick = () => {
					this.builderPicked.push(idx);
					if (this.builderPicked.length === item.shuffled.length) {
						const attempt = this.builderPicked.map((i) => item.shuffled[i]).join(" ");
						this.practiceResolve(attempt === item.tokens.join(" "));
					} else this.render();
				};
			});
		} else {
			cardEl.createDiv({
				text: `“${item.tokens.join(" ")}”`,
				cls: this.practiceCorrect ? "vf-cloze-hit-ok vf-builder-answer" : "vf-cloze-hit-no vf-builder-answer",
			});
		}
		if (c.meaningVi) cardEl.createDiv({ text: `💡 ${c.meaningVi}`, cls: "vf-hint" });
	}

	private renderChoiceQ(cardEl: HTMLElement, item: PracticeItem & { mode: "choice" }): void {
		const c = item.card;
		cardEl.createDiv({ text: `${categoryEmoji(c.category)} ${c.category}`, cls: "vf-chip-cat" });
		cardEl.createDiv({ text: c.word, cls: "vf-word vf-choice-word" });
		if (c.ipa) cardEl.createDiv({ text: c.ipa, cls: "vf-ipa" });
		const opts = cardEl.createDiv({ cls: "vf-choice-opts" });
		item.options.forEach((opt, idx) => {
			let cls = "vf-choice-opt";
			if (this.practicePhase === "feedback") {
				if (idx === item.correctIndex) cls += " vf-choice-right";
				else cls += " vf-choice-dim";
			}
			const b = opts.createEl("button", { cls });
			b.createSpan({ text: `${idx + 1}`, cls: "vf-choice-num" });
			b.createSpan({ text: opt });
			b.onclick = () => {
				if (this.practicePhase !== "question") return;
				this.practiceResolve(idx === item.correctIndex);
			};
		});
	}

	private makePracticeInput(cardEl: HTMLElement, placeholder: string): void {
		const input = cardEl.createEl("input", {
			cls: "vf-practice-input",
			attr: { type: "text", placeholder, spellcheck: "false", autocapitalize: "off" },
		});
		input.onkeydown = (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				this.practiceCheck();
			}
		};
		this.practiceInput = input;
		window.setTimeout(() => input.focus(), 30);
	}

	private practiceCheck(): void {
		const item = this.currentPractice();
		if (!item || this.practicePhase !== "question") return;
		if (item.mode === "cloze") {
			const val = this.practiceInput?.value ?? "";
			this.practiceResolve(fuzzyEqual(val, [item.surface, item.card.word, ...item.card.forms]));
		} else if (item.mode === "typing") {
			const val = this.practiceInput?.value ?? "";
			this.practiceResolve(fuzzyEqual(val, [item.card.word, ...item.card.forms]));
		}
	}

	private practiceResolve(correct: boolean): void {
		const item = this.currentPractice();
		if (!item) return;
		this.practicePhase = "feedback";
		this.practiceCorrect = correct;
		if (correct) this.practiceScore++;
		else this.practiceWrong.push(item);
		this.plugin.recordPractice(correct);
		this.plugin.speak(item.mode === "builder" ? item.tokens.join(" ") : item.card.word);
		this.render();
	}

	private practiceNext(): void {
		this.practiceIdx++;
		this.practicePhase = "question";
		this.builderPicked = [];
		this.matchSel = null;
		this.matchDone = new Set();
		this.matchMistaken = new Set();
		this.matchWrongFlash = null;
		this.matchLocked = false;
		if (this.practiceIdx >= this.practiceQueue.length) this.section = "practice-done";
		this.render();
	}

	private renderPracticeDone(main: HTMLElement): void {
		const total = this.practiceQueue.length;
		const pct = total ? Math.round((this.practiceScore / total) * 100) : 0;
		const done = main.createDiv({ cls: "vf-done" });
		done.createEl("div", { text: pct >= 80 ? "🏆" : pct >= 50 ? "💪" : "🌱", cls: "vf-done-emoji" });
		done.createEl("h2", { text: `${this.practiceScore}/${total} câu đúng` });
		const ring = done.createDiv({ cls: "vf-hero-ring vf-ring-dark" });
		ring.style.setProperty("--vf-pct", String(pct));
		ring.createDiv({ text: `${pct}%`, cls: "vf-hero-ring-text" });

		if (this.practiceWrong.length) {
			done.createEl("h4", { text: "Các câu sai" });
			const list = done.createDiv({ cls: "vf-hard-list vf-wrong-list" });
			for (const w of this.practiceWrong) {
				const row = list.createDiv({ cls: "vf-hard-item" });
				row.createSpan({ text: w.card.word, cls: "vf-hard-word" });
				row.createSpan({ text: w.card.meaningVi || w.card.meaningEn, cls: "vf-hard-count" });
				row.onclick = () => this.app.workspace.openLinkText(w.card.file.path, "", true);
			}
		}
		const btns = done.createDiv({ cls: "vf-actions" });
		if (this.practiceWrong.length) {
			const retry = btns.createEl("button", {
				text: `🔁 Luyện lại ${this.practiceWrong.length} câu sai`,
				cls: "vf-btn-hero vf-btn-hero-small",
			});
			retry.onclick = () => {
				this.practiceQueue = shuffle(this.practiceWrong);
				this.practiceWrong = [];
				this.practiceIdx = 0;
				this.practiceScore = 0;
				this.practicePhase = "question";
				this.builderPicked = [];
				this.section = "practice-run";
				this.render();
			};
		}
		const back = btns.createEl("button", { text: "← Về Luyện tập", cls: "vf-btn-icon" });
		back.onclick = () => { this.section = "practice"; this.render(); };
	}

	// ============================================================= SETTINGS

	private renderSettings(main: HTMLElement): void {
		main.createEl("h3", { text: "⚙️ Cài đặt" });
		const s = this.plugin.settings;

		const group = (label: string, desc: string): HTMLElement => {
			const g = main.createDiv({ cls: "vf-setting" });
			const info = g.createDiv({ cls: "vf-setting-info" });
			info.createDiv({ text: label, cls: "vf-setting-name" });
			info.createDiv({ text: desc, cls: "vf-setting-desc" });
			return g.createDiv({ cls: "vf-setting-control" });
		};

		// thẻ mới / ngày
		const c1 = group("Thẻ mới mỗi ngày", "Giới hạn thẻ mới đưa vào học (kiểu Anki)");
		const v1 = c1.createSpan({ text: String(s.newPerDay), cls: "vf-setting-value" });
		const r1 = c1.createEl("input", { attr: { type: "range", min: "0", max: "50", step: "1", value: String(s.newPerDay) } });
		r1.oninput = () => { v1.setText(r1.value); };
		r1.onchange = async () => { s.newPerDay = Number(r1.value); await this.plugin.saveAll(); this.plugin.refreshStatusBar(); };

		// retention
		const c2 = group("Mức ghi nhớ mục tiêu", "0.90 = cân bằng; cao hơn = ôn dày hơn");
		const v2 = c2.createSpan({ text: s.requestRetention.toFixed(2), cls: "vf-setting-value" });
		const r2 = c2.createEl("input", { attr: { type: "range", min: "0.8", max: "0.97", step: "0.01", value: String(s.requestRetention) } });
		r2.oninput = () => { v2.setText(Number(r2.value).toFixed(2)); };
		r2.onchange = async () => { s.requestRetention = Number(r2.value); this.plugin.rebuildScheduler(); await this.plugin.saveAll(); };

		// tts rate
		const c3 = group("Tốc độ phát âm", "1.0 = tốc độ tự nhiên");
		const v3 = c3.createSpan({ text: s.ttsRate.toFixed(2), cls: "vf-setting-value" });
		const r3 = c3.createEl("input", { attr: { type: "range", min: "0.5", max: "1.5", step: "0.05", value: String(s.ttsRate) } });
		r3.oninput = () => { v3.setText(Number(r3.value).toFixed(2)); };
		r3.onchange = async () => { s.ttsRate = Number(r3.value); await this.plugin.saveAll(); };

		// voice
		const c4 = group("Giọng đọc", "Giọng tiếng Anh của hệ thống");
		const sel = c4.createEl("select", { cls: "dropdown" });
		sel.createEl("option", { text: "— Tự động (en) —", attr: { value: "" } });
		for (const v of window.speechSynthesis.getVoices()) {
			if (!v.lang.startsWith("en")) continue;
			const opt = sel.createEl("option", { text: `${v.name} (${v.lang})`, attr: { value: v.name } });
			if (v.name === s.ttsVoice) opt.selected = true;
		}
		sel.onchange = async () => { s.ttsVoice = sel.value; await this.plugin.saveAll(); };
		const test = c4.createEl("button", { text: "🔊 Thử", cls: "vf-btn-icon" });
		test.onclick = () => this.plugin.speak("The quick brown fox jumps over the lazy dog.");

		// folder
		const c5 = group("Folder chứa thẻ", "Mỗi thẻ là một file .md trong folder này");
		const inp = c5.createEl("input", { attr: { type: "text", value: s.cardsFolder }, cls: "vf-input" });
		inp.onchange = async () => { s.cardsFolder = inp.value.trim() || "5. Toolbox/English/Cards"; await this.plugin.saveAll(); };

		// highlight
		const c6 = group("Highlight từ đã học", "Gạch chân từ đang học trong reading mode toàn vault");
		const chk = c6.createEl("input", { attr: { type: "checkbox" } });
		chk.checked = s.highlightEnabled;
		chk.onchange = async () => { s.highlightEnabled = chk.checked; this.plugin.invalidateKnownWords(); await this.plugin.saveAll(); };

		// chiều ngược
		const c6b = group(
			"Học chiều ngược (VI → EN)",
			"Thẻ đã thuộc chiều xuôi sẽ vào học chiều ngược — nhìn nghĩa nhớ ra từ"
		);
		const chkRev = c6b.createEl("input", { attr: { type: "checkbox" } });
		chkRev.checked = s.reverseEnabled;
		chkRev.onchange = async () => {
			s.reverseEnabled = chkRev.checked;
			await this.plugin.saveAll();
			this.plugin.refreshStatusBar();
		};

		// mục tiêu ngày
		main.createEl("h4", { text: "Nhiệm vụ hằng ngày" });
		const goals: Array<[string, "dailyReviewGoal" | "dailyNewGoal" | "dailyPracticeGoal", number, number]> = [
			["Mục tiêu lượt ôn", "dailyReviewGoal", 0, 100],
			["Mục tiêu thẻ mới", "dailyNewGoal", 0, 30],
			["Mục tiêu câu luyện tập", "dailyPracticeGoal", 0, 50],
		];
		for (const [label, key, min, max] of goals) {
			const cg = group(label, "0 = tắt nhiệm vụ này");
			const vg = cg.createSpan({ text: String(s[key]), cls: "vf-setting-value" });
			const rg = cg.createEl("input", {
				attr: { type: "range", min: String(min), max: String(max), step: "1", value: String(s[key]) },
			});
			rg.oninput = () => vg.setText(rg.value);
			rg.onchange = async () => { s[key] = Number(rg.value); await this.plugin.saveAll(); };
		}

		// grok path
		main.createEl("h4", { text: "AI (Grok CLI)" });
		const c7 = group("Đường dẫn lệnh grok", "Dùng cho mẹo nhớ, chấm câu, giải thích ngữ pháp, story");
		const gp = c7.createEl("input", { attr: { type: "text", value: s.grokPath }, cls: "vf-input" });
		gp.onchange = async () => { s.grokPath = gp.value.trim() || "grok"; await this.plugin.saveAll(); };
	}

	// ================================================================ MISC

	private computeStreak(): number {
		const stats = this.plugin.data.stats;
		const active = (k: string) => (stats[k]?.reviews ?? 0) > 0 || this.plugin.isFrozen(k);
		let streak = 0;
		const d = new Date();
		if (!active(todayKey(d))) d.setDate(d.getDate() - 1);
		while (active(todayKey(d))) {
			streak++;
			d.setDate(d.getDate() - 1);
		}
		return streak;
	}

	/** Biểu đồ cột: số thẻ đến hạn trong 30 ngày tới (quá hạn dồn vào hôm nay) */
	private renderForecast(el: HTMLElement, all: VocabCard[]): void {
		const DAYS = 30;
		const counts = new Array<number>(DAYS).fill(0);
		const startToday = new Date();
		startToday.setHours(0, 0, 0, 0);
		for (const c of all) {
			if (c.fsrs.state === State.New) continue;
			const due = new Date(c.fsrs.due);
			due.setHours(0, 0, 0, 0);
			const idx = Math.round((due.getTime() - startToday.getTime()) / 86_400_000);
			if (idx < 0) counts[0]++;
			else if (idx < DAYS) counts[idx]++;
		}
		const max = Math.max(1, ...counts);
		for (let i = 0; i < DAYS; i++) {
			const col = el.createDiv({ cls: "vf-fc-col" });
			const bar = col.createDiv({ cls: `vf-fc-bar ${i === 0 ? "vf-fc-today" : ""}` });
			bar.style.height = `${Math.max(3, Math.round((counts[i] / max) * 60))}px`;
			bar.setAttr("aria-label", `+${i} ngày: ${counts[i]} thẻ`);
			if (i % 5 === 0) col.createDiv({ text: i === 0 ? "nay" : `+${i}`, cls: "vf-fc-label" });
		}
	}

	// ================================================================ STORY

	private renderStory(main: HTMLElement): void {
		const head = main.createDiv({ cls: "vf-deck-head" });
		const backBtn = head.createEl("button", { text: "←", cls: "vf-btn-icon" });
		backBtn.onclick = () => { this.section = "dashboard"; this.render(); };
		head.createEl("h3", { text: "📖 Story hôm nay" });

		main.createDiv({
			text: "AI dệt các từ sắp ôn thành một câu chuyện ngắn — đọc trước khi ôn để gặp từ trong ngữ cảnh mới.",
			cls: "vf-muted",
		});

		const story = this.plugin.data.story;
		const fresh = story && story.date === todayKey();

		if (this.storyBusy) {
			const wait = main.createDiv({ cls: "vf-story-wait" });
			wait.createDiv({ text: "⏳", cls: "vf-done-emoji" });
			wait.createDiv({ text: "Grok đang viết story từ các thẻ của bạn… (~30–60s)", cls: "vf-muted" });
			return;
		}

		if (fresh && story) {
			const box = main.createDiv({ cls: "vf-story-box" });
			const en = box.createDiv({ cls: "vf-story-en" });
			this.renderBoldText(en, story.en);
			const speakBtn = box.createEl("button", { text: "🔊 Nghe story", cls: "vf-btn-icon" });
			speakBtn.onclick = () => this.plugin.speak(story.en.replace(/\*\*/g, ""));
			const viBox = box.createEl("details", { cls: "vf-story-vi" });
			viBox.createEl("summary", { text: "🇻🇳 Xem bản dịch tiếng Việt" });
			viBox.createDiv({ text: story.vi });
			const chips = main.createDiv({ cls: "vf-chips vf-story-words" });
			for (const w of story.words) chips.createSpan({ text: w, cls: "vf-chip" });

			const btns = main.createDiv({ cls: "vf-actions" });
			const go = btns.createEl("button", { text: "▶  Vào ôn tập", cls: "vf-btn-hero vf-btn-hero-small" });
			go.onclick = () => this.startSession(null);
			const redo = btns.createEl("button", { text: "🔄 Story mới", cls: "vf-btn-icon" });
			redo.onclick = () => void this.generateStory();
			return;
		}

		const empty = main.createDiv({ cls: "vf-story-wait" });
		empty.createDiv({ text: "📖", cls: "vf-done-emoji" });
		const gen = empty.createEl("button", {
			text: "✨ Tạo story từ thẻ hôm nay",
			cls: "vf-btn-hero vf-btn-hero-small",
		});
		gen.onclick = () => void this.generateStory();
	}

	private renderBoldText(el: HTMLElement, text: string): void {
		const parts = text.split("**");
		parts.forEach((p, i) => {
			if (i % 2 === 1) el.createEl("strong", { text: p, cls: "vf-story-hit" });
			else el.appendText(p);
		});
	}

	private async generateStory(): Promise<void> {
		const due = this.plugin.store.getDueCards();
		const news = this.plugin.store.getNewCards().slice(0, this.plugin.newRemainingToday());
		let pool = [...due, ...news].filter((c) => c.type !== "sentence" && c.type !== "passage" && c.type !== "grammar");
		if (pool.length < 3)
			pool = this.plugin.store.getAllCards().filter((c) => c.type !== "sentence" && c.type !== "passage" && c.type !== "grammar");
		if (pool.length < 3) {
			new Notice("Chưa đủ thẻ để tạo story");
			return;
		}
		const picked = sample(pool, 7);
		const words = picked.map((c) => c.word);
		const cats = [...new Set(picked.map((c) => c.category))];
		this.storyBusy = true;
		this.render();
		try {
			const raw = await runGrok(storyPrompt(words, cats), this.plugin.settings.grokPath, 150_000);
			const sep = raw.indexOf("---");
			const en = (sep === -1 ? raw : raw.slice(0, sep)).trim();
			const vi = sep === -1 ? "" : raw.slice(sep + 3).trim();
			if (!en) throw new Error("empty story");
			this.plugin.data.story = { date: todayKey(), words, en, vi };
			await this.plugin.saveAll();
		} catch (e) {
			console.error("Vocab Forge story:", e);
			new Notice("Không tạo được story — kiểm tra Grok CLI");
		} finally {
			this.storyBusy = false;
			this.render();
		}
	}

	private renderHeatmap(el: HTMLElement): void {
		const stats = this.plugin.data.stats;
		const days = 17 * 7;
		const start = new Date();
		start.setDate(start.getDate() - (days - 1));
		for (let w = 0; w < 17; w++) {
			const col = el.createDiv({ cls: "vf-heat-col" });
			for (let d = 0; d < 7; d++) {
				const date = new Date(start);
				date.setDate(start.getDate() + w * 7 + d);
				if (date > new Date()) break;
				const count = stats[todayKey(date)]?.reviews ?? 0;
				const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 10 ? 3 : 4;
				const cell = col.createDiv({ cls: `vf-heat-cell vf-heat-${level}` });
				cell.setAttr("aria-label", `${todayKey(date)}: ${count} lượt ôn`);
			}
		}
	}

	private onKey(evt: KeyboardEvent): void {
		if (this.app.workspace.getActiveViewOfType(VocabReviewView) !== this) return;
		const target = evt.target as HTMLElement;
		if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
		// --- phím tắt trong luyện tập
		if (this.section === "practice-run") {
			const item = this.currentPractice();
			if (evt.key === "Enter") {
				evt.preventDefault();
				if (this.practicePhase === "feedback") this.practiceNext();
				else this.practiceCheck();
				return;
			}
			if (
				this.practicePhase === "question" &&
				item?.mode === "choice" &&
				["1", "2", "3", "4"].includes(evt.key)
			) {
				evt.preventDefault();
				const idx = Number(evt.key) - 1;
				this.practiceResolve(idx === item.correctIndex);
			}
			return;
		}
		if (this.section !== "review") return;
		if (evt.key === " " || evt.key === "Enter") {
			evt.preventDefault();
			if (!this.flipped) this.flip();
			return;
		}
		if (this.flipped && ["1", "2", "3", "4"].includes(evt.key)) {
			evt.preventDefault();
			const map: Record<string, Grade> = {
				"1": Rating.Again,
				"2": Rating.Hard,
				"3": Rating.Good,
				"4": Rating.Easy,
			};
			void this.rate(map[evt.key]);
			return;
		}
		if (evt.key.toLowerCase() === "s" && this.current) {
			this.plugin.speak(this.current.card.word);
		}
	}
}
