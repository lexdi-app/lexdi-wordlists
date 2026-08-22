# The Lexdi word list format

The format specification for Lexdi word lists: the human-authored `.lexdi.tsv` source format used in this repo, the published `.lexdi` JSON format, the compilation pipeline between them, and how Lexdi stores a user's own lists and subscriptions in that same format. Read this to write a conforming contribution, or to publish your own `.lexdi` files elsewhere.

For how to open a pull request against this repo, see `CONTRIBUTING.md`.

## 1. Two formats: authoring vs. published

Word lists exist in two forms:

- **Authoring format — `name.lexdi.tsv`.** Tab-separated, one row per line, hand-edited in this repo or in any text editor. This is the format a pull request diff shows.
- **Published format — `name.lexdi`.** JSON, conforming to the schema in §3. This is what the app fetches, subscribes to, and validates. The publish pipeline compiles `.lexdi.tsv` sources into `.lexdi` artifacts (§4).

Third parties have two ways to produce a valid `.lexdi` file: hand-write JSON against the published schema, or author `.lexdi.tsv` and run the published converter, distributed as a release artifact alongside the dictionary-comparison tool.

### File extension & OS integration

**`.lexdi` is reserved as Lexdi's extension** for published artifacts — an exported UTType conforming to `public.json` (text editors still open it; Finder/Files show a Lexdi document icon). Tapping or downloading a `.lexdi` file opens Lexdi via an import/subscribe flow — the Calendar/`.ics` pattern; Lexdi is a shelf app with an import handler, **not a document-based app** (no NSDocument/UIDocument).

OS type routing binds on the **final** path extension only, so compound names like `list.lexdi.json` would route to generic JSON handlers instead of Lexdi. Compound extensions are used exactly where routing is irrelevant — repo sources, `name.lexdi.tsv` — and never for published artifacts, which always end in the bare `.lexdi` extension.

## 2. Authoring format: `name.lexdi.tsv`

### Column schema

```tsv
word	action	definition	source	added
agentification	add	The process of restructuring a task or workflow to be executable by an autonomous AI agent.	https://example.com/agentification	2026-07-23
RLHF	add	Reinforcement Learning from Human Feedback.	https://en.wikipedia.org/wiki/RLHF	2026-07-20
```

Rules:

- **Header row required**, exact column names, tab-separated. Column order and presence are read from the header, not positionally assumed — a list can omit optional columns entirely.
- **Only `word` and `action` are required.** `definition`, `source`, `added` are optional and may be blank (empty string between tabs) or the column omitted entirely from the header for lists that don't track it.
- **`action`** is `add`, `exclude`, or `include` (compilation in §4, include semantics in §5). If the `action` column is entirely absent from the header, every row is treated as `add` — the simplest valid list is just a header of `word`.
- **`added`** is `YYYY-MM-DD`, the date the word entered *this list* (not when Lexdi ingested it) — lets a versioned list (e.g. "Yearly Slang") be self-describing about vintage without needing it encoded only in the filename.
- **Lines starting with `#`** (before any tab) are comments — inert, skipped by the parser, never load-bearing. Blank lines are skipped.
- Word matching for effective-set computation (§6) is case-normalized for the lookup key only; the `word` value's original casing is preserved for the actual dictionary-learn call (e.g. `RLHF` stays uppercase).

### Sorting and deduplication

Rows should be kept sorted case-insensitively by `word` (with `include` rows conventionally grouped, per the composing-list example below) — this keeps pull request diffs minimal, since an appended word lands next to its alphabetical neighbors rather than always at file end. Sort order and deduplication are contributor behavior contracts, not lint suggestions: for a pull request from a branch in this repository, the automated check fixes sort order and pushes the fix back to the contributor's branch; for a pull request from a fork, where the automation cannot push to the contributor's branch, the check instead fails with instructions for the contributor to re-sort and re-push.

A `word` value must not repeat within a single source file (case-insensitive). Two rows for the same word in one file is a compile error — pick one `action` and one set of metadata. This does not apply across files: the same word may legitimately appear in multiple lists (an official list's `add` and the same word's `exclude` in a different, later-ordered list is the whole point of the ordering algorithm, §6).

### Full example: the official-list topology

Official Lexdi lists compose via include-by-reference (§5) rather than each carrying every word directly. A user subscribing to "All" gets everything; a user who only wants AI terms subscribes to `2026-ai.lexdi` directly.

`2026-ai.lexdi.tsv` — a leaf list, real words:

```tsv
# Lexdi word list: 2026 AI Terms
# Official Lexdi list — only includes words missing from Apple's system dictionary as of the date below.
# Filter check: macOS 27.0 / iOS 27.0, 2026-07-20
word	action	definition	source	added
agentification	add	Restructuring a task or workflow to be executable by an autonomous AI agent.		2026-07-23
RLHF	add	Reinforcement Learning from Human Feedback.	https://en.wikipedia.org/wiki/Reinforcement_learning_from_human_feedback	2026-07-20
subagent	add	A sub-task-scoped AI agent spawned and supervised by a parent agent.		2026-07-20
tokenizer	add			2026-07-20
```

