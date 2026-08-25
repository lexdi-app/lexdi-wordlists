/**
 * Rendering Utilities for Danger PR Comments
 *
 * Helper functions for formatting markdown, tables, and GitHub-specific elements.
 */

/**
 * Creates a GitHub link to a file at a specific ref
 */
export function githubPathLink(repoURL: string, ref: string, aPath: string, addition?: string) {
	return htmlLink(`${repoURL}/blob/${ref}/${aPath}`, singleBacktickWrap(aPath + (addition || "")));
}

/**
 * Takes a list, and joins it with an oxford comma
 * e.g., ["1", "2", "3"] to "1, 2, and 3"
 */
export function toSentence(array: string[]): string {
	if (!array || array.length === 0) {
		return "<error-to-sentence>";
	}
	if (array.length === 1) {
		return array[0];
	}
	return array.slice(0, array.length - 1).join(", ") + ", and " + array.pop();
}

/**
 * Creates an HTML anchor tag
 */
export function htmlLink(href: string, text: string): string {
	return `<a href='${href}'>${text}</a>`;
}

/**
 * Creates a GitHub line hash for linking to specific lines
 */
export function githubLineHash(lineStart: string | number, lineEnd?: string | number): string {
	const endTerminator = lineEnd != null ? `-L${lineEnd}` : "";
	return `#L${lineStart}${endTerminator}`;
}

/**
 * Wraps text in single backticks for inline code
 */
export function singleBacktickWrap<T extends string | number | null | undefined>(text: T): string {
	return `\`${text}\``;
}

/**
 * Wraps text in triple backticks for code blocks
 */
export function tripleBacktickWrap(text: string, lang = ""): string {
	return `\`\`\`${lang || ""}\n${text}\`\`\``;
}

/**
 * In fail-messages sometimes markdown code-blocks don't work as expected
 */
export function codeWrap(text: string | undefined): string {
	return `<code>${text}</code>`;
}

/**
 * Creates a markdown link
 */
export function markdownLink(
	displayedContent: string | number | undefined | null,
	url: string | number | undefined | null,
): string {
	return `[${displayedContent}](${url})`;
}

/**
 * GitHub Comments/PRs support the HTML5 Details+Summary tags
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details
 */
export function makeDisclosableBlock(title: string, body: string): string {
	return `
<details>
<summary>${title}</summary>

${body}
</details>

`;
}

/**
 * Assembles an HTML bulleted list
 */
export function assembleHtmlBulletedList(items: string[], listType: "ul" | "ol" = "ul"): string {
	return `<${listType}>\n${items.map((item) => `<li>${item}</li>`).join("\n")}\n</${listType}>`;
}

const hyphenPadding = "------------------------------------";

/**
 * Helper following GitHub spec for markdown tables
 * @see https://help.github.com/en/articles/organizing-information-with-tables
 */
export function assembleTable(headerNames: string[], rows: string[][]): string {
	const tmp: string[][] = [
		[...headerNames],
		headerNames.map((name) => `${hyphenPadding.slice(-1 * Math.max(3, name.length))}`),
		...rows.map((row) => {
			if (row.length !== headerNames.length) {
				console.warn(
					"Mismatched header-count",
					headerNames.length,
					"to cell-count",
					row.length,
					"in row",
					row,
				);
			}
			return [...row];
		}),
	];

	tmp.forEach((row) => {
		row.unshift("");
		row.push("");
	});

	return tmp.map((row) => row.join(" | ").trim()).join("\n") + "\n";
}

/**
 * Formats a percentage with optional decimal places
 */
export function truncatedPercentage(float: number, maxDecimals = 0): string {
	return `${(float * 100).toFixed(maxDecimals)}%`;
}
