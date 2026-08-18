import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type VocabForgePlugin from "./main";
import { AboutModal } from "./aboutModal";
import { ImageModal } from "./imageModal";
import { renderMarkdown, renderInlineMarkdown } from "./markdown";
import { formatInterval, Rating, State, type Grade } from "./srs";
import {
	categoryEmoji,
	endOfToday,
	todayKey,
	type ReviewEntry,
	type VocabCard,
} from "./types";
import {
	buildMixedQueue,
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
	chatFeedbackPrompt,
	chatStartPrompt,
	extractJson,
	grammarPrompt,
	mnemonicPrompt,
	sentenceCheckPrompt,
	storyPrompt,
	type SentenceCheck,
} from "./ai";
import { XP_PER_LEVEL } from "./types";
import { BADGES } from "./badges";
import type { ErrorItem } from "./practice";
import {
	analyzeVideoComprehension,
	appendErrorNotebookEntry,
	recommendDailySession,
	type VideoComprehensionResult,
} from "./learning";
import {
	AudioRecorder,
	SpeechRecognitionController,
	diffTranscripts,
	isAudioRecordingSupported,
	isSpeechRecognitionSupported,
	scoreShadowing,
	type ShadowingScore,
	type TranscriptDiff,
} from "./speech";

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
	| "chat"
	| "lab"
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
	private justFlipped = false;
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

	// --- hội thoại roleplay
	private chatMsgs: Array<{ role: "ai" | "me" | "feedback"; text: string }> = [];
	private chatWords: string[] = [];
	private chatSession = "";
	private chatBusy = false;
	private chatInput = "";
	private chatListening = false;

	// --- fluency lab: dictation, shadowing, video coverage
	private labMode: "dictation" | "shadowing" | "coverage" = "dictation";
	private labIndex = 0;
	private labAnswer = "";
	private labReveal = false;
	private labDiff: TranscriptDiff | null = null;
	private labSpoken = "";
	private labShadowScore: ShadowingScore | null = null;
	private labRecording = false;
	private labStarting = false;
	private labAudioUrl = "";
	private labConfidence = 0;
	private coverageText = "";
	private coverageResult: VideoComprehensionResult | null = null;
	private readonly audioRecorder = new AudioRecorder();
	private readonly speechRecognition = new SpeechRecognitionController();

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

	async onClose(): Promise<void> {
		this.speechRecognition.abort();
		this.audioRecorder.cancel();
		if (this.labAudioUrl) URL.revokeObjectURL(this.labAudioUrl);
	}

	renderHome(): void {
		this.leaveInteractiveSection("dashboard");
		this.section = "dashboard";
		this.render();
	}

	resetAiConversation(): void {
		this.speechRecognition.abort();
		this.chatListening = false;
		this.chatBusy = false;
		this.chatSession = "";
		this.chatMsgs = [];
		this.chatInput = "";
		if (this.section === "chat") this.render();
	}

	private leaveInteractiveSection(next: Section): void {
		if (this.section === "lab" && next !== "lab") this.resetLabAttempt();
		if (this.section === "chat" && next !== "chat") {
			this.speechRecognition.abort();
			this.chatListening = false;
		}
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
			case "chat": this.renderChat(main); break;
			case "lab": this.renderLab(main); break;
			case "settings": this.renderSettings(main); break;
		}
	}

	private renderNav(app: HTMLElement): void {
		const nav = app.createDiv({ cls: "vf-nav" });
		const brand = nav.createDiv({ cls: "vf-brand" });
		const brandLeft = brand.createDiv({ cls: "vf-brand-left" });
		brandLeft.createSpan({ text: "🎓", cls: "vf-brand-icon" });
		brandLeft.createSpan({ text: "Vocab Forge", cls: "vf-brand-name" });
		const infoBtn = brand.createEl("button", {
			text: "ℹ️",
			cls: "vf-brand-info-btn",
			attr: { "aria-label": "Thông tin tác giả", title: "Thông tin tác giả Tony Hoang" },
		});
		infoBtn.onclick = (e) => {
			e.stopPropagation();
			new AboutModal(this.app, this.plugin).open();
		};

		const items: Array<{ id: Section | "study" | "add" | "capture" | "about"; icon: string; label: string }> = [
			{ id: "dashboard", icon: "🏠", label: "Dashboard" },
			{ id: "study", icon: "▶️", label: "Học ngay" },
			{ id: "practice", icon: "🎯", label: "Luyện tập" },
			{ id: "lab", icon: "🎙️", label: "Fluency Lab" },
			{ id: "chat", icon: "💬", label: "Hội thoại" },
			{ id: "capture", icon: "✨", label: "Smart Capture" },
			{ id: "decks", icon: "🗂️", label: "Bộ thẻ" },
			{ id: "add", icon: "➕", label: "Thêm thẻ" },
			{ id: "settings", icon: "⚙️", label: "Cài đặt" },
			{ id: "about", icon: "ℹ️", label: "Thông tin" },
		];
		for (const it of items) {
			const active =
				it.id === this.section ||
				(it.id === "study" && (this.section === "review" || this.section === "done")) ||
				(it.id === "practice" && (this.section === "practice-run" || this.section === "practice-done")) ||
				(it.id === "decks" && this.section === "deck-detail");
			const el = nav.createDiv({ cls: `vf-nav-item ${active ? "vf-nav-active" : ""}` });
			el.setAttr("role", "button");
			el.setAttr("tabindex", "0");
			el.setAttr("aria-label", it.label);
			if (active) el.setAttr("aria-current", "page");
			el.setAttr("title", it.label);
			el.createSpan({ text: it.icon, cls: "vf-nav-icon" });
			el.createSpan({ text: it.label, cls: "vf-nav-label" });
			el.onclick = () => {
				if (it.id === "study") {
					this.leaveInteractiveSection("review");
					this.startSession(null);
				}
				else if (it.id === "add") this.plugin.openAddCardModal();
				else if (it.id === "capture") this.plugin.openSmartCapture();
				else if (it.id === "about") new AboutModal(this.app, this.plugin).open();
				else {
					this.leaveInteractiveSection(it.id);
					this.section = it.id;
					this.render();
				}
			};
			el.onkeydown = (event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					el.click();
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
		const captureBtn = heroBtns.createEl("button", { text: "✨ Lấy từ video", cls: "vf-btn-hero-ghost" });
		captureBtn.onclick = () => this.plugin.openSmartCapture();
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

		this.renderAdaptiveCoach(main, all);

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

		// --- Retention 30 ngày
		this.renderRetention(main);

		// --- Huy hiệu
		this.renderBadges(main);

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

	private renderAdaptiveCoach(main: HTMLElement, cards: VocabCard[]): void {
		const skillPerformance = {
			recall: this.performanceFor("memory"),
			listening: this.performanceFor("listening"),
			shadowing: this.performanceFor("speaking"),
			grammar: this.performanceFor("writing"),
		};
		const plan = recommendDailySession({
			cards,
			history: this.plugin.data.stats,
			skillPerformance,
			minutes: this.plugin.settings.dailyMinutes,
			newCardLimit: this.plugin.newRemainingToday(),
			reverseEnabled: this.plugin.settings.reverseEnabled,
		});
		const grid = main.createDiv({ cls: "vf-coach-grid" });
		const coach = grid.createDiv({ cls: "vf-coach-card" });
		coach.createDiv({ text: "Adaptive Today Coach", cls: "vf-eyebrow" });
		coach.createDiv({ text: `Lộ trình ${Math.max(1, Math.round(plan.totalMinutes))} phút dành riêng cho bạn`, cls: "vf-coach-title" });
		coach.createDiv({ text: plan.weakReason, cls: "vf-muted" });
		const chips = coach.createDiv({ cls: "vf-coach-plan" });
		for (const block of plan.blocks.slice(0, 5)) {
			chips.createSpan({ text: `${this.skillIcon(block.skill)} ${block.count} ${this.skillName(block.skill)}`, cls: "vf-plan-chip" });
		}
		const start = coach.createEl("button", { text: "Bắt đầu bước ưu tiên →", cls: "vf-btn-hero vf-btn-hero-small" });
		start.onclick = () => {
			if ((plan.weakSkill === "listening" || plan.weakSkill === "shadowing") && cards.some((c) => c.quote)) {
				this.labMode = plan.weakSkill === "shadowing" ? "shadowing" : "dictation";
				this.section = "lab";
				this.render();
			} else if (plan.dueCount > 0) this.startSession(null);
			else this.startPractice("mix");
		};

		const goal = grid.createDiv({ cls: "vf-goal-card" });
		goal.createDiv({ text: "Lộ trình hiện tại", cls: "vf-eyebrow" });
		goal.createDiv({ text: this.goalLabel(), cls: "vf-goal-name" });
		goal.createDiv({ text: this.goalStep(cards), cls: "vf-goal-step" });
		for (const [skill, label] of [["memory", "Ghi nhớ"], ["listening", "Nghe"], ["speaking", "Nói"], ["writing", "Viết"]] as const) {
			const stat = this.plugin.data.skillStats[skill];
			const avg = stat.attempts ? Math.round(stat.recentScore ?? stat.totalScore / stat.attempts) : 0;
			const row = goal.createDiv({ cls: "vf-skill-row" });
			row.createSpan({ text: label });
			const track = row.createDiv({ cls: "vf-skill-track" });
			track.createDiv({ cls: "vf-skill-fill" }).style.width = `${avg}%`;
			row.createSpan({ text: stat.attempts ? String(avg) : "—" });
		}
	}

	private performanceFor(skill: "memory" | "listening" | "speaking" | "writing") {
		const stat = this.plugin.data.skillStats[skill];
		return {
			attempts: stat.attempts,
			correct: stat.totalScore / 100,
			recentAccuracy: stat.attempts ? (stat.recentScore ?? stat.totalScore / stat.attempts) / 100 : undefined,
			lastPracticed: stat.lastAt || undefined,
		};
	}

	private goalLabel(): string {
		return ({
			business: "💼 Business English",
			daily: "💬 Giao tiếp hằng ngày",
			ielts: "🎓 IELTS",
			content: "📱 Content Creator",
			"ai-tech": "🤖 AI & Technology",
			cambridge: "📚 Cambridge / CEFR",
		})[this.plugin.settings.learningGoal];
	}

	private goalStep(cards: VocabCard[]): string {
		const goal = this.plugin.settings.learningGoal;
		const relevant = cards.filter((c) => c.category === goal || (goal === "cambridge" && c.category.startsWith("cambridge")));
		const learned = relevant.filter((c) => c.fsrs.state !== State.New).length;
		return relevant.length
			? `Đã mở khóa ${learned}/${relevant.length} thẻ phù hợp. Bước tiếp theo: đưa từ đã nhớ vào nghe và nói.`
			: "Bắt đầu bằng Smart Capture để tạo bộ từ đúng với mục tiêu của bạn.";
	}

	private skillName(skill: string): string {
		return ({ review: "ôn", recall: "recall", recognition: "từ mới", cloze: "cloze", listening: "nghe", shadowing: "shadow", grammar: "grammar" } as Record<string, string>)[skill] ?? skill;
	}

	private skillIcon(skill: string): string {
		return ({ review: "🧠", recall: "⌨️", recognition: "✨", cloze: "🧩", listening: "🎧", shadowing: "🎙️", grammar: "✍️" } as Record<string, string>)[skill] ?? "•";
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
			const mnBody = mn.createDiv({ cls: "vf-ai-note-body" });
			renderMarkdown(mnBody, card.mnemonic);
		}
		if (card.grammarNote) {
			const gr = box.createDiv({ cls: "vf-ai-note vf-ai-grammar" });
			gr.createSpan({ text: "📖 ", cls: "vf-ai-note-icon" });
			const grBody = gr.createDiv({ cls: "vf-ai-note-body" });
			renderMarkdown(grBody, card.grammarNote);
		}
		if (card.myExample) {
			const ex = box.createDiv({ cls: "vf-ai-note vf-ai-example" });
			ex.createSpan({ text: "✍️ ", cls: "vf-ai-note-icon" });
			const exBody = ex.createDiv({ cls: "vf-ai-note-body" });
			renderMarkdown(exBody, card.myExample);
		}

		const btnRow = box.createDiv({ cls: "vf-ai-btn-row" });
		const mnBtn = btnRow.createEl("button", {
			text: card.mnemonic ? "🧠 Mẹo nhớ mới" : "🧠 Tạo mẹo nhớ",
			cls: "vf-btn-icon vf-btn-ai",
		});
		mnBtn.onclick = () =>
			void this.aiAction(mnBtn, async () => {
				const out = await this.plugin.runAI(
					mnemonicPrompt(card.word, card.meaningVi || card.meaningEn),
					120_000
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
					const out = await this.plugin.runAI(grammarPrompt(card.quote));
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
				const raw = await this.plugin.runAI(
					sentenceCheckPrompt(card.word, card.meaningEn, this.aiSentence.trim()),
					120_000
				);
				this.aiResult = extractJson<SentenceCheck>(raw);
				if (!this.aiResult) new Notice("AI trả lời không đúng định dạng — thử lại");
				else {
					this.plugin.recordSkill("writing", this.aiResult.score * 10);
					if (this.aiResult.corrected.trim() && this.aiResult.corrected.trim() !== this.aiSentence.trim()) {
						try {
							await appendErrorNotebookEntry(this.app, {
								category: "grammar",
								original: this.aiSentence.trim(),
								corrected: this.aiResult.corrected.trim(),
								explanation: this.aiResult.explain_vi,
								source: card.file.path,
								targetWords: [card.word],
							}, { path: this.plugin.settings.errorNotebookPath });
						} catch (error) {
							console.warn("Vocab Forge: không lưu được Sổ lỗi", error);
							new Notice("Đã chấm câu nhưng chưa lưu được vào Sổ lỗi");
						}
					}
				}
			});

		if (this.aiResult) {
			const r = this.aiResult;
			const res = box.createDiv({
				cls: `vf-feedback ${r.score >= 7 ? "vf-feedback-ok" : "vf-feedback-no"} vf-ai-result`,
			});
			const resText = res.createDiv({ cls: "vf-feedback-text" });
			resText.createSpan({ text: `${r.score >= 7 ? "👍" : "🛠"} ${r.score}/10 — ` });
			renderInlineMarkdown(resText, r.explain_vi);
			if (r.corrected && r.corrected.trim() && r.corrected.trim() !== this.aiSentence.trim()) {
				const cor = res.createDiv({ cls: "vf-feedback-meaning" });
				cor.createSpan({ text: "→ " });
				renderInlineMarkdown(cor, r.corrected);
			}
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
			new Notice("Lỗi gọi AI CLI — kiểm tra provider và trạng thái đăng nhập trong Cài đặt");
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
		const cardEl = main.createDiv({ cls: `vf-card ${this.justFlipped ? "vf-flip-in" : "vf-anim-pop"}` });
		this.justFlipped = false;
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
		const box = parent.createDiv({ cls: "vf-image-box" });
		box.createEl("img", {
			cls: "vf-image",
			attr: { src, alt: card.word, title: "🔍 Bấm để xem ảnh phóng to" },
		});
		box.createSpan({ text: "🔍 Phóng to", cls: "vf-image-zoom-badge" });
		box.onclick = (e) => {
			e.stopPropagation();
			new ImageModal(this.app, src, card.word).open();
		};
	}

	private flip(): void {
		if (this.section !== "review" || this.flipped) return;
		const doFlip = () => {
			this.flipped = true;
			this.justFlipped = true;
			if (this.current?.dir === "rev") this.plugin.speak(this.current.card.word);
			this.render();
		};
		const cardEl = this.contentEl.querySelector(".vf-card") as HTMLElement | null;
		if (cardEl) {
			cardEl.addClass("vf-flip-out");
			window.setTimeout(doFlip, 150);
		} else {
			doFlip();
		}
	}

	private async rate(grade: Grade): Promise<void> {
		const entry = this.current;
		if (!entry || this.rating) return;
		const card = entry.card;
		this.rating = true;
		try {
			const fsrs = entry.dir === "fwd" ? card.fsrs : card.fsrsRev;
			const wasNew = fsrs.state === State.New;
			const retention =
				fsrs.state === State.Review || fsrs.state === State.Relearning
					? grade !== Rating.Again
					: null;
			const next = this.plugin.scheduler.repeat(fsrs, new Date())[grade].card;
			await this.plugin.store.saveFsrs(card, next, entry.dir);
			this.plugin.recordReview(wasNew, retention);
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

		// Các chế độ
		main.createEl("h4", { text: "Chọn chế độ để bắt đầu" });
		const grid = main.createDiv({ cls: "vf-mode-grid" });
		(Object.keys(MODE_INFO) as PracticeMode[]).forEach((mode, i) => {
			const info = MODE_INFO[mode];
			const tile = grid.createDiv({ cls: `vf-mode-tile vf-mode-${mode}` });
			if (mode === "mix") tile.createDiv({ text: "⭐ Đề xuất", cls: "vf-mode-badge" });
			tile.createDiv({ text: info.icon, cls: "vf-mode-icon" });
			tile.createDiv({ text: info.name, cls: "vf-mode-name" });
			tile.createDiv({ text: info.desc, cls: "vf-mode-desc" });
			tile.onclick = () => this.startPractice(mode);
		});
	}

	private startPractice(mode: PracticeMode): void {
		let cards = this.plugin.store.getAllCards();
		if (this.practiceDeck) cards = cards.filter((c) => c.category === this.practiceDeck);
		const queue =
			mode === "mix"
				? buildMixedQueue(cards, this.practiceSize)
				: buildPracticeQueue(mode, cards, this.practiceSize);
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
		else if (item.mode === "error") this.renderErrorQ(cardEl, item);
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
		if (item.mode === "error")
			return `từ sai là "${item.tokens[item.wrongIndex]}" → đúng: "${item.correctToken}"`;
		return item.card.word;
	}

	// --- tìm lỗi sai (error spotting)

	private renderErrorQ(cardEl: HTMLElement, item: ErrorItem): void {
		const c = item.card;
		cardEl.addClass("vf-practice-card");
		cardEl.createDiv({ text: `${categoryEmoji(c.category)} ${c.category}`, cls: "vf-chip-cat" });
		cardEl.createDiv({ text: "🕵️ Câu dưới đây có ĐÚNG 1 từ sai — bấm vào nó:", cls: "vf-hint" });
		const line = cardEl.createDiv({ cls: "vf-error-line" });
		item.tokens.forEach((tok, i) => {
			let cls = "vf-token vf-error-token";
			if (this.practicePhase === "feedback" && i === item.wrongIndex)
				cls += this.practiceCorrect ? " vf-error-found" : " vf-error-reveal";
			const b = line.createEl("button", { text: tok, cls });
			b.onclick = () => {
				if (this.practicePhase !== "question") return;
				this.practiceResolve(i === item.wrongIndex);
			};
		});
		if (this.practicePhase === "feedback") {
			const fixed = [...item.tokens];
			fixed[item.wrongIndex] = item.correctToken;
			const ok = cardEl.createDiv({ cls: "vf-quote" });
			ok.createSpan({ text: "✓ Câu đúng: ", cls: "vf-lang-tag" });
			ok.createSpan({ text: `“${fixed.join(" ")}”` });
		}
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
			b.createSpan({ text: opt, cls: "vf-choice-text" });
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

		// giờ nhắc học
		const cr = group("Giờ nhắc học hằng ngày", "Thông báo khi còn thẻ due — hệ thống + trong Obsidian");
		const sel2 = cr.createEl("select", { cls: "dropdown" });
		sel2.createEl("option", { text: "Tắt", attr: { value: "-1" } });
		for (let h = 6; h <= 23; h++)
			sel2.createEl("option", { text: `${h}:00`, attr: { value: String(h) } });
		sel2.value = String(s.reminderHour);
		sel2.onchange = async () => { s.reminderHour = Number(sel2.value); await this.plugin.saveAll(); };

		main.createEl("h4", { text: "Lộ trình cá nhân" });
		const cgGoal = group("Mục tiêu học", "Coach ưu tiên deck và bài luyện phù hợp với mục tiêu này");
		const goal = cgGoal.createEl("select", { cls: "dropdown" });
		for (const [value, label] of [["business", "Business English"], ["daily", "Giao tiếp hằng ngày"], ["ielts", "IELTS"], ["content", "Content creator"], ["ai-tech", "AI & Technology"], ["cambridge", "Cambridge / CEFR"]] as const)
			goal.createEl("option", { text: label, attr: { value } });
		goal.value = s.learningGoal;
		goal.onchange = async () => { s.learningGoal = goal.value as typeof s.learningGoal; await this.plugin.saveAll(); this.render(); };
		const cgMinutes = group("Thời lượng phiên Coach", "Tạo phiên học cân bằng ghi nhớ, nghe, nói và viết");
		const minValue = cgMinutes.createSpan({ text: `${s.dailyMinutes} phút`, cls: "vf-setting-value" });
		const minRange = cgMinutes.createEl("input", { attr: { type: "range", min: "5", max: "30", step: "5", value: String(s.dailyMinutes) } });
		minRange.oninput = () => minValue.setText(`${minRange.value} phút`);
		minRange.onchange = async () => { s.dailyMinutes = Number(minRange.value); await this.plugin.saveAll(); };
		const errorPath = group("Sổ lỗi cá nhân", "Lưu lỗi viết đã được AI sửa thành note Markdown có thể ôn lại");
		const ep = errorPath.createEl("input", { attr: { type: "text", value: s.errorNotebookPath }, cls: "vf-input" });
		ep.onchange = async () => { s.errorNotebookPath = ep.value.trim() || "5. Toolbox/English/My English Errors.md"; await this.plugin.saveAll(); };

		main.createEl("h4", { text: "AI CLI local · plugin không yêu cầu API key" });
		const c7 = group("AI mặc định", "Auto ưu tiên Claude → Grok → Gemini → Codex đã đăng nhập trên máy");
		const provider = c7.createEl("select", { cls: "dropdown" });
		for (const [value, label] of [["auto", "Tự động"], ["claude", "Claude CLI"], ["codex", "Codex CLI"], ["gemini", "Gemini CLI"], ["grok", "Grok CLI"]] as const)
			provider.createEl("option", { text: label, attr: { value } });
		provider.value = s.aiProvider;
		provider.onchange = async () => {
			s.aiProvider = provider.value as typeof s.aiProvider;
			this.plugin.resetAiProvider();
			await this.plugin.saveAll();
		};
		const checkAi = c7.createEl("button", { text: "Kiểm tra", cls: "vf-btn-icon" });
		checkAi.onclick = async () => {
			checkAi.disabled = true;
			checkAi.setText("Đang kiểm tra…");
			try { new Notice(await this.plugin.aiStatusSummary(), 9000); }
			finally { checkAi.disabled = false; checkAi.setText("Kiểm tra"); }
		};
		const cliPaths: Array<[string, "claudePath" | "codexPath" | "geminiPath" | "grokPath", string]> = [
			["Claude CLI", "claudePath", "claude"], ["Codex CLI", "codexPath", "codex"],
			["Gemini CLI", "geminiPath", "gemini"], ["Grok CLI", "grokPath", "grok"],
		];
		for (const [label, key, fallback] of cliPaths) {
			const ctrl = group(label, "Đường dẫn binary; để tên lệnh nếu đã có trong PATH");
			const input = ctrl.createEl("input", { attr: { type: "text", value: s[key] }, cls: "vf-input" });
			input.onchange = async () => { s[key] = input.value.trim() || fallback; this.plugin.resetAiProvider(); await this.plugin.saveAll(); };
		}

		// thông tin tác giả
		main.createEl("h4", { text: "Thông tin & Tác giả" });
		const authorGroup = main.createDiv({ cls: "vf-setting vf-author-card" });
		const authorInfo = authorGroup.createDiv({ cls: "vf-setting-info" });
		authorInfo.createDiv({ text: "👤 Tony Hoang (Trần Văn Hoàng)", cls: "vf-setting-name" });
		authorInfo.createDiv({ text: "✉️ tony@tranvanhoang.com · Vocab Forge v2.0", cls: "vf-setting-desc" });
		const authorCtrl = authorGroup.createDiv({ cls: "vf-setting-control" });
		const infoModalBtn = authorCtrl.createEl("button", { text: "ℹ️ Thông tin", cls: "vf-btn-icon" });
		infoModalBtn.onclick = () => new AboutModal(this.app, this.plugin).open();
		const contactBtn = authorCtrl.createEl("button", { text: "✉️ Gửi Email", cls: "vf-btn-icon" });
		contactBtn.onclick = () => window.open("mailto:tony@tranvanhoang.com");
	}

	// ================================================================ MISC

	private computeStreak(): number {
		return this.plugin.computeStreak();
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

	/** Biểu đồ retention: % trả lời đúng (không Quên) trên thẻ đang ôn, 30 ngày gần nhất */
	private renderRetention(main: HTMLElement): void {
		const stats = this.plugin.data.stats;
		const days: Array<{ key: string; pct: number | null }> = [];
		const d = new Date();
		d.setDate(d.getDate() - 29);
		let sumPass = 0, sumTotal = 0;
		for (let i = 0; i < 30; i++) {
			const key = todayKey(d);
			const s = stats[key];
			const total = (s?.pass ?? 0) + (s?.fail ?? 0);
			days.push({ key, pct: total ? Math.round(((s?.pass ?? 0) / total) * 100) : null });
			sumPass += s?.pass ?? 0;
			sumTotal += total;
			d.setDate(d.getDate() + 1);
		}
		const head = main.createDiv({ cls: "vf-section-head" });
		head.createEl("h4", { text: "Tỷ lệ nhớ (retention) — 30 ngày" });
		if (sumTotal)
			head.createSpan({
				text: `TB ${Math.round((sumPass / sumTotal) * 100)}% · mục tiêu ${Math.round(this.plugin.settings.requestRetention * 100)}%`,
				cls: "vf-muted",
			});
		const chart = main.createDiv({ cls: "vf-forecast vf-retention" });
		if (!sumTotal) {
			chart.createDiv({ text: "Chưa có dữ liệu — sẽ tự tích luỹ từ các phiên ôn tới.", cls: "vf-empty" });
			return;
		}
		days.forEach((day, i) => {
			const col = chart.createDiv({ cls: "vf-fc-col" });
			const bar = col.createDiv({ cls: "vf-fc-bar vf-ret-bar" });
			if (day.pct == null) {
				bar.style.height = "3px";
				bar.addClass("vf-ret-empty");
			} else {
				bar.style.height = `${Math.max(4, Math.round((day.pct / 100) * 60))}px`;
				if (day.pct < this.plugin.settings.requestRetention * 100 - 10) bar.addClass("vf-ret-low");
			}
			bar.setAttr("aria-label", `${day.key}: ${day.pct == null ? "—" : day.pct + "%"}`);
			if (i % 5 === 0) col.createDiv({ text: day.key.slice(8), cls: "vf-fc-label" });
		});
	}

	/** Lưới huy hiệu thành tích */
	private renderBadges(main: HTMLElement): void {
		const earned = this.plugin.data.badges;
		const head = main.createDiv({ cls: "vf-section-head" });
		head.createEl("h4", { text: "Huy hiệu" });
		head.createSpan({ text: `${Object.keys(earned).length}/${BADGES.length}`, cls: "vf-muted" });
		const grid = main.createDiv({ cls: "vf-badge-grid" });
		for (const b of BADGES) {
			const got = earned[b.id];
			const el = grid.createDiv({ cls: `vf-badge-tile ${got ? "vf-badge-got" : "vf-badge-locked"}` });
			el.createDiv({ text: b.icon, cls: "vf-badge-icon" });
			el.createDiv({ text: b.name, cls: "vf-badge-name" });
			el.createDiv({ text: got ? `✓ ${got}` : b.desc, cls: "vf-badge-desc" });
		}
	}

	// ========================================================== FLUENCY LAB

	private renderLab(main: HTMLElement): void {
		const head = main.createDiv({ cls: "vf-lab-header" });
		const title = head.createDiv();
		title.createDiv({ text: "Voice-first practice", cls: "vf-eyebrow" });
		title.createEl("h3", { text: "🎙️ Fluency Lab" });
		title.createDiv({ text: "Nghe thật kỹ, nói thành tiếng và đo tiến bộ — dùng chính câu trong vault của bạn.", cls: "vf-muted" });
		const capture = head.createEl("button", { text: "✨ Smart Capture", cls: "vf-btn-icon" });
		capture.onclick = () => this.plugin.openSmartCapture();

		const tabs = main.createDiv({ cls: "vf-lab-tabs" });
		tabs.setAttr("role", "tablist");
		tabs.setAttr("aria-label", "Chế độ Fluency Lab");
		for (const [mode, label] of [["dictation", "🎧 Listening & Dictation"], ["shadowing", "🎙️ Shadowing"], ["coverage", "📊 Video Score"]] as const) {
			const tab = tabs.createEl("button", { text: label, cls: `vf-lab-tab ${this.labMode === mode ? "vf-lab-tab-on" : ""}` });
			tab.setAttr("role", "tab");
			tab.setAttr("aria-selected", String(this.labMode === mode));
			tab.onclick = () => {
				this.labMode = mode;
				this.resetLabAttempt();
				this.render();
			};
		}

		if (this.labMode === "coverage") {
			this.renderCoverageLab(main);
			return;
		}
		const cards = this.labCards();
		if (!cards.length) {
			const empty = main.createDiv({ cls: "vf-story-wait" });
			empty.createDiv({ text: "🎧", cls: "vf-done-emoji" });
			empty.createDiv({ text: "Cần ít nhất một thẻ có quote để luyện nghe/nói.", cls: "vf-muted" });
			const btn = empty.createEl("button", { text: "Lấy câu từ video", cls: "vf-btn-hero vf-btn-hero-small" });
			btn.onclick = () => this.plugin.openSmartCapture();
			return;
		}
		const card = cards[this.labIndex % cards.length];
		const panel = main.createDiv({ cls: "vf-lab-panel" });
		const stage = panel.createDiv({ cls: "vf-media-stage" });
		stage.createDiv({ text: `${categoryEmoji(card.category)} ${card.category} · ${this.labIndex + 1}/${cards.length}`, cls: "vf-eyebrow" });
		const embed = this.youtubeClipEmbed(card.sourceUrl, card.quote);
		if (embed) {
			stage.createEl("iframe", {
				cls: "vf-lab-video",
				attr: { src: embed, title: `Nguồn video: ${card.word}`, allow: "accelerometer; autoplay; encrypted-media; picture-in-picture" },
			});
		} else {
			const wave = stage.createDiv({ cls: "vf-wave" });
			for (let i = 0; i < 13; i++) wave.createSpan();
		}
		const quote = stage.createDiv({
			text: `“${card.quote}”`,
			cls: `vf-lab-quote ${this.labMode === "dictation" && !this.labReveal && !this.labDiff ? "vf-lab-hidden" : ""}`,
		});
		quote.setAttr("aria-label", this.labReveal || this.labDiff ? card.quote : "Câu đang được ẩn để luyện nghe");
		const controls = stage.createDiv({ cls: "vf-lab-controls" });
		const listen = controls.createEl("button", { text: "▶ Nghe câu", cls: "vf-btn-hero vf-btn-hero-small" });
		listen.onclick = () => this.plugin.speak(card.quote);
		if (card.sourceUrl) {
			const source = controls.createEl("button", { text: "↗ Video gốc", cls: "vf-btn-hero-ghost" });
			source.onclick = () => window.open(card.sourceUrl);
		}
		const next = controls.createEl("button", { text: "Câu khác →", cls: "vf-btn-hero-ghost" });
		next.onclick = () => this.nextLab(cards.length);

		if (this.labMode === "dictation") this.renderDictation(panel, card);
		else this.renderShadowing(panel, card);
	}

	private labCards(): VocabCard[] {
		return this.plugin.store.getAllCards()
			.filter((c) => c.quote.trim().split(/\s+/).length >= 4 && c.quote.trim().split(/\s+/).length <= 45)
			.sort((a, b) => (b.fsrs.lapses - a.fsrs.lapses) || (b.fsrs.reps - a.fsrs.reps));
	}

	private youtubeClipEmbed(url: string, quote: string): string | null {
		const id = url.match(/(?:v=|youtu\.be\/|\/shorts\/)([\w-]{11})/)?.[1];
		if (!id) return null;
		const raw = url.match(/[?&#](?:t|start)=([^&#]+)/)?.[1] ?? "0";
		const h = Number(raw.match(/(\d+)h/)?.[1] ?? 0);
		const m = Number(raw.match(/(\d+)m/)?.[1] ?? 0);
		const secPart = raw.match(/(\d+)s/)?.[1];
		const start = secPart ? h * 3600 + m * 60 + Number(secPart) : Number.parseInt(raw, 10) || 0;
		const duration = Math.max(6, Math.min(24, Math.ceil(quote.split(/\s+/).length / 2.1) + 2));
		return `https://www.youtube-nocookie.com/embed/${id}?start=${start}&end=${start + duration}&controls=1&rel=0&playsinline=1`;
	}

	private renderDictation(panel: HTMLElement, card: VocabCard): void {
		const box = panel.createDiv({ cls: "vf-dictation-box" });
		box.createDiv({ text: "Nghe mà không nhìn chữ, sau đó gõ lại nguyên câu.", cls: "vf-muted" });
		const input = box.createEl("textarea", { attr: { placeholder: "Gõ câu bạn nghe được…", spellcheck: "false", "aria-label": "Câu bạn nghe được" } });
		input.value = this.labAnswer;
		input.oninput = () => (this.labAnswer = input.value);
		input.onkeydown = (e) => e.stopPropagation();
		const actions = box.createDiv({ cls: "vf-actions" });
		const check = actions.createEl("button", { text: "Kiểm tra", cls: "vf-btn-hero vf-btn-hero-small" });
		check.onclick = () => {
			if (!this.labAnswer.trim()) return new Notice("Hãy gõ câu bạn nghe được trước");
			this.labDiff = diffTranscripts(card.quote, this.labAnswer);
			this.labReveal = true;
			this.plugin.recordSkill("listening", Math.round(this.labDiff.accuracy * 100));
			this.plugin.recordPractice(this.labDiff.accuracy >= 0.8);
			this.render();
		};
		const reveal = actions.createEl("button", { text: this.labReveal ? "Ẩn đáp án" : "Gợi ý: hiện câu", cls: "vf-btn-icon" });
		reveal.onclick = () => { this.labReveal = !this.labReveal; this.render(); };
		if (this.labDiff) {
			const result = box.createDiv({ cls: "vf-feedback vf-feedback-ok" });
			const score = Math.round(this.labDiff.accuracy * 100);
			result.createDiv({ text: `${score >= 85 ? "✨" : score >= 60 ? "👍" : "🛠"} ${score}/100 · WER ${Math.round(this.labDiff.wordErrorRate * 100)}%`, cls: "vf-feedback-text" });
			this.renderTranscriptDiff(result, this.labDiff);
		}
	}

	private renderShadowing(panel: HTMLElement, card: VocabCard): void {
		const box = panel.createDiv({ cls: "vf-dictation-box" });
		box.createDiv({ text: "Nghe một lần, sau đó thu âm nhại lại đúng nhịp và đủ từ.", cls: "vf-muted" });
		const supported = isAudioRecordingSupported();
		const hasRecognition = isSpeechRecognitionSupported();
		if (!supported) box.createDiv({ text: "Thiết bị này chưa hỗ trợ ghi âm. Bạn vẫn có thể nghe và shadowing thủ công.", cls: "vf-feedback vf-feedback-no" });
		else if (!hasRecognition) box.createDiv({ text: "Trình duyệt chưa hỗ trợ nhận dạng giọng nói: vẫn có thể thu và nghe lại, nhưng không có điểm transcript.", cls: "vf-feedback vf-feedback-no" });
		const live = box.createDiv({ text: this.labSpoken || "Transcript giọng nói sẽ hiện ở đây…", cls: "vf-muted vf-live-transcript" });
		live.setAttr("aria-live", "polite");
		const actions = box.createDiv({ cls: "vf-actions" });
		const record = actions.createEl("button", {
			text: this.labStarting ? "Đang mở mic…" : this.labRecording ? "■ Dừng & chấm" : "● Bắt đầu thu",
			cls: `vf-btn-hero vf-btn-hero-small ${this.labRecording ? "vf-recording" : ""}`,
			attr: { "aria-pressed": String(this.labRecording) },
		});
		record.disabled = !supported || this.labStarting;
		record.onclick = () => void (this.labRecording ? this.stopShadowing(card) : this.startShadowing());
		if (this.labAudioUrl) box.createEl("audio", { attr: { controls: "", src: this.labAudioUrl } });
		if (this.labShadowScore) {
			const score = this.labShadowScore;
			const ring = box.createDiv({ text: `${score.overall}`, cls: "vf-score-ring" });
			ring.style.setProperty("--vf-score", String(score.overall));
			box.createDiv({ text: `Accuracy ${score.accuracy}% · Đủ từ ${score.completeness}% · Fluency ${score.fluency}%`, cls: "vf-coach-title" });
			box.createDiv({ text: "Điểm phản ánh độ khớp transcript và nhịp nói ước tính; không đo chính xác phát âm hay ngữ điệu.", cls: "vf-muted" });
			this.renderTranscriptDiff(box, score.diff);
			for (const tip of score.feedback) box.createDiv({ text: `• ${tip}`, cls: "vf-muted" });
		}
	}

	private async startShadowing(): Promise<void> {
		if (this.labStarting || this.labRecording) return;
		this.labStarting = true;
		this.render();
		try {
			this.labSpoken = "";
			this.labShadowScore = null;
			this.labConfidence = 0;
			await this.audioRecorder.start();
			if (this.section !== "lab") {
				this.audioRecorder.cancel();
				return;
			}
			if (isSpeechRecognitionSupported()) this.speechRecognition.start({
				language: this.plugin.settings.voiceLocale,
				onUpdate: (update) => {
					this.labSpoken = `${update.finalTranscript} ${update.interimTranscript}`.trim();
					this.labConfidence = update.confidence || this.labConfidence;
					const live = this.contentEl.querySelector(".vf-live-transcript");
					if (live) live.textContent = this.labSpoken || "Đang nghe…";
				},
				onEnd: (finalText) => { if (finalText) this.labSpoken = finalText; },
				onError: (error) => { console.warn("Vocab Forge speech recognition:", error); },
			});
			this.labRecording = true;
		} catch (e) {
			console.error("Vocab Forge recorder:", e);
			this.audioRecorder.cancel();
			const cancelled = e instanceof Error && e.message.includes("cancelled");
			if (this.section === "lab" && !cancelled) new Notice("Không mở được microphone — kiểm tra quyền microphone của Obsidian");
		} finally {
			this.labStarting = false;
			if (this.section === "lab") this.render();
		}
	}

	private async stopShadowing(card: VocabCard): Promise<void> {
		this.labRecording = false;
		try {
			const recognized = this.speechRecognition.isActive
				? await this.speechRecognition.stopAndWait(1_500)
				: this.labSpoken;
			if (recognized) this.labSpoken = recognized;
			const recording = await this.audioRecorder.stop();
			if (this.labAudioUrl) URL.revokeObjectURL(this.labAudioUrl);
			this.labAudioUrl = recording.createObjectUrl();
			this.labShadowScore = this.labSpoken ? scoreShadowing({
				reference: card.quote,
				spoken: this.labSpoken,
				referenceDurationMs: card.quote.split(/\s+/).length * 430,
				recordingDurationMs: recording.durationMs,
				recognitionConfidence: this.labConfidence,
			}) : null;
			if (this.labShadowScore) {
				this.plugin.recordSkill("speaking", this.labShadowScore.overall);
				this.plugin.recordPractice(this.labShadowScore.overall >= 75);
			} else new Notice("Đã ghi âm — hãy nghe lại bản thu để tự đối chiếu");
		} catch (e) {
			console.error("Vocab Forge shadowing:", e);
			new Notice("Không hoàn tất được bản ghi âm");
		}
		this.render();
	}

	private renderTranscriptDiff(parent: HTMLElement, diff: TranscriptDiff): void {
		const line = parent.createDiv({ cls: "vf-lab-quote" });
		line.setAttr("aria-live", "polite");
		for (const word of diff.words) {
			const text = word.kind === "substitution"
				? `${word.spoken ?? "?"} → ${word.reference ?? "?"}`
				: word.kind === "deletion"
					? `+ ${word.reference ?? ""}`
					: word.kind === "insertion"
						? `− ${word.spoken ?? ""}`
						: word.reference ?? word.spoken ?? "";
			line.createSpan({ text: `${text} `, cls: `vf-diff-${word.kind}` });
		}
	}

	private cleanCoverageText(value: string): string {
		return value
			.replace(/^---\r?\n[\s\S]*?\r?\n---\s*/, "")
			.replace(/https?:\/\/\S+/g, " ")
			.replace(/^#{1,6}\s+/gm, "")
			.replace(/!\[([^\]]*)\]\([^)]*\)|\[([^\]]+)\]\([^)]*\)/g, "$1 $2")
			.replace(/^\s*(?:[-*+] |\d+[.)] |> ?)/gm, "")
			.replace(/\[?\d{1,2}:\d{2}(?::\d{2})?\]?/g, " ")
			.replace(/[`*_~]/g, " ")
			.slice(0, 100_000);
	}

	private renderCoverageLab(main: HTMLElement): void {
		const card = main.createDiv({ cls: "vf-coverage-card" });
		card.createDiv({ text: "Video Comprehension Score", cls: "vf-eyebrow" });
		card.createDiv({ text: "Dán transcript để biết bạn hiểu được bao nhiêu và nên học từ nào trước.", cls: "vf-coach-title" });
		const input = card.createEl("textarea", { cls: "vf-coverage-input", attr: { placeholder: "Dán transcript tiếng Anh hoặc nội dung note tại đây…", "aria-label": "Transcript cần phân tích" } });
		input.value = this.coverageText;
		input.oninput = () => { this.coverageText = input.value; this.coverageResult = null; };
		const actions = card.createDiv({ cls: "vf-actions" });
		const analyze = actions.createEl("button", { text: "Phân tích video", cls: "vf-btn-hero vf-btn-hero-small" });
		analyze.onclick = () => {
			if (!this.coverageText.trim()) return new Notice("Hãy dán transcript trước");
			this.coverageResult = analyzeVideoComprehension(this.cleanCoverageText(this.coverageText), this.plugin.store.getAllCards());
			this.render();
		};
		const active = actions.createEl("button", { text: "Dùng note đang mở", cls: "vf-btn-icon" });
		active.onclick = async () => {
			const file = this.app.workspace.getActiveFile();
			if (!file) return new Notice("Không có note đang mở");
			this.coverageText = await this.app.vault.read(file);
			this.coverageResult = analyzeVideoComprehension(this.cleanCoverageText(this.coverageText), this.plugin.store.getAllCards());
			this.render();
		};
		if (!this.coverageResult) return;
		const r = this.coverageResult;
		const stats = card.createDiv({ cls: "vf-coverage-stats" });
		for (const [value, label] of [[`${Math.round(r.coverage * 100)}%`, "Mức hiểu ước tính"], [r.estimatedCefr, "Độ khó CEFR"], [String(Math.max(0, r.uniqueTokens - r.knownUniqueTokens)), "Từ chưa biết"]]) {
			const stat = stats.createDiv({ cls: "vf-coverage-stat" });
			stat.createDiv({ text: value, cls: "vf-coverage-value" });
			stat.createDiv({ text: label, cls: "vf-coverage-label" });
		}
		card.createDiv({
			text: r.readiness === "comfortable" ? "✅ Bạn có thể xem khá thoải mái." : r.readiness === "supported" ? "👍 Xem được nếu bật subtitle." : "🧭 Nên học một số từ khóa trước khi xem.",
			cls: `vf-feedback ${r.readiness === "challenging" ? "vf-feedback-no" : "vf-feedback-ok"}`,
		});
		card.createDiv({ text: r.heuristicNote, cls: "vf-muted" });
		const words = card.createDiv({ cls: "vf-chips" });
		for (const item of r.unknown.slice(0, 15)) words.createSpan({ text: `${item.word} ×${item.count}`, cls: "vf-chip" });
		const capture = card.createEl("button", { text: "✨ Chuyển transcript thành thẻ", cls: "vf-btn-icon" });
		capture.onclick = () => this.plugin.openSmartCapture(this.coverageText);
	}

	private nextLab(total: number): void {
		this.labIndex = (this.labIndex + 1) % Math.max(1, total);
		this.resetLabAttempt();
		this.render();
	}

	private resetLabAttempt(): void {
		this.speechRecognition.abort();
		this.audioRecorder.cancel();
		this.labAnswer = "";
		this.labReveal = false;
		this.labDiff = null;
		this.labSpoken = "";
		this.labShadowScore = null;
		this.labRecording = false;
		this.labStarting = false;
		if (this.labAudioUrl) URL.revokeObjectURL(this.labAudioUrl);
		this.labAudioUrl = "";
	}

	// ================================================================= CHAT

	private renderChat(main: HTMLElement): void {
		main.createEl("h3", { text: "💬 Voice Roleplay" });
		main.createDiv({
			text: "Nói hoặc gõ với AI đóng vai đối tác. Cuối phiên, AI phân tích độ tự nhiên và cách dùng từ mục tiêu.",
			cls: "vf-muted",
		});

		if (!this.chatMsgs.length && !this.chatBusy) {
			const empty = main.createDiv({ cls: "vf-story-wait" });
			empty.createDiv({ text: "💬", cls: "vf-done-emoji" });
			const start = empty.createEl("button", {
				text: "✨ Bắt đầu hội thoại mới",
				cls: "vf-btn-hero vf-btn-hero-small",
			});
			start.onclick = () => void this.startChat();
			return;
		}

		if (this.chatWords.length) {
			const chips = main.createDiv({ cls: "vf-chips vf-chat-targets" });
			chips.createSpan({ text: "🎯 Dùng được:", cls: "vf-muted" });
			for (const w of this.chatWords) {
				const used = this.chatMsgs.some(
					(m) => m.role === "me" && m.text.toLowerCase().includes(w.toLowerCase())
				);
				chips.createSpan({ text: used ? `✓ ${w}` : w, cls: `vf-chip ${used ? "vf-chip-used" : ""}` });
			}
		}

		const box = main.createDiv({ cls: "vf-chat-box" });
		for (const m of this.chatMsgs) {
			const b = box.createDiv({
				cls:
					m.role === "me"
						? "vf-msg vf-msg-me"
						: m.role === "feedback"
							? "vf-msg vf-msg-feedback"
							: "vf-msg vf-msg-ai",
			});
			if (m.role === "feedback") b.createDiv({ text: "📋 Nhận xét", cls: "vf-msg-tag" });
			b.createDiv({ text: m.text });
			if (m.role === "ai") {
				const sp = b.createEl("button", { text: "🔊", cls: "vf-btn-tiny" });
				sp.onclick = () => this.plugin.speak(m.text);
			}
		}
		if (this.chatBusy) box.createDiv({ text: "⏳ …", cls: "vf-msg vf-msg-ai vf-msg-wait" });
		window.setTimeout(() => (box.scrollTop = box.scrollHeight), 20);

		const row = main.createDiv({ cls: "vf-chat-input-row" });
		const input = row.createEl("input", {
			cls: "vf-practice-input",
			attr: { type: "text", placeholder: "Trả lời bằng tiếng Anh…", spellcheck: "false" },
		});
		input.value = this.chatInput;
		input.oninput = () => (this.chatInput = input.value);
		input.onkeydown = (e) => {
			e.stopPropagation();
			if (e.key === "Enter") void this.sendChat();
		};
		input.disabled = this.chatBusy || this.chatListening;
		const mic = row.createEl("button", {
			text: this.chatListening ? "■" : "🎙️",
			cls: `vf-btn-icon ${this.chatListening ? "vf-recording" : ""}`,
			attr: { "aria-label": this.chatListening ? "Dừng ghi giọng nói" : "Trả lời bằng giọng nói" },
		});
		mic.disabled = this.chatBusy || !isSpeechRecognitionSupported();
		mic.onclick = () => this.toggleChatVoice();
		const send = row.createEl("button", { text: "Gửi ➤", cls: "vf-btn-hero vf-btn-hero-small" });
		send.disabled = this.chatBusy || this.chatListening;
		send.onclick = () => void this.sendChat();

		const foot = main.createDiv({ cls: "vf-actions" });
		const end = foot.createEl("button", { text: "🏁 Kết thúc & nhận xét", cls: "vf-btn-icon" });
		end.disabled = this.chatBusy || this.chatListening || this.chatMsgs.filter((m) => m.role === "me").length === 0;
		end.onclick = () => void this.endChat();
		const reset = foot.createEl("button", { text: "🔄 Hội thoại mới", cls: "vf-btn-icon" });
		reset.disabled = this.chatBusy || this.chatListening;
		reset.onclick = () => void this.startChat();
		if (!this.flippedFocusGuard()) window.setTimeout(() => input.focus(), 30);
	}

	private flippedFocusGuard(): boolean {
		return this.chatBusy || this.chatListening;
	}

	private toggleChatVoice(): void {
		if (this.chatListening) {
			this.speechRecognition.stop();
			this.chatListening = false;
			this.render();
			return;
		}
		try {
			this.chatListening = true;
			this.speechRecognition.start({
				language: this.plugin.settings.voiceLocale,
				continuous: false,
				onUpdate: (update) => {
					this.chatInput = `${update.finalTranscript} ${update.interimTranscript}`.trim();
					const input = this.contentEl.querySelector(".vf-chat-input-row input") as HTMLInputElement | null;
					if (input) input.value = this.chatInput;
				},
				onEnd: (text) => {
					if (text) this.chatInput = text;
					this.chatListening = false;
					this.render();
				},
				onError: () => {
					this.chatListening = false;
					new Notice("Không nhận được giọng nói — kiểm tra quyền microphone");
					this.render();
				},
			});
			this.render();
		} catch {
			this.chatListening = false;
			new Notice("Thiết bị chưa hỗ trợ speech recognition");
		}
	}

	private pickChatWords(): string[] {
		const all = this.plugin.store
			.getAllCards()
			.filter((c) => c.type !== "sentence" && c.type !== "passage" && c.type !== "grammar");
		const hard = all.filter((c) => c.fsrs.lapses >= 2);
		const allowedPaths = new Set(all.map((card) => card.file.path));
		const due = this.plugin.store.getDueCards().filter((card) => allowedPaths.has(card.file.path));
		const learned = all.filter((c) => c.fsrs.state !== State.New);
		const pool = [...hard, ...due, ...learned, ...all];
		const words: string[] = [];
		for (const c of pool) {
			if (!words.includes(c.word)) words.push(c.word);
			if (words.length === 5) break;
		}
		return words;
	}

	private async startChat(): Promise<void> {
		this.speechRecognition.abort();
		this.chatListening = false;
		if (this.chatSession) this.plugin.clearAiSession(this.chatSession);
		this.chatWords = this.pickChatWords();
		if (this.chatWords.length < 2) {
			new Notice("Chưa đủ thẻ để tạo hội thoại");
			return;
		}
		this.chatMsgs = [];
		this.chatInput = "";
		this.chatSession = `vf-chat-${Date.now()}`;
		this.chatBusy = true;
		this.render();
		try {
			const first = await this.plugin.runAI(
				chatStartPrompt(this.chatWords),
				120_000,
				this.chatSession
			);
			this.chatMsgs.push({ role: "ai", text: first.trim() });
			this.plugin.speak(first.trim());
		} catch (e) {
			console.error("Vocab Forge chat:", e);
			new Notice("Không bắt đầu được hội thoại — kiểm tra AI CLI");
		} finally {
			this.chatBusy = false;
			this.render();
		}
	}

	private async sendChat(): Promise<void> {
		const text = this.chatInput.trim();
		if (!text || this.chatBusy || this.chatListening || !this.chatSession) return;
		this.chatMsgs.push({ role: "me", text });
		this.chatInput = "";
		this.chatBusy = true;
		this.render();
		try {
			const reply = await this.plugin.runAI(text, 120_000, this.chatSession);
			this.chatMsgs.push({ role: "ai", text: reply.trim() });
			this.plugin.speak(reply.trim());
		} catch (e) {
			console.error("Vocab Forge chat:", e);
			new Notice("Lỗi gửi tin — thử lại");
			this.chatMsgs.pop();
			this.chatInput = text;
		} finally {
			this.chatBusy = false;
			this.render();
		}
	}

	private async endChat(): Promise<void> {
		if (this.chatBusy || this.chatListening || !this.chatSession) return;
		this.speechRecognition.abort();
		this.chatListening = false;
		this.chatBusy = true;
		this.render();
		try {
			const fb = await this.plugin.runAI(
				chatFeedbackPrompt(this.chatWords),
				120_000,
				this.chatSession
			);
			this.chatMsgs.push({ role: "feedback", text: fb.trim() });
			this.plugin.clearAiSession(this.chatSession);
			this.chatSession = "";
		} catch (e) {
			console.error("Vocab Forge chat:", e);
			new Notice("Không lấy được nhận xét");
		} finally {
			this.chatBusy = false;
			this.render();
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
			wait.createDiv({ text: "AI CLI đang viết story từ các thẻ của bạn… (~30–60s)", cls: "vf-muted" });
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
			const raw = await this.plugin.runAI(storyPrompt(words, cats), 150_000);
			const sep = raw.indexOf("---");
			const en = (sep === -1 ? raw : raw.slice(0, sep)).trim();
			const vi = sep === -1 ? "" : raw.slice(sep + 3).trim();
			if (!en) throw new Error("empty story");
			this.plugin.data.story = { date: todayKey(), words, en, vi };
			await this.plugin.saveAll();
		} catch (e) {
			console.error("Vocab Forge story:", e);
			new Notice("Không tạo được story — kiểm tra AI CLI");
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
