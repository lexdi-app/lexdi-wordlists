import Testing

@testable import WordlistFilter

@Suite struct OutputWriterTests {
	@Test func sortsCaseInsensitively() {
		let sorted = OutputWriter.sortedCaseInsensitively(["zebra", "Apple", "banana"])
		#expect(sorted == ["Apple", "banana", "zebra"])
	}

	@Test func preservesOriginalCasing() {
		#expect(OutputWriter.plainTextBody(["RLHF"]) == "RLHF\n")
	}

	@Test func emitsEmptyBodyForNoWords() {
		#expect(OutputWriter.plainTextBody([]).isEmpty)
	}

	@Test func flaggedJSONSortsEntriesAndKeys() throws {
		let flagged = [
			Classification(word: "zeta", bucket: .flaggedForReview, signal: .caseVariant, suggestion: "Zeta"),
			Classification(
				word: "alpha",
				bucket: .flaggedForReview,
				signal: .topGuessMatchesCaseInsensitively,
				suggestion: "Alpha"
			),
		]
		let json = try OutputWriter.flaggedJSON(flagged)
		let alphaIndex = try #require(json.range(of: "alpha")).lowerBound
		let zetaIndex = try #require(json.range(of: "zeta")).lowerBound
		#expect(alphaIndex < zetaIndex)

		let signalIndex = try #require(json.range(of: "\"signal\"")).lowerBound
		let suggestionIndex = try #require(json.range(of: "\"suggestion\"")).lowerBound
		let wordIndex = try #require(json.range(of: "\"word\"")).lowerBound
		#expect(signalIndex < suggestionIndex)
		#expect(suggestionIndex < wordIndex)
	}

	@Test func flaggedJSONIsStableAcrossRuns() throws {
		let flagged = [
			Classification(word: "beta", bucket: .flaggedForReview, signal: .caseVariant, suggestion: "Beta")
		]
		#expect(try OutputWriter.flaggedJSON(flagged) == (try OutputWriter.flaggedJSON(flagged)))
	}

	@Test func stripsCompoundLexdiSuffix() {
		#expect(OutputWriter.listName(forInputPath: "/lists/2026-ai.lexdi.tsv") == "2026-ai")
	}

	@Test func stripsPlainTextExtension() {
		#expect(OutputWriter.listName(forInputPath: "/tmp/candidates.txt") == "candidates")
	}

	@Test func bucketsClassificationsByOutcome() {
		let results = Results([
			Classification(word: "hello", bucket: .alreadyKnown, signal: nil, suggestion: nil),
			Classification(word: "agentification", bucket: .missing, signal: nil, suggestion: nil),
			Classification(word: "kubernetes", bucket: .flaggedForReview, signal: .caseVariant, suggestion: "Kubernetes"),
		])
		#expect(results.alreadyKnown == ["hello"])
		#expect(results.missing == ["agentification"])
		#expect(results.flagged.count == 1)
	}
}
