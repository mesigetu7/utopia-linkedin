import os
import requests
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("LINKEDIN_PERSONAL_TOKEN")
PERSON_URN = os.getenv("LINKEDIN_PERSON_URN")

def post_to_linkedin(text):
    url = "https://api.linkedin.com/v2/ugcPosts"
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0"
    }
    payload = {
        "author": PERSON_URN,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {
                    "text": text
                },
                "shareMediaCategory": "NONE"
            }
        },
        "visibility": {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        }
    }

    response = requests.post(url, headers=headers, json=payload)

    if response.status_code == 201:
        print("Post published successfully.")
        print(f"Post ID: {response.headers.get('x-restli-id')}")
    else:
        print(f"Error: {response.status_code}")
        print(response.json())

test_text = """The future of construction in Ethiopia is being built right now.

Utopia Advanced Composites Manufacturing PLC — the only manufacturer of GFRC and UHPC in Ethiopia.

#Ethiopia #Construction #UHPC #GFRC #AddisAbaba"""

print("Posting to your personal LinkedIn...")
post_to_linkedin(test_text)
