#!/usr/bin/env node
/**
 * Builds data.json for the Bug Bash leaderboard.
 *
 * Scoring rule: one point per issue carrying ALL the required labels that gets
 * closed by a merged PR authored by someone on the DESIGNERS list, merged inside
 * the contest window. The issue itself can be any age — fixing old bugs counts.
 *
 * Points are counted per ISSUE, so splitting one fix across several PRs still
 * scores once. The DESIGNERS list is the only thing keeping engineers off the
 * board, so keep it current.
 *
 * Auth: `metamask-mobile` is a public repo, so the GITHUB_TOKEN that Actions
 * provides automatically is enough — no PAT, no org approval. Running locally
 * needs any token with public read (a classic token with no scopes works).
 */

import { writeFile } from "node:fs/promises";

// ── Contest config ──────────────────────────────────────────────
// TEMPORARY: fixture repo so we can preview scoring on Pages.
// Revert to MetaMask/metamask-mobile, labels ["type-bug", "design"],
// window 2026-09-01..2026-09-30 before the contest.
const repo = "andrewjcohen/bug-bash-scorer-fixture";
// An issue must carry ALL of these to count.
const labels = ["type-bug", "Design"];
const win = { start: "2026-08-26", end: "2026-08-31" };
const prize = "$200";

// Who's eligible. Handles only — display names come from GitHub profiles.
// Add a starter here and they appear on the board on the next run.
const DESIGNERS = [
  "andrewjcohen",
  "jasonculbertson",
  "georgewrmarshall",
  "brianacnguyen",
  "georakusen",
  "joshuaphiloctete",
  "yanrong-chen",
  "coreyjanssen",
  "amandaye0h",
  "rmkk1234",
  "jessup",
  "alidotforrest",
  "andrewchra",
  "thatsjustthewayitis",
  "nikki-p-h-12",
  "ragkandala",
  "mmragkandala",
];
// ────────────────────────────────────────────────────────────────

const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error("Missing GITHUB_TOKEN");
  process.exit(1);
}

const startsAt = new Date(`${win.start}T00:00:00Z`);
const endsAt = new Date(`${win.end}T23:59:59Z`);

const QUERY = `
  query($q: String!, $cursor: String) {
    search(query: $q, type: ISSUE, first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        ... on Issue {
          number
          title
          url
          state
          createdAt
          author { login }
          closedByPullRequestsReferences(first: 10, includeClosedPrs: true) {
            nodes {
              number
              url
              merged
              mergedAt
              author { login }
            }
          }
        }
      }
    }
  }
`;

async function gql(query, variables = {}) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`GitHub returned ${res.status} ${res.statusText}`);
  }

  const body = await res.json();
  if (body.errors?.length) {
    throw new Error(body.errors.map((e) => e.message).join("; "));
  }
  return body.data;
}

// Display names only. Public user data, so the built-in token can read it.
async function fetchNames(logins) {
  if (!logins.length) return {};
  const fields = logins
    .map((l, i) => `u${i}: user(login: ${JSON.stringify(l)}) { login name }`)
    .join("\n");
  try {
    const data = await gql(`query { ${fields} }`);
    return Object.fromEntries(
      Object.values(data)
        .filter((u) => u?.login)
        .map((u) => [u.login.toLowerCase(), u.name || u.login]),
    );
  } catch (err) {
    // A renamed or deleted account shouldn't take the board down. Falling back
    // to handles is cosmetic; scoring is unaffected.
    console.warn(`Couldn't resolve display names: ${err.message}`);
    return {};
  }
}

// Every labeled issue in the repo, any age. Old bugs are fair game.
const issues = [];
let cursor = null;
do {
  const data = await gql(QUERY, {
    q: [`repo:${repo}`, "is:issue", ...labels.map((l) => `label:"${l}"`)].join(" "),
    cursor,
  });
  issues.push(...data.search.nodes.filter(Boolean));
  cursor = data.search.pageInfo.hasNextPage ? data.search.pageInfo.endCursor : null;
} while (cursor);

const designers = new Set(DESIGNERS.map((l) => l.toLowerCase()));
const names = await fetchNames(DESIGNERS);

// Seed a row per designer so the whole team shows from day one.
const board = new Map(
  DESIGNERS.map((login) => {
    const key = login.toLowerCase();
    return [key, { login, name: names[key] || login, points: 0, inFlight: 0, fixes: [] }];
  }),
);

let fixedByOthers = 0; // labeled issues closed in-window by non-designers

for (const issue of issues) {
  const prs = issue.closedByPullRequestsReferences?.nodes ?? [];

  // Earliest PR merged inside the window that closes this issue. The issue's
  // own age is irrelevant — fixing an old bug counts.
  const closer = prs
    .filter((pr) => pr?.merged && pr.mergedAt)
    .filter((pr) => {
      const at = new Date(pr.mergedAt);
      return at >= startsAt && at <= endsAt;
    })
    .sort((a, b) => new Date(a.mergedAt) - new Date(b.mergedAt))[0];

  if (!closer) {
    // No merged fix yet. If a designer has an open PR against it, that's work
    // in flight and worth showing.
    const open = prs.find((pr) => pr && !pr.merged && designers.has(pr.author?.login?.toLowerCase()));
    if (open) board.get(open.author.login.toLowerCase()).inFlight += 1;
    continue;
  }

  const login = closer.author?.login?.toLowerCase();
  if (!login || !designers.has(login)) {
    fixedByOthers += 1; // an engineer got there first
    continue;
  }

  const scorer = board.get(login);
  scorer.points += 1;
  scorer.fixes.push({
    issue: issue.number,
    title: issue.title,
    url: issue.url,
    filedAt: issue.createdAt,
    pr: closer.number,
    prUrl: closer.url,
    mergedAt: closer.mergedAt,
  });
}

// Display names come from GitHub profiles. A blank profile shows as the handle,
// which is how that person already appears in the repo anyway.
const standings = [...board.values()]
  .map((row) => ({
    ...row,
    fixes: row.fixes.sort((a, b) => new Date(b.mergedAt) - new Date(a.mergedAt)),
    lastFixAt: row.fixes.length
      ? row.fixes.reduce((a, b) => (new Date(a.mergedAt) > new Date(b.mergedAt) ? a : b)).mergedAt
      : null,
  }))
  // Points first. Ties break to whoever got there first.
  .sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (a.lastFixAt && b.lastFixAt) return new Date(a.lastFixAt) - new Date(b.lastFixAt);
    if (a.lastFixAt) return -1;
    if (b.lastFixAt) return 1;
    return a.name.localeCompare(b.name);
  });

const out = {
  updatedAt: new Date().toISOString(),
  repo,
  labels,
  window: win,
  prize,
  totals: {
    fixes: standings.reduce((n, r) => n + r.points, 0),
    designers: standings.length,
    inFlight: standings.reduce((n, r) => n + r.inFlight, 0),
    fixedByOthers,
  },
  standings,
};

await writeFile(new URL("../data.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");

console.log(
  `${out.totals.fixes} fixes by ${standings.filter((r) => r.points).length} of ` +
    `${standings.length} designers, ${out.totals.inFlight} in flight. Wrote data.json.`,
);
