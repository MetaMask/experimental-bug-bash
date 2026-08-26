# Bug Bash leaderboard

Static leaderboard for a September 2026 design bug-squashing contest at
MetaMask. Designers on the `DESIGNERS` list (in `scripts/build-leaderboard.mjs`)
fix `type-bug` + `design` labeled issues in `MetaMask/metamask-mobile` — any
age, backlog counts. Most fixes by month end wins $200. A GitHub Action rebuilds
standings on a cron and publishes to Pages.

## Layout

- `index.html` — the whole site. Vanilla HTML/CSS/JS, no build, no framework.
  Fetches `data.json` at runtime.
- `scripts/build-leaderboard.mjs` — queries the GitHub GraphQL API and writes
  `data.json`. Config block at the top (repo, labels, window, prize).
- `data.json` — generated. Committed so the page renders before the first
  Action run. Shape: `totals.{fixes,designers,inFlight,fixedByOthers}` and a
  `standings[]` of `{login,name,points,inFlight,fixes[],lastFixAt}`.
- `.github/workflows/leaderboard.yml` — cron + Pages deploy.

## Scoring invariants — do not change without asking

These exist because each one closes a specific hole. Preserve them.

1. **Points are counted per ISSUE, never per PR.** Splitting one fix across
   several PRs must score once.
2. **Eligibility is the `DESIGNERS` list** in the config block. This is the only
   thing keeping engineers off the board. The PR author must be on the list; the
   issue author is irrelevant.
3. **Issue age does not matter.** Fixing an old backlog bug counts the same as
   fixing one found this month. Do not reintroduce a creation-date filter.
4. **An issue must carry every label in `labels`.** It's an AND, not an OR.
5. **The PR must be merged inside the window.** A designer's open PR counts as
   `inFlight` — shown, but worth no points.
6. **Ties break to whoever got there first** — earlier last-merge ranks higher.

## Deliberate design decisions

- **No PAT.** `metamask-mobile` is public, so the `GITHUB_TOKEN` Actions provides
  automatically can read its issues and PRs. Don't reintroduce a PAT or a
  `read:org` scope — an earlier version pulled the roster from a GitHub team and
  needed both, which meant waiting on org approval for no real gain.
- **Blank GitHub profiles show as handles.** That's how those people already
  appear in the repo, so it doesn't read as a bug.
- **A failed name lookup degrades to handles** and the build still succeeds.
  Names are cosmetic; never let them block scoring.
- **Day one is an empty board by design.** The empty state is the most-viewed
  screen of the month; it's a call to action with the labels pre-applied in the
  new-issue URL. Don't downgrade it to a placeholder row.
- **Don't list designers at zero.** A row appears only after a merge or an
  in-flight PR. Publishing the whole roster at 0 reads as a ranking of who
  hasn't started.
- **No rank numbers until someone scores.** While all points are zero the board
  sorts alphabetically and shows a dot instead of a rank, so it doesn't imply
  that whoever sorts first is winning.
- **Artifacts use no browser storage.** State lives in memory only.

## Visual language

Don't restyle without being asked. MetaMask orange (`#FA4B00`) as a full-bleed
field rather than an accent; Archivo 900 for display, JetBrains Mono for all
data and labels, Inter Tight for prose. The signature element is the mark grid —
one small square per merged fix, so a row reads as a unit bar chart. The leader
row inverts to near-black. Everything else stays quiet.

## Working on this

```sh
# Rebuild standings. Any token with public read works — a classic PAT with no
# scopes ticked is enough, since the target repo is public.
GITHUB_TOKEN=ghp_xxx node scripts/build-leaderboard.mjs

# Preview — must be over http, not file://, or the data.json fetch fails
python3 -m http.server 8000
```

To test scoring without hitting GitHub, stub `globalThis.fetch` and import the
script with a cache-busting nonce prepended (strip the shebang first, or the
nonce pushes `#!` off line one and Node rejects the module). Cases worth keeping
green: empty board, split PRs, engineer-closed issue, unmerged PR, PR merged
after the window, an old (pre-window) issue fixed in-window, and a failed name
lookup.

## Out of scope unless asked

Reading more than one repo (MMDS is not currently included), weighted scoring
tiers, and awarding points for *finding* a bug someone else fixes. All three
were considered and cut for simplicity.
