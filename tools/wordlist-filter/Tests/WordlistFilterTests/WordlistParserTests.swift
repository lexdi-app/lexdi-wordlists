import Testing

@testable import WordlistFilter

@Suite struct WordlistParserTests {
	@Test func skipsCommentsAndHeaderAndKeepsOnlyAddRows() throws {
		let tsv = """
			# Lexdi word list: 2026 AI Terms
			word\taction\tdefinition\tsource\tadded
			agentification\tadd\tA definition.\t\t2026-07-23
			retracted\texclude\t\t\t2026-07-24
			"""
		#expect(try WordlistParser.parseTSV(tsv) == [Candidate(word: "agentification")])
	}

	@Test func skipsIncludeRowsBecauseTheWordColumnHoldsAListReference() throws {
		let tsv = """
			word\taction
			https://lexdi.app/lists/2026-ai.json\tinclude
			realword\tadd
			"""
		#expect(try WordlistParser.parseTSV(tsv) == [Candidate(word: "realword")])
	}

	@Test func readsColumnsByHeaderNameRegardlessOfOrder() throws {
		let tsv = """
			added\taction\tword
			2026-07-23\tadd\treordered
			"""
		#expect(try WordlistParser.parseTSV(tsv) == [Candidate(word: "reordered")])
	}

	@Test func treatsEveryRowAsAnAdditionWhenActionColumnIsAbsent() throws {
		let tsv = """
			word
			alpha
			beta
			"""
		#expect(try WordlistParser.parseTSV(tsv) == [Candidate(word: "alpha"), Candidate(word: "beta")])
	}

	@Test func skipsBlankLinesAnywhere() throws {
		let tsv = """
			word\taction

			alpha\tadd

			beta\tadd
			"""
		#expect(try WordlistParser.parseTSV(tsv).count == 2)
	}

	@Test func rejectsHeaderWithoutWordColumn() {
		#expect(throws: ParseError.missingWordColumn) {
			try WordlistParser.parseTSV("action\tdefinition\nadd\tx")
		}
	}

	@Test func rejectsUnrecognizedAction() {
		#expect(throws: ParseError.unrecognizedAction(line: 2, value: "delete")) {
			try WordlistParser.parseTSV("word\taction\nalpha\tdelete")
		}
	}

	@Test func rejectsRowWithFieldCountDifferingFromHeader() {
		#expect(throws: ParseError.fieldCountMismatch(line: 2, expected: 3, found: 2)) {
			try WordlistParser.parseTSV("word\taction\tadded\nalpha\tadd")
		}
	}

	@Test func rejectsInputWithNoHeader() {
		#expect(throws: ParseError.missingHeader) {
			try WordlistParser.parseTSV("# only a comment\n\n")
		}
	}

	@Test func plainTextSkipsBlanksAndComments() {
		let text = """
			alpha

			# a comment
			beta
			"""
		#expect(WordlistParser.parsePlainText(text) == [Candidate(word: "alpha"), Candidate(word: "beta")])
	}
}
