# lexdi-wordlists

Community-contributed word lists for [Lexdi](https://lexdi.app) — jargon, coined terms, and dated slang that macOS and iOS autocorrect do not know yet.

## What's here

- `lists/` — word-list sources (`.lexdi.tsv`).
- `FORMAT.md` — the word-list file format, for contributors and for anyone building their own tooling against `.lexdi` files.
- `CONTRIBUTING.md` — how to propose a word or a list.
- `tools/wordlist-filter/` — CI tool that diffs candidate words against Apple's dictionary (macOS-only).

## Using a list in Lexdi

Open the app, go to list subscriptions, and add a list by its published URL — shown on each list's page at lexdi.app — or browse and subscribe directly from [lexdi.app/lists](https://lexdi.app/lists).

## Browsing lists

Rendered, human-readable versions of every list are at [lexdi.app/lists](https://lexdi.app/lists).

## Contributing

See `CONTRIBUTING.md`. If you're using an AI coding assistant, `AGENTS.md` has a short set of notes for it.

## Licensing

The overall license is MIT. See [LICENSE](./LICENSE.md).

Word lists are covered by the more permissive CC0 1.0 Universal, a public domain dedication. See [`lists/LICENSE.md`](./lists/LICENSE.md).
