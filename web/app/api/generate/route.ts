/**
 * POST /api/generate
 *
 * Generates a LinkedIn post using Claude (Anthropic).
 * This is the "only you write" requirement — no Groq, no other LLM.
 *
 * Body: { account: "personal" | "company", pillar?: string, rawIdea?: string }
 * Returns: { post: string, pillar: string }
 */

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Account } from '@/lib/types'

const VOICE_EXAMPLES = `
EXAMPLE 1 (design opinion):
You open the French doors of a luxury residence. This is the first thing you see. A spiral staircase with irregular lines. Uneven finish. Right next to it — an indoor pool with spa amenities. And I keep asking myself... Do these stairs really fit the aesthetic? To me, no. Not because curved stairs are wrong. But because they're in the wrong place. The pool area suggests calm. Clean lines. Quiet luxury. The staircase feels heavy. Almost accidental. In high-end residential design, the entrance moment sets the tone. What would you do — demolish, redesign and redo? Or keep it?

EXAMPLE 2 (field notes):
Yesterday I participated in the first ever Ethiopian Infrastructure & Construction Week at the Convention Center in Addis Ababa. One of the conversations that really stayed with me was about the upcoming Bishoftu International Airport. Projects like this demand more than conventional solutions. We're looking forward to seeing this project take shape. And when the time comes, we're ready to contribute.

EXAMPLE 3 (technical detail):
The detail that separates a good building from a great one is almost never visible from the street. It's the edge of a stair tread. The transition between a wall panel and a column. The shadow line on a facade at 4pm. UHPC allows for details at a scale that regular concrete can't. Thinner edges. Sharper profiles. Tighter tolerances. What's a detail you've drawn that you've never been able to execute exactly as designed?

VOICE RULES:
- Opens with a scene or observation, often second person
- Very short sentences. Fragments are fine.
- States opinions plainly. Never lectures.
- Ends with a real question that invites response
- Never: "As someone passionate about...", "testament to", "cutting-edge solutions"
- Never start with "I" as the first word
`

const UTOPIA_CONTEXT = `
You write LinkedIn posts for Utopia Advanced Composites Manufacturing PLC, Addis Ababa, Ethiopia.
- Makes GFRC (Glass Fibre Reinforced Concrete) and UHPC (Ultra High Performance Concrete)
- The ONLY manufacturer of both in Ethiopia
- Audience: developers, architects, engineers, government decision-makers
`

const PERSONAL_PILLARS = [
  'archetype_pioneer', 'archetype_validator', 'archetype_follower',
  'design_opinion', 'field_notes', 'market_observation', 'engaging_others_work',
]

const COMPANY_PILLARS = [
  'monopoly', 'material_education_uhpc', 'material_education_gfrc',
  'project_showcase', 'design_freedom', 'performance_data',
  'application_spotlight', 'industry_positioning',
]

function randomPillar(account: Account): string {
  const pillars = account === 'personal' ? PERSONAL_PILLARS : COMPANY_PILLARS
  return pillars[Math.floor(Math.random() * pillars.length)]
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { account, pillar: requestedPillar, rawIdea } = body as {
      account: Account
      pillar?: string
      rawIdea?: string
    }

    const pillar = requestedPillar || randomPillar(account)
    const accountInstruction = account === 'personal'
      ? 'Write as the FOUNDER (personal LinkedIn). First person, observational, opinionated, human.'
      : 'Write as the COMPANY PAGE. Bold, authoritative, educational, first person plural (we).'

    const modeInstruction = rawIdea
      ? `The founder dropped this raw idea: "${rawIdea}"\nTurn it into a polished post in his voice. Stay true to the idea.`
      : `Pillar: ${pillar}. Write from real market observation — NOT invented specific encounters.`

    const prompt = `${UTOPIA_CONTEXT}

STUDY THIS VOICE — COPY IT EXACTLY:
${VOICE_EXAMPLES}

${accountInstruction}
${modeInstruction}

QUALITY CHECK — rewrite if any fail:
1. Does the first line make someone stop scrolling?
2. Is there ONE sharp quotable idea?
3. Short punchy sentences?
4. Sounds like a real person, not AI or a brand?
5. Closing question invites real response?
6. No invented names, companies, or events not in the input?
7. Does NOT start with the word "I"?

Return ONLY the final post text. No preamble. No quotes. No markdown.
Include 3-5 hashtags at the end, always with at least one Ethiopia-specific tag.`

    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const post = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    return NextResponse.json({ post, pillar })
  } catch (err) {
    console.error('[/api/generate]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 }
    )
  }
}
