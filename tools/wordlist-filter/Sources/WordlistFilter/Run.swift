import Foundation

enum RunError: Error, CustomStringConvertible {
	case unreadableInput(path: String, underlying: String)

	var description: String {
		switch self {
		case let .unreadableInput(path, underlying):
			return "cannot read input `\(path)`: \(underlying)"
		}
	}
}

public enum WordlistFilterTool {
	/// Returns the process exit code; classification outcomes never fail the run.
	public static func main(arguments: [String]) -> Int32 {
		do {
			let options = try CommandLineOptions.parse(arguments)
			let summary = try run(options: options, checker: SpellCheckerAdapter())
			print(summary)
			return 0
		} catch {
			FileHandle.standardError.write(Data("wordlist-filter: \(error)\n".utf8))
			FileHandle.standardError.write(Data("\(CommandLineOptions.usage)\n".utf8))
			return 1
		}
	}

	static func run(options: CommandLineOptions, checker: any SpellChecking) throws -> String {
		let contents: String
		do {
			contents = try String(contentsOfFile: options.input, encoding: .utf8)
		} catch {
			throw RunError.unreadableInput(path: options.input, underlying: error.localizedDescription)
		}

		let isTSV = options.input.lowercased().hasSuffix(".tsv")
		let candidates = try WordlistParser.parse(contents: contents, isTSV: isTSV)

		let classifier = Classifier(checker: checker, language: options.language)
		let results = Results(candidates.map { classifier.classify($0.word) })

		let listName = OutputWriter.listName(forInputPath: options.input)
		try OutputWriter.write(results, listName: listName, outputDirectory: options.outputDirectory)

		return "\(listName) [\(options.osVersion)] \(results.summary)"
	}
}
