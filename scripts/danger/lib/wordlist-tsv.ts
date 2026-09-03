/**
 * Wordlist TSV Model
 *
 * Parsing and normalization for the `.lexdi.tsv` authoring format (FORMAT.md §2),
 * shared by the Danger lint rules and the auto-fixer so both agree on what
 * "sorted" and "duplicate" mean.
 */

/** Row kinds that carry a real word, as opposed to a list reference. */
const WORD_ACTIONS = new Set(["add", "exclude"]);

export const KNOWN_ACTIONS = new Set(["add", "exclude", "include"]);

export interface ParsedLine {
	/** 1-based line number in the source file. */
	readonly lineNumber: number;
	readonly raw: string;
}

export interface CommentLine extends ParsedLine {
	readonly kind: "comment" | "blank";
}

export interface HeaderLine extends ParsedLine {
	readonly kind: "header";
	readonly columns: string[];
}

export interface RowLine extends ParsedLine {
	readonly kind: "row";
	readonly fields: string[];
	readonly word: string;
	readonly action: string;
}

export type Line = CommentLine | HeaderLine | RowLine;

export interface ParsedList {
	readonly path: string;
	readonly lines: Line[];
	readonly header?: HeaderLine;
	/** Rows carrying a word — `add` and `exclude`. Sort and dedupe apply to these. */
	readonly wordRows: RowLine[];
	/**
	 * Rows carrying a list reference. Their relative order sets include precedence
	 * (FORMAT.md §4.3), so they are never reordered.
	 */
	readonly includeRows: RowLine[];
	readonly errors: ParseProblem[];
}

export interface ParseProblem {
	readonly lineNumber: number;
	readonly message: string;
}

/** Sort key for word rows: case-insensitive by `word` (FORMAT.md §2). */
export function sortKey(word: string): string {
	return word.toLocaleLowerCase();
}

export function compareWords(a: string, b: string): number {
	const left = sortKey(a);
	const right = sortKey(b);
	if (left < right) return -1;
	if (left > right) return 1;
	// Case-insensitive ties keep a deterministic order so the fixer converges.
	return a < b ? -1 : a > b ? 1 : 0;
}

export function isWordAction(action: string): boolean {
	return WORD_ACTIONS.has(action);
}

/**
 * Parses a `.lexdi.tsv` source. Column identity comes from the header row rather than
 * a fixed position; a list may omit any optional column.
 */
export function parseList(path: string, contents: string): ParsedList {
	const lines: Line[] = [];
	const wordRows: RowLine[] = [];
	const includeRows: RowLine[] = [];
	const errors: ParseProblem[] = [];

	let header: HeaderLine | undefined;
	let headerRejected = false;
	let wordIndex = 0;
	let actionIndex: number | undefined;

	const rawLines = stripTrailingEmptyLine(contents.split("\n"));

	rawLines.forEach((raw, offset) => {
		const lineNumber = offset + 1;
		if (headerRejected) return;

		if (raw.trim().length === 0) {
			lines.push({ kind: "blank", lineNumber, raw });
			return;
		}
		if (raw.startsWith("#")) {
			lines.push({ kind: "comment", lineNumber, raw });
			return;
		}

		const fields = raw.split("\t");

		if (!header) {
			const index = fields.indexOf("word");
			if (index < 0) {
				// Without a usable header no row can be interpreted, so the file is rejected once
				// rather than once per row.
				headerRejected = true;
				errors.push({ lineNumber, message: "header has no `word` column" });
				return;
			}
			wordIndex = index;
			const actionAt = fields.indexOf("action");
			actionIndex = actionAt < 0 ? undefined : actionAt;
			header = { kind: "header", lineNumber, raw, columns: fields };
			lines.push(header);
			return;
		}

		if (fields.length !== header.columns.length) {
			errors.push({
				lineNumber,
				message: `expected ${header.columns.length} fields, found ${fields.length}`,
			});
			return;
		}

		// A list with no `action` column declares every row an addition.
		const action = actionIndex === undefined ? "add" : fields[actionIndex];
		if (!KNOWN_ACTIONS.has(action)) {
			errors.push({ lineNumber, message: `unrecognized action \`${action}\`` });
			return;
		}

		const row: RowLine = {
			kind: "row",
			lineNumber,
			raw,
			fields,
			word: fields[wordIndex],
			action,
		};
		lines.push(row);
		(isWordAction(action) ? wordRows : includeRows).push(row);
	});

	if (!header && !headerRejected) {
		errors.push({ lineNumber: 1, message: "input has no header row" });
	}

	return { path, lines, header, wordRows, includeRows, errors };
}

