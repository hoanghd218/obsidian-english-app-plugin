import { App, Modal, Notice } from "obsidian";
import type VocabForgePlugin from "./main";

export class AboutModal extends Modal {
	constructor(app: App, private plugin: VocabForgePlugin) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("vf-about-modal");

		const header = contentEl.createDiv({ cls: "vf-about-header" });
		header.createDiv({ text: "🎓", cls: "vf-about-icon" });
		header.createEl("h2", { text: "Vocab Forge", cls: "vf-about-title" });
		header.createSpan({ text: "v2.0.0", cls: "vf-about-version" });
		header.createDiv({
			text: "English Fluency OS: từ video thật đến ghi nhớ, nghe, nói và viết",
			cls: "vf-about-subtitle",
		});

		// Author card
		const authorBox = contentEl.createDiv({ cls: "vf-about-author-box" });
		authorBox.createEl("h4", { text: "👤 THÔNG TIN TÁC GIẢ", cls: "vf-about-section-title" });

		const authorRow = authorBox.createDiv({ cls: "vf-about-row" });
		authorRow.createSpan({ text: "Tác giả:", cls: "vf-about-label" });
		authorRow.createSpan({ text: "Tony Hoang (Trần Văn Hoàng)", cls: "vf-about-val vf-about-name" });

		const emailRow = authorBox.createDiv({ cls: "vf-about-row" });
		emailRow.createSpan({ text: "Email:", cls: "vf-about-label" });
		const emailLink = emailRow.createEl("a", {
			text: "tony@tranvanhoang.com",
			cls: "vf-about-val vf-about-email-link",
			attr: { href: "mailto:tony@tranvanhoang.com" },
		});
		emailLink.onclick = (e) => {
			e.preventDefault();
			window.open("mailto:tony@tranvanhoang.com");
		};

		const authorBtns = authorBox.createDiv({ cls: "vf-about-btns" });
		const mailBtn = authorBtns.createEl("button", {
			text: "✉️ Gửi Email",
			cls: "vf-btn-hero vf-btn-hero-small",
		});
		mailBtn.onclick = () => {
			window.open("mailto:tony@tranvanhoang.com");
		};

		const copyBtn = authorBtns.createEl("button", {
			text: "📋 Copy Email",
			cls: "vf-btn-icon",
		});
		copyBtn.onclick = async () => {
			try {
				await navigator.clipboard.writeText("tony@tranvanhoang.com");
				new Notice("✅ Đã sao chép email: tony@tranvanhoang.com");
			} catch {
				new Notice("tony@tranvanhoang.com");
			}
		};

		// Features info
		const featBox = contentEl.createDiv({ cls: "vf-about-feat-box" });
		featBox.createEl("h4", { text: "✨ TÍNH NĂNG NỔI BẬT", cls: "vf-about-section-title" });

		const feats = [
			{ icon: "🧠", title: "FSRS Spaced Repetition", desc: "Thuật toán lặp lại ngắt quãng hiện đại tối ưu khả năng ghi nhớ dài hạn." },
			{ icon: "✨", title: "YouTube Smart Capture", desc: "Dán URL hoặc transcript, AI CLI chọn cụm hữu dụng và tạo thẻ đúng timestamp." },
			{ icon: "🎙️", title: "Fluency Lab", desc: "Listening, dictation, ghi âm shadowing, word-level diff và Video Comprehension Score." },
			{ icon: "🤖", title: "AI CLI local", desc: "Dùng tài khoản Claude, Codex, Gemini hoặc Grok CLI đã đăng nhập; plugin không yêu cầu API key." },
			{ icon: "🎯", title: "Nhiều chế độ luyện tập", desc: "Trắc nghiệm, nối từ, điền từ vào câu, xếp từ & tìm lỗi sai." },
			{ icon: "📝", title: "100% Markdown Vault Native", desc: "Toàn bộ từ vựng được lưu trữ an toàn dưới dạng file Markdown trong Vault của bạn." },
		];

		for (const f of feats) {
			const fRow = featBox.createDiv({ cls: "vf-about-feat-item" });
			fRow.createSpan({ text: f.icon, cls: "vf-about-feat-icon" });
			const fText = fRow.createDiv({ cls: "vf-about-feat-text" });
			fText.createDiv({ text: f.title, cls: "vf-about-feat-name" });
			fText.createDiv({ text: f.desc, cls: "vf-about-feat-desc" });
		}

		// Close button
		const closeBtnRow = contentEl.createDiv({ cls: "vf-about-close-row" });
		const closeBtn = closeBtnRow.createEl("button", {
			text: "Đóng",
			cls: "vf-btn-icon",
		});
		closeBtn.onclick = () => this.close();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
