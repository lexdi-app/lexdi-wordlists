import Foundation

struct CommandLineOptions: Equatable, Sendable {
	var input: String
	var osVersion: String
	var outputDirectory: String
	var language: String

	static let usage = """
		usage: wordlist-filter --input <file> --os-version <version> --output-dir <path> [--language en_US]
		"""

	/// `--os-version` names the caller's published directory; the tool records it in the summary and
	/// leaves path composition to the caller.
	static func parse(_ arguments: [String]) throws -> CommandLineOptions {
		var values: [String: String] = [:]
		var index = 0
		while index < arguments.count {
			let flag = arguments[index]
			guard flag.hasPrefix("--") else { throw OptionError.unexpectedArgument(flag) }
			guard index + 1 < arguments.count else { throw OptionError.missingValue(flag) }
			values[String(flag.dropFirst(2))] = arguments[index + 1]
			index += 2
		}

		guard let input = values["input"] else { throw OptionError.missingFlag("--input") }
		guard let osVersion = values["os-version"] else { throw OptionError.missingFlag("--os-version") }
		guard let outputDirectory = values["output-dir"] else { throw OptionError.missingFlag("--output-dir") }

		return CommandLineOptions(
			input: input,
			osVersion: osVersion,
			outputDirectory: outputDirectory,
			language: values["language"] ?? "en_US"
		)
	}
}

enum OptionError: Error, Equatable, CustomStringConvertible {
	case missingFlag(String)
	case missingValue(String)
	case unexpectedArgument(String)

	var description: String {
		switch self {
		case let .missingFlag(flag): return "missing required flag \(flag)"
		case let .missingValue(flag): return "\(flag) requires a value"
		case let .unexpectedArgument(argument): return "unexpected argument `\(argument)`"
		}
	}
}
