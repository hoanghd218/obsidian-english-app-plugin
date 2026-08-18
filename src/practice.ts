import { State } from "./srs";
import type { VocabCard } from "./types";

export type PracticeMode = "cloze" | "typing" | "builder" | "choice";

export const MODE_INFO: Record<PracticeMode, { icon: string; name: string; desc: string }> = {
	cloze: {
		icon: "🧩",
		name: "Điền khuyết (Cloze)",
		desc: "Câu thật từ video bị che từ — điền lại từ còn thiếu",
	},
	typing: {
		icon: "⌨️",
		name: "Gõ từ (Recall)",
		desc: "Nhìn nghĩa Việt + gợi ý → gõ đúng từ tiếng Anh",
	},
	builder: {
		icon: "🔀",
		name: "Xếp câu (Builder)",
		desc: "Xáo trộn câu quote — bấm xếp lại đúng thứ tự",
	},
	choice: {
		icon: "✅",
		name: "Trắc nghiệm (Choice)",
		desc: "Chọn nghĩa đúng trong 4 đáp án",
	},
};

export interface ClozeItem {
	mode: "cloze";
	card: VocabCard;
	pre: string;
	surface: string; // đúng dạng xuất hiện trong quote
	post: string;
}
export interface TypingItem {
	mode: "typing";
	card: VocabCard;
}
export interface BuilderItem {
	mode: "builder";
	card: VocabCard;
	tokens: string[]; // thứ tự đúng
	shuffled: string[];
}
export interface ChoiceItem {
	mode: "choice";
	card: VocabCard;
	options: string[]; // 4 nghĩa, có 1 đúng
	correctIndex: number;
}
export type PracticeItem = ClozeItem | TypingItem | BuilderItem | ChoiceItem;

// ---------------------------------------------------------------- helpers

const normalize = (s: string): string =>
	s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();

function editDistance(a: string, b: string): number {
	const dp: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		let prev = dp[0];
		dp[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const tmp = dp[j];
			dp[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev, dp[j], dp[j - 1]) + 1;
			prev = tmp;
		}
	}
	return dp[b.length];
}

/** So khớp mềm: đúng tuyệt đối, hoặc lệch 1 ký tự với đáp án dài > 4 ký tự */
export function fuzzyEqual(input: string, answers: string[]): boolean {
	const inp = normalize(input);
	if (!inp) return false;
	for (const ans of answers) {
		const a = normalize(ans);
		if (!a) continue;
		if (inp === a) return true;
		if (a.length > 4 && editDistance(inp, a) <= 1) return true;
	}
	return false;
}

export function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

export function sample<T>(arr: T[], n: number): T[] {
	return shuffle(arr).slice(0, n);
}

/** Tìm dạng xuất hiện của `word` trong `quote` (chấp nhận biến thể đuôi s/ed/ing ở từ cuối) */
function findSurface(quote: string, word: string): { pre: string; surface: string; post: string } | null {
	const tokens = word.trim().split(/\s+/);
	const tryPatterns: string[] = [];
	const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	if (tokens.length <= 6) {
		const flexLast = tokens
			.map((t, i) => (i === tokens.length - 1 ? `${esc(t)}(?:s|es|ed|d|ing)?` : esc(t)))
			.join("\\s+");
		tryPatterns.push(flexLast);
	}
	// fallback: token dài nhất của cụm
	const longest = [...tokens].sort((a, b) => b.length - a.length)[0];
	if (longest && longest.length > 3) tryPatterns.push(`${esc(longest)}(?:s|es|ed|d|ing)?`);
	for (const p of tryPatterns) {
		const m = quote.match(new RegExp(`(^|[^A-Za-z])(${p})($|[^A-Za-z])`, "i"));
		if (m && m.index != null) {
			const start = m.index + m[1].length;
			const surface = m[2];
			return { pre: quote.slice(0, start), surface, post: quote.slice(start + surface.length) };
		}
	}
	return null;
}

// ---------------------------------------------------------------- builders

export function makeCloze(card: VocabCard): ClozeItem | null {
	if (!card.quote) return null;
	const hit = findSurface(card.quote, card.word);
	if (!hit) return null;
	return { mode: "cloze", card, ...hit };
}

export function makeTyping(card: VocabCard): TypingItem | null {
	if (card.type === "sentence" || card.type === "passage" || card.type === "grammar") return null;
	if (!card.meaningVi && !card.meaningEn) return null;
	return { mode: "typing", card };
}

const MAX_BUILDER_TOKENS = 14;

export function makeBuilder(card: VocabCard): BuilderItem | null {
	const text = card.quote || card.word;
	let tokens = text.split(/\s+/).filter(Boolean);
	if (tokens.length < 4) return null;
	if (tokens.length > MAX_BUILDER_TOKENS) {
		// cắt cửa sổ quanh từ mục tiêu
		const firstWord = normalize(card.word).split(" ")[0];
		let center = tokens.findIndex((t) => normalize(t).includes(firstWord));
		if (center === -1) center = Math.floor(tokens.length / 2);
		const start = Math.max(0, Math.min(center - Math.floor(MAX_BUILDER_TOKENS / 2), tokens.length - MAX_BUILDER_TOKENS));
		tokens = tokens.slice(start, start + MAX_BUILDER_TOKENS);
	}
	let shuffled = shuffle(tokens);
	let guard = 0;
	while (shuffled.join(" ") === tokens.join(" ") && guard++ < 5) shuffled = shuffle(tokens);
	return { mode: "builder", card, tokens, shuffled };
}

export function makeChoice(card: VocabCard, pool: VocabCard[]): ChoiceItem | null {
	if (card.type === "sentence" || card.type === "passage" || card.type === "grammar") return null;
	const answer = card.meaningVi || card.meaningEn;
	if (!answer) return null;
	const sameCat = pool.filter((c) => c !== card && c.category === card.category);
	const others = pool.filter((c) => c !== card && c.category !== card.category);
	const distractors: string[] = [];
	for (const c of [...shuffle(sameCat), ...shuffle(others)]) {
		const m = c.meaningVi || c.meaningEn;
		if (m && m !== answer && !distractors.includes(m)) distractors.push(m);
		if (distractors.length === 3) break;
	}
	if (distractors.length < 3) return null;
	const options = shuffle([answer, ...distractors]);
	return { mode: "choice", card, options, correctIndex: options.indexOf(answer) };
}

/** Chọn thẻ cho phiên luyện: ưu tiên thẻ đã học, thiếu thì bổ sung thẻ mới */
export function buildPracticeQueue(
	mode: PracticeMode,
	cards: VocabCard[],
	size: number
): PracticeItem[] {
	const learned = cards.filter((c) => c.fsrs.state !== State.New);
	const fresh = cards.filter((c) => c.fsrs.state === State.New);
	const ordered = [...shuffle(learned), ...shuffle(fresh)];
	const items: PracticeItem[] = [];
	for (const card of ordered) {
		let item: PracticeItem | null = null;
		if (mode === "cloze") item = makeCloze(card);
		else if (mode === "typing") item = makeTyping(card);
		else if (mode === "builder") item = makeBuilder(card);
		else item = makeChoice(card, cards);
		if (item) items.push(item);
		if (items.length === size) break;
	}
	return items;
}
