/**
 * Direct LinkedIn posting — no Composio, no paid cloud API.
 *
 * Uses the same tokens as post.py:
 *   LINKEDIN_PERSONAL_TOKEN — bearer token (works for both accounts)
 *   LINKEDIN_PERSON_URN     — author URN for personal posts
 *   LINKEDIN_COMPANY_ID     — org id, used as urn:li:organization:{id} for company posts
 *
 * Text posts and image posts (3-step asset upload) both go through
 * https://api.linkedin.com/v2 directly. The caption is posted verbatim —
 * whatever text you wrote is exactly what gets published.
 */

import type { PostRequest, PostResult } from './types'

const LINKEDIN_API = 'https://api.linkedin.com/v2'

function getAuth(account: 'personal' | 'company'): { token: string; authorUrn: string } {
  const token = process.env.LINKEDIN_PERSONAL_TOKEN
  if (!token) throw new Error('LINKEDIN_PERSONAL_TOKEN is not set')

  if (account === 'company') {
    const companyId = process.env.LINKEDIN_COMPANY_ID
    if (!companyId) throw new Error('LINKEDIN_COMPANY_ID is not set')
    return { token, authorUrn: `urn:li:organization:${companyId}` }
  }

  const personUrn = process.env.LINKEDIN_PERSON_URN
  if (!personUrn) throw new Error('LINKEDIN_PERSON_URN is not set')
  return { token, authorUrn: personUrn }
}

// ─── Image upload (3 steps) ──────────────────────────────────────────────────

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
    uploadUrl: data.value.uploadMechanism[
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
    ].uploadUrl as string,
    assetUrn: data.value.asset as string,
  }
}

async function uploadImageBinary(uploadUrl: string, buffer: Buffer, mime: string, token: string) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': mime },
    body: new Uint8Array(buffer),
  })
  if (!res.ok) throw new Error(`Image binary upload failed: ${res.status}`)
}

// ─── ugcPosts payload ────────────────────────────────────────────────────────

function buildPayload(authorUrn: string, text: string, assetUrn?: string) {
  const shareContent: Record<string, unknown> = {
    shareCommentary: { text },
    shareMediaCategory: assetUrn ? 'IMAGE' : 'NONE',
  }
  if (assetUrn) {
    shareContent.media = [
      { status: 'READY', description: { text: '' }, media: assetUrn, title: { text: '' } },
    ]
  }
  return {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: { 'com.linkedin.ugc.ShareContent': shareContent },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  }
}

/**
 * Post to LinkedIn using the personal access token directly.
 * If req.imageBase64 is provided, uploads the image first (3-step) and attaches it.
 * The text is posted exactly as given — no rewriting, no AI.
 */
export async function postToLinkedIn(req: PostRequest): Promise<PostResult> {
  try {
    const { token, authorUrn } = getAuth(req.account)

    let assetUrn: string | undefined
    if (req.imageBase64) {
      const mime = req.imageMime || 'image/jpeg'
      const base64Data = req.imageBase64.replace(/^data:[^;]+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')

      const reg = await registerImageUpload(token, authorUrn)
      await uploadImageBinary(reg.uploadUrl, buffer, mime, token)
      // Give LinkedIn a moment to process the asset before referencing it.
      await new Promise(r => setTimeout(r, 2000))
      assetUrn = reg.assetUrn
    }

    const res = await fetch(`${LINKEDIN_API}/ugcPosts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(buildPayload(authorUrn, req.text, assetUrn)),
    })

    if (res.status === 201) {
      let postId = res.headers.get('x-restli-id') || ''
      if (!postId) {
        try {
          const body = await res.json()
          postId = (body?.id as string) || ''
        } catch {
          /* header-only response */
        }
      }
      return { success: true, postId }
    }

    let detail: string
    try {
      detail = JSON.stringify(await res.json())
    } catch {
      detail = await res.text()
    }
    return { success: false, error: `LinkedIn API ${res.status}: ${detail}` }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Lightweight connection check — verifies the token can read the member profile.
 */
export async function checkLinkedInConnection(): Promise<boolean> {
  const token = process.env.LINKEDIN_PERSONAL_TOKEN
  if (!token) return false
  try {
    const res = await fetch(`${LINKEDIN_API}/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch {
    return false
  }
}
