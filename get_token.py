import os
import webbrowser
import requests
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from dotenv import load_dotenv

load_dotenv()

CLIENT_ID = os.getenv("LINKEDIN_CLIENT_ID")
CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET")
REDIRECT_URI = "http://localhost:8000/callback"
SCOPE = "openid profile w_member_social"

auth_code = None

class CallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global auth_code
        params = parse_qs(urlparse(self.path).query)
        if "code" in params:
            auth_code = params["code"][0]
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"Success! You can close this tab and go back to the terminal.")
        else:
            error = params.get("error", ["unknown"])[0]
            error_desc = params.get("error_description", ["no description"])[0]
            self.send_response(400)
            self.end_headers()
            self.wfile.write(f"Error: {error} - {error_desc}".encode())

    def log_message(self, format, *args):
        pass

def get_access_token(code):
    response = requests.post(
        "https://www.linkedin.com/oauth/v2/accessToken",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        },
    )
    return response.json()

def get_person_urn(token):
    response = requests.get(
        "https://api.linkedin.com/v2/userinfo",
        headers={"Authorization": f"Bearer {token}"}
    )
    data = response.json()
    print(f"Profile response: {data}")
    sub = data.get("sub")
    if sub:
        return f"urn:li:person:{sub}"
    return None

def save_to_env(token, urn):
    env_path = ".env"
    with open(env_path, "r") as f:
        lines = f.readlines()

    updated = []
    token_saved = False
    urn_saved = False

    for line in lines:
        if line.startswith("LINKEDIN_PERSONAL_TOKEN="):
            updated.append(f"LINKEDIN_PERSONAL_TOKEN={token}\n")
            token_saved = True
        elif line.startswith("LINKEDIN_PERSON_URN="):
            updated.append(f"LINKEDIN_PERSON_URN={urn}\n")
            urn_saved = True
        else:
            updated.append(line)

    if not token_saved:
        updated.append(f"LINKEDIN_PERSONAL_TOKEN={token}\n")
    if not urn_saved:
        updated.append(f"LINKEDIN_PERSON_URN={urn}\n")

    with open(env_path, "w") as f:
        f.writelines(updated)

def main():
    auth_url = (
        f"https://www.linkedin.com/oauth/v2/authorization"
        f"?response_type=code"
        f"&client_id={CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&scope={SCOPE.replace(' ', '%20')}"
    )

    print("\nOpening LinkedIn in your browser...")
    print("Log in and click Allow when asked.\n")
    webbrowser.open(auth_url)

    server = HTTPServer(("localhost", 8000), CallbackHandler)
    server.handle_request()

    if not auth_code:
        print("Error: did not receive authorisation code.")
        return

    print("Code received. Getting access token...")
    token_data = get_access_token(auth_code)

    if "access_token" not in token_data:
        print(f"Error getting token: {token_data}")
        return

    token = token_data["access_token"]
    print("Access token received.")

    print("Getting your LinkedIn profile ID...")
    urn = get_person_urn(token)

    if not urn:
        print("Could not retrieve profile ID. Check your scopes.")
        return

    save_to_env(token, urn)

    print("\nDone. Your .env file has been updated with:")
    print(f"  LINKEDIN_PERSONAL_TOKEN = saved")
    print(f"  LINKEDIN_PERSON_URN = {urn}")
    print("\nSetup complete. You are ready to post.")

if __name__ == "__main__":
    main()
