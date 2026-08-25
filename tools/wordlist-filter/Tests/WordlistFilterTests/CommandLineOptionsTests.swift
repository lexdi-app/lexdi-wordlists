import Testing

@testable import WordlistFilter

@Suite struct CommandLineOptionsTests {
	@Test func parsesRequiredFlagsAndDefaultsLanguage() throws {
		let options = try CommandLineOptions.parse([
			"--input", "list.lexdi.tsv", "--os-version", "macos-27.0", "--output-dir", "out",
		])
		#expect(options.input == "list.lexdi.tsv")
		#expect(options.osVersion == "macos-27.0")
		#expect(options.outputDirectory == "out")
		#expect(options.language == "en_US")
	}

	@Test func acceptsExplicitLanguage() throws {
		let options = try CommandLineOptions.parse([
			"--input", "a", "--os-version", "b", "--output-dir", "c", "--language", "fr_FR",
		])
		#expect(options.language == "fr_FR")
	}

	@Test func rejectsMissingRequiredFlag() {
		#expect(throws: OptionError.missingFlag("--output-dir")) {
			try CommandLineOptions.parse(["--input", "a", "--os-version", "b"])
		}
	}

	@Test func rejectsFlagWithoutValue() {
		#expect(throws: OptionError.missingValue("--input")) {
			try CommandLineOptions.parse(["--input"])
		}
	}

	@Test func rejectsBareArgument() {
		#expect(throws: OptionError.unexpectedArgument("stray")) {
			try CommandLineOptions.parse(["stray"])
		}
	}
}
