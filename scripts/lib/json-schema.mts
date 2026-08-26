/**
 * Minimal JSON Schema Validator
 *
 * Covers the draft 2020-12 subset the Lexdi schemas use: type, required,
 * additionalProperties, properties, propertyNames, items, enum, const, pattern,
 * minLength, minItems, minimum, and local `$ref` into `$defs`. Keeping the pipeline
 * dependency-free is worth more than the keywords it leaves out, so an unrecognized
 * keyword is an error rather than a silent pass — a schema this cannot fully enforce
 * must not appear to have been enforced.
 */

export interface ValidationError {
	/** JSON Pointer to the offending value. */
	readonly path: string;
	readonly message: string;
}

export type JsonSchema = Record<string, unknown>;

const SUPPORTED_KEYWORDS = new Set([
	"$schema",
	"$id",
	"$ref",
	"$defs",
	"$comment",
	"title",
	"description",
	"type",
	"required",
	"additionalProperties",
	"properties",
	"propertyNames",
	"items",
	"enum",
	"const",
	"pattern",
	"format",
	"minLength",
	"minItems",
	"minimum",
]);

/** `format` is annotation-only in draft 2020-12, so it is read but never enforced. */
const ANNOTATION_KEYWORDS = new Set(["$schema", "$id", "$defs", "$comment", "title", "description", "format"]);

export function validate(document: unknown, schema: JsonSchema): ValidationError[] {
	const errors: ValidationError[] = [];
	validateValue(document, schema, "", schema, errors);
	return errors;
}

function validateValue(
	value: unknown,
	schema: JsonSchema,
	path: string,
	root: JsonSchema,
	errors: ValidationError[],
): void {
	const resolved = schema.$ref === undefined ? schema : resolveRef(String(schema.$ref), root);

	for (const keyword of Object.keys(resolved)) {
		if (!SUPPORTED_KEYWORDS.has(keyword)) {
			errors.push({ path, message: `schema uses unsupported keyword \`${keyword}\`` });
		}
	}

	for (const [keyword, constraint] of Object.entries(resolved)) {
		if (ANNOTATION_KEYWORDS.has(keyword) || keyword === "$ref") continue;
		checkKeyword(keyword, constraint, value, resolved, path, root, errors);
	}
}

function checkKeyword(
	keyword: string,
	constraint: unknown,
	value: unknown,
	schema: JsonSchema,
	path: string,
	root: JsonSchema,
	errors: ValidationError[],
): void {
	switch (keyword) {
		case "type": {
			if (!matchesType(value, String(constraint))) {
				errors.push({ path, message: `expected ${constraint}, found ${describeType(value)}` });
			}
			return;
		}
		case "enum": {
			const allowed = constraint as unknown[];
			if (!allowed.some((option) => deepEqual(option, value))) {
				errors.push({ path, message: `${JSON.stringify(value)} is not one of ${JSON.stringify(allowed)}` });
			}
			return;
		}
		case "const": {
			if (!deepEqual(constraint, value)) {
				errors.push({ path, message: `expected ${JSON.stringify(constraint)}, found ${JSON.stringify(value)}` });
			}
			return;
		}
		case "pattern": {
			if (typeof value === "string" && !new RegExp(String(constraint), "u").test(value)) {
				errors.push({ path, message: `${JSON.stringify(value)} does not match /${constraint}/` });
			}
			return;
		}
		case "minLength": {
			if (typeof value === "string" && value.length < Number(constraint)) {
				errors.push({ path, message: `shorter than minLength ${constraint}` });
			}
			return;
		}
		case "minimum": {
			if (typeof value === "number" && value < Number(constraint)) {
				errors.push({ path, message: `below minimum ${constraint}` });
			}
			return;
		}
		case "minItems": {
			if (Array.isArray(value) && value.length < Number(constraint)) {
				errors.push({ path, message: `fewer than minItems ${constraint}` });
			}
			return;
		}
		case "required": {
			if (!isPlainObject(value)) return;
			for (const key of constraint as string[]) {
				if (!Object.hasOwn(value, key)) {
					errors.push({ path: joinPath(path, key), message: "required property is missing" });
				}
			}
			return;
		}
		case "properties": {
			if (!isPlainObject(value)) return;
			for (const [key, subSchema] of Object.entries(constraint as Record<string, JsonSchema>)) {
				if (Object.hasOwn(value, key)) {
					validateValue(value[key], subSchema, joinPath(path, key), root, errors);
				}
			}
			return;
		}
		case "additionalProperties": {
			if (!isPlainObject(value)) return;
			const declared = new Set(Object.keys((schema.properties as Record<string, unknown>) ?? {}));
			for (const key of Object.keys(value)) {
				if (declared.has(key)) continue;
				if (constraint === false) {
					errors.push({ path: joinPath(path, key), message: "property is not allowed" });
				} else if (isPlainObject(constraint)) {
					validateValue(value[key], constraint, joinPath(path, key), root, errors);
				}
			}
			return;
		}
		case "propertyNames": {
			if (!isPlainObject(value)) return;
			for (const key of Object.keys(value)) {
				validateValue(key, constraint as JsonSchema, joinPath(path, key), root, errors);
			}
			return;
		}
		case "items": {
			if (!Array.isArray(value)) return;
			value.forEach((element, index) => {
				validateValue(element, constraint as JsonSchema, `${path}/${index}`, root, errors);
			});
			return;
		}
		default:
			return;
	}
}

function resolveRef(ref: string, root: JsonSchema): JsonSchema {
	if (!ref.startsWith("#/")) {
		throw new Error(`unsupported $ref \`${ref}\` — only local pointers are resolvable`);
	}
	let cursor: unknown = root;
	for (const segment of ref.slice(2).split("/")) {
		const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");
		if (!isPlainObject(cursor) || !Object.hasOwn(cursor, key)) {
			throw new Error(`unresolvable $ref \`${ref}\``);
		}
		cursor = cursor[key];
	}
	if (!isPlainObject(cursor)) {
		throw new Error(`$ref \`${ref}\` does not name a schema object`);
	}
	return cursor;
}

function matchesType(value: unknown, type: string): boolean {
	switch (type) {
		case "object":
			return isPlainObject(value);
		case "array":
			return Array.isArray(value);
		case "string":
			return typeof value === "string";
		case "integer":
			return typeof value === "number" && Number.isInteger(value);
		case "number":
			return typeof value === "number";
		case "boolean":
			return typeof value === "boolean";
		case "null":
			return value === null;
		default:
			throw new Error(`unsupported type \`${type}\``);
	}
}

function describeType(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	if (Number.isInteger(value)) return "integer";
	return typeof value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

function joinPath(path: string, key: string): string {
	return `${path}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`;
}
