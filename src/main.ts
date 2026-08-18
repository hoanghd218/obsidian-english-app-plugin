import { Editor, MarkdownView, Plugin, WorkspaceLeaf, debounce } from "obsidian";
import { AddCardModal, type AddCardPrefill } from "./addCardModal";
import { VocabReviewView, VIEW_TYPE_VOCAB } from "./reviewView";
import { makeScheduler } from "./srs";
import type { FSRS } from "ts-fsrs";
import { CardStore } from "./store";
import {
	DEFAULT_SETTINGS,
	todayKey,
	type VocabForgeData,
	type VocabForgeSettings,
} from "./types";
import { VocabForgeSettingTab } from "./settingsTab";

export default class VocabForgePlugin extends Plugin {
	data!: VocabForgeData;
	settings!: VocabForgeSettings;
	store!: CardStore;
	scheduler!: FSRS;
	private statusEl!: HTMLElement;

	async onload(): Promise<void> {
		const raw = (await this.loadData()) as Partial<VocabForgeData> | null;
		this.data = {
			settings: { ...DEFAULT_SETTINGS, ...(raw?.settings ?? {}) },
			stats: raw?.stats ?? {},
		};
		this.settings = this.data.settings;
		this.store = new CardStore(this.app, () => this.settings);
		this.scheduler = makeScheduler(this.settings.requestRetention);

		this.registerView(VIEW_TYPE_VOCAB, (leaf) => new VocabReviewView(leaf, this));

		this.addRibbonIcon("graduation-cap", "Vocab Forge: Ôn tập", () => {
			void this.activateView();
		});

		this.addCommand({
			id: "open-review",
			name: "Mở màn ôn tập",
			callback: () => void this.activateView(),
		});
		this.addCommand({
			id: "add-card",
			name: "Thêm thẻ mới",
			callback: () => this.openAddCardModal(),
		});
		this.addCommand({
			id: "card-from-selection",
			name: "Tạo thẻ từ vùng bôi đen",
			editorCallback: (editor, view) => this.cardFromSelection(editor, view as MarkdownView),
		});

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, view) => {
				if (!editor.getSelection().trim()) return;
				menu.addItem((item) =>
					item
						.setTitle("Vocab Forge: Tạo thẻ từ vùng chọn")
						.setIcon("graduation-cap")
						.onClick(() => this.cardFromSelection(editor, view as MarkdownView))
				);
			})
		);

		// Status bar
		this.statusEl = this.addStatusBarItem();
		this.statusEl.addClass("vf-statusbar", "mod-clickable");
		this.statusEl.onclick = () => void this.activateView();
		const refresh = debounce(() => this.refreshStatusBar(), 2000, true);
		this.registerEvent(this.app.metadataCache.on("resolved", refresh));
		this.registerEvent(this.app.vault.on("modify", refresh));
		this.registerInterval(window.setInterval(() => this.refreshStatusBar(), 60_000));
		this.app.workspace.onLayoutReady(() => this.refreshStatusBar());

		this.addSettingTab(new VocabForgeSettingTab(this.app, this));
	}

	onunload(): void {
		window.speechSynthesis.cancel();
	}

	async saveAll(): Promise<void> {
		await this.saveData(this.data);
	}

	rebuildScheduler(): void {
		this.scheduler = makeScheduler(this.settings.requestRetention);
	}

	// ------------------------------------------------------------------ VIEW

	async activateView(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_VOCAB);
		let leaf: WorkspaceLeaf;
		if (existing.length) {
			leaf = existing[0];
		} else {
			leaf = this.app.workspace.getLeaf("tab");
			await leaf.setViewState({ type: VIEW_TYPE_VOCAB, active: true });
		}
		await this.app.workspace.revealLeaf(leaf);
		const view = leaf.view;
		if (view instanceof VocabReviewView) view.renderHome();
	}

	openAddCardModal(prefill?: AddCardPrefill): void {
		new AddCardModal(this.app, this, prefill).open();
	}

	private cardFromSelection(editor: Editor, view: MarkdownView): void {
		const sel = editor.getSelection().trim();
		const file = view.file;
		const prefill: AddCardPrefill = { word: sel };
		if (sel.split(/\s+/).length >= 7) prefill.type = "sentence";
		else if (sel.split(/\s+/).length >= 2) prefill.type = "phrase";
		if (file) {
			prefill.source = `[[${file.basename}]]`;
			const url = this.app.metadataCache.getFileCache(file)?.frontmatter?.source;
			if (typeof url === "string" && /^https?:\/\//.test(url)) prefill.sourceUrl = url;
		}
		this.openAddCardModal(prefill);
	}

	// ----------------------------------------------------------------- STATS

	/** Còn được học bao nhiêu thẻ mới hôm nay */
	newRemainingToday(): number {
		const used = this.data.stats[todayKey()]?.newCards ?? 0;
		return Math.max(0, this.settings.newPerDay - used);
	}

	recordReview(wasNew: boolean): void {
		const key = todayKey();
		const stat = (this.data.stats[key] ??= { reviews: 0, newCards: 0 });
		stat.reviews++;
		if (wasNew) stat.newCards++;
		void this.saveAll();
	}

	recordPractice(): void {
		const key = todayKey();
		const stat = (this.data.stats[key] ??= { reviews: 0, newCards: 0 });
		stat.practice = (stat.practice ?? 0) + 1;
		void this.saveAll();
	}

	refreshStatusBar(): void {
		if (!this.statusEl) return;
		try {
			const due = this.store.getDueCards().length;
			const newAvail = Math.min(this.store.getNewCards().length, this.newRemainingToday());
			this.statusEl.setText(due + newAvail > 0 ? `📚 ${due} due · ${newAvail} mới` : "📚 xong ✓");
		} catch {
			// vault chưa sẵn sàng — bỏ qua
		}
	}

	// ------------------------------------------------------------------- TTS

	speak(text: string): void {
		if (!text) return;
		const synth = window.speechSynthesis;
		synth.cancel();
		const u = new SpeechSynthesisUtterance(text);
		u.lang = "en-US";
		u.rate = this.settings.ttsRate;
		if (this.settings.ttsVoice) {
			const voice = synth.getVoices().find((v) => v.name === this.settings.ttsVoice);
			if (voice) u.voice = voice;
		} else {
			const voice = synth.getVoices().find((v) => v.lang === "en-US") ??
				synth.getVoices().find((v) => v.lang.startsWith("en"));
			if (voice) u.voice = voice;
		}
		synth.speak(u);
	}
}
