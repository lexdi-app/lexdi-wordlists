/**
 * Wordlist Auto-Fixer
 *
 * Rewrites `lists/*.lexdi.tsv` into the sorted, whitespace-clean form the Danger rules
 * check for. Shares its normalization with those rules, so a fixed file always passes.
 *
 * Exit code 1 means at least one file changed, which the formatting workflow reads as
 * "there is something to commit".
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { normalizeList, parseList } from "./danger/lib/wordlist-tsv.ts";

const repoRoot = path.resolve(import.meta.dirname, "..");
const listsDir = path.join(repoRoot, "lists");

function listFiles(): string[] {
	if (!fs.existsSync(listsDir)) return [];
	return fs
		.readdirSync(listsDir)
		.filter((name) => name.endsWith(".lexdi.tsv"))
		.sort()
		.map((name) => path.join(listsDir, name));
}

function main(): void {
	const changed: string[] = [];
	const skipped: string[] = [];

	for (const file of listFiles()) {
		const relative = path.relative(repoRoot, file);
		const contents = fs.readFileSync(file, "utf8");

		// A file that does not parse is left untouched: reordering rows around a structural
		// error would obscure it.
		const parsed = parseList(relative, contents);
		if (parsed.errors.length > 0) {
			skipped.push(`${relative}: ${parsed.errors.map((e) => `line ${e.lineNumber}: ${e.message}`).join("; ")}`);
			continue;
		}

		const normalized = normalizeList(contents);
		if (normalized !== contents) {
			fs.writeFileSync(file, normalized, "utf8");
			changed.push(relative);
		}
	}

	for (const problem of skipped) {
		console.error(`skipped ${problem}`);
	}

	if (changed.length === 0) {
		console.log("All lists already normalized.");
		process.exit(skipped.length > 0 ? 1 : 0);
	}

	console.log(`Normalized ${changed.length} list(s):`);
	for (const file of changed) {
		console.log(`  ${file}`);
	}
	process.exit(1);
}

main();
