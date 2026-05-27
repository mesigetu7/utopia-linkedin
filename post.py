import os
import sys
import time
import shutil
import requests
from datetime import date
from dotenv import load_dotenv
from generate import generate_post, log_post, load_content_log
from image_upload import upload_image
from notion_sync import log_post_to_notion

load_dotenv()

PERSONAL_TOKEN = os.getenv("LINKEDIN_PERSONAL_TOKEN")
PERSON_URN = os.getenv("LINKEDIN_PERSON_URN")
COMPANY_TOKEN = os.getenv("LINKEDIN_COMPANY_TOKEN")
COMPANY_ID = os.getenv("LINKEDIN_COMPANY_ID")

INPUT_FOLDER = "input"
PROCESSED_FOLDER = os.path.join(INPUT_FOLDER, "processed")

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
TEXT_EXTENSIONS = {".txt", ".md"}


def queue_folder(account):
    return os.path.join("queue", account)


def queue_posted_folder(account):
    return os.path.join("queue", account, "posted")


def ensure_folders():
    for account in ("personal", "company"):
        for folder in [queue_folder(account), queue_posted_folder(account)]:
            if not os.path.exists(folder):
                os.makedirs(folder)
    for folder in [INPUT_FOLDER, PROCESSED_FOLDER]:
        if not os.path.exists(folder):
            os.makedirs(folder)


def already_posted_today(account):
    """Check if we've already posted today for this account.

    Respects the FORCE env var — if FORCE is truthy, the guard is bypassed.
    Use FORCE only for manual recovery / test runs; never in cron.
    """
    if os.getenv("FORCE", "").lower() in ("1", "true", "yes"):
        print(f"FORCE=true — skipping already-posted-today guard for {account}.")
        return False
    log = load_content_log()
    today = date.today().strftime("%Y-%m-%d")
    for post in log["posts"]:
        if post["account"] == account and post["date"].startswith(today):
            print(f"Already posted today on {account} account (post: {post['hook'][:50]})")
            return True
    return False


def get_account_creds(account):
    """Return (token, author_urn) for the given account.
    Both accounts use the personal token — company posts use the org URN.
    The personal token works for company pages when the user is a page admin.
    """
    if account == "company":
        token = PERSONAL_TOKEN
        urn = f"urn:li:organization:{COMPANY_ID}" if COMPANY_ID else None
        if not token or not urn:
            print("ERROR: LINKEDIN_PERSONAL_TOKEN or LINKEDIN_COMPANY_ID not set.")
            sys.exit(1)
    else:
        token = PERSONAL_TOKEN
        urn = PERSON_URN
        if not token or not urn:
            print("ERROR: LINKEDIN_PERSONAL_TOKEN or LINKEDIN_PERSON_URN not set.")
            sys.exit(1)
    return token, urn


def post_to_linkedin(text, token, author_urn, asset_urn=None):
    url = "https://api.linkedin.com/v2/ugcPosts"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0"
    }

    if asset_urn:
        media_category = "IMAGE"
        media = [{"status": "READY", "description": {"text": ""}, "media": asset_urn, "title": {"text": ""}}]
    else:
        media_category = "NONE"
        media = []

    content = {
        "shareCommentary": {"text": text},
        "shareMediaCategory": media_category
    }
    if media:
        content["media"] = media

    payload = {
        "author": author_urn,
        "lifecycleState": "PUBLISHED",
        "specificContent": {"com.linkedin.ugc.ShareContent": content},
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"}
    }

    time.sleep(2)
    response = requests.post(url, headers=headers, json=payload)

    if response.status_code == 201:
        post_id = response.headers.get("x-restli-id", "")
        print(f"Posted successfully. ID: {post_id}")
        return post_id
    else:
        print(f"ERROR posting to LinkedIn: {response.status_code}")
        try:
            print(response.json())
        except Exception:
            print(response.text)
        return None


def get_queue_files(account="personal"):
    ensure_folders()
    folder = queue_folder(account)
    files = []
    for f in sorted(os.listdir(folder)):
        full = os.path.join(folder, f)
        if os.path.isfile(full) and os.path.splitext(f)[1].lower() in TEXT_EXTENSIONS:
            files.append(full)
    return files


def get_input_files():
    ensure_folders()
    files = []
    for f in os.listdir(INPUT_FOLDER):
        full = os.path.join(INPUT_FOLDER, f)
        if os.path.isfile(full):
            files.append(full)
    return files


def move_file(file_path, dest_folder):
    filename = os.path.basename(file_path)
    shutil.move(file_path, os.path.join(dest_folder, filename))
    print(f"Moved {filename}")


# ─────────────────────────────────────────
# MODES
# ─────────────────────────────────────────

