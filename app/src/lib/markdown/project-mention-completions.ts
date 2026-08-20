// ↔ src/components/markdown-editor/types.ts — MentionAutocompleteCandidate
// ↔ src/components/markdown-editor/autocomplete/mention.ts — generic @ shell

import type { MentionAutocompleteCandidate } from "@/components/markdown-editor";
import type { Project } from "@/lib/types";
import { projectDisplayTitle } from "./mention-titles";

function projectLinkSyntax(projectId: string): string {
  return `@issue-${projectId}`;
}

/** Map workspace projects → generic @ mention autocomplete candidates. */
export function toProjectMentionCandidates(
  projects: Project[],
): MentionAutocompleteCandidate[] {
  return projects.map((project) => ({
    id: `project:${project.id}`,
    label: projectDisplayTitle(project),
    secondary: `project · ${project.id}`,
    insertText: projectLinkSyntax(project.id),
  }));
}
