# 🤖 AI Agent Installation Guide: Vocab Forge Plugin & Data Packs

> **Dành cho AI Assistant / AI Agent (Claude, Cursor, Copilot, Antigravity, ChatGPT, v.v.):**  
> Khi người dùng yêu cầu cài đặt Vocab Forge vào một Vault Obsidian bất kỳ, hãy đọc và thực thi chính xác các bước dưới đây để cài đặt plugin cùng toàn bộ dữ liệu mẫu (1.380+ thẻ từ vựng).

---

## 🎯 Mục tiêu thực thi

Cài đặt đầy đủ 2 thành phần vào Obsidian Vault của người dùng:
1. **Plugin Vocab Forge** (`main.js`, `manifest.json`, `styles.css`, `assets/`) vào thư mục `.obsidian/plugins/vocab-forge/`.
2. **Kho thẻ từ vựng (Vocab Packs)** từ thư mục `decks/` (1.381 thẻ với 9 bộ chủ đề) vào thư mục lưu thẻ trong Vault (mặc định: `5. Toolbox/English/Cards/` hoặc `VocabForge/Cards/`).
3. **Kích hoạt plugin** tự động trong file `.obsidian/community-plugins.json`.

---

## 📋 Hướng dẫn từng bước cho AI (Step-by-Step Instructions)

### Bước 1: Xác định đường dẫn Vault đích (`TARGET_VAULT`)
- Xác định đường dẫn tuyệt đối đến Obsidian Vault của người dùng.
- *Ví dụ:* `TARGET_VAULT="/Users/username/Documents/MyVault"`

---

### Bước 2: Cài đặt tệp plugin vào Vault
1. Tạo thư mục plugin:
   ```bash
   mkdir -p "$TARGET_VAULT/.obsidian/plugins/vocab-forge"
   ```
2. Sao chép các tệp cốt lõi và asset giao diện từ repository này vào thư mục plugin:
   - `main.js`
   - `manifest.json`
   - `styles.css`
   - `assets/vocab-forge-hero.jpg`

   *Lệnh bash:*
   ```bash
   cp main.js manifest.json styles.css "$TARGET_VAULT/.obsidian/plugins/vocab-forge/"
   cp -r assets "$TARGET_VAULT/.obsidian/plugins/vocab-forge/"
   ```

---

### Bước 3: Sao chép dữ liệu từ vựng (1.381+ thẻ từ `decks/`)
Thư mục lưu thẻ mặc định của plugin là: `5. Toolbox/English/Cards/` (hoặc bất kỳ thư mục nào người dùng chỉ định). Plugin hỗ trợ quét đệ quy (recursive scan) toàn bộ thư mục con.

1. Tạo thư mục chứa thẻ trong Vault:
   ```bash
   CARDS_DIR="$TARGET_VAULT/5. Toolbox/English/Cards"
   mkdir -p "$CARDS_DIR"
   ```
2. Sao chép toàn bộ các bộ thẻ từ `decks/`:
   ```bash
   cp -r decks/* "$CARDS_DIR/"
   ```

#### 📚 Danh sách các bộ thẻ có sẵn:
| Thư mục bộ thẻ | Số lượng | Nội dung |
|---|---|---|
| `cambridge-c1/` | 347 thẻ | Cambridge Primary (Starters → Flyers) - Từ vựng thiếu nhi & cơ bản |
| `cambridge-c2/` | 420 thẻ | Cambridge Lower Secondary (KET → PET) - Từ vựng giao tiếp & học thuật |
| `cambridge-c3/` | 374 thẻ | Cambridge Upper Secondary (FCE → CAE) - Từ vựng nâng cao, essay & idioms |
| `idiom/` | 88 thẻ | Thành ngữ, phrasal verbs trích từ video YouTube thực tế |
| `grammar/` | 38 thẻ | Mẫu câu ngữ pháp (cleft sentences, đảo ngữ, câu điều kiện...) |
| `business/` | 34 thẻ | Tiếng Anh kinh doanh, đàm phán, quản lý |
| `startup/` | 32 thẻ | Từ vựng khởi nghiệp, gọi vốn, phát triển sản phẩm |
| `content/` | 30 thẻ | Từ vựng sáng tạo nội dung, marketing, truyền thông |
| `ai-tech/` | 18 thẻ | Thuật ngữ trí tuệ nhân tạo, công nghệ phần mềm |

