/**
 * Wordlist Compiler
 *
 * Compiles a `.lexdi.tsv` source into the published `.lexdi` JSON artifact (FORMAT.md §4).
 * Parsing is delegated to the shared TSV model, so the compiler agrees with the lint and
 * autofix rules about what a row is.
 */

import * as crypto from "node:crypto";

import { isWordAction, parseList, type RowLine } from "../danger/lib/wordlist-tsv.ts";

/** Column names the compiler carries into a published entry, in emission order. */
const OPTIONAL_COLUMNS = ["definition", "source", "added"] as const;

const ADDED_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const SCHEMA_VERSION = 1;

export interface WordEntry {
	word: string;
	action: string;
	definition?: string;
	source?: string;
	added?: string;
}

export interface IncludeRef {
	ref: string;
}

export interface ListMeta {
	name: string;
	schemaVersion: number;
	languages?: string[];
	version: string;
	last_modified: string;
	refreshUrl: string;
	license: string;
	sourceSha: string;
}

export interface LexdiDocument {
	_meta_: ListMeta;
	includes?: IncludeRef[];
	entries?: WordEntry[];
}

/** Per-list `_meta_` supplied by pipeline configuration, never by the TSV (FORMAT.md §4.4). */
export interface ListConfig {
	readonly name: string;
	readonly license: string;
	readonly refreshUrl: string;
	readonly languages?: string[];
}

/** The publish stamp, derived from the commit that last touched the source (FORMAT.md §4.4). */
export interface PublishStamp {
	/** `YYYY-MM-DD`. */
	readonly version: string;
	/** `YYYY-MM-DDTHH:MM:SSZ`. */
	readonly lastModified: string;
}

export class CompileError extends Error {}

/** SHA-256 over the source bytes exactly as committed, pre-parse (FORMAT.md §4.4). */
export function sourceSha(contents: string | Uint8Array): string {
	return crypto.createHash("sha256").update(contents).digest("hex");
}

/**
 * Compiles one source. Rejects on the §4.1 conditions — structural parse errors,
 * duplicate words, malformed `added` dates — rather than emitting a partial artifact.
 */
export function compileList(
	path: string,
	contents: string,
	config: ListConfig,
	stamp: PublishStamp,
): LexdiDocument {
	const parsed = parseList(path, contents);

	if (parsed.errors.length > 0) {
		const detail = parsed.errors.map((e) => `line ${e.lineNumber}: ${e.message}`).join("; ");
		throw new CompileError(`${path}: ${detail}`);
	}

	const seen = new Map<string, number>();
	for (const row of parsed.wordRows) {
		const key = row.word.toLocaleLowerCase();
		const first = seen.get(key);
		if (first !== undefined) {
			throw new CompileError(
				`${path}: line ${row.lineNumber}: \`${row.word}\` repeats the word first seen on line ${first}`,
			);
		}
		seen.set(key, row.lineNumber);
	}

	const columnIndex = indexColumns(parsed.header?.columns ?? []);

	const document: LexdiDocument = {
		_meta_: {
			name: config.name,
			schemaVersion: SCHEMA_VERSION,
			...(config.languages ? { languages: [...config.languages] } : {}),
			version: stamp.version,
			last_modified: stamp.lastModified,
			refreshUrl: config.refreshUrl,
			license: config.license,
			sourceSha: sourceSha(contents),
		},
	};

	// Source order carries include precedence (FORMAT.md §4.3), so neither array is re-sorted.
	if (parsed.includeRows.length > 0) {
		document.includes = parsed.includeRows.map((row) => ({ ref: row.word }));
	}
	if (parsed.wordRows.length > 0) {
		document.entries = parsed.wordRows.map((row) => toEntry(path, row, columnIndex));
	}

	return document;
}

function indexColumns(columns: string[]): Map<string, number> {
	const index = new Map<string, number>();
	columns.forEach((column, position) => {
		if (!index.has(column)) index.set(column, position);
	});
	return index;
}

function toEntry(path: string, row: RowLine, columnIndex: Map<string, number>): WordEntry {
	if (!isWordAction(row.action)) {
		throw new CompileError(`${path}: line ${row.lineNumber}: \`${row.action}\` is not a word action`);
	}

	const entry: WordEntry = { word: row.word, action: row.action };

	for (const column of OPTIONAL_COLUMNS) {
		const position = columnIndex.get(column);
		if (position === undefined) continue;

		// A blank optional field is absent from the artifact, never an empty string (FORMAT.md §4.2).
		const value = row.fields[position]?.trim() ?? "";
		if (value.length === 0) continue;

		if (column === "added" && !ADDED_DATE.test(value)) {
			throw new CompileError(`${path}: line ${row.lineNumber}: \`added\` must be YYYY-MM-DD, found \`${value}\``);
		}
		entry[column] = value;
	}

	return entry;
}

/**
 * Serializes an artifact. Key order follows the interface declarations rather than
 * insertion chance, and the trailing newline makes the file well-formed for line tools —
 * both are what let an unchanged source recompile byte-identically (FORMAT.md §4.5).
 */
export function serializeDocument(document: LexdiDocument): string {
	return `${JSON.stringify(document, null, "\t")}\n`;
}
