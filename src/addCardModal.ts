import { App, Modal, Notice, Setting, TFile } from "obsidian";
import type VocabForgePlugin from "./main";
import type { NewCardInput } from "./store";
import { DEFAULT_CATEGORIES, type CardType } from "./types";
import { cardFillPrompt, extractJson, runGrok, type CardFill } from "./ai";

export interface AddCardPrefill {
	word?: string;
	quote?: string;
	source?: string;
	sourceUrl?: string;
	type?: CardType;
	category?: string;
}

type Mode = "auto" | "manual";

export class AddCardModal extends Modal {
	private mode: Mode = "auto";
	private aiFilled = false;
	private aiBusy = false;
	private makeImage = true;

	private input: NewCardInput = {
		word: "",
		type: "word",
		category: "general",
		ipa: "",
		meaningEn: "",
		meaningVi: "",
		collocations: [],
		forms: [],
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
			if (prefill.word) this.mode = "manual"; // bôi đen từ note → thường muốn tự điền nguồn thủ công
		}
	}

	onOpen(): void {
		this.display();
	}

	private display(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("vf-add-modal");
		contentEl.createEl("h3", { text: "＋ Thêm thẻ Vocab Forge" });

		// --- chuyển chế độ
		const seg = contentEl.createDiv({ cls: "vf-mode-seg" });
		const autoBtn = seg.createEl("button", {
			text: "🤖 Tự động (AI)",
			cls: `vf-seg-btn ${this.mode === "auto" ? "vf-seg-on" : ""}`,
		});
		const manualBtn = seg.createEl("button", {
			text: "📝 Thủ công",
			cls: `vf-seg-btn ${this.mode === "manual" ? "vf-seg-on" : ""}`,
		});
		autoBtn.onclick = () => { this.mode = "auto"; this.display(); };
		manualBtn.onclick = () => { this.mode = "manual"; this.display(); };

		if (this.mode === "auto" && !this.aiFilled) {
			this.displayAutoEntry(contentEl);
			return;
		}
		this.displayForm(contentEl);
	}

	// --- chế độ tự động: chỉ nhập từ, AI điền hết
	private displayAutoEntry(contentEl: HTMLElement): void {
		contentEl.createDiv({
			text: "Nhập từ / cụm từ — Grok sẽ tự điền IPA, nghĩa Anh–Việt, ví dụ, collocations, word family, chủ đề và (tuỳ chọn) sinh ảnh minh hoạ.",
			cls: "vf-muted vf-auto-desc",
		});
		const input = contentEl.createEl("input", {
			cls: "vf-practice-input vf-auto-input",
			attr: { type: "text", placeholder: 'vd: "double down", "move the needle"…', spellcheck: "false" },
		});
		input.value = this.input.word;
		input.oninput = () => (this.input.word = input.value);
		input.onkeydown = (e) => {
			if (e.key === "Enter") void this.aiFill();
		};

		new Setting(contentEl)
			.setName("🖼 Sinh ảnh minh hoạ sau khi tạo thẻ")
			.setDesc("Grok Imagine, chạy nền ~1 phút")
			.addToggle((t) => t.setValue(this.makeImage).onChange((v) => (this.makeImage = v)));

		const btn = contentEl.createEl("button", {
			text: this.aiBusy ? "⏳ AI đang tra cứu…" : "✨ AI điền tất cả",
			cls: "vf-btn-hero vf-btn-hero-small vf-auto-go",
		});
		btn.disabled = this.aiBusy;
		btn.onclick = () => void this.aiFill();
		window.setTimeout(() => input.focus(), 30);
	}

	private async aiFill(): Promise<void> {
		const word = this.input.word.trim();
		if (!word) {
			new Notice("Nhập từ/cụm từ trước đã");
			return;
		}
		if (this.aiBusy) return;
		this.aiBusy = true;
		this.display();
		try {
			const raw = await runGrok(cardFillPrompt(word), this.plugin.settings.grokPath, 120_000);
			const fill = extractJson<CardFill>(raw);
			if (!fill) throw new Error("bad json");
			this.input.word = word;
			this.input.type = (["word", "phrase", "idiom", "collocation"].includes(fill.type)
				? fill.type
				: "phrase") as CardType;
			this.input.ipa = fill.ipa ?? "";
			this.input.meaningEn = fill.meaning_en ?? "";
			this.input.meaningVi = fill.meaning_vi ?? "";
			this.input.collocations = Array.isArray(fill.collocations) ? fill.collocations : [];
			this.input.forms = Array.isArray(fill.forms) ? fill.forms : [];
			this.input.quote = fill.example ?? "";
			this.input.category = (fill.category || "general").toLowerCase();
			this.aiFilled = true;
			new Notice("✨ AI đã điền xong — kiểm tra rồi bấm Tạo thẻ");
		} catch (e) {
			console.error("Vocab Forge AI fill:", e);
			new Notice("AI điền thất bại — thử lại hoặc dùng chế độ thủ công");
		} finally {
			this.aiBusy = false;
			this.display();
		}
	}

	// --- form đầy đủ (thủ công, hoặc review sau khi AI điền)
	private displayForm(contentEl: HTMLElement): void {
		if (this.aiFilled)
			contentEl.createDiv({ text: "✨ AI đã điền — kiểm tra và chỉnh nếu cần:", cls: "vf-muted vf-auto-desc" });

		new Setting(contentEl)
			.setName("Từ / cụm / câu / đoạn")
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
			.addDropdown((d) => {
				const cats = new Set<string>(DEFAULT_CATEGORIES);
				for (const c of this.plugin.store.getAllCards()) cats.add(c.category);
				cats.add(this.input.category);
				for (const c of [...cats].sort()) d.addOption(c, c);
				d.setValue(this.input.category).onChange((v) => (this.input.category = v));
			})
			.addText((t) =>
				t.setPlaceholder("hoặc gõ chủ đề mới…").onChange((v) => {
					if (v.trim()) this.input.category = v.trim().toLowerCase();
				})
			);

		new Setting(contentEl)
			.setName("IPA")
			.addText((t) => t.setValue(this.input.ipa).onChange((v) => (this.input.ipa = v)));

		new Setting(contentEl).setName("Nghĩa Anh–Anh").addTextArea((t) => {
			t.setValue(this.input.meaningEn).onChange((v) => (this.input.meaningEn = v));
			t.inputEl.rows = 2;
			t.inputEl.addClass("vf-input-wide");
		});

		new Setting(contentEl).setName("Nghĩa tiếng Việt").addTextArea((t) => {
			t.setValue(this.input.meaningVi).onChange((v) => (this.input.meaningVi = v));
			t.inputEl.rows = 2;
			t.inputEl.addClass("vf-input-wide");
		});

		new Setting(contentEl)
			.setName("Quote — câu ví dụ / ngữ cảnh")
			.addTextArea((t) => {
				t.setValue(this.input.quote).onChange((v) => (this.input.quote = v));
				t.inputEl.rows = 2;
				t.inputEl.addClass("vf-input-wide");
			});

		new Setting(contentEl)
			.setName("Collocations")
			.setDesc("Cách nhau dấu phẩy")
			.addText((t) =>
				t.setValue(this.input.collocations.join(", ")).onChange((v) => {
					this.input.collocations = v.split(",").map((s) => s.trim()).filter(Boolean);
				})
			);

		new Setting(contentEl)
			.setName("Word family (forms)")
			.setDesc("Các dạng biến thể, cách nhau dấu phẩy")
			.addText((t) =>
				t.setValue(this.input.forms.join(", ")).onChange((v) => {
					this.input.forms = v.split(",").map((s) => s.trim()).filter(Boolean);
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
			.setName("Link video")
			.addText((t) => {
				t.setValue(this.input.sourceUrl).onChange((v) => (this.input.sourceUrl = v));
				this.urlText = t.inputEl;
			});

		new Setting(contentEl)
			.setName("🖼 Sinh ảnh minh hoạ (AI, chạy nền)")
			.addToggle((t) => t.setValue(this.makeImage).onChange((v) => (this.makeImage = v)));

		new Setting(contentEl).addButton((b) =>
			b.setButtonText("Tạo thẻ").setCta().onClick(() => void this.submit())
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
			if (this.makeImage) {
				new Notice("🖼 Đang sinh ảnh minh hoạ nền (~1 phút)…");
				void this.plugin
					.generateCardImage(file, this.input.word, this.input.meaningEn)
					.then((ok) =>
						new Notice(ok ? `🖼 Ảnh cho "${file.basename}" đã xong!` : `Ảnh cho "${file.basename}" thất bại`)
					);
			}
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
