import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

import { evaluatePropsExport, writePropsTs } from "./props-load.js";
import { writeSchemaDts } from "./schema-dts.js";
import type { CustomPropDef, CustomPropsSchema } from "./types.js";

const PropDefZod = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    type: z.enum(["string", "number", "boolean", "date", "markdown"]),
    help: z.string().optional(),
  })
  .transform((def) => {
    const help = def.help?.trim();
    if (!help) {
      const { help: _drop, ...rest } = def;
      return rest;
    }
    return { ...def, help };
  });

const SchemaZod = z.object({
  epic: z.array(PropDefZod).default([]),
  task: z.array(PropDefZod).default([]),
  subtask: z.array(PropDefZod).default([]),
});

/**
 * Legacy musical keys (`concerto` / `movement` / `phrase`) → canonical ranks
 * so older custom-props.ts still loads. `story` → `task` read alias kept.
 * Field ids like `movementField1` are unrelated and untouched.
 */
function normalizeCustomPropsRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }
  const obj = { ...(raw as Record<string, unknown>) };
  const alias: Record<string, "epic" | "task" | "subtask"> = {
    concerto: "epic",
    movement: "task",
    phrase: "subtask",
    story: "task",
  };
  for (const [from, to] of Object.entries(alias)) {
    if (!(from in obj)) continue;
    if (!(to in obj) || obj[to] === undefined) {
      obj[to] = obj[from];
    }
    delete obj[from];
  }
  return obj;
}

export function emptyCustomProps(): CustomPropsSchema {
  return { epic: [], task: [], subtask: [] };
}

export function customPropsPath(projectDir: string): string {
  return path.join(projectDir, "custom-props.ts");
}

export async function loadCustomProps(projectDir: string): Promise<CustomPropsSchema> {
  const file = customPropsPath(projectDir);
  if (!fs.existsSync(file)) {
    return emptyCustomProps();
  }
  const raw = await evaluatePropsExport(fs.readFileSync(file, "utf8"));
  if (raw && typeof raw === "object" && "id" in (raw as object)) {
    throw new Error("id must not appear in custom-props.ts");
  }
  return SchemaZod.parse(normalizeCustomPropsRaw(raw));
}

const RESERVED_CUSTOM_KEYS = new Set([
  "id",
  "created",
  "updated",
  "title",
  "level",
  "parentId",
  "status",
  "priority",
  "startDate",
  "endDate",
  "estimatePoint",
  "assignee",
  "createdBy",
]);

export function writeCustomProps(projectDir: string, schema: CustomPropsSchema): void {
  for (const level of ["epic", "task", "subtask"] as const) {
    for (const def of schema[level]) {
      if (RESERVED_CUSTOM_KEYS.has(def.key)) {
        throw new Error(
          `custom props must not use reserved key ${def.key}`,
        );
      }
    }
  }
  const validated = SchemaZod.parse(schema);
  fs.writeFileSync(
    customPropsPath(projectDir),
    writePropsTs(validated as unknown as Record<string, unknown>),
    "utf8",
  );
  // Keep the generated types beside the declaration that produced them.
  writeSchemaDts(projectDir, validated);
}

export function defsForLevel(
  schema: CustomPropsSchema,
  level: "epic" | "task" | "subtask",
): CustomPropDef[] {
  return schema[level];
}
