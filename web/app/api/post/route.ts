/**
 * POST /api/post
 *
 * Posts to LinkedIn via Composio.
 * Composio manages the OAuth token automatically — no expiry handling needed.
 *
 * Body: { text: string, account: "personal" | "company", queueId?: string }
 *
 * If queueId is provided, the queue file is deleted from the repo after a
 * successful post and the post is appended to content_log.json.
 */

import { NextResponse } from 'next/server'
import { postToLinkedIn } from '@/lib/composio'
import { deleteQueuePost, getContentLog } from '@/lib/github'
import { Octokit } from '@octokit/rest'
import type { Account } from '@/lib/types'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { text, account, queueId } = body as {
      text: string
      account: Account
      queueId?: string
    }

    if (!text || !account) {
      return NextResponse.json({ error: 'text and account are required' }, { status: 400 })
    }

    // Post via Composio
    const result = await postToLinkedIn({ text, account })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // If this came from a queue file, delete it and log the post
    if (queueId) {
      try {
        await deleteQueuePost(account, queueId)
      } catch (e) {
        console.error('Failed to delete queue file:', e)
        // Non-fatal — post already went out
      }
    }

    // Append to content_log.json
    try {
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })
      const log = await getContentLog()
      log.posts.push({
        date: new Date().toISOString().slice(0, 16).replace('T', ' '),
        account,
        pillar: 'queued',
        hook: text.slice(0, 80),
        has_image: false,
        linkedin_post_id: result.postId || '',
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
      })

      // Read current SHA
      const { data } = await octokit.repos.getContent({
        owner: 'mesigetu7', repo: 'utopia-linkedin', path: 'content_log.json'
      })
      const file = data as { sha: string }

      await octokit.repos.createOrUpdateFileContents({
        owner: 'mesigetu7',
        repo: 'utopia-linkedin',
        path: 'content_log.json',
        message: `Log post: ${new Date().toISOString().slice(0, 10)}`,
        content: Buffer.from(JSON.stringify(log, null, 2), 'utf-8').toString('base64'),
        sha: file.sha,
      })
    } catch (e) {
      console.error('Failed to update content_log.json:', e)
      // Non-fatal
    }

    return NextResponse.json({ success: true, postId: result.postId })
  } catch (err) {
    console.error('[/api/post]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
