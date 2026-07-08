/**
 * POST /api/upload
 *
 * Full image-to-LinkedIn pipeline:
 * 1. Receive image (base64) + optional caption idea
 * 2. Upload image to LinkedIn via 3-step asset API
 * 3. Generate caption with Claude (image-triggered voice rules)
 * 4. Create LinkedIn post with image + caption
 * 5. Log to content_log.json
 *
 * Body: {
 *   imageBase64: string,   // data URL, e.g. "data:image/jpeg;base64,..."
 *   imageMime:   string,   // "image/jpeg" | "image/png" | "image/webp"
 *   account:     "personal" | "company",
 *   captionIdea: string,   // optional raw idea for Claude to expand
 *   postNow:     boolean,  // true = post immediately; false = return draft for editing
 * }
 */

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Octokit } from '@octokit/rest'
import { getContentLog } from '@/lib/github'
import type { Account } from '@/lib/types'

const LINKEDIN_API = 'https://api.linkedin.com/v2'

// ─── LinkedIn image upload (3 steps) ─────────────────────────────────────────

async function registerImageUpload(token: string, authorUrn: string) {
  const res = await fetch(`${LINKEDIN_API}/assets?action=registerUpload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: authorUrn,
        serviceRelationships: [
          { relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' },
        ],
      },
    }),
  })
  if (!res.ok) throw new Error(`Register upload failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return {
    uploadUrl: data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl as string,
    assetUrn: data.value.asset as string,
  }
}

async function uploadImageBinary(uploadUrl: string, imageBuffer: Buffer, mime: string) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mime },
    body: new Uint8Array(imageBuffer),
  })
  if (!res.ok) throw new Error(`Image binary upload failed: ${res.status}`)
}

async function createLinkedInImagePost(
  token: string,
  authorUrn: string,
  caption: string,
  assetUrn: string
) {
  const res = await fetch(`${LINKEDIN_API}/ugcPosts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: caption },
          shareMediaCategory: 'IMAGE',
          media: [
            {
              status: 'READY',
              description: { text: '' },
              media: assetUrn,
              title: { text: '' },
            },
          ],
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  })
  if (!res.ok) throw new Error(`Create post failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.id as string
}

// ─── Caption generation ───────────────────────────────────────────────────────

async function generateCaption(account: Account, captionIdea?: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const accountInstruction = account === 'personal'
    ? 'Write as the FOUNDER (personal LinkedIn). First person, observational, opinionated, human.'
    : 'Write as the COMPANY PAGE. Bold, authoritative, educational, first person plural (we).'

  const modeInstruction = captionIdea
    ? `The founder's idea for this image: "${captionIdea}"\nExpand this into a caption that adds what the image cannot say alone.`
    : `Write a caption triggered by the image. Open with a hook the image creates. Add what the image cannot say. End with a question.`

  const prompt = `You write LinkedIn posts for Utopia Advanced Composites Manufacturing PLC, Addis Ababa — the only GFRC and UHPC manufacturer in Ethiopia.

${accountInstruction}
${modeInstruction}

IMAGE CAPTION RULE — CRITICAL:
The caption must NEVER just describe what is in the image. The audience can see it. Ask yourself: "What does this image make me want to say that I could not say without it?" If the caption could exist without the image, rewrite it.

Voice rules:
- Short punchy sentences. Fragments are fine.
- Opens with something triggered by the image, not a description of it
- One sharp idea per post
- Ends with a real question
- Never starts with "I" as first word
- No: "passionate about", "testament to", "cutting-edge", "excited to share"

Return ONLY the caption text. No preamble, no quotes.
3-5 hashtags at end, at least one Ethiopia-specific.`

  const client = new Anthropic({ apiKey })
  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })

  return message.content[0].type === 'text' ? message.content[0].text.trim() : ''
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { imageBase64, imageMime, account, captionIdea, postNow } = body as {
      imageBase64: string
      imageMime: string
      account: Account
      captionIdea?: string
      postNow: boolean
    }

    if (!imageBase64 || !imageMime || !account) {
      return NextResponse.json({ error: 'imageBase64, imageMime, and account are required' }, { status: 400 })
    }

    // 1. Generate caption with Claude
    const caption = await generateCaption(account, captionIdea)

    // If just generating a draft (not posting yet), return the caption for editing
    if (!postNow) {
      return NextResponse.json({ caption, imageBase64, imageMime })
    }

    // 2. Get LinkedIn credentials
    const token = account === 'personal'
      ? process.env.LINKEDIN_PERSONAL_TOKEN
      : process.env.LINKEDIN_COMPANY_TOKEN

    const authorUrn = account === 'personal'
      ? process.env.LINKEDIN_PERSON_URN
      : `urn:li:organization:${process.env.LINKEDIN_COMPANY_ID}`

    if (!token || !authorUrn) {
      return NextResponse.json(
        { error: `LinkedIn credentials not set for ${account} account` },
        { status: 500 }
      )
    }

    // 3. Convert base64 to buffer
    const base64Data = imageBase64.replace(/^data:[^;]+;base64,/, '')
    const imageBuffer = Buffer.from(base64Data, 'base64')

    // 4. Upload image to LinkedIn (3 steps)
    const { uploadUrl, assetUrn } = await registerImageUpload(token, authorUrn)
    await uploadImageBinary(uploadUrl, imageBuffer, imageMime)

    // Small delay to let LinkedIn process the upload
    await new Promise(r => setTimeout(r, 2000))

    // 5. Create the post
    const postId = await createLinkedInImagePost(token, authorUrn, caption, assetUrn)

    // 6. Log to content_log.json
    try {
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })
      const log = await getContentLog()
      log.posts.push({
        date: new Date().toISOString().slice(0, 16).replace('T', ' '),
        account,
        pillar: 'image_post',
        hook: caption.slice(0, 80),
        has_image: true,
        linkedin_post_id: postId,
        views: 0, likes: 0, comments: 0, shares: 0,
      })
      const { data } = await octokit.repos.getContent({
        owner: 'mesigetu7', repo: 'utopia-linkedin', path: 'content_log.json'
      })
      const file = data as { sha: string }
      await octokit.repos.createOrUpdateFileContents({
        owner: 'mesigetu7', repo: 'utopia-linkedin', path: 'content_log.json',
        message: `Log image post: ${new Date().toISOString().slice(0, 10)}`,
        content: Buffer.from(JSON.stringify(log, null, 2)).toString('base64'),
        sha: file.sha,
      })
    } catch (e) {
      console.error('Failed to update content_log:', e)
    }

    return NextResponse.json({ success: true, postId, caption })
  } catch (err) {
    console.error('[/api/upload]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
