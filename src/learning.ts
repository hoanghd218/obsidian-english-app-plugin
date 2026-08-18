import { App, TFile, TFolder, normalizePath } from "obsidian";
import { State } from "./srs";
import type { DailyStat, VocabCard } from "./types";

/** The learning skills tracked by the adaptive coach. */
export type LearningSkill =
	| "review"
	| "recall"
	| "recognition"
	| "cloze"
	| "listening"
	| "shadowing"
	| "grammar";

export interface SkillPerformance {
	attempts: number;
	correct: number;
	/** Optional exponentially-weighted score (0..1), when the caller already maintains one. */
	recentAccuracy?: number;
	lastPracticed?: Date | string;
}

export type SkillPerformanceMap = Partial<Record<LearningSkill, SkillPerformance>>;

export interface DailySessionInput {
	cards: readonly VocabCard[];
	history?: Readonly<Record<string, DailyStat>>;
	skillPerformance?: SkillPerformanceMap;
	minutes?: number;
	newCardLimit?: number;
	reverseEnabled?: boolean;
	now?: Date;
}

export interface DailySessionBlock {
	skill: LearningSkill;
	count: number;
	minutes: number;
	cardWords: string[];
	cardPaths: string[];
	reason: string;
}

export interface DailySessionRecommendation {
	totalMinutes: number;
	estimatedItems: number;
	blocks: DailySessionBlock[];
	weak: string;
	weakReason: string;
	dueCount: number;
	newAvailable: number;
	weakSkill: LearningSkill;
}

const ITEM_SECONDS: Record<LearningSkill, number> = {
	review: 24,
	recall: 42,
	recognition: 25,
	cloze: 38,
	listening: 58,
	shadowing: 95,
	grammar: 55,
};

/**
 * Builds a short, actionable session instead of merely returning due cards.
 * The result is deterministic for the same inputs so the UI does not jump on re-render.
 */
export function recommendDailySession(input: DailySessionInput): DailySessionRecommendation {
	const now = input.now ?? new Date();
	const minutes = clamp(Math.round(input.minutes ?? 10), 3, 60);
	const reverseEnabled = input.reverseEnabled ?? true;
	const newLimit = Math.max(0, Math.round(input.newCardLimit ?? 5));
	const budgetSeconds = minutes * 60;
	const cutoff = endOfDay(now).getTime();

	const due = input.cards
		.filter((card) => isDue(card, cutoff, reverseEnabled))
		.sort((a, b) => cardPriority(b, now, reverseEnabled) - cardPriority(a, now, reverseEnabled));
	const fresh = input.cards
		.filter((card) => card.fsrs.state === State.New)
		.sort((a, b) => a.file.stat.ctime - b.file.stat.ctime);
	const hard = [...input.cards]
		.filter((card) => card.fsrs.reps > 0)
		.sort((a, b) => cardPriority(b, now, reverseEnabled) - cardPriority(a, now, reverseEnabled));

	const weakest = weakestSkill(input.skillPerformance);
	const blocks: DailySessionBlock[] = [];
	let secondsLeft = budgetSeconds;

	const addBlock = (skill: LearningSkill, wanted: number, pool: readonly VocabCard[], reason: string): void => {
		if (wanted <= 0 || pool.length === 0 || secondsLeft < ITEM_SECONDS[skill] * 0.65) return;
		const affordable = Math.floor(secondsLeft / ITEM_SECONDS[skill]);
		const count = Math.min(wanted, affordable, pool.length);
		if (count <= 0) return;
		const selected = pool.slice(0, count);
		blocks.push({
			skill,
			count,
			minutes: round1((count * ITEM_SECONDS[skill]) / 60),
			cardWords: selected.map((card) => card.word),
			cardPaths: selected.map((card) => card.file.path),
			reason,
		});
		secondsLeft -= count * ITEM_SECONDS[skill];
	};

	// Protect the memory schedule first, but cap it so every session still practices production.
	const dueCap = Math.max(1, Math.floor((budgetSeconds * 0.48) / ITEM_SECONDS.review));
	addBlock("review", Math.min(due.length, dueCap), due, due.length ? `${due.length} thẻ đang đến hạn` : "Ôn duy trì trí nhớ");

	const focusPool = hard.length ? hard : due.length ? due : input.cards;
	const focusCount = Math.max(2, Math.floor((budgetSeconds * 0.22) / ITEM_SECONDS[weakest]));
	addBlock(weakest, focusCount, eligibleForSkill(focusPool, weakest), weakestReason(weakest, input.skillPerformance));

	// Listening and speaking get a guaranteed slot when quotes exist; they are otherwise easy to neglect.
	const quoteCards = input.cards
		.filter((card) => card.quote.trim().length > 0)
		.sort((a, b) => cardPriority(b, now, reverseEnabled) - cardPriority(a, now, reverseEnabled));
	if (weakest !== "listening" && weakest !== "shadowing") {
		addBlock("listening", Math.max(1, Math.floor(minutes / 8)), quoteCards, "Luyện nghe với câu thật từ nguồn của bạn");
	}
	if (minutes >= 8 && weakest !== "shadowing") {
		addBlock("shadowing", 1, quoteCards, "Biến vốn từ thụ động thành phản xạ nói");
	}

	const recent = recentTotals(input.history, 7, now);
	const canAddNew = recent.retention >= 0.75 || recent.graded === 0;
	if (canAddNew) {
		const wantedNew = Math.min(newLimit, Math.max(1, Math.floor(minutes / 5)));
		addBlock("recognition", wantedNew, fresh, "Thêm từ mới ở mức vừa sức");
	}

	// Spend any useful remainder on active recall; leave tiny remainders unused rather than overpromise.
	addBlock("recall", Math.floor(secondsLeft / ITEM_SECONDS.recall), hard.length ? hard : input.cards, "Củng cố khả năng tự gọi từ khi cần dùng");

	return {
		totalMinutes: round1((budgetSeconds - secondsLeft) / 60),
		estimatedItems: blocks.reduce((sum, block) => sum + block.count, 0),
		blocks,
		dueCount: due.length,
		newAvailable: fresh.length,
		weakSkill: weakest,
		weak: skillLabel(weakest),
		weakReason: weakestReason(weakest, input.skillPerformance),
	};
}

