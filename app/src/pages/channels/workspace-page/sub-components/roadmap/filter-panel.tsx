/**
 * Roadmap filter: a sentence plus one row per condition.
 * The builder opens in a menu so the sheet keeps its size.
 *
 * ↔ filter-model.ts — comparison and the sentence
 * ↔ index.tsx — trigger sits in the issue-column header
 */
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Lucide } from "@/components/ui/lucide";
import { BUILTIN_ISSUE_PRIORITIES } from "@/lib/issue-priority";
import { BUILTIN_ISSUE_STATUSES } from "@/lib/issue-status";
import type { CustomPropsSchema } from "@/lib/types";
import {
  blankClause,
  blankGroup,
  builtinProps,
  clauseComplete,
  countClauses,
  opLabel,
  opNeedsValue,
  opsFor,
  summarize,
  type FilterClause,
  type FilterGroup,
  type FilterJoin,
  type FilterLevel,
  type FilterNode,
  type FilterProp,
} from "./filter-model";
import styles from "./styles.module.scss";

const EXAMPLE = "For example: end date is before a day, and status is done.";

const LEVEL_LABEL: Record<FilterLevel, string> = {
  epic: "Epic",
  task: "Task",
  subtask: "Subtask",
};

type Named = { id: string; title: string };

type CustomChoice = {
  token: string;
  prop: Extract<FilterProp, { source: "custom" }>;
  menuLabel: string;
};

function newId(): string {
  return crypto.randomUUID();
}

function propToken(prop: FilterProp): string {
  return JSON.stringify(prop);
}

function customChoices(
  projects: Named[],
  schemas: Map<string, CustomPropsSchema>,
): CustomChoice[] {
  const titleOf = new Map(projects.map((project) => [project.id, project.title]));
  const choices: CustomChoice[] = [];
  for (const [projectId, schema] of schemas) {
    const projectTitle = titleOf.get(projectId) ?? projectId;
    for (const level of ["epic", "task", "subtask"] as const) {
      for (const def of schema[level]) {
        const prop: Extract<FilterProp, { source: "custom" }> = {
          source: "custom",
          projectId,
          level,
          key: def.key,
          fieldType: def.type,
          label: def.label,
        };
        choices.push({
          token: propToken(prop),
          prop,
          menuLabel: `${projectTitle} · ${LEVEL_LABEL[level]} · ${def.label}`,
        });
      }
    }
  }
  choices.sort((a, b) => a.menuLabel.localeCompare(b.menuLabel));
  return choices;
}

type ChoiceItem = { value: string; label: string };

