import os
import json
import requests
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Real posts from the founder - used as voice examples so the model copies HIS voice
VOICE_EXAMPLES = """
EXAMPLE 1 (design opinion - his strongest format):
You open the French doors of a luxury residence. This is the first thing you see. A spiral staircase with irregular lines. Uneven finish. Right next to it — an indoor pool with spa amenities. And I keep asking myself... Do these stairs really fit the aesthetic? To me, no. Not because curved stairs are wrong. But because they're in the wrong place. The pool area suggests calm. Clean lines. Quiet luxury. The staircase feels heavy. Almost accidental. In high-end residential design, the entrance moment sets the tone. What would you do — demolish, redesign and redo? Or keep it?

EXAMPLE 2 (field notes from an event):
Yesterday I participated in the first ever Ethiopian Infrastructure & Construction Week at the Convention Center in Addis Ababa. One of the conversations that really stayed with me was about the upcoming Bishoftu International Airport. It's a big project. The scale, the vision, the long term impact... Sitting there, I kept thinking about materials, execution, and long-term performance. Projects like this demand more than conventional solutions. We're looking forward to seeing this project take shape. And when the time comes, we're ready to contribute.

EXAMPLE 3 (engaging with others' work):
It's beautiful seeing architects incorporate these kinds of exterior facades to their designs. These kinds of facades can come to life using UHPC and GFRC systems.

EXAMPLE 4 (technical education with a question):
A single-piece bathroom element where the countertop and sink are fabricated as one seamless form. Using composite concrete systems like GRC and UHPC, elements like this can be produced as a single piece, eliminating the joint between sink and countertop. Compared to traditional installations where the sink and counter are separate materials, this approach can offer seamless integration, cleaner detailing, and more sculptural design possibilities. Would an integrated system like this simplify design or installation in your projects?

WHAT MAKES HIS VOICE WORK:
- Opens with a scene or a direct observation, often second person ("You open...", "Walk into...")
- Very short sentences. Fragments are fine. "To me, no."
- States opinions plainly and decisively
- Never explains like a textbook. Shows, doesn't lecture.
- One sharp reframing idea per post
- Ends with a real question that invites people to share their own experience
- Never uses phrases like "As someone who is passionate about..." or "testament to" or "in today's world" or "the construction industry is evolving"
"""

UTOPIA_CONTEXT = """
You write LinkedIn posts AS the founder of Utopia Advanced Composites Manufacturing PLC, Addis Ababa, Ethiopia.

COMPANY:
- Makes GFRC (Glass Fibre Reinforced Concrete) and UHPC (Ultra High Performance Concrete)
- The ONLY manufacturer of both in Ethiopia - a monopoly
- Early stage, building brand through real projects and samples

BRAND PILLARS:
1. Monopoly - sole manufacturer in Ethiopia. Felt, never bragged.
2. Design Freedom - any shape/texture/form impossible with traditional concrete
3. Performance - UHPC 5x stronger than normal concrete; GFRC lightweight, weather-resistant

AUDIENCE: Ethiopian government & infrastructure decision-makers, real estate & luxury hotel developers, architects, engineers, contractors.

THE 3 CLIENT ARCHETYPES (personal posts only):
1. The Pioneer - curious, spends to explore, analyzes critically, gets extraordinary results (e.g. SterKeys luxury residential stairs project)
2. The Validator - needs to see completed projects before committing. Smart, risk-aware.
3. The Follower - adopts only when everyone is talking about it.
"""

QUALITY_RUBRIC = """
BEFORE returning the post, check it against this rubric. If it fails ANY check, rewrite it:

1. Does the first line make the reader stop or do something? (If it starts with "As someone..." or "In today's..." - FAIL, rewrite)
2. Is there ONE sharp, quotable idea in the post? (If it's just description - FAIL, rewrite)
3. Are the sentences short and punchy? (If they're long and flowing like an essay - FAIL, rewrite)
4. Does it sound like a real person talking, not a brand or an AI? (If it has "passionate", "testament", "evolving landscape", "cutting-edge solutions" - FAIL, rewrite)
5. Does the closing question invite people to share THEIR experience? (If it's a generic "what do you think?" - make it specific)
6. Did you invent any named company, person, meeting, or event NOT in the input? (If yes - FAIL, rewrite without it)
7. Does it start with the word "I"? (If yes - rewrite the opening)

Only return a post that passes all 7.
"""

