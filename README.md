# 🎓 Vocab Forge 2.0 — English Fluency OS for Obsidian

Turn the YouTube videos and notes you already consume into a complete learning loop: **capture → remember → listen → speak → improve**. Everything stays in your Obsidian vault. AI features run through your signed-in local CLI (no API key needed on desktop) **or** through a direct API key — DeepSeek, MiniMax, OpenAI, Claude, Gemini or OpenRouter — which also works on **iPhone/iPad**.

> Học từ vựng tiếng Anh từ chính các video YouTube bạn xem — ngay trong Obsidian, giao diện như app thật, thuật toán lặp lại ngắt quãng FSRS.

## ✨ Features

- **App shell with sidebar navigation** — Dashboard · Study · Decks · Add card · Settings, with a streak badge. Narrow panes collapse the sidebar into a mobile-style bottom bar.
- **YouTube Smart Capture** — paste a URL and let `yt-dlp` fetch English subtitles, or paste/use an active-note transcript. A selected local AI CLI extracts useful expressions, previews them, blocks hallucinations/duplicates, and creates timestamped cards.
- **Fluency Lab** — source-video clip loop, blind listening, dictation scoring with word-level diff/WER, microphone recording, shadowing playback and transparent accuracy/completeness/fluency scores.
- **Voice Roleplay** — answer by microphone or keyboard, hear the AI partner speak, track target expressions, and receive end-of-session feedback. Writing corrections from card practice are saved to a personal Markdown error notebook.
- **Adaptive Today Coach** — balances due reviews, weak skills, listening, shadowing and new cards inside a configurable 5–30 minute daily session.
- **Video Comprehension Score** — estimates vocabulary coverage and CEFR difficulty, ranks unknown words, and sends the transcript directly to Smart Capture.
- **Flexible AI backend: local CLI or direct API** — on desktop, choose Claude CLI, Codex CLI, Gemini CLI or Grok CLI (Auto selects a signed-in provider; API-key environment variables are deliberately removed from child processes). Or enter an API key for DeepSeek, MiniMax, OpenAI, Claude, Gemini or OpenRouter, pick a model, and use every AI feature on mobile too. Auto mode falls back from CLI to API when the CLI is unavailable.
- **Two-sided flashcards** — front: word/phrase/sentence + IPA + auto text-to-speech; back: English + Vietnamese meaning, the **verbatim quote from the source video** (highlighted), collocations, an illustration image, and a link that opens YouTube **at the exact timestamp**.
- **FSRS scheduling** via [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) — 4 rating buttons (Again / Hard / Good / Easy) with interval previews, daily new-card limit, "again" cards return within the session.
- **Decks by category** — group cards into decks (business, startup, content, idiom, ielts, …). Study everything or one deck at a time.
- **Grid & list card browser** — grid tiles show a thumbnail: the card's illustration image if it has one, otherwise the YouTube thumbnail of the source video.
- **Dashboard** — due/new/streak stats, GitHub-style activity heatmap, "hard words" list (most lapses).
- **Plain Markdown storage** — every card is a normal `.md` note with YAML frontmatter. No hidden database: sync anywhere, edit by hand, and let AI agents create cards by simply writing files.
- **Quick capture** — add-card modal, or select text in any note → right-click → *Create vocab card* (source note + video URL auto-filled).
- **In-app settings** — new cards/day, target retention, TTS voice & speed, cards folder.

## 🤖 AI setup — local CLI (desktop) or API key (any device)

**Option A — local CLI, no API key.** Install and sign in to at least one supported CLI using its normal subscription/OAuth login:

```bash
claude --version
codex --version
gemini --version
grok --version
```

Open **Vocab Forge → Settings → AI**, keep mode `Tự động` or `Chỉ CLI`, select a provider, and press **Kiểm tra**. The plugin uses `execFile` without a shell, disables provider tools/write access for learning prompts, and does not pass common API-key environment variables to CLIs.

**Option B — direct API key (works on iPhone/iPad).** In **Vocab Forge → Settings → AI**, set mode to `Chỉ API` (or leave `Tự động` for CLI-with-API-fallback), pick a provider — **DeepSeek, MiniMax, OpenAI, Claude (Anthropic), Gemini (Google) or OpenRouter** — paste its API key, and choose a model from the suggestions or type any model ID. Use the **⚡ Test** button to verify the connection. Requests go through Obsidian's `requestUrl`, so no CORS issues and full mobile support. Note: the key is stored in plain text in the plugin's `data.json` inside your vault — be careful when syncing or sharing the vault.

