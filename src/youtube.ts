/**
 * YouTube subtitle utilities used by Smart Capture.
 *
 * This module deliberately uses child_process.execFile (never a shell) and only
 * accepts recognised YouTube hosts. It remains import-safe on Obsidian mobile;
 * desktop-only Node modules are resolved lazily when a download is requested.
 */

export interface TranscriptCue {
	startSeconds: number | null;
	endSeconds: number | null;
	text: string;
}

export interface YouTubeSubtitleResult {
	url: string;
	title: string;
	transcript: string;
	cues: TranscriptCue[];
}

export interface FetchYouTubeSubtitleOptions {
	ytDlpPath?: string;
	timeoutMs?: number;
}

const YOUTUBE_HOSTS = new Set([
	"youtube.com",
	"www.youtube.com",
	"m.youtube.com",
	"music.youtube.com",
	"youtu.be",
	"youtube-nocookie.com",
	"www.youtube-nocookie.com",
]);

function nodeRequire(moduleName: string): unknown {
	const req = (window as unknown as { require?: (name: string) => unknown }).require;
	if (!req) throw new Error("Tải subtitle chỉ hỗ trợ Obsidian Desktop");
	return req(moduleName);
}

/** Return a video id for supported YouTube URL shapes, or null for unsafe/invalid URLs. */
export function getYouTubeVideoId(value: string): string | null {
	try {
		const url = new URL(value.trim());
		if (url.protocol !== "https:" && url.protocol !== "http:") return null;
		if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null;
		let id = "";
		if (url.hostname.toLowerCase() === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] ?? "";
		else if (url.pathname === "/watch") id = url.searchParams.get("v") ?? "";
		else {
			const parts = url.pathname.split("/").filter(Boolean);
			if (["shorts", "embed", "live"].includes(parts[0] ?? "")) id = parts[1] ?? "";
		}
		return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
	} catch {
		return null;
	}
}

export function isYouTubeUrl(value: string): boolean {
	return getYouTubeVideoId(value) !== null;
}

/** Make a timestamped URL without string concatenation or losing existing query parameters. */
export function youtubeUrlAt(value: string, seconds: number | null): string {
	if (seconds == null || !Number.isFinite(seconds) || seconds < 1) return value.trim();
	try {
		const url = new URL(value.trim());
		url.searchParams.set("t", String(Math.floor(seconds)));
		return url.toString();
	} catch {
		return value.trim();
	}
}

function timestampSeconds(raw: string): number | null {
	const bits = raw.trim().replace(",", ".").split(":");
	if (bits.length < 2 || bits.length > 3) return null;
	const nums = bits.map(Number);
	if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
	if (nums.length === 2) return nums[0] * 60 + nums[1];
	return nums[0] * 3600 + nums[1] * 60 + nums[2];
}

function decodeEntities(text: string): string {
	const el = document.createElement("textarea");
	el.innerHTML = text;
	return el.value;
}

function cleanCaption(text: string): string {
	return decodeEntities(
		text
			.replace(/<\/?c(?:\.[^ >]+)*>/gi, "")
			.replace(/<\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3}>/g, "")
			.replace(/<[^>]+>/g, "")
			.replace(/\{\\[^}]+}/g, "")
	)
		.replace(/\s+/g, " ")
		.trim();
}

function compactCues(cues: TranscriptCue[]): TranscriptCue[] {
	const out: TranscriptCue[] = [];
	for (const cue of cues) {
		const text = cleanCaption(cue.text);
		if (!text || /^\[(music|applause|laughter|silence)\]$/i.test(text)) continue;
		const previous = out[out.length - 1];
		if (previous && previous.text.toLocaleLowerCase() === text.toLocaleLowerCase()) {
			previous.endSeconds = cue.endSeconds ?? previous.endSeconds;
			continue;
		}
		// Auto-generated YouTube VTT often repeats a growing caption every 100-300ms.
		if (
			previous &&
			cue.startSeconds != null &&
			previous.startSeconds != null &&
			cue.startSeconds - previous.startSeconds < 4 &&
			text.toLocaleLowerCase().startsWith(previous.text.toLocaleLowerCase())
		) {
			previous.text = text;
			previous.endSeconds = cue.endSeconds;
			continue;
		}
		out.push({ ...cue, text });
	}
	return out;
}

function parseVttOrSrt(text: string): TranscriptCue[] {
	const lines = text.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n");
	const cues: TranscriptCue[] = [];
	const timing = /((?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)/;
	for (let i = 0; i < lines.length; i++) {
		const match = lines[i].match(timing);
		if (!match) continue;
		const body: string[] = [];
		for (i += 1; i < lines.length && lines[i].trim(); i++) body.push(lines[i]);
		cues.push({
			startSeconds: timestampSeconds(match[1]),
			endSeconds: timestampSeconds(match[2]),
			text: body.join(" "),
		});
	}
	return compactCues(cues);
}

function parseTimestampedLines(text: string): TranscriptCue[] {
	const lines = text.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n");
	const cues: TranscriptCue[] = [];
	const prefix = /^\s*(?:\[)?((?:\d{1,2}:)?\d{1,2}:\d{2})(?:\])?\s*(?:[-–—|]\s*)?(.*)$/;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;
		const match = line.match(prefix);
		if (match) {
			let caption = match[2].trim();
			if (!caption) {
				let next = i + 1;
				while (next < lines.length && !lines[next].trim()) next++;
				if (next < lines.length && !prefix.test(lines[next])) {
					caption = lines[next].trim();
					i = next;
				}
			}
			cues.push({ startSeconds: timestampSeconds(match[1]), endSeconds: null, text: caption });
		} else if (cues.length) {
			cues[cues.length - 1].text += ` ${line}`;
		}
	}
	for (let i = 0; i < cues.length - 1; i++) cues[i].endSeconds = cues[i + 1].startSeconds;
	return compactCues(cues);
}

