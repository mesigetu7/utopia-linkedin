import schedule
import time
import subprocess
import sys
from datetime import datetime

# Posts 3-4 times per week
# Tuesday 8am, Thursday 7pm, Saturday 9am
# Occasionally adds Friday 6pm as a 4th post

def run_post():
    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Scheduler triggered. Running post.py...")
    result = subprocess.run([sys.executable, "post.py", "auto"], capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print("Errors:", result.stderr)

def start():
    print("Utopia LinkedIn Scheduler started.")
    print("Scheduled: Tuesday 08:00, Thursday 19:00, Saturday 09:00, Friday 18:00")
    print("Waiting for next scheduled time...\n")

    schedule.every().tuesday.at("08:00").do(run_post)
    schedule.every().thursday.at("19:00").do(run_post)
    schedule.every().saturday.at("09:00").do(run_post)
    schedule.every().friday.at("18:00").do(run_post)

    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == "__main__":
    start()