---

### Bước 4: Tự động kích hoạt Plugin trong Vault (Auto-Enable)
Obsidian lưu danh sách plugin được bật tại tệp `$TARGET_VAULT/.obsidian/community-plugins.json`.

AI hãy kiểm tra và thêm `"vocab-forge"` vào danh sách nếu chưa có:

**Cách thực thi bằng Node.js / Python / jq:**
```bash
node -e '
const fs = require("fs");
const path = "'"$TARGET_VAULT"'/.obsidian/community-plugins.json";
try {
  let list = [];
  if (fs.existsSync(path)) {
    list = JSON.parse(fs.readFileSync(path, "utf8"));
  }
  if (!list.includes("vocab-forge")) {
    list.push("vocab-forge");
    fs.writeFileSync(path, JSON.stringify(list, null, 2), "utf8");
    console.log("Enabled vocab-forge in community-plugins.json");
  }
} catch (e) {
  console.error("Error updating community-plugins.json", e);
}
'
```

---

### Bước 5: Tạo tệp cấu hình ban đầu `data.json` (Tùy chọn)
Nếu người dùng muốn cấu hình sẵn đường dẫn thẻ hoặc mục tiêu hàng ngày, AI có thể tạo tệp `$TARGET_VAULT/.obsidian/plugins/vocab-forge/data.json`:

```json
{
  "settings": {
    "cardsFolder": "5. Toolbox/English/Cards",
    "newPerDay": 15,
    "requestRetention": 0.9,
    "ttsRate": 1.0,
    "ttsVoice": "",
    "highlightEnabled": true,
    "reverseEnabled": false,
    "dailyReviewGoal": 20,
    "dailyNewGoal": 10,
    "dailyPracticeGoal": 15,
    "reminderHour": 20,
    "grokPath": "grok",
    "aiProvider": "auto",
    "claudePath": "claude",
    "codexPath": "codex",
    "geminiPath": "gemini",
    "learningGoal": "business",
    "dailyMinutes": 10,
    "errorNotebookPath": "5. Toolbox/English/My English Errors.md",
    "voiceLocale": "en-US"
  },
  "stats": {},
  "xp": 0,
  "freezes": 1,
  "frozenDays": [],
  "questRewardDates": [],
  "story": null,
  "badges": {},
  "lastReminder": "",
  "skillStats": {
    "memory": { "attempts": 0, "totalScore": 0, "lastAt": "" },
    "listening": { "attempts": 0, "totalScore": 0, "lastAt": "" },
    "speaking": { "attempts": 0, "totalScore": 0, "lastAt": "" },
    "writing": { "attempts": 0, "totalScore": 0, "lastAt": "" }
  }
}
```

### Bước 6: Bật Smart Capture và AI

**Cách A — AI CLI local (desktop, không cần API key):**

- Cài `yt-dlp` nếu muốn plugin tự tải subtitle YouTube, rồi kiểm tra bằng `yt-dlp --version`.
- Cài và đăng nhập ít nhất một trong các CLI: Claude, Codex, Gemini hoặc Grok. Plugin gọi tài khoản local đã đăng nhập và không yêu cầu/truyền API key.
- Trong **Vocab Forge → Cài đặt → AI**, để chế độ **Tự động** rồi bấm **Kiểm tra**. Có thể nhập đường dẫn tuyệt đối hoặc đường dẫn bắt đầu bằng `~/` nếu Obsidian không tìm thấy binary trong `PATH`.

**Cách B — API key (dùng được trên iPhone/iPad):**

