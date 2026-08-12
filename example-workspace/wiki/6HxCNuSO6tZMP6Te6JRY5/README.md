pm-all-in-one is a local-first project manager: project data lives as Markdown and directories on your disk, next to the code, with collaboration via git. Its home turf is one person and small teams of a few people. Larger orgs that adopt it usually cover only the **AI-native / agent-on-disk layer**, not a full enterprise ticket system.

The main variable is not headcount. It is how work is produced: whether company state is **on disk + agent-readable + human-reviewed via git**.

## Fit / not a fit

### Fit (high match)

- Solo developers, or small teams where everyone vibe-codes and shares one workspace with AI
- AI-native software / developer-tool companies: intent must land in your own git, not only in a hosted tracker or a chat session
- Agent-service / automation studios: deliverables are reproducible turns and handoffs that need a diffable intent ledger
- Knowledge or delivery work whose output is already a “docs + code” repo
- AI / platform / DX **squads** inside large companies: use it only at the agent-fleet layer; procurement, compliance, and cross-org tickets stay on the enterprise system

### Not a fit

- Hard-compliance ticket flows (procurement, legal, regulated ops) — the source of truth must be a remote ticket store and an approval matrix
- Businesses full of non-writers who only know web forms and SLA reports (support tickets, HR flows, sales CRM)
- Orgs that need multi-tenant hosting, fine-grained permissions, hosted sync, or “a board that hides the files” as first-class citizens

Fit and not-a-fit are two sides of the same line. The only fuzzy zone is the middle — and the answer there is usually **coexistence**, not either/or.

**Validation boundary (must stay honest):** there are **no large-team experiments** yet. Dogfood and active testing still stop at **3–5 people**. Whether larger headcount holds up is unknown here.

The English product README lives at the product-repo root; this page is the dogfood-side current truth.

## Why this product exists

Two frustrations started it.

First, tools like Jira are too heavy for individuals and small teams. Just configuring them into something usable needs someone dedicated to workflows and field schemes — solving problems three people simply do not have.

Second, context disappears when collaborating with AI. Data sits on someone else’s server; the AI only gets a partial snapshot through an API, and writing back is another call — none of the reasoning or evidence stays behind.

So the core decision is one sentence: **put project-management data back on your own filesystem.** From that, three things follow naturally:

- **Usable with no app open.** Directories are structure; files are content — readable, editable, greppable. Derived indexes can always be rebuilt.
- **AI is a colleague, not a plugin.** It reads and writes the same files you do; output is a diff — reviewable, revertible, traceable in git history.
- **Collaboration is git.** No accounts, no server, no permission system.

The costs are equally explicit: cross-org workflows, audit reports, permission matrices, and real-time collab are all out of scope. That is Jira’s home field — walking onto it is losing.

## Solo

This is the only scenario that has been truly validated — the product itself was built this way.

When one person works with AI, the biggest cost is not writing code; it is **re-explaining what this project is, over and over**. pm-all-in-one freezes that explanation on disk: wiki holds standing truth, issues hold the current campaign, and locators cross-link both. An AI that opens the workspace can read it without a re-brief every time.

The fixed structure is intentional. The three-level ladder is not extensible, and system fields are not customizable, so the AI cannot invent a private scheme only it understands. Few and fixed beats many and configurable when machines must read and write.

The honest half: for solo use, “data in git” is still mostly a backup layer. The ceremony of ids, locators, and contracts is cost paid early for multi-person and long-lived use.

## Small team (~three people)

When three people write code with AI, the common failure is not “nobody knows who is doing what.” It is that **each person’s AI understands the project differently** — and each is confident.

The countermeasure is to separate **planning together** from **executing alone**.

**The issue tree is the shared plan.** All three discuss, break down, and edit here. People editing the plan is slow; when the edit is heavy, talking is warranted — that collision is useful.

**One person executes with AI.** Only one person moves code at a time. AI work is large rewrites that run for a long time; three AIs in parallel only sabotage each other — that collision is pure waste.

**Directory isolation blocks mechanical conflicts.** The storage layout is built for this: creating an issue writes only two files in its own directory, because hierarchy lives on the child’s `parentId` — adding a child never edits the parent; same for title, status, and body. After the convention “one person owns one subtree for a stretch,” maybe nine-tenths of day-to-day ops do not interfere. The remaining gaps are shared commit files (ordering, Contents index, project custom fields) and moving issues (rewrites `level` for the whole subtree).

**Which layer you change decides who can decide.** That turns the three-level ladder from naming habit into real rule:

| Change layer | Who decides |
| --- | --- |
| subtask | The executor edits and notes it |
| task | Pause and tell the other two |
| epic | All three decide together |

