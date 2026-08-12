Whether a 3–10 person company of all vibe-coders can run depends on two things: **the workspace’s disk format**, and **a review surface over that workspace**. Whether the business is software does not matter — as long as everyone’s output lands in the same file set, those two are the whole infrastructure.

A common line is “format matters; UI is a nice-to-have.” Direction right, wording wrong. The accurate line: **format is irreversible; skin is replaceable**. Wrong skin → rewrite a version. Wrong format → every later node, every reference, every agent’s muscle memory grows on the wrong foundation. Priority differs by migration cost, not by value.

## Why format is the base

What is actually valuable is not “having a PM tool.” It is that `@issue-<projectId>::<issueId>` resolves by **joining directory names** — no index, no running process. Meaning: company state can be read by anything. People use a file manager; agents use file-read tools; CI uses grep; some future frontend that does not exist yet uses fs. You did not lock the company inside one process.

Name the advantage carefully: it is not “we use Markdown.” It is that **the resolution rule itself is a pure function**. Many local-first tools still hand references to indexes and plugins to resolve — one skin away from locking state in a process. This is also the one structural advantage others cannot copy: when state lives on someone else’s server, agents only ever get snapshots.

That base depends on something concrete: entity directory ids are **opaque `nanoid(21)` drawn locally**, with no shared counter and no running service. Algorithm and “does the law still hold without the app” → @wiki-kF6sQ8ynVamZ-AL5QzTtc; who should call the allocator and soft-rule limits → @wiki-D9Sd2WYlM-2hdgcXcUbhl.

For an AI-native company this matters more than any PM feature, because **workspace format is also the context protocol**. Every agent session starts by reading `AGENTS.md` (then `.pm/agent.md`) + host-discovered `.agents/skills/` + the disk. That one format plays three roles at once: newcomer onboarding, permission boundary, and company memory — three things traditional companies split across a docs tool, an identity system, and a departed coworker’s head.

The node abstraction (one meta + one README) is what lets non-dev roles enter. A marketing campaign and an engineering epic share the same shape. If the substrate were an issue tracker instead of nodes, non-devs would be forced into semantics designed for engineering on day one.

## “Format” ≠ “format written down”

A format without validators is a wish. Format exists for real only when it lands in layers:

| Layer | Artifact | Blocks | Status |
| --- | --- | --- | --- |
| Types | `custom-props.ts` + generated `schema.d.ts` | Misspelled fields, wrong shape | Present; shape only |
| Shape | `doctor` | Illegal directory names, missing `props.ts`, broken Contents / member refs, bad timestamps | Present |
| Relations | Ladder checks | `parentId` / `level` contradictions, missing parent, cycles | Present, but only shown per-item in the UI |
| Body references | — | `@issue-…` / `@wiki-…` in bodies pointing at deleted nodes | Absent |
| Agent | `AGENTS.md` / `.pm/agent.md` + `.agents/skills/` | Hand-invented ids, hand-edited system fields, invented hierarchy; editorial policy / user conventions live in skills | Present |
| Harness drift | `doctor` `agent-md-outdated` / `agent-md-modified` | `.pm/agent.md` stale vs shipped template, or same rev modified | Present (detect only; no auto-refresh) |

The Status column is intentional: **“a validator exists” and “the validator is reachable by both humans and agents” are different claims.** Relation checks exist today, but only inside one UI render — `doctor` cannot get them, CLI cannot get them. For a team with more agents than people, a check that only exists when a human opens the UI is half a check.

The central law is **reported, never quietly reinterpreted**. The most dangerous AI behavior is not being wrong; it is kindly erasing contradiction — seeing level and parent disagree, “fixing” one field so they agree, so you never know there was a fork. Format’s value pays out in that moment.

But “reported” is incomplete without one more step: **contradictions must leave a trail.** Today every UI open rediscovers them; nothing records “known” or “accepted,” so contradictions neither disappear nor get handled.

Rules like “one session, one zone; contract changes get their own session” look like coding conventions; they are actually a **concurrency-control protocol**. In an all-vibe-coding team, conflicts do not happen on code lines — they happen on intent: two people each open three agents, six paths imagining the same contract differently. Git can merge text; it cannot merge that. Zones are the lock.

## Review surface is an attention allocator, not a display

Once everyone vibe-codes, the bottleneck flips from production to trust. Production is superlinear (3 people can open 15 sessions); review is linear and hard-capped by human waking hours. So everyone’s real role shifts from author to reviewer, and the object of review is a state stream that machines write faster than people read.

What the frontend must answer is therefore not “what does this issue look like,” but:

- What changed — aggregated by node, not by file
- Which two places now contradict each other
- What went stale, **and staleness is a defect**
- Which node has no owner

The third depends on a distinction that already exists: wiki holds current truth — staleness is a defect; project / epic bodies hold this campaign — freeze into history when closed, and staleness is history. That distinction must not stay a writing guide only — it is a first-class primitive for the review UI, telling the surface which staleness to alarm and which to ignore. Most teams’ wikis rot because every page shares one staleness semantics, so nothing alarms.

One concrete rule: **props diffs and body diffs must be separable.** The former is structural change (an agent may quietly change status); the latter is content change. Mixed into one git diff, human eyes miss the former.

