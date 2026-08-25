/**
 * DangerJS Global Types
 *
 * DangerJS has a weird compile/runtime environment.
 * Extra files that want to use danger globals need this to make TypeScript happy.
 *
 * @see https://github.com/danger/danger-js/blob/main/docs/usage/extending-danger.html.md#writing-your-plugin
 */

import type { DangerRuntimeContainer, Scheduleable } from "danger";
import type { DangerDSLType } from "danger/distribution/dsl/DangerDSL";

export {};

// Provides dev-time type structures for `danger` - doesn't affect runtime.
declare global {
	const danger: DangerDSLType;
	function message(message: string, file?: string, line?: number): void;
	function warn(message: string, file?: string, line?: number): void;
	function fail(message: string, file?: string, line?: number): void;
	function markdown(message: string, file?: string, line?: number): void;
	const results: DangerRuntimeContainer;
	/**
	 * A Dangerfile, in Peril, is evaluated as a script, and so async code does not work
	 * out of the box. By using the `schedule` function you can now register a
	 * section of code to evaluate across multiple tick cycles.
	 *
	 * @param {Function} asyncFunction the function to run asynchronously
	 */
	function schedule(asyncFunction: Scheduleable): void;
}
