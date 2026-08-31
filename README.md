# Bug Bash leaderboard

Static leaderboard for the September design bug bash. A GitHub Action rebuilds
standings on a cron and publishes to Pages.

Five files. No token, no dependencies.

## The rule

One point per issue labelled `design-papercut` that you close with a merged PR
you authored, merged by 30 September. The issue can be any age — fixing old
backlog bugs counts the same as fixing something you just found.

- **Counted per issue.** Splitting one fix across several PRs still scores once.
- **Eligibility is the `DESIGNERS` list** at the top of the build script. Who
  filed the issue doesn't matter, which is the point: most old bugs were filed
  by engineers or QA.
- **Nothing counts until it's on `main`.** A designer's open PR shows as "in
  flight" and scores nothing.

## No token to request

`metamask-mobile` is a public repo, so the `GITHUB_TOKEN` that Actions provides
automatically can read its issues and pull requests. There's no PAT to create
and no org approval to wait on.

Eligibility is a list of ~15 handles in the config block. Display names come
from GitHub profiles at build time; a blank profile shows as the handle, which
is how that person already appears in the repo. If the name lookup fails, the
board falls back to handles and still builds.

To add a designer, add their handle and push. They appear on the next run.

Day one shows a "browse the backlog" call to action linking to open issues with
the `design-papercut` label, since the backlog is where entries come from.

## Setup (about 15 minutes)

1. **Create this repo.**
2. **Confirm the label.** `design-papercut` must exist in `metamask-mobile`
   with that exact spelling — a mismatch returns an empty board, not an error.
3. **Enable Pages**: Settings → Pages → Source → GitHub Actions.
4. **Run it once by hand** — Actions → Bug Bash leaderboard → Run workflow.

To change the repo, labels, dates, or prize, edit the config block at the top of
`scripts/build-leaderboard.mjs`. `labels` is an array and every entry must be
present on an issue for it to count.

## Running it locally

```sh
GITHUB_TOKEN=ghp_xxx node scripts/build-leaderboard.mjs
python3 -m http.server 8000   # then open localhost:8000
```

## Before the 1st

**Check the `DESIGNERS` list.** It's the only thing keeping engineers off the
board, and a wrong handle is a silent zero for that person. The workflow log
prints the roster size on every run.

**Labels matter much less now.** Designers mostly won't be applying them, since
they're working already-labeled backlog issues. The Triage-permission problem
only bites people filing something new.

**The board now measures September output, not contest entries.** Any design bug
a designer closes in September counts, whether they were playing or not. Someone
could win without knowing there was a contest. That's defensible — the VP wants
bugs fixed — but say it plainly rather than letting someone discover it.

**Nobody has to find anything.** Finding is no longer rewarded separately, so
expect people to work the existing backlog rather than hunt. If you want hunting,
that needs a separate incentive.

**Decide whether MMDS repo fixes count.** The script reads one repo. If design
system work is in scope, that's a small change to accept an array.

## Things worth knowing

**Watch the merge queue in week four.** A designer can do the best work on the
team and still finish with PRs stuck in review. Give eng leads a heads-up to
prioritize anything labeled `design-papercut`, or you have accidentally measured review
latency instead of design output.

**Fixes by other people are tracked but don't score.** They land in
`totals.fixedByOthers`. Useful signal, no points.

**A label typo shows as an empty board.** If the label spelling doesn't match
the repo exactly, the query returns nothing and the page looks like nobody
entered. Run the workflow by hand once against a real labeled issue before the 1st.

**The first-PR cliff is the real risk.** Pods, Android SDK, env vars, yarn.
Someone who burns three hours before the app boots is out of the contest and
won't say why. A 30-minute setup call on the 1st and a pinned working `.js.env`
will move participation more than anything on this page.
