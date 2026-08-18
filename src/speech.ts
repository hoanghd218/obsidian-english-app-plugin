/** Browser-only speech helpers. Every capability is feature-detected for Obsidian desktop/mobile. */

export interface AudioRecordingOptions {
	mimeType?: string;
	audioBitsPerSecond?: number;
	constraints?: MediaTrackConstraints;
}

export interface AudioRecordingResult {
	blob: Blob;
	mimeType: string;
	durationMs: number;
	/** Creates a disposable URL. Call URL.revokeObjectURL when the player no longer needs it. */
	createObjectUrl(): string;
}

export function isAudioRecordingSupported(): boolean {
	return typeof globalThis.MediaRecorder !== "undefined" && Boolean(globalThis.navigator?.mediaDevices?.getUserMedia);
}

export function preferredAudioMimeType(): string | undefined {
	if (typeof globalThis.MediaRecorder === "undefined") return undefined;
	const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
	return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export class AudioRecorder {
	private recorder: MediaRecorder | null = null;
	private stream: MediaStream | null = null;
	private chunks: BlobPart[] = [];
	private dataHandler: ((event: BlobEvent) => void) | null = null;
	private startedAt = 0;
	private stopPromise: Promise<AudioRecordingResult> | null = null;
	private generation = 0;

	get state(): RecordingState | "unsupported" {
		if (!isAudioRecordingSupported()) return "unsupported";
		return this.recorder?.state ?? "inactive";
	}

	async start(options: AudioRecordingOptions = {}): Promise<void> {
		if (!isAudioRecordingSupported()) throw new Error("Audio recording is not supported on this device");
		if (this.stopPromise) throw new Error("The previous recording is still being finalized");
		if (this.recorder && this.recorder.state !== "inactive") throw new Error("A recording is already in progress");
		this.releaseStream();
		this.chunks = [];
		this.stopPromise = null;
		const generation = ++this.generation;
		const stream = await navigator.mediaDevices.getUserMedia({
			audio: options.constraints ?? {
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true,
			},
		});
		if (generation !== this.generation) {
			for (const track of stream.getTracks()) track.stop();
			throw new Error("Audio recording start was cancelled");
		}
		this.stream = stream;
		const mimeType = options.mimeType && MediaRecorder.isTypeSupported(options.mimeType)
			? options.mimeType
			: preferredAudioMimeType();
		try {
			this.recorder = new MediaRecorder(this.stream, {
				...(mimeType ? { mimeType } : {}),
				...(options.audioBitsPerSecond ? { audioBitsPerSecond: options.audioBitsPerSecond } : {}),
			});
		} catch (error) {
			this.releaseStream();
			throw error;
		}
		this.dataHandler = (event: BlobEvent) => {
			if (event.data.size > 0) this.chunks.push(event.data);
		};
		this.recorder.addEventListener("dataavailable", this.dataHandler);
		this.startedAt = performance.now();
		this.recorder.start(250);
	}

	pause(): void {
		if (this.recorder?.state === "recording") this.recorder.pause();
	}

	resume(): void {
		if (this.recorder?.state === "paused") this.recorder.resume();
	}

	stop(): Promise<AudioRecordingResult> {
		if (!this.recorder || this.recorder.state === "inactive") return Promise.reject(new Error("No recording is in progress"));
		if (this.stopPromise) return this.stopPromise;
		const recorder = this.recorder;
		const dataHandler = this.dataHandler;
		this.stopPromise = new Promise<AudioRecordingResult>((resolve, reject) => {
			const cleanup = (): void => {
				recorder.removeEventListener("stop", onStop);
				recorder.removeEventListener("error", onError);
				if (dataHandler) recorder.removeEventListener("dataavailable", dataHandler);
				if (this.dataHandler === dataHandler) this.dataHandler = null;
				this.stopPromise = null;
				this.releaseStream();
			};
			const onStop = (): void => {
				const durationMs = Math.max(0, performance.now() - this.startedAt);
				const mimeType = recorder.mimeType || "audio/webm";
				const blob = new Blob(this.chunks, { type: mimeType });
				cleanup();
				resolve({ blob, mimeType, durationMs, createObjectUrl: () => URL.createObjectURL(blob) });
			};
			const onError = (): void => {
				cleanup();
				reject(new Error("Audio recording failed"));
			};
			recorder.addEventListener("stop", onStop, { once: true });
			recorder.addEventListener("error", onError, { once: true });
			recorder.stop();
		});
		return this.stopPromise;
	}

	/** Discards the current recording and immediately releases the microphone. */
	cancel(): void {
		this.generation++;
		if (this.recorder && this.recorder.state !== "inactive") {
			if (this.dataHandler) this.recorder.removeEventListener("dataavailable", this.dataHandler);
			this.dataHandler = null;
			this.recorder.stop();
		}
		this.chunks = [];
		this.stopPromise = null;
		this.releaseStream();
	}

	private releaseStream(): void {
		for (const track of this.stream?.getTracks() ?? []) track.stop();
		this.stream = null;
	}
}

interface BrowserRecognitionAlternative {
	transcript: string;
	confidence: number;
}

interface BrowserRecognitionResult {
	isFinal: boolean;
	length: number;
	[index: number]: BrowserRecognitionAlternative;
}

interface BrowserRecognitionResultList {
	length: number;
	[index: number]: BrowserRecognitionResult;
}

interface BrowserRecognitionEvent extends Event {
	resultIndex: number;
	results: BrowserRecognitionResultList;
}

interface BrowserRecognitionErrorEvent extends Event {
	error: string;
	message?: string;
}

interface BrowserRecognition {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	maxAlternatives: number;
	start(): void;
	stop(): void;
	abort(): void;
	onresult: ((event: BrowserRecognitionEvent) => void) | null;
	onerror: ((event: BrowserRecognitionErrorEvent) => void) | null;
	onend: (() => void) | null;
	onstart: (() => void) | null;
}

type BrowserRecognitionConstructor = new () => BrowserRecognition;

function recognitionConstructor(): BrowserRecognitionConstructor | undefined {
	const scope = globalThis as typeof globalThis & {
		SpeechRecognition?: BrowserRecognitionConstructor;
		webkitSpeechRecognition?: BrowserRecognitionConstructor;
	};
	return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}

export function isSpeechRecognitionSupported(): boolean {
	return Boolean(recognitionConstructor());
}

export interface SpeechRecognitionUpdate {
	finalTranscript: string;
	interimTranscript: string;
	confidence: number;
}

export interface SpeechRecognitionOptions {
	language?: string;
	continuous?: boolean;
	interimResults?: boolean;
	maxAlternatives?: number;
	onStart?: () => void;
	onUpdate?: (update: SpeechRecognitionUpdate) => void;
	onEnd?: (finalTranscript: string) => void;
	onError?: (error: Error) => void;
}

/** Thin event wrapper around SpeechRecognition/webkitSpeechRecognition. */
export class SpeechRecognitionController {
	private recognition: BrowserRecognition | null = null;
	private finalParts: string[] = [];
	private active = false;
	private endPromise: Promise<string> = Promise.resolve("");
	private resolveEnd: ((text: string) => void) | null = null;

	get isActive(): boolean {
		return this.active;
	}

	start(options: SpeechRecognitionOptions = {}): void {
		const Constructor = recognitionConstructor();
		if (!Constructor) throw new Error("Speech recognition is not supported on this device");
		if (this.active) throw new Error("Speech recognition is already active");
		const recognition = new Constructor();
		this.recognition = recognition;
		this.finalParts = [];
		this.endPromise = new Promise<string>((resolve) => { this.resolveEnd = resolve; });
		recognition.lang = options.language ?? "en-US";
		recognition.continuous = options.continuous ?? true;
		recognition.interimResults = options.interimResults ?? true;
		recognition.maxAlternatives = Math.max(1, options.maxAlternatives ?? 1);
		recognition.onstart = () => {
			if (this.recognition !== recognition) return;
			this.active = true;
			options.onStart?.();
		};
		recognition.onresult = (event) => {
			if (this.recognition !== recognition) return;
			let interimTranscript = "";
			let confidenceSum = 0;
			let confidenceCount = 0;
			for (let i = event.resultIndex; i < event.results.length; i++) {
				const result = event.results[i];
				const alternative = result[0];
				if (!alternative) continue;
				if (result.isFinal) this.finalParts.push(alternative.transcript.trim());
				else interimTranscript += `${alternative.transcript} `;
				if (alternative.confidence > 0) {
					confidenceSum += alternative.confidence;
					confidenceCount++;
				}
			}
			options.onUpdate?.({
				finalTranscript: this.finalParts.join(" ").trim(),
				interimTranscript: interimTranscript.trim(),
				confidence: confidenceCount ? confidenceSum / confidenceCount : 0,
			});
		};
		recognition.onerror = (event) => {
			if (this.recognition !== recognition) return;
			this.active = false;
			options.onError?.(new Error(event.message || `Speech recognition error: ${event.error}`));
		};
		recognition.onend = () => {
			if (this.recognition !== recognition) return;
			this.active = false;
			this.recognition = null;
			const finalText = this.finalParts.join(" ").trim();
			this.resolveEnd?.(finalText);
			this.resolveEnd = null;
			options.onEnd?.(finalText);
		};
		this.active = true;
		try {
			recognition.start();
		} catch (error) {
			this.active = false;
			this.recognition = null;
			throw error;
		}
	}

	stop(): void {
		this.recognition?.stop();
	}

	async stopAndWait(timeoutMs = 1_500): Promise<string> {
		if (!this.recognition) return this.finalParts.join(" ").trim();
		const pending = this.endPromise;
		this.recognition.stop();
		return Promise.race([
			pending,
			new Promise<string>((resolve) => globalThis.setTimeout(
				() => resolve(this.finalParts.join(" ").trim()),
				Math.max(100, timeoutMs)
			)),
		]);
	}

	abort(): void {
		const recognition = this.recognition;
		this.recognition = null;
		this.active = false;
		const finalText = this.finalParts.join(" ").trim();
		this.resolveEnd?.(finalText);
		this.resolveEnd = null;
		if (recognition) {
			recognition.onstart = null;
			recognition.onresult = null;
			recognition.onerror = null;
			recognition.onend = null;
			recognition.abort();
		}
	}
}

export type TranscriptDiffKind = "equal" | "substitution" | "deletion" | "insertion";

export interface TranscriptDiffWord {
	kind: TranscriptDiffKind;
	reference?: string;
	spoken?: string;
	referenceIndex?: number;
	spokenIndex?: number;
}

export interface TranscriptDiff {
	words: TranscriptDiffWord[];
	referenceWords: string[];
	spokenWords: string[];
	matches: number;
	substitutions: number;
	deletions: number;
	insertions: number;
	wordErrorRate: number;
	accuracy: number;
	completeness: number;
}

/** Levenshtein alignment over words, suitable for highlighting omissions and substitutions. */
export function diffTranscripts(reference: string, spoken: string): TranscriptDiff {
	const referenceWords = normalizeTranscript(reference);
	const spokenWords = normalizeTranscript(spoken);
	const rows = referenceWords.length + 1;
	const cols = spokenWords.length + 1;
	const cost = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
	for (let i = 0; i < rows; i++) cost[i][0] = i;
	for (let j = 0; j < cols; j++) cost[0][j] = j;
	for (let i = 1; i < rows; i++) {
		for (let j = 1; j < cols; j++) {
			const substitution = cost[i - 1][j - 1] + (referenceWords[i - 1] === spokenWords[j - 1] ? 0 : 1);
			cost[i][j] = Math.min(substitution, cost[i - 1][j] + 1, cost[i][j - 1] + 1);
		}
	}

	const reversed: TranscriptDiffWord[] = [];
	let i = referenceWords.length;
	let j = spokenWords.length;
	while (i > 0 || j > 0) {
		if (i > 0 && j > 0) {
			const same = referenceWords[i - 1] === spokenWords[j - 1];
			const diagonalCost = cost[i - 1][j - 1] + (same ? 0 : 1);
			if (cost[i][j] === diagonalCost) {
				reversed.push({
					kind: same ? "equal" : "substitution",
					reference: referenceWords[i - 1],
					spoken: spokenWords[j - 1],
					referenceIndex: i - 1,
					spokenIndex: j - 1,
				});
				i--;
				j--;
				continue;
			}
		}
		if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
			reversed.push({ kind: "deletion", reference: referenceWords[i - 1], referenceIndex: i - 1 });
			i--;
		} else {
			reversed.push({ kind: "insertion", spoken: spokenWords[j - 1], spokenIndex: j - 1 });
			j--;
		}
	}
	const words = reversed.reverse();
	const matches = words.filter((word) => word.kind === "equal").length;
	const substitutions = words.filter((word) => word.kind === "substitution").length;
	const deletions = words.filter((word) => word.kind === "deletion").length;
	const insertions = words.filter((word) => word.kind === "insertion").length;
	const errors = substitutions + deletions + insertions;
	const wordErrorRate = referenceWords.length ? errors / referenceWords.length : spokenWords.length ? 1 : 0;
	return {
		words,
		referenceWords,
		spokenWords,
		matches,
		substitutions,
		deletions,
		insertions,
		wordErrorRate,
		accuracy: clamp(1 - wordErrorRate, 0, 1),
		completeness: referenceWords.length ? matches / referenceWords.length : spokenWords.length ? 0 : 1,
	};
}

