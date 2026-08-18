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
var import_obsidian5 = require("obsidian");

// src/addCardModal.ts
var import_obsidian = require("obsidian");

// src/types.ts
var DEFAULT_SETTINGS = {
  cardsFolder: "5. Toolbox/English/Cards",
  newPerDay: 10,
  requestRetention: 0.9,
  ttsRate: 0.95,
  ttsVoice: ""
};
var DEFAULT_CATEGORIES = [
  "business",
  "startup",
  "content",
  "casual",
  "ielts",
  "idiom",
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
  general: "\u{1F4E6}"
};
function categoryEmoji(cat) {
  return CATEGORY_EMOJI[cat] ?? "\u{1F3F7}\uFE0F";
}
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
    this.input = {
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
    }
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("vf-add-modal");
    contentEl.createEl("h3", { text: "\uFF0B Th\xEAm th\u1EBB Vocab Forge" });
    new import_obsidian.Setting(contentEl).setName("T\u1EEB / c\u1EE5m / c\xE2u / \u0111o\u1EA1n").setDesc("N\u1ED9i dung ti\u1EBFng Anh c\u1EA7n h\u1ECDc \u2014 m\u1EB7t tr\u01B0\u1EDBc c\u1EE7a th\u1EBB").addTextArea((t) => {
      t.setValue(this.input.word).onChange((v) => this.input.word = v);
      t.inputEl.rows = 2;
      t.inputEl.addClass("vf-input-wide");
    });
    new import_obsidian.Setting(contentEl).setName("Lo\u1EA1i th\u1EBB").addDropdown((d) => {
      d.addOption("word", "T\u1EEB (word)").addOption("phrase", "C\u1EE5m t\u1EEB (phrase)").addOption("idiom", "Th\xE0nh ng\u1EEF (idiom)").addOption("collocation", "Collocation").addOption("sentence", "C\xE2u (sentence)").addOption("passage", "\u0110o\u1EA1n ng\u1EAFn (passage)").setValue(this.input.type).onChange((v) => this.input.type = v);
    });
    new import_obsidian.Setting(contentEl).setName("Ch\u1EE7 \u0111\u1EC1 (deck)").setDesc("Th\u1EBB \u0111\u01B0\u1EE3c nh\xF3m theo ch\u1EE7 \u0111\u1EC1 tr\xEAn trang B\u1ED9 th\u1EBB \u2014 ch\u1ECDn c\xF3 s\u1EB5n ho\u1EB7c g\xF5 m\u1EDBi").addDropdown((d) => {
      const cats = new Set(DEFAULT_CATEGORIES);
      for (const c of this.plugin.store.getAllCards()) cats.add(c.category);
      for (const c of [...cats].sort()) d.addOption(c, c);
      if (!cats.has(this.input.category)) d.addOption(this.input.category, this.input.category);
      d.setValue(this.input.category).onChange((v) => this.input.category = v);
    }).addText(
      (t) => t.setPlaceholder("ho\u1EB7c g\xF5 ch\u1EE7 \u0111\u1EC1 m\u1EDBi\u2026").onChange((v) => {
        if (v.trim()) this.input.category = v.trim().toLowerCase();
      })
    );
    new import_obsidian.Setting(contentEl).setName("IPA").setDesc("Phi\xEAn \xE2m, v\xED d\u1EE5 /\u02C8d\u028Cb\u0259l da\u028An/ \u2014 b\u1ECF tr\u1ED1ng n\u1EBFu l\xE0 c\xE2u/\u0111o\u1EA1n").addText((t) => t.setValue(this.input.ipa).onChange((v) => this.input.ipa = v));
    new import_obsidian.Setting(contentEl).setName("Ngh\u0129a Anh\u2013Anh").setDesc("\u0110\u1ECBnh ngh\u0129a b\u1EB1ng ti\u1EBFng Anh \u0111\u01A1n gi\u1EA3n").addTextArea((t) => {
      t.setValue(this.input.meaningEn).onChange((v) => this.input.meaningEn = v);
      t.inputEl.rows = 2;
      t.inputEl.addClass("vf-input-wide");
    });
    new import_obsidian.Setting(contentEl).setName("Ngh\u0129a ti\u1EBFng Vi\u1EC7t").addTextArea((t) => {
      t.setValue(this.input.meaningVi).onChange((v) => this.input.meaningVi = v);
      t.inputEl.rows = 2;
      t.inputEl.addClass("vf-input-wide");
    });
    new import_obsidian.Setting(contentEl).setName("Quote \u2014 c\xE2u ng\u1EEF c\u1EA3nh th\u1EADt").setDesc("C\xE2u ch\u1EE9a t\u1EEB n\xE0y, tr\xEDch t\u1EEB video/b\xE0i g\u1ED1c").addTextArea((t) => {
      t.setValue(this.input.quote).onChange((v) => this.input.quote = v);
      t.inputEl.rows = 2;
      t.inputEl.addClass("vf-input-wide");
    });
    new import_obsidian.Setting(contentEl).setName("Collocations").setDesc("C\xE1c c\u1EE5m \u0111i k\xE8m, c\xE1ch nhau d\u1EA5u ph\u1EA9y").addText(
      (t) => t.onChange((v) => {
        this.input.collocations = v.split(",").map((s) => s.trim()).filter(Boolean);
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
    new import_obsidian.Setting(contentEl).setName("Link video (k\xE8m timestamp n\u1EBFu c\xF3)").addText((t) => {
      t.setValue(this.input.sourceUrl).onChange((v) => this.input.sourceUrl = v);
      this.urlText = t.inputEl;
    });
    new import_obsidian.Setting(contentEl).setName("\u1EA2nh minh ho\u1EA1").setDesc("URL ho\u1EB7c \u0111\u01B0\u1EDDng d\u1EABn/wikilink \u1EA3nh trong vault").addText((t) => t.setValue(this.input.image).onChange((v) => this.input.image = v));
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

// src/reviewView.ts
var import_obsidian2 = require("obsidian");

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
function fsrsFromFrontmatter(fm) {
  const empty = createEmptyCard(/* @__PURE__ */ new Date());
  if (fm.srs_due == null) return empty;
  const num = (v, fallback) => typeof v === "number" && isFinite(v) ? v : fallback;
  const date = (v) => {
    if (typeof v !== "string" && !(v instanceof Date)) return void 0;
    const d = new Date(v);
    return isNaN(d.getTime()) ? void 0 : d;
  };
  return {
    ...empty,
    due: date(fm.srs_due) ?? empty.due,
    stability: num(fm.srs_stability, 0),
    difficulty: num(fm.srs_difficulty, 0),
    elapsed_days: num(fm.srs_elapsed_days, 0),
    scheduled_days: num(fm.srs_scheduled_days, 0),
    reps: num(fm.srs_reps, 0),
    lapses: num(fm.srs_lapses, 0),
    learning_steps: num(fm.srs_learning_steps, 0),
    state: num(fm.srs_state, State.New),
    last_review: date(fm.srs_last_review)
  };
}
function fsrsToFrontmatter(card, fm) {
  fm.srs_due = card.due.toISOString();
  fm.srs_stability = round4(card.stability);
  fm.srs_difficulty = round4(card.difficulty);
  fm.srs_elapsed_days = card.elapsed_days;
  fm.srs_scheduled_days = card.scheduled_days;
  fm.srs_reps = card.reps;
  fm.srs_lapses = card.lapses;
  fm.srs_learning_steps = card.learning_steps;
  fm.srs_state = card.state;
  fm.srs_last_review = card.last_review ? card.last_review.toISOString() : "";
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
    icon: "\u{1F500}",
    name: "X\u1EBFp c\xE2u (Builder)",
    desc: "X\xE1o tr\u1ED9n c\xE2u quote \u2014 b\u1EA5m x\u1EBFp l\u1EA1i \u0111\xFAng th\u1EE9 t\u1EF1"
  },
  choice: {
    icon: "\u2705",
    name: "Tr\u1EAFc nghi\u1EC7m (Choice)",
    desc: "Ch\u1ECDn ngh\u0129a \u0111\xFAng trong 4 \u0111\xE1p \xE1n"
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
  if (card.type === "sentence" || card.type === "passage") return null;
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
  if (card.type === "sentence" || card.type === "passage") return null;
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
function buildPracticeQueue(mode, cards, size) {
  const learned = cards.filter((c) => c.fsrs.state !== State.New);
  const fresh = cards.filter((c) => c.fsrs.state === State.New);
  const ordered = [...shuffle(learned), ...shuffle(fresh)];
  const items = [];
  for (const card of ordered) {
    let item = null;
    if (mode === "cloze") item = makeCloze(card);
    else if (mode === "typing") item = makeTyping(card);
    else if (mode === "builder") item = makeBuilder(card);
    else item = makeChoice(card, cards);
    if (item) items.push(item);
    if (items.length === size) break;
  }
  return items;
}

// src/reviewView.ts
var VIEW_TYPE_VOCAB = "vocab-forge-review";
var TYPE_LABELS = {
  word: "T\u1EEB",
  phrase: "C\u1EE5m t\u1EEB",
  idiom: "Th\xE0nh ng\u1EEF",
  collocation: "Collocation",
  sentence: "C\xE2u",
  passage: "\u0110o\u1EA1n"
};
var STATE_LABELS = {
  [State.New]: "M\u1EDBi",
  [State.Learning]: "\u0110ang h\u1ECDc",
  [State.Review]: "\xD4n t\u1EADp",
  [State.Relearning]: "H\u1ECDc l\u1EA1i"
};
var VocabReviewView = class _VocabReviewView extends import_obsidian2.ItemView {
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
      case "settings":
        this.renderSettings(main);
        break;
    }
  }
  renderNav(app) {
    const nav = app.createDiv({ cls: "vf-nav" });
    const brand = nav.createDiv({ cls: "vf-brand" });
    brand.createSpan({ text: "\u{1F393}", cls: "vf-brand-icon" });
    brand.createSpan({ text: "Vocab Forge", cls: "vf-brand-name" });
    const items = [
      { id: "dashboard", icon: "\u{1F3E0}", label: "Dashboard" },
      { id: "study", icon: "\u25B6\uFE0F", label: "H\u1ECDc ngay" },
      { id: "practice", icon: "\u{1F3AF}", label: "Luy\u1EC7n t\u1EADp" },
      { id: "decks", icon: "\u{1F5C2}\uFE0F", label: "B\u1ED9 th\u1EBB" },
      { id: "add", icon: "\u2795", label: "Th\xEAm th\u1EBB" },
      { id: "settings", icon: "\u2699\uFE0F", label: "C\xE0i \u0111\u1EB7t" }
    ];
    for (const it of items) {
      const active = it.id === this.section || it.id === "study" && (this.section === "review" || this.section === "done") || it.id === "practice" && (this.section === "practice-run" || this.section === "practice-done") || it.id === "decks" && this.section === "deck-detail";
      const el = nav.createDiv({ cls: `vf-nav-item ${active ? "vf-nav-active" : ""}` });
      el.createSpan({ text: it.icon, cls: "vf-nav-icon" });
      el.createSpan({ text: it.label, cls: "vf-nav-label" });
      el.onclick = () => {
        if (it.id === "study") this.startSession(null);
        else if (it.id === "add") this.plugin.openAddCardModal();
        else {
          this.section = it.id;
          this.render();
        }
      };
    }
    const foot = nav.createDiv({ cls: "vf-nav-foot" });
    foot.createDiv({ text: `\u{1F525} ${this.computeStreak()} ng\xE0y`, cls: "vf-nav-streak" });
  }
  // ============================================================ DASHBOARD
  renderDashboard(main) {
    const due = this.plugin.store.getDueCards();
    const news = this.plugin.store.getNewCards();
    const newAvailable = Math.min(news.length, this.plugin.newRemainingToday());
    const all = this.plugin.store.getAllCards();
    const learned = all.filter((c) => c.fsrs.state !== State.New).length;
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
    const ring = hero.createDiv({ cls: "vf-hero-ring" });
    const pct = today ? Math.min(100, Math.round(today.reviews / Math.max(1, today.reviews + total) * 100)) : total > 0 ? 0 : 100;
    ring.style.setProperty("--vf-pct", String(pct));
    ring.createDiv({ text: `${pct}%`, cls: "vf-hero-ring-text" });
    const tiles = main.createDiv({ cls: "vf-tiles" });
    this.tile(tiles, "\u23F0", String(due.length), "\u0110\u1EBFn h\u1EA1n", "vf-tile-due");
    this.tile(tiles, "\u2728", String(newAvailable), "Th\u1EBB m\u1EDBi", "vf-tile-new");
    this.tile(tiles, "\u{1F4D6}", String(today?.reviews ?? 0), "L\u01B0\u1EE3t \xF4n h\xF4m nay", "");
    this.tile(tiles, "\u{1F3C6}", `${learned}/${all.length}`, "\u0110\xE3 h\u1ECDc / t\u1ED5ng", "");
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
    main.createEl("h4", { text: "Ho\u1EA1t \u0111\u1ED9ng 17 tu\u1EA7n" });
    this.renderHeatmap(main.createDiv({ cls: "vf-heatmap" }));
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
    let due = this.plugin.store.getDueCards();
    let news = this.plugin.store.getNewCards();
    if (category) {
      due = due.filter((c) => c.category === category);
      news = news.filter((c) => c.category === category);
    }
    news = news.slice(0, this.plugin.newRemainingToday());
    this.queue = [...due, ...news];
    this.sessionTotal = this.queue.length;
    this.sessionDone = 0;
    if (!this.queue.length) {
      this.section = "dashboard";
      this.render();
      new import_obsidian2.Notice("Kh\xF4ng c\xF2n th\u1EBB \u0111\u1EC3 h\u1ECDc \u{1F389}");
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
    let idx = this.queue.findIndex(
      (c) => c.fsrs.state === State.New || c.fsrs.due.getTime() <= now
    );
    if (idx === -1) idx = 0;
    this.current = this.queue.splice(idx, 1)[0];
    this.flipped = false;
    this.render();
  }
  renderCard(main) {
    const card = this.current;
    if (!card) {
      this.section = "dashboard";
      this.render();
      return;
    }
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
    const cardEl = main.createDiv({ cls: "vf-card vf-anim-pop" });
    const front = cardEl.createDiv({ cls: "vf-card-front" });
    const badgeRow = front.createDiv({ cls: "vf-badge-row" });
    badgeRow.createSpan({ text: `${categoryEmoji(card.category)} ${card.category}`, cls: "vf-chip-cat" });
    badgeRow.createSpan({ text: TYPE_LABELS[card.type] ?? card.type, cls: "vf-chip-type" });
    if (card.fsrs.state === State.New) badgeRow.createSpan({ text: "\u2728 m\u1EDBi", cls: "vf-chip-new" });
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
    if (!this.flipped) {
      const flipBtn = main.createEl("button", {
        text: "L\u1EADt th\u1EBB \u{1F446}  \xB7  Space",
        cls: "vf-btn-flip"
      });
      flipBtn.onclick = () => this.flip();
      cardEl.onclick = () => this.flip();
      this.plugin.speak(card.word);
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
    const now = /* @__PURE__ */ new Date();
    const preview = this.plugin.scheduler.repeat(card.fsrs, now);
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
    this.flipped = true;
    this.render();
  }
  async rate(grade) {
    const card = this.current;
    if (!card || this.rating) return;
    this.rating = true;
    try {
      const wasNew = card.fsrs.state === State.New;
      const next = this.plugin.scheduler.repeat(card.fsrs, /* @__PURE__ */ new Date())[grade].card;
      await this.plugin.store.saveFsrs(card, next);
      this.plugin.recordReview(wasNew);
      this.sessionDone++;
      if (next.due.getTime() <= endOfToday().getTime()) {
        this.queue.push(card);
        this.sessionTotal++;
      }
    } catch (e) {
      console.error("Vocab Forge: l\u1ED7i khi l\u01B0u th\u1EBB", e);
      new import_obsidian2.Notice("Vocab Forge: kh\xF4ng l\u01B0u \u0111\u01B0\u1EE3c th\u1EBB \u2014 xem console");
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
      tile.createDiv({ text: info.icon, cls: "vf-mode-icon" });
      tile.createDiv({ text: info.name, cls: "vf-mode-name" });
      tile.createDiv({ text: info.desc, cls: "vf-mode-desc" });
      tile.onclick = () => this.startPractice(mode);
    });
  }
  startPractice(mode) {
    let cards = this.plugin.store.getAllCards();
    if (this.practiceDeck) cards = cards.filter((c) => c.category === this.practiceDeck);
    const queue = buildPracticeQueue(mode, cards, this.practiceSize);
    if (queue.length < 3) {
      new import_obsidian2.Notice("Deck n\xE0y ch\u01B0a \u0111\u1EE7 th\u1EBB ph\xF9 h\u1EE3p cho ch\u1EBF \u0111\u1ED9 \u0111\xF3 (c\u1EA7n \u2265 3)");
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
    return item.card.word;
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
      b.createSpan({ text: opt });
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
      this.practiceResolve(fuzzyEqual(val, [item.surface, item.card.word]));
    } else if (item.mode === "typing") {
      const val = this.practiceInput?.value ?? "";
      this.practiceResolve(fuzzyEqual(val, [item.card.word]));
    }
  }
  practiceResolve(correct) {
    const item = this.currentPractice();
    if (!item) return;
    this.practicePhase = "feedback";
    this.practiceCorrect = correct;
    if (correct) this.practiceScore++;
    else this.practiceWrong.push(item);
    this.plugin.recordPractice();
    this.plugin.speak(item.mode === "builder" ? item.tokens.join(" ") : item.card.word);
    this.render();
  }
  practiceNext() {
    this.practiceIdx++;
    this.practicePhase = "question";
    this.builderPicked = [];
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
  }
  // ================================================================ MISC
  computeStreak() {
    const stats = this.plugin.data.stats;
    let streak = 0;
    const d = /* @__PURE__ */ new Date();
    if (!stats[todayKey(d)]?.reviews) d.setDate(d.getDate() - 1);
    while ((stats[todayKey(d)]?.reviews ?? 0) > 0) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
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
        const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 10 ? 3 : 4;
        const cell = col.createDiv({ cls: `vf-heat-cell vf-heat-${level}` });
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
      this.plugin.speak(this.current.word);
    }
  }
};

// src/store.ts
var import_obsidian3 = require("obsidian");
var CardStore = class {
  constructor(app, getSettings) {
    this.app = app;
    this.getSettings = getSettings;
  }
  get folder() {
    return (0, import_obsidian3.normalizePath)(this.getSettings().cardsFolder);
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
      fsrs: fsrsFromFrontmatter(fm)
    };
  }
  /** Thẻ đến hạn ôn hôm nay (đã từng học), xếp theo hạn gần nhất trước */
  getDueCards() {
    const cutoff = endOfToday().getTime();
    return this.getAllCards().filter((c) => c.fsrs.state !== State.New && c.fsrs.due.getTime() <= cutoff).sort((a, b) => a.fsrs.due.getTime() - b.fsrs.due.getTime());
  }
  /** Thẻ chưa học bao giờ, cũ trước mới sau */
  getNewCards() {
    return this.getAllCards().filter((c) => c.fsrs.state === State.New).sort((a, b) => a.file.stat.ctime - b.file.stat.ctime);
  }
  /** Ghi trạng thái FSRS mới vào frontmatter của thẻ */
  async saveFsrs(card, next) {
    card.fsrs = next;
    await this.app.fileManager.processFrontMatter(card.file, (fm) => {
      fsrsToFrontmatter(next, fm);
    });
  }
  /** Tạo file thẻ mới trong folder thẻ. Trả về TFile vừa tạo. */
  async createCard(input) {
    await this.ensureFolder();
    const base = sanitizeFilename(input.word) || "card";
    let path = (0, import_obsidian3.normalizePath)(`${this.folder}/${base}.md`);
    let i = 1;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = (0, import_obsidian3.normalizePath)(`${this.folder}/${base} ${++i}.md`);
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
  async ensureFolder() {
    const parts = this.folder.split("/");
    let cur = "";
    for (const p of parts) {
      cur = cur ? `${cur}/${p}` : p;
      const existing = this.app.vault.getAbstractFileByPath(cur);
      if (!existing) {
        try {
          await this.app.vault.createFolder(cur);
        } catch (e) {
        }
      } else if (!(existing instanceof import_obsidian3.TFolder)) {
        new import_obsidian3.Notice(`Vocab Forge: "${cur}" \u0111\xE3 t\u1ED3n t\u1EA1i nh\u01B0ng kh\xF4ng ph\u1EA3i folder`);
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
var import_obsidian4 = require("obsidian");
var VocabForgeSettingTab = class extends import_obsidian4.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Vocab Forge" });
    new import_obsidian4.Setting(containerEl).setName("Folder ch\u1EE9a th\u1EBB").setDesc("M\u1ED7i th\u1EBB l\xE0 m\u1ED9t file .md trong folder n\xE0y").addText(
      (t) => t.setValue(this.plugin.settings.cardsFolder).onChange(async (v) => {
        this.plugin.settings.cardsFolder = v.trim() || "5. Toolbox/English/Cards";
        await this.plugin.saveAll();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("S\u1ED1 th\u1EBB m\u1EDBi m\u1ED7i ng\xE0y").setDesc("Gi\u1EDBi h\u1EA1n th\u1EBB m\u1EDBi \u0111\u01B0a v\xE0o h\u1ECDc m\u1ED7i ng\xE0y (ki\u1EC3u Anki)").addSlider(
      (s) => s.setLimits(0, 50, 1).setValue(this.plugin.settings.newPerDay).setDynamicTooltip().onChange(async (v) => {
        this.plugin.settings.newPerDay = v;
        await this.plugin.saveAll();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("M\u1EE9c ghi nh\u1EDB m\u1EE5c ti\xEAu (retention)").setDesc("FSRS x\u1EBFp l\u1ECBch \u0111\u1EC3 b\u1EA1n nh\u1EDB \u0111\u01B0\u1EE3c ~t\u1EF7 l\u1EC7 n\xE0y khi \xF4n. 0.9 = c\xE2n b\u1EB1ng t\u1ED1t; cao h\u01A1n = \xF4n d\xE0y h\u01A1n").addSlider(
      (s) => s.setLimits(0.8, 0.97, 0.01).setValue(this.plugin.settings.requestRetention).setDynamicTooltip().onChange(async (v) => {
        this.plugin.settings.requestRetention = v;
        this.plugin.rebuildScheduler();
        await this.plugin.saveAll();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("T\u1ED1c \u0111\u1ED9 \u0111\u1ECDc (TTS)").addSlider(
      (s) => s.setLimits(0.5, 1.5, 0.05).setValue(this.plugin.settings.ttsRate).setDynamicTooltip().onChange(async (v) => {
        this.plugin.settings.ttsRate = v;
        await this.plugin.saveAll();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Gi\u1ECDng \u0111\u1ECDc").setDesc("Ch\u1ECDn gi\u1ECDng ti\u1EBFng Anh c\u1EE7a h\u1EC7 th\u1ED1ng").addDropdown((d) => {
      d.addOption("", "\u2014 T\u1EF1 \u0111\u1ED9ng (en) \u2014");
      for (const v of window.speechSynthesis.getVoices()) {
        if (v.lang.startsWith("en")) d.addOption(v.name, `${v.name} (${v.lang})`);
      }
      d.setValue(this.plugin.settings.ttsVoice).onChange(async (v) => {
        this.plugin.settings.ttsVoice = v;
        await this.plugin.saveAll();
      });
    });
  }
};

// src/main.ts
var VocabForgePlugin = class extends import_obsidian5.Plugin {
  async onload() {
    const raw = await this.loadData();
    this.data = {
      settings: { ...DEFAULT_SETTINGS, ...raw?.settings ?? {} },
      stats: raw?.stats ?? {}
    };
    this.settings = this.data.settings;
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
    this.statusEl = this.addStatusBarItem();
    this.statusEl.addClass("vf-statusbar", "mod-clickable");
    this.statusEl.onclick = () => void this.activateView();
    const refresh = (0, import_obsidian5.debounce)(() => this.refreshStatusBar(), 2e3, true);
    this.registerEvent(this.app.metadataCache.on("resolved", refresh));
    this.registerEvent(this.app.vault.on("modify", refresh));
    this.registerInterval(window.setInterval(() => this.refreshStatusBar(), 6e4));
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
  recordReview(wasNew) {
    var _a;
    const key = todayKey();
    const stat = (_a = this.data.stats)[key] ?? (_a[key] = { reviews: 0, newCards: 0 });
    stat.reviews++;
    if (wasNew) stat.newCards++;
    void this.saveAll();
  }
  recordPractice() {
    var _a;
    const key = todayKey();
    const stat = (_a = this.data.stats)[key] ?? (_a[key] = { reviews: 0, newCards: 0 });
    stat.practice = (stat.practice ?? 0) + 1;
    void this.saveAll();
  }
  refreshStatusBar() {
    if (!this.statusEl) return;
    try {
      const due = this.store.getDueCards().length;
      const newAvail = Math.min(this.store.getNewCards().length, this.newRemainingToday());
      this.statusEl.setText(due + newAvail > 0 ? `\u{1F4DA} ${due} due \xB7 ${newAvail} m\u1EDBi` : "\u{1F4DA} xong \u2713");
    } catch {
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
ts-fsrs/dist/index.mjs:
ts-fsrs/dist/index.mjs:
  (* istanbul ignore next -- @preserve *)
*/
