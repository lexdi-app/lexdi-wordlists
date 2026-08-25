/**
 * Scheduling Utilities for Danger
 *
 * Utilities for manipulating asynchronous execution of subtasks.
 */

import "./danger-import";

const lastScheduledTasks: Array<Promise<void>> = [];

function nonLastTasks(): Array<Promise<void>> {
	return (results.scheduled || []).filter(
		(t) => lastScheduledTasks.includes(t as Promise<void>) === false,
	) as Array<Promise<void>>;
}

function hasNonLastTasks(): boolean {
	return nonLastTasks().length > 0;
}

async function nonLastTasksResolved(): Promise<void> {
	const internal = async () => {
		for (const task of nonLastTasks()) {
			if (typeof task === "function") {
				console.warn(
					"DangerJS Scheduled Task is a function; we can't acquire the promise to await it.",
				);
				continue;
			}

			try {
				await task;
			} catch {
				// Do nothing, because these tasks will have already reported elsewhere
			}
		}
	};

	// Await pending promises twice just in case new scheduled tasks get added after we started
	await internal();
	await internal();
}

/**
 * Helper to execute a task after all other scheduled danger tasks have completed
 */
export function scheduleLast(task_: (() => Promise<unknown> | void) | Promise<unknown>): void {
	const task = typeof task_ !== "function" ? async () => await task_ : task_;
	const beginProcessingLastTask = async (resolve: () => void, reject: (err: unknown) => void) => {
		await nonLastTasksResolved();
		try {
			await task();
			resolve();
		} catch (e) {
			reject(e);
		}
	};

	const prom = new Promise<void>((resolve, reject) => {
		if (!hasNonLastTasks()) {
			// Wait a second to ensure some non-last-tasks are enqueued
			setTimeout(() => {
				void beginProcessingLastTask(resolve, reject);
			}, 1000);
		} else {
			void beginProcessingLastTask(resolve, reject);
		}
	});
	lastScheduledTasks.push(prom);
	schedule(prom);
}
