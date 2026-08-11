/**
 * System `created` / `updated` for wiki-node / project / issue props.
 * ISO-8601 UTC with trailing Z. Not workspace `createdDate` (YYYY-MM-DD).
 */
import { z } from "zod";

export const IsoDateTimeZZod = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/,
    "created/updated must be ISO-8601 UTC ending in Z",
  );

export function nowIsoUtcZ(): string {
  return new Date().toISOString();
}

export function isIsoDateTimeZ(value: unknown): value is string {
  return typeof value === "string" && IsoDateTimeZZod.safeParse(value).success;
}

/** Read disk values; seed missing ones without inventing a "user edit". */
export function resolveTimestamps(props: Record<string, unknown>): {
  created: string;
  updated: string;
  seeded: boolean;
} {
  const now = nowIsoUtcZ();
  const hasCreated = isIsoDateTimeZ(props.created);
  const hasUpdated = isIsoDateTimeZ(props.updated);
  if (hasCreated && hasUpdated) {
    return {
      created: props.created as string,
      updated: props.updated as string,
      seeded: false,
    };
  }
  const created = hasCreated ? (props.created as string) : now;
  const updated = hasUpdated ? (props.updated as string) : created;
  return { created, updated, seeded: true };
}

/** After a real content write: keep created, bump updated. */
export function stampOnWrite(props: Record<string, unknown>): {
  created: string;
  updated: string;
} {
  const { created } = resolveTimestamps(props);
  return { created, updated: nowIsoUtcZ() };
}

export const SYSTEM_TIMESTAMP_KEYS = ["created", "updated"] as const;

export function stripTimestampKeys(
  fields: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!fields) {
    return undefined;
  }
  const next = { ...fields };
  delete next.created;
  delete next.updated;
  return next;
}