ABSOLUTE_RULES = """
ABSOLUTE RULES:
- NEVER invent meetings, site visits, conversations, or encounters with real named companies or people not given as input
- NEVER name a specific company (Radisson Blu, Hilton, etc.) unless that name was in the input
- NEVER fabricate project details, client names, or events
- Vague and honest beats specific and false
- BAD: "I met the Radisson Blu team last week"
- GOOD: "Visiting a luxury hotel project last week, the conversation kept coming back to one thing"
"""

PERSONAL_PILLARS = [
    "archetype_pioneer", "archetype_validator", "archetype_follower",
    "design_opinion", "field_notes", "market_observation", "engaging_others_work"
]

COMPANY_PILLARS = [
    "monopoly", "material_education_uhpc", "material_education_gfrc",
    "project_showcase", "design_freedom", "performance_data",
    "application_spotlight", "industry_positioning"
]

def load_content_log():
    if os.path.exists("content_log.json"):
        with open("content_log.json", "r") as f:
            return json.load(f)
    return {"posts": []}

def get_last_pillar(log, account):
    posts = [p for p in log["posts"] if p["account"] == account]
    if not posts:
        return None
    posts.sort(key=lambda x: x["date"], reverse=True)
    return posts[0].get("pillar")

def choose_pillar(account, log):
    import random
    pillars = PERSONAL_PILLARS if account == "personal" else COMPANY_PILLARS
    # Avoid the last 2 pillars used for this account
    posts = sorted(
        [p for p in log["posts"] if p["account"] == account],
        key=lambda x: x["date"], reverse=True
    )
    recent = {p.get("pillar") for p in posts[:2]}
    available = [p for p in pillars if p not in recent]
    if not available:
        available = pillars  # fallback if all pillars recently used
    return random.choice(available)

def generate_post(account, pillar=None, raw_input=None, image_description=None):
    log = load_content_log()
    if pillar is None:
        pillar = choose_pillar(account, log)

    if raw_input:
        mode_instruction = f'MODE: Input-triggered. The founder dropped in this raw idea:\n"{raw_input}"\nTurn it into a polished post in his voice. Stay true to the idea - do not stretch or invent around it.'
    elif image_description:
        mode_instruction = f"MODE: Image post. Image info: {image_description}\nWrite a caption that does NOT describe the image. Open with a hook the image triggers. Add what the image cannot say. End with a question."
    else:
        mode_instruction = f"MODE: Autopilot. Pillar: {pillar}.\nWrite from general market observation and real knowledge - NOT invented specific encounters. Be specific about ideas, general about unverifiable events."

    account_instruction = "Write as the FOUNDER (personal account). First person, observational, opinionated, human." if account == "personal" else "Write as the COMPANY page. Bold, authoritative, educational, first person plural. Still apply the voice rules."

    prompt = f"""{UTOPIA_CONTEXT}

STUDY THESE EXAMPLES OF HIS ACTUAL VOICE - COPY THIS STYLE EXACTLY:
{VOICE_EXAMPLES}

{ABSOLUTE_RULES}

{account_instruction}

{mode_instruction}

{QUALITY_RUBRIC}

Return ONLY the final post text - no preamble, no explanation, no quotes around it, no markdown. Include 3-5 hashtags at the end, always with at least one Ethiopia-specific tag."""

    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "model": "llama-3.3-70b-versatile",
            "max_tokens": 1200,
            "temperature": 0.85,
            "messages": [
                {"role": "system", "content": "You are a ghostwriter who perfectly mimics a specific person's writing voice. You return only the post text, nothing else. You never use generic LinkedIn-AI phrases. You never invent facts."},
                {"role": "user", "content": prompt}
            ]
        }
    )

    data = response.json()
    if "choices" not in data:
        print(f"Error from Groq API: {data}")
        return None, pillar

    post_text = data["choices"][0]["message"]["content"].strip()
    if post_text.startswith('"') and post_text.endswith('"'):
        post_text = post_text[1:-1].strip()
    return post_text, pillar

def log_post(account, pillar, post_text, has_image=False, post_id=None):
    log = load_content_log()
    log["posts"].append({
        "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "account": account,
        "pillar": pillar,
        "hook": post_text[:80],
        "has_image": has_image,
        "linkedin_post_id": post_id or ""
    })
    with open("content_log.json", "w") as f:
        json.dump(log, f, indent=2)

if __name__ == "__main__":
    print("Generating a test personal post...\n")
    text, pillar = generate_post("personal")
    print(f"Pillar: {pillar}\n")
    print(text)
