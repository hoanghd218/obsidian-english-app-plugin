"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => VocabForgePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian6 = require("obsidian");

// src/ai.ts
function nodeRequire(mod) {
  const req = window.require;
  if (!req) throw new Error("AI features ch\u1EC9 ch\u1EA1y tr\xEAn Obsidian desktop");
  return req(mod);
}
function resolveGrokPath(custom) {
  const fs = nodeRequire("fs");
  const os = nodeRequire("os");
  const candidates = [
    custom,
    `${os.homedir()}/.local/bin/grok`,
    "/usr/local/bin/grok",
    "/opt/homebrew/bin/grok"
  ].filter(Boolean);
  for (const c of candidates) {
    if (c !== "grok" && fs.existsSync(c)) return c;
  }
  return "grok";
}
function runGrok(prompt, grokPath, timeoutMs = 9e4, sessionId) {
  const cp = nodeRequire("child_process");
  const os = nodeRequire("os");
  const proc = nodeRequire("process");
  const bin = resolveGrokPath(grokPath);
  const env = {
    ...proc.env,
    PATH: `${proc.env.PATH ?? ""}:${os.homedir()}/.local/bin:/usr/local/bin:/opt/homebrew/bin`
  };
  const args = ["--no-auto-update", "--no-alt-screen", "--disable-web-search"];
  if (sessionId) args.push("-s", sessionId);
  args.push("-p", prompt);
  return new Promise((resolve, reject) => {
    cp.execFile(
      bin,
      args,
      { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, env },
      (err, stdout) => {
        if (err) reject(err);
        else resolve(String(stdout).trim());
      }
    );
  });
}
function extractJson(raw) {
  const start = raw.indexOf("{");
  if (start === -1) return null;
  for (let end = raw.length; end > start; end--) {
    const slice = raw.slice(start, end);
    if (!slice.endsWith("}")) continue;
    try {
      return JSON.parse(slice);
    } catch {
    }
  }
  return null;
}
function sentenceCheckPrompt(word, meaningEn, sentence) {
  return `You are an English teacher for a Vietnamese B1 learner. The learner must write a sentence using the expression "${word}"` + (meaningEn ? ` (meaning: ${meaningEn})` : "") + `. Their sentence: "${sentence}". Evaluate correctness and naturalness. Reply with ONLY minified JSON, no markdown: {"ok":true|false,"score":0-10,"corrected":"improved or corrected sentence","explain_vi":"nh\u1EADn x\xE9t ng\u1EAFn g\u1ECDn b\u1EB1ng ti\u1EBFng Vi\u1EC7t"}`;
}
function mnemonicPrompt(word, meaningVi) {
  return `T\u1EA1o m\u1ED9t m\u1EB9o nh\u1EDB (mnemonic) NG\u1EAEN b\u1EB1ng ti\u1EBFng Vi\u1EC7t cho c\u1EE5m ti\u1EBFng Anh "${word}" ngh\u0129a l\xE0 "${meaningVi}". T\u1ED1i \u0111a 2 c\xE2u, h\xECnh \u1EA3nh s\u1ED1ng \u0111\u1ED9ng, c\xF3 th\u1EC3 ch\u01A1i ch\u1EEF v\u1EDBi ti\u1EBFng Vi\u1EC7t. Ch\u1EC9 tr\u1EA3 v\u1EC1 \u0111\xFAng n\u1ED9i dung m\u1EB9o nh\u1EDB, kh\xF4ng gi\u1EA3i th\xEDch th\xEAm.`;
}
function grammarPrompt(quote) {
  return `Gi\u1EA3i th\xEDch b\u1EB1ng ti\u1EBFng Vi\u1EC7t (cho ng\u01B0\u1EDDi h\u1ECDc B1) c\u1EA5u tr\xFAc ng\u1EEF ph\xE1p \u0111\xE1ng ch\xFA \xFD nh\u1EA5t trong c\xE2u ti\u1EBFng Anh sau, k\xE8m 1 v\xED d\u1EE5 kh\xE1c d\xF9ng c\xF9ng c\u1EA5u tr\xFAc: "${quote}". T\u1ED1i \u0111a 90 t\u1EEB. Ch\u1EC9 tr\u1EA3 v\u1EC1 ph\u1EA7n gi\u1EA3i th\xEDch.`;
}
function cardFillPrompt(word) {
  return `You are a lexicographer helping a Vietnamese B1 English learner (works in business/AI/content). For the English item "${word}", reply with ONLY minified JSON, no markdown fences: {"type":"word|phrase|idiom|collocation","ipa":"/IPA/","meaning_en":"simple learner's-dictionary definition","meaning_vi":"ngh\u0129a ti\u1EBFng Vi\u1EC7t t\u1EF1 nhi\xEAn","collocations":["2-3 common collocations"],"example":"one natural example sentence using it in a business/content context","forms":["real inflected forms only, [] if fixed"],"category":"business|startup|content|ai-tech|casual|idiom|general"}`;
}
function generateImage(word, meaningEn, grokPath, timeoutMs = 2e5) {
  const fs = nodeRequire("fs");
  const os = nodeRequire("os");
  const path = nodeRequire("path");
  const dir = path.join(os.tmpdir(), `vf-imagine-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  const prompt = `/imagine flat minimal vector illustration, a clear visual metaphor for the English expression "${word}"` + (meaningEn ? ` (meaning: ${meaningEn.slice(0, 140)})` : "") + `, teal and deep navy color palette, clean light background, single focused scene, no text, no letters --out out.png`;
  const cp = nodeRequire("child_process");
  const osm = nodeRequire("os");
  const proc = nodeRequire("process");
  const bin = resolveGrokPath(grokPath);
  const env = {
    ...proc.env,
    PATH: `${proc.env.PATH ?? ""}:${osm.homedir()}/.local/bin:/usr/local/bin:/opt/homebrew/bin`
  };
  return new Promise((resolve) => {
    cp.execFile(
      bin,
      ["--no-auto-update", "--always-approve", "--no-alt-screen", "--cwd", dir, "-p", prompt],
      { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, cwd: dir, env },
      () => {
        const out = path.join(dir, "out.png");
        resolve(fs.existsSync(out) ? out : null);
      }
    );
  });
}
function chatStartPrompt(words) {
  return `Let's roleplay to help a Vietnamese B1 English learner practice speaking. You play a friendly business partner in an online meeting about growing a content/AI business. Rules: use simple B1 English, keep each of your turns to 2-4 sentences, ask questions that naturally invite the learner to use these target expressions: ${words.map((w) => `"${w}"`).join(", ")}. Never explain the rules or mention that this is practice. Stay in character. Start the conversation now with your first message only.`;
}
function chatFeedbackPrompt(words) {
  return `D\u1EEBng roleplay. B\xE2y gi\u1EDD h\xE3y nh\u1EADn x\xE9t b\u1EB1ng TI\u1EBENG VI\u1EC6T v\u1EC1 ph\u1EA7n th\u1EC3 hi\u1EC7n c\u1EE7a ng\u01B0\u1EDDi h\u1ECDc trong h\u1ED9i tho\u1EA1i v\u1EEBa r\u1ED3i: (1) h\u1ECD \u0111\xE3 d\xF9ng \u0111\u01B0\u1EE3c nh\u1EEFng t\u1EEB m\u1EE5c ti\xEAu n\xE0o trong: ${words.join(", ")} \u2014 d\xF9ng \u0111\xFAng hay sai; (2) 2-3 l\u1ED7i ti\u1EBFng Anh \u0111\xE1ng ch\xFA \xFD nh\u1EA5t v\xE0 c\xE1ch s\u1EEDa; (3) m\u1ED9t l\u1EDDi khen c\u1EE5 th\u1EC3. T\u1ED1i \u0111a 130 t\u1EEB, th\xE2n thi\u1EC7n.`;
}
function storyPrompt(words, categories) {
  const topic = categories.includes("business") || categories.includes("content") ? "a creator building an online business" : "everyday work life";
  return `Write a short story (100-130 words) in simple English (B1 level) about ${topic} that NATURALLY uses ALL of these expressions: ${words.map((w) => `"${w}"`).join(", ")}. Wrap each target expression in **double asterisks**. After the story, write a line with only "---", then a natural Vietnamese translation of the story. Reply with ONLY the story, the --- line, and the translation.`;
}

// src/addCardModal.ts
var import_obsidian = require("obsidian");

// src/types.ts
var DEFAULT_SETTINGS = {
  cardsFolder: "5. Toolbox/English/Cards",
  newPerDay: 10,
  requestRetention: 0.9,
  ttsRate: 0.95,
  ttsVoice: "",
  dailyReviewGoal: 20,
  dailyNewGoal: 5,
  dailyPracticeGoal: 10,
  highlightEnabled: true,
  grokPath: "grok",
  reverseEnabled: true,
  reminderHour: 20
};
var DEFAULT_CATEGORIES = [
  "business",
  "startup",
  "content",
  "casual",
  "ielts",
  "idiom",
  "cambridge-c1",
  "cambridge-c2",
  "cambridge-c3",
  "general"
];
var CATEGORY_EMOJI = {
  business: "\u{1F4BC}",
  startup: "\u{1F680}",
  content: "\u{1F4F1}",
  casual: "\u{1F4AC}",
  ielts: "\u{1F393}",
  idiom: "\u{1F9E9}",
  "ai-tech": "\u{1F916}",
  "cambridge-c1": "\u{1F9D2}",
  "cambridge-c2": "\u{1F9D1}\u200D\u{1F393}",
  "cambridge-c3": "\u{1F393}",
  general: "\u{1F4E6}"
};
function categoryEmoji(cat) {
  return CATEGORY_EMOJI[cat] ?? "\u{1F3F7}\uFE0F";
}
var XP_PER_LEVEL = 300;
var MAX_FREEZES = 3;
function todayKey(d = /* @__PURE__ */ new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function endOfToday() {
  const d = /* @__PURE__ */ new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

// src/addCardModal.ts
var AddCardModal = class extends import_obsidian.Modal {
  constructor(app, plugin, prefill) {
    super(app);
    this.plugin = plugin;
    this.mode = "auto";
    this.aiFilled = false;
    this.aiBusy = false;
    this.makeImage = true;
    this.input = {
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
      image: ""
    };
    this.sourceText = null;
    this.urlText = null;
    if (prefill) {
      this.input.word = prefill.word ?? "";
      this.input.quote = prefill.quote ?? "";
      this.input.source = prefill.source ?? "";
      this.input.sourceUrl = prefill.sourceUrl ?? "";
      if (prefill.type) this.input.type = prefill.type;
      if (prefill.category) this.input.category = prefill.category;
      if (prefill.word) this.mode = "manual";
    }
  }
  onOpen() {
    this.display();
  }
  display() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("vf-add-modal");
    contentEl.createEl("h3", { text: "\uFF0B Th\xEAm th\u1EBB Vocab Forge" });
    const seg = contentEl.createDiv({ cls: "vf-mode-seg" });
    const autoBtn = seg.createEl("button", {
      text: "\u{1F916} T\u1EF1 \u0111\u1ED9ng (AI)",
      cls: `vf-seg-btn ${this.mode === "auto" ? "vf-seg-on" : ""}`
    });
    const manualBtn = seg.createEl("button", {
      text: "\u{1F4DD} Th\u1EE7 c\xF4ng",
      cls: `vf-seg-btn ${this.mode === "manual" ? "vf-seg-on" : ""}`
    });
    autoBtn.onclick = () => {
      this.mode = "auto";
      this.display();
    };
    manualBtn.onclick = () => {
      this.mode = "manual";
      this.display();
    };
    if (this.mode === "auto" && !this.aiFilled) {
      this.displayAutoEntry(contentEl);
      return;
    }
    this.displayForm(contentEl);
  }
  // --- chế độ tự động: chỉ nhập từ, AI điền hết
  displayAutoEntry(contentEl) {
    contentEl.createDiv({
      text: "Nh\u1EADp t\u1EEB / c\u1EE5m t\u1EEB \u2014 Grok s\u1EBD t\u1EF1 \u0111i\u1EC1n IPA, ngh\u0129a Anh\u2013Vi\u1EC7t, v\xED d\u1EE5, collocations, word family, ch\u1EE7 \u0111\u1EC1 v\xE0 (tu\u1EF3 ch\u1ECDn) sinh \u1EA3nh minh ho\u1EA1.",
      cls: "vf-muted vf-auto-desc"
    });
    const input = contentEl.createEl("input", {
      cls: "vf-practice-input vf-auto-input",
      attr: { type: "text", placeholder: 'vd: "double down", "move the needle"\u2026', spellcheck: "false" }
    });
    input.value = this.input.word;
    input.oninput = () => this.input.word = input.value;
    input.onkeydown = (e) => {
      if (e.key === "Enter") void this.aiFill();
    };
    new import_obsidian.Setting(contentEl).setName("\u{1F5BC} Sinh \u1EA3nh minh ho\u1EA1 sau khi t\u1EA1o th\u1EBB").setDesc("Grok Imagine, ch\u1EA1y n\u1EC1n ~1 ph\xFAt").addToggle((t) => t.setValue(this.makeImage).onChange((v) => this.makeImage = v));
    const btn = contentEl.createEl("button", {
      text: this.aiBusy ? "\u23F3 AI \u0111ang tra c\u1EE9u\u2026" : "\u2728 AI \u0111i\u1EC1n t\u1EA5t c\u1EA3",
      cls: "vf-btn-hero vf-btn-hero-small vf-auto-go"
    });
    btn.disabled = this.aiBusy;
    btn.onclick = () => void this.aiFill();
    window.setTimeout(() => input.focus(), 30);
  }
  async aiFill() {
    const word = this.input.word.trim();
    if (!word) {
      new import_obsidian.Notice("Nh\u1EADp t\u1EEB/c\u1EE5m t\u1EEB tr\u01B0\u1EDBc \u0111\xE3");
      return;
    }
    if (this.aiBusy) return;
    this.aiBusy = true;
    this.display();
    try {
      const raw = await runGrok(cardFillPrompt(word), this.plugin.settings.grokPath, 12e4);
      const fill = extractJson(raw);
      if (!fill) throw new Error("bad json");
      this.input.word = word;
      this.input.type = ["word", "phrase", "idiom", "collocation"].includes(fill.type) ? fill.type : "phrase";
      this.input.ipa = fill.ipa ?? "";
      this.input.meaningEn = fill.meaning_en ?? "";
      this.input.meaningVi = fill.meaning_vi ?? "";
      this.input.collocations = Array.isArray(fill.collocations) ? fill.collocations : [];
      this.input.forms = Array.isArray(fill.forms) ? fill.forms : [];
      this.input.quote = fill.example ?? "";
      this.input.category = (fill.category || "general").toLowerCase();
      this.aiFilled = true;
      new import_obsidian.Notice("\u2728 AI \u0111\xE3 \u0111i\u1EC1n xong \u2014 ki\u1EC3m tra r\u1ED3i b\u1EA5m T\u1EA1o th\u1EBB");
    } catch (e) {
      console.error("Vocab Forge AI fill:", e);
      new import_obsidian.Notice("AI \u0111i\u1EC1n th\u1EA5t b\u1EA1i \u2014 th\u1EED l\u1EA1i ho\u1EB7c d\xF9ng ch\u1EBF \u0111\u1ED9 th\u1EE7 c\xF4ng");
    } finally {
      this.aiBusy = false;
      this.display();
    }
  }
  // --- form đầy đủ (thủ công, hoặc review sau khi AI điền)
  displayForm(contentEl) {
    if (this.aiFilled)
      contentEl.createDiv({ text: "\u2728 AI \u0111\xE3 \u0111i\u1EC1n \u2014 ki\u1EC3m tra v\xE0 ch\u1EC9nh n\u1EBFu c\u1EA7n:", cls: "vf-muted vf-auto-desc" });
    new import_obsidian.Setting(contentEl).setName("T\u1EEB / c\u1EE5m / c\xE2u / \u0111o\u1EA1n").addTextArea((t) => {
      t.setValue(this.input.word).onChange((v) => this.input.word = v);
      t.inputEl.rows = 2;
      t.inputEl.addClass("vf-input-wide");
    });
    new import_obsidian.Setting(contentEl).setName("Lo\u1EA1i th\u1EBB").addDropdown((d) => {
      d.addOption("word", "T\u1EEB (word)").addOption("phrase", "C\u1EE5m t\u1EEB (phrase)").addOption("idiom", "Th\xE0nh ng\u1EEF (idiom)").addOption("collocation", "Collocation").addOption("sentence", "C\xE2u (sentence)").addOption("passage", "\u0110o\u1EA1n ng\u1EAFn (passage)").addOption("grammar", "Ng\u1EEF ph\xE1p (grammar)").setValue(this.input.type).onChange((v) => this.input.type = v);
    });
    new import_obsidian.Setting(contentEl).setName("Ch\u1EE7 \u0111\u1EC1 (deck)").addDropdown((d) => {
      const cats = new Set(DEFAULT_CATEGORIES);
      for (const c of this.plugin.store.getAllCards()) cats.add(c.category);
      cats.add(this.input.category);
      for (const c of [...cats].sort()) d.addOption(c, c);
      d.setValue(this.input.category).onChange((v) => this.input.category = v);
    }).addText(
      (t) => t.setPlaceholder("ho\u1EB7c g\xF5 ch\u1EE7 \u0111\u1EC1 m\u1EDBi\u2026").onChange((v) => {
        if (v.trim()) this.input.category = v.trim().toLowerCase();
      })
    );
    new import_obsidian.Setting(contentEl).setName("IPA").addText((t) => t.setValue(this.input.ipa).onChange((v) => this.input.ipa = v));
    new import_obsidian.Setting(contentEl).setName("Ngh\u0129a Anh\u2013Anh").addTextArea((t) => {
      t.setValue(this.input.meaningEn).onChange((v) => this.input.meaningEn = v);
      t.inputEl.rows = 2;
      t.inputEl.addClass("vf-input-wide");
    });
    new import_obsidian.Setting(contentEl).setName("Ngh\u0129a ti\u1EBFng Vi\u1EC7t").addTextArea((t) => {
      t.setValue(this.input.meaningVi).onChange((v) => this.input.meaningVi = v);
      t.inputEl.rows = 2;
      t.inputEl.addClass("vf-input-wide");
    });
    new import_obsidian.Setting(contentEl).setName("Quote \u2014 c\xE2u v\xED d\u1EE5 / ng\u1EEF c\u1EA3nh").addTextArea((t) => {
      t.setValue(this.input.quote).onChange((v) => this.input.quote = v);
      t.inputEl.rows = 2;
      t.inputEl.addClass("vf-input-wide");
    });
    new import_obsidian.Setting(contentEl).setName("Collocations").setDesc("C\xE1ch nhau d\u1EA5u ph\u1EA9y").addText(
      (t) => t.setValue(this.input.collocations.join(", ")).onChange((v) => {
        this.input.collocations = v.split(",").map((s) => s.trim()).filter(Boolean);
      })
    );
    new import_obsidian.Setting(contentEl).setName("Word family (forms)").setDesc("C\xE1c d\u1EA1ng bi\u1EBFn th\u1EC3, c\xE1ch nhau d\u1EA5u ph\u1EA9y").addText(
      (t) => t.setValue(this.input.forms.join(", ")).onChange((v) => {
        this.input.forms = v.split(",").map((s) => s.trim()).filter(Boolean);
      })
    );
    const sourceSetting = new import_obsidian.Setting(contentEl).setName("Ngu\u1ED3n").setDesc("Wikilink note g\u1ED1c, vd [[T\xEAn clip]]").addText((t) => {
      t.setValue(this.input.source).onChange((v) => this.input.source = v);
      this.sourceText = t.inputEl;
    });
    sourceSetting.addButton(
      (b) => b.setButtonText("D\xF9ng note \u0111ang m\u1EDF").onClick(() => {
        const f = this.app.workspace.getActiveFile();
        if (!f) {
          new import_obsidian.Notice("Kh\xF4ng c\xF3 note n\xE0o \u0111ang m\u1EDF");
          return;
        }
        this.fillFromFile(f);
      })
    );
    new import_obsidian.Setting(contentEl).setName("Link video").addText((t) => {
      t.setValue(this.input.sourceUrl).onChange((v) => this.input.sourceUrl = v);
      this.urlText = t.inputEl;
    });
    new import_obsidian.Setting(contentEl).setName("\u{1F5BC} Sinh \u1EA3nh minh ho\u1EA1 (AI, ch\u1EA1y n\u1EC1n)").addToggle((t) => t.setValue(this.makeImage).onChange((v) => this.makeImage = v));
    new import_obsidian.Setting(contentEl).addButton(
      (b) => b.setButtonText("T\u1EA1o th\u1EBB").setCta().onClick(() => void this.submit())
    );
  }
  fillFromFile(f) {
    this.input.source = `[[${f.basename}]]`;
    if (this.sourceText) this.sourceText.value = this.input.source;
    const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
    const url = fm?.source ?? fm?.source_url ?? "";
    if (typeof url === "string" && /^https?:\/\//.test(url)) {
      this.input.sourceUrl = url;
      if (this.urlText) this.urlText.value = url;
    }
  }
  async submit() {
    if (!this.input.word.trim()) {
      new import_obsidian.Notice("Ch\u01B0a nh\u1EADp n\u1ED9i dung c\u1EA7n h\u1ECDc");
      return;
    }
    this.input.word = this.input.word.trim();
    try {
      const file = await this.plugin.store.createCard(this.input);
      new import_obsidian.Notice(`\u2705 \u0110\xE3 t\u1EA1o th\u1EBB: ${file.basename}`);
      this.plugin.refreshStatusBar();
      if (this.makeImage) {
        new import_obsidian.Notice("\u{1F5BC} \u0110ang sinh \u1EA3nh minh ho\u1EA1 n\u1EC1n (~1 ph\xFAt)\u2026");
        void this.plugin.generateCardImage(file, this.input.word, this.input.meaningEn).then(
          (ok) => new import_obsidian.Notice(ok ? `\u{1F5BC} \u1EA2nh cho "${file.basename}" \u0111\xE3 xong!` : `\u1EA2nh cho "${file.basename}" th\u1EA5t b\u1EA1i`)
        );
      }
      this.close();
    } catch (e) {
      console.error("Vocab Forge: l\u1ED7i t\u1EA1o th\u1EBB", e);
      new import_obsidian.Notice("Kh\xF4ng t\u1EA1o \u0111\u01B0\u1EE3c th\u1EBB \u2014 xem console");
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/aboutModal.ts
var import_obsidian2 = require("obsidian");
var AboutModal = class extends import_obsidian2.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("vf-about-modal");
    const header = contentEl.createDiv({ cls: "vf-about-header" });
    header.createDiv({ text: "\u{1F393}", cls: "vf-about-icon" });
    header.createEl("h2", { text: "Vocab Forge", cls: "vf-about-title" });
    header.createSpan({ text: "v1.6.1", cls: "vf-about-version" });
    header.createDiv({
      text: "H\u1ECDc t\u1EEB v\u1EF1ng ti\u1EBFng Anh th\xF4ng minh v\u1EDBi thu\u1EADt to\xE1n FSRS & h\u1ED7 tr\u1EE3 AI",
      cls: "vf-about-subtitle"
    });
    const authorBox = contentEl.createDiv({ cls: "vf-about-author-box" });
    authorBox.createEl("h4", { text: "\u{1F464} TH\xD4NG TIN T\xC1C GI\u1EA2", cls: "vf-about-section-title" });
    const authorRow = authorBox.createDiv({ cls: "vf-about-row" });
    authorRow.createSpan({ text: "T\xE1c gi\u1EA3:", cls: "vf-about-label" });
    authorRow.createSpan({ text: "Tony Hoang (Tr\u1EA7n V\u0103n Ho\xE0ng)", cls: "vf-about-val vf-about-name" });
    const emailRow = authorBox.createDiv({ cls: "vf-about-row" });
    emailRow.createSpan({ text: "Email:", cls: "vf-about-label" });
    const emailLink = emailRow.createEl("a", {
      text: "tony@tranvanhoang.com",
      cls: "vf-about-val vf-about-email-link",
      attr: { href: "mailto:tony@tranvanhoang.com" }
    });
    emailLink.onclick = (e) => {
      e.preventDefault();
      window.open("mailto:tony@tranvanhoang.com");
    };
    const authorBtns = authorBox.createDiv({ cls: "vf-about-btns" });
    const mailBtn = authorBtns.createEl("button", {
      text: "\u2709\uFE0F G\u1EEDi Email",
      cls: "vf-btn-hero vf-btn-hero-small"
    });
    mailBtn.onclick = () => {
      window.open("mailto:tony@tranvanhoang.com");
    };
    const copyBtn = authorBtns.createEl("button", {
      text: "\u{1F4CB} Copy Email",
      cls: "vf-btn-icon"
    });
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText("tony@tranvanhoang.com");
        new import_obsidian2.Notice("\u2705 \u0110\xE3 sao ch\xE9p email: tony@tranvanhoang.com");
      } catch {
        new import_obsidian2.Notice("tony@tranvanhoang.com");
      }
    };
    const featBox = contentEl.createDiv({ cls: "vf-about-feat-box" });
    featBox.createEl("h4", { text: "\u2728 T\xCDNH N\u0102NG N\u1ED4I B\u1EACT", cls: "vf-about-section-title" });
    const feats = [
      { icon: "\u{1F9E0}", title: "FSRS Spaced Repetition", desc: "Thu\u1EADt to\xE1n l\u1EB7p l\u1EA1i ng\u1EAFt qu\xE3ng hi\u1EC7n \u0111\u1EA1i t\u1ED1i \u01B0u kh\u1EA3 n\u0103ng ghi nh\u1EDB d\xE0i h\u1EA1n." },
      { icon: "\u{1F916}", title: "Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o Grok AI", desc: "T\u1EF1 \u0111\u1ED9ng \u0111i\u1EC1n th\u1EBB, gi\u1EA3i th\xEDch ng\u1EEF ph\xE1p, t\u1EA1o m\u1EB9o nh\u1EDB & h\u1ED9i tho\u1EA1i roleplay." },
      { icon: "\u{1F3AF}", title: "Nhi\u1EC1u ch\u1EBF \u0111\u1ED9 luy\u1EC7n t\u1EADp", desc: "Tr\u1EAFc nghi\u1EC7m, n\u1ED1i t\u1EEB, \u0111i\u1EC1n t\u1EEB v\xE0o c\xE2u, x\u1EBFp t\u1EEB & t\xECm l\u1ED7i sai." },
      { icon: "\u{1F4DD}", title: "100% Markdown Vault Native", desc: "To\xE0n b\u1ED9 t\u1EEB v\u1EF1ng \u0111\u01B0\u1EE3c l\u01B0u tr\u1EEF an to\xE0n d\u01B0\u1EDBi d\u1EA1ng file Markdown trong Vault c\u1EE7a b\u1EA1n." }
    ];
    for (const f of feats) {
      const fRow = featBox.createDiv({ cls: "vf-about-feat-item" });
      fRow.createSpan({ text: f.icon, cls: "vf-about-feat-icon" });
      const fText = fRow.createDiv({ cls: "vf-about-feat-text" });
      fText.createDiv({ text: f.title, cls: "vf-about-feat-name" });
      fText.createDiv({ text: f.desc, cls: "vf-about-feat-desc" });
    }
    const closeBtnRow = contentEl.createDiv({ cls: "vf-about-close-row" });
    const closeBtn = closeBtnRow.createEl("button", {
      text: "\u0110\xF3ng",
      cls: "vf-btn-icon"
    });
    closeBtn.onclick = () => this.close();
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/reviewView.ts
var import_obsidian3 = require("obsidian");

// node_modules/ts-fsrs/dist/index.mjs
var FSRSError = class _FSRSError extends Error {
  constructor(message = "FSRS Error") {
    super(message);
    this.name = "FSRSError";
    Error.captureStackTrace?.(this, _FSRSError);
  }
};
var FSRSValidationError = class _FSRSValidationError extends FSRSError {
  constructor(message) {
    super(message);
    this.name = "FSRSValidationError";
    Error.captureStackTrace?.(this, _FSRSValidationError);
  }
};
var State = /* @__PURE__ */ ((State2) => {
  State2[State2["New"] = 0] = "New";
  State2[State2["Learning"] = 1] = "Learning";
  State2[State2["Review"] = 2] = "Review";
  State2[State2["Relearning"] = 3] = "Relearning";
  return State2;
})(State || {});
var Rating = /* @__PURE__ */ ((Rating2) => {
  Rating2[Rating2["Manual"] = 0] = "Manual";
  Rating2[Rating2["Again"] = 1] = "Again";
  Rating2[Rating2["Hard"] = 2] = "Hard";
  Rating2[Rating2["Good"] = 3] = "Good";
  Rating2[Rating2["Easy"] = 4] = "Easy";
  return Rating2;
})(Rating || {});
var TypeConvert = class _TypeConvert {
  static card(card) {
    return {
      ...card,
      state: _TypeConvert.state(card.state),
      due: _TypeConvert.time(card.due),
      last_review: card.last_review ? _TypeConvert.time(card.last_review) : void 0
    };
  }
  static rating(value) {
    if (typeof value === "string") {
      const firstLetter = value.charAt(0).toUpperCase();
      const restOfString = value.slice(1).toLowerCase();
      const ret = Rating[`${firstLetter}${restOfString}`];
      if (ret === void 0) {
        throw new FSRSValidationError(`Invalid rating:[${value}]`);
      }
      return ret;
    } else if (typeof value === "number") {
      return value;
    }
    throw new FSRSValidationError(`Invalid rating:[${value}]`);
  }
  static state(value) {
    if (typeof value === "string") {
      const firstLetter = value.charAt(0).toUpperCase();
      const restOfString = value.slice(1).toLowerCase();
      const ret = State[`${firstLetter}${restOfString}`];
      if (ret === void 0) {
        throw new FSRSValidationError(`Invalid state:[${value}]`);
      }
      return ret;
    } else if (typeof value === "number") {
      return value;
    }
    throw new FSRSValidationError(`Invalid state:[${value}]`);
  }
  static time(value) {
    if (value instanceof Date) {
      return value;
    }
    const date = new Date(value);
    if (typeof value === "object" && value !== null && !Number.isNaN(Date.parse(value) || +date)) {
      return date;
    } else if (typeof value === "string") {
      const timestamp = Date.parse(value);
      if (!Number.isNaN(timestamp)) {
        return new Date(timestamp);
      } else {
        throw new FSRSValidationError(`Invalid date:[${value}]`);
      }
    } else if (typeof value === "number") {
      return new Date(value);
    }
    throw new FSRSValidationError(`Invalid date:[${value}]`);
  }
  static review_log(log) {
    return {
      ...log,
      due: _TypeConvert.time(log.due),
      rating: _TypeConvert.rating(log.rating),
      state: _TypeConvert.state(log.state),
      review: _TypeConvert.time(log.review)
    };
  }
};
Date.prototype.scheduler = function(t, isDay) {
  return date_scheduler(this, t, isDay);
};
Date.prototype.diff = function(pre, unit) {
  return date_diff(this, pre, unit);
};
Date.prototype.format = function() {
  return formatDate(this);
};
Date.prototype.dueFormat = function(last_review, unit, timeUnit) {
  return show_diff_message(this, last_review, unit, timeUnit);
};
function date_scheduler(now, t, isDay) {
  return new Date(
    isDay ? TypeConvert.time(now).getTime() + t * 24 * 60 * 60 * 1e3 : TypeConvert.time(now).getTime() + t * 60 * 1e3
  );
}
function date_diff(now, pre, unit) {
  if (!now || !pre) {
    throw new FSRSValidationError("Invalid date");
  }
  const diff = TypeConvert.time(now).getTime() - TypeConvert.time(pre).getTime();
  let r = 0;
  switch (unit) {
    case "days":
      r = Math.floor(diff / (24 * 60 * 60 * 1e3));
      break;
    case "minutes":
      r = Math.floor(diff / (60 * 1e3));
      break;
  }
  return r;
}
function formatDate(dateInput) {
  const date = TypeConvert.time(dateInput);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  return `${year}-${padZero(month)}-${padZero(day)} ${padZero(hours)}:${padZero(
    minutes
  )}:${padZero(seconds)}`;
}
function padZero(num) {
  return num < 10 ? `0${num}` : `${num}`;
}
var TIMEUNIT = [60, 60, 24, 31, 12];
var TIMEUNITFORMAT = ["second", "min", "hour", "day", "month", "year"];
function show_diff_message(due, last_review, unit, timeUnit = TIMEUNITFORMAT) {
  due = TypeConvert.time(due);
  last_review = TypeConvert.time(last_review);
  if (timeUnit.length !== TIMEUNITFORMAT.length) {
    timeUnit = TIMEUNITFORMAT;
  }
  let diff = due.getTime() - last_review.getTime();
  let i = 0;
  diff /= 1e3;
  for (i = 0; i < TIMEUNIT.length; i++) {
    if (diff < TIMEUNIT[i]) {
      break;
    } else {
      diff /= TIMEUNIT[i];
    }
  }
  return `${Math.floor(diff)}${unit ? timeUnit[i] : ""}`;
}
var Grades = Object.freeze([
  Rating.Again,
  Rating.Hard,
  Rating.Good,
  Rating.Easy
]);
var FUZZ_RANGES = [
  {
    start: 2.5,
    end: 7,
    factor: 0.15
  },
  {
    start: 7,
    end: 20,
    factor: 0.1
  },
  {
    start: 20,
    end: Infinity,
    factor: 0.05
  }
];
function get_fuzz_range(interval, elapsed_days, maximum_interval) {
  let delta = 1;
  for (const range of FUZZ_RANGES) {
    delta += range.factor * Math.max(Math.min(interval, range.end) - range.start, 0);
  }
  interval = Math.min(interval, maximum_interval);
  let min_ivl = Math.max(2, Math.round(interval - delta));
  const max_ivl = Math.min(Math.round(interval + delta), maximum_interval);
  if (interval > elapsed_days) {
    min_ivl = Math.max(min_ivl, elapsed_days + 1);
  }
  min_ivl = Math.min(min_ivl, max_ivl);
  return { min_ivl, max_ivl };
}
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function roundTo(num, decimals) {
  const factor = 10 ** decimals;
  return Math.round(num * factor) / factor;
}
function dateDiffInDays(last, cur) {
  const utc1 = Date.UTC(
    last.getUTCFullYear(),
    last.getUTCMonth(),
    last.getUTCDate()
  );
  const utc2 = Date.UTC(
    cur.getUTCFullYear(),
    cur.getUTCMonth(),
    cur.getUTCDate()
  );
  return Math.floor(
    (utc2 - utc1) / 864e5
    /** 1000 * 60 * 60 * 24*/
  );
}
var ConvertStepUnitToMinutes = (step) => {
  const unit = step.slice(-1);
  const value = parseInt(step.slice(0, -1), 10);
  if (Number.isNaN(value) || !Number.isFinite(value) || value < 0) {
    throw new FSRSValidationError(`Invalid step value: ${step}`);
  }
  switch (unit) {
    case "m":
      return value;
    case "h":
      return value * 60;
    case "d":
      return value * 1440;
    default:
      throw new FSRSValidationError(
        `Invalid step unit: ${step}, expected m/h/d`
      );
  }
};
var BasicLearningStepsStrategy = (params, state, cur_step) => {
  const learning_steps = state === State.Relearning || state === State.Review ? params.relearning_steps : params.learning_steps;
  const steps_length = learning_steps.length;
  if (steps_length === 0 || cur_step >= steps_length) return {};
  const firstStep = learning_steps[0];
  const toMinutes = ConvertStepUnitToMinutes;
  const getAgainInterval = () => {
    return toMinutes(firstStep);
  };
  const getHardInterval = () => {
    if (steps_length === 1) return Math.round(toMinutes(firstStep) * 1.5);
    const nextStep = learning_steps[1];
    return Math.round((toMinutes(firstStep) + toMinutes(nextStep)) / 2);
  };
  const getStepInfo = (index) => {
    if (index < 0 || index >= steps_length) {
      return null;
    } else {
      return learning_steps[index];
    }
  };
  const getGoodMinutes = (step) => {
    return toMinutes(step);
  };
  const result = {};
  const step_info = getStepInfo(Math.max(0, cur_step));
  if (state === State.Review) {
    result[Rating.Again] = {
      scheduled_minutes: toMinutes(step_info),
      next_step: 0
    };
    return result;
  } else {
    result[Rating.Again] = {
      scheduled_minutes: getAgainInterval(),
      next_step: 0
    };
    result[Rating.Hard] = {
      scheduled_minutes: getHardInterval(),
      next_step: cur_step
    };
    const next_info = getStepInfo(cur_step + 1);
    if (next_info) {
      const nextMin = getGoodMinutes(next_info);
      if (nextMin) {
        result[Rating.Good] = {
          scheduled_minutes: Math.round(nextMin),
          next_step: cur_step + 1
        };
      }
    }
  }
  return result;
};
function DefaultInitSeedStrategy() {
  const time = this.review_time.getTime();
  const reps = this.current.reps;
  const mul = this.current.difficulty * this.current.stability;
  return `${time}_${reps}_${mul}`;
}
var StrategyMode = /* @__PURE__ */ ((StrategyMode2) => {
  StrategyMode2["SCHEDULER"] = "Scheduler";
  StrategyMode2["LEARNING_STEPS"] = "LearningSteps";
  StrategyMode2["SEED"] = "Seed";
  return StrategyMode2;
})(StrategyMode || {});
var AbstractScheduler = class {
  // init
  constructor(card, now, algorithm, strategies) {
    __publicField(this, "last");
    __publicField(this, "current");
    __publicField(this, "review_time");
    __publicField(this, "next", /* @__PURE__ */ new Map());
    __publicField(this, "algorithm");
    __publicField(this, "strategies");
    __publicField(this, "elapsed_days", 0);
    this.algorithm = algorithm;
    this.last = TypeConvert.card(card);
    this.current = TypeConvert.card(card);
    this.review_time = TypeConvert.time(now);
    this.strategies = strategies;
    this.init();
  }
  checkGrade(grade) {
    if (!Number.isFinite(grade) || grade < 1 || grade > 4) {
      throw new FSRSValidationError(`Invalid grade "${grade}",expected 1-4`);
    }
  }
  init() {
    const { state, last_review } = this.current;
    let interval = 0;
    if (state !== State.New && last_review) {
      interval = dateDiffInDays(last_review, this.review_time);
    }
    this.current.last_review = this.review_time;
    this.elapsed_days = interval;
    this.current.elapsed_days = interval;
    this.current.reps += 1;
    let seed_strategy = DefaultInitSeedStrategy;
    if (this.strategies) {
      const custom_strategy = this.strategies.get(StrategyMode.SEED);
      if (custom_strategy) {
        seed_strategy = custom_strategy;
      }
    }
    this.algorithm.seed = seed_strategy.call(this);
  }
  preview() {
    return {
      [Rating.Again]: this.review(Rating.Again),
      [Rating.Hard]: this.review(Rating.Hard),
      [Rating.Good]: this.review(Rating.Good),
      [Rating.Easy]: this.review(Rating.Easy),
      [Symbol.iterator]: this.previewIterator.bind(this)
    };
  }
  *previewIterator() {
    for (const grade of Grades) {
      yield this.review(grade);
    }
  }
  review(grade) {
    const { state } = this.last;
    let item;
    this.checkGrade(grade);
    switch (state) {
      case State.New:
        item = this.newState(grade);
        break;
      case State.Learning:
      case State.Relearning:
        item = this.learningState(grade);
        break;
      case State.Review:
        item = this.reviewState(grade);
        break;
    }
    return item;
  }
  buildLog(rating) {
    const { last_review, due, elapsed_days } = this.last;
    return {
      rating,
      state: this.current.state,
      due: last_review || due,
      stability: this.current.stability,
      difficulty: this.current.difficulty,
      elapsed_days: this.elapsed_days,
      last_elapsed_days: elapsed_days,
      scheduled_days: this.current.scheduled_days,
      learning_steps: this.current.learning_steps,
      review: this.review_time
    };
  }
};
var Alea = class {
  constructor(seed) {
    __publicField(this, "c");
    __publicField(this, "s0");
    __publicField(this, "s1");
    __publicField(this, "s2");
    const mash = Mash();
    this.c = 1;
    this.s0 = mash(" ");
    this.s1 = mash(" ");
    this.s2 = mash(" ");
    if (seed == null) seed = Date.now();
    this.s0 -= mash(seed);
    if (this.s0 < 0) this.s0 += 1;
    this.s1 -= mash(seed);
    if (this.s1 < 0) this.s1 += 1;
    this.s2 -= mash(seed);
    if (this.s2 < 0) this.s2 += 1;
  }
  next() {
    const t = 2091639 * this.s0 + this.c * 23283064365386963e-26;
    this.s0 = this.s1;
    this.s1 = this.s2;
    this.c = t | 0;
    this.s2 = t - this.c;
    return this.s2;
  }
  set state(state) {
    this.c = state.c;
    this.s0 = state.s0;
    this.s1 = state.s1;
    this.s2 = state.s2;
  }
  get state() {
    return {
      c: this.c,
      s0: this.s0,
      s1: this.s1,
      s2: this.s2
    };
  }
};
function Mash() {
  let n = 4022871197;
  return function mash(data) {
    data = String(data);
    for (let i = 0; i < data.length; i++) {
      n += data.charCodeAt(i);
      let h = 0.02519603282416938 * n;
      n = h >>> 0;
      h -= n;
      h *= n;
      n = h >>> 0;
      h -= n;
      n += h * 4294967296;
    }
    return (n >>> 0) * 23283064365386963e-26;
  };
}
function alea(seed) {
  const xg = new Alea(seed);
  const prng = () => xg.next();
  prng.int32 = () => xg.next() * 4294967296 | 0;
  prng.double = () => prng() + (prng() * 2097152 | 0) * 11102230246251565e-32;
  prng.state = () => xg.state;
  prng.importState = (state) => {
    xg.state = state;
    return prng;
  };
  return prng;
}
var version = "5.4.1";
var default_request_retention = 0.9;
var default_maximum_interval = 36500;
var default_enable_fuzz = false;
var default_enable_short_term = true;
var default_learning_steps = Object.freeze([
  "1m",
  "10m"
]);
var default_relearning_steps = Object.freeze([
  "10m"
]);
var FSRSVersion = `v${version} using FSRS-6.0`;
var S_MIN = 1e-3;
var INIT_S_MAX = 100;
var FSRS5_DEFAULT_DECAY = 0.5;
var FSRS6_DEFAULT_DECAY = 0.1542;
var default_w = Object.freeze([
  0.212,
  1.2931,
  2.3065,
  8.2956,
  6.4133,
  0.8334,
  3.0194,
  1e-3,
  1.8722,
  0.1666,
  0.796,
  1.4835,
  0.0614,
  0.2629,
  1.6483,
  0.6014,
  1.8729,
  0.5425,
  0.0912,
  0.0658,
  FSRS6_DEFAULT_DECAY
]);
var W17_W18_Ceiling = 2;
var CLAMP_PARAMETERS = (w17_w18_ceiling, enable_short_term = default_enable_short_term) => [
  [S_MIN, INIT_S_MAX],
  [S_MIN, INIT_S_MAX],
  [S_MIN, INIT_S_MAX],
  [S_MIN, INIT_S_MAX],
  [1, 10],
  [1e-3, 4],
  [1e-3, 4],
  [1e-3, 0.75],
  [0, 4.5],
  [0, 0.8],
  [1e-3, 3.5],
  [1e-3, 5],
  [1e-3, 0.25],
  [1e-3, 0.9],
  [0, 4],
  [0, 1],
  [1, 6],
  [0, w17_w18_ceiling],
  [0, w17_w18_ceiling],
  [
    enable_short_term ? 0.01 : 0,
    0.8
  ],
  [0.1, 0.8]
];
var clipParameters = (parameters, numRelearningSteps, enableShortTerm = default_enable_short_term) => {
  const clip = CLAMP_PARAMETERS(W17_W18_Ceiling, enableShortTerm).slice(
    0,
    parameters.length
  );
  if (Math.max(0, numRelearningSteps) > 1) {
    const w11 = clamp(parameters[11] || 0, clip[11][0], clip[11][1]);
    const w13 = clamp(parameters[13] || 0, clip[13][0], clip[13][1]);
    const w14 = clamp(parameters[14] || 0, clip[14][0], clip[14][1]);
    const value = -(Math.log(w11) + Math.log(Math.pow(2, w13) - 1) + w14 * 0.3) / numRelearningSteps;
    const w17_w18_ceiling = clamp(
      roundTo(Math.sqrt(Math.max(value, 0)), 8),
      0.01,
      W17_W18_Ceiling
    );
    if (clip[17]) clip[17] = [clip[17][0], w17_w18_ceiling];
    if (clip[18]) clip[18] = [clip[18][0], w17_w18_ceiling];
  }
  return clip.map(
    ([min, max], index) => clamp(parameters[index] || 0, min, max)
  );
};
var migrateParameters = (parameters, numRelearningSteps = 0, enableShortTerm = default_enable_short_term) => {
  if (parameters === void 0) {
    return [...default_w];
  }
  switch (parameters.length) {
    case 21:
      return clipParameters(
        Array.from(parameters),
        numRelearningSteps,
        enableShortTerm
      );
    case 19:
      console.debug("[FSRS-6]auto fill w from 19 to 21 length");
      return clipParameters(
        Array.from(parameters),
        numRelearningSteps,
        enableShortTerm
      ).concat([0, FSRS5_DEFAULT_DECAY]);
    case 17: {
      const w = clipParameters(
        Array.from(parameters),
        numRelearningSteps,
        enableShortTerm
      );
      w[4] = +(w[5] * 2 + w[4]).toFixed(8);
      w[5] = +(Math.log(w[5] * 3 + 1) / 3).toFixed(8);
      w[6] = +(w[6] + 0.5).toFixed(8);
      console.debug("[FSRS-6]auto fill w from 17 to 21 length");
      return w.concat([0, 0, 0, FSRS5_DEFAULT_DECAY]);
    }
    default:
      console.warn("[FSRS]Invalid parameters length, using default parameters");
      return [...default_w];
  }
};
var generatorParameters = (props) => {
  const learning_steps = Array.isArray(props?.learning_steps) ? props.learning_steps : default_learning_steps;
  const relearning_steps = Array.isArray(props?.relearning_steps) ? props.relearning_steps : default_relearning_steps;
  const enable_short_term = props?.enable_short_term ?? default_enable_short_term;
  const w = migrateParameters(
    props?.w,
    relearning_steps.length,
    enable_short_term
  );
  return {
    request_retention: props?.request_retention || default_request_retention,
    maximum_interval: props?.maximum_interval || default_maximum_interval,
    w,
    enable_fuzz: props?.enable_fuzz ?? default_enable_fuzz,
    enable_short_term,
    learning_steps,
    relearning_steps
  };
};
function createEmptyCard(now, afterHandler) {
  const emptyCard = {
    due: now ? TypeConvert.time(now) : /* @__PURE__ */ new Date(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    learning_steps: 0,
    state: State.New,
    last_review: void 0
  };
  if (afterHandler && typeof afterHandler === "function") {
    return afterHandler(emptyCard);
  } else {
    return emptyCard;
  }
}
var computeDecayFactor = (decayOrParams) => {
  const decay = typeof decayOrParams === "number" ? -decayOrParams : -decayOrParams[20];
  const factor = Math.exp(Math.pow(decay, -1) * Math.log(0.9)) - 1;
  return { decay, factor: roundTo(factor, 8) };
};
function forgetting_curve(decayOrParams, elapsed_days, stability) {
  const { decay, factor } = computeDecayFactor(decayOrParams);
  return roundTo(Math.pow(1 + factor * elapsed_days / stability, decay), 8);
}
var FSRSAlgorithm = class {
  constructor(params) {
    __publicField(this, "param");
    __publicField(this, "intervalModifier");
    __publicField(this, "_seed");
    /**
     * The formula used is :
     * $$R(t,S) = (1 + \text{FACTOR} \times \frac{t}{9 \cdot S})^{\text{DECAY}}$$
     * @param {number} elapsed_days t days since the last review
     * @param {number} stability Stability (interval when R=90%)
     * @return {number} r Retrievability (probability of recall)
     */
    __publicField(this, "forgetting_curve");
    this.param = new Proxy(
      generatorParameters(params),
      this.params_handler_proxy()
    );
    this.intervalModifier = this.calculate_interval_modifier(
      this.param.request_retention
    );
    this.forgetting_curve = forgetting_curve.bind(this, this.param.w);
  }
  get interval_modifier() {
    return this.intervalModifier;
  }
  set seed(seed) {
    this._seed = seed;
  }
  /**
   * @see https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm#fsrs-5
   *
   * The formula used is: $$I(r,s) = (r^{\frac{1}{DECAY}} - 1) / FACTOR \times s$$
   * @param request_retention 0<request_retention<=1,Requested retention rate
   * @throws {Error} Requested retention rate should be in the range (0,1]
   */
  calculate_interval_modifier(request_retention) {
    if (request_retention <= 0 || request_retention > 1) {
      throw new FSRSValidationError(
        "Requested retention rate should be in the range (0,1]"
      );
    }
    const { decay, factor } = computeDecayFactor(this.param.w);
    return roundTo((Math.pow(request_retention, 1 / decay) - 1) / factor, 8);
  }
  /**
   * Get the parameters of the algorithm.
   */
  get parameters() {
    return this.param;
  }
  /**
   * Set the parameters of the algorithm.
   * @param params Partial<FSRSParameters>
   */
  set parameters(params) {
    this.update_parameters(params);
  }
  params_handler_proxy() {
    const _this = this;
    return {
      set: function(target, prop, value) {
        if (prop === "request_retention" && Number.isFinite(value)) {
          _this.intervalModifier = _this.calculate_interval_modifier(
            Number(value)
          );
        } else if (prop === "w") {
          value = migrateParameters(
            value,
            target.relearning_steps.length,
            target.enable_short_term
          );
          _this.forgetting_curve = forgetting_curve.bind(this, value);
          _this.intervalModifier = _this.calculate_interval_modifier(
            Number(target.request_retention)
          );
        }
        Reflect.set(target, prop, value);
        return true;
      }
    };
  }
  update_parameters(params) {
    const _params = generatorParameters(params);
    for (const key in _params) {
      const paramKey = key;
      this.param[paramKey] = _params[paramKey];
    }
  }
  /**
     * The formula used is :
     * $$ S_0(G) = w_{G-1}$$
     * $$S_0 = \max \lbrace S_0,0.1\rbrace $$
  
     * @param g Grade (rating at Anki) [1.again,2.hard,3.good,4.easy]
     * @return Stability (interval when R=90%)
     */
  init_stability(g) {
    return Math.max(this.param.w[g - 1], 0.1);
  }
  /**
   * The formula used is :
   * $$D_0(G) = w_4 - e^{(G-1) \cdot w_5} + 1 $$
   * $$D_0 = \min \lbrace \max \lbrace D_0(G),1 \rbrace,10 \rbrace$$
   * where the $$D_0(1)=w_4$$ when the first rating is good.
   *
   * @param {Grade} g Grade (rating at Anki) [1.again,2.hard,3.good,4.easy]
   * @return {number} Difficulty $$D \in [1,10]$$
   */
  init_difficulty(g) {
    const w = this.param.w;
    const d = w[4] - Math.exp((g - 1) * w[5]) + 1;
    return roundTo(d, 8);
  }
  /**
   * If fuzzing is disabled or ivl is less than 2.5, it returns the original interval.
   * @param {number} ivl - The interval to be fuzzed.
   * @param {number} elapsed_days t days since the last review
   * @return {number} - The fuzzed interval.
   **/
  apply_fuzz(ivl, elapsed_days) {
    if (!this.param.enable_fuzz || ivl < 2.5) return Math.round(ivl);
    const generator = alea(this._seed);
    const fuzz_factor = generator();
    const { min_ivl, max_ivl } = get_fuzz_range(
      ivl,
      elapsed_days,
      this.param.maximum_interval
    );
    return Math.floor(fuzz_factor * (max_ivl - min_ivl + 1) + min_ivl);
  }
  /**
   *   @see The formula used is : {@link FSRSAlgorithm.calculate_interval_modifier}
   *   @param {number} s - Stability (interval when R=90%)
   *   @param {number} elapsed_days t days since the last review
   */
  next_interval(s, elapsed_days) {
    const newInterval = Math.min(
      Math.max(1, Math.round(s * this.intervalModifier)),
      this.param.maximum_interval
    );
    return this.apply_fuzz(newInterval, elapsed_days);
  }
  /**
   * @see https://github.com/open-spaced-repetition/fsrs4anki/issues/697
   */
  linear_damping(delta_d, old_d) {
    return roundTo(delta_d * (10 - old_d) / 9, 8);
  }
  /**
   * The formula used is :
   * $$\text{delta}_d = -w_6 \cdot (g - 3)$$
   * $$\text{next}_d = D + \text{linear damping}(\text{delta}_d , D)$$
   * $$D^\prime(D,R) = w_7 \cdot D_0(4) +(1 - w_7) \cdot \text{next}_d$$
   * @param {number} d Difficulty $$D \in [1,10]$$
   * @param {Grade} g Grade (rating at Anki) [1.again,2.hard,3.good,4.easy]
   * @return {number} $$\text{next}_D$$
   */
  next_difficulty(d, g) {
    const delta_d = -this.param.w[6] * (g - 3);
    const next_d = d + this.linear_damping(delta_d, d);
    return clamp(
      this.mean_reversion(this.init_difficulty(Rating.Easy), next_d),
      1,
      10
    );
  }
  /**
   * The formula used is :
   * $$w_7 \cdot \text{init} +(1 - w_7) \cdot \text{current}$$
   * @param {number} init $$w_2 : D_0(3) = w_2 + (R-2) \cdot w_3= w_2$$
   * @param {number} current $$D - w_6 \cdot (R - 2)$$
   * @return {number} difficulty
   */
  mean_reversion(init, current) {
    const w = this.param.w;
    return roundTo(w[7] * init + (1 - w[7]) * current, 8);
  }
  /**
   * The formula used is :
   * $$S^\prime_r(D,S,R,G) = S\cdot(e^{w_8}\cdot (11-D)\cdot S^{-w_9}\cdot(e^{w_{10}\cdot(1-R)}-1)\cdot w_{15}(\text{if} G=2) \cdot w_{16}(\text{if} G=4)+1)$$
   * @param {number} d Difficulty D \in [1,10]
   * @param {number} s Stability (interval when R=90%)
   * @param {number} r Retrievability (probability of recall)
   * @param {Grade} g Grade (Rating[0.again,1.hard,2.good,3.easy])
   * @return {number} S^\prime_r new stability after recall
   */
  next_recall_stability(d, s, r, g) {
    const w = this.param.w;
    const hard_penalty = Rating.Hard === g ? w[15] : 1;
    const easy_bound = Rating.Easy === g ? w[16] : 1;
    return roundTo(
      clamp(
        s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1) * hard_penalty * easy_bound),
        S_MIN,
        36500
      ),
      8
    );
  }
  /**
   * The formula used is :
   * $$S^\prime_f(D,S,R) = w_{11}\cdot D^{-w_{12}}\cdot ((S+1)^{w_{13}}-1) \cdot e^{w_{14}\cdot(1-R)}$$
   * enable_short_term = true : $$S^\prime_f \in \min \lbrace \max \lbrace S^\prime_f,0.01\rbrace, \frac{S}{e^{w_{17} \cdot w_{18}}} \rbrace$$
   * enable_short_term = false : $$S^\prime_f \in \min \lbrace \max \lbrace S^\prime_f,0.01\rbrace, S \rbrace$$
   * @param {number} d Difficulty D \in [1,10]
   * @param {number} s Stability (interval when R=90%)
   * @param {number} r Retrievability (probability of recall)
   * @return {number} S^\prime_f new stability after forgetting
   */
  next_forget_stability(d, s, r) {
    const w = this.param.w;
    return roundTo(
      clamp(
        w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]),
        S_MIN,
        36500
      ),
      8
    );
  }
  /**
   * The formula used is :
   * $$S^\prime_s(S,G) = S \cdot e^{w_{17} \cdot (G-3+w_{18})}$$
   * @param {number} s Stability (interval when R=90%)
   * @param {Grade} g Grade (Rating[0.again,1.hard,2.good,3.easy])
   */
  next_short_term_stability(s, g) {
    const w = this.param.w;
    const sinc = Math.pow(s, -w[19]) * Math.exp(w[17] * (g - 3 + w[18]));
    const maskedSinc = g >= Rating.Hard ? Math.max(sinc, 1) : sinc;
    return roundTo(clamp(s * maskedSinc, S_MIN, 36500), 8);
  }
  /**
   * Calculates the next state of memory based on the current state, time elapsed, and grade.
   *
   * @param memory_state - The current state of memory, which can be null.
   * @param t - The time elapsed since the last review.
   * @param {Rating} g Grade (Rating[0.Manual,1.Again,2.Hard,3.Good,4.Easy])
   * @param r - Optional retrievability value. If not provided, it will be calculated.
   * @returns The next state of memory with updated difficulty and stability.
   */
  next_state(memory_state, t, g, r) {
    const { difficulty: d, stability: s } = memory_state ?? {
      difficulty: 0,
      stability: 0
    };
    if (t < 0) {
      throw new FSRSValidationError(`Invalid delta_t "${t}"`);
    }
    if (g < 0 || g > 4) {
      throw new FSRSValidationError(`Invalid grade "${g}"`);
    }
    if (d === 0 && s === 0) {
      return {
        difficulty: clamp(this.init_difficulty(g), 1, 10),
        stability: this.init_stability(g)
      };
    }
    if (g === 0) {
      return {
        difficulty: d,
        stability: s
      };
    }
    if (d < 1 || s < S_MIN) {
      throw new FSRSValidationError(
        `Invalid memory state { difficulty: ${d}, stability: ${s} }`
      );
    }
    const w = this.param.w;
    r = typeof r === "number" ? r : this.forgetting_curve(t, s);
    let new_s;
    if (t === 0 && this.param.enable_short_term) {
      new_s = this.next_short_term_stability(s, g);
    } else if (g === 1) {
      const s_after_fail = this.next_forget_stability(d, s, r);
      let [w_17, w_18] = [0, 0];
      if (this.param.enable_short_term) {
        w_17 = w[17];
        w_18 = w[18];
      }
      const next_s_min = s / Math.exp(w_17 * w_18);
      new_s = clamp(roundTo(next_s_min, 8), S_MIN, s_after_fail);
    } else {
      new_s = this.next_recall_stability(d, s, r, g);
    }
    const new_d = this.next_difficulty(d, g);
    return { difficulty: new_d, stability: new_s };
  }
};
var BasicScheduler = class extends AbstractScheduler {
  constructor(card, now, algorithm, strategies) {
    super(card, now, algorithm, strategies);
    __publicField(this, "learningStepsStrategy");
    let learningStepStrategy = BasicLearningStepsStrategy;
    if (this.strategies) {
      const custom_strategy = this.strategies.get(StrategyMode.LEARNING_STEPS);
      if (custom_strategy) {
        learningStepStrategy = custom_strategy;
      }
    }
    this.learningStepsStrategy = learningStepStrategy;
  }
  getLearningInfo(card, grade) {
    const parameters = this.algorithm.parameters;
    card.learning_steps = card.learning_steps || 0;
    const steps_strategy = this.learningStepsStrategy(
      parameters,
      card.state,
      card.learning_steps
    );
    const scheduled_minutes = Math.max(
      0,
      steps_strategy[grade]?.scheduled_minutes ?? 0
    );
    const next_steps = Math.max(0, steps_strategy[grade]?.next_step ?? 0);
    return {
      scheduled_minutes,
      next_steps
    };
  }
  /**
   * @description This function applies the learning steps based on the current card's state and grade.
   */
  applyLearningSteps(nextCard, grade, to_state) {
    const { scheduled_minutes, next_steps } = this.getLearningInfo(
      this.current,
      grade
    );
    if (scheduled_minutes > 0 && scheduled_minutes < 1440) {
      nextCard.learning_steps = next_steps;
      nextCard.scheduled_days = 0;
      nextCard.state = to_state;
      nextCard.due = date_scheduler(
        this.review_time,
        Math.round(scheduled_minutes),
        false
        /** true:days false: minute */
      );
    } else {
      nextCard.state = State.Review;
      if (scheduled_minutes >= 1440) {
        nextCard.learning_steps = next_steps;
        nextCard.due = date_scheduler(
          this.review_time,
          Math.round(scheduled_minutes),
          false
          /** true:days false: minute */
        );
        nextCard.scheduled_days = Math.floor(scheduled_minutes / 1440);
      } else {
        nextCard.learning_steps = 0;
        const interval = this.algorithm.next_interval(
          nextCard.stability,
          this.elapsed_days
        );
        nextCard.scheduled_days = interval;
        nextCard.due = date_scheduler(this.review_time, interval, true);
      }
    }
  }
  newState(grade) {
    const exist = this.next.get(grade);
    if (exist) {
      return exist;
    }
    const next = this.next_ds(this.elapsed_days, grade);
    this.applyLearningSteps(next, grade, State.Learning);
    const item = {
      card: next,
      log: this.buildLog(grade)
    };
    this.next.set(grade, item);
    return item;
  }
  learningState(grade) {
    const exist = this.next.get(grade);
    if (exist) {
      return exist;
    }
    const next = this.next_ds(this.elapsed_days, grade);
    this.applyLearningSteps(
      next,
      grade,
      this.last.state
      /** Learning or Relearning */
    );
    const item = {
      card: next,
      log: this.buildLog(grade)
    };
    this.next.set(grade, item);
    return item;
  }
  reviewState(grade) {
    const exist = this.next.get(grade);
    if (exist) {
      return exist;
    }
    const interval = this.elapsed_days;
    const retrievability = this.algorithm.forgetting_curve(
      interval,
      this.current.stability
    );
    const next_again = this.next_ds(interval, Rating.Again, retrievability);
    const next_hard = this.next_ds(interval, Rating.Hard, retrievability);
    const next_good = this.next_ds(interval, Rating.Good, retrievability);
    const next_easy = this.next_ds(interval, Rating.Easy, retrievability);
    this.next_interval(next_hard, next_good, next_easy, interval);
    this.next_state(next_hard, next_good, next_easy);
    this.applyLearningSteps(next_again, Rating.Again, State.Relearning);
    next_again.lapses += 1;
    const item_again = {
      card: next_again,
      log: this.buildLog(Rating.Again)
    };
    const item_hard = {
      card: next_hard,
      log: super.buildLog(Rating.Hard)
    };
    const item_good = {
      card: next_good,
      log: super.buildLog(Rating.Good)
    };
    const item_easy = {
      card: next_easy,
      log: super.buildLog(Rating.Easy)
    };
    this.next.set(Rating.Again, item_again);
    this.next.set(Rating.Hard, item_hard);
    this.next.set(Rating.Good, item_good);
    this.next.set(Rating.Easy, item_easy);
    return this.next.get(grade);
  }
  /**
   * Review next_ds
   */
  next_ds(t, g, r) {
    const next_state = this.algorithm.next_state(
      {
        difficulty: this.current.difficulty,
        stability: this.current.stability
      },
      t,
      g,
      r
    );
    const card = TypeConvert.card(this.current);
    card.difficulty = next_state.difficulty;
    card.stability = next_state.stability;
    return card;
  }
  /**
   * Review next_interval
   */
  next_interval(next_hard, next_good, next_easy, interval) {
    let hard_interval, good_interval;
    hard_interval = this.algorithm.next_interval(next_hard.stability, interval);
    good_interval = this.algorithm.next_interval(next_good.stability, interval);
    hard_interval = Math.min(hard_interval, good_interval);
    good_interval = Math.max(good_interval, hard_interval + 1);
    const easy_interval = Math.max(
      this.algorithm.next_interval(next_easy.stability, interval),
      good_interval + 1
    );
    next_hard.scheduled_days = hard_interval;
    next_hard.due = date_scheduler(this.review_time, hard_interval, true);
    next_good.scheduled_days = good_interval;
    next_good.due = date_scheduler(this.review_time, good_interval, true);
    next_easy.scheduled_days = easy_interval;
    next_easy.due = date_scheduler(this.review_time, easy_interval, true);
  }
  /**
   * Review next_state
   */
  next_state(next_hard, next_good, next_easy) {
    next_hard.state = State.Review;
    next_hard.learning_steps = 0;
    next_good.state = State.Review;
    next_good.learning_steps = 0;
    next_easy.state = State.Review;
    next_easy.learning_steps = 0;
  }
};
var LongTermScheduler = class extends AbstractScheduler {
  newState(grade) {
    const exist = this.next.get(grade);
    if (exist) {
      return exist;
    }
    this.current.scheduled_days = 0;
    this.current.elapsed_days = 0;
    const first_interval = 0;
    const next_again = this.next_ds(first_interval, Rating.Again);
    const next_hard = this.next_ds(first_interval, Rating.Hard);
    const next_good = this.next_ds(first_interval, Rating.Good);
    const next_easy = this.next_ds(first_interval, Rating.Easy);
    this.next_interval(
      next_again,
      next_hard,
      next_good,
      next_easy,
      first_interval
    );
    this.next_state(next_again, next_hard, next_good, next_easy);
    this.update_next(next_again, next_hard, next_good, next_easy);
    return this.next.get(grade);
  }
  next_ds(t, g, r) {
    const next_state = this.algorithm.next_state(
      {
        difficulty: this.current.difficulty,
        stability: this.current.stability
      },
      t,
      g,
      r
    );
    const card = TypeConvert.card(this.current);
    card.difficulty = next_state.difficulty;
    card.stability = next_state.stability;
    return card;
  }
  /**
   * @see https://github.com/open-spaced-repetition/ts-fsrs/issues/98#issuecomment-2241923194
   */
  learningState(grade) {
    return this.reviewState(grade);
  }
  reviewState(grade) {
    const exist = this.next.get(grade);
    if (exist) {
      return exist;
    }
    const interval = this.elapsed_days;
    const retrievability = this.algorithm.forgetting_curve(
      interval,
      this.current.stability
    );
    const next_again = this.next_ds(interval, Rating.Again, retrievability);
    const next_hard = this.next_ds(interval, Rating.Hard, retrievability);
    const next_good = this.next_ds(interval, Rating.Good, retrievability);
    const next_easy = this.next_ds(interval, Rating.Easy, retrievability);
    this.next_interval(next_again, next_hard, next_good, next_easy, interval);
    this.next_state(next_again, next_hard, next_good, next_easy);
    next_again.lapses += 1;
    this.update_next(next_again, next_hard, next_good, next_easy);
    return this.next.get(grade);
  }
  /**
   * Review/New next_interval
   */
  next_interval(next_again, next_hard, next_good, next_easy, interval) {
    let again_interval, hard_interval, good_interval, easy_interval;
    again_interval = this.algorithm.next_interval(
      next_again.stability,
      interval
    );
    hard_interval = this.algorithm.next_interval(next_hard.stability, interval);
    good_interval = this.algorithm.next_interval(next_good.stability, interval);
    easy_interval = this.algorithm.next_interval(next_easy.stability, interval);
    again_interval = Math.min(again_interval, hard_interval);
    hard_interval = Math.max(hard_interval, again_interval + 1);
    good_interval = Math.max(good_interval, hard_interval + 1);
    easy_interval = Math.max(easy_interval, good_interval + 1);
    next_again.scheduled_days = again_interval;
    next_again.due = date_scheduler(this.review_time, again_interval, true);
    next_hard.scheduled_days = hard_interval;
    next_hard.due = date_scheduler(this.review_time, hard_interval, true);
    next_good.scheduled_days = good_interval;
    next_good.due = date_scheduler(this.review_time, good_interval, true);
    next_easy.scheduled_days = easy_interval;
    next_easy.due = date_scheduler(this.review_time, easy_interval, true);
  }
  /**
   * Review/New next_state
   */
  next_state(next_again, next_hard, next_good, next_easy) {
    next_again.state = State.Review;
    next_again.learning_steps = 0;
    next_hard.state = State.Review;
    next_hard.learning_steps = 0;
    next_good.state = State.Review;
    next_good.learning_steps = 0;
    next_easy.state = State.Review;
    next_easy.learning_steps = 0;
  }
  update_next(next_again, next_hard, next_good, next_easy) {
    const item_again = {
      card: next_again,
      log: this.buildLog(Rating.Again)
    };
    const item_hard = {
      card: next_hard,
      log: super.buildLog(Rating.Hard)
    };
    const item_good = {
      card: next_good,
      log: super.buildLog(Rating.Good)
    };
    const item_easy = {
      card: next_easy,
      log: super.buildLog(Rating.Easy)
    };
    this.next.set(Rating.Again, item_again);
    this.next.set(Rating.Hard, item_hard);
    this.next.set(Rating.Good, item_good);
    this.next.set(Rating.Easy, item_easy);
  }
};
var Reschedule = class {
  /**
   * Creates an instance of the `Reschedule` class.
   * @param fsrs - An instance of the FSRS class used for scheduling.
   */
  constructor(fsrs2) {
    __publicField(this, "fsrs");
    this.fsrs = fsrs2;
  }
  /**
   * Replays a review for a card and determines the next review date based on the given rating.
   * @param card - The card being reviewed.
   * @param reviewed - The date the card was reviewed.
   * @param rating - The grade given to the card during the review.
   * @returns A `RecordLogItem` containing the updated card and review log.
   */
  replay(card, reviewed, rating) {
    return this.fsrs.next(card, reviewed, rating);
  }
  /**
   * Processes a manual review for a card, allowing for custom state, stability, difficulty, and due date.
   * @param card - The card being reviewed.
   * @param state - The state of the card after the review.
   * @param reviewed - The date the card was reviewed.
   * @param elapsed_days - The number of days since the last review.
   * @param stability - (Optional) The stability of the card.
   * @param difficulty - (Optional) The difficulty of the card.
   * @param due - (Optional) The due date for the next review.
   * @returns A `RecordLogItem` containing the updated card and review log.
   * @throws Will throw an error if the state or due date is not provided when required.
   */
  handleManualRating(card, state, reviewed, elapsed_days, stability, difficulty, due) {
    if (typeof state === "undefined") {
      throw new FSRSValidationError(
        "reschedule: state is required for manual rating"
      );
    }
    let log;
    let next_card;
    if (state === State.New) {
      log = {
        rating: Rating.Manual,
        state,
        due: due ?? reviewed,
        stability: card.stability,
        difficulty: card.difficulty,
        elapsed_days,
        last_elapsed_days: card.elapsed_days,
        scheduled_days: card.scheduled_days,
        learning_steps: card.learning_steps,
        review: reviewed
      };
      next_card = createEmptyCard(reviewed);
      next_card.last_review = reviewed;
    } else {
      if (typeof due === "undefined") {
        throw new FSRSValidationError(
          "reschedule: due is required for manual rating"
        );
      }
      const scheduled_days = date_diff(due, reviewed, "days");
      log = {
        rating: Rating.Manual,
        state: card.state,
        due: card.last_review || card.due,
        stability: card.stability,
        difficulty: card.difficulty,
        elapsed_days,
        last_elapsed_days: card.elapsed_days,
        scheduled_days: card.scheduled_days,
        learning_steps: card.learning_steps,
        review: reviewed
      };
      next_card = {
        ...card,
        state,
        due,
        last_review: reviewed,
        stability: stability || card.stability,
        difficulty: difficulty || card.difficulty,
        elapsed_days,
        scheduled_days,
        reps: card.reps + 1
      };
    }
    return { card: next_card, log };
  }
  /**
   * Reschedules a card based on its review history.
   *
   * @param current_card - The card to be rescheduled.
   * @param reviews - An array of review history objects.
   * @returns An array of record log items representing the rescheduling process.
   */
  reschedule(current_card, reviews) {
    const collections = [];
    let cur_card = createEmptyCard(current_card.due);
    for (const review of reviews) {
      let item;
      review.review = TypeConvert.time(review.review);
      if (review.rating === Rating.Manual) {
        let interval = 0;
        if (cur_card.state !== State.New && cur_card.last_review) {
          interval = date_diff(review.review, cur_card.last_review, "days");
        }
        item = this.handleManualRating(
          cur_card,
          review.state,
          review.review,
          interval,
          review.stability,
          review.difficulty,
          review.due ? TypeConvert.time(review.due) : void 0
        );
      } else {
        item = this.replay(cur_card, review.review, review.rating);
      }
      collections.push(item);
      cur_card = item.card;
    }
    return collections;
  }
  calculateManualRecord(current_card, now, record_log_item, update_memory) {
    if (!record_log_item) {
      return null;
    }
    const { card: reschedule_card, log } = record_log_item;
    const cur_card = TypeConvert.card(current_card);
    if (cur_card.due.getTime() === reschedule_card.due.getTime()) {
      return null;
    }
    cur_card.scheduled_days = date_diff(
      reschedule_card.due,
      cur_card.due,
      "days"
    );
    return this.handleManualRating(
      cur_card,
      reschedule_card.state,
      TypeConvert.time(now),
      log.elapsed_days,
      update_memory ? reschedule_card.stability : void 0,
      update_memory ? reschedule_card.difficulty : void 0,
      reschedule_card.due
    );
  }
};
function applyAfterHandler(value, afterHandler) {
  return typeof afterHandler === "function" ? afterHandler(value) : value;
}
var FSRS = class extends FSRSAlgorithm {
  constructor(param) {
    super(param);
    __publicField(this, "strategyHandler", /* @__PURE__ */ new Map());
    __publicField(this, "Scheduler");
    const { enable_short_term } = this.parameters;
    this.Scheduler = enable_short_term ? BasicScheduler : LongTermScheduler;
  }
  params_handler_proxy() {
    const _this = this;
    return {
      set: function(target, prop, value) {
        if (prop === "request_retention" && Number.isFinite(value)) {
          _this.intervalModifier = _this.calculate_interval_modifier(
            Number(value)
          );
        } else if (prop === "enable_short_term") {
          _this.Scheduler = value === true ? BasicScheduler : LongTermScheduler;
        } else if (prop === "w") {
          value = migrateParameters(
            value,
            target.relearning_steps.length,
            target.enable_short_term
          );
          _this.forgetting_curve = forgetting_curve.bind(this, value);
          _this.intervalModifier = _this.calculate_interval_modifier(
            Number(target.request_retention)
          );
        }
        Reflect.set(target, prop, value);
        return true;
      }
    };
  }
  useStrategy(mode, handler) {
    this.strategyHandler.set(mode, handler);
    return this;
  }
  clearStrategy(mode) {
    if (mode) {
      this.strategyHandler.delete(mode);
    } else {
      this.strategyHandler.clear();
    }
    return this;
  }
  getScheduler(card, now) {
    const schedulerStrategy = this.strategyHandler.get(
      StrategyMode.SCHEDULER
    );
    const Scheduler = schedulerStrategy || this.Scheduler;
    const instance = new Scheduler(card, now, this, this.strategyHandler);
    return instance;
  }
  /**
   * Display the collection of cards and logs for the four scenarios after scheduling the card at the current time.
   * @param card Card to be processed
   * @param now Current time or scheduled time
   * @param afterHandler Convert the result to another type. (Optional)
   * @example
   * ```typescript
   * const card: Card = createEmptyCard(new Date());
   * const f = fsrs();
   * const recordLog = f.repeat(card, new Date());
   * ```
   * @example
   * ```typescript
   * interface RevLogUnchecked
   *   extends Omit<ReviewLog, "due" | "review" | "state" | "rating"> {
   *   cid: string;
   *   due: Date | number;
   *   state: StateType;
   *   review: Date | number;
   *   rating: RatingType;
   * }
   *
   * interface RepeatRecordLog {
   *   card: CardUnChecked; //see method: createEmptyCard
   *   log: RevLogUnchecked;
   * }
   *
   * function repeatAfterHandler(recordLog: RecordLog) {
   *     const record: { [key in Grade]: RepeatRecordLog } = {} as {
   *       [key in Grade]: RepeatRecordLog;
   *     };
   *     for (const grade of Grades) {
   *       record[grade] = {
   *         card: {
   *           ...(recordLog[grade].card as Card & { cid: string }),
   *           due: recordLog[grade].card.due.getTime(),
   *           state: State[recordLog[grade].card.state] as StateType,
   *           last_review: recordLog[grade].card.last_review
   *             ? recordLog[grade].card.last_review!.getTime()
   *             : null,
   *         },
   *         log: {
   *           ...recordLog[grade].log,
   *           cid: (recordLog[grade].card as Card & { cid: string }).cid,
   *           due: recordLog[grade].log.due.getTime(),
   *           review: recordLog[grade].log.review.getTime(),
   *           state: State[recordLog[grade].log.state] as StateType,
   *           rating: Rating[recordLog[grade].log.rating] as RatingType,
   *         },
   *       };
   *     }
   *     return record;
   * }
   * const card: Card = createEmptyCard(new Date(), cardAfterHandler); //see method:  createEmptyCard
   * const f = fsrs();
   * const recordLog = f.repeat(card, new Date(), repeatAfterHandler);
   * ```
   */
  repeat(card, now, afterHandler) {
    const instance = this.getScheduler(card, now);
    const recordLog = instance.preview();
    return applyAfterHandler(recordLog, afterHandler);
  }
  /**
   * Display the collection of cards and logs for the card scheduled at the current time, after applying a specific grade rating.
   * @param card Card to be processed
   * @param now Current time or scheduled time
   * @param grade Rating of the review (Again, Hard, Good, Easy)
   * @param afterHandler Convert the result to another type. (Optional)
   * @example
   * ```typescript
   * const card: Card = createEmptyCard(new Date());
   * const f = fsrs();
   * const recordLogItem = f.next(card, new Date(), Rating.Again);
   * ```
   * @example
   * ```typescript
   * interface RevLogUnchecked
   *   extends Omit<ReviewLog, "due" | "review" | "state" | "rating"> {
   *   cid: string;
   *   due: Date | number;
   *   state: StateType;
   *   review: Date | number;
   *   rating: RatingType;
   * }
   *
   * interface NextRecordLog {
   *   card: CardUnChecked; //see method: createEmptyCard
   *   log: RevLogUnchecked;
   * }
   *
  function nextAfterHandler(recordLogItem: RecordLogItem) {
    const recordItem = {
      card: {
        ...(recordLogItem.card as Card & { cid: string }),
        due: recordLogItem.card.due.getTime(),
        state: State[recordLogItem.card.state] as StateType,
        last_review: recordLogItem.card.last_review
          ? recordLogItem.card.last_review!.getTime()
          : null,
      },
      log: {
        ...recordLogItem.log,
        cid: (recordLogItem.card as Card & { cid: string }).cid,
        due: recordLogItem.log.due.getTime(),
        review: recordLogItem.log.review.getTime(),
        state: State[recordLogItem.log.state] as StateType,
        rating: Rating[recordLogItem.log.rating] as RatingType,
      },
    };
    return recordItem
  }
   * const card: Card = createEmptyCard(new Date(), cardAfterHandler); //see method:  createEmptyCard
   * const f = fsrs();
   * const recordLogItem = f.repeat(card, new Date(), Rating.Again, nextAfterHandler);
   * ```
   */
  next(card, now, grade, afterHandler) {
    const instance = this.getScheduler(card, now);
    const g = TypeConvert.rating(grade);
    if (g === Rating.Manual) {
      throw new FSRSValidationError("Cannot review a manual rating");
    }
    const recordLogItem = instance.review(g);
    return applyAfterHandler(recordLogItem, afterHandler);
  }
  /**
   * Get the retrievability of the card
   * @param card  Card to be processed
   * @param now  Current time or scheduled time
   * @param format  default:true , Convert the result to another type. (Optional)
   * @returns  The retrievability of the card,if format is true, the result is a string, otherwise it is a number
   */
  get_retrievability(card, now, format = true) {
    const processedCard = TypeConvert.card(card);
    now = now ? TypeConvert.time(now) : /* @__PURE__ */ new Date();
    const t = processedCard.state !== State.New ? Math.max(date_diff(now, processedCard.last_review, "days"), 0) : 0;
    const r = processedCard.state !== State.New ? this.forgetting_curve(t, +processedCard.stability.toFixed(8)) : 0;
    return format ? `${(r * 100).toFixed(2)}%` : r;
  }
  /**
   *
   * @param card Card to be processed
   * @param log last review log
   * @param afterHandler Convert the result to another type. (Optional)
   * @example
   * ```typescript
   * const now = new Date();
   * const f = fsrs();
   * const emptyCardFormAfterHandler = createEmptyCard(now);
   * const repeatFormAfterHandler = f.repeat(emptyCardFormAfterHandler, now);
   * const { card, log } = repeatFormAfterHandler[Rating.Hard];
   * const rollbackFromAfterHandler = f.rollback(card, log);
   * ```
   *
   * @example
   * ```typescript
   * const now = new Date();
   * const f = fsrs();
   * const emptyCardFormAfterHandler = createEmptyCard(now, cardAfterHandler);  //see method: createEmptyCard
   * const repeatFormAfterHandler = f.repeat(emptyCardFormAfterHandler, now, repeatAfterHandler); //see method: fsrs.repeat()
   * const { card, log } = repeatFormAfterHandler[Rating.Hard];
   * const rollbackFromAfterHandler = f.rollback(card, log, cardAfterHandler);
   * ```
   */
  rollback(card, log, afterHandler) {
    const processedCard = TypeConvert.card(card);
    const processedLog = TypeConvert.review_log(log);
    if (processedLog.rating === Rating.Manual) {
      throw new FSRSValidationError("Cannot rollback a manual rating");
    }
    let last_due;
    let last_review;
    let last_lapses;
    switch (processedLog.state) {
      case State.New:
        last_due = processedLog.due;
        last_review = void 0;
        last_lapses = 0;
        break;
      case State.Learning:
      case State.Relearning:
      case State.Review:
        last_due = processedLog.review;
        last_review = processedLog.due;
        last_lapses = processedCard.lapses - (processedLog.rating === Rating.Again && processedLog.state === State.Review ? 1 : 0);
        break;
    }
    const prevCard = {
      ...processedCard,
      due: last_due,
      stability: processedLog.stability,
      difficulty: processedLog.difficulty,
      elapsed_days: processedLog.last_elapsed_days,
      scheduled_days: processedLog.scheduled_days,
      reps: Math.max(0, processedCard.reps - 1),
      lapses: Math.max(0, last_lapses),
      learning_steps: processedLog.learning_steps,
      state: processedLog.state,
      last_review
    };
    return applyAfterHandler(prevCard, afterHandler);
  }
  /**
   *
   * @param card Card to be processed
   * @param now Current time or scheduled time
   * @param reset_count Should the review count information(reps,lapses) be reset. (Optional)
   * @param afterHandler Convert the result to another type. (Optional)
   * @example
   * ```typescript
   * const now = new Date();
   * const f = fsrs();
   * const emptyCard = createEmptyCard(now);
   * const scheduling_cards = f.repeat(emptyCard, now);
   * const { card, log } = scheduling_cards[Rating.Hard];
   * const forgetCard = f.forget(card, new Date(), true);
   * ```
   *
   * @example
   * ```typescript
   * interface RepeatRecordLog {
   *   card: CardUnChecked; //see method: createEmptyCard
   *   log: RevLogUnchecked; //see method: fsrs.repeat()
   * }
   *
   * function forgetAfterHandler(recordLogItem: RecordLogItem): RepeatRecordLog {
   *     return {
   *       card: {
   *         ...(recordLogItem.card as Card & { cid: string }),
   *         due: recordLogItem.card.due.getTime(),
   *         state: State[recordLogItem.card.state] as StateType,
   *         last_review: recordLogItem.card.last_review
   *           ? recordLogItem.card.last_review!.getTime()
   *           : null,
   *       },
   *       log: {
   *         ...recordLogItem.log,
   *         cid: (recordLogItem.card as Card & { cid: string }).cid,
   *         due: recordLogItem.log.due.getTime(),
   *         review: recordLogItem.log.review.getTime(),
   *         state: State[recordLogItem.log.state] as StateType,
   *         rating: Rating[recordLogItem.log.rating] as RatingType,
   *       },
   *     };
   * }
   * const now = new Date();
   * const f = fsrs();
   * const emptyCardFormAfterHandler = createEmptyCard(now, cardAfterHandler); //see method:  createEmptyCard
   * const repeatFormAfterHandler = f.repeat(emptyCardFormAfterHandler, now, repeatAfterHandler); //see method: fsrs.repeat()
   * const { card } = repeatFormAfterHandler[Rating.Hard];
   * const forgetFromAfterHandler = f.forget(card, date_scheduler(now, 1, true), false, forgetAfterHandler);
   * ```
   */
  forget(card, now, reset_count = false, afterHandler) {
    const processedCard = TypeConvert.card(card);
    now = TypeConvert.time(now);
    const scheduled_days = processedCard.state === State.New ? 0 : date_diff(now, processedCard.due, "days");
    const forget_log = {
      rating: Rating.Manual,
      state: processedCard.state,
      due: processedCard.due,
      stability: processedCard.stability,
      difficulty: processedCard.difficulty,
      elapsed_days: 0,
      last_elapsed_days: processedCard.elapsed_days,
      scheduled_days,
      learning_steps: processedCard.learning_steps,
      review: now
    };
    const forget_card = {
      ...processedCard,
      due: now,
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: reset_count ? 0 : processedCard.reps,
      lapses: reset_count ? 0 : processedCard.lapses,
      learning_steps: 0,
      state: State.New,
      last_review: processedCard.last_review
    };
    const recordLogItem = { card: forget_card, log: forget_log };
    return applyAfterHandler(recordLogItem, afterHandler);
  }
  /**
   * Reschedules the current card and returns the rescheduled collections and reschedule item.
   *
   * @template T - The type of the record log item.
   * @param {CardInput | Card} current_card - The current card to be rescheduled.
   * @param {Array<FSRSHistory>} reviews - The array of FSRSHistory objects representing the reviews.
   * @param {Partial<RescheduleOptions<T>>} options - The optional reschedule options.
   * @returns {IReschedule<T>} - The rescheduled collections and reschedule item.
   *
   * @example
   * ```typescript
   * const f = fsrs()
   * const grades: Grade[] = [Rating.Good, Rating.Good, Rating.Good, Rating.Good]
   * const reviews_at = [
   *   new Date(2024, 8, 13),
   *   new Date(2024, 8, 13),
   *   new Date(2024, 8, 17),
   *   new Date(2024, 8, 28),
   * ]
   *
   * const reviews: FSRSHistory[] = []
   * for (let i = 0; i < grades.length; i++) {
   *   reviews.push({
   *     rating: grades[i],
   *     review: reviews_at[i],
   *   })
   * }
   *
   * const results_short = scheduler.reschedule(
   *   createEmptyCard(),
   *   reviews,
   *   {
   *     skipManual: false,
   *   }
   * )
   * console.log(results_short)
   * ```
   */
  reschedule(current_card, reviews = [], options = {}) {
    const {
      recordLogHandler,
      reviewsOrderBy,
      skipManual = true,
      now = /* @__PURE__ */ new Date(),
      update_memory_state: updateMemoryState = false
    } = options;
    if (reviewsOrderBy && typeof reviewsOrderBy === "function") {
      reviews.sort(reviewsOrderBy);
    }
    if (skipManual) {
      reviews = reviews.filter((review) => review.rating !== Rating.Manual);
    }
    const rescheduleSvc = new Reschedule(this);
    const collections = rescheduleSvc.reschedule(
      options.first_card || createEmptyCard(),
      reviews
    );
    const len = collections.length;
    const cur_card = TypeConvert.card(current_card);
    const manual_item = rescheduleSvc.calculateManualRecord(
      cur_card,
      now,
      len ? collections[len - 1] : void 0,
      updateMemoryState
    );
    return {
      collections: typeof recordLogHandler === "function" ? collections.map(recordLogHandler) : collections,
      reschedule_item: manual_item ? applyAfterHandler(manual_item, recordLogHandler) : null
    };
  }
};
var fsrs = (params) => {
  return new FSRS(params || {});
};

