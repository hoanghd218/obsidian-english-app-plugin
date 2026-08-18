import { TFile } from "obsidian";
import type { Card as FsrsCard } from "ts-fsrs";

export interface VocabForgeSettings {
	cardsFolder: string;
	newPerDay: number;
	requestRetention: number;
	ttsRate: number;
	ttsVoice: string;
}

export const DEFAULT_SETTINGS: VocabForgeSettings = {
	cardsFolder: "5. Toolbox/English/Cards",
	newPerDay: 10,
	requestRetention: 0.9,
	ttsRate: 0.95,
	ttsVoice: "",
};

export type CardType = "word" | "phrase" | "idiom" | "collocation" | "sentence" | "passage";

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
	fsrs: FsrsCard;
}

/** Thống kê theo ngày, key = YYYY-MM-DD (giờ địa phương) */
export interface DailyStat {
	reviews: number;
	newCards: number;
	practice?: number;
}

export interface VocabForgeData {
	settings: VocabForgeSettings;
	stats: Record<string, DailyStat>;
}

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