`2026-slang.lexdi.tsv` — another leaf list, real words:

```tsv
word	action	definition	source	added
brainrot	add	Content perceived as low-value or eroding attention/cognition through overconsumption.		2026-03-11
```

`2026-all.lexdi.tsv` — a composing list, no words of its own, just includes:

```tsv
# Lexdi word list: 2026 All — combines the year's official leaf lists
word	action
2026-ai.lexdi	include
2026-slang.lexdi	include
```

`all.lexdi.tsv` — the top-level composing list:

```tsv
# Lexdi word list: All — every official Lexdi list, every year
word	action
2026-all.lexdi	include
```

A user who only wants AI terms subscribes to `2026-ai.lexdi`; a user who wants everything subscribes to `all.lexdi`. Comment lines on leaf lists carry file-scope provenance (which OS/dictionary version the missing-word filter ran against, and when) — this applies to the whole list as generated, not to individual rows. Per-row `source` links to a definition-worthy reference when one exists (Wikipedia, an RFC, a canonical repo); leave blank when the word is self-evident or no canonical source exists.

### Definitions and sources

`definition` and `source` are optional on every row — a word-only row (just `word` and `action: add`) is a complete, valid contribution. Populate `definition` for lists that also feed the `.dictionary` Dictionary.app bundle (a separate, higher-bar build target), which needs a real gloss per word; that's a property of specific curated lists, not a format requirement imposed on every contributor. `source` is a link rather than inline prose for jargon that already has a canonical home — cheaper to write, cheaper to review.

### Accepted import formats (client-side, not repo sources)

Lexdi's importer reads, in addition to native `.lexdi`/`.lexdi.tsv`:

| Format | Handling |
| --- | --- |
| Plain one-word-per-line `.txt` | Every non-blank, non-`#`-prefixed line is treated as an `add` word, no metadata. |
| CSV | Same column schema as the authoring TSV, comma-delimited; accepted if the first row matches known column names (case-insensitive), else falls back to "first column is the word." |
| Hunspell `.dic` | First line is a word count (skipped); remaining lines are `word[/flags]` — everything from `/` onward is stripped, flags ignored. |
| macOS `LocalDictionary` (legacy plain-text) | Same handling as plain `.txt`. |

Import always produces a snapshot copied into Lexdi's own store (§7a) — none of these formats are ever treated as live subscriptions, since none besides `.lexdi` carry the metadata a subscription needs (list identity, version).

## 3. Published format: `.lexdi` JSON Schema

A `.lexdi` file is a single JSON object with a `_meta_` object and two optional sequences: **`includes`**, an ordered array of references to other lists, and **`entries`**, an array of word rows. Both are optional and may appear together — a leaf list carries `entries` alone, a purely composing list carries `includes` alone, and a document may carry both.

**One schema describes every `.lexdi` file.** Published leaf lists, published composing lists, and the files Lexdi manages on the user's behalf (the personal list, the inactive-list library, imported snapshots) are all instances of this schema. There is no separate app-private format.

