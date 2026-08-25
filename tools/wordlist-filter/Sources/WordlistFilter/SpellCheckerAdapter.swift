#if canImport(AppKit)
	import AppKit

	/// Routes `NSSpellChecker` through the protocol classification depends on.
	struct SpellCheckerAdapter: SpellChecking {
		func recognizes(_ word: String, language: String) -> Bool {
			let checker = NSSpellChecker.shared
			let range = checker.checkSpelling(
				of: word,
				startingAt: 0,
				language: language,
				wrap: false,
				inSpellDocumentWithTag: 0,
				wordCount: nil
			)
			return range.length == 0
		}

		func topGuess(for word: String, language: String) -> String? {
			let checker = NSSpellChecker.shared
			let range = NSRange(location: 0, length: word.utf16.count)
			return checker.guesses(
				forWordRange: range,
				in: word,
				language: language,
				inSpellDocumentWithTag: 0
			)?.first
		}
	}
#endif
