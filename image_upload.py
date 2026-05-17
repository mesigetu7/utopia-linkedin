import os
import requests
from dotenv import load_dotenv

load_dotenv()

def upload_image(image_path, token, author_urn):
    # Step 1 - Register the upload
    register_url = "https://api.linkedin.com/v2/assets?action=registerUpload"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0"
    }
    register_payload = {
        "registerUploadRequest": {
            "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
            "owner": author_urn,
            "serviceRelationships": [
                {
                    "relationshipType": "OWNER",
                    "identifier": "urn:li:userGeneratedContent"
                }
            ]
        }
    }

    r = requests.post(register_url, headers=headers, json=register_payload)
    if r.status_code != 200:
        print(f"Error registering upload: {r.status_code} {r.text}")
        return None

    register_data = r.json()
    upload_url = register_data["value"]["uploadMechanism"]["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]["uploadUrl"]
    asset_urn = register_data["value"]["asset"]

    # Step 2 - Upload the image binary
    ext = os.path.splitext(image_path)[1].lower()
    content_type_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp"
    }
    content_type = content_type_map.get(ext, "image/jpeg")

    with open(image_path, "rb") as f:
        image_data = f.read()

    upload_headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": content_type
    }
    upload_response = requests.put(upload_url, headers=upload_headers, data=image_data)

    if upload_response.status_code not in [200, 201]:
        print(f"Error uploading image: {upload_response.status_code}")
        return None

    print(f"Image uploaded successfully. Asset: {asset_urn}")
    return asset_urn
