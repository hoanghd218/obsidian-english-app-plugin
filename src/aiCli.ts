/**
 * Subscription/OAuth-backed AI CLI adapter for Obsidian desktop.
 *
 * Prompts are passed as individual argv values to child_process.execFile. No
 * shell is involved, so prompt text cannot be interpreted as shell syntax.
 * Known API-key environment variables are removed before launching a CLI; each
 * provider is expected to use its existing local login/subscription instead.
 */

export type AiCliProvider = "grok" | "claude" | "codex" | "gemini";

export type AiCliSessionMode = "none" | "new" | "resume" | "continue";

export interface AiCliSessionOptions {
	/** `continue` resumes the latest session for `cwd`; `resume` requires `id`. */
	mode: AiCliSessionMode;
	id?: string;
}

export interface AiCliRunOptions {
	provider: AiCliProvider;
	/** Absolute path is recommended when Obsidian was opened outside a terminal. */
	executablePath?: string;
	cwd?: string;
	model?: string;
	timeoutMs?: number;
	maxBufferBytes?: number;
	session?: AiCliSessionOptions;
}

export interface AiCliRunResult {
	provider: AiCliProvider;
	text: string;
	/** Present when the CLI exposed a resumable session identifier. */
	sessionId?: string;
	executablePath: string;
	durationMs: number;
	stderr: string;
	rawStdout: string;
}

export interface AiCliProviderStatus {
	provider: AiCliProvider;
	available: boolean;
	executablePath?: string;
	version?: string;
	error?: string;
}

export interface AiCliDetectionOptions {
	paths?: Partial<Record<AiCliProvider, string>>;
	timeoutMs?: number;
}

interface ExecFileError extends Error {
	code?: string | number | null;
	killed?: boolean;
	signal?: string | null;
}

interface ExecFileResult {
	stdout: string;
	stderr: string;
}

interface ChildProcessHandle {
	stdin?: { end(): void } | null;
}

interface ChildProcessModule {
	execFile(
		file: string,
		args: string[],
		options: {
			cwd?: string;
			env: Record<string, string | undefined>;
			encoding: "utf8";
			timeout: number;
			maxBuffer: number;
			windowsHide: boolean;
			shell: false;
		},
		callback: (error: ExecFileError | null, stdout: string, stderr: string) => void
	): ChildProcessHandle;
}

interface FsModule {
	existsSync(path: string): boolean;
}

interface OsModule {
	homedir(): string;
}

interface PathModule {
	delimiter: string;
	join(...parts: string[]): string;
}

interface ProcessModule {
	env: Record<string, string | undefined>;
	platform: string;
}

interface CryptoModule {
	randomUUID(): string;
}

type JsonRecord = Record<string, unknown>;

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_BUFFER_BYTES = 8 * 1024 * 1024;
const VERSION_TIMEOUT_MS = 5_000;

export const AI_CLI_PROVIDERS: readonly AiCliProvider[] = [
	"grok",
	"claude",
	"codex",
	"gemini",
] as const;

export const AI_CLI_LABELS: Readonly<Record<AiCliProvider, string>> = {
	grok: "Grok CLI",
	claude: "Claude Code",
	codex: "Codex CLI",
	gemini: "Gemini CLI",
};

const API_KEY_ENV_NAMES = new Set([
	"ANTHROPIC_API_KEY",
	"ANTHROPIC_AUTH_TOKEN",
	"CLAUDE_API_KEY",
	"CODEX_API_KEY",
	"GEMINI_API_KEY",
	"GOOGLE_API_KEY",
	"OPENAI_API_KEY",
	"XAI_API_KEY",
]);

export class AiCliError extends Error {
	readonly provider: AiCliProvider;
	readonly code?: string | number | null;
	readonly stderr: string;
	readonly timedOut: boolean;

