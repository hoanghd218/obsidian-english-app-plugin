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

// ---------------------------------------------------------------- OPENROUTER CATALOG

export interface OpenRouterModel {
	id: string;
	name: string;
	/** USD cho mỗi 1 triệu token input; -1 = không rõ giá (vd auto router) */
	promptPerM: number;
	/** USD cho mỗi 1 triệu token output; -1 = không rõ giá */
	completionPerM: number;
	free: boolean;
}

export interface OpenRouterModelGroup {
	label: string;
	models: OpenRouterModel[];
}

/** Các công ty lớn được tách nhóm riêng; còn lại gom vào "Công ty khác" */
const OPENROUTER_VENDORS: Array<[prefix: string, label: string]> = [
	["openai", "OpenAI"],
	["anthropic", "Anthropic (Claude)"],
	["google", "Google (Gemini)"],
	["x-ai", "xAI (Grok)"],
	["meta-llama", "Meta (Llama)"],
	["deepseek", "DeepSeek"],
	["minimax", "MiniMax"],
	["mistralai", "Mistral"],
	["qwen", "Qwen (Alibaba)"],
	["moonshotai", "Moonshot (Kimi)"],
	["z-ai", "Z.AI (GLM)"],
	["nvidia", "NVIDIA"],
];

let openRouterModelCache: { at: number; groups: OpenRouterModelGroup[] } | null = null;
const OPENROUTER_CACHE_TTL = 60 * 60 * 1000;

/**
 * Tải danh sách model trực tiếp từ OpenRouter (endpoint công khai, không cần key)
 * và phân nhóm: Router → Miễn phí → từng công ty lớn → còn lại.
 * Kết quả cache 1 giờ; `force` = tải lại ngay.
 */
export async function fetchOpenRouterModelGroups(force = false): Promise<OpenRouterModelGroup[]> {
	if (!force && openRouterModelCache && Date.now() - openRouterModelCache.at < OPENROUTER_CACHE_TTL) {
		return openRouterModelCache.groups;
	}
	const res = await requestWithTimeout(
		{ url: "https://openrouter.ai/api/v1/models", method: "GET" },
		30_000,
		"openrouter"
	);
	if (res.status >= 400) throw httpError("openrouter", res);
	const data = (res.json as { data?: Array<Record<string, unknown>> })?.data ?? [];
	const models: OpenRouterModel[] = [];
	for (const raw of data) {
		const id = typeof raw.id === "string" ? raw.id : "";
		if (!id) continue;
		const arch = raw.architecture as { output_modalities?: unknown } | undefined;
		const outs = Array.isArray(arch?.output_modalities) ? (arch.output_modalities as unknown[]) : ["text"];
		if (!outs.includes("text")) continue;
		const pricing = (raw.pricing ?? {}) as { prompt?: unknown; completion?: unknown };
		const promptPer = parseFloat(String(pricing.prompt ?? "-1"));
		const completionPer = parseFloat(String(pricing.completion ?? "-1"));
		const promptPerM = Number.isFinite(promptPer) && promptPer >= 0 ? promptPer * 1_000_000 : -1;
		const completionPerM = Number.isFinite(completionPer) && completionPer >= 0 ? completionPer * 1_000_000 : -1;
		models.push({
			id,
			name: typeof raw.name === "string" ? raw.name : id,
			promptPerM,
			completionPerM,
			free: promptPerM === 0 && completionPerM === 0,
		});
	}
	if (!models.length) throw new AiApiError("OpenRouter không trả về model nào — thử lại sau", "openrouter");

	const byId = (a: OpenRouterModel, b: OpenRouterModel) => a.id.localeCompare(b.id);
	const priceRank = (m: OpenRouterModel) => (m.promptPerM < 0 ? Number.MAX_SAFE_INTEGER : m.promptPerM);
	const byPrice = (a: OpenRouterModel, b: OpenRouterModel) => priceRank(a) - priceRank(b) || byId(a, b);

	const groups: OpenRouterModelGroup[] = [];
	const router = models.filter((m) => m.id.startsWith("openrouter/")).sort(byId);
	if (router.length) groups.push({ label: "⭐ OpenRouter Router", models: router });
	const others = models.filter((m) => !m.id.startsWith("openrouter/"));
	const free = others.filter((m) => m.free).sort(byId);
	if (free.length) groups.push({ label: `🆓 Miễn phí (${free.length})`, models: free });
	const paid = others.filter((m) => !m.free);
	const grouped = new Set<string>();
	for (const [prefix, label] of OPENROUTER_VENDORS) {
		const list = paid.filter((m) => m.id.startsWith(`${prefix}/`)).sort(byPrice);
		if (!list.length) continue;
		for (const m of list) grouped.add(m.id);
		groups.push({ label: `🏢 ${label} (${list.length})`, models: list });
	}
	const rest = paid.filter((m) => !grouped.has(m.id)).sort(byPrice);
	if (rest.length) groups.push({ label: `📦 Công ty khác (${rest.length})`, models: rest });

	openRouterModelCache = { at: Date.now(), groups };
	return groups;
}

function fmtUsdPerM(n: number): string {
	if (n < 0) return "?";
	if (n === 0) return "$0";
	return `$${parseFloat(n.toPrecision(3))}`;
}

export function openRouterOptionLabel(m: OpenRouterModel): string {
	if (m.free) return `${m.id} · free`;
	if (m.promptPerM < 0 && m.completionPerM < 0) return m.id;
	return `${m.id} · ${fmtUsdPerM(m.promptPerM)}/${fmtUsdPerM(m.completionPerM)}`;
}

/** Đổ danh sách model đã phân nhóm vào <select> — dùng chung cho cả hai màn settings */
export function renderOpenRouterOptions(
	sel: HTMLSelectElement,
	groups: OpenRouterModelGroup[],
	currentModel: string
): void {
	sel.empty();
	for (const g of groups) {
		const og = sel.createEl("optgroup", { attr: { label: g.label } });
		for (const m of g.models) {
			og.createEl("option", { text: openRouterOptionLabel(m), attr: { value: m.id } });
		}
	}
	if (currentModel && !groups.some((g) => g.models.some((m) => m.id === currentModel))) {
		sel.createEl("option", { text: currentModel, attr: { value: currentModel } });
	}
	sel.createEl("option", { text: "Khác (tự nhập)…", attr: { value: "__custom__" } });
	sel.value = currentModel;
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
