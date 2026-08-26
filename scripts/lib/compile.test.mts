/**
 * Compiler tests (FORMAT.md §4).
 */

import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

import {
	compileList,
	serializeDocument,
	sourceSha,
	CompileError,
	type ListConfig,
	type PublishStamp,
} from "./compile.mts";
import { parseConfig, ConfigError } from "./list-config.mts";
import { validate, type JsonSchema } from "./json-schema.mts";
import { stampFromDate } from "./publish-stamp.mts";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

const CONFIG: ListConfig = {
	name: "Test List",
	license: "CC0-1.0",
	refreshUrl: "https://lexdi.app/lists/test.lexdi",
	languages: ["en-US"],
};

const STAMP: PublishStamp = { version: "2026-07-20", lastModified: "2026-07-20T18:04:00Z" };

const internalSchema = readSchema("lexdi-v1-internal.json");
const publishedSchema = readSchema("lexdi-v1.json");

function readSchema(name: string): JsonSchema {
	return JSON.parse(fs.readFileSync(path.join(repoRoot, "schema", name), "utf8")) as JsonSchema;
}

function tsv(...lines: string[]): string {
	return `${lines.join("\n")}\n`;
}

test("compiles word rows into entries, omitting blank optional columns", () => {
	const document = compileList(
		"test.lexdi.tsv",
		tsv(
			"word\taction\tdefinition\tsource\tadded",
			"agentification\tadd\tRestructuring a task.\t\t2026-07-23",
			"tokenizer\tadd\t\t\t2026-07-20",
		),
		CONFIG,
		STAMP,
	);

	assert.deepEqual(document.entries, [
		{ word: "agentification", action: "add", definition: "Restructuring a task.", added: "2026-07-23" },
		{ word: "tokenizer", action: "add", added: "2026-07-20" },
	]);
	// A source-less list emits no `includes` key at all, never an empty array (§4.2).
	assert.equal("includes" in document, false);
});

test("preserves include order, since index 0 is highest precedence", () => {
	const document = compileList(
		"all.lexdi.tsv",
		tsv(
			"word\taction",
			"2026-ai.lexdi\tinclude",
			"2026-developer.lexdi\tinclude",
			"2026-slang.lexdi\tinclude",
		),
		CONFIG,
		STAMP,
	);

	assert.deepEqual(document.includes, [
		{ ref: "2026-ai.lexdi" },
		{ ref: "2026-developer.lexdi" },
		{ ref: "2026-slang.lexdi" },
	]);
	assert.equal("entries" in document, false);
});

test("a document may carry both includes and entries", () => {
	const document = compileList(
		"mixed.lexdi.tsv",
		tsv("word\taction", "2026-ai.lexdi\tinclude", "brainrot\tadd"),
		CONFIG,
		STAMP,
	);

	assert.deepEqual(document.includes, [{ ref: "2026-ai.lexdi" }]);
	assert.deepEqual(document.entries, [{ word: "brainrot", action: "add" }]);
});

test("compiles exclude rows as entries", () => {
	const document = compileList("x.lexdi.tsv", tsv("word\taction", "brainrot\texclude"), CONFIG, STAMP);

	assert.deepEqual(document.entries, [{ word: "brainrot", action: "exclude" }]);
});

test("a header without an action column makes every row an add", () => {
	const document = compileList("x.lexdi.tsv", tsv("word", "alpha", "beta"), CONFIG, STAMP);

	assert.deepEqual(document.entries, [
		{ word: "alpha", action: "add" },
		{ word: "beta", action: "add" },
	]);
});

test("stamps meta from configuration and the publish stamp", () => {
	const document = compileList("x.lexdi.tsv", tsv("word\taction", "alpha\tadd"), CONFIG, STAMP);

	assert.deepEqual(document._meta_, {
		name: "Test List",
		schemaVersion: 1,
		languages: ["en-US"],
		version: "2026-07-20",
		last_modified: "2026-07-20T18:04:00Z",
		refreshUrl: "https://lexdi.app/lists/test.lexdi",
		license: "CC0-1.0",
		sourceSha: sourceSha(tsv("word\taction", "alpha\tadd")),
	});
});

