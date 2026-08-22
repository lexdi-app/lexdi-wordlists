# Notes for AI coding assistants

This repo holds the sources for Lexdi's public word lists. If you are an AI assistant helping someone open a pull request here, read `CONTRIBUTING.md` and `FORMAT.md` first — this file only adds the points that are specific to automated tooling and are not obvious from scanning the repo.

## Edit the source, not the compiled output

Edit `lists/**/*.lexdi.tsv` only. Never hand-write or hand-edit a `.lexdi` JSON file in a pull request. Those artifacts are compiled from the TSV sources by the publishing pipeline, and they are not checked in here. If a task appears to call for producing `.lexdi` JSON directly, it almost certainly means the authoring TSV instead.

## The pipeline fills in `_meta_`, not you

A published `.lexdi` artifact carries a `_meta_` object with fields such as `version`, `last_modified`, `refreshUrl`, and `license`. These are stamped when the pipeline builds the artifact. They have no place in a `.lexdi.tsv` source file, and adding them to one is not a fix for anything.

## What is checked, and what is fixed for you

Sort order and basic formatting are behavior contracts rather than suggestions. On a pull request from a branch in this repository, the automation fixes them and pushes the fix back to the branch — so do not race it by manually re-sorting after a check reports a problem; let it push its own commit. On a pull request from a fork, the automation cannot push to the branch, so the check fails with instructions and the contributor re-sorts and re-pushes.

Checked but never fixed automatically:

- A `word` value repeating within one list, compared case-insensitively. This is a compile error; pick one row.
- New words against the dictionary built into macOS, reported as a comment on the pull request. This is not a hard rejection — see `CONTRIBUTING.md`.
- Large removals from an existing list, which are flagged for a maintainer rather than merged automatically.

## Pull request and merge conventions

One logical change per pull request — one list, or a small related batch of words.

The `approved-to-ship` label is applied by a maintainer only. Never apply it to a pull request you are working on, and never instruct a human to apply it to their own. The label is what records that maintainer review actually happened, so self-applying it defeats its only purpose.

Once the label is applied, merge and publish are automatic. No follow-up command, deploy step, or manual trigger is expected from a contributor.

## Contributions are CC0

Word-list contributions here are dedicated to the public domain under CC0 on merge. No attribution line, copyright header, or authorship note belongs in a list file or a pull request description.

## Out of scope for this repo

This repo is word-list sources only. The Lexdi app, the tool that runs the system-dictionary comparison, and the internals of the publish pipeline live elsewhere and are not relevant to a contribution here. If a task seems to require changing one of them, it does not belong in this repo — say so rather than working around it.
