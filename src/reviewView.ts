import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type VocabForgePlugin from "./main";
import { formatInterval, Rating, State, type Grade } from "./srs";
import { categoryEmoji, endOfToday, todayKey, type VocabCard } from "./types";

export const VIEW_TYPE_VOCAB = "vocab-forge-review";

type Section = "dashboard" | "decks" | "deck-detail" | "review" | "done" | "settings";

const TYPE_LABELS: Record<string, string> = {
	word: "Từ",
	phrase: "Cụm từ",
	idiom: "Thành ngữ",
	collocation: "Collocation",
	sentence: "Câu",
	passage: "Đoạn",
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

	private queue: VocabCard[] = [];
	private current: VocabCard | null = null;
	private flipped = false;
	private sessionDone = 0;
	private sessionTotal = 0;
	private sessionCategory: string | null = null;
	private rating = false;

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
			{ id: "decks", icon: "🗂️", label: "Bộ thẻ" },
			{ id: "add", icon: "➕", label: "Thêm thẻ" },
			{ id: "settings", icon: "⚙️", label: "Cài đặt" },
		];
		for (const it of items) {
			const active =
				it.id === this.section ||
				(it.id === "study" && (this.section === "review" || this.section === "done")) ||
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
		foot.createDiv({ text: `🔥 ${this.computeStreak()} ngày`, cls: "vf-nav-streak" });
	}

	// ============================================================ DASHBOARD

	private renderDashboard(main: HTMLElement): void {
		const due = this.plugin.store.getDueCards();
		const news = this.plugin.store.getNewCards();
		const newAvailable = Math.min(news.length, this.plugin.newRemainingToday());
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
		const startBtn = heroLeft.createEl("button", {
			text: total > 0 ? `▶  Học ngay · ${total} thẻ` : "✓ Đã xong hôm nay",
			cls: "vf-btn-hero",
		});
		startBtn.disabled = total === 0;
		startBtn.onclick = () => this.startSession(null);
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

		// --- Heatmap
		main.createEl("h4", { text: "Hoạt động 17 tuần" });
		this.renderHeatmap(main.createDiv({ cls: "vf-heatmap" }));

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
		let due = this.plugin.store.getDueCards();
		let news = this.plugin.store.getNewCards();
		if (category) {
			due = due.filter((c) => c.category === category);
			news = news.filter((c) => c.category === category);
		}
		news = news.slice(0, this.plugin.newRemainingToday());
		this.queue = [...due, ...news];
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
		let idx = this.queue.findIndex(
			(c) => c.fsrs.state === State.New || c.fsrs.due.getTime() <= now
		);
		if (idx === -1) idx = 0;
		this.current = this.queue.splice(idx, 1)[0];
		this.flipped = false;
		this.render();
	}

	private renderCard(main: HTMLElement): void {
		const card = this.current;
		if (!card) {
			this.section = "dashboard";
			this.render();
			return;
		}
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
		if (card.fsrs.state === State.New) badgeRow.createSpan({ text: "✨ mới", cls: "vf-chip-new" });
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

		if (!this.flipped) {
			const flipBtn = main.createEl("button", {
				text: "Lật thẻ 👆  ·  Space",
				cls: "vf-btn-flip",
			});
			flipBtn.onclick = () => this.flip();
			cardEl.onclick = () => this.flip();
			this.plugin.speak(card.word);
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

		// --- rating
		const now = new Date();
		const preview = this.plugin.scheduler.repeat(card.fsrs, now);
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
		this.render();
	}

	private async rate(grade: Grade): Promise<void> {
		const card = this.current;
		if (!card || this.rating) return;
		this.rating = true;
		try {
			const wasNew = card.fsrs.state === State.New;
			const next = this.plugin.scheduler.repeat(card.fsrs, new Date())[grade].card;
			await this.plugin.store.saveFsrs(card, next);
			this.plugin.recordReview(wasNew);
			this.sessionDone++;
			if (next.due.getTime() <= endOfToday().getTime()) {
				this.queue.push(card);
				this.sessionTotal++;
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
	}

	// ================================================================ MISC

	private computeStreak(): number {
		const stats = this.plugin.data.stats;
		let streak = 0;
		const d = new Date();
		if (!stats[todayKey(d)]?.reviews) d.setDate(d.getDate() - 1);
		while ((stats[todayKey(d)]?.reviews ?? 0) > 0) {
			streak++;
			d.setDate(d.getDate() - 1);
		}
		return streak;
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
		if (this.section !== "review") return;
		if (this.app.workspace.getActiveViewOfType(VocabReviewView) !== this) return;
		const target = evt.target as HTMLElement;
		if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
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
			this.plugin.speak(this.current.word);
		}
	}
}
