import os
import requests
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

NOTION_TOKEN = os.getenv("NOTION_TOKEN")
NOTION_DATABASE_ID = os.getenv("NOTION_DATABASE_ID")

HEADERS = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
}


# ─────────────────────────────────────────
# DATABASE SETUP
# ─────────────────────────────────────────

def create_content_hub(parent_page_id):
    """
    Create the Content Hub database under a given Notion page.
    Run this once to set up the database. Returns the new database ID.
    """
    url = "https://api.notion.com/v1/databases"
    payload = {
        "parent": {"type": "page_id", "page_id": parent_page_id},
        "title": [{"type": "text", "text": {"content": "Content Hub"}}],
        "properties": {
            "Hook": {"title": {}},
            "Platform": {
                "select": {
                    "options": [
                        {"name": "LinkedIn Personal", "color": "blue"},
                        {"name": "LinkedIn Company", "color": "green"},
                        {"name": "TikTok", "color": "red"}
                    ]
                }
            },
            "Status": {
                "select": {
                    "options": [
                        {"name": "Draft", "color": "gray"},
                        {"name": "Queued", "color": "yellow"},
                        {"name": "Posted", "color": "green"},
                        {"name": "Failed", "color": "red"}
                    ]
                }
            },
            "Pillar": {"rich_text": {}},
            "Scheduled Date": {"date": {}},
            "Posted Date": {"date": {}},
            "Full Content": {"rich_text": {}},
            "LinkedIn Post ID": {"rich_text": {}},
            "Views": {"number": {"format": "number"}},
            "Likes": {"number": {"format": "number"}},
            "Comments": {"number": {"format": "number"}},
            "Shares": {"number": {"format": "number"}},
            "Has Image": {"checkbox": {}},
            "Queue File": {"rich_text": {}}
        }
    }
    response = requests.post(url, headers=HEADERS, json=payload)
    if response.status_code == 200:
        db_id = response.json()["id"]
        print(f"Content Hub created. Database ID: {db_id}")
        print(f"Add this to your .env: NOTION_DATABASE_ID={db_id}")
        return db_id
    else:
        print(f"Error creating database: {response.status_code}")
        print(response.json())
        return None


# ─────────────────────────────────────────
# WRITE TO NOTION
# ─────────────────────────────────────────

def log_post_to_notion(account, pillar, post_text, has_image=False,
                        post_id=None, queue_file=None, scheduled_date=None):
    """
    Write a post to the Content Hub database after it has been published.
    Called automatically by post.py after every successful post.
    """
    if not NOTION_TOKEN or not NOTION_DATABASE_ID:
        print("Notion not configured — skipping Notion sync.")
        return None

    platform = "LinkedIn Personal" if account == "personal" else "LinkedIn Company"
    hook = post_text[:100]
    now = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

    payload = {
        "parent": {"database_id": NOTION_DATABASE_ID},
        "properties": {
            "Hook": {
                "title": [{"type": "text", "text": {"content": hook}}]
            },
            "Platform": {
                "select": {"name": platform}
            },
            "Status": {
                "select": {"name": "Posted"}
            },
            "Pillar": {
                "rich_text": [{"type": "text", "text": {"content": pillar or ""}}]
            },
            "Posted Date": {
                "date": {"start": now}
            },
            "Full Content": {
                "rich_text": [{"type": "text", "text": {"content": post_text[:2000]}}]
            },
            "LinkedIn Post ID": {
                "rich_text": [{"type": "text", "text": {"content": post_id or ""}}]
            },
            "Has Image": {
                "checkbox": has_image
            },
            "Views": {"number": 0},
            "Likes": {"number": 0},
            "Comments": {"number": 0},
            "Shares": {"number": 0}
        }
    }

    if queue_file:
        payload["properties"]["Queue File"] = {
            "rich_text": [{"type": "text", "text": {"content": queue_file}}]
        }

    url = "https://api.notion.com/v1/pages"
    response = requests.post(url, headers=HEADERS, json=payload)

    if response.status_code == 200:
        page_id = response.json()["id"]
        print(f"Synced to Notion: {page_id}")
        return page_id
    else:
        print(f"Notion sync failed: {response.status_code} — {response.json()}")
        return None


def add_queued_post_to_notion(account, pillar, post_text, queue_file,
                               scheduled_date=None):
    """
    Write a queued post to Notion with status Queued.
    Run this to populate Notion from existing queue files.
    """
    if not NOTION_TOKEN or not NOTION_DATABASE_ID:
        print("Notion not configured — skipping.")
        return None

    platform = "LinkedIn Personal" if account == "personal" else "LinkedIn Company"
    hook = post_text[:100]

    payload = {
        "parent": {"database_id": NOTION_DATABASE_ID},
        "properties": {
            "Hook": {
                "title": [{"type": "text", "text": {"content": hook}}]
            },
            "Platform": {"select": {"name": platform}},
            "Status": {"select": {"name": "Queued"}},
            "Pillar": {
                "rich_text": [{"type": "text", "text": {"content": pillar or ""}}]
            },
            "Full Content": {
                "rich_text": [{"type": "text", "text": {"content": post_text[:2000]}}]
            },
            "Queue File": {
                "rich_text": [{"type": "text", "text": {"content": queue_file}}]
            },
            "Has Image": {"checkbox": False},
            "Views": {"number": 0},
            "Likes": {"number": 0},
            "Comments": {"number": 0},
            "Shares": {"number": 0}
        }
    }

    if scheduled_date:
        payload["properties"]["Scheduled Date"] = {
            "date": {"start": scheduled_date}
        }

    url = "https://api.notion.com/v1/pages"
    response = requests.post(url, headers=HEADERS, json=payload)

    if response.status_code == 200:
        print(f"Added to Notion queue: {queue_file}")
        return response.json()["id"]
    else:
        print(f"Failed: {response.status_code} — {response.json()}")
        return None


def update_post_engagement(notion_page_id, views=0, likes=0,
                            comments=0, shares=0):
    """
    Update engagement stats on a posted entry.
    Called when refreshing analytics data.
    """
    if not NOTION_TOKEN:
        return

    url = f"https://api.notion.com/v1/pages/{notion_page_id}"
    payload = {
        "properties": {
            "Views": {"number": views},
            "Likes": {"number": likes},
            "Comments": {"number": comments},
            "Shares": {"number": shares}
        }
    }
    response = requests.patch(url, headers=HEADERS, json=payload)
    if response.status_code == 200:
        print(f"Engagement updated for {notion_page_id}")
    else:
        print(f"Update failed: {response.status_code}")


# ─────────────────────────────────────────
# POPULATE FROM EXISTING QUEUE FILES
# ─────────────────────────────────────────

def sync_queue_to_notion():
    """
    One-time script to push all existing queue files into Notion.
    Run manually: python notion_sync.py
    """
    import os, glob

    personal_files = sorted(glob.glob("queue/personal/post*.txt"))
    company_files = sorted(glob.glob("queue/company/company_*.txt"))

    print(f"Found {len(personal_files)} personal + {len(company_files)} company posts")

    for f in personal_files:
        with open(f, "r", encoding="utf-8") as fh:
            text = fh.read().strip()
        add_queued_post_to_notion("personal", "queued", text, f)

    for f in company_files:
        with open(f, "r", encoding="utf-8") as fh:
            text = fh.read().strip()
        add_queued_post_to_notion("company", "queued", text, f)

    print("Done syncing queue to Notion.")


if __name__ == "__main__":
    sync_queue_to_notion()
