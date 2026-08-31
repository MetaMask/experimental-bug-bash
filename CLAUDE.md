# Bug Bash leaderboard

Static leaderboard for a September 2026 design bug-squashing contest at
MetaMask. Designers on the `DESIGNERS` list (in `scripts/build-leaderboard.mjs`)
score one point per merged PR they author in `metamask-extension` or
`metamask-mobile`. Most merges by month end wins $250. A GitHub Action rebuilds
standings on a cron and publishes to Pages.

## Layout

- `index.html` — the whole site. Vanilla HTML/CSS/JS, no build, no framework.
  Fetches `data.json` at runtime.
- `scripts/build-leaderboard.mjs` — queries the GitHub GraphQL API and writes
  `data.json`. Config block at the top (repos, window, prize, DESIGNERS).
- `data.json` — generated. Committed so the page renders before the first
  Action run. Shape: `totals.{fixes,designers,inFlight}` and a `standings[]`
  of `{login,name,points,inFlight,fixes[],lastFixAt}`.
- `.github/workflows/leaderboard.yml` — cron + Pages deploy.

## Scoring invariants — do not change without asking

These exist because each one closes a specific hole. Preserve them.

1. **Points are counted per merged PR.** One point per PR the designer authored
   that merged inside the window.
2. **Eligibility is the `DESIGNERS` list** in the config block. This is the only
   thing keeping engineers off the board. The PR author must be on the list.
3. **No issue labels.** Labelled issues are not part of scoring. Only the PR
   author, repo, and merge date matter.
4. **The PR must be merged inside the window.** A designer's open PR counts as
   `inFlight` — shown, but worth no points. Closed-without-merge scores nothing.
5. **Only repos in `repos` count.** Work in other MetaMask repos does not score.
6. **Ties break to whoever got there first** — earlier last-merge ranks higher.

## Deliberate design decisions

- **No PAT.** The tracked repos are public, so the `GITHUB_TOKEN` Actions
  provides automatically can read their PRs. Don't reintroduce a PAT or a
  `read:org` scope — an earlier version pulled the roster from a GitHub team
  and needed both, which meant waiting on org approval for no real gain.
- **Blank GitHub profiles show as handles.** That's how those people already
  appear in the repo, so it doesn't read as a bug.
- **Publish the whole roster.** Everyone on `DESIGNERS` appears from day one,
  including zeros. While nobody has scored, the board sorts alphabetically and
  shows a dot instead of a rank so it doesn't imply a winner.
- **A failed name lookup degrades to handles** and the build still succeeds.
  Names are cosmetic; never let them block scoring.
- **Artifacts use no browser storage.** State lives in memory only.

## Visual language

Don't restyle without being asked. MetaMask orange (`#FA4B00`) as a full-bleed
field rather than an accent; Archivo 900 for display, JetBrains Mono for all
data and labels, Inter Tight for prose. The signature element is the mark grid —
one small square per merged PR, so a row reads as a unit bar chart. The leader
row inverts to near-black. Everything else stays quiet.

## Working on this

```sh
# Rebuild standings. Any token with public read works — a classic PAT with no
# scopes ticked is enough, since the target repos are public.
GITHUB_TOKEN=ghp_xxx node scripts/build-leaderboard.mjs

# Preview — must be over http, not file://, or the data.json fetch fails
python3 -m http.server 8000
```

To test scoring without hitting GitHub, stub `globalThis.fetch` and import the
script with a cache-busting nonce prepended (strip the shebang first, or the
nonce pushes `#!` off line one and Node rejects the module). Cases worth keeping
green: empty board, unmerged PR, PR merged after the window, PR in an
untracked repo, and a failed name lookup.

## Out of scope unless asked

Weighted scoring tiers, and awarding points for *finding* a bug someone else
fixes. Both were considered and cut for simplicity.