	constructor(
		provider: AiCliProvider,
		message: string,
		options: {
			code?: string | number | null;
			stderr?: string;
			timedOut?: boolean;
		} = {}
	) {
		super(message);
		this.name = "AiCliError";
		this.provider = provider;
		this.code = options.code;
		this.stderr = options.stderr ?? "";
		this.timedOut = options.timedOut ?? false;
	}
}

function nodeRequire(moduleName: string): unknown {
	const requireFn = (window as unknown as { require?: (name: string) => unknown }).require;
	if (!requireFn) {
		throw new Error("AI CLI chỉ hoạt động trên Obsidian desktop");
	}
	return requireFn(moduleName);
}

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function stripAnsi(value: string): string {
	return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
}

function cleanOutput(value: string): string {
	return stripAnsi(value).replace(/\r\n/g, "\n").trim();
}

function boundedInt(value: number | undefined, fallback: number, min: number, max: number): number {
	if (value === undefined || !Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, Math.floor(value)));
}

function childEnvironment(): Record<string, string | undefined> {
	const processModule = nodeRequire("process") as ProcessModule;
	const os = nodeRequire("os") as OsModule;
	const path = nodeRequire("path") as PathModule;
	const env = { ...processModule.env };

	// Force the signed-in CLI path instead of accidental pay-per-token API auth.
	for (const key of Object.keys(env)) {
		if (API_KEY_ENV_NAMES.has(key.toUpperCase())) delete env[key];
	}

	const home = os.homedir();
	const extraPaths = [
		path.join(home, ".local", "bin"),
		path.join(home, ".grok", "bin"),
		path.join(home, ".npm-global", "bin"),
		"/opt/homebrew/bin",
		"/usr/local/bin",
	];
	const currentPath = env.PATH ?? "";
	env.PATH = [...extraPaths, currentPath].filter(Boolean).join(path.delimiter);
	return env;
}

function conciseFailure(stderr: string, fallback: string): string {
	const detail = cleanOutput(stderr).slice(0, 1_200);
	return detail || fallback;
}

function execFileSafe(
	provider: AiCliProvider,
	executablePath: string,
	args: string[],
	options: { cwd?: string; timeoutMs: number; maxBufferBytes: number }
): Promise<ExecFileResult> {
	const childProcess = nodeRequire("child_process") as ChildProcessModule;
	return new Promise((resolve, reject) => {
		const child = childProcess.execFile(
			executablePath,
			args,
			{
				cwd: options.cwd,
				env: childEnvironment(),
				encoding: "utf8",
				timeout: options.timeoutMs,
				maxBuffer: options.maxBufferBytes,
				windowsHide: true,
				shell: false,
			},
			(error, stdout, stderr) => {
				if (!error) {
					resolve({ stdout: String(stdout), stderr: String(stderr) });
					return;
				}
				const normalizedStderr = String(stderr ?? "");
				const timedOut = error.code === "ETIMEDOUT" || Boolean(error.killed);
				const fallback = timedOut
					? `${AI_CLI_LABELS[provider]} đã quá thời gian ${options.timeoutMs} ms`
					: error.message;
				reject(
					new AiCliError(provider, conciseFailure(normalizedStderr, fallback), {
						code: error.code,
						stderr: normalizedStderr,
						timedOut,
					})
				);
			}
		);
		// execFile creates a pipe for stdin. Close it explicitly so headless CLIs
		// do not wait for more piped context after receiving the prompt argv.
		child.stdin?.end();
	});
}

