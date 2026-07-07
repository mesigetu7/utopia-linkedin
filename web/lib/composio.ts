/**
 * Composio LinkedIn integration
 *
 * Composio manages OAuth token refresh automatically — no more manual token rotation.
 *
 * Setup:
 * 1. Create a Composio account at app.composio.dev
 * 2. Connect your LinkedIn account under Integrations → LinkedIn
 * 3. Copy your API key to COMPOSIO_API_KEY in .env.local
 * 4. Set COMPOSIO_ENTITY_ID to the entity ID you connected LinkedIn with
 *    (defaults to "default" which works for single-user setup)
 *
 * Composio action used: LINKEDIN_CREATE_LINKEDIN_POST
 */

import { ComposioToolSet } from 'composio-core'
import type { PostRequest, PostResult } from './types'

function getToolset() {
  const apiKey = process.env.COMPOSIO_API_KEY
  if (!apiKey) throw new Error('COMPOSIO_API_KEY is not set')
  return new ComposioToolSet({ apiKey })
}

/**
 * Post text (and optionally an image) to LinkedIn via Composio.
 * Composio handles token management — just pass the content.
 */
export async function postToLinkedIn(req: PostRequest): Promise<PostResult> {
  const entityId = process.env.COMPOSIO_ENTITY_ID || 'default'

  try {
    const toolset = getToolset()

    // Build action params
    // Composio's LINKEDIN_CREATE_LINKEDIN_POST accepts:
    //   text: string          — the post body
    //   visibility: string    — PUBLIC | CONNECTIONS
    const params: Record<string, unknown> = {
      text: req.text,
      visibility: 'PUBLIC',
    }

    const result = await toolset.executeAction({
      action: 'LINKEDIN_CREATE_LINKEDIN_POST',
      params,
      entityId,
    })

    // Composio returns { data, successfull }
    if (result?.successfull === false) {
      return { success: false, error: JSON.stringify(result?.error || result) }
    }

    const postId = (result?.data as Record<string, unknown>)?.id as string | undefined
    return { success: true, postId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: msg }
  }
}

/**
 * Check whether the LinkedIn connection is live.
 * Returns true if Composio has an active connection, false otherwise.
 */
export async function checkLinkedInConnection(): Promise<boolean> {
  const entityId = process.env.COMPOSIO_ENTITY_ID || 'default'
  try {
    const toolset = getToolset()
    const entity = await toolset.client.getEntity(entityId)
    const connection = await entity.getConnection({ app: 'linkedin' })
    return connection?.status === 'ACTIVE'
  } catch {
    return false
  }
}
