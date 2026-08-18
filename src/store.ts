import { App, Notice, TFile, TFolder, normalizePath } from "obsidian";
import { createEmptyCard } from "ts-fsrs";
import { fsrsFromFrontmatter, fsrsToFrontmatter, State, type FsrsCard } from "./srs";
import { endOfToday, type CardType, type VocabCard, type VocabForgeSettings } from "./types";

export interface NewCardInput {
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
}

export class CardStore {
	constructor(
		private app: App,
		private getSettings: () => VocabForgeSettings
	) {}

	private get folder(): string {
		return normalizePath(this.getSettings().cardsFolder);
	}

	/** Đọc toàn bộ thẻ trong folder (dựa vào metadataCache nên rất nhanh) */
	getAllCards(): VocabCard[] {
		const folder = this.folder + "/";
		const cards: VocabCard[] = [];
		for (const file of this.app.vault.getMarkdownFiles()) {
			if (!file.path.startsWith(folder)) continue;
			const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (!fm || fm.word == null) continue;
			cards.push(this.parseCard(file, fm));
		}
		return cards;
	}

	private parseCard(file: TFile, fm: Record<string, unknown>): VocabCard {
		const str = (v: unknown): string => (v == null ? "" : String(v));
		const list = (v: unknown): string[] => {
			if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
			if (typeof v === "string" && v.trim())
				return v.split(",").map((s) => s.trim()).filter(Boolean);
			return [];
		};
		return {
			file,
			word: str(fm.word) || file.basename,
			type: (str(fm.type) || "word") as CardType,
			category: str(fm.category).toLowerCase().trim() || "general",
			ipa: str(fm.ipa),
			meaningEn: str(fm.meaning_en),
			meaningVi: str(fm.meaning_vi),
			collocations: list(fm.collocations),
			quote: str(fm.quote),
			source: str(fm.source),
			sourceUrl: str(fm.source_url),
			image: str(fm.image),
			myExample: str(fm.my_example),
			mnemonic: str(fm.mnemonic),
			grammarNote: str(fm.grammar_note),
			fsrs: fsrsFromFrontmatter(fm),
		};
	}

	/** Ghi một field phụ (my_example / mnemonic / grammar_note) vào frontmatter thẻ */
	async saveExtraField(
		card: VocabCard,
		key: "my_example" | "mnemonic" | "grammar_note",
		value: string
	): Promise<void> {
		if (key === "my_example") card.myExample = value;
		else if (key === "mnemonic") card.mnemonic = value;
		else card.grammarNote = value;
		await this.app.fileManager.processFrontMatter(card.file, (fm) => {
			fm[key] = value;
		});
	}

	/** Thẻ đến hạn ôn hôm nay (đã từng học), xếp theo hạn gần nhất trước */
	getDueCards(): VocabCard[] {
		const cutoff = endOfToday().getTime();
		return this.getAllCards()
			.filter((c) => c.fsrs.state !== State.New && c.fsrs.due.getTime() <= cutoff)
			.sort((a, b) => a.fsrs.due.getTime() - b.fsrs.due.getTime());
	}

	/** Thẻ chưa học bao giờ, cũ trước mới sau */
	getNewCards(): VocabCard[] {
		return this.getAllCards()
			.filter((c) => c.fsrs.state === State.New)
			.sort((a, b) => a.file.stat.ctime - b.file.stat.ctime);
	}

	/** Ghi trạng thái FSRS mới vào frontmatter của thẻ */
	async saveFsrs(card: VocabCard, next: FsrsCard): Promise<void> {
		card.fsrs = next;
		await this.app.fileManager.processFrontMatter(card.file, (fm) => {
			fsrsToFrontmatter(next, fm);
		});
	}

	/** Tạo file thẻ mới trong folder thẻ. Trả về TFile vừa tạo. */
	async createCard(input: NewCardInput): Promise<TFile> {
		await this.ensureFolder();
		const base = sanitizeFilename(input.word) || "card";
		let path = normalizePath(`${this.folder}/${base}.md`);
		let i = 1;
		while (this.app.vault.getAbstractFileByPath(path)) {
			path = normalizePath(`${this.folder}/${base} ${++i}.md`);
		}
		const empty = createEmptyCard(new Date());
		const yaml = buildCardYaml(input, empty);
		const body = `\n> [!quote] Ngữ cảnh\n> ${input.quote || "_(chưa có)_"}\n\nNguồn: ${input.source || "_(chưa rõ)_"}\n`;
		const file = await this.app.vault.create(path, yaml + body);
		return file;
	}

	async ensureFolder(): Promise<void> {
		const parts = this.folder.split("/");
		let cur = "";
		for (const p of parts) {
			cur = cur ? `${cur}/${p}` : p;
			const existing = this.app.vault.getAbstractFileByPath(cur);
			if (!existing) {
				try {
					await this.app.vault.createFolder(cur);
				} catch (e) {
					// folder có thể vừa được tạo bởi sync — bỏ qua
				}
			} else if (!(existing instanceof TFolder)) {
				new Notice(`Vocab Forge: "${cur}" đã tồn tại nhưng không phải folder`);
				throw new Error("cards folder path conflict");
			}
		}
	}
}

export function sanitizeFilename(name: string): string {
	return name
		.replace(/[\\/:*?"<>|#^[\]{}]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 80);
}

function yamlStr(s: string): string {
	return JSON.stringify(s ?? "");
}

function buildCardYaml(input: NewCardInput, fsrsCard: FsrsCard): string {
	const collo = input.collocations.length
		? `[${input.collocations.map((c) => yamlStr(c)).join(", ")}]`
		: "[]";
	return [
		"---",
		"tags: [vocab-card]",
		`word: ${yamlStr(input.word)}`,
		`type: ${input.type}`,
		`category: ${yamlStr((input.category || "general").toLowerCase().trim())}`,
		`ipa: ${yamlStr(input.ipa)}`,
		`meaning_en: ${yamlStr(input.meaningEn)}`,
		`meaning_vi: ${yamlStr(input.meaningVi)}`,
		`collocations: ${collo}`,
		`quote: ${yamlStr(input.quote)}`,
		`source: ${yamlStr(input.source)}`,
		`source_url: ${yamlStr(input.sourceUrl)}`,
		`image: ${yamlStr(input.image)}`,
		`created: ${new Date().toISOString().slice(0, 10)}`,
		`srs_due: ${yamlStr(fsrsCard.due.toISOString())}`,
		"srs_stability: 0",
		"srs_difficulty: 0",
		"srs_elapsed_days: 0",
		"srs_scheduled_days: 0",
		"srs_reps: 0",
		"srs_lapses: 0",
		"srs_learning_steps: 0",
		"srs_state: 0",
		'srs_last_review: ""',
		"---",
	].join("\n") + "\n";
}
