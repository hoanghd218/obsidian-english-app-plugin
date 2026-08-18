import { App, Modal, Notice, Setting, TFile } from "obsidian";
import type VocabForgePlugin from "./main";
import type { NewCardInput } from "./store";
import { DEFAULT_CATEGORIES, type CardType } from "./types";

export interface AddCardPrefill {
	word?: string;
	quote?: string;
	source?: string;
	sourceUrl?: string;
	type?: CardType;
	category?: string;
}

export class AddCardModal extends Modal {
	private input: NewCardInput = {
		word: "",
		type: "word",
		category: "general",
		ipa: "",
		meaningEn: "",
		meaningVi: "",
		collocations: [],
		quote: "",
		source: "",
		sourceUrl: "",
		image: "",
	};

	constructor(app: App, private plugin: VocabForgePlugin, prefill?: AddCardPrefill) {
		super(app);
		if (prefill) {
			this.input.word = prefill.word ?? "";
			this.input.quote = prefill.quote ?? "";
			this.input.source = prefill.source ?? "";
			this.input.sourceUrl = prefill.sourceUrl ?? "";
			if (prefill.type) this.input.type = prefill.type;
			if (prefill.category) this.input.category = prefill.category;
		}
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("vf-add-modal");
		contentEl.createEl("h3", { text: "＋ Thêm thẻ Vocab Forge" });

		new Setting(contentEl)
			.setName("Từ / cụm / câu / đoạn")
			.setDesc("Nội dung tiếng Anh cần học — mặt trước của thẻ")
			.addTextArea((t) => {
				t.setValue(this.input.word).onChange((v) => (this.input.word = v));
				t.inputEl.rows = 2;
				t.inputEl.addClass("vf-input-wide");
			});

		new Setting(contentEl).setName("Loại thẻ").addDropdown((d) => {
			d.addOption("word", "Từ (word)")
				.addOption("phrase", "Cụm từ (phrase)")
				.addOption("idiom", "Thành ngữ (idiom)")
				.addOption("collocation", "Collocation")
				.addOption("sentence", "Câu (sentence)")
				.addOption("passage", "Đoạn ngắn (passage)")
				.addOption("grammar", "Ngữ pháp (grammar)")
				.setValue(this.input.type)
				.onChange((v) => (this.input.type = v as CardType));
		});

		new Setting(contentEl)
			.setName("Chủ đề (deck)")
			.setDesc("Thẻ được nhóm theo chủ đề trên trang Bộ thẻ — chọn có sẵn hoặc gõ mới")
			.addDropdown((d) => {
				const cats = new Set<string>(DEFAULT_CATEGORIES);
				for (const c of this.plugin.store.getAllCards()) cats.add(c.category);
				for (const c of [...cats].sort()) d.addOption(c, c);
				if (!cats.has(this.input.category)) d.addOption(this.input.category, this.input.category);
				d.setValue(this.input.category).onChange((v) => (this.input.category = v));
			})
			.addText((t) =>
				t.setPlaceholder("hoặc gõ chủ đề mới…").onChange((v) => {
					if (v.trim()) this.input.category = v.trim().toLowerCase();
				})
			);

		new Setting(contentEl)
			.setName("IPA")
			.setDesc("Phiên âm, ví dụ /ˈdʌbəl daʊn/ — bỏ trống nếu là câu/đoạn")
			.addText((t) => t.setValue(this.input.ipa).onChange((v) => (this.input.ipa = v)));

		new Setting(contentEl)
			.setName("Nghĩa Anh–Anh")
			.setDesc("Định nghĩa bằng tiếng Anh đơn giản")
			.addTextArea((t) => {
				t.setValue(this.input.meaningEn).onChange((v) => (this.input.meaningEn = v));
				t.inputEl.rows = 2;
				t.inputEl.addClass("vf-input-wide");
			});

		new Setting(contentEl)
			.setName("Nghĩa tiếng Việt")
			.addTextArea((t) => {
				t.setValue(this.input.meaningVi).onChange((v) => (this.input.meaningVi = v));
				t.inputEl.rows = 2;
				t.inputEl.addClass("vf-input-wide");
			});

		new Setting(contentEl)
			.setName("Quote — câu ngữ cảnh thật")
			.setDesc("Câu chứa từ này, trích từ video/bài gốc")
			.addTextArea((t) => {
				t.setValue(this.input.quote).onChange((v) => (this.input.quote = v));
				t.inputEl.rows = 2;
				t.inputEl.addClass("vf-input-wide");
			});

		new Setting(contentEl)
			.setName("Collocations")
			.setDesc("Các cụm đi kèm, cách nhau dấu phẩy")
			.addText((t) =>
				t.onChange((v) => {
					this.input.collocations = v.split(",").map((s) => s.trim()).filter(Boolean);
				})
			);

		const sourceSetting = new Setting(contentEl)
			.setName("Nguồn")
			.setDesc("Wikilink note gốc, vd [[Tên clip]]")
			.addText((t) => {
				t.setValue(this.input.source).onChange((v) => (this.input.source = v));
				this.sourceText = t.inputEl;
			});
		sourceSetting.addButton((b) =>
			b.setButtonText("Dùng note đang mở").onClick(() => {
				const f = this.app.workspace.getActiveFile();
				if (!f) {
					new Notice("Không có note nào đang mở");
					return;
				}
				this.fillFromFile(f);
			})
		);

		new Setting(contentEl)
			.setName("Link video (kèm timestamp nếu có)")
			.addText((t) => {
				t.setValue(this.input.sourceUrl).onChange((v) => (this.input.sourceUrl = v));
				this.urlText = t.inputEl;
			});

		new Setting(contentEl)
			.setName("Ảnh minh hoạ")
			.setDesc("URL hoặc đường dẫn/wikilink ảnh trong vault")
			.addText((t) => t.setValue(this.input.image).onChange((v) => (this.input.image = v)));

		new Setting(contentEl).addButton((b) =>
			b
				.setButtonText("Tạo thẻ")
				.setCta()
				.onClick(() => void this.submit())
		);
	}

	private sourceText: HTMLInputElement | null = null;
	private urlText: HTMLInputElement | null = null;

	private fillFromFile(f: TFile): void {
		this.input.source = `[[${f.basename}]]`;
		if (this.sourceText) this.sourceText.value = this.input.source;
		const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
		const url = fm?.source ?? fm?.source_url ?? "";
		if (typeof url === "string" && /^https?:\/\//.test(url)) {
			this.input.sourceUrl = url;
			if (this.urlText) this.urlText.value = url;
		}
	}

	private async submit(): Promise<void> {
		if (!this.input.word.trim()) {
			new Notice("Chưa nhập nội dung cần học");
			return;
		}
		this.input.word = this.input.word.trim();
		try {
			const file = await this.plugin.store.createCard(this.input);
			new Notice(`✅ Đã tạo thẻ: ${file.basename}`);
			this.plugin.refreshStatusBar();
			this.close();
		} catch (e) {
			console.error("Vocab Forge: lỗi tạo thẻ", e);
			new Notice("Không tạo được thẻ — xem console");
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