Validated against this JSON Schema (draft 2020-12):

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"$id": "https://lexdi.app/schema/lexdi-v1.json",
	"title": "Lexdi word list",
	"type": "object",
	"required": ["_meta_"],
	"additionalProperties": true,
	"properties": {
		"_meta_": {
			"type": "object",
			"required": ["name", "schemaVersion"],
			"additionalProperties": true,
			"properties": {
				"name": {
					"type": "string",
					"description": "Human-readable list name, e.g. \"2026 AI Terms\". Always a plain string; localized variants go in `nameLocalized`."
				},
				"schemaVersion": {
					"type": "integer",
					"minimum": 1,
					"description": "Version of this JSON Schema the document conforms to. Currently 1."
				},
				"nameLocalized": {
					"type": "object",
					"description": "Optional map of BCP-47 language tag to localized list name. Selection walks the reader's preferred languages and matches by progressive truncation, falling back to `name` (see §3b).",
					"propertyNames": { "pattern": "^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$" },
					"additionalProperties": { "type": "string" }
				},
				"languages": {
					"type": "array",
					"description": "BCP-47 tags naming the languages this list applies to, e.g. [\"en-US\"] or [\"en-US\", \"en-GB\"]. A list may declare several. Omitting the field means unknown, never English (see §3b).",
					"items": {
						"type": "string",
						"pattern": "^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$"
					}
				},
				"version": {
					"type": "string",
					"description": "Content-level version stamp, set by the deploy pipeline. Free-form but conventionally YYYY-MM-DD or a semver-like string; used as the change signal once a fetch returns new content."
				},
				"last_modified": {
					"type": "string",
					"format": "date-time",
					"description": "ISO 8601 timestamp of the last publish that changed this artifact."
				},
				"refreshUrl": {
					"type": "string",
					"format": "uri",
					"description": "Canonical HTTPS URL this list is refreshed from. Takes precedence over the URL the file was fetched from (see §7c). Present on official and republished lists; absent on one-off hand-authored files with no live source."
				},
				"license": {
					"type": "string",
					"description": "SPDX license identifier or short license name covering this list's content, e.g. \"CC0-1.0\"."
				},
				"sourceUrl": {
					"type": "string",
					"format": "uri",
					"description": "Imported snapshots only: where this snapshot was read from. Stamped by the importing client, absent on published artifacts."
				},
				"importedAt": {
					"type": "string",
					"format": "date-time",
					"description": "Imported snapshots only: when this snapshot was taken."
				},
				"sourceVersion": {
					"type": "string",
					"description": "Imported snapshots only: the source list's `_meta_.version` at import time, if it had one. Used to detect whether a re-fetch found something newer."
				}
			}
		},
		"includes": {
			"type": "array",
			"description": "Ordered references to other lists. Index 0 is highest precedence (see §5).",
			"items": { "$ref": "#/$defs/include" }
		},
		"entries": {
			"type": "array",
			"items": { "$ref": "#/$defs/wordEntry" }
		}
	},
	"$defs": {
		"wordEntry": {
			"type": "object",
			"required": ["word", "action"],
			"additionalProperties": true,
			"properties": {
				"word": { "type": "string", "minLength": 1 },
				"action": { "type": "string", "enum": ["add", "exclude"] },
				"definition": { "type": "string" },
				"source": { "type": "string", "format": "uri" },
				"added": { "type": "string", "format": "date" }
			}
		},
		"include": {
			"type": "object",
			"required": ["ref"],
			"additionalProperties": true,
			"properties": {
				"ref": {
					"type": "string",
					"minLength": 1,
					"format": "uri-reference",
					"description": "RFC 3986 URI reference naming the list to include: a relative path resolved against this file's own base (§5), or an absolute HTTPS URL."
				}
			}
		}
	}
}
```

**Include elements are objects rather than bare strings**, so future per-include attributes can be added without a breaking schema change. `ref` is the only key defined today, and it is required.

**Reserved-but-undefined `_meta_` fields.** `icon`, `authors` (array), and `homepage` are anticipated future fields, deliberately **not** part of the schema above — only fields Lexdi actually consumes today are defined. They will be added to the schema (bumping the client's expectations only when the client gains the corresponding feature) rather than accepted speculatively; until then, a document setting them is read under the unknown-field rule below.

### 3a. Unknown fields and internal fields

**Consumers MUST ignore unknown keys everywhere — in `_meta_`, include objects, and word entries alike; keys defined by the schema stay strictly typed.** Every object in the schema sets `additionalProperties: true` for this reason — a document may carry a field this schema doesn't define, and a conforming client passes over it rather than rejecting the document. This is what makes forward compatibility possible: a client built against today's schema must still accept tomorrow's artifacts once they add a field it doesn't recognize yet, and `additionalProperties: false` would make that refusal the default behavior instead.

The same mechanism covers fields that are real and load-bearing to the *pipeline* but not part of the published contract — `sourceSha` (§4) is the current example. The pipeline validates its own artifacts against a stricter internal schema (a superset of the published one, defining these fields) before publishing; the published schema above never defines them. An official artifact may carry `sourceSha` in the wild, and a consumer reading it does exactly what it does with any other unrecognized key: ignores it.

### 3b. Language declaration and name localization

**`_meta_.languages`** declares which languages a list applies to, as an array of BCP-47 tags. An array rather than a single tag because jargon is frequently language-agnostic — a list of AI terminology is as useful in a French document as an English one. This is a claim about applicability, used to rank and section lists in Lexdi's browse UI; it does not affect what a client does when applying the list, since learned words are not language-scoped.

**A list that omits `languages` is of unknown applicability, never assumed to be English.** Clients sort such lists after all lists whose declared languages the reader can use, rather than defaulting them into any language's section.

**`_meta_.name` is required and is always a plain string** — every list has exactly one name that always resolves. **`_meta_.nameLocalized`** is an optional map from BCP-47 tag to localized name:

```json
"name": "2026 AI Terms",
"languages": ["en-US"],
"nameLocalized": {
	"en": "2026 AI Terms",
	"fr": "Termes d'IA 2026",
	"fr-CA": "Termes d'IA 2026"
}
```

Selection walks the reader's preferred languages in order and takes the first that matches a key, **matching by progressive truncation** — the exact tag first (`fr-CA`), then the language-only tag (`fr`) — and falls back to `name` when nothing matches. A publisher who ships only `fr` therefore serves a `fr-CA` reader correctly without enumerating regions.

### Example document

```json
{
	"_meta_": {
		"name": "2026 AI Terms",
		"schemaVersion": 1,
		"languages": ["en-US"],
		"version": "2026-07-20",
		"last_modified": "2026-07-20T18:04:00Z",
		"refreshUrl": "https://lexdi.app/lists/2026-ai.lexdi",
		"license": "CC0-1.0"
	},
	"entries": [
		{
			"word": "RLHF",
			"action": "add",
			"definition": "Reinforcement Learning from Human Feedback.",
			"source": "https://en.wikipedia.org/wiki/Reinforcement_learning_from_human_feedback",
			"added": "2026-07-20"
		},
		{
			"word": "agentification",
			"action": "add",
			"definition": "Restructuring a task or workflow to be executable by an autonomous AI agent.",
			"added": "2026-07-23"
		},
		{
			"word": "subagent",
			"action": "add",
			"definition": "A sub-task-scoped AI agent spawned and supervised by a parent agent.",
			"added": "2026-07-20"
		},
		{
			"word": "tokenizer",
			"action": "add",
			"added": "2026-07-20"
		}
	]
}
```

A composing list carries `includes` and no `entries`:

```json
{
	"_meta_": {
		"name": "2026 All",
		"schemaVersion": 1,
		"languages": ["en-US"],
		"version": "2026-07-20"
	},
	"includes": [
		{ "ref": "2026-ai.lexdi" },
		{ "ref": "2026-slang.lexdi" }
	]
}
```

A document may carry both. This is what the app-managed personal list looks like — two active subscriptions and the user's own words, where the file's own `entries` outrank everything it includes (§5):

```json
{
	"_meta_": {
		"name": "Personal",
		"schemaVersion": 1
	},
	"includes": [
		{ "ref": "https://lexdi.app/lists/2026-ai.lexdi" },
		{ "ref": "imported/rust-jargon.lexdi" }
	],
	"entries": [
		{ "word": "half-ass", "action": "add" },
		{ "word": "brainrot", "action": "exclude" }
	]
}
```

## 4. Compilation: `.lexdi.tsv` → `.lexdi`

The publish pipeline — running automatically on this repo, and available as a standalone converter for third parties — compiles each `name.lexdi.tsv` into `name.lexdi`:

1. **Parse** the TSV per §2's column rules. Reject on: duplicate `word` within the file, malformed `added` date, unrecognized `action` value.
2. **Row mapping — the two row kinds compile into two different arrays.**
   - A row with `action: add` or `action: exclude` becomes an element of `entries`: `{word, action, definition?, source?, added?}` — optional columns that were blank or absent are omitted from the JSON object entirely (never emitted as empty strings or `null`).
   - A row with `action: include` becomes an element of `includes`: `{"ref": "<word-column-value>"}` — the TSV's `word` column holds the reference for include rows; the compiler reads it as a URI reference, not as a dictionary word.
   - A source file with no include rows emits no `includes` key; one with no word rows emits no `entries` key. Empty arrays are not emitted.
3. **Order.** Each array preserves the relative order of its own kind of row in the source file (after the sort/dedup lint in §2 has presumably already been applied by the contributor; the compiler does not re-sort). The first include row in the file becomes `includes[0]`, the highest-precedence reference.
4. **Meta stamping.**
   - `version` = stamped by the deploy step, not the compile step (conventionally the deploy date or a release identifier) — compiling and deploying are separate pipeline stages; a compile that runs on every pull request does not by itself bump `version`.
   - `last_modified` = timestamp of the publish that produced this artifact.
   - `name`, `schemaVersion`, `refreshUrl`, `license` are supplied by pipeline configuration per list (not derived from the TSV itself).
   - `sourceSha` = SHA-256 of the raw source `.lexdi.tsv` file bytes (pre-parse, exact bytes as committed) — an internal field the pipeline's own validator schema requires (§3a), not part of the published schema.
5. **Idempotency via `sourceSha`.** Before publishing, the pipeline compares the newly computed `sourceSha` against the previously published artifact's `sourceSha`. If unchanged, the list is skipped — no new `.lexdi` is written, no new `version`/`last_modified` stamp, and the file's HTTP `ETag` stays stable (§7c). This is what makes an unrelated pull request, for example one touching a different list, a no-op deploy for this one.

Third parties hosting their own word lists produce a valid `.lexdi` file the same two ways as any other publisher (§1): run the published converter, or hand-write JSON directly against the published schema in §3. Neither path needs any integrity field — the published schema has none to compute.

## 5. Include-by-reference

A list can include other lists instead of (or alongside) carrying words directly, so users compose subscriptions from sub-lists rather than being forced into one all-or-nothing aggregate. An authoring-format row with `action: include` (word column holding the reference) compiles to an element of the published document's `includes` array, `{"ref": "<reference>"}` (§4.2).

### Reference forms and base resolution

A `ref` is an RFC 3986 URI reference, in one of two forms:

- **Absolute HTTPS URL** — a list published elsewhere. Fetched and cached under the rules in §7c, in the same per-device cache layer that serves every other URL-fetched list.
- **Relative path** — resolved against **the containing file's own RFC 3986 base**, which is:
  - the ubiquity-container root, for the app-managed `personal.lexdi` and `library.lexdi` (so `imported/rust-jargon.lexdi` names a synced snapshot, and means the same thing on every one of the user's devices);
  - **the URL the file was fetched from**, for a fetched list (so `2026-all.lexdi` including `2026-ai.lexdi` names its hosted sibling);
  - **the file's own containing folder**, for a file the user hand-opens from disk. This base exists only at the moment of arrival — see below.

### Arrival materializes local relative includes

A hand-opened file's relative refs point at siblings in a folder Lexdi does not own and will not keep. On import, therefore:

- Each referenced local sibling is itself imported, as its own snapshot under `imported/`.
- The parent's refs are rewritten to the resulting `imported/…` names, and the rewritten document is what gets stored.
- Absolute HTTPS refs pass through untouched.
- **A referenced local sibling that is not present is a hard arrival failure.** The import is refused, deterministically, with an error naming the missing file. It is not skipped, not deferred, and not imported partially.

This rewrite happens once, during import, before the document becomes a subscription. After that point a `ref` is immutable identity and is never rewritten (§7a).

### Resolution order

**`includes[0]` is the highest-precedence reference, and a file's own `entries` outrank everything it includes.** Resolution produces a flat, ordered sequence of word entries by applying a file's includes from the **last index to the first**, then the file's own `entries` last — so later application overwrites earlier verdicts, and what survives is the earliest include, or the file's own row if it has one for that word.

```
function resolveList(ref, base, visitedPath = []):
    resolved = resolveURI(ref, base)              # RFC 3986 reference resolution
    if resolved in visitedPath:
        raise CycleError(visitedPath + [resolved])   # MUST refuse, never silently break the cycle
    if length(visitedPath) >= MAX_INCLUDE_DEPTH:     # MAX_INCLUDE_DEPTH = 8
        raise DepthExceededError(resolved)

    doc = loadDocument(resolved)   # per §7c; an unfetchable remote ref yields pending-fetch, below
    if doc is PENDING_FETCH:
        return []                  # this leaf contributes nothing yet; the rest of the list still applies

    flattened = []
    for include in reversed(doc.includes):        # last index first — includes[0] applied last, so it wins
        flattened += resolveList(include.ref, baseOf(doc), visitedPath + [resolved])
    flattened += doc.entries                      # the file's own rows applied last of all
    return flattened
