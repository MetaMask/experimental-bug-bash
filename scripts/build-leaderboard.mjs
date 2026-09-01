#!/usr/bin/env node
/**
 * Builds data.json for the PR Party leaderboard.
 *
 * Scoring rule: one point per merged pull request authored by a member of the
 * MetaMask/design GitHub team, merged inside the contest window, in any repo in
 * `repos`. Open PRs by those authors count as inFlight (shown, no points).
 *
 * Auth: needs a token that can read the closed MetaMask/design team (Members:Read
 * / read:org). Prefer running from a MetaMask org repo so Actions GITHUB_TOKEN
 * can be granted that access; otherwise set LEADERBOARD_TOKEN. Public repo PR
 * reads still work with any public-read token once the roster is resolved.
 */

import { writeFile } from "node:fs/promises";

// ── Contest config ──────────────────────────────────────────────
const repos = [
  "MetaMask/metamask-extension",
  "MetaMask/metamask-mobile",
];
const org = "MetaMask";
const team = "design";
// Handles on the team who are not in the contest (managers, etc.). Case-insensitive.
const exclude = [
  "amandaye0h",
  "andrewjcohen",
  "brianacnguyen",
  "ciarakeane",
  "coreyjanssen",
  "georakusen",
  "georgewrmarshall",
  "hilvmason",
  "jasonculbertson",
];
const win = { start: "2026-09-01", end: "2026-09-30" };
const prize = "$250";
// ────────────────────────────────────────────────────────────────

const TOKEN = process.env.LEADERBOARD_TOKEN || process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error("Missing GITHUB_TOKEN (or LEADERBOARD_TOKEN)");
  process.exit(1);
}

// Inclusive UTC bounds. GitHub's `merged:` search is day-granular and can be
// timezone-fuzzy at the edges, so we re-check mergedAt after the query.
const startsAt = new Date(`${win.start}T00:00:00.000Z`);
const endsAt = new Date(`${win.end}T23:59:59.999Z`);

const inWindow = (iso) => {
  if (!iso) return false;
  const at = new Date(iso);
  return at >= startsAt && at <= endsAt;
};

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

const TEAM_MEMBERS_QUERY = `
  query($org: String!, $slug: String!, $cursor: String) {
    organization(login: $org) {
      team(slug: $slug) {
        name
        members(first: 100, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes { login }
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

/** Roster comes from @MetaMask/design. Fail loud — a silent empty board is worse. */
async function fetchTeamLogins() {
  const logins = [];
  let cursor = null;
  let teamName = team;

  do {
    let data;
    try {
      data = await gql(TEAM_MEMBERS_QUERY, { org, slug: team, cursor });
    } catch (err) {
      throw new Error(
        `Could not read @${org}/${team} members: ${err.message}. ` +
          `Need Members:Read (or read:org) on the token, and this repo should live under ${org}.`,
      );
    }

    const t = data.organization?.team;
    if (!t) {
      throw new Error(
        `Team @${org}/${team} not found or not visible to this token. ` +
          `Confirm the slug and that the token can read closed org teams.`,
      );
    }

    teamName = t.name || teamName;
    for (const node of t.members.nodes) {
      if (node?.login) logins.push(node.login);
    }
    cursor = t.members.pageInfo.hasNextPage ? t.members.pageInfo.endCursor : null;
  } while (cursor);

  if (!logins.length) {
    throw new Error(
      `Team @${org}/${team} returned zero members. Refusing to publish an empty roster.`,
    );
  }

  // Preserve GitHub casing; dedupe case-insensitively.
  const seen = new Map();
  for (const login of logins) {
    const key = login.toLowerCase();
    if (!seen.has(key)) seen.set(key, login);
  }
  const unique = [...seen.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  const skip = new Set(exclude.map((l) => l.toLowerCase()));
  const filtered = unique.filter((l) => !skip.has(l.toLowerCase()));
  const dropped = unique.length - filtered.length;
  console.log(
    `Roster: ${filtered.length} members from @${org}/${team} (${teamName})` +
      (dropped ? `, excluded ${dropped}` : "") +
      ".",
  );
  if (!filtered.length) {
    throw new Error(
      `After excludes, @${org}/${team} roster is empty. Check the exclude list.`,
    );
  }
  return filtered;
}

// Display names only. Public user data, so a public-read token can fetch it.
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

const DESIGNERS = await fetchTeamLogins();
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
    if (!pr.merged || !inWindow(pr.mergedAt)) continue;
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
  org,
  team,
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