For automatic YouTube subtitles, install `yt-dlp` and ensure `yt-dlp --version` works. Smart Capture still supports pasted transcripts and active notes when `yt-dlp` is unavailable.

## 📦 Install (manual)

1. Download/clone this repo into your vault:
   ```
   <your-vault>/.obsidian/plugins/vocab-forge/
   ```
   Keep `main.js`, `manifest.json`, `styles.css`, and `assets/vocab-forge-hero.jpg` together in the plugin folder (pre-built `main.js` is committed).
2. Reload Obsidian → **Settings → Community plugins → enable "Vocab Forge"**.
3. Click the 🎓 ribbon icon.

## 📚 Free vocab packs (`decks/`)

This repo ships **1,381 ready-made cards**, organized one subfolder per deck — every card starts fresh (no review history), so anyone can drop them straight into their own vault:

| Deck | Cards | Content |
|---|---|---|
| `decks/cambridge-c1/` | 347 | Cambridge Primary (Starters→Flyers) — core vocab for young learners (6–11) |
| `decks/cambridge-c2/` | 420 | Cambridge Lower Secondary (KET→PET) — everyday + academic vocab for teens (11–15) |
| `decks/cambridge-c3/` | 374 | Cambridge Upper Secondary (FCE→CAE) — academic/essay vocab, idioms, phrasal verbs (15–18) |
| `decks/idiom/` | 88 | Business/content idioms & phrasal verbs, sourced from real YouTube transcripts |
| `decks/grammar/` | 38 | Grammar patterns (cleft sentences, inversion, conditionals…) with real example quotes |
| `decks/content/`, `startup/`, `business/`, `ai-tech/` | 114 | Business/marketing/AI vocab, sourced from real YouTube transcripts |

**To import:** copy any `decks/<name>/` subfolder into your vault's configured cards folder (Settings → Vocab Forge → *Folder chứa thẻ*, default `5. Toolbox/English/Cards/`) — subfolders are scanned recursively, so `Cards/cambridge-c1/*.md` works exactly like `Cards/*.md`. Reload Obsidian, the new deck appears immediately in **🗂️ Bộ thẻ**.

Cards have no `image` (kept blank for portability — wikilinks only resolve inside their origin vault). Generate illustrations yourself with any image tool, e.g. headless [Grok CLI](https://docs.x.ai/build/cli/headless-scripting): `grok -p "/imagine <prompt> --out word.png"`.

## 🃏 Card format

One card = one Markdown file in your cards folder (default `5. Toolbox/English/Cards/`, configurable):

```yaml
---
tags: [vocab-card]
word: "double down"
type: phrase          # word | phrase | idiom | collocation | sentence | passage
category: "content"   # deck name — any string: business, startup, ielts, casual…
ipa: "/ˌdʌbl ˈdaʊn/"
meaning_en: "to commit even more strongly to something you are already doing"
meaning_vi: "dồn thêm lực, đặt cược gấp đôi vào hướng đang đi"
collocations: ["double down on relatability", "double down on what's working"]
quote: "To double down on this relatability, he said..."
source: "[[Name of the source note]]"
source_url: "https://www.youtube.com/watch?v=XXXX&t=299"
image: "[[double down.png]]"   # optional illustration; falls back to the YouTube thumbnail
created: 2026-08-18
# --- FSRS state, managed by the plugin ---
srs_due: "2026-08-18T00:00:00.000Z"
srs_stability: 0
srs_difficulty: 0
srs_elapsed_days: 0
srs_scheduled_days: 0
srs_reps: 0
srs_lapses: 0
srs_learning_steps: 0
srs_state: 0
srs_last_review: ""
---
```

Because cards are plain files, an AI assistant (Claude Code, Grok CLI, …) can bulk-ingest vocabulary from video transcripts by writing files with this schema — the plugin picks them up instantly. Illustration images can be generated with any tool (e.g. `grok -p "/imagine …"` headless) and referenced via the `image` field.

## ⌨️ Shortcuts (review)

| Key | Action |
|---|---|
| `Space` / `Enter` | Flip card |
| `1` `2` `3` `4` | Again / Hard / Good / Easy |
| `S` | Speak the word again |

## 🛠 Build from source

```bash
npm install
npm run build   # type-check + bundle → main.js
```

## License

[MIT](LICENSE) © 2026 Trần Văn Hoàng
