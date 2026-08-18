import { App, Modal } from "obsidian";

export class ImageModal extends Modal {
	constructor(app: App, private src: string, private title: string = "") {
		super(app);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		contentEl.empty();
		modalEl.addClass("vf-image-modal");
		contentEl.addClass("vf-image-modal-content");

		if (this.title) {
			const head = contentEl.createDiv({ cls: "vf-image-modal-head" });
			head.createSpan({ text: `🖼️ ${this.title}`, cls: "vf-image-modal-title" });
			const closeBtn = head.createEl("button", {
				text: "✕",
				cls: "vf-btn-icon vf-image-modal-close",
				attr: { "aria-label": "Đóng (Esc)" },
			});
			closeBtn.onclick = () => this.close();
		}

		const imgWrapper = contentEl.createDiv({ cls: "vf-image-modal-wrapper" });
		const img = imgWrapper.createEl("img", {
			cls: "vf-image-modal-img",
			attr: { src: this.src, alt: this.title || "Illustration", title: "Bấm để đóng" },
		});

		img.onclick = () => this.close();
		imgWrapper.onclick = () => this.close();

		const hint = contentEl.createDiv({
			text: "Bấm vào ảnh hoặc phím Esc để đóng",
			cls: "vf-image-modal-hint",
		});
		hint.onclick = () => this.close();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
