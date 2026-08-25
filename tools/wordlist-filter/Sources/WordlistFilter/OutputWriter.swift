import Foundation

struct Results: Sendable {
	var alreadyKnown: [String] = []
	var missing: [String] = []
	var flagged: [Classification] = []

	init(_ classifications: [Classification]) {
		for result in classifications {
			switch result.bucket {
			case .alreadyKnown: alreadyKnown.append(result.word)
			case .missing: missing.append(result.word)
			case .flaggedForReview: flagged.append(result)
			}
		}
	}

	var summary: String {
		"already-known: \(alreadyKnown.count)  missing: \(missing.count)  flagged-for-review: \(flagged.count)"
	}
}

enum OutputWriter {
	static func sortedCaseInsensitively(_ words: [String]) -> [String] {
		words.sorted { $0.compare($1, options: .caseInsensitive) == .orderedAscending }
	}

	static func plainTextBody(_ words: [String]) -> String {
		let sorted = sortedCaseInsensitively(words)
		return sorted.isEmpty ? "" : sorted.joined(separator: "\n") + "\n"
	}

	static func flaggedJSON(_ flagged: [Classification]) throws -> String {
		let sorted = flagged.sorted { $0.word.compare($1.word, options: .caseInsensitive) == .orderedAscending }
		let entries = sorted.map { entry -> [String: String] in
			var object = ["word": entry.word]
			if let signal = entry.signal { object["signal"] = signal.rawValue }
			if let suggestion = entry.suggestion { object["suggestion"] = suggestion }
			return object
		}
		let data = try JSONSerialization.data(
			withJSONObject: entries,
			options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
		)
		guard let text = String(data: data, encoding: .utf8) else { return "[]\n" }
		return text + "\n"
	}

	/// Strips the compound `.lexdi.tsv` suffix as a unit so a list keeps its published name.
	static func listName(forInputPath path: String) -> String {
		let base = (path as NSString).lastPathComponent
		if base.hasSuffix(".lexdi.tsv") { return String(base.dropLast(".lexdi.tsv".count)) }
		return (base as NSString).deletingPathExtension
	}

	static func write(_ results: Results, listName: String, outputDirectory: String) throws {
		let directory = URL(fileURLWithPath: outputDirectory, isDirectory: true)
		try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

		try plainTextBody(results.missing).write(
			to: directory.appendingPathComponent("\(listName).missing.txt"),
			atomically: true,
			encoding: .utf8
		)
		try plainTextBody(results.alreadyKnown).write(
			to: directory.appendingPathComponent("\(listName).already-known.txt"),
			atomically: true,
			encoding: .utf8
		)
		try flaggedJSON(results.flagged).write(
			to: directory.appendingPathComponent("\(listName).flagged-for-review.json"),
			atomically: true,
			encoding: .utf8
		)
	}
}