function parsePlainText(text: string): TranscriptCue[] {
	const cleaned = text
		.replace(/^---\r?\n[\s\S]*?\r?\n---\s*/, "")
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/\r/g, "")
		.trim();
	if (!cleaned) return [];
	const chunks = cleaned
		.split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z\"'])/)
		.map(cleanCaption)
		.filter(Boolean);
	return chunks.map((chunk) => ({ startSeconds: null, endSeconds: null, text: chunk }));
}

/** Parse WebVTT, SRT, YouTube's copied timestamp format, or ordinary prose. */
export function parseTranscript(text: string): TranscriptCue[] {
	const timed = parseVttOrSrt(text);
	if (timed.length) return timed;
	const timestamped = parseTimestampedLines(text);
	if (timestamped.length) return timestamped;
	return parsePlainText(text);
}

export function transcriptForAi(cues: TranscriptCue[]): string {
	return cues
		.map((cue) => {
			if (cue.startSeconds == null) return cue.text;
			const total = Math.max(0, Math.floor(cue.startSeconds));
			const h = Math.floor(total / 3600);
			const m = Math.floor((total % 3600) / 60);
			const s = total % 60;
			const stamp = h
				? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
				: `${m}:${String(s).padStart(2, "0")}`;
			return `[${stamp}] ${cue.text}`;
		})
		.join("\n");
}

/**
 * Fetch English subtitles using a locally installed yt-dlp binary.
 * The URL is passed as a single argv item, playlists are disabled, and all
 * output is constrained to a fresh OS temp directory that is removed finally.
 */
export async function fetchYouTubeSubtitles(
	value: string,
	options: FetchYouTubeSubtitleOptions = {}
): Promise<YouTubeSubtitleResult> {
	const inputUrl = value.trim();
	if (inputUrl.length > 2048 || !isYouTubeUrl(inputUrl)) {
		throw new Error("URL YouTube không hợp lệ");
	}
	type FS = {
		mkdtempSync(prefix: string): string;
		readdirSync(path: string): string[];
		readFileSync(path: string, encoding: "utf8"): string;
		rmSync(path: string, options: { recursive: boolean; force: boolean }): void;
		existsSync(path: string): boolean;
	};
	type CP = {
		execFile(
			file: string,
			args: string[],
			options: { timeout: number; maxBuffer: number; env: Record<string, string | undefined> },
			callback: (error: Error | null, stdout: string, stderr: string) => void
		): void;
	};
	const fs = nodeRequire("fs") as FS;
	const os = nodeRequire("os") as { tmpdir(): string; homedir(): string };
	const path = nodeRequire("path") as { join(...parts: string[]): string; isAbsolute(path: string): boolean; delimiter: string };
	const processModule = nodeRequire("process") as { env: Record<string, string | undefined> };
	const cp = nodeRequire("child_process") as CP;
	const requestedBin = options.ytDlpPath?.trim() || "yt-dlp";
	if (path.isAbsolute(requestedBin) && !fs.existsSync(requestedBin)) {
		throw new Error(`Không tìm thấy yt-dlp tại ${requestedBin}`);
	}
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vocab-forge-subtitles-"));
	const outputTemplate = path.join(tempDir, "subtitle.%(ext)s");
	const env = {
		...processModule.env,
		PATH: [
			processModule.env.PATH ?? "",
			path.join(os.homedir(), ".local", "bin"),
			"/usr/local/bin",
			"/opt/homebrew/bin",
		].filter(Boolean).join(path.delimiter),
	};
	try {
		const stdout = await new Promise<string>((resolve, reject) => {
			cp.execFile(
				requestedBin,
				[
					"--ignore-config",
					"--no-playlist",
					"--no-simulate",
					"--skip-download",
					"--write-subs",
					"--write-auto-subs",
					"--sub-langs",
					"en.*,en",
					"--sub-format",
					"vtt",
					"--output",
					outputTemplate,
					"--print",
					"title",
					inputUrl,
				],
				{ timeout: options.timeoutMs ?? 90_000, maxBuffer: 2 * 1024 * 1024, env },
				(error, out, stderr) => {
					if (error) {
						const detail = String(stderr || error.message).trim().slice(0, 300);
						reject(new Error(detail || "yt-dlp không tải được subtitle"));
					} else resolve(String(out));
				}
			);
		});
		const files = fs
			.readdirSync(tempDir)
			.filter((name) => /\.(vtt|srt)$/i.test(name))
			.sort((a, b) => {
				const aScore = /\.en(?:[-_.]|$)/i.test(a) ? 0 : 1;
				const bScore = /\.en(?:[-_.]|$)/i.test(b) ? 0 : 1;
				return aScore - bScore || a.localeCompare(b);
			});
		if (!files.length) throw new Error("Video không có subtitle tiếng Anh; hãy dán transcript thủ công");
		const raw = fs.readFileSync(path.join(tempDir, files[0]), "utf8");
		const cues = parseTranscript(raw);
		if (!cues.length) throw new Error("Subtitle tải về không có nội dung đọc được");
		const titleLines = stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
		return {
			url: inputUrl,
			title: titleLines.length ? titleLines[titleLines.length - 1] : "YouTube",
			transcript: transcriptForAi(cues),
			cues,
		};
	} finally {
		try {
			fs.rmSync(tempDir, { recursive: true, force: true });
		} catch (error) {
			console.warn("Vocab Forge: không dọn được thư mục subtitle tạm", error);
		}
	}
}
