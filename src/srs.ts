import {
	createEmptyCard,
	fsrs,
	generatorParameters,
	Rating,
	State,
	type Card as FsrsCard,
	type FSRS,
	type Grade,
} from "ts-fsrs";

export { Rating, State };
export type { FsrsCard, Grade };

export function makeScheduler(requestRetention: number): FSRS {
	return fsrs(
		generatorParameters({
			request_retention: requestRetention,
			enable_fuzz: true,
		})
	);
}

/** Đọc trạng thái FSRS từ frontmatter (thiếu field nào thì coi là thẻ mới). prefix: "srs_" (xuôi) hoặc "srs_rev_" (VI→EN) */
export function fsrsFromFrontmatter(fm: Record<string, unknown>, prefix = "srs_"): FsrsCard {
	const empty = createEmptyCard(new Date());
	if (fm[`${prefix}due`] == null) return empty;
	const num = (v: unknown, fallback: number) =>
		typeof v === "number" && isFinite(v) ? v : fallback;
	const date = (v: unknown): Date | undefined => {
		if (typeof v !== "string" && !(v instanceof Date)) return undefined;
		const d = new Date(v as string | Date);
		return isNaN(d.getTime()) ? undefined : d;
	};
	return {
		...empty,
		due: date(fm[`${prefix}due`]) ?? empty.due,
		stability: num(fm[`${prefix}stability`], 0),
		difficulty: num(fm[`${prefix}difficulty`], 0),
		elapsed_days: num(fm[`${prefix}elapsed_days`], 0),
		scheduled_days: num(fm[`${prefix}scheduled_days`], 0),
		reps: num(fm[`${prefix}reps`], 0),
		lapses: num(fm[`${prefix}lapses`], 0),
		learning_steps: num(fm[`${prefix}learning_steps`], 0),
		state: num(fm[`${prefix}state`], State.New) as State,
		last_review: date(fm[`${prefix}last_review`]),
	};
}

/** Ghi trạng thái FSRS vào object frontmatter (mutate tại chỗ, dùng trong processFrontMatter) */
export function fsrsToFrontmatter(card: FsrsCard, fm: Record<string, unknown>, prefix = "srs_"): void {
	fm[`${prefix}due`] = card.due.toISOString();
	fm[`${prefix}stability`] = round4(card.stability);
	fm[`${prefix}difficulty`] = round4(card.difficulty);
	fm[`${prefix}elapsed_days`] = card.elapsed_days;
	fm[`${prefix}scheduled_days`] = card.scheduled_days;
	fm[`${prefix}reps`] = card.reps;
	fm[`${prefix}lapses`] = card.lapses;
	fm[`${prefix}learning_steps`] = card.learning_steps;
	fm[`${prefix}state`] = card.state;
	fm[`${prefix}last_review`] = card.last_review ? card.last_review.toISOString() : "";
}

function round4(n: number): number {
	return Math.round(n * 10000) / 10000;
}

/** Diễn giải khoảng cách thời gian đến `due` thành chuỗi ngắn: <10p, 3 giờ, 5 ngày, 2.1 th, 1.5 năm */
export function formatInterval(from: Date, due: Date): string {
	const mins = Math.max(1, Math.round((due.getTime() - from.getTime()) / 60000));
	if (mins < 60) return `${mins} ph`;
	const hours = mins / 60;
	if (hours < 24) return `${Math.round(hours)} giờ`;
	const days = hours / 24;
	if (days < 30) return `${Math.round(days)} ngày`;
	const months = days / 30.44;
	if (months < 12) return `${months.toFixed(1)} th`;
	return `${(days / 365.25).toFixed(1)} năm`;
}