function isDue(card: VocabCard, cutoff: number, reverseEnabled: boolean): boolean {
	if (card.fsrs.state !== State.New && card.fsrs.due.getTime() <= cutoff) return true;
	return reverseEnabled && card.fsrsRev.state !== State.New && card.fsrsRev.due.getTime() <= cutoff;
}

function cardPriority(card: VocabCard, now: Date, reverseEnabled: boolean): number {
	const day = 86_400_000;
	const forwardOverdue = Math.max(0, (now.getTime() - card.fsrs.due.getTime()) / day);
	const reverseOverdue = reverseEnabled ? Math.max(0, (now.getTime() - card.fsrsRev.due.getTime()) / day) : 0;
	const reps = card.fsrs.reps + (reverseEnabled ? card.fsrsRev.reps : 0);
	const lapses = card.fsrs.lapses + (reverseEnabled ? card.fsrsRev.lapses : 0);
	const lapseRate = lapses / Math.max(1, reps);
	const difficulty = Math.max(card.fsrs.difficulty || 0, reverseEnabled ? card.fsrsRev.difficulty || 0 : 0) / 10;
	return Math.max(forwardOverdue, reverseOverdue) * 2 + lapseRate * 12 + difficulty * 3;
}

function weakestSkill(performance: SkillPerformanceMap | undefined): LearningSkill {
	const productionSkills: LearningSkill[] = ["recall", "cloze", "listening", "shadowing", "grammar"];
	let weakest: LearningSkill = "recall";
	let weakestScore = Number.POSITIVE_INFINITY;
	for (const skill of productionSkills) {
		const stat = performance?.[skill];
		const accuracy = stat ? clamp(stat.recentAccuracy ?? stat.correct / Math.max(1, stat.attempts), 0, 1) : 0.62;
		// Low-sample skills receive a small exploration penalty.
		const confidence = Math.min(1, (stat?.attempts ?? 0) / 12);
		const score = accuracy * (0.7 + confidence * 0.3);
		if (score < weakestScore) {
			weakest = skill;
			weakestScore = score;
		}
	}
	return weakest;
}

