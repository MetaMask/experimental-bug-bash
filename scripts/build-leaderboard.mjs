#!/usr/bin/env node
/**
 * Builds data.json for the Bug Bash leaderboard.
 *
 * Scoring rule: one point per merged pull request authored by someone on the
 * DESIGNERS list, merged inside the contest window, in any repo in `repos`.
 * Open PRs by those authors count as inFlight (shown, no points).
 *
 * Auth: the tracked repos are public, so the GITHUB_TOKEN that Actions provides
 * automatically is enough — no PAT, no org approval. Running locally needs any
 * token with public read (a classic token with no scopes works).
 */

import { writeFile } from "node:fs/promises";

// ── Contest config ──────────────────────────────────────────────
const repos = [
  "MetaMask/metamask-mobile",
  "MetaMask/metamask-extension",
  "MetaMask/metamask-design-system",
];
const win = { start: "2026-09-01", end: "2026-09-30" };
const prize = "$250";

// Who's eligible. Handles only — display names come from GitHub profiles.
// Add a starter here and they appear on the board on the next run.
const DESIGNERS = [
  "joshuaphiloctete",
  "yanrong-chen",
  "rmkk1234",
  "jessup",
  "alidotforrest",
  "andrewchra",
  "nikki-p-h-12",
  "ragkandala",
  "amamahfer",
  "thatsjustthewayitis",
];
// ────────────────────────────────────────────────────────────────

const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error("Missing GITHUB_TOKEN");
  process.exit(1);
}

const QUERY = `
  query($q: String!, $cursor: String) {
    search(query: $q, type: ISSUE, first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        ... on PullRequest {
          number
          title
          url
          merged
          mergedAt
          author { login }
          repository { nameWithOwner }
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

async function searchPulls(parts) {
  const found = [];
  let cursor = null;
  const q = [...parts, ...repos.map((r) => `repo:${r}`)].join(" ");
  do {
    const data = await gql(QUERY, { q, cursor });
    found.push(...data.search.nodes.filter(Boolean));
    cursor = data.search.pageInfo.hasNextPage ? data.search.pageInfo.endCursor : null;
  } while (cursor);
  return found;
}

const names = await fetchNames(DESIGNERS);

// Score into a row per designer. Everyone on the roster is published, including
// zeros, so the board reads as the full field from day one.
const board = new Map(
  DESIGNERS.map((login) => {
    const key = login.toLowerCase();
    return [key, { login, name: names[key] || login, points: 0, inFlight: 0, fixes: [] }];
  }),
);

for (const login of DESIGNERS) {
  const key = login.toLowerCase();
  const scorer = board.get(key);

  const merged = await searchPulls([
    "is:pr",
    "is:merged",
    `author:${login}`,
    `merged:${win.start}..${win.end}`,
  ]);

  for (const pr of merged) {
    scorer.points += 1;
    scorer.fixes.push({
      repo: pr.repository?.nameWithOwner,
      pr: pr.number,
      title: pr.title,
      url: pr.url,
      mergedAt: pr.mergedAt,
    });
  }

  const open = await searchPulls(["is:pr", "is:open", `author:${login}`]);
  scorer.inFlight = open.length;
}

// Always publish every designer, including zeros — the roster is the board.
const standings = [...board.values()]
  .map((row) => ({
    ...row,
    fixes: row.fixes.sort((a, b) => new Date(b.mergedAt) - new Date(a.mergedAt)),
    lastFixAt: row.fixes.length
      ? row.fixes.reduce((a, b) => (new Date(a.mergedAt) > new Date(b.mergedAt) ? a : b)).mergedAt
      : null,
  }))
  // Points first. Ties break to whoever got there first. All-zero sorts A–Z.
  .sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (a.lastFixAt && b.lastFixAt) return new Date(a.lastFixAt) - new Date(b.lastFixAt);
    if (a.lastFixAt) return -1;
    if (b.lastFixAt) return 1;
    return a.name.localeCompare(b.name);
  });

const out = {
  updatedAt: new Date().toISOString(),
  repos,
  window: win,
  prize,
  totals: {
    fixes: standings.reduce((n, r) => n + r.points, 0),
    designers: DESIGNERS.length,
    inFlight: standings.reduce((n, r) => n + r.inFlight, 0),
  },
  standings,
};

await writeFile(new URL("../data.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");

console.log(
  `${out.totals.fixes} PRs by ${standings.filter((r) => r.points).length} of ` +
    `${DESIGNERS.length} designers, ${out.totals.inFlight} in flight across ` +
    `${repos.length} repos. Wrote data.json.`,
);