/** Drops the single empty element produced by a well-formed trailing newline. */
function stripTrailingEmptyLine(rawLines: string[]): string[] {
	if (rawLines.length > 0 && rawLines[rawLines.length - 1] === "") {
		return rawLines.slice(0, -1);
	}
	return rawLines;
}

export interface OutOfOrderRow {
	readonly row: RowLine;
	readonly previous: RowLine;
}

/** Word rows whose `word` sorts before the preceding word row's. */
export function findOutOfOrderRows(list: ParsedList): OutOfOrderRow[] {
	const problems: OutOfOrderRow[] = [];
	for (let i = 1; i < list.wordRows.length; i += 1) {
		const previous = list.wordRows[i - 1];
		const row = list.wordRows[i];
		if (compareWords(previous.word, row.word) > 0) {
			problems.push({ row, previous });
		}
	}
	return problems;
}

export interface DuplicateGroup {
	readonly key: string;
	readonly rows: RowLine[];
}

/** Word values repeating within one list, compared case-insensitively (FORMAT.md §2). */
export function findDuplicateWords(list: ParsedList): DuplicateGroup[] {
	const byKey = new Map<string, RowLine[]>();
	for (const row of list.wordRows) {
		const key = sortKey(row.word);
		const existing = byKey.get(key);
		if (existing) {
			existing.push(row);
		} else {
			byKey.set(key, [row]);
		}
	}
	return [...byKey.entries()]
		.filter(([, rows]) => rows.length > 1)
		.map(([key, rows]) => ({ key, rows }));
}

/** Duplicate list references within one composing list. */
export function findDuplicateIncludes(list: ParsedList): DuplicateGroup[] {
	const byKey = new Map<string, RowLine[]>();
	for (const row of list.includeRows) {
		const key = row.word;
		const existing = byKey.get(key);
		if (existing) {
			existing.push(row);
		} else {
			byKey.set(key, [row]);
		}
	}
	return [...byKey.entries()]
		.filter(([, rows]) => rows.length > 1)
		.map(([key, rows]) => ({ key, rows }));
}

export interface WhitespaceProblem {
	readonly lineNumber: number;
	readonly message: string;
}

/**
 * Whitespace and line-ending lint. A trailing empty column is how a blank optional field
 * is spelled, so a line-final tab is legal and only spaces are trailing whitespace.
 */
export function findWhitespaceProblems(path: string, contents: string): WhitespaceProblem[] {
	const problems: WhitespaceProblem[] = [];

	if (contents.length === 0) {
		return [{ lineNumber: 1, message: "file is empty" }];
	}

	if (contents.includes("\r")) {
		const rawLines = contents.split("\n");
		rawLines.forEach((raw, offset) => {
			if (raw.includes("\r")) {
				problems.push({
					lineNumber: offset + 1,
					message: "carriage return — line endings must be LF",
				});
			}
		});
	}

	if (!contents.endsWith("\n")) {
		problems.push({
			lineNumber: contents.split("\n").length,
			message: "missing trailing newline",
		});
	} else if (contents.endsWith("\n\n")) {
		problems.push({
			lineNumber: contents.split("\n").length - 1,
			message: "more than one trailing newline",
		});
	}

	stripTrailingEmptyLine(contents.split("\n")).forEach((raw, offset) => {
		const line = raw.replace(/\r$/, "");
		if (/[ \t]+$/.test(line) && !line.endsWith("\t")) {
			problems.push({ lineNumber: offset + 1, message: "trailing whitespace" });
		}
		if (line.includes(" \t") || line.includes("\t ")) {
			problems.push({
				lineNumber: offset + 1,
				message: "space adjacent to a tab separator",
			});
		}
	});

	return problems;
}

/**
 * Rewrites a list with word rows sorted case-insensitively, preserving comments, the
 * header, and include-row order. Returns the original text when nothing needs changing.
 */
export function normalizeList(contents: string): string {
	const list = parseList("<normalize>", contents);
	if (list.errors.length > 0 || !list.header) {
		return contents;
	}

	const sortedWordRows = [...list.wordRows].sort((a, b) => compareWords(a.word, b.word));

	// Word rows are re-emitted into the positions word rows already occupy, which keeps
	// interleaved comments and the include block anchored where the author put them.
	let nextWordRow = 0;
	const emitted = list.lines.map((line) => {
		if (line.kind === "row" && isWordAction(line.action)) {
			const replacement = sortedWordRows[nextWordRow];
			nextWordRow += 1;
			return normalizeLine(replacement.raw);
		}
		return normalizeLine(line.raw);
	});

	return emitted.join("\n") + "\n";
}

/** A trailing tab is a blank optional column (FORMAT.md §2), never trimmed. */
function normalizeLine(raw: string): string {
	return raw.replace(/\r$/, "").replace(/ +$/, "");
}
