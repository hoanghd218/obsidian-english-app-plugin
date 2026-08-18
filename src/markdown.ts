/**
 * Lightweight, fast and safe Markdown renderer for Vocab Forge UI elements.
 * Renders bold, italic, inline code, highlights, links, lists, and paragraphs cleanly.
 */

export function renderMarkdown(el: HTMLElement, text: string): void {
	if (!text) return;
	el.empty();

	// Tách dòng
	const lines = text.split("\n");
	let currentList: HTMLElement | null = null;

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line) {
			currentList = null;
			continue;
		}

		// Header: ## Header
		const headerMatch = line.match(/^(#{1,4})\s+(.*)$/);
		if (headerMatch) {
			currentList = null;
			const level = headerMatch[1].length;
			const tag = level === 1 ? "h3" : level === 2 ? "h4" : "h5";
			const h = el.createEl(tag as keyof HTMLElementTagNameMap, { cls: "vf-md-header" });
			renderInlineMarkdown(h, headerMatch[2]);
			continue;
		}

		// Bullet list: - or * or •
		const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
		if (bulletMatch) {
			if (!currentList || currentList.tagName !== "UL") {
				currentList = el.createEl("ul", { cls: "vf-md-list" });
			}
			const li = currentList.createEl("li", { cls: "vf-md-list-item" });
			renderInlineMarkdown(li, bulletMatch[1]);
			continue;
		}

		// Numbered list: 1. or 2.
		const numMatch = line.match(/^(\d+)[.)]\s+(.*)$/);
		if (numMatch) {
			if (!currentList || currentList.tagName !== "OL") {
				currentList = el.createEl("ol", { cls: "vf-md-list vf-md-num-list" });
			}
			const li = currentList.createEl("li", { cls: "vf-md-list-item" });
			renderInlineMarkdown(li, numMatch[2]);
			continue;
		}

		// Normal paragraph
		currentList = null;
		const p = el.createDiv({ cls: "vf-md-p" });
		renderInlineMarkdown(p, line);
	}
}

export function renderInlineMarkdown(el: HTMLElement, text: string): void {
	if (!text) return;

	// Tokenize inline markdown: **bold**, *italic*, ==mark==, `code`, [label](url)
	const regex = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|==[^=]+==|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(text)) !== null) {
		if (match.index > lastIndex) {
			el.appendText(text.slice(lastIndex, match.index));
		}

		const token = match[0];
		if ((token.startsWith("**") && token.endsWith("**")) || (token.startsWith("__") && token.endsWith("__"))) {
			el.createEl("strong", { text: token.slice(2, -2), cls: "vf-md-bold" });
		} else if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) {
			el.createEl("em", { text: token.slice(1, -1), cls: "vf-md-italic" });
		} else if (token.startsWith("==") && token.endsWith("==")) {
			el.createEl("mark", { text: token.slice(2, -2), cls: "vf-md-mark" });
		} else if (token.startsWith("`") && token.endsWith("`")) {
			el.createEl("code", { text: token.slice(1, -1), cls: "vf-md-code" });
		} else if (token.startsWith("[")) {
			const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
			if (linkMatch) {
				const a = el.createEl("a", { text: linkMatch[1], cls: "vf-md-link", attr: { href: linkMatch[2] } });
				a.onclick = (e) => {
					e.preventDefault();
					window.open(linkMatch[2]);
				};
			} else {
				el.appendText(token);
			}
		}
		lastIndex = regex.lastIndex;
	}

	if (lastIndex < text.length) {
		el.appendText(text.slice(lastIndex));
	}
}
