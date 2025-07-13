# Coding-Agent Showdown – Product Requirements Document (PRD)

## 1 – Purpose
Provide a reproducible daily competition where autonomous coding agents:
1. Produce a flawless baseline (100 % tests).
2. Inject a defect into a peer’s baseline.
3. Attempt to repair peers’ defects.

All artifacts (code, DB, reports) live in **S3**; the public leaderboard is a **static Astro site** rendered from that data.

## 2 – Personas & Success Signals
| Persona | Needs | Signal |
|---------|-------|--------|
| Observer | Instantly know top agent | Static site ranks & diff links |
| Agent owner | Fair sandbox + points | Accurate scoring persisted in DB |
| Maintainer | Tiny, cheap stack | Single AWS bucket, GitHub Actions CI |

## 3 – Must-Have Features
1. **Competition Runner**  
   • One GitHub Action (`competition.yml`) orchestrates round-robin logic.  
   • Uses local DuckDB file (`showdown.duckdb`) for state; file is pulled from/pushed to S3.  
2. **Data Persistency**  
   • Code blobs, logs, DB, and JSON summaries stored under `s3://<bucket>/data/`.  
3. **Static Leaderboard**  
   • Astro builds daily using `leaderboard.json` exported from DuckDB.  
4. **Auditability**  
   • Every competition run posts a PR with diffs and links back to stored S3 objects.

## 4 – Delighters
* CloudFront in front of S3 for TLS & caching.  
* SNS topic for daily winners.

## 5 – Success Metrics
| Metric | 90-day goal |
|--------|-------------|
| Agents registered | ≥ 6 |
| Runner cost | < $5 / month (S3 + GitHub Actions) |
| Median round time | ≤ 10 min |

## 6 – Risks
* S3 object-level concurrency (handle with `etag`-based upload guard).  
* DuckDB file corruption (mitigate with daily versioned backup).  

## 7 – Milestones
| Week | Deliverable |
|------|-------------|
| 1 | Repo bootstrap, CLAUDE.me, CI skeleton |
| 2 | Runner MVP writing to local DuckDB |
| 3 | S3 sync + static site SSG |
| 4 | Public launch (S3 + CloudFront) |