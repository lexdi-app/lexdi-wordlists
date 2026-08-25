# wordlist-filter

Diffs candidate word lists against Apple's current dictionary so official Lexdi lists publish only words the system does not already know. The verdict comes from `NSSpellChecker` — the same AppleSpell engine the shipping app uses — which is why this tool is macOS-only and why any CI job running it needs a macOS runner.

Results depend on the dictionary shipped with a given macOS release, so they are cached per OS version rather than treated as stable facts.

## Usage

```bash
swift build --package-path tools/wordlist-filter
wordlist-filter --input <file> --os-version <version> --output-dir <path> [--language en_US]
```

| Flag | Required | Meaning |
|---|---|---|
| `--input` | yes | Word list to classify. Format is chosen by extension. |
| `--os-version` | yes | The macOS release the run reflects, e.g. `macos-27.0`. Recorded in the stdout summary; the caller composes any published directory path from it. |
| `--output-dir` | yes | Directory receiving the three output files. Created if absent. |
| `--language` | no | Dictionary language, default `en_US`. Pinning it keeps CI results reproducible across machines with different preferred languages. |

The intended published layout in the wordlists repository is `filtered/<os-version>/<list>.already-known.txt`; this tool writes into `--output-dir` and leaves that path composition to its caller.

## Input formats

A `.tsv` input is parsed as the wordlists repository's `.lexdi.tsv` source format. Lines beginning with `#` are comments and blank lines are skipped. A header row is required, and column identity is read from that header rather than assumed positionally, so a list may order columns freely and omit optional ones. Only rows whose `action` is `add` are candidates: `exclude` rows are retractions, and `include` rows hold a list reference in the `word` column rather than a word. A list with no `action` column at all treats every row as an addition.

Any other extension is parsed as plain text, one word per line, skipping blank lines and `#` comments.

## Classification

Each candidate lands in exactly one bucket, with the checker pinned to `--language`.

**already-known** — `checkSpelling(of:startingAt:language:…)` reports no misspelling. Apple already recognizes the word, so publishing it would add nothing.

**missing** — not recognized, with no near-miss signal. This is the ship-worthy novel vocabulary.

**flagged-for-review** — not recognized as written, but a deterministic near-miss signal says a maintainer should look before the word ships. Two signals fire, in this order:

- `case-variant` — a simple case variant of the word (capitalized-first-letter, or all-lowercase) IS recognized. `kubernetes` flags because Apple knows `Kubernetes`.
- `top-guess-case-insensitive` — the first result of `guesses(forWordRange:in:language:inSpellDocumentWithTag:)` equals the word ignoring case. `iphone` flags with the suggestion `iPhone`.

The firing signal and its suggestion are recorded per entry. The rule lives in a single function in `Sources/WordlistFilter/Classifier.swift` so that tuning what earns review is a one-place change.

## Output

Three files land in `--output-dir`, named for the input's list name (its basename minus `.lexdi.tsv` or its extension):

| File | Contents |
|---|---|
| `<list>.missing.txt` | One word per line, original casing preserved, sorted case-insensitively. |
| `<list>.already-known.txt` | Same shape, for words Apple already knows. |
| `<list>.flagged-for-review.json` | Array of `{word, signal, suggestion}` objects, keys in stable order, entries sorted case-insensitively by word. |

A one-line summary of the per-bucket counts goes to stdout.

Classification is not a gate: the tool exits 0 whatever the buckets contain. A nonzero exit means an operational failure — unreadable input, a malformed list, or an unwritable output directory.

## Tests

```bash
swift test --package-path tools/wordlist-filter
```

Spell checking sits behind the `SpellChecking` protocol, so parsing, classification, and output formatting are tested against a mock dictionary. The tests do not exercise `NSSpellChecker` itself.
