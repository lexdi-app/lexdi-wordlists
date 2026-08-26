/**
 * List Pipeline Configuration
 *
 * Reads `lists/lists.config.json`, the per-list `_meta_` the compiler stamps
 * (FORMAT.md §4.4). A source with no entry here has no name to publish under, so it is
 * an error rather than a defaulted guess.
 */

import * as fs from "node:fs";

import type { ListConfig } from "./compile.mts";

export const CONFIG_FILENAME = "lists.config.json";

interface RawDefaults {
	license?: string;
	languages?: string[];
	refreshUrlBase?: string;
}

interface RawEntry {
	name?: string;
	license?: string;
	languages?: string[];
	refreshUrl?: string;
}

interface RawConfig {
	defaults?: RawDefaults;
	lists?: Record<string, RawEntry>;
}

export class ConfigError extends Error {}

export interface ListConfigTable {
	/** Resolved config for a list, keyed by its basename without `.lexdi.tsv`. */
	get(listName: string): ListConfig;
	has(listName: string): boolean;
	names(): string[];
}

export function parseConfig(source: string, origin: string): ListConfigTable {
	let raw: RawConfig;
	try {
		raw = JSON.parse(source) as RawConfig;
	} catch (error) {
		throw new ConfigError(`${origin}: ${(error as Error).message}`);
	}

	const defaults = raw.defaults ?? {};
	const entries = raw.lists ?? {};
	const resolved = new Map<string, ListConfig>();

	for (const [listName, entry] of Object.entries(entries)) {
		const name = entry.name;
		if (!name) {
			throw new ConfigError(`${origin}: list \`${listName}\` has no \`name\``);
		}

		const license = entry.license ?? defaults.license;
		if (!license) {
			throw new ConfigError(`${origin}: list \`${listName}\` has no \`license\` and no default`);
		}

		const refreshUrl = entry.refreshUrl ?? refreshUrlFor(listName, defaults.refreshUrlBase);
		if (!refreshUrl) {
			throw new ConfigError(`${origin}: list \`${listName}\` has no \`refreshUrl\` and no \`refreshUrlBase\` default`);
		}

		const languages = entry.languages ?? defaults.languages;

		resolved.set(listName, { name, license, refreshUrl, ...(languages ? { languages } : {}) });
	}

	return {
		has: (listName) => resolved.has(listName),
		names: () => [...resolved.keys()].sort(),
		get(listName) {
			const config = resolved.get(listName);
			if (!config) {
				throw new ConfigError(
					`${origin}: no configuration for list \`${listName}\` — add it to \`lists\` before publishing`,
				);
			}
			return config;
		},
	};
}

export function loadConfig(configPath: string): ListConfigTable {
	if (!fs.existsSync(configPath)) {
		throw new ConfigError(`${configPath}: missing pipeline configuration`);
	}
	return parseConfig(fs.readFileSync(configPath, "utf8"), configPath);
}

function refreshUrlFor(listName: string, base: string | undefined): string | undefined {
	if (!base) return undefined;
	return `${base.replace(/\/+$/, "")}/${listName}.lexdi`;
}