- iPhone/iPad không chạy được CLI, nên hãy dùng API: trong **Vocab Forge → Cài đặt → AI**, chọn chế độ **Chỉ API** (hoặc giữ **Tự động** — trên mobile plugin tự dùng API, trên desktop sẽ ưu tiên CLI rồi fallback sang API khi CLI lỗi).
- Chọn nhà cung cấp: **DeepSeek, MiniMax, OpenAI, Claude (Anthropic), Gemini (Google) hoặc OpenRouter**, bấm **🔑 Lấy key** để mở trang tạo key, dán key vào rồi chọn model (hoặc chọn "Khác" để tự nhập tên model bất kỳ).
- Bấm **⚡ Test** để xác nhận key hoạt động.
- Lưu ý: key được lưu dạng plaintext trong `data.json` của plugin trong vault — cẩn thận khi sync/chia sẻ vault.
- Smart Capture trên mobile: nếu chưa cấu hình API, plugin vẫn nhận transcript/note và tự tạo thẻ câu bằng fallback cục bộ.

---

## ⚡ One-Line Automated Bash Script (Dành cho AI chạy trực tiếp)

Khi AI có quyền chạy lệnh shell, có thể chạy 1 script tổng hợp sau:

```bash
#!/usr/bin/env bash
set -e

# ĐƯỜNG DẪN VAULT CỦA NGƯỜI DÙNG (Thay đổi theo thực tế)
TARGET_VAULT="$1"

if [ -z "$TARGET_VAULT" ]; then
  echo "❌ Lỗi: Cần cung cấp đường dẫn Obsidian Vault. Ví dụ: ./install.sh \"/path/to/vault\""
  exit 1
fi

PLUGIN_DIR="$TARGET_VAULT/.obsidian/plugins/vocab-forge"
CARDS_DIR="$TARGET_VAULT/5. Toolbox/English/Cards"

echo "🚀 Bắt đầu cài đặt Vocab Forge vào: $TARGET_VAULT"

# 1. Cài đặt plugin files
mkdir -p "$PLUGIN_DIR"
cp main.js manifest.json styles.css "$PLUGIN_DIR/"
cp -r assets "$PLUGIN_DIR/"
echo "✅ Đã cài đặt plugin files vào $PLUGIN_DIR"

# 2. Cài đặt vocab decks
mkdir -p "$CARDS_DIR"
cp -r decks/* "$CARDS_DIR/"
echo "✅ Đã sao chép 1.380+ thẻ từ vựng vào $CARDS_DIR"

# 3. Kích hoạt plugin trong community-plugins.json
node -e '
const fs = require("fs");
const path = "'"$TARGET_VAULT"'/.obsidian/community-plugins.json";
let list = [];
if (fs.existsSync(path)) {
  try { list = JSON.parse(fs.readFileSync(path, "utf8")); } catch (_) { list = []; }
}
if (!list.includes("vocab-forge")) {
  list.push("vocab-forge");
  fs.writeFileSync(path, JSON.stringify(list, null, 2), "utf8");
}
'
echo "✅ Đã kích hoạt plugin trong community-plugins.json"

echo "🎉 HOÀN TẤT CÀI ĐẶT! Người dùng chỉ cần mở Obsidian và nhấn icon 🎓 ở thanh bên trái."
```

---

## 🔍 Kiểm tra sau cài đặt (Verification Checklist)

AI hãy hướng dẫn hoặc xác nhận với người dùng:
1. Mở **Obsidian** > Kiểm tra icon mũ tốt nghiệp **🎓 Vocab Forge** ở thanh ribbon bên trái.
2. Vào **🗂️ Bộ thẻ (Decks)** > Kiểm tra các bộ thẻ Cambridge C1, C2, C3, Idiom, Grammar, Business đã hiển thị đầy đủ.
3. Nhấn **▶️ Học ngay** hoặc **🎯 Luyện tập** để bắt đầu buổi học đầu tiên với thuật toán FSRS.
4. Mở **✨ Smart Capture**, dán URL YouTube và xác nhận màn preview tạo đúng quote/timestamp trước khi lưu.
5. Mở **🎙️ Fluency Lab** để thử dictation, ghi âm shadowing và Video Comprehension Score.

---

## 👤 Thông tin Tác giả & Hỗ trợ

- **Tác giả:** Tony Hoang (Trần Văn Hoàng)
- **Email:** [tony@tranvanhoang.com](mailto:tony@tranvanhoang.com)
- **Plugin:** Vocab Forge v2.0.0
