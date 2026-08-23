# Why the data is built, not fetched

The app loads a committed JSON snapshot rather than calling a COVID API at
runtime. This note records why, so the reasoning lives in one place instead of
being restated in each file that touches the data.

## The problem

As of 2026, no public COVID data source is at once **accurate**, **reachable
from a browser**, and **small**. All three were tested directly:

| Source | Latest data | CORS | Practical in a browser |
| --- | --- | --- | --- |
| disease.sh | 2023-03-09 | Yes | Yes — but the figures are three years stale |
| WHO | 2026-08-02 | **No** — preflight returns 403 | No — 26 MB CSV |
| Our World in Data | 2026-07-19 | Yes | No — 17 MB, filter params ignored |
| datahub.io | 2022-04-16 | Yes | Stale |
| CDC | current | Yes | United States only |
| covid19api.com | — | — | Dead, no DNS |
| ECDC | — | — | 404 |
| disease.sh `/jhucsse`, `/vaccine` | — | — | 502 |

## Why disease.sh looks fine but isn't

Its `updated` timestamp always reports the current day, so the API appears
live. Its upstreams are not: **JHU CSSE archived on 10 March 2023** and
Worldometers went quiet. The consequences are visible in the data itself:

- cumulative totals frozen at 2023-03-09
- roughly **74 million** fewer cases than WHO reports
- its own `/all` and `/historical` endpoints disagree with each other by about
  **28 million**, because they read from two different dead upstreams

## The approach

`scripts/build-data.mjs` runs on a build machine, where neither CORS nor file
size applies. It fetches WHO's weekly file, joins it with country geometry, and
writes `public/data/covid-snapshot.json` — about 40 KB, 8 KB gzipped. The app
loads that in a single same-origin request, which is fewer requests and less
data than the previous runtime API calls.

`.github/workflows/refresh-data.yml` re-runs this weekly and commits the result
only when the figures actually change, after verifying the app still lints,
tests and builds.

## Consequences worth knowing

- **No recovery figures.** WHO does not publish them, so the original
  "Recovered" metric has no source. It is replaced by newly reported cases,
  the only genuinely current signal in the data.
- **Weekly, not daily.** Only around 80 countries still report new cases.
  Cumulative totals cover 225 countries; recent activity is far sparser. That
  is the state of global COVID reporting, not a gap in the app.
- **Country geometry still comes from disease.sh.** It carries coordinates and
  flag images but no case figures, and borders do not go stale the way counts
  do.
