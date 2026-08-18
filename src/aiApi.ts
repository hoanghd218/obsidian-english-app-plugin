import { requestUrl, type RequestUrlParam, type RequestUrlResponse } from "obsidian";

/**
 * Backend API trực tiếp (không cần CLI) — hoạt động trên cả desktop lẫn iPhone/iPad
 * nhờ requestUrl của Obsidian (bỏ qua CORS, không cần Node).
 */

export type AiApiProvider =
	| "deepseek"
	| "minimax"
	| "openai"
	| "claude"
	| "gemini"
	| "openrouter";

export interface AiChatMessage {
	role: "user" | "assistant";
	content: string;
}

export interface AiApiProviderInfo {
	label: string;
	/** Trang tạo API key */
	keyUrl: string;
	defaultModel: string;
	/** Model gợi ý — user vẫn có thể tự nhập model khác */
	models: string[];
}

export const AI_API_PROVIDER_IDS: AiApiProvider[] = [
	"deepseek",
	"minimax",
	"openai",
	"claude",
	"gemini",
	"openrouter",
];

export const AI_API_PROVIDERS: Record<AiApiProvider, AiApiProviderInfo> = {
	deepseek: {
		label: "DeepSeek",
		keyUrl: "https://platform.deepseek.com/api_keys",
		defaultModel: "deepseek-chat",
		models: ["deepseek-chat", "deepseek-reasoner"],
	},
	minimax: {
		label: "MiniMax",
		keyUrl: "https://platform.minimax.io",
		defaultModel: "MiniMax-M2",
		models: ["MiniMax-M2", "MiniMax-Text-01"],
	},
	openai: {
		label: "OpenAI",
		keyUrl: "https://platform.openai.com/api-keys",
		defaultModel: "gpt-5-mini",
		models: ["gpt-5-mini", "gpt-5.1", "gpt-5", "gpt-4o-mini"],
	},
	claude: {
		label: "Claude (Anthropic)",
		keyUrl: "https://console.anthropic.com/settings/keys",
		defaultModel: "claude-opus-5",
		models: ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"],
	},
	gemini: {
		label: "Gemini (Google)",
		keyUrl: "https://aistudio.google.com/apikey",
		defaultModel: "gemini-2.5-flash",
		models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-3-pro-preview"],
	},
	openrouter: {
		label: "OpenRouter",
		keyUrl: "https://openrouter.ai/settings/keys",
		defaultModel: "openrouter/auto",
		models: [
			"openrouter/auto",
			"anthropic/claude-sonnet-4.5",
			"openai/gpt-5-mini",
			"google/gemini-2.5-flash",
			"deepseek/deepseek-chat",
			"minimax/minimax-m2",
		],
	},
};

export interface AiApiRunOptions {
	provider: AiApiProvider;
	apiKey: string;
	/** Rỗng = model mặc định của nhà cung cấp */
	model?: string;
	timeoutMs?: number;
}

export class AiApiError extends Error {
	constructor(
		message: string,
		public readonly provider: AiApiProvider,
		public readonly status?: number
	) {
		super(message);
		this.name = "AiApiError";
	}
}

/** DeepSeek, MiniMax và OpenRouter đều dùng chuẩn OpenAI chat completions */
const OPENAI_COMPAT_URLS: Partial<Record<AiApiProvider, string>> = {
	openai: "https://api.openai.com/v1/chat/completions",
	deepseek: "https://api.deepseek.com/chat/completions",
	minimax: "https://api.minimax.io/v1/chat/completions",
	openrouter: "https://openrouter.ai/api/v1/chat/completions",
};

async function requestWithTimeout(
	param: RequestUrlParam,
	timeoutMs: number,
	provider: AiApiProvider
): Promise<RequestUrlResponse> {
	let timer: number | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = window.setTimeout(
			() =>
				reject(
					new AiApiError(
						`${AI_API_PROVIDERS[provider].label}: quá thời gian chờ ${Math.round(timeoutMs / 1000)}s — kiểm tra mạng hoặc thử model nhanh hơn`,
						provider
					)
				),
			timeoutMs
		);
	});
	try {
		return await Promise.race([requestUrl({ ...param, throw: false }), timeout]);
	} finally {
		window.clearTimeout(timer);
	}
}

function errorDetail(res: RequestUrlResponse): string {
	try {
		const j = JSON.parse(res.text) as Record<string, unknown>;
		const err = j.error as Record<string, unknown> | string | undefined;
		const baseResp = j.base_resp as Record<string, unknown> | undefined;
		const msg =
			(typeof err === "object" && err ? err.message : typeof err === "string" ? err : undefined) ??
			j.message ??
			baseResp?.status_msg;
		if (typeof msg === "string" && msg) return msg;
	} catch {
		// body không phải JSON — dùng text thô
	}
	return (res.text ?? "").slice(0, 200);
}

function httpError(provider: AiApiProvider, res: RequestUrlResponse): AiApiError {
	const label = AI_API_PROVIDERS[provider].label;
	const detail = errorDetail(res);
	const base =
		res.status === 401 || res.status === 403
			? `API key ${label} không hợp lệ hoặc thiếu quyền`
			: res.status === 429
				? `${label} hết hạn mức hoặc quá tải (429) — thử lại sau`
				: res.status === 404
					? `${label}: không tìm thấy model (kiểm tra lại tên model)`
					: `${label} trả lỗi HTTP ${res.status}`;
	return new AiApiError(detail ? `${base} — ${detail}` : base, provider, res.status);
}