function weakestReason(skill: LearningSkill, performance: SkillPerformanceMap | undefined): string {
	const stat = performance?.[skill];
	if (!stat || stat.attempts < 3) return `${skillLabel(skill)} chưa có đủ dữ liệu — nên thử để cá nhân hóa`;
	const accuracy = clamp(stat.recentAccuracy ?? stat.correct / Math.max(1, stat.attempts), 0, 1);
	return `${skillLabel(skill)} đang là kỹ năng yếu nhất (${Math.round(accuracy * 100)}% chính xác)`;
}

function eligibleForSkill(cards: readonly VocabCard[], skill: LearningSkill): VocabCard[] {
	if (skill === "listening" || skill === "shadowing" || skill === "cloze") return cards.filter((card) => Boolean(card.quote.trim()));
	if (skill === "grammar") return cards.filter((card) => card.type === "grammar" || Boolean(card.grammarNote.trim()));
	return cards.filter((card) => card.type !== "passage");
}

function skillLabel(skill: LearningSkill): string {
	return ({
		review: "Ôn đến hạn",
		recall: "Gợi nhớ chủ động",
		recognition: "Nhận biết từ mới",
		cloze: "Điền khuyết",
		listening: "Nghe hiểu",
		shadowing: "Shadowing",
		grammar: "Ngữ pháp",
	} satisfies Record<LearningSkill, string>)[skill];
}

function recentTotals(history: Readonly<Record<string, DailyStat>> | undefined, days: number, now: Date): { retention: number; graded: number } {
	let pass = 0;
	let fail = 0;
	for (let offset = 0; offset < days; offset++) {
		const d = new Date(now);
		d.setDate(d.getDate() - offset);
		const stat = history?.[localDateKey(d)];
		pass += stat?.pass ?? 0;
		fail += stat?.fail ?? 0;
	}
	const graded = pass + fail;
	return { retention: graded ? pass / graded : 1, graded };
}

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface UnknownVocabulary {
	word: string;
	count: number;
	shareOfTranscript: number;
	contexts: string[];
}

export interface VideoComprehensionResult {
	totalTokens: number;
	uniqueTokens: number;
	knownTokens: number;
	knownUniqueTokens: number;
	coverage: number;
	uniqueCoverage: number;
	estimatedCefr: CefrLevel;
	readiness: "comfortable" | "supported" | "challenging";
	unknown: UnknownVocabulary[];
	knownTerms: string[];
	heuristicNote: string;
}

export interface VideoComprehensionOptions {
	/** Review-state cards are known by default. Lower this to include Learning cards. */
	minimumState?: State;
	minimumStability?: number;
	maxUnknown?: number;
	includeForms?: boolean;
	includeCollocations?: boolean;
	/** Treat basic function words as known even when they are not cards. Defaults to true. */
	assumeFunctionWordsKnown?: boolean;
}

/**
 * Estimates how much of an English transcript the learner already knows.
 * It recognizes multi-word cards and their forms before falling back to single words.
 */