function providerCandidates(provider: AiCliProvider, customPath?: string): string[] {
	const os = nodeRequire("os") as OsModule;
	const path = nodeRequire("path") as PathModule;
	const processModule = nodeRequire("process") as ProcessModule;
	const home = os.homedir();
	if (customPath?.trim()) {
		const configured = customPath.trim();
		return [configured === "~" ? home : configured.startsWith("~/") || configured.startsWith("~\\")
			? path.join(home, configured.slice(2))
			: configured];
	}
	const executableName = processModule.platform === "win32" ? `${provider}.exe` : provider;
	const perProvider: Record<AiCliProvider, string[]> = {
		grok: [path.join(home, ".grok", "bin", executableName)],
		claude: [
			path.join(home, ".local", "bin", executableName),
			path.join(home, ".claude", "local", executableName),
		],
		codex: [path.join(home, ".local", "bin", executableName)],
		gemini: [path.join(home, ".local", "bin", executableName)],
	};
	const candidates = [
		...perProvider[provider],
		path.join(home, ".npm-global", "bin", executableName),
		path.join("/opt/homebrew/bin", executableName),
		path.join("/usr/local/bin", executableName),
		executableName,
	];
	return candidates.filter((candidate, index) => candidates.indexOf(candidate) === index);
}

async function versionAtPath(
	provider: AiCliProvider,
	executablePath: string,
	timeoutMs: number
): Promise<string> {
	const result = await execFileSafe(provider, executablePath, ["--version"], {
		timeoutMs,
		maxBufferBytes: 256 * 1024,
	});
	const output = cleanOutput(result.stdout || result.stderr);
	return output.split("\n")[0]?.trim() || "unknown";
}

/** Detect one provider and report its executable/version without invoking a model. */
export async function detectAiCliProvider(
	provider: AiCliProvider,
	executablePath?: string,
	timeoutMs = VERSION_TIMEOUT_MS
): Promise<AiCliProviderStatus> {
	const fs = nodeRequire("fs") as FsModule;
	const candidates = providerCandidates(provider, executablePath);
	let lastError = `${AI_CLI_LABELS[provider]} không được tìm thấy`;

	for (const candidate of candidates) {
		const looksLikePath = candidate.includes("/") || candidate.includes("\\");
		if (looksLikePath && !fs.existsSync(candidate)) {
			lastError = `Không tìm thấy ${candidate}`;
			continue;
		}
		try {
			const version = await versionAtPath(
				provider,
				candidate,
				boundedInt(timeoutMs, VERSION_TIMEOUT_MS, 500, 30_000)
			);
			return { provider, available: true, executablePath: candidate, version };
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
		}
	}

	return { provider, available: false, error: lastError };
}

/** Detect all supported providers in parallel. This never invokes a model. */
export async function detectAiCliProviders(
	options: AiCliDetectionOptions = {}
): Promise<AiCliProviderStatus[]> {
	return Promise.all(
		AI_CLI_PROVIDERS.map((provider) =>
			detectAiCliProvider(provider, options.paths?.[provider], options.timeoutMs)
		)
	);
}

/** Resolve a configured/default executable or throw a provider-specific error. */
export async function resolveAiCliExecutable(
	provider: AiCliProvider,
	executablePath?: string
): Promise<string> {
	const status = await detectAiCliProvider(provider, executablePath);
	if (!status.available || !status.executablePath) {
		throw new AiCliError(provider, status.error ?? `${AI_CLI_LABELS[provider]} chưa được cài đặt`);
	}
	return status.executablePath;
}

function randomUuid(): string {
	return (nodeRequire("crypto") as CryptoModule).randomUUID();
}

function requireSessionId(provider: AiCliProvider, session: AiCliSessionOptions): string {
	const id = session.id?.trim();
	if (!id) throw new AiCliError(provider, "Chế độ resume cần session id");
	return id;
}

function parseJsonLine(line: string): JsonRecord | null {
	try {
		const value: unknown = JSON.parse(line);
		return isRecord(value) ? value : null;
	} catch {
		return null;
	}
}

function parseClaudeOutput(stdout: string): { text: string; sessionId?: string } {
	const parsed = parseJsonLine(stdout.trim());
	if (!parsed) return { text: cleanOutput(stdout) };
	const text = asString(parsed.result) ?? asString(parsed.response) ?? "";
	return {
		text: cleanOutput(text),
		sessionId: asString(parsed.session_id) ?? asString(parsed.sessionId),
	};
}