function FilterChoice({
  value,
  placeholder,
  ariaLabel,
  disabled,
  items,
  groups,
  onChange,
  searchable,
}: {
  value: string;
  placeholder: string;
  ariaLabel: string;
  disabled?: boolean;
  items?: ChoiceItem[];
  groups?: { label: string; items: ChoiceItem[] }[];
  onChange: (value: string) => void;
  searchable?: boolean;
}) {
  const all = [
    ...(items ?? []),
    ...(groups ?? []).flatMap((group) => group.items),
  ];
  const current = all.find((item) => item.value === value)?.label ?? "";
  return (
    <DropdownMenu
      independent
      disabled={disabled}
      filter={searchable ? { placeholder: "Filter…" } : undefined}
    >
      <DropdownMenu.Trigger asChild>
        <Button
          type="button"
          variant="outlined"
          size="small"
          className={styles.filterChoice}
          disabled={disabled}
          endIcon={<Lucide.ChevronDown aria-hidden />}
          aria-label={ariaLabel}
        >
          <span className={styles.filterChoiceLabel}>{current || placeholder}</span>
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" side="bottom">
        {items?.map((item) => (
          <DropdownMenu.ItemButton
            key={item.value || `${ariaLabel}-empty`}
            label={item.label}
            active={item.value === value}
            onSelect={() => onChange(item.value)}
          />
        ))}
        {groups?.map((group) => (
          <DropdownMenu.Group key={group.label}>
            <DropdownMenu.Label>{group.label}</DropdownMenu.Label>
            {group.items.map((item) => (
              <DropdownMenu.ItemButton
                key={item.value}
                label={item.label}
                active={item.value === value}
                onSelect={() => onChange(item.value)}
              />
            ))}
          </DropdownMenu.Group>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

function ValueControl({
  clause,
  members,
  wikiNodes,
  onValue,
}: {
  clause: FilterClause;
  members: Named[];
  wikiNodes: Named[];
  onValue: (value: string) => void;
}) {
  if (!clause.prop || !clause.op || !opNeedsValue(clause.op)) {
    return null;
  }
  const prop = clause.prop;
  const kind =
    prop.source === "builtin"
      ? prop.id === "status"
        ? "status"
        : prop.id === "priority"
          ? "priority"
          : prop.id === "createdBy" || prop.id === "assignee"
            ? "member"
            : "date"
      : prop.fieldType;

  if (kind === "date") {
    return (
      <Input
        type="date"
        size="small"
        className={styles.filterValue}
        value={clause.value}
        aria-label="Value"
        onChange={(event) => onValue(event.target.value)}
      />
    );
  }
  if (kind === "number") {
    return (
      <Input
        type="number"
        size="small"
        className={styles.filterValue}
        value={clause.value}
        aria-label="Value"
        onChange={(event) => onValue(event.target.value)}
      />
    );
  }
  if (kind === "boolean") {
    return (
      <FilterChoice
        value={clause.value}
        placeholder="Yes or no"
        ariaLabel="Value"
        items={[
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ]}
        onChange={onValue}
      />
    );
  }
  if (kind === "status") {
    return (
      <FilterChoice
        value={clause.value}
        placeholder="Status"
        ariaLabel="Value"
        items={BUILTIN_ISSUE_STATUSES.map((status) => ({
          value: status.id,
          label: status.label,
        }))}
        onChange={onValue}
      />
    );
  }
  if (kind === "priority") {
    return (
      <FilterChoice
        value={clause.value}
        placeholder="Priority"
        ariaLabel="Value"
        items={BUILTIN_ISSUE_PRIORITIES.map((priority) => ({
          value: priority.id,
          label: priority.label,
        }))}
        onChange={onValue}
      />
    );
  }
  if (kind === "member") {
    return (
      <FilterChoice
        value={clause.value}
        placeholder="Member"
        ariaLabel="Value"
        searchable
        items={members.map((member) => ({
          value: member.id,
          label: member.title,
        }))}
        onChange={onValue}
      />
    );
  }
  if (kind === "wiki-node") {
    return (
      <FilterChoice
        value={clause.value}
        placeholder="Wiki"
        ariaLabel="Value"
        searchable
        items={wikiNodes.map((node) => ({
          value: node.id,
          label: node.title,
        }))}
        onChange={onValue}
      />
    );
  }
  return (
    <Input
      type="text"
      size="small"
      className={styles.filterValue}
      value={clause.value}
      aria-label="Value"
      onChange={(event) => onValue(event.target.value)}
    />
  );
}

function FilterGroupView({
  group,
  nested,
  choices,
  members,
  wikiNodes,
  onChange,
}: {
  group: FilterGroup;
  nested: boolean;
  choices: CustomChoice[];
  members: Named[];
  wikiNodes: Named[];
  onChange: (next: FilterGroup) => void;
}) {
  const replaceChild = (index: number, next: FilterNode) => {
    const children = group.children.slice();
    children[index] = next;
    onChange({ ...group, children });
  };
  const removeAt = (index: number) => {
    onChange({
      ...group,
      children: group.children.filter((_, i) => i !== index),
    });
  };

  return (
    <div className={nested ? styles.filterGroup : styles.filterList}>
      {nested ? (
        <div className={styles.filterRow}>
          <FilterChoice
            value={group.join}
            placeholder="Relation"
            ariaLabel="Relation for this group"
            items={[
              { value: "and", label: "Match all" },
              { value: "or", label: "Match any" },
            ]}
            onChange={(next) =>
              onChange({ ...group, join: next as FilterJoin })
            }
          />
          <Button
            type="button"
            variant="outlined"
            size="small"
            onClick={() => onChange({ ...group, children: [] })}
          >
            Remove group
          </Button>
        </div>
      ) : null}
      {group.children.map((child, index) => (
        <div key={child.id} className={styles.filterBlock}>
          {index > 0 ? (
            <FilterChoice
              value={group.join}
              placeholder="and"
              ariaLabel={group.join === "and" ? "Switch to or" : "Switch to and"}
              items={[
                { value: "and", label: "and" },
                { value: "or", label: "or" },
              ]}
              onChange={(next) =>
                onChange({
                  ...group,
                  join: next as FilterJoin,
                })
              }
            />
          ) : null}
          {child.kind === "group" ? (
            <FilterGroupView
              group={child}
              nested
              choices={choices}
              members={members}
              wikiNodes={wikiNodes}
              onChange={(next) => {
                if (next.children.length === 0 && next.id === child.id) {
                  removeAt(index);
                  return;
                }
                replaceChild(index, next);
              }}
            />
          ) : (
            <div className={styles.filterRow}>
              <FilterChoice
                value={child.prop ? propToken(child.prop) : ""}
                placeholder="Property"
                ariaLabel="Property"
                searchable={choices.length > 0}
                groups={[
                  {
                    label: "Built-in",
                    items: builtinProps().map((item) => ({
                      value: propToken({ source: "builtin", id: item.id }),
                      label: item.label,
                    })),
                  },
                  ...(choices.length > 0
                    ? [
                        {
                          label: "Custom",
                          items: choices.map((item) => ({
                            value: item.token,
                            label: item.menuLabel,
                          })),
                        },
                      ]
                    : []),
                ]}
                onChange={(token) => {
                  const builtin = builtinProps().find(
                    (item) =>
                      propToken({ source: "builtin", id: item.id }) === token,
                  );
                  const custom = choices.find((item) => item.token === token);
                  const prop: FilterProp | null = builtin
                    ? { source: "builtin", id: builtin.id }
                    : (custom?.prop ?? null);
                  replaceChild(index, {
                    ...child,
                    prop,
                    op: prop ? opsFor(prop)[0]! : null,
                    value: "",
                  });
                }}
              />
              <FilterChoice
                value={child.op ?? ""}
                placeholder="Comparison"
                ariaLabel="Comparison"
                disabled={!child.prop}
                items={(child.prop ? opsFor(child.prop) : []).map((op) => ({
                  value: op,
                  label: opLabel(op),
                }))}
                onChange={(next) => {
                  const op = (next || null) as FilterClause["op"];
                  replaceChild(index, {
                    ...child,
                    op,
                    value: op && opNeedsValue(op) ? child.value : "",
                  });
                }}
              />
              <ValueControl
                clause={child}
                members={members}
                wikiNodes={wikiNodes}
                onValue={(value) => replaceChild(index, { ...child, value })}
              />
              {clauseComplete(child) ? null : (
                <span className={styles.filterPending}>Incomplete</span>
              )}
              <Button
                type="button"
                variant="outlined"
                size="small"
                onClick={() => removeAt(index)}
              >
                Remove
              </Button>
            </div>
          )}
        </div>
      ))}
      <div className={styles.filterRow}>
        <Button
          type="button"
          variant="outlined"
          size="small"
          onClick={() =>
            onChange({
              ...group,
              children: [...group.children, blankClause(newId())],
            })
          }
        >
          Add condition
        </Button>
        {group.children.length > 0 ? (
          <Button
            type="button"
            variant="outlined"
            size="small"
            onClick={() =>
              onChange({
                ...group,
                children: [
                  ...group.children,
                  blankGroup(
                    newId(),
                    group.join === "and" ? "or" : "and",
                    newId(),
                  ),
                ],
              })
            }
          >
            Add group
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function RoadmapFilterBar({
  filter,
  onChange,
  projects,
  schemas,
  members,
  wikiNodes,
}: {
  filter: FilterGroup;
  onChange: (next: FilterGroup) => void;
  projects: Named[];
  schemas: Map<string, CustomPropsSchema>;
  members: Named[];
  wikiNodes: Named[];
}) {
  const choices = customChoices(projects, schemas);
  const names = {
    member: (id: string) =>
      members.find((member) => member.id === id)?.title ?? id,
    wiki: (id: string) =>
      wikiNodes.find((node) => node.id === id)?.title ?? id,
  };
  const count = countClauses(filter);
  const sentence = summarize(filter, names);

  return (
    <div
      className={styles.filterHost}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button
            type="button"
            size="small"
            variant="outlined"
            className={styles.filterTrigger}
            endIcon={<Lucide.ChevronDown aria-hidden />}
          >
            {count === 0 ? "Filter" : `Filter · ${count}`}
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          align="start"
          side="bottom"
          className={styles.filterMenu}
        >
          <div className={styles.filterPanel}>
            <p className={styles.filterLead}>{sentence || EXAMPLE}</p>
            <FilterGroupView
              group={filter}
              nested={false}
              choices={choices}
              members={members}
              wikiNodes={wikiNodes}
              onChange={onChange}
            />
          </div>
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
}

export function RoadmapProjectFocus({
  projectId,
  projects,
  onChange,
}: {
  projectId: string | null;
  projects: { id: string; title: string }[];
  onChange: (projectId: string | null) => void;
}) {
  const current = projects.find((project) => project.id === projectId);
  return (
    <div
      className={styles.focusHost}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <DropdownMenu
        filter={projects.length > 8 ? { placeholder: "Filter…" } : undefined}
      >
        <DropdownMenu.Trigger asChild>
          <Button
            type="button"
            size="small"
            variant="outlined"
            className={styles.focusTrigger}
            endIcon={<Lucide.ChevronDown aria-hidden />}
            aria-label="Project focus"
          >
            <span className={styles.focusTriggerLabel}>
              {current?.title ?? "All projects"}
            </span>
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start" side="bottom">
          <DropdownMenu.ItemButton
            label="All projects"
            active={projectId === null}
            onSelect={() => onChange(null)}
          />
          {projects.map((project) => (
            <DropdownMenu.ItemButton
              key={project.id}
              label={project.title}
              active={project.id === projectId}
              onSelect={() => onChange(project.id)}
            />
          ))}
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
}
