import { App, Modal } from "obsidian";
import { categoryEmoji, type VocabCard } from "./types";

export interface CardDetailModalOptions {
	imageSrc?: string | null;
	onSpeak: (text: string) => void;
	onOpenNote: () => void;
}

/** Vault-friendly two-sided card preview; editing remains an explicit action. */
export class CardDetailModal extends Modal {
	private side: "front" | "back" = "front";
	private innerEl: HTMLElement | null = null;
	private frontButton: HTMLButtonElement | null = null;
	private backButton: HTMLButtonElement | null = null;

	constructor(
		app: App,
		private card: VocabCard,
		private options: CardDetailModalOptions
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		contentEl.empty();
		modalEl.addClass("vf-card-detail-modal-shell");
		contentEl.addClass("vf-card-detail-modal");

		const header = contentEl.createDiv({ cls: "vf-card-detail-header" });
		const title = header.createDiv();
		title.createDiv({ text: "Card Detail", cls: "vf-eyebrow" });
		title.createEl("h2", { text: this.card.word });
		const close = header.createEl("button", {
			text: "✕",
			cls: "vf-btn-icon",
			attr: { "aria-label": "Đóng chi tiết thẻ" },
		});
		close.onclick = () => this.close();

		const sidePicker = contentEl.createDiv({ cls: "vf-detail-side-picker", attr: { role: "tablist" } });
		this.frontButton = sidePicker.createEl("button", { text: "Front · Từ", cls: "vf-detail-side-button" });
		this.backButton = sidePicker.createEl("button", { text: "Back · Nghĩa", cls: "vf-detail-side-button" });
		this.frontButton.setAttr("role", "tab");
		this.backButton.setAttr("role", "tab");
		this.frontButton.onclick = () => this.showSide("front");
		this.backButton.onclick = () => this.showSide("back");

		const stage = contentEl.createDiv({ cls: "vf-detail-stage" });
		this.innerEl = stage.createDiv({ cls: "vf-detail-card-inner" });
		this.renderFront(this.innerEl.createDiv({ cls: "vf-detail-face vf-detail-front" }));
		this.renderBack(this.innerEl.createDiv({ cls: "vf-detail-face vf-detail-back" }));
		stage.onclick = (event) => {
			if ((event.target as HTMLElement).closest("button, a")) return;
			this.showSide(this.side === "front" ? "back" : "front");
		};

		const footer = contentEl.createDiv({ cls: "vf-detail-footer" });
		const speak = footer.createEl("button", { text: "🔊 Nghe phát âm", cls: "vf-btn-icon" });
		speak.onclick = () => this.options.onSpeak(this.card.word);
		const flip = footer.createEl("button", { text: "↻ Lật thẻ", cls: "vf-btn-hero vf-btn-hero-small" });
		flip.onclick = () => this.showSide(this.side === "front" ? "back" : "front");
		const edit = footer.createEl("button", { text: "✎ Mở note Markdown", cls: "vf-btn-icon" });
		edit.onclick = () => {
			this.close();
			this.options.onOpenNote();
		};

		this.showSide("front");
	}

	private renderFront(face: HTMLElement): void {
		const media = face.createDiv({ cls: `vf-detail-media${this.options.imageSrc ? "" : " vf-detail-media-empty"}` });
		if (this.options.imageSrc) {
			media.createEl("img", {
				attr: { src: this.options.imageSrc, alt: `Minh họa cho ${this.card.word}` },
			});
		} else media.createSpan({ text: categoryEmoji(this.card.category), cls: "vf-detail-media-emoji" });
		const badges = media.createDiv({ cls: "vf-detail-badges" });
		badges.createSpan({ text: this.card.type, cls: "vf-pill" });
		badges.createSpan({ text: `${categoryEmoji(this.card.category)} ${this.card.category}`, cls: "vf-pill" });

		const body = face.createDiv({ cls: "vf-detail-front-body" });
		body.createDiv({ text: this.card.word, cls: "vf-detail-word" });
		if (this.card.ipa) body.createDiv({ text: this.card.ipa, cls: "vf-detail-ipa" });
		body.createDiv({ text: "Bấm vào thẻ hoặc nút Lật để xem nghĩa", cls: "vf-muted vf-detail-hint" });
	}

	private renderBack(face: HTMLElement): void {
		const scroll = face.createDiv({ cls: "vf-detail-back-scroll" });
		const head = scroll.createDiv({ cls: "vf-detail-back-head" });
		head.createDiv({ text: this.card.word, cls: "vf-detail-back-word" });
		if (this.card.ipa) head.createDiv({ text: this.card.ipa, cls: "vf-detail-ipa" });

		if (this.card.meaningVi) this.detailBlock(scroll, "🇻🇳 Nghĩa tiếng Việt", this.card.meaningVi, "vf-detail-meaning-vi");
		if (this.card.meaningEn) this.detailBlock(scroll, "🇬🇧 English meaning", this.card.meaningEn);
		if (this.card.quote) this.detailBlock(scroll, "💬 Câu trong ngữ cảnh", `“${this.card.quote}”`, "vf-detail-quote");

		if (this.card.collocations.length) {
			const block = scroll.createDiv({ cls: "vf-detail-block" });
			block.createDiv({ text: "🔗 Collocations", cls: "vf-detail-label" });
			const chips = block.createDiv({ cls: "vf-detail-chips" });
			for (const item of this.card.collocations) chips.createSpan({ text: item, cls: "vf-chip" });
		}
		if (this.card.forms.length) this.detailBlock(scroll, "🌱 Word forms", this.card.forms.join(" · "));
		if (this.card.myExample) this.detailBlock(scroll, "✍️ Ví dụ của bạn", this.card.myExample);
		if (this.card.mnemonic) this.detailBlock(scroll, "🧠 Mẹo nhớ", this.card.mnemonic);
		if (this.card.grammarNote) this.detailBlock(scroll, "📖 Ghi chú ngữ pháp", this.card.grammarNote);

		if (this.card.source || this.card.sourceUrl) {
			const source = scroll.createDiv({ cls: "vf-detail-source" });
			source.createSpan({ text: `Nguồn: ${this.card.source || "YouTube"}` });
			if (this.card.sourceUrl) {
				const link = source.createEl("button", { text: "↗ Mở nguồn", cls: "vf-btn-tiny" });
				link.onclick = () => window.open(this.card.sourceUrl);
			}
		}
	}

	private detailBlock(parent: HTMLElement, label: string, value: string, cls = ""): void {
		const block = parent.createDiv({ cls: `vf-detail-block ${cls}`.trim() });
		block.createDiv({ text: label, cls: "vf-detail-label" });
		block.createDiv({ text: value, cls: "vf-detail-value" });
	}

	private showSide(side: "front" | "back"): void {
		this.side = side;
		this.innerEl?.toggleClass("is-back", side === "back");
		this.frontButton?.toggleClass("is-active", side === "front");
		this.backButton?.toggleClass("is-active", side === "back");
		this.frontButton?.setAttr("aria-selected", String(side === "front"));
		this.backButton?.setAttr("aria-selected", String(side === "back"));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
