/**
 * Wordlist TSV model tests (FORMAT.md §2).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeList, parseList } from "./wordlist-tsv.ts";

test("normalizeList preserves field-separating tabs on a row with blank optional columns", () => {
	const source = "word\taction\tdefinition\tsource\tadded\ntokenizer\tadd\t\t\t\n";

	const normalized = normalizeList(source);

	const parsed = parseList("<test>", normalized);
	assert.equal(parsed.errors.length, 0);
	assert.equal(parsed.wordRows.length, 1);
	assert.deepEqual(parsed.wordRows[0].fields, ["tokenizer", "add", "", "", ""]);
});
