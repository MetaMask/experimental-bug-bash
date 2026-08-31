# Bug Bash leaderboard

Static leaderboard for the September design bug bash. A GitHub Action rebuilds
standings on a cron and publishes to Pages.

Five files. No token, no dependencies.

## The rule

One point per pull request you author that merges into `metamask-mobile`,
`metamask-extension`, or `metamask-design-system` by 30 September. No issue
labels required.

- **Counted per merged PR.** Each of your merges scores once.
- **Eligibility is the `DESIGNERS` list** at the top of the build script.
- **Nothing counts until it's on `main`.** A designer's open PR shows as "in
  flight" and scores nothing. Closed-without-merge scores nothing.

## No token to request

The tracked repos are public, so the `GITHUB_TOKEN` that Actions provides
automatically can read their pull requests. There's no PAT to create and no org
approval to wait on.

Eligibility is a list of handles in the config block. Display names come from
GitHub profiles at build time; a blank profile shows as the handle, which is how
that person already appears in the repo. If the name lookup fails, the board
falls back to handles and still builds.

To add a designer, add their handle and push. They appear on the next run.

Day one lists the full roster at zero, sorted alphabetically with dots instead
of ranks so it doesn't imply a winner.

## Setup (about 15 minutes)

1. **Create this repo.**
2. **Enable Pages**: Settings → Pages → Source → GitHub Actions.
3. **Run it once by hand** — Actions → Bug Bash leaderboard → Run workflow.

To change the repos, dates, prize, or roster, edit the config block at the top
of `scripts/build-leaderboard.mjs`. `repos` is an array; merges in every entry
score the same.

## Running it locally

```sh
GITHUB_TOKEN=ghp_xxx node scripts/build-leaderboard.mjs
python3 -m http.server 8000   # then open localhost:8000
```

## Before the 1st

**Check the `DESIGNERS` list.** It's the only thing keeping engineers off the
board, and a wrong handle is a silent zero for that person. The workflow log
prints the roster size on every run.

**The board measures September merges, not contest entries.** Any PR a designer
merges into a tracked repo in September counts, whether they were playing or
not. Someone could win without knowing there was a contest. That's defensible —
the VP wants shipping — but say it plainly rather than letting someone discover
it.

## Things worth knowing

**Watch the merge queue in week four.** A designer can do the best work on the
team and still finish with PRs stuck in review. Give eng leads a heads-up to
prioritize designer PRs in the three tracked repos, or you have accidentally
measured review latency instead of output.

**The first-PR cliff is the real risk.** Pods, Android SDK, env vars, yarn.
Someone who burns three hours before the app boots is out of the contest and
won't say why. A 30-minute setup call on the 1st and a pinned working `.js.env`
will move participation more than anything on this page.
