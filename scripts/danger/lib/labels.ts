/**
 * PR Labels for Danger
 *
 * Labels that can be applied to PRs to modify Danger behavior.
 */

export enum Label {
	/** Apply this to skip all CI Checks */
	skipCI = "[skip ci]",
	/** Apply this to allow a PR with lint-warnings to merge into the target branch */
	skipLintWarningFailure = "[skip lint-failure]",
}