/** Loại bỏ khối suy nghĩ mà một số model reasoning (MiniMax M2…) chèn vào nội dung */
function stripThinking(text: string): string {
	return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

async function callOpenAiCompat(
	provider: AiApiProvider,
	model: string,
	apiKey: string,
	messages: AiChatMessage[],
	timeoutMs: number
): Promise<string> {
	const url = OPENAI_COMPAT_URLS[provider];
	if (!url) throw new AiApiError(`Provider ${provider} chưa được hỗ trợ`, provider);
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		Authorization: `Bearer ${apiKey}`,
	};
	if (provider === "openrouter") headers["X-Title"] = "Vocab Forge (Obsidian)";
	const res = await requestWithTimeout(
		{
			url,
			method: "POST",
			headers,
			// Giữ body tối giản để tương thích mọi provider (các model GPT-5 từ chối
			// max_tokens/temperature tuỳ biến)
			body: JSON.stringify({ model, messages }),
		},
		timeoutMs,
		provider
	);
	if (res.status >= 400) throw httpError(provider, res);
	const json = res.json as {
		choices?: Array<{ message?: { content?: unknown } }>;
		base_resp?: { status_code?: number; status_msg?: string };
	};
	// MiniMax có thể trả HTTP 200 kèm lỗi trong base_resp
	if (json?.base_resp?.status_code && json.base_resp.status_code !== 0) {
		throw new AiApiError(
			`${AI_API_PROVIDERS[provider].label}: ${json.base_resp.status_msg ?? `lỗi ${json.base_resp.status_code}`}`,
			provider,
			res.status
		);
	}
	const content = json?.choices?.[0]?.message?.content;
	return stripThinking(typeof content === "string" ? content : "");
}

async function callClaude(
	model: string,
	apiKey: string,
	messages: AiChatMessage[],
	timeoutMs: number
): Promise<string> {
	const res = await requestWithTimeout(
		{
			url: "https://api.anthropic.com/v1/messages",
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": apiKey,
				"anthropic-version": "2023-06-01",
				"anthropic-dangerous-direct-browser-access": "true",
			},
			body: JSON.stringify({ model, max_tokens: 8192, messages }),
		},
		timeoutMs,
		"claude"
	);
	if (res.status >= 400) throw httpError("claude", res);
	const json = res.json as {
		stop_reason?: string;
		content?: Array<{ type?: string; text?: unknown }>;
	};
	if (json?.stop_reason === "refusal") {
		throw new AiApiError("Claude từ chối yêu cầu này (safety) — thử diễn đạt lại hoặc đổi model", "claude", res.status);
	}
	return (json?.content ?? [])
		.filter((b) => b?.type === "text" && typeof b.text === "string")
		.map((b) => b.text as string)
		.join("\n")
		.trim();
}

async function callGemini(
	model: string,
	apiKey: string,
	messages: AiChatMessage[],
	timeoutMs: number
): Promise<string> {
	const res = await requestWithTimeout(
		{
			url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-goog-api-key": apiKey,
			},
			body: JSON.stringify({
				contents: messages.map((m) => ({
					role: m.role === "assistant" ? "model" : "user",
					parts: [{ text: m.content }],
				})),
			}),
		},
		timeoutMs,
		"gemini"
	);
	if (res.status >= 400) throw httpError("gemini", res);
	const json = res.json as {
		candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
		promptFeedback?: { blockReason?: string };
	};
	const text = (json?.candidates?.[0]?.content?.parts ?? [])
		.map((p) => (typeof p?.text === "string" ? p.text : ""))
		.join("")
		.trim();
	if (!text && json?.promptFeedback?.blockReason) {
		throw new AiApiError(`Gemini chặn yêu cầu: ${json.promptFeedback.blockReason}`, "gemini", res.status);
	}
	return text;
}

/**
 * Gọi model qua API key. `messages` là toàn bộ hội thoại (API không lưu phiên);
 * với yêu cầu một lượt chỉ cần một message role "user".
 */
export async function runAiApi(messages: AiChatMessage[], options: AiApiRunOptions): Promise<string> {
	const provider = options.provider;
	const info = AI_API_PROVIDERS[provider];
	const apiKey = options.apiKey.trim();
	if (!apiKey) throw new AiApiError(`Chưa nhập API key cho ${info.label}`, provider);
	const model = (options.model ?? "").trim() || info.defaultModel;
	const timeoutMs = options.timeoutMs ?? 120_000;

	const text =
		provider === "claude"
			? await callClaude(model, apiKey, messages, timeoutMs)
			: provider === "gemini"
				? await callGemini(model, apiKey, messages, timeoutMs)
				: await callOpenAiCompat(provider, model, apiKey, messages, timeoutMs);

	if (!text) throw new AiApiError(`${info.label} không trả về nội dung — thử lại hoặc đổi model`, provider);
	return text;
}
