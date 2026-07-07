#!/usr/bin/env python3
"""
push_queue.py — Push a new post directly to the GitHub queue via GitHub Contents API.

Usage:
    python push_queue.py \
        --account personal \
        --name "Stair detail — luxury villa" \
        --content "Post text goes here..." \
        [--date 2026-07-10]

Claude uses this script to write posts to the queue without the user copy-pasting anything.
Reads GITHUB_TOKEN from .env automatically.
"""

import argparse
import base64
import json
import os
import re
import sys
import urllib.request
import urllib.error
from dotenv import load_dotenv

load_dotenv()

OWNER = "mesigetu7"
REPO = "utopia-linkedin"
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
}


def gh_get(path):
    url = f"https://api.github.com/repos/{OWNER}/{REPO}/contents/{path}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def gh_put(path, content_str, message, sha=None):
    url = f"https://api.github.com/repos/{OWNER}/{REPO}/contents/{path}"
    payload = {
        "message": message,
        "content": base64.b64encode(content_str.encode("utf-8")).decode("ascii"),
    }
    if sha:
        payload["sha"] = sha
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=HEADERS, method="PUT")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def get_next_post_id(account):
    """Find the next available postNN filename."""
    folder = gh_get(f"queue/{account}")
    existing_nums = []
    if folder and isinstance(folder, list):
        for item in folder:
            if item["type"] == "file" and item["name"].endswith(".txt"):
                m = re.search(r"(\d+)", item["name"])
                if m:
                    existing_nums.append(int(m.group(1)))

    # Also check posted/ subfolder
    posted = gh_get(f"queue/{account}/posted")
    if posted and isinstance(posted, list):
        for item in posted:
            if item["type"] == "file" and item["name"].endswith(".txt"):
                m = re.search(r"(\d+)", item["name"])
                if m:
                    existing_nums.append(int(m.group(1)))

    next_num = max(existing_nums, default=0) + 1
    return f"post{str(next_num).zfill(2)}"


def build_queue_file(name, content, scheduled_date=None):
    headers = []
    if name.strip():
        headers.append(f"[NAME: {name.strip()}]")
    if scheduled_date and scheduled_date.strip():
        headers.append(f"[DATE: {scheduled_date.strip()}]")
    if headers:
        return "\n".join(headers) + "\n\n" + content.strip() + "\n"
    return content.strip() + "\n"


def push_post(account, name, content, scheduled_date=None, post_id=None):
    if not GITHUB_TOKEN:
        print("ERROR: GITHUB_TOKEN not set in .env")
        sys.exit(1)

    if post_id is None:
        post_id = get_next_post_id(account)

    path = f"queue/{account}/{post_id}.txt"
    raw = build_queue_file(name, content, scheduled_date)

    # Check if file already exists (for updates)
    existing = gh_get(path)
    sha = existing["sha"] if existing else None

    action = "Update" if sha else "Add"
    msg = f"{action} queue post: {post_id} — {name[:50]}"

    gh_put(path, raw, msg, sha)
    print(f"✓ Pushed {path}")
    print(f"  Name: {name}")
    if scheduled_date:
        print(f"  Scheduled: {scheduled_date}")
    else:
        print(f"  Schedule: next GitHub Actions run")
    return post_id


def main():
    parser = argparse.ArgumentParser(description="Push a post to the GitHub queue.")
    parser.add_argument("--account", choices=["personal", "company"], default="personal")
    parser.add_argument("--name", required=True, help="Display label (never posted to LinkedIn)")
    parser.add_argument("--content", required=True, help="Post text")
    parser.add_argument("--date", default=None, help="Scheduled date YYYY-MM-DD (optional)")
    parser.add_argument("--id", default=None, help="Force a specific post ID e.g. post07")
    args = parser.parse_args()

    post_id = push_post(
        account=args.account,
        name=args.name,
        content=args.content,
        scheduled_date=args.date,
        post_id=args.id,
    )
    print(f"\nDone. Post saved as queue/{args.account}/{post_id}.txt")


if __name__ == "__main__":
    main()
