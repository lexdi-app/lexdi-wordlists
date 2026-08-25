/**
 * Lexdi Wordlists Dangerfile
 *
 * Automated pull-request feedback for the word-list sources.
 */

import * as path from "node:path";

import { danger, fail, warn } from "danger";

import { ruleReportFilterResults } from "./lib/filter-report";
import {
	failOnLintWarningsFollowedBy,
	incrementMinimumWarningThresholdForPRFailure,
} from "./lib/fail-on-warnings";
import { scheduleLast } from "./lib/scheduling";
import { truncateOutputIfNeeded } from "./lib/truncate-output";
import {
	changedListPaths,
	ruleCheckDuplicatesWithinList,
	ruleCheckShrink,
	ruleCheckSortOrder,
	ruleCheckWhitespace,
	ruleReportCrossListDuplicates,
	ruleReportParseErrors,
} from "./lib/wordlists";

// #region Configuration

const BIG_PR_THRESHOLD = 5000;

const repoRoot = path.resolve(__dirname, "..", "..");

// #endregion

// #region Helpers

// `danger local` runs without GitHub context; the list checks still work there.
const github = danger.github as typeof danger.github | undefined;
const pr = github?.pr;
const commits = github?.commits ?? [];

const authors = commits.map((x) => x.author?.login || x.committer?.login).filter((x) => x != null);
const isBot =
	authors.length > 0 &&
	(authors.some((x) => ["greenkeeper", "renovate", "dependabot"].includes(x)) ||
		authors.every((x) => x.toLowerCase().includes("bot")));

/**
 * Formatting fixes are pushed back to the branch only when it lives in this repository;
 * the automation has no write access to a fork.
 */
const isSameRepoBranch = pr ? pr.head.repo.full_name === pr.base.repo.full_name : false;

const changedLists = changedListPaths();

// #endregion

// #region Pull Request Quality

if (pr && !isBot && (!pr.body || pr.body.trim().length === 0)) {
	fail("Please add a description to your pull request.");
}

if (pr && !isBot) {
	const totalChangeCount = pr.additions + pr.deletions;
	if (totalChangeCount > BIG_PR_THRESHOLD) {
		incrementMinimumWarningThresholdForPRFailure();
		warn(
			`:exclamation: Big pull request (+${totalChangeCount} changes). Consider splitting it into smaller ones.`,
		);
	}
}

// #endregion

// #region Wordlist Checks

if (changedLists.length > 0) {
	ruleReportParseErrors(repoRoot, changedLists);
	ruleCheckDuplicatesWithinList(repoRoot, changedLists);
	ruleCheckSortOrder(repoRoot, changedLists, isSameRepoBranch);
	ruleCheckWhitespace(repoRoot, changedLists, isSameRepoBranch);
	ruleReportCrossListDuplicates(repoRoot, changedLists);
	ruleReportFilterResults(repoRoot, changedLists);

	schedule(ruleCheckShrink(repoRoot, changedLists));
}

// #endregion

// #region Final Processing

scheduleLast(failOnLintWarningsFollowedBy(truncateOutputIfNeeded));

console.debug("Lexdi Wordlists Dangerfile Loaded");

// #endregion