// src/srs.ts
function makeScheduler(requestRetention) {
  return fsrs(
    generatorParameters({
      request_retention: requestRetention,
      enable_fuzz: true
    })
  );
}
function fsrsFromFrontmatter(fm, prefix = "srs_") {
  const empty = createEmptyCard(/* @__PURE__ */ new Date());
  if (fm[`${prefix}due`] == null) return empty;
  const num = (v, fallback) => typeof v === "number" && isFinite(v) ? v : fallback;
  const date = (v) => {
    if (typeof v !== "string" && !(v instanceof Date)) return void 0;
    const d = new Date(v);
    return isNaN(d.getTime()) ? void 0 : d;
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
    state: num(fm[`${prefix}state`], State.New),
    last_review: date(fm[`${prefix}last_review`])
  };
}
function fsrsToFrontmatter(card, fm, prefix = "srs_") {
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
function round4(n) {
  return Math.round(n * 1e4) / 1e4;
}
function formatInterval(from, due) {
  const mins = Math.max(1, Math.round((due.getTime() - from.getTime()) / 6e4));
  if (mins < 60) return `${mins} ph`;
  const hours = mins / 60;
  if (hours < 24) return `${Math.round(hours)} gi\u1EDD`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)} ng\xE0y`;
  const months = days / 30.44;
  if (months < 12) return `${months.toFixed(1)} th`;
  return `${(days / 365.25).toFixed(1)} n\u0103m`;
}

// src/practice.ts
var MODE_INFO = {
  mix: {
    icon: "\u{1F500}",
    name: "Tr\u1ED9n t\u1EA5t c\u1EA3 (Mix)",
    desc: "\u0110\u1ED5i format ng\u1EABu nhi\xEAn m\u1ED7i c\xE2u \u2014 Cloze, G\xF5 t\u1EEB, X\u1EBFp c\xE2u, Tr\u1EAFc nghi\u1EC7m, T\xECm l\u1ED7i, N\u1ED1i c\u1EB7p"
  },
  cloze: {
    icon: "\u{1F9E9}",
    name: "\u0110i\u1EC1n khuy\u1EBFt (Cloze)",
    desc: "C\xE2u th\u1EADt t\u1EEB video b\u1ECB che t\u1EEB \u2014 \u0111i\u1EC1n l\u1EA1i t\u1EEB c\xF2n thi\u1EBFu"
  },
  typing: {
    icon: "\u2328\uFE0F",
    name: "G\xF5 t\u1EEB (Recall)",
    desc: "Nh\xECn ngh\u0129a Vi\u1EC7t + g\u1EE3i \xFD \u2192 g\xF5 \u0111\xFAng t\u1EEB ti\u1EBFng Anh"
  },
  builder: {
    icon: "\u{1F9F1}",
    name: "X\u1EBFp c\xE2u (Builder)",
    desc: "X\xE1o tr\u1ED9n c\xE2u quote \u2014 b\u1EA5m x\u1EBFp l\u1EA1i \u0111\xFAng th\u1EE9 t\u1EF1"
  },
  choice: {
    icon: "\u2705",
    name: "Tr\u1EAFc nghi\u1EC7m (Choice)",
    desc: "Ch\u1ECDn ngh\u0129a \u0111\xFAng trong 4 \u0111\xE1p \xE1n"
  },
  match: {
    icon: "\u{1F3B4}",
    name: "N\u1ED1i c\u1EB7p (Match)",
    desc: "N\u1ED1i t\u1EEB v\u1EDBi ngh\u0129a \u2014 6 c\u1EB7p m\u1ED7i v\xF2ng, ki\u1EC3u Quizlet"
  },
  error: {
    icon: "\u{1F575}\uFE0F",
    name: "T\xECm l\u1ED7i (Spot the error)",
    desc: "C\xE2u quote b\u1ECB c\xE0i 1 l\u1ED7i ng\u1EEF ph\xE1p \u2014 b\u1EA5m v\xE0o t\u1EEB sai"
  }
};
var normalize = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();
function editDistance(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev, dp[j], dp[j - 1]) + 1;
      prev = tmp;
    }
  }
  return dp[b.length];
}
function fuzzyEqual(input, answers) {
  const inp = normalize(input);
  if (!inp) return false;
  for (const ans of answers) {
    const a = normalize(ans);
    if (!a) continue;
    if (inp === a) return true;
    if (a.length > 4 && editDistance(inp, a) <= 1) return true;
  }
  return false;
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function sample(arr, n) {
  return shuffle(arr).slice(0, n);
}
function findSurface(quote, word) {
  const tokens = word.trim().split(/\s+/);
  const tryPatterns = [];
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (tokens.length <= 6) {
    const flexLast = tokens.map((t, i) => i === tokens.length - 1 ? `${esc(t)}(?:s|es|ed|d|ing)?` : esc(t)).join("\\s+");
    tryPatterns.push(flexLast);
  }
  const longest = [...tokens].sort((a, b) => b.length - a.length)[0];
  if (longest && longest.length > 3) tryPatterns.push(`${esc(longest)}(?:s|es|ed|d|ing)?`);
  for (const p of tryPatterns) {
    const m = quote.match(new RegExp(`(^|[^A-Za-z])(${p})($|[^A-Za-z])`, "i"));
    if (m && m.index != null) {
      const start = m.index + m[1].length;
      const surface = m[2];
      return { pre: quote.slice(0, start), surface, post: quote.slice(start + surface.length) };
    }
  }
  return null;
}
function makeCloze(card) {
  if (!card.quote) return null;
  const hit = findSurface(card.quote, card.word);
  if (!hit) return null;
  return { mode: "cloze", card, ...hit };
}
function makeTyping(card) {
  if (card.type === "sentence" || card.type === "passage" || card.type === "grammar") return null;
  if (!card.meaningVi && !card.meaningEn) return null;
  return { mode: "typing", card };
}
var MAX_BUILDER_TOKENS = 14;
function makeBuilder(card) {
  const text = card.quote || card.word;
  let tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 4) return null;
  if (tokens.length > MAX_BUILDER_TOKENS) {
    const firstWord = normalize(card.word).split(" ")[0];
    let center = tokens.findIndex((t) => normalize(t).includes(firstWord));
    if (center === -1) center = Math.floor(tokens.length / 2);
    const start = Math.max(0, Math.min(center - Math.floor(MAX_BUILDER_TOKENS / 2), tokens.length - MAX_BUILDER_TOKENS));
    tokens = tokens.slice(start, start + MAX_BUILDER_TOKENS);
  }
  let shuffled = shuffle(tokens);
  let guard = 0;
  while (shuffled.join(" ") === tokens.join(" ") && guard++ < 5) shuffled = shuffle(tokens);
  return { mode: "builder", card, tokens, shuffled };
}
function makeChoice(card, pool) {
  if (card.type === "sentence" || card.type === "passage" || card.type === "grammar") return null;
  const answer = card.meaningVi || card.meaningEn;
  if (!answer) return null;
  const sameCat = pool.filter((c) => c !== card && c.category === card.category);
  const others = pool.filter((c) => c !== card && c.category !== card.category);
  const distractors = [];
  for (const c of [...shuffle(sameCat), ...shuffle(others)]) {
    const m = c.meaningVi || c.meaningEn;
    if (m && m !== answer && !distractors.includes(m)) distractors.push(m);
    if (distractors.length === 3) break;
  }
  if (distractors.length < 3) return null;
  const options = shuffle([answer, ...distractors]);
  return { mode: "choice", card, options, correctIndex: options.indexOf(answer) };
}
var CORRUPTION_PAIRS = [
  ["is", "are"],
  ["are", "is"],
  ["was", "were"],
  ["were", "was"],
  ["has", "have"],
  ["have", "has"],
  ["does", "do"],
  ["do", "does"],
  ["a", "an"],
  ["an", "a"],
  ["this", "these"],
  ["these", "this"],
  ["in", "on"],
  ["on", "in"],
  ["at", "on"],
  ["for", "to"],
  ["to", "for"],
  ["of", "off"],
  ["from", "of"],
  ["with", "by"],
  ["by", "with"],
  ["your", "you're"],
  ["their", "there"],
  ["its", "it's"],
  ["it's", "its"],
  ["than", "then"],
  ["then", "than"],
  ["much", "many"],
  ["many", "much"]
];
var CORRUPTION_MAP = new Map(CORRUPTION_PAIRS);
function makeError(card) {
  if (!card.quote) return null;
  const tokens = card.quote.split(/\s+/).filter(Boolean);
  if (tokens.length < 5 || tokens.length > 40) return null;
  const candidates = [];
  for (let i = 0; i < tokens.length; i++) {
    const bare2 = tokens[i].toLowerCase().replace(/[^a-z']/g, "");
    if (CORRUPTION_MAP.has(bare2)) candidates.push(i);
  }
  if (!candidates.length) return null;
  const idx = candidates[Math.floor(Math.random() * candidates.length)];
  const original = tokens[idx];
  const bare = original.toLowerCase().replace(/[^a-z']/g, "");
  let wrong = CORRUPTION_MAP.get(bare);
  if (/^[A-Z]/.test(original)) wrong = wrong[0].toUpperCase() + wrong.slice(1);
  const trailing = original.match(/[^a-zA-Z']+$/)?.[0] ?? "";
  const corrupted = [...tokens];
  corrupted[idx] = wrong + trailing;
  return { mode: "error", card, tokens: corrupted, wrongIndex: idx, correctToken: original };
}
var MATCH_PAIRS_PER_ROUND = 6;
function makeMatchRounds(cards, size) {
  const eligible = cards.filter(
    (c) => c.type !== "sentence" && c.type !== "passage" && c.type !== "grammar" && (c.meaningVi || c.meaningEn)
  );
  const rounds = Math.max(1, Math.ceil(size / MATCH_PAIRS_PER_ROUND));
  const need = rounds * MATCH_PAIRS_PER_ROUND;
  const picked = sample(eligible, Math.min(need, eligible.length));
  const items = [];
  for (let r = 0; r * MATCH_PAIRS_PER_ROUND < picked.length; r++) {
    const chunk = picked.slice(r * MATCH_PAIRS_PER_ROUND, (r + 1) * MATCH_PAIRS_PER_ROUND);
    if (chunk.length < 3) break;
    items.push({
      mode: "match",
      card: chunk[0],
      pairs: chunk.map((c) => ({
        card: c,
        word: c.word,
        meaning: (c.meaningVi || c.meaningEn).slice(0, 80)
      }))
    });
  }
  return items;
}
function buildPracticeQueue(mode, cards, size) {
  if (mode === "match") return makeMatchRounds(cards, size);
  const learned2 = cards.filter((c) => c.fsrs.state !== State.New);
  const fresh = cards.filter((c) => c.fsrs.state === State.New);
  const ordered = [...shuffle(learned2), ...shuffle(fresh)];
  const items = [];
  for (const card of ordered) {
    let item = null;
    if (mode === "cloze") item = makeCloze(card);
    else if (mode === "typing") item = makeTyping(card);
    else if (mode === "builder") item = makeBuilder(card);
    else if (mode === "error") item = makeError(card);
    else item = makeChoice(card, cards);
    if (item) items.push(item);
    if (items.length === size) break;
  }
  return items;
}
var SINGLE_CARD_MODES = ["cloze", "typing", "builder", "choice", "error"];
function makeSingleItem(mode, card, pool) {
  if (mode === "cloze") return makeCloze(card);
  if (mode === "typing") return makeTyping(card);
  if (mode === "builder") return makeBuilder(card);
  if (mode === "error") return makeError(card);
  if (mode === "choice") return makeChoice(card, pool);
  return null;
}
function buildMixedQueue(cards, size) {
  const learned2 = cards.filter((c) => c.fsrs.state !== State.New);
  const fresh = cards.filter((c) => c.fsrs.state === State.New);
  const ordered = shuffle([...shuffle(learned2), ...shuffle(fresh)]);
  const eligibleForMatch = (c) => c.type !== "sentence" && c.type !== "passage" && c.type !== "grammar" && (c.meaningVi || c.meaningEn);
  const used = /* @__PURE__ */ new Set();
  const items = [];
  let sinceMatch = 0;
  let idx = 0;
  while (items.length < size && idx < ordered.length) {
    const threshold = 4 + Math.floor(Math.random() * 2);
    if (sinceMatch >= threshold && items.length <= size - 3) {
      const batch = [];
      for (let k = idx; k < ordered.length && batch.length < MATCH_PAIRS_PER_ROUND; k++) {
        const c = ordered[k];
        if (!used.has(c.file.path) && eligibleForMatch(c)) batch.push(c);
      }
      if (batch.length >= 3) {
        for (const c of batch) used.add(c.file.path);
        items.push({
          mode: "match",
          card: batch[0],
          pairs: batch.map((c) => ({
            card: c,
            word: c.word,
            meaning: (c.meaningVi || c.meaningEn).slice(0, 80)
          }))
        });
        sinceMatch = 0;
        continue;
      }
    }
    const card = ordered[idx];
    idx++;
    if (used.has(card.file.path)) continue;
    let made = null;
    for (const t of shuffle(SINGLE_CARD_MODES)) {
      made = makeSingleItem(t, card, cards);
      if (made) break;
    }
    if (made) {
      used.add(card.file.path);
      items.push(made);
      sinceMatch++;
    }
  }
  return items;
}

// src/badges.ts
var totalReviews = (d) => Object.values(d.stats).reduce((s, x) => s + x.reviews, 0);
var totalPractice = (d) => Object.values(d.stats).reduce((s, x) => s + (x.practice ?? 0), 0);
var learned = (cards) => cards.filter((c) => c.fsrs.state !== State.New).length;
var level = (d) => Math.floor(d.xp / XP_PER_LEVEL) + 1;
var BADGES = [
  { id: "first-review", icon: "\u{1F331}", name: "Kh\u1EDFi \u0111\u1EA7u", desc: "L\u01B0\u1EE3t \xF4n \u0111\u1EA7u ti\xEAn", check: (c) => totalReviews(c.data) >= 1 },
  { id: "reviews-100", icon: "\u{1F4AF}", name: "Tr\u0103m tr\u1EADn", desc: "100 l\u01B0\u1EE3t \xF4n", check: (c) => totalReviews(c.data) >= 100 },
  { id: "reviews-1000", icon: "\u{1F3DB}\uFE0F", name: "Ngh\xECn tr\u1EADn", desc: "1.000 l\u01B0\u1EE3t \xF4n", check: (c) => totalReviews(c.data) >= 1e3 },
  { id: "streak-7", icon: "\u{1F525}", name: "Tu\u1EA7n l\u1EEDa", desc: "Chu\u1ED7i 7 ng\xE0y li\xEAn t\u1EE5c", check: (c) => c.streak >= 7 },
  { id: "streak-30", icon: "\u26A1", name: "Th\xE1ng th\xE9p", desc: "Chu\u1ED7i 30 ng\xE0y li\xEAn t\u1EE5c", check: (c) => c.streak >= 30 },
  { id: "learned-50", icon: "\u{1F4D6}", name: "Ng\u0169 th\u1EADp", desc: "\u0110\xE3 h\u1ECDc 50 th\u1EBB", check: (c) => learned(c.cards) >= 50 },
  { id: "learned-200", icon: "\u{1F393}", name: "H\u1ECDc gi\u1EA3", desc: "\u0110\xE3 h\u1ECDc 200 th\u1EBB", check: (c) => learned(c.cards) >= 200 },
  { id: "level-5", icon: "\u2B50", name: "Level 5", desc: "\u0110\u1EA1t level 5", check: (c) => level(c.data) >= 5 },
  { id: "level-10", icon: "\u{1F31F}", name: "Level 10", desc: "\u0110\u1EA1t level 10", check: (c) => level(c.data) >= 10 },
  { id: "quests-7", icon: "\u{1F3C6}", name: "Chi\u1EBFn binh nhi\u1EC7m v\u1EE5", desc: "Ho\xE0n th\xE0nh nhi\u1EC7m v\u1EE5 ng\xE0y 7 l\u1EA7n", check: (c) => c.data.questRewardDates.length >= 7 },
  { id: "practice-500", icon: "\u{1F3AF}", name: "Thi\u1EC7n x\u1EA1", desc: "500 c\xE2u luy\u1EC7n t\u1EADp", check: (c) => totalPractice(c.data) >= 500 },
  { id: "decks-5", icon: "\u{1F5C2}\uFE0F", name: "Nh\xE0 s\u01B0u t\u1EA7m", desc: "5 deck c\xF3 \u2265 5 th\u1EBB", check: (c) => {
    const m = /* @__PURE__ */ new Map();
    for (const card of c.cards) m.set(card.category, (m.get(card.category) ?? 0) + 1);
    return [...m.values()].filter((n) => n >= 5).length >= 5;
  } }
];
function checkBadges(ctx, todayKey2) {
  const fresh = [];
  for (const b of BADGES) {
    if (ctx.data.badges[b.id]) continue;
    try {
      if (b.check(ctx)) {
        ctx.data.badges[b.id] = todayKey2;
        fresh.push(b);
      }
    } catch {
    }
  }
  return fresh;
}

// src/reviewView.ts
var VIEW_TYPE_VOCAB = "vocab-forge-review";
var TYPE_LABELS = {
  word: "T\u1EEB",
  phrase: "C\u1EE5m t\u1EEB",
  idiom: "Th\xE0nh ng\u1EEF",
  collocation: "Collocation",
  sentence: "C\xE2u",
  passage: "\u0110o\u1EA1n",
  grammar: "Ng\u1EEF ph\xE1p"
};
var STATE_LABELS = {
  [State.New]: "M\u1EDBi",
  [State.Learning]: "\u0110ang h\u1ECDc",
  [State.Review]: "\xD4n t\u1EADp",
  [State.Relearning]: "H\u1ECDc l\u1EA1i"
};
var VocabReviewView = class _VocabReviewView extends import_obsidian3.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.section = "dashboard";
    this.currentDeck = "";
    this.deckSearch = "";
    this.deckLayout = "grid";
    this.queue = [];
    this.current = null;
    this.flipped = false;
    this.justFlipped = false;
    this.sessionDone = 0;
    this.sessionTotal = 0;
    this.sessionCategory = null;
    this.rating = false;
    // --- luyện tập
    this.practiceDeck = null;
    this.practiceSize = 10;
    this.practiceQueue = [];
    this.practiceIdx = 0;
    this.practiceScore = 0;
    this.practiceWrong = [];
    this.practiceMode = "cloze";
    this.practicePhase = "question";
    this.practiceCorrect = false;
    this.builderPicked = [];
    this.practiceInput = null;
    // --- AI production
    this.aiSentence = "";
    this.aiResult = null;
    this.aiBusy = false;
    this.storyBusy = false;
    // --- hội thoại roleplay
    this.chatMsgs = [];
    this.chatWords = [];
    this.chatSession = "";
    this.chatBusy = false;
    this.chatInput = "";
    // --- nối cặp (match)
    this.matchSel = null;
    this.matchDone = /* @__PURE__ */ new Set();
    this.matchMistaken = /* @__PURE__ */ new Set();
    this.matchWrongFlash = null;
    this.matchLocked = false;
  }
  getViewType() {
    return VIEW_TYPE_VOCAB;
  }
  getDisplayText() {
    return "Vocab Forge";
  }
  getIcon() {
    return "graduation-cap";
  }
  async onOpen() {
    this.registerDomEvent(document, "keydown", (evt) => this.onKey(evt));
    this.render();
  }
  renderHome() {
    this.section = "dashboard";
    this.render();
  }
  // ================================================================ SHELL
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("vf-root");
    const app = root.createDiv({ cls: "vf-app" });
    this.renderNav(app);
    const main = app.createDiv({ cls: "vf-main" });
    switch (this.section) {
      case "dashboard":
        this.renderDashboard(main);
        break;
      case "decks":
        this.renderDecks(main);
        break;
      case "deck-detail":
        this.renderDeckDetail(main);
        break;
      case "review":
        this.renderCard(main);
        break;
      case "done":
        this.renderDone(main);
        break;
      case "practice":
        this.renderPracticeHub(main);
        break;
      case "practice-run":
        this.renderPracticeRun(main);
        break;
      case "practice-done":
        this.renderPracticeDone(main);
        break;
      case "story":
        this.renderStory(main);
        break;
      case "chat":
        this.renderChat(main);
        break;
      case "settings":
        this.renderSettings(main);
        break;
    }
  }
  renderNav(app) {
    const nav = app.createDiv({ cls: "vf-nav" });
    const brand = nav.createDiv({ cls: "vf-brand" });
    const brandLeft = brand.createDiv({ cls: "vf-brand-left" });
    brandLeft.createSpan({ text: "\u{1F393}", cls: "vf-brand-icon" });
    brandLeft.createSpan({ text: "Vocab Forge", cls: "vf-brand-name" });
    const infoBtn = brand.createEl("button", {
      text: "\u2139\uFE0F",
      cls: "vf-brand-info-btn",
      attr: { "aria-label": "Th\xF4ng tin t\xE1c gi\u1EA3", title: "Th\xF4ng tin t\xE1c gi\u1EA3 Tony Hoang" }
    });
    infoBtn.onclick = (e) => {
      e.stopPropagation();
      new AboutModal(this.app, this.plugin).open();
    };
    const items = [
      { id: "dashboard", icon: "\u{1F3E0}", label: "Dashboard" },
      { id: "study", icon: "\u25B6\uFE0F", label: "H\u1ECDc ngay" },
      { id: "practice", icon: "\u{1F3AF}", label: "Luy\u1EC7n t\u1EADp" },
      { id: "chat", icon: "\u{1F4AC}", label: "H\u1ED9i tho\u1EA1i" },
      { id: "decks", icon: "\u{1F5C2}\uFE0F", label: "B\u1ED9 th\u1EBB" },
      { id: "add", icon: "\u2795", label: "Th\xEAm th\u1EBB" },
      { id: "settings", icon: "\u2699\uFE0F", label: "C\xE0i \u0111\u1EB7t" },
      { id: "about", icon: "\u2139\uFE0F", label: "Th\xF4ng tin" }
    ];
    for (const it of items) {
      const active = it.id === this.section || it.id === "study" && (this.section === "review" || this.section === "done") || it.id === "practice" && (this.section === "practice-run" || this.section === "practice-done") || it.id === "decks" && this.section === "deck-detail";
      const el = nav.createDiv({ cls: `vf-nav-item ${active ? "vf-nav-active" : ""}` });
      el.createSpan({ text: it.icon, cls: "vf-nav-icon" });
      el.createSpan({ text: it.label, cls: "vf-nav-label" });
      el.onclick = () => {
        if (it.id === "study") this.startSession(null);
        else if (it.id === "add") this.plugin.openAddCardModal();
        else if (it.id === "about") new AboutModal(this.app, this.plugin).open();
        else {
          this.section = it.id;
          this.render();
        }
      };
    }
    const foot = nav.createDiv({ cls: "vf-nav-foot" });
    const xp = this.plugin.data.xp;
    const level2 = Math.floor(xp / XP_PER_LEVEL) + 1;
    const lvlBox = foot.createDiv({ cls: "vf-nav-level" });
    lvlBox.createDiv({ text: `\u2B50 Level ${level2}`, cls: "vf-nav-level-name" });
    const lvlBar = lvlBox.createDiv({ cls: "vf-nav-level-bar" });
    lvlBar.createDiv({ cls: "vf-nav-level-fill" }).style.width = `${Math.round(xp % XP_PER_LEVEL / XP_PER_LEVEL * 100)}%`;
    lvlBox.createDiv({ text: `${xp} XP`, cls: "vf-nav-xp" });
    const chips = foot.createDiv({ cls: "vf-nav-chips" });
    chips.createSpan({ text: `\u{1F525} ${this.computeStreak()}`, cls: "vf-nav-streak" });
    chips.createSpan({ text: `\u{1F9CA} \xD7${this.plugin.data.freezes}`, cls: "vf-nav-freeze" });
  }
  // ============================================================ DASHBOARD
  renderDashboard(main) {
    const due = this.plugin.store.getDueEntries(this.plugin.settings.reverseEnabled);
    const news = this.plugin.store.getNewCards();
    const revNews = this.plugin.settings.reverseEnabled ? this.plugin.store.getRevNewCards() : [];
    const newAvailable = Math.min(news.length + revNews.length, this.plugin.newRemainingToday());
    const all = this.plugin.store.getAllCards();
    const learned2 = all.filter((c) => c.fsrs.state !== State.New).length;
    const today = this.plugin.data.stats[todayKey()];
    const total = due.length + newAvailable;
    const hero = main.createDiv({ cls: "vf-hero" });
    const heroLeft = hero.createDiv({ cls: "vf-hero-left" });
    heroLeft.createDiv({ text: this.greeting(), cls: "vf-hero-hi" });
    heroLeft.createDiv({
      text: total > 0 ? `H\xF4m nay c\xF3 ${due.length} th\u1EBB \u0111\u1EBFn h\u1EA1n v\xE0 ${newAvailable} th\u1EBB m\u1EDBi \u0111ang ch\u1EDD b\u1EA1n.` : "B\u1EA1n \u0111\xE3 ho\xE0n th\xE0nh m\u1EE5c ti\xEAu h\xF4m nay. Tuy\u1EC7t v\u1EDDi! \u{1F389}",
      cls: "vf-hero-sub"
    });
    const heroBtns = heroLeft.createDiv({ cls: "vf-hero-btns" });
    const startBtn = heroBtns.createEl("button", {
      text: total > 0 ? `\u25B6  H\u1ECDc ngay \xB7 ${total} th\u1EBB` : "\u2713 \u0110\xE3 xong h\xF4m nay",
      cls: "vf-btn-hero"
    });
    startBtn.disabled = total === 0;
    startBtn.onclick = () => this.startSession(null);
    const practiceBtn = heroBtns.createEl("button", { text: "\u{1F3AF} Luy\u1EC7n t\u1EADp", cls: "vf-btn-hero-ghost" });
    practiceBtn.onclick = () => {
      this.section = "practice";
      this.render();
    };
    const storyBtn = heroBtns.createEl("button", { text: "\u{1F4D6} Story h\xF4m nay", cls: "vf-btn-hero-ghost" });
    storyBtn.onclick = () => {
      this.section = "story";
      this.render();
    };
    const ring = hero.createDiv({ cls: "vf-hero-ring" });
    const pct = today ? Math.min(100, Math.round(today.reviews / Math.max(1, today.reviews + total) * 100)) : total > 0 ? 0 : 100;
    ring.style.setProperty("--vf-pct", String(pct));
    ring.createDiv({ text: `${pct}%`, cls: "vf-hero-ring-text" });
    const tiles = main.createDiv({ cls: "vf-tiles" });
    this.tile(tiles, "\u23F0", String(due.length), "\u0110\u1EBFn h\u1EA1n", "vf-tile-due");
    this.tile(tiles, "\u2728", String(newAvailable), "Th\u1EBB m\u1EDBi", "vf-tile-new");
    this.tile(tiles, "\u{1F4D6}", String(today?.reviews ?? 0), "L\u01B0\u1EE3t \xF4n h\xF4m nay", "");
    this.tile(tiles, "\u{1F3C6}", `${learned2}/${all.length}`, "\u0110\xE3 h\u1ECDc / t\u1ED5ng", "");
    const decks = this.groupByCategory(all);
    if (decks.size) {
      const head = main.createDiv({ cls: "vf-section-head" });
      head.createEl("h4", { text: "B\u1ED9 th\u1EBB" });
      const more = head.createEl("a", { text: "Xem t\u1EA5t c\u1EA3 \u2192", cls: "vf-link" });
      more.onclick = () => {
        this.section = "decks";
        this.render();
      };
      const row = main.createDiv({ cls: "vf-deck-row" });
      let i = 0;
      for (const [cat, cards] of [...decks.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 4)) {
        this.deckCard(row, cat, cards, i++);
      }
    }
    const quests = this.plugin.questProgress();
    if (quests.length) {
      const qhead = main.createDiv({ cls: "vf-section-head" });
      qhead.createEl("h4", { text: "Nhi\u1EC7m v\u1EE5 h\xF4m nay" });
      if (this.plugin.questRewardClaimed())
        qhead.createSpan({ text: "\u{1F3C6} \u0110\xE3 nh\u1EADn th\u01B0\u1EDFng", cls: "vf-quest-done-tag" });
      const qbox = main.createDiv({ cls: "vf-quest-box" });
      for (const q of quests) {
        const row = qbox.createDiv({ cls: "vf-quest-row" });
        row.createSpan({ text: q.icon, cls: "vf-quest-icon" });
        const mid2 = row.createDiv({ cls: "vf-quest-mid" });
        const lr = mid2.createDiv({ cls: "vf-quest-label-row" });
        lr.createSpan({ text: q.name, cls: "vf-quest-name" });
        lr.createSpan({
          text: q.cur >= q.goal ? "\u2713" : `${q.cur}/${q.goal}`,
          cls: q.cur >= q.goal ? "vf-quest-check" : "vf-quest-count"
        });
        const qb = mid2.createDiv({ cls: "vf-quest-bar" });
        qb.createDiv({ cls: "vf-quest-fill" }).style.width = `${Math.min(100, Math.round(q.cur / q.goal * 100))}%`;
      }
      qbox.createDiv({
        text: "Ho\xE0n th\xE0nh c\u1EA3 3 \u2192 +50 XP v\xE0 +1 \u{1F9CA} streak freeze",
        cls: "vf-quest-hint"
      });
    }
    main.createEl("h4", { text: "Ho\u1EA1t \u0111\u1ED9ng 17 tu\u1EA7n" });
    this.renderHeatmap(main.createDiv({ cls: "vf-heatmap" }));
    main.createEl("h4", { text: "D\u1EF1 b\xE1o th\u1EBB \u0111\u1EBFn h\u1EA1n \u2014 30 ng\xE0y t\u1EDBi" });
    this.renderForecast(main.createDiv({ cls: "vf-forecast" }), all);
    this.renderRetention(main);
    this.renderBadges(main);
    const hard = all.filter((c) => c.fsrs.lapses >= 2).sort((a, b) => b.fsrs.lapses - a.fsrs.lapses).slice(0, 6);
    if (hard.length) {
      main.createEl("h4", { text: "\u{1F624} T\u1EEB kh\xF3 nh\u1EB1n" });
      const list = main.createDiv({ cls: "vf-hard-list" });
      for (const c of hard) {
        const item = list.createDiv({ cls: "vf-hard-item" });
        item.createSpan({ text: c.word, cls: "vf-hard-word" });
        item.createSpan({ text: `qu\xEAn ${c.fsrs.lapses} l\u1EA7n`, cls: "vf-hard-count" });
        item.onclick = () => this.app.workspace.openLinkText(c.file.path, "", true);
      }
    }
  }
  greeting() {
    const h = (/* @__PURE__ */ new Date()).getHours();
    if (h < 11) return "Ch\xE0o bu\u1ED5i s\xE1ng, Ho\xE0ng! \u2600\uFE0F";
    if (h < 14) return "Ch\xE0o bu\u1ED5i tr\u01B0a, Ho\xE0ng! \u{1F324}";
    if (h < 18) return "Ch\xE0o bu\u1ED5i chi\u1EC1u, Ho\xE0ng! \u{1F307}";
    return "Ch\xE0o bu\u1ED5i t\u1ED1i, Ho\xE0ng! \u{1F319}";
  }
  tile(parent, icon, value, label, cls) {
    const t = parent.createDiv({ cls: `vf-tile ${cls}`.trim() });
    t.createDiv({ text: icon, cls: "vf-tile-icon" });
    const right = t.createDiv({ cls: "vf-tile-body" });
    right.createDiv({ text: value, cls: "vf-tile-value" });
    right.createDiv({ text: label, cls: "vf-tile-label" });
  }
  // ================================================================ DECKS
  groupByCategory(all) {
    const m = /* @__PURE__ */ new Map();
    for (const c of all) {
      const arr = m.get(c.category) ?? [];
      arr.push(c);
      m.set(c.category, arr);
    }
    return m;
  }
  deckStats(cards) {
    const cutoff = endOfToday().getTime();
    let due = 0, fresh = 0;
    for (const c of cards) {
      if (c.fsrs.state === State.New) fresh++;
      else if (c.fsrs.due.getTime() <= cutoff) due++;
    }
    return { due, fresh };
  }
  deckCard(parent, cat, cards, index) {
    const { due, fresh } = this.deckStats(cards);
    const el = parent.createDiv({ cls: `vf-deck vf-deck-c${index % 6}` });
    const top = el.createDiv({ cls: "vf-deck-top" });
    top.createSpan({ text: categoryEmoji(cat), cls: "vf-deck-emoji" });
    top.createSpan({ text: cat, cls: "vf-deck-name" });
    el.createDiv({ text: `${cards.length} th\u1EBB`, cls: "vf-deck-count" });
    const badges = el.createDiv({ cls: "vf-deck-badges" });
    if (due) badges.createSpan({ text: `${due} due`, cls: "vf-badge-due" });
    if (fresh) badges.createSpan({ text: `${fresh} m\u1EDBi`, cls: "vf-badge-fresh" });
    if (!due && !fresh) badges.createSpan({ text: "\u2713 xong", cls: "vf-badge-done" });
    el.onclick = () => {
      this.currentDeck = cat;
      this.deckSearch = "";
      this.section = "deck-detail";
      this.render();
    };
  }
  renderDecks(main) {
    main.createEl("h3", { text: "\u{1F5C2}\uFE0F B\u1ED9 th\u1EBB theo ch\u1EE7 \u0111\u1EC1" });
    const all = this.plugin.store.getAllCards();
    const decks = this.groupByCategory(all);
    if (!decks.size) {
      main.createDiv({ text: "Ch\u01B0a c\xF3 th\u1EBB n\xE0o. B\u1EA5m \u2795 Th\xEAm th\u1EBB \u0111\u1EC3 b\u1EAFt \u0111\u1EA7u.", cls: "vf-empty" });
      return;
    }
    const grid = main.createDiv({ cls: "vf-deck-grid" });
    let i = 0;
    for (const [cat, cards] of [...decks.entries()].sort((a, b) => b[1].length - a[1].length)) {
      this.deckCard(grid, cat, cards, i++);
    }
  }
  renderDeckDetail(main) {
    const cat = this.currentDeck;
    const cards = this.plugin.store.getAllCards().filter((c) => c.category === cat);
    const { due, fresh } = this.deckStats(cards);
    const head = main.createDiv({ cls: "vf-deck-head" });
    const backBtn = head.createEl("button", { text: "\u2190", cls: "vf-btn-icon" });
    backBtn.onclick = () => {
      this.section = "decks";
      this.render();
    };
    head.createEl("h3", { text: `${categoryEmoji(cat)} ${cat}` });
    head.createSpan({ text: `${cards.length} th\u1EBB \xB7 ${due} due \xB7 ${fresh} m\u1EDBi`, cls: "vf-muted" });
    const actions = main.createDiv({ cls: "vf-actions" });
    const total = due + Math.min(fresh, this.plugin.newRemainingToday());
    const study = actions.createEl("button", {
      text: total > 0 ? `\u25B6  H\u1ECDc deck n\xE0y (${total})` : "\u2713 Deck \u0111\xE3 xong h\xF4m nay",
      cls: "vf-btn-hero vf-btn-hero-small"
    });
    study.disabled = total === 0;
    study.onclick = () => this.startSession(cat);
    const toolbar = main.createDiv({ cls: "vf-list-toolbar" });
    const search = toolbar.createEl("input", {
      cls: "vf-search",
      attr: { type: "text", placeholder: "\u{1F50D} T\xECm trong deck\u2026", value: this.deckSearch }
    });
    search.oninput = () => {
      this.deckSearch = search.value;
      this.renderDeckList(listEl, cards);
    };
    const toggle = toolbar.createDiv({ cls: "vf-layout-toggle" });
    const gridBtn = toggle.createEl("button", { text: "\u229E", cls: "vf-btn-icon" });
    const listBtn = toggle.createEl("button", { text: "\u2630", cls: "vf-btn-icon" });
    const syncToggle = () => {
      gridBtn.toggleClass("vf-toggle-active", this.deckLayout === "grid");
      listBtn.toggleClass("vf-toggle-active", this.deckLayout === "list");
    };
    gridBtn.onclick = () => {
      this.deckLayout = "grid";
      syncToggle();
      this.renderDeckList(listEl, cards);
    };
    listBtn.onclick = () => {
      this.deckLayout = "list";
      syncToggle();
      this.renderDeckList(listEl, cards);
    };
    syncToggle();
    const listEl = main.createDiv();
    this.renderDeckList(listEl, cards);
  }
  /** Ảnh đại diện thẻ: image trong frontmatter, fallback thumbnail YouTube từ source_url */
  thumbnailFor(card) {
    if (card.image) {
      let src = card.image.trim().replace(/^!?\[\[|\]\]$/g, "");
      if (/^https?:\/\//.test(src)) return src;
      const f = this.app.metadataCache.getFirstLinkpathDest(src, card.file.path);
      if (f) return this.app.vault.getResourcePath(f);
    }
    const m = card.sourceUrl.match(/(?:v=|youtu\.be\/|\/shorts\/)([\w-]{11})/);
    if (m) return `https://i.ytimg.com/vi/${m[1]}/mqdefault.jpg`;
    return null;
  }
  renderDeckList(listEl, cards) {
    listEl.empty();
    listEl.className = this.deckLayout === "grid" ? "vf-card-grid" : "vf-card-list";
    const q = this.deckSearch.toLowerCase();
    const filtered = cards.filter(
      (c) => !q || c.word.toLowerCase().includes(q) || c.meaningVi.toLowerCase().includes(q)
    );
    if (!filtered.length) {
      listEl.createDiv({ text: "Kh\xF4ng c\xF3 th\u1EBB n\xE0o kh\u1EDBp.", cls: "vf-empty" });
      return;
    }
    const sorted = filtered.sort((a, b) => a.word.localeCompare(b.word));
    if (this.deckLayout === "list") {
      for (const c of sorted) {
        const row = listEl.createDiv({ cls: "vf-card-row" });
        const left = row.createDiv({ cls: "vf-card-row-left" });
        left.createDiv({ text: c.word, cls: "vf-card-row-word" });
        left.createDiv({ text: c.meaningVi || c.meaningEn, cls: "vf-card-row-meaning" });
        const right = row.createDiv({ cls: "vf-card-row-right" });
        right.createSpan({ text: TYPE_LABELS[c.type] ?? c.type, cls: "vf-pill" });
        right.createSpan({
          text: STATE_LABELS[c.fsrs.state] ?? "?",
          cls: `vf-pill vf-pill-state-${c.fsrs.state}`
        });
        row.onclick = () => this.app.workspace.openLinkText(c.file.path, "", true);
      }
      return;
    }
    for (const c of sorted) {
      const tile = listEl.createDiv({ cls: "vf-tile-card" });
      const thumbBox = tile.createDiv({ cls: "vf-tile-thumb" });
      const thumb = this.thumbnailFor(c);
      if (thumb) {
        thumbBox.createEl("img", { attr: { src: thumb, loading: "lazy" } });
      } else {
        thumbBox.addClass("vf-tile-thumb-empty");
        thumbBox.createSpan({ text: categoryEmoji(c.category), cls: "vf-tile-thumb-emoji" });
      }
      thumbBox.createSpan({
        text: STATE_LABELS[c.fsrs.state] ?? "?",
        cls: `vf-pill vf-pill-float vf-pill-state-${c.fsrs.state}`
      });
      const body = tile.createDiv({ cls: "vf-tile-body2" });
      body.createDiv({ text: c.word, cls: "vf-tile-word" });
      body.createDiv({ text: c.meaningVi || c.meaningEn, cls: "vf-tile-meaning" });
      const foot = body.createDiv({ cls: "vf-tile-foot" });
      foot.createSpan({ text: TYPE_LABELS[c.type] ?? c.type, cls: "vf-pill" });
      const speak = foot.createEl("button", { text: "\u{1F50A}", cls: "vf-btn-tiny" });
      speak.onclick = (e) => {
        e.stopPropagation();
        this.plugin.speak(c.word);
      };
      tile.onclick = () => this.app.workspace.openLinkText(c.file.path, "", true);
    }
  }
  // =============================================================== REVIEW
  startSession(category) {
    this.sessionCategory = category;
    let due = this.plugin.store.getDueEntries(this.plugin.settings.reverseEnabled);
    let news = this.plugin.store.getNewCards();
    let revNews = this.plugin.settings.reverseEnabled ? this.plugin.store.getRevNewCards() : [];
    if (category) {
      due = due.filter((e) => e.card.category === category);
      news = news.filter((c) => c.category === category);
      revNews = revNews.filter((c) => c.category === category);
    }
    const budget = this.plugin.newRemainingToday();
    const newEntries = [
      ...news.map((c) => ({ card: c, dir: "fwd" })),
      ...revNews.map((c) => ({ card: c, dir: "rev" }))
    ].slice(0, budget);
    this.queue = [...due, ...newEntries];
    this.sessionTotal = this.queue.length;
    this.sessionDone = 0;
    if (!this.queue.length) {
      this.section = "dashboard";
      this.render();
      new import_obsidian3.Notice("Kh\xF4ng c\xF2n th\u1EBB \u0111\u1EC3 h\u1ECDc \u{1F389}");
      return;
    }
    this.section = "review";
    this.nextCard();
  }
  nextCard() {
    if (!this.queue.length) {
      this.section = "done";
      this.render();
      return;
    }
    const now = Date.now();
    const fsrsOf = (e) => e.dir === "fwd" ? e.card.fsrs : e.card.fsrsRev;
    let idx = this.queue.findIndex(
      (e) => fsrsOf(e).state === State.New || fsrsOf(e).due.getTime() <= now
    );
    if (idx === -1) idx = 0;
    this.current = this.queue.splice(idx, 1)[0];
    this.flipped = false;
    this.aiSentence = "";
    this.aiResult = null;
    this.render();
  }
  // --------------------------------------------------------- AI (mặt sau)
  renderAiSection(back, card) {
    const box = back.createDiv({ cls: "vf-ai-box" });
    if (card.mnemonic) {
      const mn = box.createDiv({ cls: "vf-ai-note vf-ai-mnemonic" });
      mn.createSpan({ text: "\u{1F9E0} ", cls: "vf-ai-note-icon" });
      mn.createSpan({ text: card.mnemonic });
    }
    if (card.grammarNote) {
      const gr = box.createDiv({ cls: "vf-ai-note vf-ai-grammar" });
      gr.createSpan({ text: "\u{1F4D6} ", cls: "vf-ai-note-icon" });
      gr.createSpan({ text: card.grammarNote });
    }
    if (card.myExample) {
      const ex = box.createDiv({ cls: "vf-ai-note vf-ai-example" });
      ex.createSpan({ text: "\u270D\uFE0F ", cls: "vf-ai-note-icon" });
      ex.createSpan({ text: card.myExample });
    }
    const btnRow = box.createDiv({ cls: "vf-ai-btn-row" });
    const mnBtn = btnRow.createEl("button", {
      text: card.mnemonic ? "\u{1F9E0} M\u1EB9o nh\u1EDB m\u1EDBi" : "\u{1F9E0} T\u1EA1o m\u1EB9o nh\u1EDB",
      cls: "vf-btn-icon vf-btn-ai"
    });
    mnBtn.onclick = () => void this.aiAction(mnBtn, async () => {
      const out = await runGrok(
        mnemonicPrompt(card.word, card.meaningVi || card.meaningEn),
        this.plugin.settings.grokPath
      );
      if (out) await this.plugin.store.saveExtraField(card, "mnemonic", out.split("\n")[0].trim());
    });
    if (card.quote) {
      const grBtn = btnRow.createEl("button", {
        text: card.grammarNote ? "\u{1F4D6} Gi\u1EA3i th\xEDch l\u1EA1i" : "\u{1F4D6} Gi\u1EA3i th\xEDch ng\u1EEF ph\xE1p",
        cls: "vf-btn-icon vf-btn-ai"
      });
      grBtn.onclick = () => void this.aiAction(grBtn, async () => {
        const out = await runGrok(grammarPrompt(card.quote), this.plugin.settings.grokPath);
        if (out) await this.plugin.store.saveExtraField(card, "grammar_note", out.trim());
      });
    }
    const writeBox = box.createDiv({ cls: "vf-ai-write" });
    const input = writeBox.createEl("input", {
      cls: "vf-practice-input vf-ai-input",
      attr: { type: "text", placeholder: `\u270D\uFE0F \u0110\u1EB7t c\xE2u c\u1EE7a b\u1EA1n v\u1EDBi "${card.word}"\u2026`, spellcheck: "false" }
    });
    input.value = this.aiSentence;
    input.oninput = () => this.aiSentence = input.value;
    input.onkeydown = (e) => e.stopPropagation();
    const checkBtn = writeBox.createEl("button", { text: "AI ch\u1EA5m", cls: "vf-btn-icon vf-btn-ai" });
    checkBtn.onclick = () => void this.aiAction(checkBtn, async () => {
      if (!this.aiSentence.trim()) {
        new import_obsidian3.Notice("G\xF5 c\xE2u c\u1EE7a b\u1EA1n tr\u01B0\u1EDBc \u0111\xE3");
        return;
      }
      const raw = await runGrok(
        sentenceCheckPrompt(card.word, card.meaningEn, this.aiSentence.trim()),
        this.plugin.settings.grokPath
      );
      this.aiResult = extractJson(raw);
      if (!this.aiResult) new import_obsidian3.Notice("AI tr\u1EA3 l\u1EDDi kh\xF4ng \u0111\xFAng \u0111\u1ECBnh d\u1EA1ng \u2014 th\u1EED l\u1EA1i");
    });
    if (this.aiResult) {
      const r = this.aiResult;
      const res = box.createDiv({
        cls: `vf-feedback ${r.score >= 7 ? "vf-feedback-ok" : "vf-feedback-no"} vf-ai-result`
      });
      res.createDiv({ text: `${r.score >= 7 ? "\u{1F44D}" : "\u{1F6E0}"} ${r.score}/10 \u2014 ${r.explain_vi}`, cls: "vf-feedback-text" });
      if (r.corrected && r.corrected.trim() && r.corrected.trim() !== this.aiSentence.trim())
        res.createDiv({ text: `\u2192 ${r.corrected}`, cls: "vf-feedback-meaning" });
      const save = res.createEl("button", { text: "\u{1F4BE} L\u01B0u c\xE2u v\xE0o th\u1EBB", cls: "vf-btn-icon" });
      save.onclick = async () => {
        const sentence = (r.score >= 7 ? this.aiSentence : r.corrected).trim();
        await this.plugin.store.saveExtraField(card, "my_example", sentence);
        new import_obsidian3.Notice("\u0110\xE3 l\u01B0u c\xE2u c\u1EE7a b\u1EA1n v\xE0o th\u1EBB \u270D\uFE0F");
        this.render();
      };
    }
  }
  async aiAction(btn, fn) {
    if (this.aiBusy) return;
    this.aiBusy = true;
    const orig = btn.textContent ?? "";
    btn.disabled = true;
    btn.setText("\u23F3 \u0110ang h\u1ECFi AI\u2026");
    try {
      await fn();
    } catch (e) {
      console.error("Vocab Forge AI:", e);
      new import_obsidian3.Notice("L\u1ED7i g\u1ECDi Grok CLI \u2014 ki\u1EC3m tra \u0111\u01B0\u1EDDng d\u1EABn grok trong C\xE0i \u0111\u1EB7t");
    } finally {
      this.aiBusy = false;
      btn.disabled = false;
      btn.setText(orig);
      this.render();
    }
  }
  renderCard(main) {
    const entry = this.current;
    if (!entry) {
      this.section = "dashboard";
      this.render();
      return;
    }
    const card = entry.card;
    const dir = entry.dir;
    const fsrs2 = dir === "fwd" ? card.fsrs : card.fsrsRev;
    main.addClass("vf-main-review");
    const top = main.createDiv({ cls: "vf-topbar" });
    const backBtn = top.createEl("button", { text: "\u2715", cls: "vf-btn-icon" });
    backBtn.onclick = () => {
      this.section = "dashboard";
      this.render();
    };
    const mid = top.createDiv({ cls: "vf-topbar-mid" });
    const bar = mid.createDiv({ cls: "vf-progress-bar" });
    bar.createDiv({ cls: "vf-progress-fill" }).style.width = `${Math.round(this.sessionDone / Math.max(1, this.sessionTotal) * 100)}%`;
    mid.createDiv({
      text: `${this.sessionDone}/${this.sessionTotal}${this.sessionCategory ? ` \xB7 ${categoryEmoji(this.sessionCategory)} ${this.sessionCategory}` : ""}`,
      cls: "vf-progress-text"
    });
    const editBtn = top.createEl("button", { text: "\u270F\uFE0F", cls: "vf-btn-icon" });
    editBtn.onclick = () => this.app.workspace.openLinkText(card.file.path, "", true);
    const cardEl = main.createDiv({ cls: `vf-card ${this.justFlipped ? "vf-flip-in" : "vf-anim-pop"}` });
    this.justFlipped = false;
    const front = cardEl.createDiv({ cls: "vf-card-front" });
    const badgeRow = front.createDiv({ cls: "vf-badge-row" });
    badgeRow.createSpan({ text: `${categoryEmoji(card.category)} ${card.category}`, cls: "vf-chip-cat" });
    badgeRow.createSpan({ text: TYPE_LABELS[card.type] ?? card.type, cls: "vf-chip-type" });
    if (dir === "rev") badgeRow.createSpan({ text: "\u{1F501} VI \u2192 EN", cls: "vf-chip-rev" });
    if (fsrs2.state === State.New) badgeRow.createSpan({ text: "\u2728 m\u1EDBi", cls: "vf-chip-new" });
    if (dir === "rev" && !this.flipped) {
      front.createDiv({ text: card.meaningVi || card.meaningEn, cls: "vf-word vf-word-long vf-rev-meaning" });
      if (card.meaningVi && card.meaningEn)
        front.createDiv({ text: card.meaningEn, cls: "vf-hint" });
      front.createDiv({
        text: `\u2192 T\u1EEB ti\u1EBFng Anh n\xE0o? (${card.word.trim().split(/\s+/).length} t\u1EEB)`,
        cls: "vf-hint vf-rev-prompt"
      });
    } else {
      front.createDiv({
        text: card.word,
        cls: card.word.length > 60 ? "vf-word vf-word-long" : "vf-word"
      });
      if (card.ipa) front.createDiv({ text: card.ipa, cls: "vf-ipa" });
      const speakBtn = front.createEl("button", { text: "\u{1F50A}", cls: "vf-btn-speak" });
      speakBtn.onclick = (e) => {
        e.stopPropagation();
        this.plugin.speak(card.word);
      };
    }
    if (!this.flipped) {
      const flipBtn = main.createEl("button", {
        text: dir === "rev" ? "Xem \u0111\xE1p \xE1n \u{1F446}  \xB7  Space" : "L\u1EADt th\u1EBB \u{1F446}  \xB7  Space",
        cls: "vf-btn-flip"
      });
      flipBtn.onclick = () => this.flip();
      cardEl.onclick = () => this.flip();
      if (dir === "fwd") this.plugin.speak(card.word);
      return;
    }
    const back = cardEl.createDiv({ cls: "vf-card-back" });
    if (card.meaningEn) {
      const en = back.createDiv({ cls: "vf-meaning-en" });
      en.createSpan({ text: "EN", cls: "vf-lang-tag" });
      en.createSpan({ text: card.meaningEn });
    }
    if (card.meaningVi) {
      const vi = back.createDiv({ cls: "vf-meaning-vi" });
      vi.createSpan({ text: "VI", cls: "vf-lang-tag vf-lang-vi" });
      vi.createSpan({ text: card.meaningVi });
    }
    if (card.quote) {
      const q = back.createDiv({ cls: "vf-quote" });
      this.renderQuoteWithHighlight(q, card.quote, card.word);
      const qs = q.createEl("button", { text: "\u{1F50A}", cls: "vf-btn-tiny" });
      qs.onclick = () => this.plugin.speak(card.quote);
    }
    if (card.collocations.length) {
      const chips = back.createDiv({ cls: "vf-chips" });
      for (const c of card.collocations) chips.createSpan({ text: c, cls: "vf-chip" });
    }
    if (card.forms.length) {
      const fr = back.createDiv({ cls: "vf-chips vf-forms-row" });
      fr.createSpan({ text: "\u{1F524}", cls: "vf-forms-icon" });
      for (const f of card.forms) fr.createSpan({ text: f, cls: "vf-chip vf-chip-form" });
    }
    this.renderImage(back, card);
    const srcRow = back.createDiv({ cls: "vf-source-row" });
    const sourceName = card.source.replace(/^\[\[|\]\]$/g, "");
    if (sourceName) {
      const link = srcRow.createEl("a", { text: `\u{1F4C4} ${sourceName}`, cls: "vf-source-link" });
      link.onclick = (e) => {
        e.preventDefault();
        this.app.workspace.openLinkText(sourceName, card.file.path, true);
      };
    }
    if (card.sourceUrl) {
      const yt = srcRow.createEl("a", { text: "\u25B6\uFE0F Xem video", cls: "vf-source-link" });
      yt.onclick = (e) => {
        e.preventDefault();
        window.open(card.sourceUrl);
      };
    }
    this.renderAiSection(back, card);
    const now = /* @__PURE__ */ new Date();
    const preview = this.plugin.scheduler.repeat(fsrs2, now);
    const btnRow = main.createDiv({ cls: "vf-rate-row" });
    const defs = [
      { grade: Rating.Again, label: "Qu\xEAn", key: "1", cls: "vf-rate-again" },
      { grade: Rating.Hard, label: "Kh\xF3", key: "2", cls: "vf-rate-hard" },
      { grade: Rating.Good, label: "Nh\u1EDB", key: "3", cls: "vf-rate-good" },
      { grade: Rating.Easy, label: "D\u1EC5", key: "4", cls: "vf-rate-easy" }
    ];
    for (const d of defs) {
      const b = btnRow.createEl("button", { cls: `vf-rate ${d.cls}` });
      b.createDiv({ text: d.label, cls: "vf-rate-label" });
      b.createDiv({
        text: formatInterval(now, preview[d.grade].card.due),
        cls: "vf-rate-interval"
      });
      b.onclick = () => void this.rate(d.grade);
    }
    main.createDiv({ text: "Ph\xEDm t\u1EAFt: 1 \xB7 2 \xB7 3 \xB7 4  \u2014  S: ph\xE1t \xE2m", cls: "vf-kbd-hint" });
  }
  renderQuoteWithHighlight(el, quote, word) {
    const container = el.createSpan({ cls: "vf-quote-text" });
    container.appendText("\u201C");
    if (!word || word.length > 60) {
      container.appendText(quote);
    } else {
      const re = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      let last = 0;
      for (const m of quote.matchAll(re)) {
        container.appendText(quote.slice(last, m.index));
        container.createSpan({ text: m[0], cls: "vf-quote-hit" });
        last = (m.index ?? 0) + m[0].length;
      }
      container.appendText(quote.slice(last));
    }
    container.appendText("\u201D");
  }
  renderImage(parent, card) {
    if (!card.image) return;
    let src = card.image.trim().replace(/^!?\[\[|\]\]$/g, "");
    if (!/^https?:\/\//.test(src)) {
      const f = this.app.metadataCache.getFirstLinkpathDest(src, card.file.path);
      if (!f) return;
      src = this.app.vault.getResourcePath(f);
    }
    parent.createEl("img", { cls: "vf-image", attr: { src } });
  }
  flip() {
    if (this.section !== "review" || this.flipped) return;
    const doFlip = () => {
      this.flipped = true;
      this.justFlipped = true;
      if (this.current?.dir === "rev") this.plugin.speak(this.current.card.word);
      this.render();
    };
    const cardEl = this.contentEl.querySelector(".vf-card");
    if (cardEl) {
      cardEl.addClass("vf-flip-out");
      window.setTimeout(doFlip, 150);
    } else {
      doFlip();
    }
  }
  async rate(grade) {
    const entry = this.current;
    if (!entry || this.rating) return;
    const card = entry.card;
    this.rating = true;
    try {
      const fsrs2 = entry.dir === "fwd" ? card.fsrs : card.fsrsRev;
      const wasNew = fsrs2.state === State.New;
      const retention = fsrs2.state === State.Review || fsrs2.state === State.Relearning ? grade !== Rating.Again : null;
      const next = this.plugin.scheduler.repeat(fsrs2, /* @__PURE__ */ new Date())[grade].card;
      await this.plugin.store.saveFsrs(card, next, entry.dir);
      this.plugin.recordReview(wasNew, retention);
      this.sessionDone++;
      if (next.due.getTime() <= endOfToday().getTime()) {
        this.queue.push(entry);
        this.sessionTotal++;
      }
      if (grade === Rating.Again && next.lapses >= 4 && !card.mnemonic) {
        new import_obsidian3.Notice(`\u{1F624} "${card.word}" \u0111\xE3 qu\xEAn ${next.lapses} l\u1EA7n \u2014 b\u1EA5m \u{1F9E0} T\u1EA1o m\u1EB9o nh\u1EDB \u1EDF m\u1EB7t sau th\u1EBB!`, 6e3);
      }
    } catch (e) {
      console.error("Vocab Forge: l\u1ED7i khi l\u01B0u th\u1EBB", e);
      new import_obsidian3.Notice("Vocab Forge: kh\xF4ng l\u01B0u \u0111\u01B0\u1EE3c th\u1EBB \u2014 xem console");
    } finally {
      this.rating = false;
    }
    this.plugin.refreshStatusBar();
    this.nextCard();
  }
  renderDone(main) {
    const done = main.createDiv({ cls: "vf-done" });
    done.createEl("div", { text: "\u{1F389}", cls: "vf-done-emoji" });
    done.createEl("h2", { text: "Xong phi\xEAn h\xF4m nay!" });
    done.createEl("div", {
      text: `B\u1EA1n \u0111\xE3 \xF4n ${this.sessionDone} l\u01B0\u1EE3t. Chu\u1ED7i ng\xE0y: ${this.computeStreak()} \u{1F525}`,
      cls: "vf-muted"
    });
    const btn = done.createEl("button", { text: "\u2190 V\u1EC1 Dashboard", cls: "vf-btn-hero vf-btn-hero-small" });
    btn.onclick = () => {
      this.section = "dashboard";
      this.render();
    };
  }
  // ============================================================= PRACTICE
  renderPracticeHub(main) {
    main.createEl("h3", { text: "\u{1F3AF} Luy\u1EC7n t\u1EADp" });
    main.createDiv({
      text: "Luy\u1EC7n s\xE2u ngo\xE0i gi\u1EDD \xF4n \u2014 kh\xF4ng \u1EA3nh h\u01B0\u1EDFng l\u1ECBch FSRS c\u1EE7a th\u1EBB.",
      cls: "vf-muted"
    });
    main.createEl("h4", { text: "Ch\u1ECDn b\u1ED9 th\u1EBB" });
    const deckRow = main.createDiv({ cls: "vf-chip-select" });
    const cats = [...this.groupByCategory(this.plugin.store.getAllCards()).keys()].sort();
    const mkDeckChip = (label, value) => {
      const chip = deckRow.createEl("button", {
        text: value ? `${categoryEmoji(value)} ${label}` : label,
        cls: `vf-select-chip ${this.practiceDeck === value ? "vf-select-chip-on" : ""}`
      });
      chip.onclick = () => {
        this.practiceDeck = value;
        this.render();
      };
    };
    mkDeckChip("\u{1F310} T\u1EA5t c\u1EA3", null);
    for (const c of cats) mkDeckChip(c, c);
    main.createEl("h4", { text: "S\u1ED1 c\xE2u m\u1ED7i phi\xEAn" });
    const sizeRow = main.createDiv({ cls: "vf-chip-select" });
    for (const n of [10, 20]) {
      const chip = sizeRow.createEl("button", {
        text: `${n} c\xE2u`,
        cls: `vf-select-chip ${this.practiceSize === n ? "vf-select-chip-on" : ""}`
      });
      chip.onclick = () => {
        this.practiceSize = n;
        this.render();
      };
    }
    main.createEl("h4", { text: "Ch\u1ECDn ch\u1EBF \u0111\u1ED9 \u0111\u1EC3 b\u1EAFt \u0111\u1EA7u" });
    const grid = main.createDiv({ cls: "vf-mode-grid" });
    Object.keys(MODE_INFO).forEach((mode, i) => {
      const info = MODE_INFO[mode];
      const tile = grid.createDiv({ cls: `vf-mode-tile vf-mode-${mode}` });
      if (mode === "mix") tile.createDiv({ text: "\u2B50 \u0110\u1EC1 xu\u1EA5t", cls: "vf-mode-badge" });
      tile.createDiv({ text: info.icon, cls: "vf-mode-icon" });
      tile.createDiv({ text: info.name, cls: "vf-mode-name" });
      tile.createDiv({ text: info.desc, cls: "vf-mode-desc" });
      tile.onclick = () => this.startPractice(mode);
    });
  }
  startPractice(mode) {
    let cards = this.plugin.store.getAllCards();
    if (this.practiceDeck) cards = cards.filter((c) => c.category === this.practiceDeck);
    const queue = mode === "mix" ? buildMixedQueue(cards, this.practiceSize) : buildPracticeQueue(mode, cards, this.practiceSize);
    if (queue.length < 3) {
      new import_obsidian3.Notice("Deck n\xE0y ch\u01B0a \u0111\u1EE7 th\u1EBB ph\xF9 h\u1EE3p cho ch\u1EBF \u0111\u1ED9 \u0111\xF3 (c\u1EA7n \u2265 3)");
      return;
    }
    this.practiceMode = mode;
    this.practiceQueue = queue;
    this.practiceIdx = 0;
    this.practiceScore = 0;
    this.practiceWrong = [];
    this.practicePhase = "question";
    this.section = "practice-run";
    this.render();
  }
  currentPractice() {
    return this.practiceQueue[this.practiceIdx] ?? null;
  }
  renderPracticeRun(main) {
    const item = this.currentPractice();
    if (!item) {
      this.section = "practice-done";
      this.render();
      return;
    }
    main.addClass("vf-main-review");
    const info = MODE_INFO[item.mode];
    const top = main.createDiv({ cls: "vf-topbar" });
    const backBtn = top.createEl("button", { text: "\u2715", cls: "vf-btn-icon" });
    backBtn.onclick = () => {
      this.section = "practice";
      this.render();
    };
    const mid = top.createDiv({ cls: "vf-topbar-mid" });
    const bar = mid.createDiv({ cls: "vf-progress-bar" });
    bar.createDiv({ cls: "vf-progress-fill" }).style.width = `${Math.round(this.practiceIdx / this.practiceQueue.length * 100)}%`;
    mid.createDiv({
      text: `${info.icon} ${info.name} \xB7 ${this.practiceIdx + 1}/${this.practiceQueue.length}`,
      cls: "vf-progress-text"
    });
    top.createSpan({ text: `\u2B50 ${this.practiceScore}`, cls: "vf-score" });
    const cardEl = main.createDiv({ cls: "vf-card vf-anim-pop vf-practice-card" });
    this.practiceInput = null;
    if (item.mode === "cloze") this.renderClozeQ(cardEl, item);
    else if (item.mode === "typing") this.renderTypingQ(cardEl, item);
    else if (item.mode === "builder") this.renderBuilderQ(cardEl, item);
    else if (item.mode === "match") this.renderMatchQ(cardEl, item);
    else if (item.mode === "error") this.renderErrorQ(cardEl, item);
    else this.renderChoiceQ(cardEl, item);
    if (this.practicePhase === "feedback") {
      const fb = main.createDiv({
        cls: `vf-feedback ${this.practiceCorrect ? "vf-feedback-ok" : "vf-feedback-no"}`
      });
      fb.createSpan({
        text: this.practiceCorrect ? "\u{1F389} Ch\xEDnh x\xE1c!" : `\u{1F605} \u0110\xE1p \xE1n: ${this.practiceAnswerText(item)}`,
        cls: "vf-feedback-text"
      });
      const meaning = item.card.meaningVi || item.card.meaningEn;
      if (meaning) fb.createDiv({ text: meaning, cls: "vf-feedback-meaning" });
      const btn = main.createEl("button", { text: "Ti\u1EBFp t\u1EE5c  \xB7  Enter", cls: "vf-btn-flip" });
      btn.onclick = () => this.practiceNext();
      window.setTimeout(() => btn.focus(), 30);
    } else if (item.mode === "cloze" || item.mode === "typing") {
      const btn = main.createEl("button", { text: "Ki\u1EC3m tra  \xB7  Enter", cls: "vf-btn-flip" });
      btn.onclick = () => this.practiceCheck();
    }
  }
  practiceAnswerText(item) {
    if (item.mode === "cloze") return item.surface;
    if (item.mode === "builder") return item.tokens.join(" ");
    if (item.mode === "choice") return item.options[item.correctIndex];
    if (item.mode === "error")
      return `t\u1EEB sai l\xE0 "${item.tokens[item.wrongIndex]}" \u2192 \u0111\xFAng: "${item.correctToken}"`;
    return item.card.word;
  }
  // --- tìm lỗi sai (error spotting)
  renderErrorQ(cardEl, item) {
    const c = item.card;
    cardEl.addClass("vf-practice-card");
    cardEl.createDiv({ text: `${categoryEmoji(c.category)} ${c.category}`, cls: "vf-chip-cat" });
    cardEl.createDiv({ text: "\u{1F575}\uFE0F C\xE2u d\u01B0\u1EDBi \u0111\xE2y c\xF3 \u0110\xDANG 1 t\u1EEB sai \u2014 b\u1EA5m v\xE0o n\xF3:", cls: "vf-hint" });
    const line = cardEl.createDiv({ cls: "vf-error-line" });
    item.tokens.forEach((tok, i) => {
      let cls = "vf-token vf-error-token";
      if (this.practicePhase === "feedback" && i === item.wrongIndex)
        cls += this.practiceCorrect ? " vf-error-found" : " vf-error-reveal";
      const b = line.createEl("button", { text: tok, cls });
      b.onclick = () => {
        if (this.practicePhase !== "question") return;
        this.practiceResolve(i === item.wrongIndex);
      };
    });
    if (this.practicePhase === "feedback") {
      const fixed = [...item.tokens];
      fixed[item.wrongIndex] = item.correctToken;
      const ok = cardEl.createDiv({ cls: "vf-quote" });
      ok.createSpan({ text: "\u2713 C\xE2u \u0111\xFAng: ", cls: "vf-lang-tag" });
      ok.createSpan({ text: `\u201C${fixed.join(" ")}\u201D` });
    }
  }
  // --- nối cặp (match)
  renderMatchQ(cardEl, item) {
    cardEl.addClass("vf-match-card");
    cardEl.createDiv({
      text: `N\u1ED1i t\u1EEB v\u1EDBi ngh\u0129a \u2014 c\xF2n ${item.pairs.length - this.matchDone.size} c\u1EB7p`,
      cls: "vf-hint"
    });
    const board = cardEl.createDiv({ cls: "vf-match-board" });
    const wordCol = board.createDiv({ cls: "vf-match-col" });
    const meanCol = board.createDiv({ cls: "vf-match-col" });
    const wordOrder = this.stableOrder(item.pairs.length, this.practiceIdx * 7 + 3);
    const meanOrder = this.stableOrder(item.pairs.length, this.practiceIdx * 13 + 5);
    const mkTile = (col, kind, pairIdx, text) => {
      let cls = "vf-match-tile";
      if (this.matchDone.has(pairIdx)) cls += " vf-match-done";
      if (this.matchSel?.kind === kind && this.matchSel.idx === pairIdx) cls += " vf-match-sel";
      if (this.matchWrongFlash && (kind === "w" && this.matchWrongFlash.w === pairIdx || kind === "m" && this.matchWrongFlash.m === pairIdx))
        cls += " vf-match-wrong";
      const b = col.createEl("button", { text, cls });
      b.onclick = () => this.matchClick(item, kind, pairIdx);
    };
    for (const i of wordOrder) mkTile(wordCol, "w", i, item.pairs[i].word);
    for (const i of meanOrder) mkTile(meanCol, "m", i, item.pairs[i].meaning);
  }
  stableOrder(n, seed) {
    const arr = Array.from({ length: n }, (_, i) => i);
    let s = seed;
    for (let i = n - 1; i > 0; i--) {
      s = (s * 9301 + 49297) % 233280;
      const j = s % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  matchClick(item, kind, pairIdx) {
    if (this.matchLocked || this.matchDone.has(pairIdx)) return;
    if (!this.matchSel || this.matchSel.kind === kind) {
      this.matchSel = { kind, idx: pairIdx };
      this.render();
      return;
    }
    const w = kind === "w" ? pairIdx : this.matchSel.idx;
    const m = kind === "m" ? pairIdx : this.matchSel.idx;
    this.matchSel = null;
    if (w === m) {
      this.matchDone.add(w);
      this.plugin.speak(item.pairs[w].word);
      if (this.matchDone.size === item.pairs.length) this.finishMatchRound(item);
      this.render();
    } else {
      this.matchMistaken.add(w).add(m);
      this.matchWrongFlash = { w, m };
      this.render();
      window.setTimeout(() => {
        this.matchWrongFlash = null;
        if (this.section === "practice-run") this.render();
      }, 450);
    }
  }
  finishMatchRound(item) {
    this.matchLocked = true;
    for (let i = 0; i < item.pairs.length; i++) {
      const correct = !this.matchMistaken.has(i);
      this.plugin.recordPractice(correct);
      if (correct) this.practiceScore++;
      else {
        const retry = makeChoice(item.pairs[i].card, this.plugin.store.getAllCards());
        if (retry) this.practiceWrong.push(retry);
      }
    }
    window.setTimeout(() => this.practiceNext(), 700);
  }
  renderClozeQ(cardEl, item) {
    const c = item.card;
    cardEl.createDiv({ text: `${categoryEmoji(c.category)} ${c.category}`, cls: "vf-chip-cat" });
    const q = cardEl.createDiv({ cls: "vf-cloze-quote" });
    q.appendText("\u201C" + item.pre);
    if (this.practicePhase === "feedback") {
      q.createSpan({
        text: item.surface,
        cls: this.practiceCorrect ? "vf-cloze-hit-ok" : "vf-cloze-hit-no"
      });
    } else {
      q.createSpan({ text: "\uFF3F".repeat(Math.max(4, Math.min(10, item.surface.length))), cls: "vf-cloze-blank" });
    }
    q.appendText(item.post + "\u201D");
    if (c.meaningVi) cardEl.createDiv({ text: `\u{1F4A1} ${c.meaningVi}`, cls: "vf-hint" });
    if (this.practicePhase === "question") this.makePracticeInput(cardEl, "G\xF5 t\u1EEB c\xF2n thi\u1EBFu\u2026");
  }
  renderTypingQ(cardEl, item) {
    const c = item.card;
    cardEl.createDiv({ text: `${categoryEmoji(c.category)} ${c.category}`, cls: "vf-chip-cat" });
    if (c.meaningVi) {
      const vi = cardEl.createDiv({ cls: "vf-meaning-vi vf-typing-meaning" });
      vi.createSpan({ text: "VI", cls: "vf-lang-tag vf-lang-vi" });
      vi.createSpan({ text: c.meaningVi });
    }
    if (c.meaningEn) {
      const en = cardEl.createDiv({ cls: "vf-meaning-en" });
      en.createSpan({ text: "EN", cls: "vf-lang-tag" });
      en.createSpan({ text: c.meaningEn });
    }
    const hint = c.word.trim();
    cardEl.createDiv({
      text: `G\u1EE3i \xFD: ${hint.split(/\s+/).length} t\u1EEB \xB7 b\u1EAFt \u0111\u1EA7u b\u1EB1ng "${hint[0].toUpperCase()}"`,
      cls: "vf-hint"
    });
    if (this.practicePhase === "question") this.makePracticeInput(cardEl, "G\xF5 t\u1EEB ti\u1EBFng Anh\u2026");
    else {
      cardEl.createDiv({
        text: c.word,
        cls: this.practiceCorrect ? "vf-cloze-hit-ok vf-typing-answer" : "vf-cloze-hit-no vf-typing-answer"
      });
      if (c.ipa) cardEl.createDiv({ text: c.ipa, cls: "vf-ipa" });
    }
  }
  renderBuilderQ(cardEl, item) {
    const c = item.card;
    cardEl.createDiv({ text: `${categoryEmoji(c.category)} ${c.category}`, cls: "vf-chip-cat" });
    cardEl.createDiv({ text: "B\u1EA5m c\xE1c t\u1EEB theo \u0111\xFAng th\u1EE9 t\u1EF1:", cls: "vf-hint" });
    const built = cardEl.createDiv({ cls: "vf-builder-line" });
    for (let k = 0; k < this.builderPicked.length; k++) {
      const idx = this.builderPicked[k];
      const chip = built.createEl("button", { text: item.shuffled[idx], cls: "vf-token vf-token-placed" });
      chip.onclick = () => {
        if (this.practicePhase !== "question") return;
        this.builderPicked.splice(k, 1);
        this.render();
      };
    }
    if (!this.builderPicked.length) built.createSpan({ text: "\u2026", cls: "vf-muted" });
    if (this.practicePhase === "question") {
      const bank = cardEl.createDiv({ cls: "vf-builder-bank" });
      item.shuffled.forEach((tok, idx) => {
        if (this.builderPicked.includes(idx)) return;
        const chip = bank.createEl("button", { text: tok, cls: "vf-token" });
        chip.onclick = () => {
          this.builderPicked.push(idx);
          if (this.builderPicked.length === item.shuffled.length) {
            const attempt = this.builderPicked.map((i) => item.shuffled[i]).join(" ");
            this.practiceResolve(attempt === item.tokens.join(" "));
          } else this.render();
        };
      });
    } else {
      cardEl.createDiv({
        text: `\u201C${item.tokens.join(" ")}\u201D`,
        cls: this.practiceCorrect ? "vf-cloze-hit-ok vf-builder-answer" : "vf-cloze-hit-no vf-builder-answer"
      });
    }
    if (c.meaningVi) cardEl.createDiv({ text: `\u{1F4A1} ${c.meaningVi}`, cls: "vf-hint" });
  }
  renderChoiceQ(cardEl, item) {
    const c = item.card;
    cardEl.createDiv({ text: `${categoryEmoji(c.category)} ${c.category}`, cls: "vf-chip-cat" });
    cardEl.createDiv({ text: c.word, cls: "vf-word vf-choice-word" });
    if (c.ipa) cardEl.createDiv({ text: c.ipa, cls: "vf-ipa" });
    const opts = cardEl.createDiv({ cls: "vf-choice-opts" });
    item.options.forEach((opt, idx) => {
      let cls = "vf-choice-opt";
      if (this.practicePhase === "feedback") {
        if (idx === item.correctIndex) cls += " vf-choice-right";
        else cls += " vf-choice-dim";
      }
      const b = opts.createEl("button", { cls });
      b.createSpan({ text: `${idx + 1}`, cls: "vf-choice-num" });
      b.createSpan({ text: opt, cls: "vf-choice-text" });
      b.onclick = () => {
        if (this.practicePhase !== "question") return;
        this.practiceResolve(idx === item.correctIndex);
      };
    });
  }
  makePracticeInput(cardEl, placeholder) {
    const input = cardEl.createEl("input", {
      cls: "vf-practice-input",
      attr: { type: "text", placeholder, spellcheck: "false", autocapitalize: "off" }
    });
    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.practiceCheck();
      }
    };
    this.practiceInput = input;
    window.setTimeout(() => input.focus(), 30);
  }
  practiceCheck() {
    const item = this.currentPractice();
    if (!item || this.practicePhase !== "question") return;
    if (item.mode === "cloze") {
      const val = this.practiceInput?.value ?? "";
      this.practiceResolve(fuzzyEqual(val, [item.surface, item.card.word, ...item.card.forms]));
    } else if (item.mode === "typing") {
      const val = this.practiceInput?.value ?? "";
      this.practiceResolve(fuzzyEqual(val, [item.card.word, ...item.card.forms]));
    }
  }
  practiceResolve(correct) {
    const item = this.currentPractice();
    if (!item) return;
    this.practicePhase = "feedback";
    this.practiceCorrect = correct;
    if (correct) this.practiceScore++;
    else this.practiceWrong.push(item);
    this.plugin.recordPractice(correct);
    this.plugin.speak(item.mode === "builder" ? item.tokens.join(" ") : item.card.word);
    this.render();
  }
  practiceNext() {
    this.practiceIdx++;
    this.practicePhase = "question";
    this.builderPicked = [];
    this.matchSel = null;
    this.matchDone = /* @__PURE__ */ new Set();
    this.matchMistaken = /* @__PURE__ */ new Set();
    this.matchWrongFlash = null;
    this.matchLocked = false;
    if (this.practiceIdx >= this.practiceQueue.length) this.section = "practice-done";
    this.render();
  }
  renderPracticeDone(main) {
    const total = this.practiceQueue.length;
    const pct = total ? Math.round(this.practiceScore / total * 100) : 0;
    const done = main.createDiv({ cls: "vf-done" });
    done.createEl("div", { text: pct >= 80 ? "\u{1F3C6}" : pct >= 50 ? "\u{1F4AA}" : "\u{1F331}", cls: "vf-done-emoji" });
    done.createEl("h2", { text: `${this.practiceScore}/${total} c\xE2u \u0111\xFAng` });
    const ring = done.createDiv({ cls: "vf-hero-ring vf-ring-dark" });
    ring.style.setProperty("--vf-pct", String(pct));
    ring.createDiv({ text: `${pct}%`, cls: "vf-hero-ring-text" });
    if (this.practiceWrong.length) {
      done.createEl("h4", { text: "C\xE1c c\xE2u sai" });
      const list = done.createDiv({ cls: "vf-hard-list vf-wrong-list" });
      for (const w of this.practiceWrong) {
        const row = list.createDiv({ cls: "vf-hard-item" });
        row.createSpan({ text: w.card.word, cls: "vf-hard-word" });
        row.createSpan({ text: w.card.meaningVi || w.card.meaningEn, cls: "vf-hard-count" });
        row.onclick = () => this.app.workspace.openLinkText(w.card.file.path, "", true);
      }
    }
    const btns = done.createDiv({ cls: "vf-actions" });
    if (this.practiceWrong.length) {
      const retry = btns.createEl("button", {
        text: `\u{1F501} Luy\u1EC7n l\u1EA1i ${this.practiceWrong.length} c\xE2u sai`,
        cls: "vf-btn-hero vf-btn-hero-small"
      });
      retry.onclick = () => {
        this.practiceQueue = shuffle(this.practiceWrong);
        this.practiceWrong = [];
        this.practiceIdx = 0;
        this.practiceScore = 0;
        this.practicePhase = "question";
        this.builderPicked = [];
        this.section = "practice-run";
        this.render();
      };
    }
    const back = btns.createEl("button", { text: "\u2190 V\u1EC1 Luy\u1EC7n t\u1EADp", cls: "vf-btn-icon" });
    back.onclick = () => {
      this.section = "practice";
      this.render();
    };
  }
  // ============================================================= SETTINGS
  renderSettings(main) {
    main.createEl("h3", { text: "\u2699\uFE0F C\xE0i \u0111\u1EB7t" });
    const s = this.plugin.settings;
    const group = (label, desc) => {
      const g = main.createDiv({ cls: "vf-setting" });
      const info = g.createDiv({ cls: "vf-setting-info" });
      info.createDiv({ text: label, cls: "vf-setting-name" });
      info.createDiv({ text: desc, cls: "vf-setting-desc" });
      return g.createDiv({ cls: "vf-setting-control" });
    };
    const c1 = group("Th\u1EBB m\u1EDBi m\u1ED7i ng\xE0y", "Gi\u1EDBi h\u1EA1n th\u1EBB m\u1EDBi \u0111\u01B0a v\xE0o h\u1ECDc (ki\u1EC3u Anki)");
    const v1 = c1.createSpan({ text: String(s.newPerDay), cls: "vf-setting-value" });
    const r1 = c1.createEl("input", { attr: { type: "range", min: "0", max: "50", step: "1", value: String(s.newPerDay) } });
    r1.oninput = () => {
      v1.setText(r1.value);
    };
    r1.onchange = async () => {
      s.newPerDay = Number(r1.value);
      await this.plugin.saveAll();
      this.plugin.refreshStatusBar();
    };
    const c2 = group("M\u1EE9c ghi nh\u1EDB m\u1EE5c ti\xEAu", "0.90 = c\xE2n b\u1EB1ng; cao h\u01A1n = \xF4n d\xE0y h\u01A1n");
    const v2 = c2.createSpan({ text: s.requestRetention.toFixed(2), cls: "vf-setting-value" });
    const r2 = c2.createEl("input", { attr: { type: "range", min: "0.8", max: "0.97", step: "0.01", value: String(s.requestRetention) } });
    r2.oninput = () => {
      v2.setText(Number(r2.value).toFixed(2));
    };
    r2.onchange = async () => {
      s.requestRetention = Number(r2.value);
      this.plugin.rebuildScheduler();
      await this.plugin.saveAll();
    };
    const c3 = group("T\u1ED1c \u0111\u1ED9 ph\xE1t \xE2m", "1.0 = t\u1ED1c \u0111\u1ED9 t\u1EF1 nhi\xEAn");
    const v3 = c3.createSpan({ text: s.ttsRate.toFixed(2), cls: "vf-setting-value" });
    const r3 = c3.createEl("input", { attr: { type: "range", min: "0.5", max: "1.5", step: "0.05", value: String(s.ttsRate) } });
    r3.oninput = () => {
      v3.setText(Number(r3.value).toFixed(2));
    };
    r3.onchange = async () => {
      s.ttsRate = Number(r3.value);
      await this.plugin.saveAll();
    };
    const c4 = group("Gi\u1ECDng \u0111\u1ECDc", "Gi\u1ECDng ti\u1EBFng Anh c\u1EE7a h\u1EC7 th\u1ED1ng");
    const sel = c4.createEl("select", { cls: "dropdown" });
    sel.createEl("option", { text: "\u2014 T\u1EF1 \u0111\u1ED9ng (en) \u2014", attr: { value: "" } });
    for (const v of window.speechSynthesis.getVoices()) {
      if (!v.lang.startsWith("en")) continue;
      const opt = sel.createEl("option", { text: `${v.name} (${v.lang})`, attr: { value: v.name } });
      if (v.name === s.ttsVoice) opt.selected = true;
    }
    sel.onchange = async () => {
      s.ttsVoice = sel.value;
      await this.plugin.saveAll();
    };
    const test = c4.createEl("button", { text: "\u{1F50A} Th\u1EED", cls: "vf-btn-icon" });
    test.onclick = () => this.plugin.speak("The quick brown fox jumps over the lazy dog.");
    const c5 = group("Folder ch\u1EE9a th\u1EBB", "M\u1ED7i th\u1EBB l\xE0 m\u1ED9t file .md trong folder n\xE0y");
    const inp = c5.createEl("input", { attr: { type: "text", value: s.cardsFolder }, cls: "vf-input" });
    inp.onchange = async () => {
      s.cardsFolder = inp.value.trim() || "5. Toolbox/English/Cards";
      await this.plugin.saveAll();
    };
    const c6 = group("Highlight t\u1EEB \u0111\xE3 h\u1ECDc", "G\u1EA1ch ch\xE2n t\u1EEB \u0111ang h\u1ECDc trong reading mode to\xE0n vault");
    const chk = c6.createEl("input", { attr: { type: "checkbox" } });
    chk.checked = s.highlightEnabled;
    chk.onchange = async () => {
      s.highlightEnabled = chk.checked;
      this.plugin.invalidateKnownWords();
      await this.plugin.saveAll();
    };
    const c6b = group(
      "H\u1ECDc chi\u1EC1u ng\u01B0\u1EE3c (VI \u2192 EN)",
      "Th\u1EBB \u0111\xE3 thu\u1ED9c chi\u1EC1u xu\xF4i s\u1EBD v\xE0o h\u1ECDc chi\u1EC1u ng\u01B0\u1EE3c \u2014 nh\xECn ngh\u0129a nh\u1EDB ra t\u1EEB"
    );
    const chkRev = c6b.createEl("input", { attr: { type: "checkbox" } });
    chkRev.checked = s.reverseEnabled;
    chkRev.onchange = async () => {
      s.reverseEnabled = chkRev.checked;
      await this.plugin.saveAll();
      this.plugin.refreshStatusBar();
    };
    main.createEl("h4", { text: "Nhi\u1EC7m v\u1EE5 h\u1EB1ng ng\xE0y" });
    const goals = [
      ["M\u1EE5c ti\xEAu l\u01B0\u1EE3t \xF4n", "dailyReviewGoal", 0, 100],
      ["M\u1EE5c ti\xEAu th\u1EBB m\u1EDBi", "dailyNewGoal", 0, 30],
      ["M\u1EE5c ti\xEAu c\xE2u luy\u1EC7n t\u1EADp", "dailyPracticeGoal", 0, 50]
    ];
    for (const [label, key, min, max] of goals) {
      const cg = group(label, "0 = t\u1EAFt nhi\u1EC7m v\u1EE5 n\xE0y");
      const vg = cg.createSpan({ text: String(s[key]), cls: "vf-setting-value" });
      const rg = cg.createEl("input", {
        attr: { type: "range", min: String(min), max: String(max), step: "1", value: String(s[key]) }
      });
      rg.oninput = () => vg.setText(rg.value);
      rg.onchange = async () => {
        s[key] = Number(rg.value);
        await this.plugin.saveAll();
      };
    }
    const cr = group("Gi\u1EDD nh\u1EAFc h\u1ECDc h\u1EB1ng ng\xE0y", "Th\xF4ng b\xE1o khi c\xF2n th\u1EBB due \u2014 h\u1EC7 th\u1ED1ng + trong Obsidian");
    const sel2 = cr.createEl("select", { cls: "dropdown" });
    sel2.createEl("option", { text: "T\u1EAFt", attr: { value: "-1" } });
    for (let h = 6; h <= 23; h++)
      sel2.createEl("option", { text: `${h}:00`, attr: { value: String(h) } });
    sel2.value = String(s.reminderHour);
    sel2.onchange = async () => {
      s.reminderHour = Number(sel2.value);
      await this.plugin.saveAll();
    };
    main.createEl("h4", { text: "AI (Grok CLI)" });
    const c7 = group("\u0110\u01B0\u1EDDng d\u1EABn l\u1EC7nh grok", "D\xF9ng cho m\u1EB9o nh\u1EDB, ch\u1EA5m c\xE2u, gi\u1EA3i th\xEDch ng\u1EEF ph\xE1p, story");
    const gp = c7.createEl("input", { attr: { type: "text", value: s.grokPath }, cls: "vf-input" });
    gp.onchange = async () => {
      s.grokPath = gp.value.trim() || "grok";
      await this.plugin.saveAll();
    };
    main.createEl("h4", { text: "Th\xF4ng tin & T\xE1c gi\u1EA3" });
    const authorGroup = main.createDiv({ cls: "vf-setting vf-author-card" });
    const authorInfo = authorGroup.createDiv({ cls: "vf-setting-info" });
    authorInfo.createDiv({ text: "\u{1F464} Tony Hoang (Tr\u1EA7n V\u0103n Ho\xE0ng)", cls: "vf-setting-name" });
    authorInfo.createDiv({ text: "\u2709\uFE0F tony@tranvanhoang.com \xB7 Vocab Forge v1.6.1", cls: "vf-setting-desc" });
    const authorCtrl = authorGroup.createDiv({ cls: "vf-setting-control" });
    const infoModalBtn = authorCtrl.createEl("button", { text: "\u2139\uFE0F Th\xF4ng tin", cls: "vf-btn-icon" });
    infoModalBtn.onclick = () => new AboutModal(this.app, this.plugin).open();
    const contactBtn = authorCtrl.createEl("button", { text: "\u2709\uFE0F G\u1EEDi Email", cls: "vf-btn-icon" });
    contactBtn.onclick = () => window.open("mailto:tony@tranvanhoang.com");
  }
  // ================================================================ MISC
  computeStreak() {
    return this.plugin.computeStreak();
  }
  /** Biểu đồ cột: số thẻ đến hạn trong 30 ngày tới (quá hạn dồn vào hôm nay) */
  renderForecast(el, all) {
    const DAYS = 30;
    const counts = new Array(DAYS).fill(0);
    const startToday = /* @__PURE__ */ new Date();
    startToday.setHours(0, 0, 0, 0);
    for (const c of all) {
      if (c.fsrs.state === State.New) continue;
      const due = new Date(c.fsrs.due);
      due.setHours(0, 0, 0, 0);
      const idx = Math.round((due.getTime() - startToday.getTime()) / 864e5);
      if (idx < 0) counts[0]++;
      else if (idx < DAYS) counts[idx]++;
    }
    const max = Math.max(1, ...counts);
    for (let i = 0; i < DAYS; i++) {
      const col = el.createDiv({ cls: "vf-fc-col" });
      const bar = col.createDiv({ cls: `vf-fc-bar ${i === 0 ? "vf-fc-today" : ""}` });
      bar.style.height = `${Math.max(3, Math.round(counts[i] / max * 60))}px`;
      bar.setAttr("aria-label", `+${i} ng\xE0y: ${counts[i]} th\u1EBB`);
      if (i % 5 === 0) col.createDiv({ text: i === 0 ? "nay" : `+${i}`, cls: "vf-fc-label" });
    }
  }
  /** Biểu đồ retention: % trả lời đúng (không Quên) trên thẻ đang ôn, 30 ngày gần nhất */
  renderRetention(main) {
    const stats = this.plugin.data.stats;
    const days = [];
    const d = /* @__PURE__ */ new Date();
    d.setDate(d.getDate() - 29);
    let sumPass = 0, sumTotal = 0;
    for (let i = 0; i < 30; i++) {
      const key = todayKey(d);
      const s = stats[key];
      const total = (s?.pass ?? 0) + (s?.fail ?? 0);
      days.push({ key, pct: total ? Math.round((s?.pass ?? 0) / total * 100) : null });
      sumPass += s?.pass ?? 0;
      sumTotal += total;
      d.setDate(d.getDate() + 1);
    }
    const head = main.createDiv({ cls: "vf-section-head" });
    head.createEl("h4", { text: "T\u1EF7 l\u1EC7 nh\u1EDB (retention) \u2014 30 ng\xE0y" });
    if (sumTotal)
      head.createSpan({
        text: `TB ${Math.round(sumPass / sumTotal * 100)}% \xB7 m\u1EE5c ti\xEAu ${Math.round(this.plugin.settings.requestRetention * 100)}%`,
        cls: "vf-muted"
      });
    const chart = main.createDiv({ cls: "vf-forecast vf-retention" });
    if (!sumTotal) {
      chart.createDiv({ text: "Ch\u01B0a c\xF3 d\u1EEF li\u1EC7u \u2014 s\u1EBD t\u1EF1 t\xEDch lu\u1EF9 t\u1EEB c\xE1c phi\xEAn \xF4n t\u1EDBi.", cls: "vf-empty" });
      return;
    }
    days.forEach((day, i) => {
      const col = chart.createDiv({ cls: "vf-fc-col" });
      const bar = col.createDiv({ cls: "vf-fc-bar vf-ret-bar" });
      if (day.pct == null) {
        bar.style.height = "3px";
        bar.addClass("vf-ret-empty");
      } else {
        bar.style.height = `${Math.max(4, Math.round(day.pct / 100 * 60))}px`;
        if (day.pct < this.plugin.settings.requestRetention * 100 - 10) bar.addClass("vf-ret-low");
      }
      bar.setAttr("aria-label", `${day.key}: ${day.pct == null ? "\u2014" : day.pct + "%"}`);
      if (i % 5 === 0) col.createDiv({ text: day.key.slice(8), cls: "vf-fc-label" });
    });
  }
  /** Lưới huy hiệu thành tích */
  renderBadges(main) {
    const earned = this.plugin.data.badges;
    const head = main.createDiv({ cls: "vf-section-head" });
    head.createEl("h4", { text: "Huy hi\u1EC7u" });
    head.createSpan({ text: `${Object.keys(earned).length}/${BADGES.length}`, cls: "vf-muted" });
    const grid = main.createDiv({ cls: "vf-badge-grid" });
    for (const b of BADGES) {
      const got = earned[b.id];
      const el = grid.createDiv({ cls: `vf-badge-tile ${got ? "vf-badge-got" : "vf-badge-locked"}` });
      el.createDiv({ text: b.icon, cls: "vf-badge-icon" });
      el.createDiv({ text: b.name, cls: "vf-badge-name" });
      el.createDiv({ text: got ? `\u2713 ${got}` : b.desc, cls: "vf-badge-desc" });
    }
  }
  // ================================================================= CHAT
  renderChat(main) {
    main.createEl("h3", { text: "\u{1F4AC} H\u1ED9i tho\u1EA1i (Roleplay)" });
    main.createDiv({
      text: "N\xF3i chuy\u1EC7n v\u1EDBi AI \u0111\xF3ng vai \u0111\u1ED1i t\xE1c \u2014 nhi\u1EC7m v\u1EE5 c\u1EE7a b\u1EA1n: d\xF9ng \u0111\u01B0\u1EE3c c\xE1c t\u1EEB m\u1EE5c ti\xEAu trong h\u1ED9i tho\u1EA1i.",
      cls: "vf-muted"
    });
    if (!this.chatMsgs.length && !this.chatBusy) {
      const empty = main.createDiv({ cls: "vf-story-wait" });
      empty.createDiv({ text: "\u{1F4AC}", cls: "vf-done-emoji" });
      const start = empty.createEl("button", {
        text: "\u2728 B\u1EAFt \u0111\u1EA7u h\u1ED9i tho\u1EA1i m\u1EDBi",
        cls: "vf-btn-hero vf-btn-hero-small"
      });
      start.onclick = () => void this.startChat();
      return;
    }
    if (this.chatWords.length) {
      const chips = main.createDiv({ cls: "vf-chips vf-chat-targets" });
      chips.createSpan({ text: "\u{1F3AF} D\xF9ng \u0111\u01B0\u1EE3c:", cls: "vf-muted" });
      for (const w of this.chatWords) {
        const used = this.chatMsgs.some(
          (m) => m.role === "me" && m.text.toLowerCase().includes(w.toLowerCase())
        );
        chips.createSpan({ text: used ? `\u2713 ${w}` : w, cls: `vf-chip ${used ? "vf-chip-used" : ""}` });
      }
    }
    const box = main.createDiv({ cls: "vf-chat-box" });
    for (const m of this.chatMsgs) {
      const b = box.createDiv({
        cls: m.role === "me" ? "vf-msg vf-msg-me" : m.role === "feedback" ? "vf-msg vf-msg-feedback" : "vf-msg vf-msg-ai"
      });
      if (m.role === "feedback") b.createDiv({ text: "\u{1F4CB} Nh\u1EADn x\xE9t", cls: "vf-msg-tag" });
      b.createDiv({ text: m.text });
      if (m.role === "ai") {
        const sp = b.createEl("button", { text: "\u{1F50A}", cls: "vf-btn-tiny" });
        sp.onclick = () => this.plugin.speak(m.text);
      }
    }
    if (this.chatBusy) box.createDiv({ text: "\u23F3 \u2026", cls: "vf-msg vf-msg-ai vf-msg-wait" });
    window.setTimeout(() => box.scrollTop = box.scrollHeight, 20);
    const row = main.createDiv({ cls: "vf-chat-input-row" });
    const input = row.createEl("input", {
      cls: "vf-practice-input",
      attr: { type: "text", placeholder: "Tr\u1EA3 l\u1EDDi b\u1EB1ng ti\u1EBFng Anh\u2026", spellcheck: "false" }
    });
    input.value = this.chatInput;
    input.oninput = () => this.chatInput = input.value;
    input.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === "Enter") void this.sendChat();
    };
    input.disabled = this.chatBusy;
    const send = row.createEl("button", { text: "G\u1EEDi \u27A4", cls: "vf-btn-hero vf-btn-hero-small" });
    send.disabled = this.chatBusy;
    send.onclick = () => void this.sendChat();
    const foot = main.createDiv({ cls: "vf-actions" });
    const end = foot.createEl("button", { text: "\u{1F3C1} K\u1EBFt th\xFAc & nh\u1EADn x\xE9t", cls: "vf-btn-icon" });
    end.disabled = this.chatBusy || this.chatMsgs.filter((m) => m.role === "me").length === 0;
    end.onclick = () => void this.endChat();
    const reset = foot.createEl("button", { text: "\u{1F504} H\u1ED9i tho\u1EA1i m\u1EDBi", cls: "vf-btn-icon" });
    reset.disabled = this.chatBusy;
    reset.onclick = () => void this.startChat();
    if (!this.flippedFocusGuard()) window.setTimeout(() => input.focus(), 30);
  }
  flippedFocusGuard() {
    return this.chatBusy;
  }
  pickChatWords() {
    const all = this.plugin.store.getAllCards().filter((c) => c.type !== "sentence" && c.type !== "passage" && c.type !== "grammar");
    const hard = all.filter((c) => c.fsrs.lapses >= 2);
    const due = this.plugin.store.getDueCards();
    const learned2 = all.filter((c) => c.fsrs.state !== State.New);
    const pool = [...hard, ...due, ...learned2, ...all];
    const words = [];
    for (const c of pool) {
      if (!words.includes(c.word)) words.push(c.word);
      if (words.length === 5) break;
    }
    return words;
  }
  async startChat() {
    this.chatWords = this.pickChatWords();
    if (this.chatWords.length < 2) {
      new import_obsidian3.Notice("Ch\u01B0a \u0111\u1EE7 th\u1EBB \u0111\u1EC3 t\u1EA1o h\u1ED9i tho\u1EA1i");
      return;
    }
    this.chatMsgs = [];
    this.chatInput = "";
    this.chatSession = `vf-chat-${Date.now()}`;
    this.chatBusy = true;
    this.render();
    try {
      const first = await runGrok(
        chatStartPrompt(this.chatWords),
        this.plugin.settings.grokPath,
        12e4,
        this.chatSession
      );
      this.chatMsgs.push({ role: "ai", text: first.trim() });
      this.plugin.speak(first.trim());
    } catch (e) {
      console.error("Vocab Forge chat:", e);
      new import_obsidian3.Notice("Kh\xF4ng b\u1EAFt \u0111\u1EA7u \u0111\u01B0\u1EE3c h\u1ED9i tho\u1EA1i \u2014 ki\u1EC3m tra Grok CLI");
    } finally {
      this.chatBusy = false;
      this.render();
    }
  }
  async sendChat() {
    const text = this.chatInput.trim();
    if (!text || this.chatBusy || !this.chatSession) return;
    this.chatMsgs.push({ role: "me", text });
    this.chatInput = "";
    this.chatBusy = true;
    this.render();
    try {
      const reply = await runGrok(text, this.plugin.settings.grokPath, 12e4, this.chatSession);
      this.chatMsgs.push({ role: "ai", text: reply.trim() });
      this.plugin.speak(reply.trim());
    } catch (e) {
      console.error("Vocab Forge chat:", e);
      new import_obsidian3.Notice("L\u1ED7i g\u1EEDi tin \u2014 th\u1EED l\u1EA1i");
      this.chatMsgs.pop();
      this.chatInput = text;
    } finally {
      this.chatBusy = false;
      this.render();
    }
  }
  async endChat() {
    if (this.chatBusy || !this.chatSession) return;
    this.chatBusy = true;
    this.render();
    try {
      const fb = await runGrok(
        chatFeedbackPrompt(this.chatWords),
        this.plugin.settings.grokPath,
        12e4,
        this.chatSession
      );
      this.chatMsgs.push({ role: "feedback", text: fb.trim() });
      this.chatSession = "";
    } catch (e) {
      console.error("Vocab Forge chat:", e);
      new import_obsidian3.Notice("Kh\xF4ng l\u1EA5y \u0111\u01B0\u1EE3c nh\u1EADn x\xE9t");
    } finally {
      this.chatBusy = false;
      this.render();
    }
  }
  // ================================================================ STORY
  renderStory(main) {
    const head = main.createDiv({ cls: "vf-deck-head" });
    const backBtn = head.createEl("button", { text: "\u2190", cls: "vf-btn-icon" });
    backBtn.onclick = () => {
      this.section = "dashboard";
      this.render();
    };
    head.createEl("h3", { text: "\u{1F4D6} Story h\xF4m nay" });
    main.createDiv({
      text: "AI d\u1EC7t c\xE1c t\u1EEB s\u1EAFp \xF4n th\xE0nh m\u1ED9t c\xE2u chuy\u1EC7n ng\u1EAFn \u2014 \u0111\u1ECDc tr\u01B0\u1EDBc khi \xF4n \u0111\u1EC3 g\u1EB7p t\u1EEB trong ng\u1EEF c\u1EA3nh m\u1EDBi.",
      cls: "vf-muted"
    });
    const story = this.plugin.data.story;
    const fresh = story && story.date === todayKey();
    if (this.storyBusy) {
      const wait = main.createDiv({ cls: "vf-story-wait" });
      wait.createDiv({ text: "\u23F3", cls: "vf-done-emoji" });
      wait.createDiv({ text: "Grok \u0111ang vi\u1EBFt story t\u1EEB c\xE1c th\u1EBB c\u1EE7a b\u1EA1n\u2026 (~30\u201360s)", cls: "vf-muted" });
      return;
    }
    if (fresh && story) {
      const box = main.createDiv({ cls: "vf-story-box" });
      const en = box.createDiv({ cls: "vf-story-en" });
      this.renderBoldText(en, story.en);
      const speakBtn = box.createEl("button", { text: "\u{1F50A} Nghe story", cls: "vf-btn-icon" });
      speakBtn.onclick = () => this.plugin.speak(story.en.replace(/\*\*/g, ""));
      const viBox = box.createEl("details", { cls: "vf-story-vi" });
      viBox.createEl("summary", { text: "\u{1F1FB}\u{1F1F3} Xem b\u1EA3n d\u1ECBch ti\u1EBFng Vi\u1EC7t" });
      viBox.createDiv({ text: story.vi });
      const chips = main.createDiv({ cls: "vf-chips vf-story-words" });
      for (const w of story.words) chips.createSpan({ text: w, cls: "vf-chip" });
      const btns = main.createDiv({ cls: "vf-actions" });
      const go = btns.createEl("button", { text: "\u25B6  V\xE0o \xF4n t\u1EADp", cls: "vf-btn-hero vf-btn-hero-small" });
      go.onclick = () => this.startSession(null);
      const redo = btns.createEl("button", { text: "\u{1F504} Story m\u1EDBi", cls: "vf-btn-icon" });
      redo.onclick = () => void this.generateStory();
      return;
    }
    const empty = main.createDiv({ cls: "vf-story-wait" });
    empty.createDiv({ text: "\u{1F4D6}", cls: "vf-done-emoji" });
    const gen = empty.createEl("button", {
      text: "\u2728 T\u1EA1o story t\u1EEB th\u1EBB h\xF4m nay",
      cls: "vf-btn-hero vf-btn-hero-small"
    });
    gen.onclick = () => void this.generateStory();
  }
  renderBoldText(el, text) {
    const parts = text.split("**");
    parts.forEach((p, i) => {
      if (i % 2 === 1) el.createEl("strong", { text: p, cls: "vf-story-hit" });
      else el.appendText(p);
    });
  }
  async generateStory() {
    const due = this.plugin.store.getDueCards();
    const news = this.plugin.store.getNewCards().slice(0, this.plugin.newRemainingToday());
    let pool = [...due, ...news].filter((c) => c.type !== "sentence" && c.type !== "passage" && c.type !== "grammar");
    if (pool.length < 3)
      pool = this.plugin.store.getAllCards().filter((c) => c.type !== "sentence" && c.type !== "passage" && c.type !== "grammar");
    if (pool.length < 3) {
      new import_obsidian3.Notice("Ch\u01B0a \u0111\u1EE7 th\u1EBB \u0111\u1EC3 t\u1EA1o story");
      return;
    }
    const picked = sample(pool, 7);
    const words = picked.map((c) => c.word);
    const cats = [...new Set(picked.map((c) => c.category))];
    this.storyBusy = true;
    this.render();
    try {
      const raw = await runGrok(storyPrompt(words, cats), this.plugin.settings.grokPath, 15e4);
      const sep = raw.indexOf("---");
      const en = (sep === -1 ? raw : raw.slice(0, sep)).trim();
      const vi = sep === -1 ? "" : raw.slice(sep + 3).trim();
      if (!en) throw new Error("empty story");
      this.plugin.data.story = { date: todayKey(), words, en, vi };
      await this.plugin.saveAll();
    } catch (e) {
      console.error("Vocab Forge story:", e);
      new import_obsidian3.Notice("Kh\xF4ng t\u1EA1o \u0111\u01B0\u1EE3c story \u2014 ki\u1EC3m tra Grok CLI");
    } finally {
      this.storyBusy = false;
      this.render();
    }
  }
  renderHeatmap(el) {
    const stats = this.plugin.data.stats;
    const days = 17 * 7;
    const start = /* @__PURE__ */ new Date();
    start.setDate(start.getDate() - (days - 1));
    for (let w = 0; w < 17; w++) {
      const col = el.createDiv({ cls: "vf-heat-col" });
      for (let d = 0; d < 7; d++) {
        const date = new Date(start);
        date.setDate(start.getDate() + w * 7 + d);
        if (date > /* @__PURE__ */ new Date()) break;
        const count = stats[todayKey(date)]?.reviews ?? 0;
        const level2 = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 10 ? 3 : 4;
        const cell = col.createDiv({ cls: `vf-heat-cell vf-heat-${level2}` });
        cell.setAttr("aria-label", `${todayKey(date)}: ${count} l\u01B0\u1EE3t \xF4n`);
      }
    }
  }
  onKey(evt) {
    if (this.app.workspace.getActiveViewOfType(_VocabReviewView) !== this) return;
    const target = evt.target;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
    if (this.section === "practice-run") {
      const item = this.currentPractice();
      if (evt.key === "Enter") {
        evt.preventDefault();
        if (this.practicePhase === "feedback") this.practiceNext();
        else this.practiceCheck();
        return;
      }
      if (this.practicePhase === "question" && item?.mode === "choice" && ["1", "2", "3", "4"].includes(evt.key)) {
        evt.preventDefault();
        const idx = Number(evt.key) - 1;
        this.practiceResolve(idx === item.correctIndex);
      }
      return;
    }
    if (this.section !== "review") return;
    if (evt.key === " " || evt.key === "Enter") {
      evt.preventDefault();
      if (!this.flipped) this.flip();
      return;
    }
    if (this.flipped && ["1", "2", "3", "4"].includes(evt.key)) {
      evt.preventDefault();
      const map = {
        "1": Rating.Again,
        "2": Rating.Hard,
        "3": Rating.Good,
        "4": Rating.Easy
      };
      void this.rate(map[evt.key]);
      return;
    }
    if (evt.key.toLowerCase() === "s" && this.current) {
      this.plugin.speak(this.current.card.word);
    }
  }
};

