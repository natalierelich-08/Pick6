# Pick 6 Pool – 2026 March Madness

A self-hosted web app for running a Pick 6 March Madness pool at scale. Handles 200+ entries, auto-scores via ESPN's API, and lives entirely on GitHub Pages (free, no server required).

---

## How It Works

**Participants** visit `submit.html` to pick 6 teams and a Team of Destiny. Submissions go to a Google Sheet via Google Apps Script.

**The leaderboard** (`index.html`) reads from that Google Sheet and fetches live scores from ESPN every 60 seconds. Scoring updates automatically as games complete.

**You** manage everything from `admin.html` — enter the bracket, configure URLs, or override scores manually if needed.

---

## Pick Rules (quick reference)

- Pick **6 teams** from the bracket, sorted from **best seed (1) → worst seed (16)**
- No duplicate teams
- Pick a **Team of Destiny (TOD)** from your 6 teams — used as tiebreaker (most TOD points wins ties)
- Multiple entries allowed: use "Name 1", "Name 2", etc.

**Scoring:** Each win earns `seed × round multiplier` points, cumulative.

| Round | Multiplier | Seed-12 example |
|-------|-----------|----------------|
| Round of 64 | × 1 | 12 pts |
| Round of 32 | × 2 | 24 pts |
| Sweet 16 | × 3 | 36 pts |
| Elite 8 | × 4 | 48 pts |
| Final Four | × 5 | 60 pts |
| Championship | × 6 | 72 pts |

A seed-12 team winning 3 games earns: 12+24+36 = **72 pts**. Upsets matter!

---

## Setup (one-time, ~20 min)

### Step 1 – Create a Google Spreadsheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new blank spreadsheet
2. Name it "Pick 6 Pool 2026" or similar
3. Note the **Spreadsheet ID** from the URL: `docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit`

### Step 2 – Deploy the Google Apps Script

1. In your spreadsheet: **Extensions → Apps Script**
2. Delete any existing code and paste the contents of `google-apps-script.gs`
3. Click **Deploy → New Deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy** → authorize when prompted → copy the **Web App URL**
   - It looks like: `https://script.google.com/macros/s/AKfycb.../exec`
5. Save that URL — you'll paste it into the Admin panel

### Step 3 – Publish the Sheet as CSV

1. In your spreadsheet, go to **File → Share → Publish to web**
2. First dropdown: select the **Entries** sheet (it's created automatically on first submission)
3. Second dropdown: **Comma-separated values (.csv)**
4. Click **Publish** → copy the URL
   - It looks like: `https://docs.google.com/spreadsheets/d/.../pub?gid=0&single=true&output=csv`
5. Save that URL too

> Note: The "Entries" sheet is auto-created when the first pick is submitted. You can also create it manually first by running the `doGet` function once from the Apps Script editor.

### Step 4 – Host on GitHub Pages

1. Create a new GitHub repository (public)
2. Push this entire folder to the `main` branch
3. Go to **Settings → Pages**
4. Source: **Deploy from a branch** → `main` → `/ (root)`
5. GitHub will give you a URL like: `https://yourusername.github.io/pick6-pool/`

### Step 5 – Configure the Admin Panel

1. Open `https://yourusername.github.io/pick6-pool/admin.html`
2. Enter your **GAS URL** and **Sheets CSV URL** from Steps 2–3
3. Set the **Pool Name** (shows on the leaderboard header)
4. Click **Save Configuration**

### Step 6 – Enter Tournament Teams

1. Still on `admin.html`, scroll to **Tournament Teams**
2. After Selection Sunday (bracket announcement), add all 68 teams
3. For each team: name, seed (1–16), region, and optionally the ESPN display name
4. Or use **Import JSON** to bulk-import (see format below)
5. You can also click **Load 2025 teams** as a starting template, then edit for 2026

**JSON import format:**
```json
[
  { "name": "Duke", "seed": 1, "region": "East" },
  { "name": "Houston", "seed": 1, "region": "Midwest" },
  { "name": "Florida", "seed": 1, "region": "West" },
  { "name": "Auburn", "seed": 1, "region": "South" }
]
```

### Step 7 – Share With Your Pool

Send participants two links:
- **Submit picks:** `https://yourusername.github.io/pick6-pool/submit.html`
- **View leaderboard:** `https://yourusername.github.io/pick6-pool/index.html`

---

## During the Tournament

The leaderboard auto-refreshes every 60 seconds and pulls live scores from ESPN. Nothing to do.

If ESPN scores look wrong or stale:
1. Go to `admin.html`
2. **Section 4** → Clear ESPN Cache
3. Or **Section 3** → Enter win counts manually and enable "Use manual overrides"

---

## FAQ

**Can participants submit multiple entries?**
Yes. They should add a number to their name: "Jane Smith 1", "Jane Smith 2", etc.

**What if someone submits with teams in the wrong seed order?**
The form validates this client-side and won't let them submit until it's fixed.

**Can I close submissions after the tournament starts?**
The easiest way: rename the GAS deployment or remove the URL from Admin. The form will error on submission.

**What if ESPN API stops working?**
Enable "Use manual overrides" in Admin and enter wins manually. Takes ~2 minutes per round.

**How do I update scores immediately after a game?**
Clear the ESPN cache in Admin. The next leaderboard page load will re-fetch everything.

**Is there a deadline enforcement?**
Not built-in. Just communicate a deadline and stop sharing the submission link before Round 1 tips off.

---

## File Structure

```
pick6/
├── index.html              Leaderboard (main page)
├── submit.html             Pick submission form
├── admin.html              Admin configuration panel
├── js/
│   ├── config.js           Config + Google Sheets CSV parser
│   ├── espn.js             ESPN API integration
│   └── scoring.js          Scoring engine + validation
├── css/
│   └── styles.css          Custom styles
├── google-apps-script.gs   Backend (paste into Apps Script)
└── README.md               This file
```

---

## Technical Notes

**ESPN API:** Uses ESPN's public, unauthenticated scoreboard endpoint. No API key needed. `groups=100` filters to NCAA Tournament games. The browser fetches this directly (CORS is allowed). Results are cached for 2 minutes.

**Team name matching:** The app strips the seed from team display names (e.g., "Duke (1)" → "Duke") and compares against ESPN's `shortDisplayName`. For teams where this fails, add the exact ESPN name in the Admin panel's "ESPN name" field.

**Data persistence:** All config and teams are stored in browser `localStorage` on the admin's machine. If you switch browsers or machines, re-enter the config or use the JSON export/import.

**No login required:** This is a trust-based internal pool. There's no authentication on form submissions.