test("sourceSha covers the raw source bytes, so a comment-only edit changes it", () => {
	const before = tsv("# note", "word\taction", "alpha\tadd");
	const after = tsv("# revised note", "word\taction", "alpha\tadd");

	assert.notEqual(sourceSha(before), sourceSha(after));
	assert.equal(sourceSha(before), sourceSha(before));
});

test("recompiling an unchanged source is byte-identical", () => {
	const contents = tsv("word\taction\tadded", "alpha\tadd\t2026-01-02", "beta\tadd\t2026-01-03");

	const first = serializeDocument(compileList("x.lexdi.tsv", contents, CONFIG, STAMP));
	const second = serializeDocument(compileList("x.lexdi.tsv", contents, CONFIG, STAMP));

	assert.equal(first, second);
});

test("serialization ends with exactly one newline", () => {
	const output = serializeDocument(compileList("x.lexdi.tsv", tsv("word", "alpha"), CONFIG, STAMP));

	assert.ok(output.endsWith("}\n"));
	assert.equal(output.endsWith("\n\n"), false);
});

test("rejects a word repeating within one list, case-insensitively", () => {
	assert.throws(
		() => compileList("x.lexdi.tsv", tsv("word\taction", "Alpha\tadd", "alpha\tadd"), CONFIG, STAMP),
		(error: Error) => error instanceof CompileError && /repeats the word/.test(error.message),
	);
});

test("rejects a malformed added date", () => {
	assert.throws(
		() => compileList("x.lexdi.tsv", tsv("word\taction\tadded", "alpha\tadd\t07/23/2026"), CONFIG, STAMP),
		(error: Error) => error instanceof CompileError && /YYYY-MM-DD/.test(error.message),
	);
});

test("rejects an unrecognized action", () => {
	assert.throws(
		() => compileList("x.lexdi.tsv", tsv("word\taction", "alpha\tbanish"), CONFIG, STAMP),
		(error: Error) => error instanceof CompileError && /banish/.test(error.message),
	);
});

test("rejects a header with no word column", () => {
	assert.throws(
		() => compileList("x.lexdi.tsv", tsv("term\taction", "alpha\tadd"), CONFIG, STAMP),
		(error: Error) => error instanceof CompileError && /word/.test(error.message),
	);
});

test("compiled artifacts validate against both schemas", () => {
	const document = compileList(
		"x.lexdi.tsv",
		tsv("word\taction\tdefinition\tsource\tadded", "RLHF\tadd\tA training method.\thttps://example.com/rlhf\t2026-07-20"),
		CONFIG,
		STAMP,
	);

	assert.deepEqual(validate(document, internalSchema), []);
	assert.deepEqual(validate(document, publishedSchema), []);
});

test("the internal schema rejects an artifact missing sourceSha", () => {
	const document = compileList("x.lexdi.tsv", tsv("word", "alpha"), CONFIG, STAMP);
	const withoutSha = { ...document, _meta_: { ...document._meta_, sourceSha: undefined } };
	delete (withoutSha._meta_ as Record<string, unknown>).sourceSha;

	assert.equal(validate(withoutSha, internalSchema).length, 1);
	// The published schema never defines the field, so its absence is unremarkable there (§3a).
	assert.deepEqual(validate(withoutSha, publishedSchema), []);
});

test("the published schema tolerates unknown keys", () => {
	const document = compileList("x.lexdi.tsv", tsv("word", "alpha"), CONFIG, STAMP);
	const extended = {
		...document,
		_meta_: { ...document._meta_, futureField: "value" },
		entries: [{ word: "alpha", action: "add", futureField: 1 }],
	};

	assert.deepEqual(validate(extended, publishedSchema), []);
});

test("the published schema rejects a document with no _meta_", () => {
	assert.equal(validate({ entries: [] }, publishedSchema).length, 1);
});

test("the published schema rejects an unknown action value", () => {
	const document = { _meta_: { name: "x", schemaVersion: 1 }, entries: [{ word: "a", action: "include" }] };

	assert.equal(validate(document, publishedSchema).length, 1);
});

test("stampFromDate derives both fields from one commit instant", () => {
	assert.deepEqual(stampFromDate(new Date("2026-07-20T18:04:31.512Z")), {
		version: "2026-07-20",
		lastModified: "2026-07-20T18:04:31Z",
	});
});

