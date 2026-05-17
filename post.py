import os
import sys
import time
import shutil
import requests
from dotenv import load_dotenv
from generate import generate_post, log_post
from image_upload import upload_image

load_dotenv()

PERSONAL_TOKEN = os.getenv("LINKEDIN_PERSONAL_TOKEN")
PERSON_URN = os.getenv("LINKEDIN_PERSON_URN")

INPUT_FOLDER = "input"
PROCESSED_FOLDER = os.path.join(INPUT_FOLDER, "processed")
QUEUE_FOLDER = "queue"
QUEUE_POSTED_FOLDER = os.path.join(QUEUE_FOLDER, "posted")

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
TEXT_EXTENSIONS = {".txt", ".md"}

def ensure_folders():
    for folder in [INPUT_FOLDER, PROCESSED_FOLDER, QUEUE_FOLDER, QUEUE_POSTED_FOLDER]:
        if not os.path.exists(folder):
            os.makedirs(folder)

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
        print(f"Error posting: {response.status_code}")
        print(response.json())
        return None

def get_queue_files():
    ensure_folders()
    files = []
    for f in sorted(os.listdir(QUEUE_FOLDER)):
        full = os.path.join(QUEUE_FOLDER, f)
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

def run_queue_mode():
    print("Mode: Queue (pre-written posts)")
    queue = get_queue_files()
    if not queue:
        print("Queue empty. Falling back to AI autopilot.")
        run_autopilot_mode()
        return

    next_post_file = queue[0]
    with open(next_post_file, "r", encoding="utf-8") as f:
        post_text = f.read().strip()

    print("\n--- Next Queued Post ---")
    print(post_text)
    print("------------------------\n")

    post_id = post_to_linkedin(post_text, PERSONAL_TOKEN, PERSON_URN)
    if post_id:
        log_post("personal", "queued", post_text, has_image=False, post_id=post_id)
        move_file(next_post_file, QUEUE_POSTED_FOLDER)
        print("Queued post published.")

def run_input_mode():
    print("Mode: Input-triggered")
    files = get_input_files()
    if not files:
        print("No input files. Trying queue.")
        run_queue_mode()
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

    asset_urn = None
    image_description = None
    if image_file:
        print(f"Uploading image: {image_file}")
        asset_urn = upload_image(image_file, PERSONAL_TOKEN, PERSON_URN)
        if asset_urn:
            image_description = f"Image: {os.path.basename(image_file)}"

    print("Generating post...")
    post_text, pillar = generate_post("personal", raw_input=raw_input, image_description=image_description)
    if not post_text:
        print("Generation failed.")
        return

    print("\n--- Generated Post ---")
    print(post_text)
    print("----------------------\n")

    confirm = input("Post this? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("Cancelled. Files left in input folder.")
        return

    post_id = post_to_linkedin(post_text, PERSONAL_TOKEN, PERSON_URN, asset_urn)
    if post_id:
        log_post("personal", pillar, post_text, has_image=bool(asset_urn), post_id=post_id)
        for f in files:
            move_file(f, PROCESSED_FOLDER)
        print("Done.")

def run_autopilot_mode():
    print("Mode: AI Autopilot")
    post_text, pillar = generate_post("personal")
    if not post_text:
        print("Generation failed.")
        return
    print("\n--- Generated Post ---")
    print(post_text)
    print("----------------------\n")
    post_id = post_to_linkedin(post_text, PERSONAL_TOKEN, PERSON_URN)
    if post_id:
        log_post("personal", pillar, post_text, has_image=False, post_id=post_id)
        print("Autopilot post complete.")

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "smart"

    if mode == "input":
        run_input_mode()
    elif mode == "queue":
        run_queue_mode()
    elif mode == "auto":
        run_autopilot_mode()
    else:
        # smart: input files win, then queue, then AI
        if get_input_files():
            run_input_mode()
        elif get_queue_files():
            run_queue_mode()
        else:
            run_autopilot_mode()

if __name__ == "__main__":
    main()
