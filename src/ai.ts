// Gọi Grok CLI headless từ trong plugin (chỉ desktop).
// Docs: https://docs.x.ai/build/cli/headless-scripting

export interface SentenceCheck {
	ok: boolean;
	score: number;
	corrected: string;
	explain_vi: string;
}

function nodeRequire(mod: string): unknown {
	// tránh bundler resolve tĩnh; chỉ chạy được trên desktop
	const req = (window as unknown as { require?: (m: string) => unknown }).require;
	if (!req) throw new Error("AI features chỉ chạy trên Obsidian desktop");
	return req(mod);
}

function resolveGrokPath(custom: string): string {
	type FS = { existsSync(p: string): boolean };
	const fs = nodeRequire("fs") as FS;
	const os = nodeRequire("os") as { homedir(): string };
	const candidates = [
		custom,
		`${os.homedir()}/.local/bin/grok`,
		"/usr/local/bin/grok",
		"/opt/homebrew/bin/grok",
	].filter(Boolean);
	for (const c of candidates) {
		if (c !== "grok" && fs.existsSync(c)) return c;
	}
	return "grok"; // hy vọng có trong PATH
}

export function runGrok(
	prompt: string,
	grokPath: string,
	timeoutMs = 90_000,
	sessionId?: string
): Promise<string> {
	type CP = {
		execFile(
			cmd: string,
			args: string[],
			opts: { timeout: number; maxBuffer: number; env: Record<string, string | undefined> },
			cb: (err: Error | null, stdout: string, stderr: string) => void
		): void;
	};
	const cp = nodeRequire("child_process") as CP;
	const os = nodeRequire("os") as { homedir(): string };
	const proc = nodeRequire("process") as { env: Record<string, string | undefined> };
	const bin = resolveGrokPath(grokPath);
	const env = { ...proc.env };
	for (const key of ["XAI_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"])
		delete env[key];
	env.PATH = `${proc.env.PATH ?? ""}:${os.homedir()}/.local/bin:/usr/local/bin:/opt/homebrew/bin`;
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

/** Lấy object JSON đầu tiên trong output (grok đôi khi kèm text quanh JSON) */
export function extractJson<T>(raw: string): T | null {
	const start = raw.indexOf("{");
	if (start === -1) return null;
	for (let end = raw.length; end > start; end--) {
		const slice = raw.slice(start, end);
		if (!slice.endsWith("}")) continue;
		try {
			return JSON.parse(slice) as T;
		} catch {
			// thử cắt ngắn hơn
		}
	}
	return null;
}

// ---------------------------------------------------------------- prompts

export function sentenceCheckPrompt(word: string, meaningEn: string, sentence: string): string {
	return (
		`You are an English teacher for a Vietnamese B1 learner. ` +
		`The learner must write a sentence using the expression "${word}"` +
		(meaningEn ? ` (meaning: ${meaningEn})` : "") +
		`. Their sentence: "${sentence}". ` +
		`Evaluate correctness and naturalness. Reply with ONLY minified JSON, no markdown: ` +
		`{"ok":true|false,"score":0-10,"corrected":"improved or corrected sentence","explain_vi":"nhận xét ngắn gọn bằng tiếng Việt"}`
	);
}

export function mnemonicPrompt(word: string, meaningVi: string): string {
	return (
		`Tạo một mẹo nhớ (mnemonic) NGẮN bằng tiếng Việt cho cụm tiếng Anh "${word}" nghĩa là "${meaningVi}". ` +
		`Tối đa 2 câu, hình ảnh sống động, có thể chơi chữ với tiếng Việt. Chỉ trả về đúng nội dung mẹo nhớ, không giải thích thêm.`
	);
}

export function grammarPrompt(quote: string): string {
	return (
		`Giải thích bằng tiếng Việt (cho người học B1) cấu trúc ngữ pháp đáng chú ý nhất trong câu tiếng Anh sau, ` +
		`kèm 1 ví dụ khác dùng cùng cấu trúc: "${quote}". Tối đa 90 từ. Chỉ trả về phần giải thích.`
	);
}

export interface CardFill {
	type: string;
	ipa: string;
	meaning_en: string;
	meaning_vi: string;
	collocations: string[];
	example: string;
	forms: string[];
	category: string;
}

export function cardFillPrompt(word: string): string {
	return (
		`You are a lexicographer helping a Vietnamese B1 English learner (works in business/AI/content). ` +
		`For the English item "${word}", reply with ONLY minified JSON, no markdown fences: ` +
		`{"type":"word|phrase|idiom|collocation","ipa":"/IPA/","meaning_en":"simple learner's-dictionary definition",` +
		`"meaning_vi":"nghĩa tiếng Việt tự nhiên","collocations":["2-3 common collocations"],` +
		`"example":"one natural example sentence using it in a business/content context",` +
		`"forms":["real inflected forms only, [] if fixed"],` +
		`"category":"business|startup|content|ai-tech|casual|idiom|general"}`
	);
}

/** Sinh ảnh minh hoạ qua grok /imagine, trả về đường dẫn file PNG tạm (hoặc null nếu fail) */
export function generateImage(
	word: string,
	meaningEn: string,
	grokPath: string,
	timeoutMs = 200_000
): Promise<string | null> {
	type FS = { existsSync(p: string): boolean; mkdirSync(p: string, o?: object): void };
	const fs = nodeRequire("fs") as FS;
	const os = nodeRequire("os") as { tmpdir(): string };
	const path = nodeRequire("path") as { join(...p: string[]): string };
	const dir = path.join(os.tmpdir(), `vf-imagine-${Date.now()}`);
	fs.mkdirSync(dir, { recursive: true });
	const prompt =
		`/imagine flat minimal vector illustration, a clear visual metaphor for the English expression "${word}"` +
		(meaningEn ? ` (meaning: ${meaningEn.slice(0, 140)})` : "") +
		`, teal and deep navy color palette, clean light background, single focused scene, no text, no letters --out out.png`;
	type CP = {
		execFile(
			cmd: string,
			args: string[],
			opts: { timeout: number; maxBuffer: number; cwd: string; env: Record<string, string | undefined> },
			cb: (err: Error | null) => void
		): void;
	};
	const cp = nodeRequire("child_process") as CP;
	const osm = nodeRequire("os") as { homedir(): string };
	const proc = nodeRequire("process") as { env: Record<string, string | undefined> };
	const bin = resolveGrokPath(grokPath);
	const env = { ...proc.env };
	for (const key of ["XAI_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"])
		delete env[key];
	env.PATH = `${proc.env.PATH ?? ""}:${osm.homedir()}/.local/bin:/usr/local/bin:/opt/homebrew/bin`;
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

export function chatStartPrompt(words: string[]): string {
	return (
		`Let's roleplay to help a Vietnamese B1 English learner practice speaking. ` +
		`You play a friendly business partner in an online meeting about growing a content/AI business. ` +
		`Rules: use simple B1 English, keep each of your turns to 2-4 sentences, ask questions that naturally invite the learner ` +
		`to use these target expressions: ${words.map((w) => `"${w}"`).join(", ")}. ` +
		`Never explain the rules or mention that this is practice. Stay in character. Start the conversation now with your first message only.`
	);
}

export function chatFeedbackPrompt(words: string[]): string {
	return (
		`Dừng roleplay. Bây giờ hãy nhận xét bằng TIẾNG VIỆT về phần thể hiện của người học trong hội thoại vừa rồi: ` +
		`(1) họ đã dùng được những từ mục tiêu nào trong: ${words.join(", ")} — dùng đúng hay sai; ` +
		`(2) 2-3 lỗi tiếng Anh đáng chú ý nhất và cách sửa; (3) một lời khen cụ thể. Tối đa 130 từ, thân thiện.`
	);
}

export function storyPrompt(words: string[], categories: string[]): string {
	const topic = categories.includes("business") || categories.includes("content")
		? "a creator building an online business"
		: "everyday work life";
	return (
		`Write a short story (100-130 words) in simple English (B1 level) about ${topic} ` +
		`that NATURALLY uses ALL of these expressions: ${words.map((w) => `"${w}"`).join(", ")}. ` +
		`Wrap each target expression in **double asterisks**. ` +
		`After the story, write a line with only "---", then a natural Vietnamese translation of the story. ` +
		`Reply with ONLY the story, the --- line, and the translation.`
	);
}