def run_queue_mode(account="personal"):
    print(f"Mode: Queue [{account}]")

    if already_posted_today(account):
        print("Skipping — already posted today.")
        return

    queue = get_queue_files(account)
    if not queue:
        print("Queue empty. Falling back to AI autopilot.")
        run_autopilot_mode(account)
        return

    next_post_file = queue[0]
    with open(next_post_file, "r", encoding="utf-8") as f:
        post_text = f.read().strip()

    print("\n--- Next Queued Post ---")
    print(post_text)
    print("------------------------\n")

    token, urn = get_account_creds(account)
    post_id = post_to_linkedin(post_text, token, urn)

    if post_id:
        log_post(account, "queued", post_text, has_image=False, post_id=post_id)
        log_post_to_notion(account, "queued", post_text, has_image=False,
                           post_id=post_id, queue_file=os.path.basename(next_post_file))
        move_file(next_post_file, queue_posted_folder(account))
        print("Queued post published.")
    else:
        print(f"ERROR: LinkedIn post failed for [{account}]. Check token scopes.")
        if account == "company":
            print("NOTE: Company posts require w_organization_social scope. Skipping without crash.")
            return
        sys.exit(1)


def run_input_mode(account="personal"):
    print(f"Mode: Input-triggered [{account}]")

    files = get_input_files()
    if not files:
        print("No input files. Trying queue.")
        run_queue_mode(account)
        return

    image_file = None
    text_file = None
    for f in files:
        ext = os.path.splitext(f)[1].lower()
        if ext in IMAGE_EXTENSIONS and image_file is None:
            image_file = f
        elif ext in TEXT_EXTENSIONS and text_file is None:
            text_file = f

    raw_input = None
    if text_file:
        with open(text_file, "r", encoding="utf-8") as f:
            raw_input = f.read().strip()

    token, urn = get_account_creds(account)

    asset_urn = None
    image_description = None
    if image_file:
        print(f"Uploading image: {image_file}")
        asset_urn = upload_image(image_file, token, urn)
        if asset_urn:
            image_description = f"Image: {os.path.basename(image_file)}"

    print("Generating post...")
    post_text, pillar = generate_post(account, raw_input=raw_input, image_description=image_description)
    if not post_text:
        print("ERROR: Post generation failed.")
        sys.exit(1)

    print("\n--- Generated Post ---")
    print(post_text)
    print("----------------------\n")

    post_id = post_to_linkedin(post_text, token, urn, asset_urn)
    if post_id:
        log_post(account, pillar, post_text, has_image=bool(asset_urn), post_id=post_id)
        for f in files:
            move_file(f, PROCESSED_FOLDER)
        print("Done.")
    else:
        print("ERROR: LinkedIn post failed. Exiting with error.")
        sys.exit(1)


def run_autopilot_mode(account="personal"):
    print(f"Mode: AI Autopilot [{account}]")

    if already_posted_today(account):
        print("Skipping — already posted today.")
        return

    post_text, pillar = generate_post(account)
    if not post_text:
        print("ERROR: Post generation failed.")
        sys.exit(1)

    print("\n--- Generated Post ---")
    print(post_text)
    print("----------------------\n")

    token, urn = get_account_creds(account)
    post_id = post_to_linkedin(post_text, token, urn)

    if post_id:
        log_post(account, pillar, post_text, has_image=False, post_id=post_id)
        log_post_to_notion(account, pillar, post_text, has_image=False, post_id=post_id)
        print("Autopilot post complete.")
    else:
        print(f"ERROR: LinkedIn post failed for [{account}].")
        if account == "company":
            print("Company posting skipped — check token/scope when available.")
            return
        sys.exit(1)


def main():
    # Usage: post.py [mode] [account]
    # mode: smart | input | queue | auto  (default: smart)
    # account: personal | company          (default: personal)
    mode = sys.argv[1] if len(sys.argv) > 1 else "smart"
    account = sys.argv[2] if len(sys.argv) > 2 else "personal"

    if account not in ("personal", "company"):
        print(f"ERROR: Unknown account '{account}'. Use 'personal' or 'company'.")
        sys.exit(1)

    if mode == "input":
        run_input_mode(account)
    elif mode == "queue":
        run_queue_mode(account)
    elif mode == "auto":
        run_autopilot_mode(account)
    elif mode == "smart":
        # Priority: input files → queue → AI autopilot
        if get_input_files():
            run_input_mode(account)
        elif get_queue_files(account):
            run_queue_mode(account)
        else:
            run_autopilot_mode(account)
    else:
        print(f"ERROR: Unknown mode '{mode}'. Use smart | input | queue | auto.")
        sys.exit(1)


if __name__ == "__main__":
    main()
