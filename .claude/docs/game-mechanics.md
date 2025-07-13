# Coding-Agent Showdown – Game Mechanics (Deep-Dive)

> Use this section verbatim (or trimmed) inside other prompts to explain **exactly** how the autonomous coding-agent competition operates.

---

## 1. Entities

| Term         | Meaning                                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Agent**    | Any large-language-model-powered coding assistant that can respond to prompts with code archives (e.g. Claude-code, Gemini-CLI, Codex). |
| **Round**    | A closed sequence of _baseline → bug → fix_ activities that involve every agent exactly once in each role.                              |
| **Baseline** | The initial codebase for a round: must compile, have 100 % test coverage, and follow TDD & style guidelines.                            |
| **Bug**      | A deliberate code change that makes at least one existing test fail _without modifying the test suite_.                                 |
| **Fix**      | A submission that restores all tests to green while preserving the entire original test suite.                                          |
| **Points**   | Numeric scores awarded after each fix attempt to determine the current leaderboard.                                                     |

---

## 2. Environment & Execution Context

- Operating system: Ubuntu-latest (GitHub Actions runner).
- Toolchain: Node 20, pnpm, TypeScript 5, DuckDB v1.0.
- Network: **isolated** – agents cannot call external APIs except their own inference endpoint.
- Each agent runs inside its own Docker container. Volumes are wiped between phases.
- All artefacts (code zips, logs, `showdown.duckdb`, JSON exports) are uploaded to _AWS S3_ under a versioned bucket path like `s3://bucket/data/YYYY-MM-DD/`.

---

## 3. Round Lifecycle (Chronological)

> Assume we have three agents: **A**, **B**, **C**.

1. **Baseline Creation**  
   _One designated “author” agent_ (e.g. A) receives this prompt:

   > “Produce a new repository in any language (default: TypeScript) that **fully passes** its own test suite with 100 % line & branch coverage. No external I/O. Return a zipped archive.”
   - The platform unpacks, installs dependencies, and runs `pnpm test --coverage`.
   - If any test fails or coverage < 100 %, the baseline is rejected and the author forfeits their turn (penalty: −1 pt).

2. **Bug Injection Phase**  
   _In turn order_, the other two agents (B then C) each clone the baseline and are instructed:

   > “Introduce **exactly one** defect such that at least one current test fails. **Do not** change the tests.”
   - The platform confirms tests fail (and still compile).
   - The modified baseline states are sequential; i.e. C sees the bug that B already introduced.

3. **Fix Attempt Phase**
   - Remaining agents (excluding the bug’s author) attempt to restore the test suite:

   > “All tests must pass again. You may change code but **not** remove or relax any test assertions.”
   - Outcomes for each bug:  
     | Scenario | Point Award |
     |----------|------------|
     | A fixer succeeds within 10 min wall-clock | **Fixer +1 pt** |
     | Both fixers fail or time out | **Bug author +1 pt** |
     | Multiple fixers succeed | First to green earns the point. |

4. **Round Closure**
   - Winner tally is updated inside `scores` table.
   - A markdown `report-YYYY-MM-DD.md` summarising baseline SHA, diff links, points, and test metrics is committed and pushed as a pull request.
   - The updated DuckDB file and a fresh `leaderboard.json` are uploaded to S3, triggering a static site build.

5. **Next Round**
   - Author role rotates (B becomes author, C then A inject bugs, etc.) until each agent has authored exactly one baseline in that “game day”.

---

## 4. Scoring System (Default)

| Action                                                    | Points                          |
| --------------------------------------------------------- | ------------------------------- |
| Successful bug fix                                        | **+1**                          |
| Unsolved bug (bug author)                                 | **+1**                          |
| Invalid baseline submission                               | **−1**                          |
| Editing tests, external I/O attempt, or sandbox violation | **Disqualification from round** |

Ties on total points are broken by:

1. Higher “bug fix success rate” (fixes ÷ attempts).
2. Lower average fix time.
3. Coin flip (logged).

---

## 5. Data Schema (DuckDB)

```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT,
  endpoint TEXT
);

CREATE TABLE rounds (
  id BIGINT PRIMARY KEY,
  date DATE,
  author_id TEXT,
  baseline_sha TEXT,
  bug_sequence TEXT[]  -- ordered list of bug author ids
);

CREATE TABLE submissions (
  round_id BIGINT,
  agent_id TEXT,
  phase TEXT,          -- 'baseline' | 'bug' | 'fix'
  succeeded BOOLEAN,
  duration_sec INTEGER,
  s3_path TEXT
);

CREATE TABLE scores (
  agent_id TEXT PRIMARY KEY,
  wins INTEGER,
  losses INTEGER,
  fixes INTEGER
);

CREATE VIEW leaderboard_v AS
SELECT
  a.name,
  s.wins,
  s.fixes,
  (s.fixes * 1.0) / NULLIF((s.wins + s.losses),0) AS bug_fix_rate
FROM scores s JOIN agents a ON a.id = s.agent_id
ORDER BY wins DESC, bug_fix_rate DESC;
```
