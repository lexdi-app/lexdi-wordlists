/**
 * Wordlist Publish Compiler
 *
 * Compiles every `lists/*.lexdi.tsv` source into a published `.lexdi` artifact
 * (FORMAT.md §4), validating each against the pipeline's internal schema before it is
 * written. An artifact that fails validation fails the run rather than reaching a release.
 *
 * Usage: node scripts/compile-lists.mts [--out <dir>] [--check]
 *   --out    Output directory. Defaults to `dist/lists`.
 *   --check  Compile and validate without writing, for pull-request validation.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { compileList, serializeDocument, CompileError } from "./lib/compile.mts";
import { loadConfig, ConfigError, CONFIG_FILENAME } from "./lib/list-config.mts";
import { validate, type JsonSchema } from "./lib/json-schema.mts";
import { stampForFile, StampError } from "./lib/publish-stamp.mts";

const repoRoot = path.resolve(import.meta.dirname, "..");
const listsDir = path.join(repoRoot, "lists");
const internalSchemaPath = path.join(repoRoot, "schema", "lexdi-v1-internal.json");
const publishedSchemaPath = path.join(repoRoot, "schema", "lexdi-v1.json");

interface Options {
	readonly outDir: string;
	readonly check: boolean;
}

function parseArgs(argv: string[]): Options {
	let outDir = path.join(repoRoot, "dist", "lists");
	let check = false;

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "--check") {
			check = true;
		} else if (arg === "--out") {
			const value = argv[i + 1];
			if (!value) throw new Error("--out needs a directory");
			outDir = path.resolve(repoRoot, value);
			i += 1;
		} else {
			throw new Error(`unrecognized argument \`${arg}\``);
		}
	}

	return { outDir, check };
}

function sourceFiles(): string[] {
	if (!fs.existsSync(listsDir)) return [];
	return fs
		.readdirSync(listsDir)
		.filter((name) => name.endsWith(".lexdi.tsv"))
		.sort()
		.map((name) => path.join(listsDir, name));
}

function listNameOf(file: string): string {
	return path.basename(file).replace(/\.lexdi\.tsv$/, "");
}

function readSchema(schemaPath: string): JsonSchema {
	return JSON.parse(fs.readFileSync(schemaPath, "utf8")) as JsonSchema;
}

function main(): void {
	const options = parseArgs(process.argv.slice(2));
	const config = loadConfig(path.join(listsDir, CONFIG_FILENAME));
	const internalSchema = readSchema(internalSchemaPath);
	const publishedSchema = readSchema(publishedSchemaPath);

	const files = sourceFiles();
	if (files.length === 0) {
		console.error("No `.lexdi.tsv` sources found under lists/.");
		process.exit(1);
	}

	const failures: string[] = [];
	const written: string[] = [];

	if (!options.check) {
		fs.mkdirSync(options.outDir, { recursive: true });
	}

	for (const file of files) {
		const relative = path.relative(repoRoot, file);
		const listName = listNameOf(file);

		try {
			const contents = fs.readFileSync(file, "utf8");
			const document = compileList(relative, contents, config.get(listName), stampForFile(repoRoot, relative));

			// The internal schema is the stricter superset, so a pass here implies the
			// published one; both run because a divergence between them is itself a defect.
			for (const [label, schema] of [
				["internal", internalSchema],
				["published", publishedSchema],
			] as const) {
				const errors = validate(document, schema);
				if (errors.length > 0) {
					const detail = errors.map((e) => `${e.path || "/"}: ${e.message}`).join("; ");
					failures.push(`${relative}: ${label} schema validation failed — ${detail}`);
				}
			}

			const serialized = serializeDocument(document);
			const target = path.join(options.outDir, `${listName}.lexdi`);

			if (!options.check) {
				fs.writeFileSync(target, serialized, "utf8");
			}
			written.push(`${listName}.lexdi (${document.entries?.length ?? 0} entries, ${document.includes?.length ?? 0} includes)`);
		} catch (error) {
			if (error instanceof CompileError || error instanceof ConfigError || error instanceof StampError) {
				failures.push(error.message);
			} else {
				throw error;
			}
		}
	}

	for (const failure of failures) {
		console.error(`error: ${failure}`);
	}

	if (failures.length > 0) {
		console.error(`\n${failures.length} list(s) failed to compile.`);
		process.exit(1);
	}

	const verb = options.check ? "Validated" : "Compiled";
	console.log(`${verb} ${written.length} list(s)${options.check ? "" : ` into ${path.relative(repoRoot, options.outDir)}`}:`);
	for (const entry of written) {
		console.log(`  ${entry}`);
	}
}

main();
