# Utopia LinkedIn Automation — System Brief for OS AI

This document describes the complete LinkedIn automation system built for **Utopia Advanced Composites Manufacturing PLC**. Read it fully before touching anything.

---

## What This System Does

Automatically generates and posts LinkedIn content to two accounts on a schedule, using a queue of pre-written posts and an AI fallback. Every post is logged to `content_log.json` locally and synced to a Notion database (Content Hub) for use by the Utopia OS web app.

---

## Folder Location

The project lives at:
```
D:\claude\utopia-linkedin\
```
GitHub repo: `https://github.com/mesigetu7/utopia-linkedin`

---

## Folder Structure

```
utopia-linkedin/
├── CLAUDE.md               ← Full brand, voice, and system rules for the AI agent
├── SYSTEM_BRIEF.md         ← This file
├── post.py                 ← Main script — orchestrates all posting
├── generate.py             ← AI post generation via Groq API (llama-3.3-70b)
├── notion_sync.py          ← Notion API integration — writes posts to Content Hub DB
├── notion_setup.py         ← One-time CLI script to create the Notion database
├── image_upload.py         ← LinkedIn image upload handler (3-step asset API)
├── scheduler.py            ← Local scheduler (not used in prod — GitHub Actions used instead)
├── get_token.py            ← Helper for LinkedIn OAuth
├── test_post.py            ← Manual test script
├── content_log.json        ← Local post history — prevents double-posting
├── requirements.txt        ← Python deps
├── .env                    ← API tokens (NOT committed to git)
├── .gitignore              ← Excludes .env, __pycache__, etc.
├── setup-utopia-linkedin.ps1 ← Windows setup script
│
├── queue/
│   ├── personal/           ← Pre-written posts for personal account (post03.txt → post14.txt active)
│   │   └── posted/         ← Files move here after posting (post01.txt, post02.txt done)
│   └── company/            ← Pre-written posts for company account
│       └── posted/
│
├── input/                  ← Drop photos or text files here to trigger input mode
│   └── processed/          ← Input files move here after use
│
└── .github/
    └── workflows/
        └── post.yml        ← GitHub Actions — runs the automation on a cron schedule
```

---

## The Two LinkedIn Accounts

### Personal Account — The Founder
- Voice: first person, observational, opinionated, human
- Never sounds like a brand post
- Posts: field notes, design opinions, client archetype stories, market observations
- API: uses `LINKEDIN_PERSONAL_TOKEN` + `LINKEDIN_PERSON_URN`

### Company Account — Utopia Advanced Composites Manufacturing PLC
- Voice: bold, authoritative, educational, first person plural ("we")
- Posts: material education, monopoly positioning, project showcases, performance data
- API: uses `LINKEDIN_PERSONAL_TOKEN` + `urn:li:organization:{LINKEDIN_COMPANY_ID}`
- NOTE: Company posting requires `w_organization_social` scope. Currently this scope is blocked by LinkedIn API restrictions. Company posts fail gracefully (non-crashing) — use LinkedIn's native scheduler for company posts manually until scope is resolved.

---

## Posting Schedule (GitHub Actions)

Defined in `.github/workflows/post.yml`:

| Day | Time (EAT) | UTC Cron |
|-----|-----------|----------|
| Tuesday | 8:00 AM | `0 5 * * 2` |
| Thursday | 7:00 PM | `0 16 * * 4` |
| Friday | 6:00 PM | `0 15 * * 5` |
| Saturday | 9:00 AM | `0 6 * * 6` |

Can also be triggered manually from GitHub Actions UI (workflow_dispatch) with `account` and `mode` inputs.

---

## How Posting Works — The 4 Modes

Run via: `python post.py [mode] [account]`

### `smart` (default)
Priority chain:
1. If files exist in `/input/` → run input mode
2. Else if queue files exist → run queue mode
3. Else → run autopilot (AI generates post)

### `queue`
Reads the next `.txt` file from `queue/[account]/`, posts it, moves it to `queue/[account]/posted/`.

### `input`
Reads files dropped into `/input/`. Supports:
- Image file (jpg/png/webp) → uploads to LinkedIn, generates caption
- Text file (.txt/.md) → expands into a full post in the founder's voice
- Both together → image + AI-generated caption from the text idea

### `auto`
Pure AI autopilot — generates a post using Groq (llama-3.3-70b), choosing a content pillar not used in the last 2 posts.

---

## Content Pillars

### Personal Account
- `archetype_pioneer` — client who tries new things (e.g. SterKeys luxury stairs project)
- `archetype_validator` — client who needs to see completed projects first
- `archetype_follower` — client who waits until everyone is doing it
- `design_opinion` — critique of architectural choices in Ethiopian construction
- `field_notes` — events attended, site visits, observations
- `market_observation` — what's changing in Ethiopian construction
- `engaging_others_work` — reacting to other architects/developers' projects

### Company Account
- `monopoly` — "only manufacturer in Ethiopia"
- `material_education_uhpc` — what UHPC is, why it matters
- `material_education_gfrc` — what GFRC is, why it matters
- `project_showcase` — process shots, finished work, before/after
- `design_freedom` — shapes/textures impossible with normal concrete
- `performance_data` — strength, durability, real numbers
- `application_spotlight` — deep dive on one product application
- `industry_positioning` — connecting Utopia to national infrastructure conversation