```

Two properties fall out structurally rather than as special cases: the personal list's own words beat every list it subscribes to, because its `entries` are applied last; and a composing list's explicit row — including an `exclude` — overrides whatever an included leaf said about that word.

The sidebar shows `includes` top to bottom with no reversal: `includes[0]` is the top entry and the most-valued list. The last-to-first application order is internal to the resolver.

### Cycles and depth

**Cycle detection is mandatory.** A list that directly or transitively includes itself MUST be refused with a clear error naming the cycle (e.g. `all.lexdi → 2026-all.lexdi → all.lexdi`) — never silently truncated or ignored. Detection compares refs after base resolution, so two spellings of the same target are recognized as one.

**Depth cap: 8 levels** of nested includes. Deep enough for any plausible taxonomy (All → 2026-All → 2026-Slang is 3 levels) with headroom; shallow enough that a runaway or misconfigured include chain fails fast with a diagnosable error instead of degrading performance quietly.

### Pending-fetch is a normal leaf state

**A remote include whose content this device has not fetched is a fetch state, not a validation failure.** The including list validates and applies normally; the unfetched leaf contributes no words yet, shows as not-yet-fetched in the UI, and retries on the ordinary refresh cadence (§7c). No error is surfaced as a document defect, and the including list is never refused on account of it.

This is the ordinary bootstrap path, not just a failure path: URL-fetched content is per-device, so a device that has just received a synced `personal.lexdi` has references to content it has not fetched yet, and every new device starts there.

The hard-failure case is narrower and local: a **missing local sibling at arrival**, described above. A local ref that cannot be resolved names a file that was supposed to be sitting right there, at the one moment the user could still supply it.

## 6. Effective-set algorithm & ordering

### Model

The effective set is computed over the single flat sequence of word entries that include resolution produces (§5), starting from `personal.lexdi`. From this point includes are already gone.

- **`add`**: this list wants `word` learned.
- **`exclude`**: this list wants `word` *never* learned, regardless of what any list applied earlier says.

There is no separate dedicated exclusions list: an exclusion is an entry with `action: exclude` inside the same personal store that also holds manually-added words.

Imported/community and official lists are expected to contain `add` entries overwhelmingly, but nothing prevents any list from shipping its own `exclude` entries (e.g. a list explicitly retiring a prior term) — the algorithm treats every list uniformly. Official lists retiring their own previously-shipped words via `exclude` can never suppress a word from Apple's built-in system dictionary — `unlearnWord` only affects previously-learned words, so an `exclude` entry is a no-op against anything Apple already knows natively.

```
function computeEffectiveSet(containerRoot):
    # §5, starting from personal.lexdi at the container root:
    # flat, ordered, includes already applied
    sequence = resolveList("personal.lexdi", containerRoot)
    effective = {}  # word -> "learn" | "exclude"

    for entry in sequence:
        # each entry unconditionally overwrites the prior verdict for its word;
        # resolution order (§5) already placed the winner last
        effective[normalizeKey(entry.word)] = entry.action

    learnedWords = { word for word, verdict in effective if verdict == "learn" }
    return learnedWords
