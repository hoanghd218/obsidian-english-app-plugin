import { TFile } from "obsidian";
import type { Card as FsrsCard } from "ts-fsrs";

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
	reverseEnabled: boolean;
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
	reverseEnabled: true,
};

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
