/**
 * Output Truncation for Danger
 *
 * GitHub has limits on comment size. This handles truncating output
 * when there are too many errors.
 */

import "./danger-import";

import { githubPathLink } from "./rendering";
import { repoBaseUrlIfIsAPullRequest } from "./utils";

type IssueClass = "fails" | "warnings" | "markdowns" | "messages";

const truncationString = "[...]";
const truncationSummary = "**Some data was truncated -- too much output!**";

const GITHUB_ISSUE_MAX_CHARS = 65536;
const ARBITRARY_FORMATTING_BUFFER = 500 + truncationSummary.length;
const AVAILABLE_CHARS = GITHUB_ISSUE_MAX_CHARS - ARBITRARY_FORMATTING_BUFFER;

const PER_MESSAGE_TEMPLATE = `
  <tr>
    <td>:warning:</td>
    <td>
    </td>
  </tr>
	`;

type DebugMetrics = {
	[K in IssueClass]: { numEntries: number; numNonInlineEntries: number; sumNumChars: number };
};

interface PartialDangerViolation {
	message: string;
	file?: string;
	line?: number;
}

function isInlineViolation(violation: PartialDangerViolation): boolean {
	return Boolean(violation.file && violation.line);
}

function mutateToNonInline(violation: PartialDangerViolation): void {
	if (!violation.file || !violation.line) {
		return;
	}
	const repoURL = repoBaseUrlIfIsAPullRequest();
	const ref = danger.github.pr.head.ref;

	violation.message = `${violation.message} @ ${githubPathLink(
		repoURL,
		ref,
		violation.file,
		`#L${violation.line}`,
	)}`;
	delete violation.file;
	delete violation.line;
}

/**
 * Workaround for GitHub inline comment issues
 * @see https://github.com/danger/danger-js/issues/1207
 */
function applyGithubInlineCommentWorkaround({
	interestingKeys,
}: {
	interestingKeys: IssueClass[];
}): void {
	const allUpdatedPaths = new Set([
		...(danger.git.created_files || []),
		...(danger.git.modified_files || []),
	]);

	for (const key of interestingKeys) {
		for (const violation of results[key] as PartialDangerViolation[]) {
			if (!violation.file) {
				continue;
			}
			if (!allUpdatedPaths.has(violation.file)) {
				mutateToNonInline(violation);
			}
		}
	}
}

function truncateOutputByShorteningMessagesEvenly({
	interestingKeys,
	metrics,
}: {
	interestingKeys: IssueClass[];
	metrics: DebugMetrics;
}): boolean {
	const totalNonInlineMessages = interestingKeys
		.map((key) => metrics[key].numNonInlineEntries)
		.reduce((sum, num) => sum + num, 0);

	const spacePerMessage = Math.max(
		Math.floor(AVAILABLE_CHARS / (totalNonInlineMessages || 1) - PER_MESSAGE_TEMPLATE.length),
		truncationString.length,
	);
	const shortenedSpacePerMessage = spacePerMessage - truncationString.length;

	console.debug({ spacePerMessage, shortenedSpacePerMessage });

	let didTruncate = false;
	interestingKeys.forEach((key) => {
		(results[key] as PartialDangerViolation[])
			.filter((msg) => !isInlineViolation(msg))
			.forEach((msg) => {
				if (msg.message.length > spacePerMessage) {
					didTruncate = true;
					msg.message = msg.message.slice(0, shortenedSpacePerMessage) + truncationString;
				}
			});
	});
	return didTruncate;
}

/**
 * GitHub has limits on how much text can be present in a single comment.
 * When you have lint/test errors, sometimes that limit can be exceeded!
 */
export async function truncateOutputIfNeeded(): Promise<void> {
	const interestingKeys = (["fails", "warnings", "markdowns", "messages"] as IssueClass[]).filter(
		(key) => Array.isArray(results[key]),
	);

	applyGithubInlineCommentWorkaround({ interestingKeys });

	console.debug(`
============================================================
If you're debugging a PR Failure, then look above this line!
============================================================`);

	const metrics = interestingKeys.reduce((accum, key) => {
		const items = results[key] as PartialDangerViolation[];
		accum[key] = {
			numEntries: items.length,
			numNonInlineEntries: items.filter((msg) => !isInlineViolation(msg)).length,
			sumNumChars: items.reduce(
				(sum, entry) =>
					sum + ((entry?.message && !isNaN(entry.message.length) && entry.message.length) || 0),
				0,
			),
		};
		return accum;
	}, {} as DebugMetrics);
	console.debug(metrics);

	const didTruncate = truncateOutputByShorteningMessagesEvenly({
		metrics,
		interestingKeys,
	});

	if (didTruncate) {
		((results.fails as PartialDangerViolation[]).length > 0 ? fail : warn)(truncationSummary);
		console.debug("Truncated Output -", truncationSummary);
	} else {
		console.debug("Truncation Complete - No lost data.");
	}

	console.debug(`
=======================================================================
Below this line should only exist *DangerJS* output. Expect scary logs!
=======================================================================`);
}