export function analyzeVideoComprehension(
	transcript: string,
	cards: readonly VocabCard[],
	options: VideoComprehensionOptions = {}
): VideoComprehensionResult {
	const tokens = tokenizeEnglish(transcript);
	const minimumState = options.minimumState ?? State.Review;
	const minimumStability = Math.max(0, options.minimumStability ?? 0);
	const terms = new Set<string>();
	for (const card of cards) {
		if (card.fsrs.state < minimumState || card.fsrs.stability < minimumStability) continue;
		addTerm(terms, card.word);
		if (options.includeForms ?? true) for (const form of card.forms) addTerm(terms, form);
		if (options.includeCollocations ?? true) for (const collocation of card.collocations) addTerm(terms, collocation);
	}

	const termList = [...terms].map((term) => term.split(" ")).sort((a, b) => b.length - a.length);
	const covered = new Array<boolean>(tokens.length).fill(false);
	const matchedTerms = new Set<string>();
	for (let i = 0; i < tokens.length; i++) {
		for (const term of termList) {
			if (term.length > tokens.length - i) continue;
			if (!term.every((piece, offset) => tokens[i + offset] === piece)) continue;
			for (let offset = 0; offset < term.length; offset++) covered[i + offset] = true;
			matchedTerms.add(term.join(" "));
			break;
		}
	}

	const frequency = new Map<string, number>();
	const assumeFunctionWordsKnown = options.assumeFunctionWordsKnown ?? true;
	for (let i = 0; i < tokens.length; i++) {
		const assumedKnown = assumeFunctionWordsKnown && FUNCTION_WORDS.has(tokens[i]);
		if (!covered[i] && !assumedKnown) frequency.set(tokens[i], (frequency.get(tokens[i]) ?? 0) + 1);
		if (assumedKnown) covered[i] = true;
	}
	const knownTokens = covered.filter(Boolean).length;
	const unique = new Set(tokens);
	const knownUnique = new Set(tokens.filter((_token, index) => covered[index]));
	const sentences = transcript.split(/[.!?]+/).map((part) => tokenizeEnglish(part).length).filter(Boolean);
	const averageSentenceLength = sentences.length ? tokens.length / sentences.length : tokens.length;
	const advancedShare = tokens.length ? tokens.filter((token) => looksAdvanced(token)).length / tokens.length : 0;
	const estimatedCefr = estimateTranscriptLevel(averageSentenceLength, advancedShare);
	const coverage = tokens.length ? knownTokens / tokens.length : 0;
	const unknown = [...frequency.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, options.maxUnknown ?? 30)
		.map(([word, count]) => ({
			word,
			count,
			shareOfTranscript: tokens.length ? count / tokens.length : 0,
			contexts: contextsFor(transcript, word, 2),
		}));

	return {
		totalTokens: tokens.length,
		uniqueTokens: unique.size,
		knownTokens,
		knownUniqueTokens: knownUnique.size,
		coverage,
		uniqueCoverage: unique.size ? knownUnique.size / unique.size : 0,
		estimatedCefr,
		readiness: coverage >= 0.95 ? "comfortable" : coverage >= 0.85 ? "supported" : "challenging",
		unknown,
		knownTerms: [...matchedTerms].sort(),
		heuristicNote: "CEFR là ước tính từ độ dài câu và độ phức tạp từ vựng, không thay thế bài kiểm tra chuẩn hóa.",
	};
}

function addTerm(set: Set<string>, value: string): void {
	const term = tokenizeEnglish(value).join(" ");
	if (term) set.add(term);
}

function estimateTranscriptLevel(averageSentenceLength: number, advancedShare: number): CefrLevel {
	const score = averageSentenceLength + advancedShare * 75;
	if (score < 7) return "A1";
	if (score < 11) return "A2";
	if (score < 16) return "B1";
	if (score < 22) return "B2";
	if (score < 29) return "C1";
	return "C2";
}

function looksAdvanced(word: string): boolean {
	return word.length >= 10 || /(?:tion|sion|ment|ology|graphy|phical|ability|iveness|ential|iously)$/.test(word);
}

function contextsFor(transcript: string, word: string, limit: number): string[] {
	const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const parts = transcript.split(/(?<=[.!?])\s+|\n+/).map((part) => part.trim()).filter(Boolean);
	return parts.filter((part) => new RegExp(`\\b${escaped}\\b`, "i").test(part)).slice(0, limit);
}

