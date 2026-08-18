# 🎓 Vocab Forge — English Learning App for Obsidian

Learn English vocabulary **from the YouTube videos you actually watch** — right inside Obsidian, with a real app-like UI and the **FSRS** spaced-repetition algorithm (the same modern scheduler used by new Anki).

> Học từ vựng tiếng Anh từ chính các video YouTube bạn xem — ngay trong Obsidian, giao diện như app thật, thuật toán lặp lại ngắt quãng FSRS.

## ✨ Features

- **App shell with sidebar navigation** — Dashboard · Study · Decks · Add card · Settings, with a streak badge. Narrow panes collapse the sidebar into a mobile-style bottom bar.
- **Two-sided flashcards** — front: word/phrase/sentence + IPA + auto text-to-speech; back: English + Vietnamese meaning, the **verbatim quote from the source video** (highlighted), collocations, an illustration image, and a link that opens YouTube **at the exact timestamp**.
- **FSRS scheduling** via [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) — 4 rating buttons (Again / Hard / Good / Easy) with interval previews, daily new-card limit, "again" cards return within the session.
- **Decks by category** — group cards into decks (business, startup, content, idiom, ielts, …). Study everything or one deck at a time.
- **Grid & list card browser** — grid tiles show a thumbnail: the card's illustration image if it has one, otherwise the YouTube thumbnail of the source video.
- **Dashboard** — due/new/streak stats, GitHub-style activity heatmap, "hard words" list (most lapses).
- **Plain Markdown storage** — every card is a normal `.md` note with YAML frontmatter. No hidden database: sync anywhere, edit by hand, and let AI agents create cards by simply writing files.
- **Quick capture** — add-card modal, or select text in any note → right-click → *Create vocab card* (source note + video URL auto-filled).
- **In-app settings** — new cards/day, target retention, TTS voice & speed, cards folder.

## 📦 Install (manual)

1. Download/clone this repo into your vault:
   ```
   <your-vault>/.obsidian/plugins/vocab-forge/
   ```
   The three files Obsidian needs are `main.js`, `manifest.json`, `styles.css` (pre-built `main.js` is committed).
2. Reload Obsidian → **Settings → Community plugins → enable "Vocab Forge"**.
3. Click the 🎓 ribbon icon.

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
