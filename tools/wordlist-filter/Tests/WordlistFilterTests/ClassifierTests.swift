import Testing

@testable import WordlistFilter

/// Fixed dictionary and guess table, so classification is asserted without NSSpellChecker.
struct MockChecker: SpellChecking {
	var known: Set<String> = []
	var guesses: [String: [String]] = [:]

	func recognizes(_ word: String, language: String) -> Bool { known.contains(word) }
	func topGuess(for word: String, language: String) -> String? { guesses[word]?.first }
}

@Suite struct ClassifierTests {
	private func classifier(_ checker: MockChecker) -> Classifier {
		Classifier(checker: checker, language: "en_US")
	}

	@Test func recognizedWordIsAlreadyKnown() {
		let result = classifier(MockChecker(known: ["hello"])).classify("hello")
		#expect(result.bucket == .alreadyKnown)
		#expect(result.signal == nil)
	}

	@Test func unrecognizedWordWithNoNearMissIsMissing() {
		let result = classifier(MockChecker()).classify("agentification")
		#expect(result.bucket == .missing)
		#expect(result.suggestion == nil)
	}

	@Test func recognizedCapitalizedVariantFlagsForReview() {
		let result = classifier(MockChecker(known: ["Kubernetes"])).classify("kubernetes")
		#expect(result.bucket == .flaggedForReview)
		#expect(result.signal == .caseVariant)
		#expect(result.suggestion == "Kubernetes")
	}

	@Test func recognizedLowercaseVariantFlagsForReview() {
		let result = classifier(MockChecker(known: ["widget"])).classify("WIDGET")
		#expect(result.bucket == .flaggedForReview)
		#expect(result.signal == .caseVariant)
		#expect(result.suggestion == "widget")
	}

	@Test func topGuessEqualIgnoringCaseFlagsForReview() {
		let checker = MockChecker(guesses: ["iphone": ["iPhone", "phone"]])
		let result = classifier(checker).classify("iphone")
		#expect(result.bucket == .flaggedForReview)
		#expect(result.signal == .topGuessMatchesCaseInsensitively)
		#expect(result.suggestion == "iPhone")
	}

	@Test func unrelatedTopGuessDoesNotFlag() {
		let checker = MockChecker(guesses: ["agentification": ["magnification"]])
		#expect(classifier(checker).classify("agentification").bucket == .missing)
	}

	@Test func caseVariantSignalWinsOverTopGuess() {
		let checker = MockChecker(known: ["Kubernetes"], guesses: ["kubernetes": ["kubernetes"]])
		#expect(classifier(checker).classify("kubernetes").signal == .caseVariant)
	}
}
