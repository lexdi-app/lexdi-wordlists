/**
 * Publish Stamp
 *
 * Derives `_meta_.version` and `_meta_.last_modified` from the commit that last touched a
 * source file. Wall-clock time would make every rebuild a new artifact and defeat the
 * byte-identical recompile idempotency rests on (FORMAT.md §4.5).
 */

import { execFileSync } from "node:child_process";

import type { PublishStamp } from "./compile.mts";

export class StampError extends Error {}

/** Author timestamp of the newest commit touching `filePath`, as a UTC instant. */
export function lastCommitDate(repoRoot: string, filePath: string): Date {
	let output: string;
	try {
		output = execFileSync("git", ["log", "-1", "--format=%aI", "--", filePath], {
			cwd: repoRoot,
			encoding: "utf8",
		}).trim();
	} catch (error) {
		throw new StampError(`git log failed for ${filePath}: ${(error as Error).message}`);
	}

	if (output.length === 0) {
		throw new StampError(
			`${filePath} has no commit history — commit the source before publishing, since the stamp is derived from it`,
		);
	}

	const date = new Date(output);
	if (Number.isNaN(date.getTime())) {
		throw new StampError(`${filePath}: git returned an unparseable date \`${output}\``);
	}
	return date;
}

export function stampFromDate(date: Date): PublishStamp {
	const iso = date.toISOString();
	return { version: iso.slice(0, 10), lastModified: `${iso.slice(0, 19)}Z` };
}

export function stampForFile(repoRoot: string, filePath: string): PublishStamp {
	return stampFromDate(lastCommitDate(repoRoot, filePath));
}

/** Release tag date component, derived from the triggering commit rather than build time. */
export function releaseDateFor(repoRoot: string, ref: string): string {
	const output = execFileSync("git", ["log", "-1", "--format=%aI", ref], {
		cwd: repoRoot,
		encoding: "utf8",
	}).trim();
	return new Date(output).toISOString().slice(0, 10);
}