// src/store.ts
var import_obsidian4 = require("obsidian");
var CardStore = class {
  constructor(app, getSettings) {
    this.app = app;
    this.getSettings = getSettings;
  }
  get folder() {
    return (0, import_obsidian4.normalizePath)(this.getSettings().cardsFolder);
  }
  /** Đọc toàn bộ thẻ trong folder (dựa vào metadataCache nên rất nhanh) */
  getAllCards() {
    const folder = this.folder + "/";
    const cards = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (!file.path.startsWith(folder)) continue;
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (!fm || fm.word == null) continue;
      cards.push(this.parseCard(file, fm));
    }
    return cards;
  }
  parseCard(file, fm) {
    const str = (v) => v == null ? "" : String(v);
    const list = (v) => {
      if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
      if (typeof v === "string" && v.trim())
        return v.split(",").map((s) => s.trim()).filter(Boolean);
      return [];
    };
    return {
      file,
      word: str(fm.word) || file.basename,
      type: str(fm.type) || "word",
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
      forms: list(fm.forms),
      fsrs: fsrsFromFrontmatter(fm),
      fsrsRev: fsrsFromFrontmatter(fm, "srs_rev_")
    };
  }
  /** Ghi một field phụ (my_example / mnemonic / grammar_note) vào frontmatter thẻ */
  async saveExtraField(card, key, value) {
    if (key === "my_example") card.myExample = value;
    else if (key === "mnemonic") card.mnemonic = value;
    else card.grammarNote = value;
    await this.app.fileManager.processFrontMatter(card.file, (fm) => {
      fm[key] = value;
    });
  }
  /** Thẻ đến hạn ôn hôm nay (đã từng học), xếp theo hạn gần nhất trước — chỉ chiều xuôi */
  getDueCards() {
    const cutoff = endOfToday().getTime();
    return this.getAllCards().filter((c) => c.fsrs.state !== State.New && c.fsrs.due.getTime() <= cutoff).sort((a, b) => a.fsrs.due.getTime() - b.fsrs.due.getTime());
  }
  /** Mọi lượt đến hạn hôm nay ở cả 2 chiều (rev chỉ tính khi bật) */
  getDueEntries(reverseEnabled) {
    const cutoff = endOfToday().getTime();
    const out = [];
    for (const c of this.getAllCards()) {
      if (c.fsrs.state !== State.New && c.fsrs.due.getTime() <= cutoff)
        out.push({ card: c, dir: "fwd" });
      if (reverseEnabled && c.fsrsRev.state !== State.New && c.fsrsRev.due.getTime() <= cutoff)
        out.push({ card: c, dir: "rev" });
    }
    return out.sort((a, b) => {
      const da = a.dir === "fwd" ? a.card.fsrs.due : a.card.fsrsRev.due;
      const db = b.dir === "fwd" ? b.card.fsrs.due : b.card.fsrsRev.due;
      return da.getTime() - db.getTime();
    });
  }
  /** Thẻ chưa học bao giờ (chiều xuôi), cũ trước mới sau */
  getNewCards() {
    return this.getAllCards().filter((c) => c.fsrs.state === State.New).sort((a, b) => a.file.stat.ctime - b.file.stat.ctime);
  }
  /** Thẻ đủ điều kiện bắt đầu chiều ngược: chiều xuôi đã vào Review, chiều ngược chưa học */
  getRevNewCards() {
    return this.getAllCards().filter(
      (c) => c.type !== "sentence" && c.type !== "passage" && c.type !== "grammar" && c.fsrs.state === State.Review && c.fsrsRev.state === State.New
    ).sort((a, b) => a.file.stat.ctime - b.file.stat.ctime);
  }
  /** Ghi trạng thái FSRS mới vào frontmatter của thẻ theo chiều học */
  async saveFsrs(card, next, dir = "fwd") {
    if (dir === "fwd") card.fsrs = next;
    else card.fsrsRev = next;
    await this.app.fileManager.processFrontMatter(card.file, (fm) => {
      fsrsToFrontmatter(next, fm, dir === "fwd" ? "srs_" : "srs_rev_");
    });
  }
  /** Tạo file thẻ mới trong subfolder theo category (vd Cards/business/word.md). Trả về TFile vừa tạo. */
  async createCard(input) {
    const category = sanitizeFilename((input.category || "general").toLowerCase().trim()) || "general";
    const targetFolder = `${this.folder}/${category}`;
    await this.ensureFolder(targetFolder);
    const base = sanitizeFilename(input.word) || "card";
    let path = (0, import_obsidian4.normalizePath)(`${targetFolder}/${base}.md`);
    let i = 1;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = (0, import_obsidian4.normalizePath)(`${targetFolder}/${base} ${++i}.md`);
    }
    const empty = createEmptyCard(/* @__PURE__ */ new Date());
    const yaml = buildCardYaml(input, empty);
    const body = `
> [!quote] Ng\u1EEF c\u1EA3nh
> ${input.quote || "_(ch\u01B0a c\xF3)_"}

Ngu\u1ED3n: ${input.source || "_(ch\u01B0a r\xF5)_"}
`;
    const file = await this.app.vault.create(path, yaml + body);
    return file;
  }
  async ensureFolder(target = this.folder) {
    const parts = target.split("/");
    let cur = "";
    for (const p of parts) {
      cur = cur ? `${cur}/${p}` : p;
      const existing = this.app.vault.getAbstractFileByPath(cur);
      if (!existing) {
        try {
          await this.app.vault.createFolder(cur);
        } catch (e) {
        }
      } else if (!(existing instanceof import_obsidian4.TFolder)) {
        new import_obsidian4.Notice(`Vocab Forge: "${cur}" \u0111\xE3 t\u1ED3n t\u1EA1i nh\u01B0ng kh\xF4ng ph\u1EA3i folder`);
        throw new Error("cards folder path conflict");
      }
    }
  }
};
function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|#^[\]{}]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}
function yamlStr(s) {
  return JSON.stringify(s ?? "");
}
function buildCardYaml(input, fsrsCard) {
  const collo = input.collocations.length ? `[${input.collocations.map((c) => yamlStr(c)).join(", ")}]` : "[]";
  const forms = input.forms.length ? `[${input.forms.map((f) => yamlStr(f)).join(", ")}]` : "[]";
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
    `forms: ${forms}`,
    `quote: ${yamlStr(input.quote)}`,
    `source: ${yamlStr(input.source)}`,
    `source_url: ${yamlStr(input.sourceUrl)}`,
    `image: ${yamlStr(input.image)}`,
    `created: ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`,
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
    "---"
  ].join("\n") + "\n";
}