function parseCodexOutput(stdout: string): { text: string; sessionId?: string } {
	let sessionId: string | undefined;
	let finalText = "";
	for (const line of stdout.split(/\r?\n/)) {
		const event = parseJsonLine(line);
		if (!event) continue;
		if (event.type === "thread.started") {
			sessionId = asString(event.thread_id) ?? sessionId;
		}
		if (event.type === "item.completed" && isRecord(event.item)) {
			const itemType = asString(event.item.type);
			if (itemType === "agent_message" || itemType === "assistant_message") {
				finalText = asString(event.item.text) ?? asString(event.item.content) ?? finalText;
			}
		}
		if (event.type === "result") {
			finalText = asString(event.result) ?? asString(event.response) ?? finalText;
		}
	}
	return { text: cleanOutput(finalText), sessionId };
}

function parseGeminiOutput(stdout: string): { text: string; sessionId?: string } {
	let sessionId: string | undefined;
	let completeMessage = "";
	const deltas: string[] = [];
	for (const line of stdout.split(/\r?\n/)) {
		const event = parseJsonLine(line);
		if (!event) continue;
		if (event.type === "init") {
			sessionId = asString(event.session_id) ?? asString(event.sessionId) ?? sessionId;
		}
		if (event.type === "message" && event.role === "assistant") {
			const content = asString(event.content) ?? "";
			if (event.delta === true) deltas.push(content);
			else completeMessage = content;
		}
		if (event.type === "result") {
			completeMessage = asString(event.response) ?? completeMessage;
		}
	}
	return {
		text: cleanOutput(deltas.length > 0 ? deltas.join("") : completeMessage),
		sessionId,
	};
}

function grokArgs(prompt: string, model: string | undefined, session: AiCliSessionOptions): string[] {
	const args = [
		"--no-auto-update",
		"--no-alt-screen",
		"--disable-web-search",
		"--no-subagents",
		"--permission-mode",
		"dontAsk",
		"--tools",
		"",
		"--output-format",
		"plain",
	];
	if (model?.trim()) args.push("--model", model.trim());
	if (session.mode === "new") args.push("--session-id", session.id?.trim() || randomUuid());
	else if (session.mode === "resume") args.push("--resume", requireSessionId("grok", session));
	else if (session.mode === "continue") args.push("--continue");
	args.push("-p", prompt);
	return args;
}

function claudeArgs(prompt: string, model: string | undefined, session: AiCliSessionOptions): string[] {
	const args = [
		"--print",
		"--output-format",
		"json",
		"--safe-mode",
		"--permission-mode",
		"dontAsk",
		"--tools",
		"",
	];
	if (session.mode === "none") args.push("--no-session-persistence");
	else if (session.mode === "new") args.push("--session-id", session.id?.trim() || randomUuid());
	else if (session.mode === "resume") args.push("--resume", requireSessionId("claude", session));
	else if (session.mode === "continue") args.push("--continue");
	if (model?.trim()) args.push("--model", model.trim());
	args.push(prompt);
	return args;
}

function codexArgs(prompt: string, model: string | undefined, session: AiCliSessionOptions): string[] {
	// Approval policy is a top-level Codex option in 0.147; exec options follow it.
	const args = [
		"--ask-for-approval",
		"never",
		"exec",
		"--json",
		"--color",
		"never",
		"--sandbox",
		"read-only",
		"--skip-git-repo-check",
		"--ignore-user-config",
		"--ignore-rules",
	];
	if (session.mode === "none") args.push("--ephemeral");
	if (model?.trim()) args.push("--model", model.trim());
	if (session.mode === "resume") {
		args.push("resume", requireSessionId("codex", session), prompt);
	} else if (session.mode === "continue") {
		args.push("resume", "--last", prompt);
	} else {
		args.push(prompt);
	}
	return args;
}

