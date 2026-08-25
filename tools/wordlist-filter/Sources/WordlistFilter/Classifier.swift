import Foundation

/// The spell-check surface classification needs, narrow enough to mock in tests.
protocol SpellChecking: Sendable {
	func recognizes(_ word: String, language: String) -> Bool
	func topGuess(for word: String, language: String) -> String?
}

enum Bucket: String, Sendable {
	case alreadyKnown = "already-known"
	case missing
	case flaggedForReview = "flagged-for-review"
}

/// Why a maintainer should look at a word the dictionary does not recognize as-is.
enum NearMissSignal: String, Sendable {
	case caseVariant = "case-variant"
	case topGuessMatchesCaseInsensitively = "top-guess-case-insensitive"
}

struct Classification: Sendable {
	let word: String
	let bucket: Bucket
	let signal: NearMissSignal?
	let suggestion: String?
}

struct Classifier: Sendable {
	let checker: any SpellChecking
	let language: String

	func classify(_ word: String) -> Classification {
		if checker.recognizes(word, language: language) {
			return Classification(word: word, bucket: .alreadyKnown, signal: nil, suggestion: nil)
		}
		if let nearMiss = nearMiss(for: word) {
			return Classification(
				word: word,
				bucket: .flaggedForReview,
				signal: nearMiss.signal,
				suggestion: nearMiss.suggestion
			)
		}
		return Classification(word: word, bucket: .missing, signal: nil, suggestion: nil)
	}

	/// The near-miss rule, deliberately the single point of change for tuning what earns review:
	/// a recognized simple case variant, or a top guess equal to the word ignoring case.
	private func nearMiss(for word: String) -> (signal: NearMissSignal, suggestion: String)? {
		for variant in caseVariants(of: word) where checker.recognizes(variant, language: language) {
			return (.caseVariant, variant)
		}
		if let guess = checker.topGuess(for: word, language: language),
			guess.compare(word, options: .caseInsensitive) == .orderedSame
		{
			return (.topGuessMatchesCaseInsensitively, guess)
		}
		return nil
	}

	private func caseVariants(of word: String) -> [String] {
		let lowercased = word.lowercased()
		let capitalized = lowercased.isEmpty ? lowercased : lowercased.prefix(1).uppercased() + lowercased.dropFirst()
		return [capitalized, lowercased].filter { $0 != word }
	}
}
