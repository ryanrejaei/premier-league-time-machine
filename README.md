# Premier League Time Machine

A static Premier League historical table explorer. Compare **1–15 seasons side by side**, jump to Gameweeks **1–38**, and see how clubs' positions evolved.

## What works

- Latest 1–15 seasons or any custom selection from **2012/13–2026/27**.
- Synchronized Gameweeks: previous/next, dropdown, range slider, keyboard arrows and automated playback.
- League-table columns: **GD and Pts** shown by default, with five compact tables fitting a desktop viewport (about 1,200px or wider). Extra columns widen cards; smaller screens scroll horizontally.
- Click **Columns** to show or hide P, W, D, L, GF, GA, GD, Pts, **YC, RC, shots, shots on target, corners, and fouls committed**. Column selections persist on the device using `localStorage`.
- Toggle eventual finish vs. selected Gameweek. Arrows mean **where the club will finish**, not where it is now:
  - **Dark green ↑**: finishes **10 or more** places higher.
  - **Medium green ↑**: finishes **4–9** places higher.
  - **Light green ↑**: finishes **1–3** places higher.
  - **Orange ↓**: finishes **1–3** places lower.
  - **Light red ↓**: finishes **4–9** places lower.
  - **Dark red ↓**: finishes **10 or more** places lower.
  - **Neutral =**: finishes unchanged.
- Optional weekly-movement indicator. Click a club row (or press Enter/Space when focused) to pin its highlight across seasons and Gameweeks. Click again or use Clear highlight to unpin.
- Turn on **Connect across seasons** after pinning a club to draw position arrows only in the gutters between adjacent tables. Colors follow the same 1–3 / 4–9 / 10+ rules, comparing the left table's position with the right table's position at the selected Gameweek. No line is drawn across a season where the club is absent.
- First-visit, skippable two-step tour includes interactive column choices and team-tracking guidance. Reopen it using **Quick tour**. Dismissal and column preferences are remembered locally.
- Centered Gameweek controls sit directly above the tables. Playback never starts automatically; switching tabs pauses it.
- This update resets legacy column preferences once to the new GD/Pts defaults, then remembers new choices.
- Club badges use the Premier League asset service, with initials as a fallback if an image is unavailable. Badges are current designs, not historical season-specific versions.
- Current season omits final-position comparisons until all matches are complete.
- No build process, API keys or backend needed.

## Preview locally

Unzip and open a terminal in this folder:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` in a browser. A connection is required to fetch the open football datasets.

Test the standings logic (Node.js):

```bash
node test.js
```

## Publish using a separate personal GitHub account

**Important: Don't deploy to an unrelated GitHub account.** If a business/work account is already connected, sign in with your personal GitHub account before uploading.

1. Sign into your **personal** account at [github.com](https://github.com). Create one first if needed.
2. Create a **public repository** called `premier-league-time-machine` with default branch `main`.
3. Extract this ZIP. Use GitHub **Add file → Upload files** to upload the following into the repository **root** (do not upload the ZIP as the website):

   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
   - `.nojekyll`
   - `test.js` (optional, for development)

4. Commit changes.
5. In **Settings → Pages → Build and deployment**, set **Source: Deploy from a branch** → **Branch: main** → **Folder: /(root)** → **Save**.
6. After deployment, open `https://YOUR-PERSONAL-USERNAME.github.io/premier-league-time-machine/`.

On GitHub Free, the repository needs to be **public** to use GitHub Pages. After setup, pushing changes to `main` republishes the site.

### Can ChatGPT Work do this?

Yes, Work can navigate GitHub using its cloud browser, have you authenticate the personal account in a secure sign-in step, create a repository, upload the files, and configure Pages when the site supports the actions. The sign-in and any approval requests need your involvement. Attach the **ZIP** to the Work task and ask it to extract and publish *those* files. Work does not automatically inherit the GitHub session in your desktop browser.

## Data sources

| Season(s) | Table results and Gameweek assignments | Optional match statistics |
| --- | --- | --- |
| 2012/13–2024/25 | [OpenFootball JSON](https://github.com/openfootball/football.json) | [Football Dataset / football-data.co.uk](https://github.com/qhtexas/football-dataset) |
| 2025/26 | [FPL season archive](https://github.com/vaastav/Fantasy-Premier-League) | [Football Dataset / football-data.co.uk](https://github.com/qhtexas/football-dataset) |
| 2026/27 | [Community FPL data](https://github.com/footydeano/fpl-data) | Currently not included; extra statistics display **—** |

The browser downloads the latest public CSV/JSON from `raw.githubusercontent.com`. Advanced stats are matched to fixtures by home/away team; unmatched, incomplete, or conflicting values are **not fabricated**. If *any* of a club's matches in the selected view lacks that metric, the sum is marked **—**, not a misleading partial value or zero. A recorded zero is shown as `0`.

OpenFootball data is distributed under CC0. The Football Dataset states PDDL for this compilation and credits [football-data.co.uk](https://www.football-data.co.uk/), which has its own terms and disclaimers. Review applicable terms before commercialization or extensive re-use. The current FPL archives may have additional attribution or reuse limits.

## Historical standings accuracy notes

Reconstruction uses match results already played **at the selected Gameweek's estimated cutoff** (before the next regular round begins). Postponed fixtures count when they were played; they are not backdated into earlier tables. Matches are bounded by today's date for the current season.

This remains a **prototype**, not an authoritative historical standings database:

- **Historical points deductions, subsequent appeals, and complex Premier League tiebreakers are not modeled**, so some final positions can disagree with official tables (e.g. Everton/Forest in 2023/24). This also affects the comparison arrows.
- Match archives can have date mistakes and delayed results. The 2019/20 OpenFootball dataset includes inconsistent restart dates, partially patched here. Accuracy of all Gameweek boundaries needs auditing against historical published standings.
- The current season data may lag actual fixtures.
- Extra statistics are dependent on upstream match archives. Empty data is displayed as missing, not zero.

## Suggested next development

1. Matchweek-by-matchweek validation, official points deductions and appeals.
2. Season-specific historical badge designs.
3. Shareable URLs for selected seasons, Gameweek and columns.
4. Chart team trajectories, points pace and title races.
5. Snapshot public data into versioned repository files with an audited GitHub Action to reduce upstream downtime.

Independent football-data visualization, not affiliated with the Premier League.
