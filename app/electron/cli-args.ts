/**
 * CLI argv parser for `cli.ts`.
 * Value flags must accept tokens that start with `-` (nanoid ids).
 */

export type ParsedCliArgs = {
  _: string[];
  flags: Record<string, string | boolean>;
};

/** Long/short flags that always take a following value (or `--flag=value`). */
export const CLI_VALUE_FLAGS = new Set([
  "project",
  "p",
  "parent",
  "issue",
  "i",
  "title",
  "t",
  "workspace",
  "w",
  "path",
  "file",
  "f",
  "id",
  "membership",
  "from",
  "to",
  "related-project",
  "relatedProject",
  "created-by",
  "createdBy",
  "assignee",
  "description",
]);

function takesValue(key: string): boolean {
  return CLI_VALUE_FLAGS.has(key);
}

/** True when `token` is another CLI option, not a flag value. */
function isOptionToken(token: string): boolean {
  if (token === "--") {
    return true;
  }
  if (token.startsWith("--")) {
    return true;
  }
  // Short options are exactly `-X`. Longer `-…` tokens are values (e.g. nanoid).
  return token.startsWith("-") && token.length === 2;
}

/**
 * Parse argv into positionals + flags.
 * `--parent -p7Rkr1ks6rjrIk8LvqTV` binds the leading-dash id (value flags only).
 */
export function parseCliArgs(argv: string[]): ParsedCliArgs {
  const _: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--") {
      _.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
        continue;
      }
      const key = a.slice(2);
      const next = argv[i + 1];
      if (takesValue(key) && next !== undefined && !isOptionToken(next)) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
      continue;
    }
    if (a.startsWith("-") && a.length === 2) {
      const key = a.slice(1);
      const next = argv[i + 1];
      if (takesValue(key) && next !== undefined && !isOptionToken(next)) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
      continue;
    }
    _.push(a);
  }
  return { _, flags };
}