/** English-focused tokenizer that preserves apostrophes inside words. */
export function tokenizeEnglish(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[’`]/g, "'")
		.match(/[a-z]+(?:'[a-z]+)*/g) ?? [];
}

const FUNCTION_WORDS = new Set(
	"a an the and or but if then than so because as at by for from in into of on onto to with is am are was were be been being do does did have has had i you he she it we they me him her us them my your his its our their this that these those who whom whose which what when where why how not no yes can could may might must shall should will would".split(" ")
);

export type ErrorCategory = "article" | "preposition" | "tense" | "word-choice" | "word-order" | "pronunciation" | "grammar" | "other";

export interface ErrorNotebookEntry {
	category: ErrorCategory | string;
	original: string;
	corrected: string;
	explanation?: string;
	source?: string;
	sourceUrl?: string;
	targetWords?: string[];
	sessionId?: string;
	createdAt?: Date;
}

export interface ErrorNotebookOptions {
	path?: string;
	title?: string;
}

/** Appends one structured, backlink-friendly Markdown item to a notebook in the vault. */
export async function appendErrorNotebookEntry(
	app: App,
	entry: ErrorNotebookEntry,
	options: ErrorNotebookOptions = {}
): Promise<TFile> {
	const path = normalizePath(options.path ?? "Vocab Forge/My English Errors.md");
	const title = options.title ?? "My English Errors";
	const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
	if (parent) await ensureVaultFolder(app, parent);
	const existing = app.vault.getAbstractFileByPath(path);
	if (existing && !(existing instanceof TFile)) throw new Error(`Cannot write error notebook: ${path} is not a file`);

	const createdAt = entry.createdAt ?? new Date();
	const block = formatErrorNotebookEntry(entry, createdAt);
	if (existing instanceof TFile) {
		await app.vault.append(existing, `\n${block}`);
		return existing;
	}
	const frontmatter = [
		"---",
		"tags: [vocab-forge, english-errors]",
		`created: ${localDateKey(createdAt)}`,
		"---",
		"",
		`# ${escapeMarkdownInline(title)}`,
		"",
		"> Những lỗi cá nhân được lưu tự động. Mỗi lỗi có thể chuyển thành thẻ SRS.",
		"",
	].join("\n");
	return app.vault.create(path, `${frontmatter}${block}`);
}

export function formatErrorNotebookEntry(entry: ErrorNotebookEntry, createdAt = entry.createdAt ?? new Date()): string {
	const category = entry.category.trim() || "other";
	const lines = [
		`## ${localDateKey(createdAt)} · ${escapeMarkdownInline(category)}`,
		`^vf-error-${stableEntryId(entry, createdAt)}`,
		"",
		`- **Sai:** ${inlineCode(entry.original)}`,
		`- **Đúng:** ${inlineCode(entry.corrected)}`,
	];
	if (entry.explanation?.trim()) lines.push(`- **Vì sao:** ${escapeMarkdownInline(entry.explanation.trim())}`);
	if (entry.targetWords?.length) lines.push(`- **Từ mục tiêu:** ${unique(entry.targetWords.map((word) => word.trim()).filter(Boolean)).map(inlineCode).join(", ")}`);
	if (entry.source?.trim()) {
		const source = escapeMarkdownInline(entry.source.trim());
		lines.push(`- **Nguồn:** ${entry.sourceUrl?.trim() ? `[${source}](${escapeMarkdownUrl(entry.sourceUrl.trim())})` : source}`);
	}
	if (entry.sessionId?.trim()) lines.push(`- **Phiên:** ${inlineCode(entry.sessionId.trim())}`);
	lines.push(`- **Ghi lúc:** ${createdAt.toISOString()}`, "");
	return lines.join("\n");
}

async function ensureVaultFolder(app: App, folderPath: string): Promise<void> {
	let current = "";
	for (const part of normalizePath(folderPath).split("/").filter(Boolean)) {
		current = current ? `${current}/${part}` : part;
		const existing = app.vault.getAbstractFileByPath(current);
		if (!existing) await app.vault.createFolder(current);
		else if (!(existing instanceof TFolder)) throw new Error(`Cannot create folder: ${current} is a file`);
	}
}

function stableEntryId(entry: ErrorNotebookEntry, date: Date): string {
	const input = `${date.toISOString()}|${entry.category}|${entry.original}|${entry.corrected}`;
	let hash = 2166136261;
	for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
	return (hash >>> 0).toString(36);
}

function inlineCode(value: string): string {
	const clean = value.replace(/\r?\n/g, " ").trim();
	const fence = clean.includes("``") ? "```" : clean.includes("`") ? "``" : "`";
	return `${fence}${clean}${fence}`;
}

function escapeMarkdownInline(value: string): string {
	return value.replace(/\r?\n/g, " ").replace(/([\\[*_~])/g, "\\$1");
}

function escapeMarkdownUrl(value: string): string {
	return encodeURI(value.replace(/[\r\n<>]/g, ""));
}

function endOfDay(date: Date): Date {
	const result = new Date(date);
	result.setHours(23, 59, 59, 999);
	return result;
}

function localDateKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function unique<T>(values: readonly T[]): T[] {
	return [...new Set(values)];
}

function round1(value: number): number {
	return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