```

Precedence needs no special-casing for exclude-versus-add: resolution order decides who writes last to a word's slot, and the last writer wins. The user's own words win because `personal.lexdi`'s `entries` are applied after everything it includes; the top list in the sidebar wins among lists because `includes[0]` is applied after the rest.

### Diffing against the previously-applied set

The dictionary write path is per-word imperative (`learnWord`/`unlearnWord`), not a set-replace, so the app tracks what it last applied and diffs:

```
function applyEffectiveSet(newSet, previousSet):
    toLearn   = newSet - previousSet
    toUnlearn = previousSet - newSet

    for word in toLearn:   spellChecker.learnWord(word)
    for word in toUnlearn: spellChecker.unlearnWord(word)

    persist(previousSet = newSet)
```

`previousSet` lives in the local, non-synced applied-state file (§7a). This runs whenever the effective set could have changed: after import, after a manual add/exclude, after a reorder of `includes`, after a refresh, after a previously-pending leaf's first successful fetch, and (macOS) after any file-watch-detected change to a synced file.

### UI-triggering actions

- **"Add word"** → writes an `add` entry to `personal.lexdi`'s `entries` → recompute → learn.
- **"Exclude this word that list X added"** → writes an `exclude` entry to `personal.lexdi`'s `entries` (not to list X, which may be read-only) → recompute (the personal file's own `entries` are applied after every list it includes, so this wins regardless of X's position) → unlearn if it was previously learned.
- **Activating or deactivating a list** → moves its include element between `personal.lexdi`'s and `library.lexdi`'s `includes` arrays (§7a).
- **Reordering lists** → reorders `personal.lexdi`'s `includes` array.

## 7. Client validation & apply

Fetched or imported `.lexdi` content is applied under one deterministic rule: **schema-valid → apply fully; any failure → apply nothing, keep last-good.** There is no partial-apply heuristic and no on-device review queue.

```
function validateAndApply(fetchedDoc, lastGoodDoc):
    if not schemaValid(fetchedDoc):
        return keepLastGood(reason: "schema validation failed")

    applyFully(fetchedDoc)   # includes exclude-driven removals — no exceptions
    return applied(fetchedDoc)
