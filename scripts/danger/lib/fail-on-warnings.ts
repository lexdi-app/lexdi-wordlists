/**
 * Fail on Lint Warnings
 *
 * Helper to fail the PR if there are lint warnings (configurable threshold).
 */

import "./danger-import";

import { Label } from "./labels";

let minimumThreshold = 0;

/**
 * Increment the threshold for warnings before failing.
 * Call this when you intentionally add a warning that shouldn't fail the build.
 */
export function incrementMinimumWarningThresholdForPRFailure(): number {
	return (minimumThreshold += 1);
}

/**
 * Returns the labels that were present at the start of the Danger run.
 */
function labelsAtStartOfDangerRun(): string[] {
	// `danger local` runs without GitHub context, so there are no labels to read.
	const github = danger.github as typeof danger.github | undefined;
	return github ? github.issue.labels.map(({ name }) => name) : [];
}

/**
 * Fail the PR if there are more warnings than the threshold.
 * This runs after other checks, ensuring warnings are treated seriously.
 */
export function failOnLintWarningsFollowedBy(
	nextTask: () => Promise<unknown>,
): () => Promise<unknown> {
	return async () => {
		if (!labelsAtStartOfDangerRun().includes(Label.skipLintWarningFailure)) {
			if (
				(results.warnings || []).length > minimumThreshold &&
				(results.fails || []).length === 0
			) {
				fail(`This PR has some lint warnings! Don't worry, they're minor issues; fix them to make this PR merge-ready.

_In emergency consider the "${Label.skipLintWarningFailure}" label._`);
			}
		}
		return nextTask();
	};
}
