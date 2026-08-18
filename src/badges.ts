import { State } from "./srs";
import { XP_PER_LEVEL, type VocabCard, type VocabForgeData } from "./types";

export interface BadgeCtx {
	data: VocabForgeData;
	cards: VocabCard[];
	streak: number;
}

export interface BadgeDef {
	id: string;
	icon: string;
	name: string;
	desc: string;
	check(ctx: BadgeCtx): boolean;
}

const totalReviews = (d: VocabForgeData) =>
	Object.values(d.stats).reduce((s, x) => s + x.reviews, 0);
const totalPractice = (d: VocabForgeData) =>
	Object.values(d.stats).reduce((s, x) => s + (x.practice ?? 0), 0);
const learned = (cards: VocabCard[]) => cards.filter((c) => c.fsrs.state !== State.New).length;
const level = (d: VocabForgeData) => Math.floor(d.xp / XP_PER_LEVEL) + 1;

export const BADGES: BadgeDef[] = [
	{ id: "first-review", icon: "🌱", name: "Khởi đầu", desc: "Lượt ôn đầu tiên", check: (c) => totalReviews(c.data) >= 1 },
	{ id: "reviews-100", icon: "💯", name: "Trăm trận", desc: "100 lượt ôn", check: (c) => totalReviews(c.data) >= 100 },
	{ id: "reviews-1000", icon: "🏛️", name: "Nghìn trận", desc: "1.000 lượt ôn", check: (c) => totalReviews(c.data) >= 1000 },
	{ id: "streak-7", icon: "🔥", name: "Tuần lửa", desc: "Chuỗi 7 ngày liên tục", check: (c) => c.streak >= 7 },
	{ id: "streak-30", icon: "⚡", name: "Tháng thép", desc: "Chuỗi 30 ngày liên tục", check: (c) => c.streak >= 30 },
	{ id: "learned-50", icon: "📖", name: "Ngũ thập", desc: "Đã học 50 thẻ", check: (c) => learned(c.cards) >= 50 },
	{ id: "learned-200", icon: "🎓", name: "Học giả", desc: "Đã học 200 thẻ", check: (c) => learned(c.cards) >= 200 },
	{ id: "level-5", icon: "⭐", name: "Level 5", desc: "Đạt level 5", check: (c) => level(c.data) >= 5 },
	{ id: "level-10", icon: "🌟", name: "Level 10", desc: "Đạt level 10", check: (c) => level(c.data) >= 10 },
	{ id: "quests-7", icon: "🏆", name: "Chiến binh nhiệm vụ", desc: "Hoàn thành nhiệm vụ ngày 7 lần", check: (c) => c.data.questRewardDates.length >= 7 },
	{ id: "practice-500", icon: "🎯", name: "Thiện xạ", desc: "500 câu luyện tập", check: (c) => totalPractice(c.data) >= 500 },
	{ id: "decks-5", icon: "🗂️", name: "Nhà sưu tầm", desc: "5 deck có ≥ 5 thẻ", check: (c) => {
		const m = new Map<string, number>();
		for (const card of c.cards) m.set(card.category, (m.get(card.category) ?? 0) + 1);
		return [...m.values()].filter((n) => n >= 5).length >= 5;
	} },
];

/** Trả về các badge vừa đạt (chưa có trong data.badges) và ghi nhận ngày đạt */
export function checkBadges(ctx: BadgeCtx, todayKey: string): BadgeDef[] {
	const fresh: BadgeDef[] = [];
	for (const b of BADGES) {
		if (ctx.data.badges[b.id]) continue;
		try {
			if (b.check(ctx)) {
				ctx.data.badges[b.id] = todayKey;
				fresh.push(b);
			}
		} catch {
			// bỏ qua badge lỗi
		}
	}
	return fresh;
}
