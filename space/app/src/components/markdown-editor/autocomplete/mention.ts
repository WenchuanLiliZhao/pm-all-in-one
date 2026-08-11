// ↔ ../types.ts — MentionAutocompleteProps / Candidate (product fills insertText)
// ↔ ../markdown-cm-view.tsx — mounts createMentionAutocompleteExtensions
// ↔ src/lib/markdown/*-mention-completions.ts — product candidate lists

import {
  autocompletion,
  completionKeymap,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { Facet, type Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import type {
  MentionAutocompleteCandidate,
  MentionAutocompleteProps,
} from "../types";

export type MentionAutocompleteConfig = MentionAutocompleteProps;

const mentionAutocompleteFacet = Facet.define<
  MentionAutocompleteConfig,
  MentionAutocompleteConfig | null
>({
  combine: (values) => values[values.length - 1] ?? null,
});

/** Open mention: `@` plus query until whitespace. */
const MENTION_OPEN = /@([^\s@]*)$/;

function defaultFilter(
  candidate: MentionAutocompleteCandidate,
  query: string,
): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    candidate.label.toLowerCase().includes(q) ||
    candidate.id.toLowerCase().includes(q) ||
    (candidate.secondary?.toLowerCase().includes(q) ?? false) ||
    candidate.insertText.toLowerCase().includes(q) ||
    candidate.insertText.toLowerCase().includes(`@${q}`)
  );
}

function mentionCompletions(
  context: CompletionContext,
): CompletionResult | null {
  const config = context.state.facet(mentionAutocompleteFacet);
  if (!config) return null;

  const match = context.matchBefore(MENTION_OPEN);
  if (!match) return null;

  const query = match.text.slice(1);
  const filter = config.filterCandidate ?? defaultFilter;
  const max = config.maxResults ?? 50;
  const items = config.candidates
    .filter((c) => filter(c, query))
    .slice(0, max);

  const options: Completion[] = items.map((c) => ({
    label: c.label,
    detail: c.secondary,
    apply: c.insertText + " ",
    type: "text",
  }));

  if (options.length === 0) {
    options.push({
      label: config.emptyMessage ?? "No matches",
      apply: () => {},
      boost: -99,
    });
  }

  return {
    from: match.from,
    options,
    filter: false,
  };
}

/** Generic `@` autocomplete shell; product injects candidates via facet config. */
export function createMentionAutocompleteExtensions(
  config: MentionAutocompleteConfig,
): Extension[] {
  return [
    mentionAutocompleteFacet.of(config),
    autocompletion({
      override: [mentionCompletions],
      activateOnTyping: true,
      defaultKeymap: true,
    }),
    keymap.of(completionKeymap),
  ];
}
