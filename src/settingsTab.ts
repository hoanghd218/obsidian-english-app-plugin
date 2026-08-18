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
