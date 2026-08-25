// swift-tools-version: 6.0

import PackageDescription

// macOS-only: the filter's verdict comes from NSSpellChecker, which has no iOS equivalent usable
// from a CI runner.
let package = Package(
	name: "wordlist-filter",
	platforms: [
		.macOS(.v13),
	],
	products: [
		.executable(name: "wordlist-filter", targets: ["wordlist-filter"]),
	],
	targets: [
		.target(
			name: "WordlistFilter"
		),
		.executableTarget(
			name: "wordlist-filter",
			dependencies: ["WordlistFilter"]
		),
		.testTarget(
			name: "WordlistFilterTests",
			dependencies: ["WordlistFilter"]
		),
	]
)
