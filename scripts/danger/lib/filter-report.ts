/**
 * Apple-Dictionary Filter Reporter
 *
 * Summarizes `tools/wordlist-filter` output for the changed lists. The macOS job writes
 * the three per-list files; this reads them from the downloaded artifact directory.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import "./danger-import";

import { assembleTable, makeDisclosableBlock, singleBacktickWrap } from "./rendering";
import { listName } from "./wordlists";

/** Directory the lint job downloads the macOS job's artifact into. */
export const FILTER_OUTPUT_DIR = "filter-output";

interface FlaggedEntry {
	readonly word: string;
	readonly signal: string;
	readonly suggestion?: string;
}

interface ListReport {
	readonly list: string;
	readonly missing: string[];
	readonly alreadyKnown: string[];
	readonly flagged: FlaggedEntry[];
}

function readWordFile(file: string): string[] {
	if (!fs.existsSync(file)) return [];
	return fs
		.readFileSync(file, "utf8")
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

function readFlaggedFile(file: string): FlaggedEntry[] {
	if (!fs.existsSync(file)) return [];
	try {
		const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
		return Array.isArray(parsed) ? (parsed as FlaggedEntry[]) : [];
	} catch {
		return [];
	}
}

function collectReports(outputDir: string, files: string[]): ListReport[] {
	const reports: ListReport[] = [];
	for (const file of files) {
		const list = listName(file);
		const missing = readWordFile(path.join(outputDir, `${list}.missing.txt`));
		const alreadyKnown = readWordFile(path.join(outputDir, `${list}.already-known.txt`));
		const flagged = readFlaggedFile(path.join(outputDir, `${list}.flagged-for-review.json`));

		const produced =
			fs.existsSync(path.join(outputDir, `${list}.missing.txt`)) ||
			fs.existsSync(path.join(outputDir, `${list}.already-known.txt`)) ||
			fs.existsSync(path.join(outputDir, `${list}.flagged-for-review.json`));

		if (produced) {
			reports.push({ list, missing, alreadyKnown, flagged });
		}
	}
	return reports;
}

/**
 * Posts the dictionary comparison. A missing artifact is a note rather than a failure —
 * the macOS job is skipped when a pull request touches no list.
 */
export function ruleReportFilterResults(repoRoot: string, files: string[]): void {
	if (files.length === 0) return;

	const outputDir = path.join(repoRoot, FILTER_OUTPUT_DIR);
	if (!fs.existsSync(outputDir)) {
		message(
			"The macOS dictionary comparison produced no output for this pull request, so new words were not checked against Apple's dictionary.",
		);
		return;
	}

	const reports = collectReports(outputDir, files);
	if (reports.length === 0) {
		message("The macOS dictionary comparison produced no output for the changed lists.");
		return;
	}

	const counts = assembleTable(
		["List", "Missing", "Already known", "Flagged"],
		reports.map((r) => [
			r.list,
			String(r.missing.length),
			String(r.alreadyKnown.length),
			String(r.flagged.length),
		]),
	);

	const sections: string[] = [
		"Words are checked against the dictionary built into macOS. A word Apple already knows is not an automatic rejection — it may still be worth listing for its definition — but a reviewer may ask about it.",
		"",
		counts,
	];

	for (const report of reports) {
		if (report.flagged.length > 0) {
			const rows = report.flagged.map((entry) => [
				singleBacktickWrap(entry.word),
				entry.signal,
				entry.suggestion ? singleBacktickWrap(entry.suggestion) : "—",
			]);
			sections.push(
				`\n**${report.list} — flagged for review**\n\n` +
					assembleTable(["Word", "Signal", "Suggestion"], rows),
			);
		}

		if (report.alreadyKnown.length > 0) {
			sections.push(
				makeDisclosableBlock(
					`${report.list} — ${report.alreadyKnown.length} word(s) Apple already knows`,
					report.alreadyKnown.map((word) => `- ${singleBacktickWrap(word)}`).join("\n"),
				),
			);
		}
	}

	markdown(makeDisclosableBlock("Apple dictionary comparison", sections.join("\n")));
}