That also draws a boundary: only the app can do this; git cannot. Git sees text lines; only the app understands `props.ts` and can say “status changed.” So a **change ledger** (node-aggregated, props vs body columns, able to answer “what changed since last time”) is the piece that must be built in — not something external tools can patch on. It is also the shared prerequisite for three later things: contradiction trails, cross-workspace review, and decision provenance all start from “there is a change stream.”

## Ownership will degrade

Today’s model is 1.0 with no login and collab via git; members and ownership: @wiki-7j0Ak3N2wsnQodOSxSzZ9. Fine for a few people; `git blame` still helps.

But when most commits are produced by agents, blame only tells you “which machine,” not “which decision.” An AI-native company will eventually need “which session, which prompt, on which context produced this change” as first-class fields — session transcripts themselves become referenceable nodes. That is probably the real shape of the identity problem: not login, but **decision provenance**.

That should not grow inside PM. The hard part is at the source: transcripts belong to the agent runner, in private formats, elsewhere on disk. The right move is a separate ingest — land sessions as nodes so issues and wiki can cite them — not new fields on `props.ts`.

## Two uses of paths that cannot both win

Worth naming a pair of patterns: **path-as-identity** (`@issue-<projectId>::<issueId>` resolves by join) and **path-as-state** (a proposal in `open/` is pending review; move it to `history/` and it is active — no database needed to know where something stands).

They look like two faces of one principle — both make the filesystem carry the index — but they exclude each other: **the first requires paths stable for the whole lifecycle; the second requires paths that change with state.** Proposal ledgers can use the latter because proposals have no stable locator and people already read directories; issues must be cited long-term from bodies, agents, and external tools, so this product chooses the former — state lives in `props.ts` `status`, not in where the directory sits.

Write this down because it will keep being proposed: “encode state in the directory so an agent can `ls` once and know the world without reading files.” The cost is every existing reference breaking. Today’s tradeoff is right — stable locators beat `ls`-visible status — but it is a tradeoff, not having both.

## Where the review surface should live

Review surface ≠ “another page inside PM.” The test: **does this need to understand `props.ts` semantics? Is the object of review one project library, or whole-company state?**

- **Must build in:** change ledger, trails for relation checks, and making “staleness is a defect” mechanical (wiki nodes already have `updated`; what is missing is a review-by date). All of these must read props semantics; external tools cannot.
- **Should live elsewhere:** a cross-workspace reviewer. Three of the four questions above (what changed, which two contradict, which is unowned) are cross-repo / cross-domain in a real company; stuffing them into PM grows it into an IDE.
- **Should live elsewhere:** transcript ingest — reasons under “Ownership will degrade.”
- **Do not bake into the product:** boundary enforcement. A git hook that checks which directories a commit touched is enough; baking it in starts building a permission system.

## What does not hold yet

- **No large-team experiment; active testing stops at 3–5 people.** Fit / not-a-fit and the validation boundary are owned by @wiki-6HxCNuSO6tZMP6Te6JRY5. This page is one step further forward — judgment, not experience — do not read the 3–10 person reasoning here as a validated scale.
- **Review surface in the product is zero.** None of the four questions above has a dedicated UI answer today; nothing answers “what changed since last time” either — views are tables and lists, with no time dimension.
- **Contradictions leave no trail.** Relation checks live only inside one UI render and are forgotten when you leave.
- **Body references fail silently.** Delete a node and no one is warned about paragraphs that pointed at it.
- **People pay the format cost; agents collect the benefit.** Small teams easily under-invest for a long time. My judgment (not data): the tipping point is when **concurrent agent sessions exceed headcount** — after that, skipping format investment loses control. That can be measured instead of guessed: record how much format each session reads at start, and how often `doctor` catches violations.
- **No mechanism for semantic fork.** When two people (or two agents) fork the meaning of the same task, text has zero conflicts, checks are green, and the result is wrong. Mechanical vs semantic layering: @wiki-6HxCNuSO6tZMP6Te6JRY5; whether it can be detected is open — it wants a “version of intent,” not a text diff.
- **Format hardens; drift must be visible.** Written law will be obeyed strictly by agents, including when it is wrong. `.pm/agent.md` already has a `rev` stamp + `doctor` `agent-md-outdated` / `agent-md-modified` (detect only; no auto-refresh yet). Large layout mistakes may still need a rebuild; small harness drift at least is no longer silent. So the cost of amending the law must stay low, or teams start bypassing it — and bypasses are silent.
- **Counter-pressure:** if the review surface is so hard that people prefer reading Markdown raw, the format degrades into “a format only agents use,” and humans gradually lose a real feel for state. Skin is not a nice-to-have here — it is the gate that keeps the company from becoming a black box.

## Do not

- Do not treat “format written as docs” as landed — a format without validators is a wish; a validator only humans see in the UI is half a wish.
- Do not let agents silently repair contradictions; keep and report them, and leave a trail.
- Do not use “skin is only a nice-to-have” as an excuse to ship an unusable review surface.
- Do not change format without a migrator — the other half of “format is irreversible” is that format mistakes are irreversible too.
- Do not encode state into paths to save an agent one file read.
- Do not re-expand three-person collab detail, the member model, or the id-draw algorithm on this page — link them so each has one maintainer (three-person: @wiki-6HxCNuSO6tZMP6Te6JRY5; members: @wiki-7j0Ak3N2wsnQodOSxSzZ9; ids: @wiki-kF6sQ8ynVamZ-AL5QzTtc).
