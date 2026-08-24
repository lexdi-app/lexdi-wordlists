# Contributing to Lexdi word lists

Thank you for helping grow Lexdi's community word lists. This repo holds the source files for the lists that ship inside the Lexdi app and are browsable at [lexdi.app](https://lexdi.app).

## What this repo contains

Word lists live as `name.lexdi.tsv` files under `lists/` — tab-separated, one row per word, readable as a table directly in a GitHub diff. You never need to touch the compiled `.lexdi` JSON files; those are built from the TSV sources when a list is published. `FORMAT.md` is the full format reference.

## Contributing a word

1. **Find or propose a list.** Add your word to an existing `lists/*.lexdi.tsv` file, or propose a new list under `lists/community/` if it does not fit an existing category.
2. **Edit the TSV.** Add a row. Only `word` and `action` are required, and `action` is almost always `add`; `definition`, `source`, and `added` are optional. Keep rows sorted case-insensitively by `word`, which keeps your diff small and easy to review. The full column rules are in `FORMAT.md`.
3. **What gets merged.** Words should be genuinely novel vocabulary — technical jargon, coined terms, dated slang — rather than words already in common use. Continuous integration checks new words against the dictionary built into macOS and reports what it found on your pull request. A word the system dictionary already knows is not an automatic rejection, since it may still be worth listing for its definition, but a reviewer may ask about it.
4. **Open a pull request.** Checks run automatically: formatting, sort order, duplicates, and the dictionary comparison above, with the results reported on your pull request. If your branch lives in this repository, sort-order and whitespace problems are fixed for you and the fix is pushed back to your branch. If you are working from a fork, the check fails instead with instructions, because the automation cannot push to a fork's branch.
5. **Review and merge.** A maintainer reviews your pull request and applies the `approved-to-ship` label. From there everything is automatic: the pull request merges and the updated list is published. Nothing further is needed from you, and there is nothing to run locally.

## Proposing a new list

A new list is a new `lists/community/<name>.lexdi.tsv` file with a header row and at least one word. Say in the pull request what the list is for and who would subscribe to it. Lists that overlap heavily with an existing one are usually better as additions to that list.

## Your contribution is CC0

By contributing a word or a word list here, you are dedicating that contribution to the public domain under `lists/LICENSE.md` (CC0 1.0 Universal). This keeps the lists maximally reusable — by Lexdi, by other dictionary and autocorrect tools, by anyone. Any code contributed here is MIT instead; see the root `LICENSE.md`.

## Communicating

Open an issue to ask a question, propose a list before writing it, or report something wrong in an existing list. Pull request review comments are the place for discussion about a specific change. Please keep one logical change per pull request — one list, or a small related batch of words — which makes review quick and keeps a problem in one word from holding up the rest.

## Code of conduct

See `CODE_OF_CONDUCT.md`.

## Using an AI coding assistant?

See `AGENTS.md` for a short set of notes aimed at automated tooling — which files to edit, what the publishing pipeline fills in on its own, and pull request conventions.
