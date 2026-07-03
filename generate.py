import os
import json
import requests
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

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

EXAMPLE 5 (his sharpest post - study closely):
The detail that separates a good building from a great one is almost never visible from the street.

It's the edge of a stair tread. The transition between a wall panel and a column. The shadow line on a facade at 4pm. The way a surface responds to rain — whether it looks better wet or worse.

These are the things architects obsess over and clients rarely notice consciously. But they notice the result. A building that gets these details right feels considered. One that doesn't feels like it's missing something, even if no one can name what.

UHPC allows for details at a scale that regular concrete can't. Thinner edges. Sharper profiles. Tighter tolerances. The gap between what the render shows and what gets built doesn't have to exist.

What I keep hearing from architects who work with it for the first time is some version of: "I didn't know I could actually get what I drew."

That's the shift. Not the material itself — but the idea that the drawing doesn't have to be a negotiation with the buildable.

What's a detail you've drawn that you've never been able to execute exactly as designed?

WHAT MAKES HIS VOICE WORK:
- Opens with a scene or a direct observation, often second person
- Very short sentences. Fragments are fine.
- States opinions plainly and decisively
- Never explains like a textbook. Shows, doesn't lecture.
- One sharp reframing idea per post
- Ends with a real question that invites people to share their own experience
- Never uses phrases like 'As someone who is passionate about...' or 'testament to' or 'in today's world'
"""

UTOPIA_CONTEXT = """
You write LinkedIn posts AS the founder of Utopia Advanced Composites Manufacturing PLC, Addis Ababa, Ethiopia.
COMPANY: Makes GFRC and UHPC. The ONLY manufacturer of both in Ethiopia.
BRAND PILLARS: Monopoly, Design Freedom, Performance.
AUDIENCE: Ethiopian government, real estate developers, architects, engineers.
"""

QUALITY_RUBRIC = """
Check before returning: no 'I' as first word, one sharp idea, short sentences, sounds human, specific closing question, no invented facts.
"""

PERSONAL_PILLARS = ["archetype_pioneer","archetype_validator","archetype_follower","design_opinion","field_notes","market_observation","engaging_others_work"]
COMPANY_PILLARS = ["monopoly","material_education_uhpc","material_education_gfrc","project_showcase","design_freedom","performance_data","application_spotlight","industry_positioning"]

def load_content_log():
    import os, json
    if os.path.exists('content_log.json'):
        with open('content_log.json','r') as f: return json.load(f)
    return {'posts':[]}

def engagement_score(post):
    return (post.get('comments',0) or 0)*4+(post.get('shares',0) or 0)*3+(post.get('likes',0) or 0)+(post.get('views',0) or 0)*0.01

def choose_pillar(account, log):
    import random
    pillars = PERSONAL_PILLARS if account=='personal' else COMPANY_PILLARS
    posts = sorted([p for p in log['posts'] if p['account']==account], key=lambda x:x['date'], reverse=True)
    recent = {p.get('pillar') for p in posts[:2]}
    available = [p for p in pillars if p not in recent] or pillars
    scores = {p: max(sum(engagement_score(x) for x in posts if x.get('pillar')==p)/max(len([x for x in posts if x.get('pillar')==p]),1),0.1) for p in available}
    total = sum(scores.values())
    return random.choices(available, weights=[scores[p]/total for p in available], k=1)[0]

def generate_post(account, pillar=None, raw_input=None, image_description=None):
    log = load_content_log()
    if pillar is None: pillar = choose_pillar(account, log)
    print('AUTOPILOT DISABLED: Queue is empty. Open Cowork to write more posts.')
    return None, pillar

def log_post(account, pillar, post_text, has_image=False, post_id=None):
    import json
    log = load_content_log()
    log['posts'].append({'date':__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M'),'account':account,'pillar':pillar,'hook':post_text[:80],'has_image':has_image,'linkedin_post_id':post_id or '','views':0,'likes':0,'comments':0,'shares':0})
    with open('content_log.json','w') as f: json.dump(log,f,indent=2)

def update_engagement(post_id, views=0, likes=0, comments=0, shares=0):
    import json
    log = load_content_log()
    for post in log['posts']:
        if post.get('linkedin_post_id')==post_id:
            post.update({'views':views,'likes':likes,'comments':comments,'shares':shares})
            with open('content_log.json','w') as f: json.dump(log,f,indent=2)
            print(f'Engagement updated for {post_id}')
            return True
    print(f'Post ID not found: {post_id}')
    return False

if __name__=='__main__':
    print('Autopilot disabled. Add posts to queue via Cowork.')