---

## AI Generation — Groq API

- Model: `llama-3.3-70b-versatile`
- Temperature: 0.85
- Key: `GROQ_API_KEY` in `.env` / GitHub Secrets
- Logic in: `generate.py`
- The prompt includes: company context, voice examples from real founder posts, 7-point quality rubric, and absolute rules (never invent names/events/clients)

---

## Content Log

`content_log.json` — tracks every post made:

```json
{
  "posts": [
    {
      "date": "2026-05-17 07:14",
      "account": "personal",
      "pillar": "queued",
      "hook": "First ~80 chars of the post",
      "has_image": false,
      "linkedin_post_id": "urn:li:share:7461675507152049999"
    }
  ]
}
```

This file is read before every post to prevent double-posting and to rotate content pillars.

---

## Notion Integration — Content Hub

### Purpose
Every post published by the automation is written to a Notion database called **Content Hub**. The Utopia OS web app reads from and writes to this database.

### Database Schema

| Field | Type | Notes |
|-------|------|-------|
| Hook | Title | First 100 chars of post |
| Platform | Select | LinkedIn Personal / LinkedIn Company / TikTok |
| Status | Select | Draft / Queued / Posted / Failed |
| Pillar | Text | Content pillar used |
| Scheduled Date | Date | For drafts/queued posts |
| Posted Date | Date | When actually published |
| Full Content | Text | Full post text (up to 2000 chars) |
| LinkedIn Post ID | Text | `urn:li:share:...` from LinkedIn API |
| Views | Number | Engagement metric |
| Likes | Number | Engagement metric |
| Comments | Number | Engagement metric |
| Shares | Number | Engagement metric |
| Has Image | Checkbox | Whether post had an image |
| Queue File | Text | Which queue file was used (if any) |

### Notion API Credentials
- Token: stored in GitHub Secrets as `NOTION_TOKEN`
- Database ID: stored in GitHub Secrets as `NOTION_DATABASE_ID`
- Both must also be in `.env` for local runs

### Setup Status
- `notion_sync.py` is written and pushed to GitHub ✅
- `post.py` calls `log_post_to_notion()` after every successful post ✅
- GitHub Actions workflow passes Notion secrets as env vars ✅
- **Notion database has NOT been created yet** — run `notion_setup.py` to create it:
  ```
  set NOTION_TOKEN=your_token
  python notion_setup.py YOUR_NOTION_PAGE_ID
  ```
  Get the page ID from any Notion page URL (the long string at the end).

### After Database Is Created
1. Add `NOTION_DATABASE_ID` to GitHub Secrets
2. Add `NOTION_DATABASE_ID` to local `.env`
3. Optionally run `python notion_sync.py` to bulk-import existing queue files into Notion with status "Queued"

---

## GitHub Secrets Required

Go to: `github.com/mesigetu7/utopia-linkedin` → Settings → Secrets and variables → Actions

| Secret Name | What It Is |
|-------------|-----------|
| `LINKEDIN_PERSONAL_TOKEN` | LinkedIn OAuth token (personal account) ✅ |
| `LINKEDIN_PERSON_URN` | `urn:li:person:...` personal profile ID ✅ |
| `LINKEDIN_COMPANY_TOKEN` | LinkedIn token for company page (same as personal for now) ✅ |
| `LINKEDIN_COMPANY_ID` | Numeric Utopia company page ID ✅ |
| `GROQ_API_KEY` | Groq API key for AI generation ✅ |
| `NOTION_TOKEN` | Notion integration token ✅ |
| `NOTION_DATABASE_ID` | ⚠️ NOT SET YET — needs database to be created first |

---

## Notion API Calls Made by This System

### Write a posted entry (called automatically after every post)
```
POST https://api.notion.com/v1/pages
Authorization: Bearer {NOTION_TOKEN}
Notion-Version: 2022-06-28
```
Sets: Hook, Platform, Status="Posted", Pillar, Posted Date, Full Content, LinkedIn Post ID, Has Image, Views/Likes/Comments/Shares=0

### Write a queued entry (manual bulk import)
Same endpoint, Status="Queued", no Posted Date, adds Queue File field.

### Update engagement stats (call this when refreshing analytics)
```
PATCH https://api.notion.com/v1/pages/{page_id}
```
Updates: Views, Likes, Comments, Shares

### Query the database (for the web app dashboard)
```
POST https://api.notion.com/v1/databases/{NOTION_DATABASE_ID}/query
```
Filter by Status, Platform, date range — standard Notion query API.

---

## What the Web App (Utopia OS) Can Do With This

The Notion database is the live data layer. The web app on Vercel can:

1. **Read all posts** — query Content Hub, filter by status/platform/date
2. **Show the queue** — filter Status = "Queued", sorted by Scheduled Date
3. **Show post history** — filter Status = "Posted", show engagement metrics
4. **Edit a queued post** — PATCH the Full Content and Hook fields
5. **Reschedule** — PATCH the Scheduled Date field
6. **Change status** — PATCH Status field (Draft → Queued → Posted)
7. **Create a draft** — POST a new page with Status = "Draft"
8. **Update engagement** — PATCH Views/Likes/Comments/Shares after reading from LinkedIn analytics

The web app should use the Notion API directly (server-side, not client-side — Notion blocks browser CORS). Use a Vercel API route / server function as a proxy.

---

## Queue Files — Current State

**Personal queue** (`queue/personal/`): post03.txt through post14.txt are active (12 posts remaining).
post15.txt through post24.txt were also generated and pushed to GitHub — check the repo.

**Company queue** (`queue/company/`): needs to be populated. Company posts not yet automated due to LinkedIn scope issue.

**Posted** (`queue/personal/posted/`): post01.txt and post02.txt have been published.

---

## LinkedIn Posts Already Published

From `content_log.json`:

| Date | Account | Hook |
|------|---------|------|
| 2026-05-16 21:26 | personal | "Driving through Addis Ababa's busy streets, you see construction sites everywhere..." |
| 2026-05-16 21:30 | personal | "Driving through the streets of Addis Ababa, it's hard not to notice the mix of..." |
| 2026-05-16 21:46 | personal | "Walk into almost any new building in Addis right now and look closely at the fac..." |
| 2026-05-17 07:14 | personal | "There's a type of client I've come to recognize immediately." |

---

## Analytics — What Worked, What Didn't

### How the system learns

Every post in `content_log.json` now has engagement fields:
```json
{
  "views": 0,
  "likes": 0,
  "comments": 0,
  "shares": 0
}
```

The pillar selection in `generate.py` is **weighted by past engagement**. Pillars where posts got more comments/shares/likes are chosen more often for future autopilot posts. The weighting formula:

```
score = (comments × 4) + (shares × 3) + (likes × 1) + (views × 0.01)
```

Comments are weighted highest because they signal real conversation. As engagement data fills in, the AI will naturally drift toward what resonates.

### How to feed engagement data in

**Option 1 — From the OS web app**
After pulling analytics from LinkedIn (manually or via API), call:
```
POST /api/update-engagement
{ "post_id": "urn:li:share:...", "views": 1200, "likes": 34, "comments": 8, "shares": 3 }
```
The web app should PATCH both `content_log.json` (via `update_engagement()` in `generate.py`) and the matching Notion page.

**Option 2 — Direct Python call**
```python
from generate import update_engagement
update_engagement("urn:li:share:7461675507152049999", views=1200, likes=34, comments=8, shares=3)
```

**Option 3 — Manual Notion update**
Update the Views/Likes/Comments/Shares fields directly in Notion. The web app dashboard should have an editable table for this.

### Voice training (coming later)

Once the queue runs out, the founder will provide real writing samples. At that point, update `VOICE_EXAMPLES` in `generate.py` with 10–15 real posts. The more specific and authentic the examples, the tighter the voice match. High-performing posts from the analytics log are also good candidates to add as voice examples — they worked, so the model should study them.

---

## Known Issues / Pending Items

1. **NOTION_DATABASE_ID not set** — database needs to be created with `notion_setup.py`, then added to GitHub Secrets and `.env`
2. **Company LinkedIn posting blocked** — `w_organization_social` scope unavailable on current app. Company posts fail gracefully. Manual posting via LinkedIn native scheduler for now.
3. **LinkedIn token expiry** — personal token will expire. When it does, re-run OAuth flow in `get_token.py` and update the `LINKEDIN_PERSONAL_TOKEN` GitHub Secret.
4. **Queue bulk import to Notion** — once database is created, run `python notion_sync.py` to populate Notion with all existing queue files

---

## How to Run Locally

```bash
# Install deps
pip install -r requirements.txt

# Set up .env (copy from secrets)
# .env needs: LINKEDIN_PERSONAL_TOKEN, LINKEDIN_PERSON_URN, LINKEDIN_COMPANY_ID,
#             GROQ_API_KEY, NOTION_TOKEN, NOTION_DATABASE_ID

# Test generate only (no posting)
python generate.py

# Post next queued personal post
python post.py queue personal

# Run full smart mode (personal)
python post.py smart personal

# Drop a file and post it
# Put a .txt file in /input/, then:
python post.py input personal
```

---

## Brand Summary (for AI agents writing posts)

**Company:** Utopia Advanced Composites Manufacturing PLC, Addis Ababa, Ethiopia
**Products:** GFRC (Glass Fibre Reinforced Concrete) and UHPC (Ultra High Performance Concrete)
**Position:** Only manufacturer of both in Ethiopia — a monopoly

**3 Brand Pillars:**
1. Monopoly — sole manufacturer, no competition, no alternative
2. Design Freedom — any shape/texture impossible with normal concrete
3. Performance — UHPC is 5x stronger than normal concrete; GFRC is lightweight and weather-resistant

**Never:** "We are excited to...", motivational quotes, generic construction content, invented facts, posts that could have been written by any company anywhere.

Full voice rules and examples are in `CLAUDE.md`.
