import { TFile } from "obsidian";
import type { Card as FsrsCard } from "ts-fsrs";
import { AI_API_PROVIDERS, AI_API_PROVIDER_IDS, type AiApiProvider } from "./aiApi";

/**
 * Cách chạy AI: "auto" = CLI trên desktop rồi tự chuyển sang API khi CLI lỗi
 * (mobile luôn dùng API); "cli" = chỉ CLI local; "api" = chỉ API key.
 */
export type AiMode = "auto" | "cli" | "api";

export interface VocabForgeSettings {
	cardsFolder: string;
	newPerDay: number;
	requestRetention: number;
	ttsRate: number;
	ttsVoice: string;
	dailyReviewGoal: number;
	dailyNewGoal: number;
	dailyPracticeGoal: number;
	highlightEnabled: boolean;
	grokPath: string;
	aiProvider: AiCliProvider;
	claudePath: string;
	codexPath: string;
	geminiPath: string;
	aiMode: AiMode;
	/** Nhà cung cấp đang chọn khi chạy qua API */
	apiProvider: AiApiProvider;
	/** API key theo từng nhà cung cấp — lưu plaintext trong data.json của vault */
	apiKeys: Record<AiApiProvider, string>;
	/** Model theo từng nhà cung cấp; rỗng = model mặc định */
	apiModels: Record<AiApiProvider, string>;
	learningGoal: LearningGoal;
	dailyMinutes: number;
	errorNotebookPath: string;
	voiceLocale: string;
	reverseEnabled: boolean;
	/** Giờ nhắc học hằng ngày (0-23), -1 = tắt */
	reminderHour: number;
}

export const DEFAULT_SETTINGS: VocabForgeSettings = {
	cardsFolder: "5. Toolbox/English/Cards",
	newPerDay: 10,
	requestRetention: 0.9,
	ttsRate: 0.95,
	ttsVoice: "",
	dailyReviewGoal: 20,
	dailyNewGoal: 5,
	dailyPracticeGoal: 10,
	highlightEnabled: true,
	grokPath: "grok",
	aiProvider: "auto",
	claudePath: "claude",
	codexPath: "codex",
	geminiPath: "gemini",
	aiMode: "auto",
	apiProvider: "deepseek",
	apiKeys: Object.fromEntries(AI_API_PROVIDER_IDS.map((p) => [p, ""])) as Record<AiApiProvider, string>,
	apiModels: Object.fromEntries(
		AI_API_PROVIDER_IDS.map((p) => [p, AI_API_PROVIDERS[p].defaultModel])
	) as Record<AiApiProvider, string>,
	learningGoal: "business",
	dailyMinutes: 10,
	errorNotebookPath: "5. Toolbox/English/My English Errors.md",
	voiceLocale: "en-US",
	reverseEnabled: true,
	reminderHour: 20,
};

export type AiCliProvider = "auto" | "grok" | "claude" | "codex" | "gemini";

export type LearningGoal =
	| "business"
	| "daily"
	| "ielts"
	| "content"
	| "ai-tech"
	| "cambridge";

export type CardType =
	| "word"
	| "phrase"
	| "idiom"
	| "collocation"
	| "sentence"
	| "passage"
	| "grammar";

export const DEFAULT_CATEGORIES = [
	"business",
	"startup",
	"content",
	"casual",
	"ielts",
	"idiom",
	"cambridge-c1",
	"cambridge-c2",
	"cambridge-c3",
	"general",
] as const;

export const CATEGORY_EMOJI: Record<string, string> = {
	business: "💼",
	startup: "🚀",
	content: "📱",
	casual: "💬",
	ielts: "🎓",
	idiom: "🧩",
	"ai-tech": "🤖",
	"cambridge-c1": "🧒",
	"cambridge-c2": "🧑‍🎓",
	"cambridge-c3": "🎓",
	general: "📦",
};

export function categoryEmoji(cat: string): string {
	return CATEGORY_EMOJI[cat] ?? "🏷️";
}

export interface VocabCard {
	file: TFile;
	word: string;
	type: CardType;
	category: string;
	ipa: string;
	meaningEn: string;
	meaningVi: string;
	collocations: string[];
	quote: string;
	source: string;
	sourceUrl: string;
	image: string;
	myExample: string;
	mnemonic: string;
	grammarNote: string;
	forms: string[];
	fsrs: FsrsCard;
	/** Trạng thái FSRS chiều ngược VI→EN (production) */
	fsrsRev: FsrsCard;
}

/** Một lượt ôn: thẻ + chiều học. fwd = EN→nghĩa, rev = nghĩa→EN */
export type ReviewDir = "fwd" | "rev";
export interface ReviewEntry {
	card: VocabCard;
	dir: ReviewDir;
}

/** Thống kê theo ngày, key = YYYY-MM-DD (giờ địa phương) */
export interface DailyStat {
	reviews: number;
	newCards: number;
	practice?: number;
	/** Lượt ôn thẻ Review/Relearning trả lời KHÔNG phải "Quên" (để tính retention) */
	pass?: number;
	/** Lượt ôn thẻ Review/Relearning trả lời "Quên" */
	fail?: number;
}

export interface StoryCache {
	date: string;
	words: string[];
	en: string;
	vi: string;
}

export interface VocabForgeData {
	settings: VocabForgeSettings;
	stats: Record<string, DailyStat>;
	xp: number;
	freezes: number;
	frozenDays: string[];
	questRewardDates: string[];
	story: StoryCache | null;
	/** badge id → ngày đạt (YYYY-MM-DD) */
	badges: Record<string, string>;
	/** ngày cuối đã bắn reminder */
	lastReminder: string;
	/** Tiến độ các kỹ năng production, cập nhật từ dictation/shadowing/writing. */
	skillStats: Record<LearningSkill, SkillStat>;
}

export type LearningSkill = "memory" | "listening" | "speaking" | "writing";

export interface SkillStat {
	attempts: number;
	totalScore: number;
	lastAt: string;
	/** Exponentially weighted recent score, so the Coach reacts to improvement quickly. */
	recentScore?: number;
}

/** Mỗi level cần 300 XP */
export const XP_PER_LEVEL = 300;
export const MAX_FREEZES = 3;

export function todayKey(d = new Date()): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

export function endOfToday(): Date {
	const d = new Date();
	d.setHours(23, 59, 59, 999);
	return d;
}