export interface ShadowingScoreInput {
	reference: string;
	spoken: string;
	referenceDurationMs?: number;
	recordingDurationMs?: number;
	recognitionConfidence?: number;
}

export interface ShadowingScore {
	overall: number;
	accuracy: number;
	completeness: number;
	fluency: number;
	wordErrorRate: number;
	diff: TranscriptDiff;
	feedback: string[];
}

/**
 * Returns a transparent 0..100 shadowing score. It measures transcript accuracy,
 * completeness and pacing; it intentionally does not claim phoneme-level pronunciation accuracy.
 */
export function scoreShadowing(input: ShadowingScoreInput): ShadowingScore {
	const diff = diffTranscripts(input.reference, input.spoken);
	const accuracy = Math.round(diff.accuracy * 100);
	const completeness = Math.round(diff.completeness * 100);
	let pacing = 0.72;
	if ((input.referenceDurationMs ?? 0) > 0 && (input.recordingDurationMs ?? 0) > 0) {
		const ratio = input.recordingDurationMs! / input.referenceDurationMs!;
		pacing = Math.exp(-1.35 * Math.abs(Math.log(Math.max(0.05, ratio))));
	}
	const confidence = clamp(input.recognitionConfidence ?? 0.75, 0, 1);
	const fluency = Math.round((pacing * 0.75 + confidence * 0.25) * 100);
	const overall = Math.round(accuracy * 0.65 + completeness * 0.2 + fluency * 0.15);
	const feedback: string[] = [];
	if (diff.deletions > 0) feedback.push(`Bạn bỏ sót ${diff.deletions} từ; hãy nghe lại theo từng cụm ngắn.`);
	if (diff.substitutions > 0) feedback.push(`${diff.substitutions} từ chưa khớp với câu gốc.`);
	if (diff.insertions > 0) feedback.push(`Bạn nói thêm ${diff.insertions} từ ngoài câu gốc.`);
	if (fluency < 70) feedback.push("Nhịp nói còn lệch khá nhiều; thử nghe ở 0.75× rồi tăng dần.");
	if (!feedback.length) feedback.push("Câu nói khớp tốt; hãy lặp lại ở tốc độ tự nhiên để củng cố nhịp điệu.");
	return { overall, accuracy, completeness, fluency, wordErrorRate: diff.wordErrorRate, diff, feedback };
}

export function normalizeTranscript(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[’`]/g, "'")
		.match(/[a-z0-9]+(?:'[a-z]+)*/g) ?? [];
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
