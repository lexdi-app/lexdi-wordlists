/**
 * Utility Functions for Danger
 *
 * Helpers for working with Danger and the GitHub API.
 */

import "./danger-import";

import { githubPathLink, toSentence } from "./rendering";

/**
 * Gets the base repository URL from the PR context
 */
export function repoBaseUrlIfIsAPullRequest(): string {
	return danger.github.pr?.head?.repo?.html_url || "";
}

/**
 * Takes a list of file paths, and converts them into clickable links
 */
export function linkableFiles(paths: string | string[]): string {
	if (typeof paths === "string") {
		paths = [paths];
	}
	const repoURL = repoBaseUrlIfIsAPullRequest();
	const ref = danger.github.pr.head.ref;
	const links = paths.map((aPath) => githubPathLink(repoURL, ref, aPath, ""));
	return toSentence(links);
}

export type SomeReporterFunc = (message: string, file?: string, line?: number) => unknown;

/**
 * Raise an issue about files that need attention
 */
export function raiseIssueAboutPaths(
	raiser: SomeReporterFunc,
	paths: string[],
	codeToInclude: string,
): void {
	if ((paths || []).length > 0) {
		const files = linkableFiles(paths);
		const strict = "<code>" + codeToInclude + "</code>";
		raiser(`Please ensure that ${strict} is correct in: ${files}`);
	}
}

/**
 * Check if someone is assigned to the PR
 */
export function ruleEnsureSomeoneIsAssigned(): void {
	const someoneAssigned = danger.github.pr.assignee;
	if (someoneAssigned == null) {
		warn(
			"Please assign someone to merge this PR, and optionally include people who should review.",
		);
	}
}
