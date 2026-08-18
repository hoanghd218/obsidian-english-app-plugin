import { App, PluginSettingTab, Setting } from "obsidian";
import type VocabForgePlugin from "./main";
import { AboutModal } from "./aboutModal";

export class VocabForgeSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: VocabForgePlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Vocab Forge" });

		new Setting(containerEl)
			.setName("Folder chứa thẻ")
			.setDesc("Mỗi thẻ là một file .md trong folder này")
			.addText((t) =>
				t.setValue(this.plugin.settings.cardsFolder).onChange(async (v) => {
					this.plugin.settings.cardsFolder = v.trim() || "5. Toolbox/English/Cards";
					await this.plugin.saveAll();
				})
			);

		new Setting(containerEl)
			.setName("Số thẻ mới mỗi ngày")
			.setDesc("Giới hạn thẻ mới đưa vào học mỗi ngày (kiểu Anki)")
			.addSlider((s) =>
				s
					.setLimits(0, 50, 1)
					.setValue(this.plugin.settings.newPerDay)
					.setDynamicTooltip()
					.onChange(async (v) => {
						this.plugin.settings.newPerDay = v;
						await this.plugin.saveAll();
					})
			);

		new Setting(containerEl)
			.setName("Mức ghi nhớ mục tiêu (retention)")
			.setDesc("FSRS xếp lịch để bạn nhớ được ~tỷ lệ này khi ôn. 0.9 = cân bằng tốt; cao hơn = ôn dày hơn")
			.addSlider((s) =>
				s
					.setLimits(0.8, 0.97, 0.01)
					.setValue(this.plugin.settings.requestRetention)
					.setDynamicTooltip()
					.onChange(async (v) => {
						this.plugin.settings.requestRetention = v;
						this.plugin.rebuildScheduler();
						await this.plugin.saveAll();
					})
			);

		new Setting(containerEl)
			.setName("Tốc độ đọc (TTS)")
			.addSlider((s) =>
				s
					.setLimits(0.5, 1.5, 0.05)
					.setValue(this.plugin.settings.ttsRate)
					.setDynamicTooltip()
					.onChange(async (v) => {
						this.plugin.settings.ttsRate = v;
						await this.plugin.saveAll();
					})
			);

		new Setting(containerEl)
			.setName("Giọng đọc")
			.setDesc("Chọn giọng tiếng Anh của hệ thống")
			.addDropdown((d) => {
				d.addOption("", "— Tự động (en) —");
				for (const v of window.speechSynthesis.getVoices()) {
					if (v.lang.startsWith("en")) d.addOption(v.name, `${v.name} (${v.lang})`);
				}
				d.setValue(this.plugin.settings.ttsVoice).onChange(async (v) => {
					this.plugin.settings.ttsVoice = v;
					await this.plugin.saveAll();
				});
			});

		containerEl.createEl("h3", { text: "AI CLI local — plugin không yêu cầu API key" });
		new Setting(containerEl)
			.setName("AI mặc định")
			.setDesc("Auto sẽ chọn CLI khả dụng theo thứ tự Claude → Grok → Gemini → Codex")
			.addDropdown((d) =>
				d
					.addOption("auto", "Tự động")
					.addOption("claude", "Claude CLI")
					.addOption("codex", "Codex CLI")
					.addOption("gemini", "Gemini CLI")
					.addOption("grok", "Grok CLI")
					.setValue(this.plugin.settings.aiProvider)
					.onChange(async (v) => {
						this.plugin.settings.aiProvider = v as typeof this.plugin.settings.aiProvider;
						this.plugin.resetAiProvider();
						await this.plugin.saveAll();
					})
			);

		const cliPaths: Array<[string, "claudePath" | "codexPath" | "geminiPath" | "grokPath", string]> = [
			["Claude CLI", "claudePath", "claude"],
			["Codex CLI", "codexPath", "codex"],
			["Gemini CLI", "geminiPath", "gemini"],
			["Grok CLI", "grokPath", "grok"],
		];
		for (const [label, key, fallback] of cliPaths) {
			new Setting(containerEl)
				.setName(`Đường dẫn ${label}`)
				.addText((t) =>
					t.setValue(this.plugin.settings[key]).onChange(async (v) => {
						this.plugin.settings[key] = v.trim() || fallback;
						this.plugin.resetAiProvider();
						await this.plugin.saveAll();
					})
				);
		}

		containerEl.createEl("h3", { text: "Lộ trình cá nhân" });
		new Setting(containerEl)
			.setName("Mục tiêu học")
			.addDropdown((d) =>
				d
					.addOption("business", "Business English")
					.addOption("daily", "Giao tiếp hằng ngày")
					.addOption("ielts", "IELTS")
					.addOption("content", "Content creator")
					.addOption("ai-tech", "AI & Technology")
					.addOption("cambridge", "Cambridge / CEFR")
					.setValue(this.plugin.settings.learningGoal)
					.onChange(async (v) => {
						this.plugin.settings.learningGoal = v as typeof this.plugin.settings.learningGoal;
						await this.plugin.saveAll();
					})
			);
		new Setting(containerEl)
			.setName("Thời lượng mỗi ngày")
			.setDesc("Adaptive Coach sẽ tạo phiên học vừa với thời gian này")
			.addSlider((s) =>
				s.setLimits(5, 30, 5).setValue(this.plugin.settings.dailyMinutes).setDynamicTooltip().onChange(async (v) => {
					this.plugin.settings.dailyMinutes = v;
					await this.plugin.saveAll();
				})
			);
		new Setting(containerEl)
			.setName("Sổ lỗi cá nhân")
			.setDesc("Lưu các lỗi viết đã được AI sửa vào note Markdown này")
			.addText((t) =>
				t.setValue(this.plugin.settings.errorNotebookPath).onChange(async (v) => {
					this.plugin.settings.errorNotebookPath = v.trim() || "5. Toolbox/English/My English Errors.md";
					await this.plugin.saveAll();
				})
			);

		new Setting(containerEl)
			.setName("Thông tin & Tác giả")
			.setDesc("Tony Hoang (Trần Văn Hoàng) · Email: tony@tranvanhoang.com")
			.addButton((b) =>
				b.setButtonText("ℹ️ Thông tin plugin").onClick(() => {
					new AboutModal(this.app, this.plugin).open();
				})
			)
			.addButton((b) =>
				b.setButtonText("✉️ Gửi Email").onClick(() => {
					window.open("mailto:tony@tranvanhoang.com");
				})
			);
	}
}
