# PR Party leaderboard

Static leaderboard for a September 2026 design contest at MetaMask. Roster is
the GitHub team `@MetaMask/design`. One point per merged PR a member authors in
`metamask-extension` or `metamask-mobile`. Most merges by month end wins $250.
A GitHub Action rebuilds standings on a cron and publishes to Pages.

## Layout

- `index.html` — the whole site. Vanilla HTML/CSS/JS, no build, no framework.
  Fetches `data.json` at runtime.
- `scripts/build-leaderboard.mjs` — queries the GitHub GraphQL API and writes
  `data.json`. Config block at the top (org, team, repos, window, prize).
- `data.json` — generated. Committed so the page renders before the first
  Action run. Shape: `totals.{fixes,designers,inFlight}` and a `standings[]`
  of `{login,name,points,inFlight,fixes[],lastFixAt}`.
- `.github/workflows/leaderboard.yml` — cron + Pages deploy.

## Scoring invariants — do not change without asking

These exist because each one closes a specific hole. Preserve them.

1. **Points are counted per merged PR.** One point per PR a roster member
   authored that merged inside the window.
2. **Eligibility is `@MetaMask/design`.** The PR author must be on that GitHub
   team at build time. Do not reintroduce a hardcoded handle list.
3. **No issue labels.** Labelled issues are not part of scoring. Only the PR
   author, repo, and merge date matter.
4. **The PR must be merged inside the window.** A designer's open PR counts as
   `inFlight` — shown, but worth no points. Closed-without-merge scores nothing.
5. **Only repos in `repos` count.** Work in other MetaMask repos does not score.
6. **Ties break to whoever got there first** — earlier last-merge ranks higher.

## Deliberate design decisions

- **Org-hosted repo.** Lives under `MetaMask/` so Pages and secrets sit with
  the org. The built-in Actions `GITHUB_TOKEN` still cannot read closed team
  members — that needs `LEADERBOARD_TOKEN` (classic `read:org`, or fine-grained
  Members: Read). Prefer an org/repo secret over a personal-account PAT when
  possible.
- **Fail loud on roster fetch.** A 403 or empty team must fail the build. Never
  publish an empty board from a silent auth miss.
- **Blank GitHub profiles show as handles.** That's how those people already
  appear in the repo, so it doesn't read as a bug.
- **A failed name lookup degrades to handles** and the build still succeeds.
  Names are cosmetic; never let them block scoring.
- **Publish the whole roster.** Everyone on `@MetaMask/design` appears from day
  one, including zeros. While nobody has scored, the board sorts alphabetically
  and shows a dot instead of a rank so it doesn't imply a winner.
- **Artifacts use no browser storage.** State lives in memory only.

## Visual language

Don't restyle without being asked. MetaMask orange (`#FA4B00`) as a full-bleed
field rather than an accent; Archivo 900 for display, JetBrains Mono for all
data and labels, Inter Tight for prose. The signature element is the mark grid —
one small square per merged PR, so a row reads as a unit bar chart. The leader
row inverts to near-black. Everything else stays quiet.

## Working on this

```sh
# Rebuild standings. Needs a token that can read @MetaMask/design members.
LEADERBOARD_TOKEN=ghp_xxx node scripts/build-leaderboard.mjs

# Preview — must be over http, not file://, or the data.json fetch fails
python3 -m http.server 8000
```

To test scoring without hitting GitHub, stub `globalThis.fetch` and import the
script with a cache-busting nonce prepended (strip the shebang first, or the
nonce pushes `#!` off line one and Node rejects the module). Cases worth keeping
green: empty board, unmerged PR, PR merged after the window, PR in an
untracked repo, team fetch 403, and a failed name lookup.

## Out of scope unless asked

Weighted scoring tiers, and awarding points for *finding* a bug someone else
fixes. Both were considered and cut for simplicity.