// src/settingsTab.ts
var import_obsidian5 = require("obsidian");
var VocabForgeSettingTab = class extends import_obsidian5.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Vocab Forge" });
    new import_obsidian5.Setting(containerEl).setName("Folder ch\u1EE9a th\u1EBB").setDesc("M\u1ED7i th\u1EBB l\xE0 m\u1ED9t file .md trong folder n\xE0y").addText(
      (t) => t.setValue(this.plugin.settings.cardsFolder).onChange(async (v) => {
        this.plugin.settings.cardsFolder = v.trim() || "5. Toolbox/English/Cards";
        await this.plugin.saveAll();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("S\u1ED1 th\u1EBB m\u1EDBi m\u1ED7i ng\xE0y").setDesc("Gi\u1EDBi h\u1EA1n th\u1EBB m\u1EDBi \u0111\u01B0a v\xE0o h\u1ECDc m\u1ED7i ng\xE0y (ki\u1EC3u Anki)").addSlider(
      (s) => s.setLimits(0, 50, 1).setValue(this.plugin.settings.newPerDay).setDynamicTooltip().onChange(async (v) => {
        this.plugin.settings.newPerDay = v;
        await this.plugin.saveAll();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("M\u1EE9c ghi nh\u1EDB m\u1EE5c ti\xEAu (retention)").setDesc("FSRS x\u1EBFp l\u1ECBch \u0111\u1EC3 b\u1EA1n nh\u1EDB \u0111\u01B0\u1EE3c ~t\u1EF7 l\u1EC7 n\xE0y khi \xF4n. 0.9 = c\xE2n b\u1EB1ng t\u1ED1t; cao h\u01A1n = \xF4n d\xE0y h\u01A1n").addSlider(
      (s) => s.setLimits(0.8, 0.97, 0.01).setValue(this.plugin.settings.requestRetention).setDynamicTooltip().onChange(async (v) => {
        this.plugin.settings.requestRetention = v;
        this.plugin.rebuildScheduler();
        await this.plugin.saveAll();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("T\u1ED1c \u0111\u1ED9 \u0111\u1ECDc (TTS)").addSlider(
      (s) => s.setLimits(0.5, 1.5, 0.05).setValue(this.plugin.settings.ttsRate).setDynamicTooltip().onChange(async (v) => {
        this.plugin.settings.ttsRate = v;
        await this.plugin.saveAll();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("Gi\u1ECDng \u0111\u1ECDc").setDesc("Ch\u1ECDn gi\u1ECDng ti\u1EBFng Anh c\u1EE7a h\u1EC7 th\u1ED1ng").addDropdown((d) => {
      d.addOption("", "\u2014 T\u1EF1 \u0111\u1ED9ng (en) \u2014");
      for (const v of window.speechSynthesis.getVoices()) {
        if (v.lang.startsWith("en")) d.addOption(v.name, `${v.name} (${v.lang})`);
      }
      d.setValue(this.plugin.settings.ttsVoice).onChange(async (v) => {
        this.plugin.settings.ttsVoice = v;
        await this.plugin.saveAll();
      });
    });
    new import_obsidian5.Setting(containerEl).setName("Th\xF4ng tin & T\xE1c gi\u1EA3").setDesc("Tony Hoang (Tr\u1EA7n V\u0103n Ho\xE0ng) \xB7 Email: tony@tranvanhoang.com").addButton(
      (b) => b.setButtonText("\u2139\uFE0F Th\xF4ng tin plugin").onClick(() => {
        new AboutModal(this.app, this.plugin).open();
      })
    ).addButton(
      (b) => b.setButtonText("\u2709\uFE0F G\u1EEDi Email").onClick(() => {
        window.open("mailto:tony@tranvanhoang.com");
      })
    );
  }
};

// src/main.ts
var VocabForgePlugin = class extends import_obsidian6.Plugin {
  constructor() {
    super(...arguments);
    // --------------------------------------------------- HIGHLIGHT (immersion)
    this.knownRegexCache = null;
  }
  async onload() {
    const raw = await this.loadData();
    this.data = {
      settings: { ...DEFAULT_SETTINGS, ...raw?.settings ?? {} },
      stats: raw?.stats ?? {},
      xp: raw?.xp ?? 0,
      freezes: raw?.freezes ?? 1,
      frozenDays: raw?.frozenDays ?? [],
      questRewardDates: raw?.questRewardDates ?? [],
      story: raw?.story ?? null,
      badges: raw?.badges ?? {},
      lastReminder: raw?.lastReminder ?? ""
    };
    this.settings = this.data.settings;
    this.autoFreeze();
    this.store = new CardStore(this.app, () => this.settings);
    this.scheduler = makeScheduler(this.settings.requestRetention);
    this.registerView(VIEW_TYPE_VOCAB, (leaf) => new VocabReviewView(leaf, this));
    this.addRibbonIcon("graduation-cap", "Vocab Forge: \xD4n t\u1EADp", () => {
      void this.activateView();
    });
    this.addCommand({
      id: "open-review",
      name: "M\u1EDF m\xE0n \xF4n t\u1EADp",
      callback: () => void this.activateView()
    });
    this.addCommand({
      id: "add-card",
      name: "Th\xEAm th\u1EBB m\u1EDBi",
      callback: () => this.openAddCardModal()
    });
    this.addCommand({
      id: "open-about",
      name: "Th\xF4ng tin t\xE1c gi\u1EA3 & plugin (About)",
      callback: () => this.openAboutModal()
    });
    this.addCommand({
      id: "card-from-selection",
      name: "T\u1EA1o th\u1EBB t\u1EEB v\xF9ng b\xF4i \u0111en",
      editorCallback: (editor, view) => this.cardFromSelection(editor, view)
    });
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        if (!editor.getSelection().trim()) return;
        menu.addItem(
          (item) => item.setTitle("Vocab Forge: T\u1EA1o th\u1EBB t\u1EEB v\xF9ng ch\u1ECDn").setIcon("graduation-cap").onClick(() => this.cardFromSelection(editor, view))
        );
      })
    );
    this.registerMarkdownPostProcessor((el, ctx) => {
      if (ctx.sourcePath.startsWith(this.settings.cardsFolder)) return;
      try {
        this.highlightElement(el);
      } catch (e) {
        console.error("Vocab Forge highlight:", e);
      }
    });
    this.statusEl = this.addStatusBarItem();
    this.statusEl.addClass("vf-statusbar", "mod-clickable");
    this.statusEl.onclick = () => void this.activateView();
    const refresh = (0, import_obsidian6.debounce)(() => {
      this.invalidateKnownWords();
      this.refreshStatusBar();
    }, 2e3, true);
    this.registerEvent(this.app.metadataCache.on("resolved", refresh));
    this.registerEvent(this.app.vault.on("modify", refresh));
    this.registerInterval(window.setInterval(() => this.refreshStatusBar(), 6e4));
    this.registerInterval(window.setInterval(() => this.maybeRemind(), 6e4));
    this.app.workspace.onLayoutReady(() => this.refreshStatusBar());
    this.addSettingTab(new VocabForgeSettingTab(this.app, this));
  }
  onunload() {
    window.speechSynthesis.cancel();
  }
  async saveAll() {
    await this.saveData(this.data);
  }
  rebuildScheduler() {
    this.scheduler = makeScheduler(this.settings.requestRetention);
  }
  // ------------------------------------------------------------------ VIEW
  async activateView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_VOCAB);
    let leaf;
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
  openAddCardModal(prefill) {
    new AddCardModal(this.app, this, prefill).open();
  }
  openAboutModal() {
    new AboutModal(this.app, this).open();
  }
  cardFromSelection(editor, view) {
    const sel = editor.getSelection().trim();
    const file = view.file;
    const prefill = { word: sel };
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
  newRemainingToday() {
    const used = this.data.stats[todayKey()]?.newCards ?? 0;
    return Math.max(0, this.settings.newPerDay - used);
  }
  /** passed: true/false nếu thẻ đang ở trạng thái Review/Relearning (tính retention); null nếu thẻ mới/learning */
  recordReview(wasNew, passed = null) {
    var _a;
    const key = todayKey();
    const stat = (_a = this.data.stats)[key] ?? (_a[key] = { reviews: 0, newCards: 0 });
    stat.reviews++;
    if (wasNew) stat.newCards++;
    if (passed === true) stat.pass = (stat.pass ?? 0) + 1;
    else if (passed === false) stat.fail = (stat.fail ?? 0) + 1;
    this.data.xp += 10;
    this.maybeGrantQuestReward();
    this.checkBadges();
    void this.saveAll();
  }
  recordPractice(correct) {
    var _a;
    const key = todayKey();
    const stat = (_a = this.data.stats)[key] ?? (_a[key] = { reviews: 0, newCards: 0 });
    stat.practice = (stat.practice ?? 0) + 1;
    this.data.xp += correct ? 5 : 2;
    this.maybeGrantQuestReward();
    this.checkBadges();
    void this.saveAll();
  }
  computeStreak() {
    const stats = this.data.stats;
    const active = (k) => (stats[k]?.reviews ?? 0) > 0 || this.isFrozen(k);
    let streak = 0;
    const d = /* @__PURE__ */ new Date();
    if (!active(todayKey(d))) d.setDate(d.getDate() - 1);
    while (active(todayKey(d))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }
  checkBadges() {
    try {
      const fresh = checkBadges(
        { data: this.data, cards: this.store.getAllCards(), streak: this.computeStreak() },
        todayKey()
      );
      for (const b of fresh) new import_obsidian6.Notice(`${b.icon} Huy hi\u1EC7u m\u1EDBi: ${b.name} \u2014 ${b.desc}!`, 7e3);
    } catch (e) {
      console.error("Vocab Forge badges:", e);
    }
  }
  /** Nhắc học hằng ngày: đúng giờ đã đặt, còn thẻ due, chưa nhắc hôm nay */
  maybeRemind() {
    const hour = this.settings.reminderHour;
    if (hour < 0) return;
    const now = /* @__PURE__ */ new Date();
    if (now.getHours() !== hour) return;
    const key = todayKey();
    if (this.data.lastReminder === key) return;
    try {
      const due = this.store.getDueEntries(this.settings.reverseEnabled).length;
      if (due === 0) return;
      this.data.lastReminder = key;
      void this.saveAll();
      new import_obsidian6.Notice(`\u{1F4DA} Vocab Forge: ${due} th\u1EBB \u0111ang ch\u1EDD \xF4n \u2014 gi\u1EEF chu\u1ED7i ${this.computeStreak()} ng\xE0y \u{1F525}`, 1e4);
      if (typeof Notification !== "undefined" && Notification.permission !== "denied") {
        const fire = () => new Notification("Vocab Forge \u{1F393}", {
          body: `${due} th\u1EBB \u0111ang ch\u1EDD \xF4n h\xF4m nay \u2014 v\xE0o h\u1ECDc th\xF4i!`
        });
        if (Notification.permission === "granted") fire();
        else void Notification.requestPermission().then((p) => p === "granted" && fire());
      }
    } catch (e) {
      console.error("Vocab Forge reminder:", e);
    }
  }
  // ------------------------------------------------------- QUEST & STREAK
  /** 3 nhiệm vụ mỗi ngày: [tên, tiến độ, mục tiêu] */
  questProgress() {
    const s = this.data.stats[todayKey()];
    return [
      { icon: "\u{1F4D6}", name: "\xD4n t\u1EADp", cur: s?.reviews ?? 0, goal: this.settings.dailyReviewGoal },
      { icon: "\u2728", name: "Th\u1EBB m\u1EDBi", cur: s?.newCards ?? 0, goal: this.settings.dailyNewGoal },
      { icon: "\u{1F3AF}", name: "Luy\u1EC7n t\u1EADp", cur: s?.practice ?? 0, goal: this.settings.dailyPracticeGoal }
    ].filter((q) => q.goal > 0);
  }
  questsAllDone() {
    const qs = this.questProgress();
    return qs.length > 0 && qs.every((q) => q.cur >= q.goal);
  }
  questRewardClaimed() {
    return this.data.questRewardDates.includes(todayKey());
  }
  maybeGrantQuestReward() {
    if (this.questRewardClaimed() || !this.questsAllDone()) return;
    this.data.questRewardDates.push(todayKey());
    this.data.xp += 50;
    if (this.data.freezes < MAX_FREEZES) this.data.freezes++;
    new import_obsidian6.Notice("\u{1F3C6} Ho\xE0n th\xE0nh nhi\u1EC7m v\u1EE5 ng\xE0y! +50 XP, +1 \u{1F9CA} streak freeze");
  }
  /** Tự dùng streak freeze để vá các ngày nghỉ (nếu đủ freeze vá kín) */
  autoFreeze() {
    const stats = this.data.stats;
    const isActive = (k) => (stats[k]?.reviews ?? 0) > 0 || this.data.frozenDays.includes(k);
    const gap = [];
    const d = /* @__PURE__ */ new Date();
    d.setDate(d.getDate() - 1);
    for (let i = 0; i < 30; i++) {
      const k = todayKey(d);
      if (isActive(k)) {
        if (gap.length > 0 && gap.length <= this.data.freezes) {
          this.data.frozenDays.push(...gap);
          this.data.freezes -= gap.length;
          new import_obsidian6.Notice(`\u{1F9CA} \u0110\xE3 d\xF9ng ${gap.length} streak freeze \u0111\u1EC3 gi\u1EEF chu\u1ED7i ng\xE0y!`);
          void this.saveAll();
        }
        return;
      }
      gap.push(k);
      d.setDate(d.getDate() - 1);
    }
  }
  isFrozen(day) {
    return this.data.frozenDays.includes(day);
  }
  /** Regex + map các từ đã học (state != New) để highlight trong reading mode */
  getKnownWords() {
    const now = Date.now();
    if (this.knownRegexCache && now - this.knownRegexCache.at < 6e4) return this.knownRegexCache;
    const map = /* @__PURE__ */ new Map();
    const parts = [];
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const cards = this.store.getAllCards().filter(
      (c) => c.fsrs.state !== State.New && c.type !== "sentence" && c.type !== "passage" && c.type !== "grammar" && c.word.length >= 3 && c.word.split(/\s+/).length <= 4
    ).sort((a, b) => b.word.length - a.word.length);
    for (const c of cards) {
      const tokens = c.word.trim().split(/\s+/);
      const pattern = tokens.map((t, i) => i === tokens.length - 1 ? `${esc(t)}(?:s|es|ed|d|ing)?` : esc(t)).join("\\s+");
      parts.push(pattern);
      map.set(c.word.toLowerCase(), c);
      for (const suf of ["s", "es", "ed", "d", "ing"]) map.set(c.word.toLowerCase() + suf, c);
    }
    const re = parts.length ? new RegExp(`\\b(${parts.join("|")})\\b`, "gi") : null;
    this.knownRegexCache = { re, map, at: now };
    return this.knownRegexCache;
  }
  invalidateKnownWords() {
    this.knownRegexCache = null;
  }
  lookupKnown(matched) {
    const map = this.knownRegexCache?.map;
    if (!map) return void 0;
    const m = matched.toLowerCase().replace(/\s+/g, " ");
    return map.get(m);
  }
  highlightElement(el) {
    if (!this.settings.highlightEnabled) return;
    const { re } = this.getKnownWords();
    if (!re) return;
    const SKIP = /* @__PURE__ */ new Set(["CODE", "PRE", "A", "BUTTON", "INPUT", "TEXTAREA", "SVG", "STYLE"]);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        let p = node.parentElement;
        while (p && p !== el) {
          if (SKIP.has(p.tagName) || p.classList.contains("vf-known")) return NodeFilter.FILTER_REJECT;
          p = p.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const targets = [];
    let n;
    while (n = walker.nextNode()) targets.push(n);
    let budget = 200;
    for (const textNode of targets) {
      if (budget <= 0) break;
      const text = textNode.textContent ?? "";
      if (text.length < 3) continue;
      re.lastIndex = 0;
      if (!re.test(text)) continue;
      re.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0;
      let m;
      while ((m = re.exec(text)) && budget > 0) {
        frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const card = this.lookupKnown(m[1]);
        const span = document.createElement("span");
        span.textContent = m[0];
        const learning = card && (card.fsrs.state === State.Learning || card.fsrs.state === State.Relearning);
        span.className = `vf-known ${learning ? "vf-known-learning" : "vf-known-review"}`;
        if (card) span.setAttribute("aria-label", card.meaningVi || card.meaningEn);
        frag.appendChild(span);
        last = m.index + m[0].length;
        budget--;
      }
      frag.appendChild(document.createTextNode(text.slice(last)));
      textNode.replaceWith(frag);
    }
  }
  refreshStatusBar() {
    if (!this.statusEl) return;
    try {
      const due = this.store.getDueEntries(this.settings.reverseEnabled).length;
      const revNew = this.settings.reverseEnabled ? this.store.getRevNewCards().length : 0;
      const newAvail = Math.min(this.store.getNewCards().length + revNew, this.newRemainingToday());
      this.statusEl.setText(due + newAvail > 0 ? `\u{1F4DA} ${due} due \xB7 ${newAvail} m\u1EDBi` : "\u{1F4DA} xong \u2713");
    } catch {
    }
  }
  // --------------------------------------------------------------- IMAGES
  /** Sinh ảnh minh hoạ bằng grok /imagine rồi gắn vào frontmatter thẻ. Chạy nền, trả true nếu thành công. */
  async generateCardImage(file, word, meaningEn) {
    try {
      const tmp = await generateImage(word, meaningEn, this.settings.grokPath);
      if (!tmp) return false;
      const req = window.require;
      const fs = req("fs");
      const data = fs.readFileSync(tmp);
      const folder = "5. Toolbox/Attachments/Vocab";
      if (!this.app.vault.getAbstractFileByPath((0, import_obsidian6.normalizePath)(folder))) {
        try {
          await this.app.vault.createFolder((0, import_obsidian6.normalizePath)(folder));
        } catch {
        }
      }
      const imgName = `${file.basename}.png`;
      await this.app.vault.adapter.writeBinary(
        (0, import_obsidian6.normalizePath)(`${folder}/${imgName}`),
        data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      );
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        fm.image = `[[${imgName}]]`;
      });
      return true;
    } catch (e) {
      console.error("Vocab Forge image:", e);
      return false;
    }
  }
  // ------------------------------------------------------------------- TTS
  speak(text) {
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
      const voice = synth.getVoices().find((v) => v.lang === "en-US") ?? synth.getVoices().find((v) => v.lang.startsWith("en"));
      if (voice) u.voice = voice;
    }
    synth.speak(u);
  }
};
/*! Bundled license information:

ts-fsrs/dist/index.mjs:
  (* istanbul ignore next -- @preserve *)

ts-fsrs/dist/index.mjs:
  (* istanbul ignore next -- @preserve *)

ts-fsrs/dist/index.mjs:
  (* istanbul ignore next -- @preserve *)
*/