```

**Validation judges a document against its own declared `_meta_`, and nothing else.** In particular, the reachability of the lists a document includes is not a validation input: a document whose includes name content this device has not fetched is valid and applies, with those leaves in pending-fetch (§5).

**There is no client-side shrink heuristic** — no "list dropped >50%, hold back removals for review". A bad or truncated deploy is caught upstream, at the source, by this repo's shrink-gate check, which requires an explicit intentional-removals override on a pull request that removes a large fraction of a list; by the time a `.lexdi` artifact is published and fetchable, its content has already passed that human-judgment gate once. The client's job is narrower and fully mechanical: does this artifact parse as JSON and validate against the published schema. Truncated content fails JSON parse outright. What schema validity alone cannot catch — a publisher shipping wrong-but-internally-consistent content — is the shrink-gate's job, not the client's.

### 7a. Synced store layout

Lexdi's own data rides an iCloud Drive ubiquity container, holding:

```
personal.lexdi              # the user's own words, plus the active lists in `includes`
library.lexdi               # the known-but-inactive lists — `includes` only, never resolved
imported/
  rust-jargon.lexdi          # third-party snapshots — these DO sync,
  …                          # since a local import has no re-fetchable URL for other devices
```

**Every file here is an ordinary `.lexdi` document** conforming to the schema in §3. There is no separate subscription manifest and no app-private format: subscription state is the `includes` array of `personal.lexdi`, using the same composition mechanism a published composing list uses.

- **`personal.lexdi`** — `includes` holds one element per active list, `includes[0]` highest precedence; `entries` holds the user's own `add`/`exclude` rows. Because a file's own `entries` are applied after everything it includes (§5), the user's words win without any pinning rule.
- **`library.lexdi`** — `includes` only, no `entries`. Nothing in it is ever resolved during apply; the app reads it to populate the inactive section of the UI. **Activation and deactivation are one operation: move an element between the two files' `includes` arrays.**
- **`imported/<name>.lexdi`** — snapshot content, named by container-relative `ref`. Each snapshot carries its own provenance in its `_meta_`: `sourceUrl`, `importedAt`, `sourceVersion` (the source list's `_meta_.version` at import time, if it had one, used to detect whether a re-fetch found something newer). Provenance lives in the snapshot because it is a fact about the snapshot — it survives the include element moving between the two files.

**The app-managed files carry only the schema-required `_meta_` fields**, `name` and `schemaVersion`; other `_meta_` fields are omitted, since nothing in the published schema needs stamping on a file the app itself writes and never fetches.

**A `ref`, once written, is immutable.** It is never rewritten in place — not when the referenced list redirects, and not when the fetched file's `_meta_.refreshUrl` names a different URL (§7c). Two reasons: conflict merges key `includes` elements on `ref` (§7b), so rewriting one while another device syncs the old value yields two elements for one subscription; and the per-device fetch cache is keyed on `ref`, so a rewrite would orphan the cached content. The one rewrite that does happen is at arrival, before the document is a subscription at all (§5).

**URL-fetched content is never stored in the synced container.** An include element carries only its `ref`; each device fetches and caches that content itself in **one per-device cache layer serving all URL-fetched lists, official and foreign alike**, keyed by `ref` (§7c). Tier governs refresh cadence, never storage location.

**Content home follows the ref form: relative ref = synced content, URL ref = cached content.** This is the one rule relating the two stores, and it holds even for an `imported/` snapshot whose `_meta_` carries a `refreshUrl` (§7c) — that snapshot is relpath-subscribed regardless, so a refresh is a single fetch that rewrites the `imported/` file in place, reaching every device through the ordinary sync of that file rather than through a per-device fetch into the cache.

**Local applied-state file** (per-device, not synced — living alongside the ubiquity container rather than inside it). Per-device fetch/apply state must not sync, since it describes one device's own history against its own spell-check store:

```json
{
	"previousSet": ["agentification", "RLHF", "tokenizer", "…"],
	"lists": {
		"https://lexdi.app/lists/2026-ai.lexdi": {
			"lastChecked": "2026-07-24T09:00:00Z",
			"lastApplied": "2026-07-24T09:00:00Z",
			"etag": "\"a1b2c3\""
		}
	}
}
```

Keys are the `ref` values of the include elements the state belongs to. `lastChecked` can be newer than `lastApplied` — a check can find nothing new (`304 Not Modified`, §7c) without applying anything. A `ref` with no entry here has never been successfully fetched on this device: that is the pending-fetch state (§5), which is where every list on a newly-set-up device starts.

### 7b. Conflict semantics

`personal.lexdi`, `library.lexdi`, and each file under `imported/` are JSON, written only by the app (never hand-edited in place — "export as TSV" and the CLI cover hand-editing). iCloud Drive syncs whole files — no partial sync, no line-level merging — so a genuine two-device race surfaces as two *complete* `NSFileVersion` conflict versions, and the app reconciles them itself rather than relying on iCloud's default last-writer-wins-per-file behavior:

```
function mergeConflictVersions(versionA, versionB):
    docA = parse(versionA)
    docB = parse(versionB)

    mergedEntries = {}   # (word, action) -> entry, keeping the newer one
    for entry in docA.entries + docB.entries:
        key = (entry.word, entry.action)
        if key not in mergedEntries or entry.timestamp > mergedEntries[key].timestamp:
            mergedEntries[key] = entry

    mergedIncludes = {}  # ref -> include element, keeping the newer one
    for include in docA.includes + docB.includes:
        key = include.ref
        if key not in mergedIncludes or include.timestamp > mergedIncludes[key].timestamp:
            mergedIncludes[key] = include

    write(canonicalDocument(mergedIncludes.values(), mergedEntries.values()))