function geminiArgs(prompt: string, model: string | undefined, session: AiCliSessionOptions): string[] {
	const args = ["--output-format", "stream-json", "--approval-mode", "plan", "--sandbox"];
	if (model?.trim()) args.push("--model", model.trim());
	if (session.mode === "resume") args.push("--resume", requireSessionId("gemini", session));
	else if (session.mode === "continue") args.push("--resume", "latest");
	args.push("-p", prompt);
	return args;
}

/**
 * Invoke a signed-in CLI in non-interactive mode.
 *
 * The default session mode is `none`. Use `new`, keep the returned `sessionId`,
 * then use `resume` for deterministic multi-turn continuity. `continue` is
 * convenient but resumes the latest session scoped to `cwd`.
 */
export async function runAiCli(prompt: string, options: AiCliRunOptions): Promise<AiCliRunResult> {
	if (!prompt.trim()) throw new AiCliError(options.provider, "Prompt không được để trống");

	const executablePath = await resolveAiCliExecutable(options.provider, options.executablePath);
	const requestedSession = options.session ?? { mode: "none" };
	const needsCallerKnownId =
		requestedSession.mode === "new" &&
		(options.provider === "grok" || options.provider === "claude") &&
		!requestedSession.id?.trim();
	const session: AiCliSessionOptions = needsCallerKnownId
		? { ...requestedSession, id: randomUuid() }
		: requestedSession;
	const timeoutMs = boundedInt(options.timeoutMs, DEFAULT_TIMEOUT_MS, 1_000, 15 * 60_000);
	const maxBufferBytes = boundedInt(
		options.maxBufferBytes,
		DEFAULT_MAX_BUFFER_BYTES,
		64 * 1024,
		64 * 1024 * 1024
	);
	const argsByProvider: Record<AiCliProvider, () => string[]> = {
		grok: () => grokArgs(prompt, options.model, session),
		claude: () => claudeArgs(prompt, options.model, session),
		codex: () => codexArgs(prompt, options.model, session),
		gemini: () => geminiArgs(prompt, options.model, session),
	};
	const startedAt = Date.now();
	const executed = await execFileSafe(options.provider, executablePath, argsByProvider[options.provider](), {
		cwd: options.cwd,
		timeoutMs,
		maxBufferBytes,
	});

	let parsed: { text: string; sessionId?: string };
	if (options.provider === "claude") parsed = parseClaudeOutput(executed.stdout);
	else if (options.provider === "codex") parsed = parseCodexOutput(executed.stdout);
	else if (options.provider === "gemini") parsed = parseGeminiOutput(executed.stdout);
	else parsed = { text: cleanOutput(executed.stdout), sessionId: session.id?.trim() || undefined };

	if (!parsed.text) {
		throw new AiCliError(
			options.provider,
			conciseFailure(executed.stderr, `${AI_CLI_LABELS[options.provider]} không trả về nội dung`),
			{ stderr: executed.stderr }
		);
	}

	return {
		provider: options.provider,
		text: parsed.text,
		sessionId: session.mode === "none" ? undefined : parsed.sessionId ?? session.id?.trim(),
		executablePath,
		durationMs: Date.now() - startedAt,
		stderr: cleanOutput(executed.stderr),
		rawStdout: executed.stdout,
	};
}

/** Start a resumable conversation and return its provider-issued/generated id. */
export function startAiCliSession(
	prompt: string,
	options: Omit<AiCliRunOptions, "session">
): Promise<AiCliRunResult> {
	return runAiCli(prompt, { ...options, session: { mode: "new" } });
}

/** Resume a known conversation without relying on whichever session is latest. */
export function resumeAiCliSession(
	prompt: string,
	sessionId: string,
	options: Omit<AiCliRunOptions, "session">
): Promise<AiCliRunResult> {
	return runAiCli(prompt, { ...options, session: { mode: "resume", id: sessionId } });
}
