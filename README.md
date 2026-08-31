# PR Party leaderboard

Static leaderboard for the September MetaMask Design PR Party. A GitHub Action
rebuilds standings on a cron and publishes to Pages.

Lives at `MetaMask/design-bug-bash`. No dependencies.

## The rule

Merge a pull request into `metamask-extension` or `metamask-mobile` for a point.
You must be on the GitHub team `@MetaMask/design`. Merges must land by 30
September.

- **Counted per merged PR.** Each of your merges scores once.
- **Eligibility is `@MetaMask/design`.** Roster is fetched from that team on
  every build — no hardcoded handle list.
- **Nothing counts until it's on `main`.** Open PRs show as "in flight" and
  score nothing. Closed-without-merge scores nothing.

## Token for the roster

The Actions `GITHUB_TOKEN` cannot read org team members. Create a classic PAT
with `read:org`, or a fine-grained token with **Organization → Members: Read**
on MetaMask, and store it as the repo (or org) secret `LEADERBOARD_TOKEN`.

Without that secret the build fails on purpose — better a red Action than an
empty board.

Public PR search for scoring works with the same token.

## Setup

1. Repo under `MetaMask/` (this one was transferred from a personal account).
2. **Secret:** Settings → Secrets → Actions → `LEADERBOARD_TOKEN`.
3. **Enable Pages:** Settings → Pages → Source → GitHub Actions.
4. **Run once by hand** — Actions → PR Party leaderboard → Run workflow.

To change the team, repos, dates, or prize, edit the config block at the top of
`scripts/build-leaderboard.mjs`.

## Running it locally

```sh
LEADERBOARD_TOKEN=ghp_xxx node scripts/build-leaderboard.mjs
python3 -m http.server 8000   # then open localhost:8000
```

## Before the 1st

**Confirm `@MetaMask/design` membership.** Anyone missing from that team is a
silent zero (they never appear). The workflow log prints roster size every run.

**The board measures September merges.** Any PR a design-team member merges into
extension or mobile in September counts, whether they were playing or not.

## Things worth knowing

**Watch the merge queue in week four.** Give eng leads a heads-up to prioritize
designer PRs in extension and mobile, or you measure review latency instead of
output.

**The first-PR cliff is the real risk.** Pods, Android SDK, env vars, yarn. A
30-minute setup call on the 1st moves participation more than anything on this
page.