```

Union merge on both sequences — `entries` keyed by `(word, action)`, `includes` keyed by `ref` — newest timestamp winning in each case. It resolves per-element rather than picking one whole file over the other, and append-mostly data makes it nearly trivial. **Keying `includes` on `ref` is what makes `ref` immutable** (§7a): a rewritten `ref` merging against its own old value would produce two elements where the user has one subscription.

Atomic write-to-temp-rename means half-written files don't occur, so there's no corruption case to design around beyond the conflict-version reconciliation itself. The worst realistic outcome of a race is one word temporarily missing from the effective set until the merge pass completes and the next `applyEffectiveSet` (§6) restores it. The one case the union cannot settle mechanically is a list activated on one device and deactivated on another in the same window: its element surfaces in both merged files, and the newer of the two decides which file keeps it.

### 7c. Fetching and refresh

**Effective refresh URL.** A list refreshes from its own **`_meta_.refreshUrl` when it declares one, and otherwise from the URL it was fetched from.** Where the two differ, the file wins: `refreshUrl` is the publisher's statement about where the list lives, while the include element's `ref` records only how this user first reached it. Divergence never rewrites the `ref` (§7a); a stale bootstrap URL heals through ordinary HTTP redirects, and one that does not leaves the leaf in pending-fetch (§5) with resubscribing as the remedy.

**Where a refresh writes follows the include element's ref form, not the presence of a refresh URL.** A URL-ref list's refresh fetches into the per-device cache (below). A relative-ref list's refresh — including an `imported/` snapshot whose `_meta_` declares a `refreshUrl` — fetches once and rewrites the synced `imported/` file in place, so the new content reaches every device through the same sync that carries the rest of the ubiquity container, never through a per-device fetch. A snapshot with a `refreshUrl` is refreshable but remains relpath-subscribed; the two facts coexist without changing which store holds its content (§7a).

**Refresh trigger by tier.** A list published from a `lexdi.app` effective refresh URL is official and refreshes automatically. Any other domain refreshes only on the user's explicit "Check for updates". A snapshot with no effective refresh URL at all has no update path but re-import. The trust tier is read off the effective refresh URL's domain and nothing else — including for a list that arrived as a hand-opened file.

- **The effective refresh URL points directly at the `.lexdi` file** — no indirection at the HTTP layer; a `GET` returns the current published artifact.
- **Fetch scheduling** — macOS: the resident sync-apply app checks on a periodic timer while running (e.g. once per launch plus every N hours) plus on explicit user request. iOS: foreground apply (rate-limited, e.g. once per 6–12h) is the always-works baseline; a Settings toggle opts into `BGAppRefreshTask` background refresh, with the corresponding permission requested at toggle time — no background fetch unless the user has opted in.
- **One cache layer, per-device, for all URL-fetched content.** Official and foreign lists share it; entries are keyed by the include element's `ref` and never sync. Each device fetches independently and applies its own diff, because the canonical source is the URL rather than another device's copy. The synced files carry references only; `lastChecked`/`lastApplied`/`etag` live in the local, non-synced applied-state file (§7a).
- **Conditional fetch**: standard HTTP `ETag`/`If-None-Match`, using the locally-cached `etag` — a `304 Not Modified` skips a full re-download, re-validation, and re-diff on the common no-change case. The pipeline's `sourceSha` idempotency (§4.5) keeps `ETag`s stable across no-op deploys, so an unrelated list's publish never invalidates this list's cache.
- **Content-level change signal**: `_meta_.version`, checked once a fetch does return new content (past any `304`) — the value that "Check for updates" and the refresh diff key off of.
- **A list not yet in the cache is in pending-fetch** (§5), which is a state, not an error: the rest of the including list applies, and the leaf retries on the normal cadence.
- **Transport security**: HTTPS. No content-signing beyond TLS — the threat model for a wrong word list is low-severity and self-correcting (worst case: a bad word gets learned, one tap to exclude), and TLS already rules out the realistic threats (MITM, DNS spoofing).

### 7d. Fail-safe refresh

Lists fail safe: refresh never blocks or breaks the app, and the app always functions on whatever content it last successfully applied.

- **A refresh failure is never user-blocking.** It never shows a modal, never delays app startup or word lookup, never removes previously-learned words. The last-applied content for that list stays in effect until a refresh actually succeeds.
- **Errors surface quietly** — a status line in the list-management UI (e.g. "AI Terms — last refreshed 2026-07-20, last checked 2026-07-24 — unreachable") rather than an alert or modal. The user can always see how stale a list is, but is never interrupted by staleness.
- **Retries happen on the next scheduled check** (§7c's normal cadence) — no special backoff/retry loop beyond just trying again next time, since a failed check has zero user-facing cost to leave alone until then.
- **Offline / fetch fails**: no-op — keep the last-applied content untouched, retry next scheduled check.
- **URL gone / persistently unreachable**: same short-term behavior as offline. A permanently-dead URL simply means a permanently-stale list with a visible "last refreshed" date — there is no auto-unsubscribe. (If unreachable past a long threshold, e.g. 30 days, the status line's tone can shift from "unreachable" to "broken," but the list stays subscribed and its last-known content stays applied either way.)
- **Content fails validation** (§7's schema check): treated identically to a fetch failure — apply nothing, keep last-good, quiet status line. There is no partial apply and no client-side shrink heuristic.
- **Unfetchable remote include** (§5): the including list applies normally and the leaf sits in pending-fetch, shown as not-yet-fetched and retried on the normal cadence. This is a fetch state rather than a document defect, so the including list is never refused on account of it.
- **Missing local sibling at arrival** (§5) is the one deterministic hard failure in this area: the import is refused with an error naming the missing file, because the user is at the import sheet with the folder in front of them and a partially-imported list could never become complete.

## 8. Missing-words-only provenance

Which words go in an official list is decided by the dictionary-comparison tool when the list is built, not re-derived at apply time by this format. The format's role is recording that decision:

- File-scope comment lines in the authoring TSV (§2) record which OS/dictionary version the missing-word check ran against and when — a property of the list as generated, not of any individual row. This context does not carry into the published JSON as a structured field; it stays a source-level comment, since it documents how the list was generated rather than something the client needs to act on.
- If Apple later ships a word already present in a list, this is harmless — a `learnWord` call on an already-known word is a no-op. Lists are not retroactively edited to remove such words; a future generation of the same list simply omits it going forward.

---

The standalone TSV→JSON converter ships as a release artifact alongside the dictionary-comparison tool; its distribution mechanics are a repository concern rather than a format one and are not specified here.
