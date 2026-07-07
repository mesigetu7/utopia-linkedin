/**
 * Direct LinkedIn posting — no Composio.
 *
 * Uses the same tokens as post.py:
 *   LINKEDIN_PERSONAL_TOKEN — bearer token (works for both accounts)
 *   LINKEDIN_PERSON_URN     — author URN for personal posts
 *   LINKEDIN_COMPANY_ID     — org id, used as urn:li:organization:{id} for company posts
 *
 * Text-only posts via https://api.linkedin.com/v2/ugcPosts.
 */

import type { PostRequest, PostResult } from './types'

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

/**
 * Post text to LinkedIn using the personal access token directly.
 * Mirrors post.py's post_to_linkedin().
 */
export async function postToLinkedIn(req: PostRequest): Promise<PostResult> {
  try {
    const { token, authorUrn } = getAuth(req.account)

    const payload = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: req.text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    }

    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(payload),
    })

    if (res.status === 201) {
      const postId = res.headers.get('x-restli-id') || ''
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
    const res = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch {
    return false
  }
}
