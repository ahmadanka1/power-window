# Power Window

A small web app that logs when the electricity comes and goes, and predicts the next supply window. It runs entirely in the browser and is hosted for free on GitHub Pages. The log lives in this repo as `data.json`.

**Live app:** https://ahmadanka1.github.io/power-window/

## What it does

- Logs each day's start and end time (one tap on "Power came" and "Power went", or a manual form).
- Predicts the next start and end, shown on a 24-hour timeline next to past days.
- Compares each past prediction with what actually happened, so you can see how well it does.
- Anyone with the link can view the logs and predictions. Only the owner can change them.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The app (page, styles, GitHub saving) |
| `engine.js` | The prediction engine |
| `data.json` | The log. Each save from the app is a commit to this file |

`data.json` looks like this. Times are 24-hour. `to` can be `null` when the end is unknown.

```json
{"days":[
 {"date": "2026-10-11", "from": "19:00", "to": "21:30"}
]}
```

## How the prediction works

The supply seems to follow a schedule on whole and half hours, so everything is matched on a 30-minute grid and nothing is averaged into odd times like 2:12.

1. Nine simple predictors each guess the next start time. They include "same as 3 days ago", pattern matching on recent days, the most common recent time, and a slot rotation model (morning, afternoon, evening: what usually follows what).
2. The app replays your history: each past day is predicted using only the days before it, and each predictor is scored on whether it landed within 30 minutes.
3. Predictors that were right recently get more weight. The final pick is the time with the most weighted support.
4. Every logged day re-ranks the predictors, so wrong guesses change what the app trusts.

The predicted length is the median of the last 7 logged durations, rounded to 30 minutes.

**Missed days:** a day you did not log counts as unknown. Day-based methods still line up with real calendar days, and the app does not learn from the gap. A day with a known start but unknown end still counts for the start prediction.

With a few weeks of data this is a rough guide, not a guarantee. With 12 days it hit within 30 minutes about half the time.

## Setup

1. Put the three files in the root of this repo.
2. Settings, then Pages, then deploy from the `main` branch and `/ (root)`.
3. To log from the app, create a fine-grained token at https://github.com/settings/personal-access-tokens/new. Limit it to this repo and set **Contents** to read and write.
4. Open the app, expand **Owner settings**, paste the token and tap **Save settings and sync**.

The token is stored only in that browser. Never commit it to the repo. Visitors without the token see a read-only view.

## Privacy

The repo and the log are public. Anyone with the link can see when the electricity came on each day.
