# Minimal Tech Stack

## 1. Monorepo Layout (pnpm workspaces)

```

repo/
├─ apps/
│   ├─ website/          # Astro static site
│   └─ runner/           # Node CLI that plays the game
├─ packages/
│   └─ db/               # Thin DuckDB helpers

```

- **TypeScript 5.x** (strict)
- **Node 20** runtime (LTS)

## 2. Data Layer

| Component        | Choice                        | Rationale                   |
| ---------------- | ----------------------------- | --------------------------- |
| Relational store | **DuckDB** (file‐based)       | Zero infra, great analytics |
| Storage          | **AWS S3** (versioned bucket) | Cheap, durable              |

### How it Works

- Runner downloads `showdown.duckdb` from S3 → plays game → writes results.
- Runner exports query `SELECT * FROM leaderboard_v;` to `leaderboard.json` then uploads both DB & JSON back to S3.
- Astro build fetches `leaderboard.json` at build-time (via signed URL) → embeds in HTML → site is 100 % static.

## 3. Front-end

| Tool             | Purpose                             |
| ---------------- | ----------------------------------- |
| **Astro**        | Generates static HTML/JS at CI time |
| **Tailwind CSS** | Lightweight utility styling         |

| **No client-side JS required** (except optional log viewer island)

## 4. Competition Runner

- Single **Node CLI** (`runner.ts`) using:
  - `simple-git` for repo operations
  - `duckdb` npm package for SQL
  - `aws-sdk v3` S3 client for downloads/uploads
- All steps run sequentially inside the GitHub Action—no extra queue or Redis needed.

## 5. CI/CD

| Workflow          | Trigger                                      | Key Steps                                                       |
| ----------------- | -------------------------------------------- | --------------------------------------------------------------- |
| `check.yml`       | push / PR                                    | lint, type-check, unit tests                                    |
| `competition.yml` | cron (02:00 UTC)                             | pull DB, play game, push DB & JSON, open PR, trigger site build |
| `deploy_site.yml` | push to `main` or updated `leaderboard.json` | Astro build → `aws s3 sync ./dist s3://<bucket>`                |

- GitHub Action jobs authenticate to AWS via OIDC (`aws-actions/configure-aws-credentials`).

## 6. Hosting

| Asset       | AWS Service                                        | Cost when idle  |
| ----------- | -------------------------------------------------- | --------------- |
| Static site | **S3 static website** (+ optional CloudFront)      | <$0.10/mo       |
| DB & logs   | Same S3 bucket (`/data/`)                          | pay-per-storage |
| Compute     | GitHub Actions (included minutes or pay-as-you-go) | ~free to low    |

## 7. Observability

- Runner logs show up in the Action UI; also download to `s3://.../logs/YYYY-MM-DD.txt`.
- Cheap availability check via AWS Health Checks hitting the site URL.
