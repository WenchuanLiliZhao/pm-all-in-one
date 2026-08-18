/**
 * Reading View only: inject `type:` from the info-string second token.
 * remark keeps only the first token as `language-plot`; calc-kit YAML often
 * has no `type` field (Desktop build.js set it from the fence).
 */
export function injectPlotFenceType(source: string): string {
  const lines = source.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const open = /^```plot(?:[ \t]+(\S+))?[ \t]*$/.exec(lines[i]);
    if (!open) {
      out.push(lines[i]);
      i += 1;
      continue;
    }
    const fenceType = open[1];
    const body: string[] = [];
    i += 1;
    while (i < lines.length && !/^```[ \t]*$/.test(lines[i])) {
      body.push(lines[i]);
      i += 1;
    }
    out.push("```plot");
    if (fenceType) {
      out.push(...withTypeLine(body, fenceType));
    } else {
      out.push(...body);
    }
    if (i < lines.length) {
      out.push(lines[i]);
      i += 1;
    }
  }
  return out.join("\n");
}

function withTypeLine(body: string[], type: string): string[] {
  const stripped = body.filter((line) => !/^[ \t]*type[ \t]*:/.test(line));
  return [`type: ${type}`, ...stripped];
}
