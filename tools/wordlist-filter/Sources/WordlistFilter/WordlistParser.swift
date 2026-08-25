import Foundation

/// A candidate word read from an input list.
struct Candidate: Equatable, Sendable {
	let word: String
}

enum ParseError: Error, Equatable, CustomStringConvertible {
	case missingHeader
	case missingWordColumn
	case unrecognizedAction(line: Int, value: String)
	case fieldCountMismatch(line: Int, expected: Int, found: Int)

	var description: String {
		switch self {
		case .missingHeader:
			return "input has no header row"
		case .missingWordColumn:
			return "header has no `word` column"
		case let .unrecognizedAction(line, value):
			return "line \(line): unrecognized action `\(value)`"
		case let .fieldCountMismatch(line, expected, found):
			return "line \(line): expected \(expected) fields, found \(found)"
		}
	}
}

enum WordlistParser {
	/// Rows whose action is not `add` are retractions or list references, never spell-check candidates.
	private static let candidateAction = "add"
	private static let knownActions: Set<String> = ["add", "exclude", "include"]

	static func parse(contents: String, isTSV: Bool) throws -> [Candidate] {
		isTSV ? try parseTSV(contents) : parsePlainText(contents)
	}

	/// One word per line; `#` comments and blank lines are inert.
	static func parsePlainText(_ contents: String) -> [Candidate] {
		contents.split(separator: "\n", omittingEmptySubsequences: false).compactMap { rawLine in
			let line = String(rawLine).trimmingCharacters(in: .whitespaces)
			guard !line.isEmpty, !line.hasPrefix("#") else { return nil }
			return Candidate(word: line)
		}
	}

	/// Parses the `.lexdi.tsv` source format. Column identity comes from the header rather than a fixed
	/// position, and a list may omit any optional column.
	static func parseTSV(_ contents: String) throws -> [Candidate] {
		var header: [String]?
		var wordIndex = 0
		var actionIndex: Int?
		var candidates: [Candidate] = []

		for (offset, rawLine) in contents.split(separator: "\n", omittingEmptySubsequences: false).enumerated() {
			let lineNumber = offset + 1
			let line = String(rawLine)
			guard !line.trimmingCharacters(in: .whitespaces).isEmpty, !line.hasPrefix("#") else { continue }

			let fields = line.components(separatedBy: "\t")

			guard let columns = header else {
				header = fields
				guard let index = fields.firstIndex(of: "word") else { throw ParseError.missingWordColumn }
				wordIndex = index
				actionIndex = fields.firstIndex(of: "action")
				continue
			}

			guard fields.count == columns.count else {
				throw ParseError.fieldCountMismatch(line: lineNumber, expected: columns.count, found: fields.count)
			}

			// A list with no `action` column declares every row an addition.
			let action = actionIndex.map { fields[$0] } ?? candidateAction
			guard knownActions.contains(action) else {
				throw ParseError.unrecognizedAction(line: lineNumber, value: action)
			}
			guard action == candidateAction else { continue }

			let word = fields[wordIndex].trimmingCharacters(in: .whitespaces)
			guard !word.isEmpty else { continue }
			candidates.append(Candidate(word: word))
		}

		guard header != nil else { throw ParseError.missingHeader }
		return candidates
	}
}