test("stampFromDate normalizes a non-UTC offset", () => {
	assert.deepEqual(stampFromDate(new Date("2026-07-20T18:04:00-07:00")), {
		version: "2026-07-21",
		lastModified: "2026-07-21T01:04:00Z",
	});
});

test("config resolves refreshUrl from the base and inherits defaults", () => {
	const table = parseConfig(
		JSON.stringify({
			defaults: { license: "CC0-1.0", languages: ["en-US"], refreshUrlBase: "https://lexdi.app/lists/" },
			lists: { "2026-ai": { name: "2026 AI Terms" } },
		}),
		"test",
	);

	assert.deepEqual(table.get("2026-ai"), {
		name: "2026 AI Terms",
		license: "CC0-1.0",
		refreshUrl: "https://lexdi.app/lists/2026-ai.lexdi",
		languages: ["en-US"],
	});
});

test("a per-list entry overrides the defaults", () => {
	const table = parseConfig(
		JSON.stringify({
			defaults: { license: "CC0-1.0", refreshUrlBase: "https://lexdi.app/lists/" },
			lists: { custom: { name: "Custom", license: "MIT", refreshUrl: "https://example.com/c.lexdi" } },
		}),
		"test",
	);

	assert.equal(table.get("custom").license, "MIT");
	assert.equal(table.get("custom").refreshUrl, "https://example.com/c.lexdi");
});

test("an unconfigured list is an error rather than a guessed name", () => {
	const table = parseConfig(JSON.stringify({ defaults: {}, lists: {} }), "test");

	assert.throws(() => table.get("missing"), ConfigError);
});

test("every real list source has a configuration entry", () => {
	const table = parseConfig(
		fs.readFileSync(path.join(repoRoot, "lists", "lists.config.json"), "utf8"),
		"lists.config.json",
	);

	const sources = fs
		.readdirSync(path.join(repoRoot, "lists"))
		.filter((name) => name.endsWith(".lexdi.tsv"))
		.map((name) => name.replace(/\.lexdi\.tsv$/, ""));

	assert.ok(sources.length > 0);
	for (const source of sources) {
		assert.ok(table.has(source), `lists.config.json has no entry for \`${source}\``);
	}
});

test("golden: 2026-ai compiles to the expected artifact", () => {
	const source = path.join(repoRoot, "lists", "2026-ai.lexdi.tsv");
	const contents = fs.readFileSync(source, "utf8");
	const table = parseConfig(
		fs.readFileSync(path.join(repoRoot, "lists", "lists.config.json"), "utf8"),
		"lists.config.json",
	);

	// A fixed stamp keeps the golden independent of this list's commit history.
	const document = compileList("lists/2026-ai.lexdi.tsv", contents, table.get("2026-ai"), STAMP);
	const golden = fs.readFileSync(path.join(import.meta.dirname, "__fixtures__", "2026-ai.lexdi"), "utf8");

	assert.equal(serializeDocument(document), golden);
});

test("the real sources compile and validate", () => {
	const table = parseConfig(
		fs.readFileSync(path.join(repoRoot, "lists", "lists.config.json"), "utf8"),
		"lists.config.json",
	);
	const listsDir = path.join(repoRoot, "lists");

	for (const name of fs.readdirSync(listsDir).filter((n) => n.endsWith(".lexdi.tsv"))) {
		const listName = name.replace(/\.lexdi\.tsv$/, "");
		const document = compileList(name, fs.readFileSync(path.join(listsDir, name), "utf8"), table.get(listName), STAMP);

		assert.deepEqual(validate(document, internalSchema), [], `${name} failed internal validation`);
		assert.deepEqual(validate(document, publishedSchema), [], `${name} failed published validation`);
	}
});

test("the compiler CLI is idempotent across runs", () => {
	const outDir = fs.mkdtempSync(path.join(repoRoot, "dist-test-"));
	try {
		const run = () => {
			execFileSync("node", ["scripts/compile-lists.mts", "--out", outDir], { cwd: repoRoot, encoding: "utf8" });
			return fs
				.readdirSync(outDir)
				.sort()
				.map((name) => `${name}:${fs.readFileSync(path.join(outDir, name), "utf8")}`)
				.join("\n");
		};

		assert.equal(run(), run());
	} finally {
		fs.rmSync(outDir, { recursive: true, force: true });
	}
});