Plans are always a bit wrong — things you only learn while coding do not show up in planning. This rule lets the executor skip a meeting for every small drift without quietly changing direction. Moving an issue is structural by nature, so under this rule it should be escalated.

**`draft` and `todo` in status are the handoff line.** `draft` means still figuring it out; `todo` means someone else can pick it up.

**Executors rotate as needed.** With AI, specialty matters less for “writing” and more for “seeing what is wrong.” The cheaper split: whoever understands the area reviews; anyone can execute. Current ownership is on the issue’s assignee; membership and ownership design: @wiki-7j0Ak3N2wsnQodOSxSzZ9.

**Plans must be written so someone else can take over.** The executor is not the planner; the body cannot depend on what only lived in the author’s head. Standing background goes in wiki; the plan points there with locators.

Directory isolation and this escalation rule complement each other; either alone is not enough. Isolation covers the mechanical layer; the rule covers the semantic layer. Semantic fork is the kind isolation never sees — A redefines a task, B keeps working under it with the old meaning: zero text conflicts, all checks green, wrong result.

What this pattern saves on: no locks, no permissions, no real-time sync. The one real gap is letting the executor know **what changed in the plan while they were working**.

## Distribution and trust

There is one public download path: GitHub Releases on the product repo `WenchuanLiliZhao/pm-all-in-one` — macOS DMG / zip. Building from source (`npm install` + `npm run dev` in `app`) is another path, and the **only frictionless** one — a locally built app has no quarantine bit and opens on double-click.

**Current artifacts are unsigned and not notarized.** That drives UX and needs to be stated clearly: a web download gets quarantined, and on Apple Silicon an unsigned download is not reported as “unsigned” — it is reported as **“damaged.”** Users do not see “this app is unsigned”; they see “this app is broken.” Bypass after download:

```sh
xattr -dr com.apple.quarantine "/Applications/pm-all-in-one.app"
```

To open like a normal desktop app there is only one path: Apple Developer ID certificate + notarization + staple. That needs a **paid** Apple Developer Program membership — no free path, no open-source exemption. Ad-hoc signing, self-signed certs, Homebrew, and “Open anyway” do not fix Gatekeeper, and Apple tightens these bypasses each generation — the cost of teaching users to work around it rises over time, and is not under our control.

So shipping is cut into two epics: **v0** (@issue-blwwMj6xHRYLCWXfa9wwl::3qb08jBxvAlJCtmPInRqg) open-source, unsigned, `0.x`, aimed at developers who can run a shell, with honest notes in the README and every Release; **v1** (@issue-blwwMj6xHRYLCWXfa9wwl::fSADO94-kHCGNxYFFe_10) buy trust and finish UI / feature polish, and only then ship a signed, notarized `1.0.0` that earns a Download button. The `1.0.0` version number is reserved for v1 — do not spend it on unsigned builds.

**`pm-all-in-one`** is the single external product name — display, CLI, npm, repo slug, and app bundle. macOS `appId` is `com.pm-all-in-one.desktop`. **`local-pm`** names this workspace library format, not the product. Builds from before 2026-08-11 were still called `Local PM` — do not treat those as the public download.

## What does not hold yet

- **No large-team experiment; active testing stops at 3–5 people.** The small-team collaboration model above is detailed, but it is small-scale dogfood and reasoning, not large-scale validation. Do not write the fit boundary as if it already runs in big companies.
- **Directory isolation is still only a convention.** Nothing stops someone’s AI from crossing lines. A pre-commit hook that checks which directories a commit touched is enough to block that — do not bake it into the product; that starts building a permission system.
- **Broken body references go unnoticed.** Doctor checks sidebar pointers and member refs, but not `@issue-<projectId>::<issueId>` and `@wiki-<id>` in bodies. Delete a node and paragraphs that point at it fail quietly.
- **Shared single files are known conflict points.** `.pm/view-orders.json` (committed), `wiki/sidebar.ts`, and a project’s `custom-props.ts`. Multiple people dragging sort order produce merge conflicts with no right answer.
- **No built-in notifications.** If you need them, pipe git hooks to chat — do not wait for the product.

## Wiki Contents sections

Standing child notes hang under topic sections (read `wiki/sidebar.ts` when choosing `parentId`):

- Positioning thesis: @wiki-hXnkzhcPc1eVN25SwOZ3d
- Disk & data model: @wiki-oU9Fj3_lJOW9pHnLWvqx3
- Agents & CLI: @wiki-YVMDahIyZt0DyMIFOiOfq
- App runtime & UX: @wiki-7aR8hAfpQc9S9cOV7yBMl
