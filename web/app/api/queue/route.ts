/**
 * GET  /api/queue?account=personal|company  → list queued posts
 * POST /api/queue                            → add new post to queue
 */

import { NextResponse } from 'next/server'
import { listQueue, saveQueuePost, nextPostId, buildQueueFile } from '@/lib/github'
import type { Account } from '@/lib/types'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const account = (searchParams.get('account') || 'personal') as Account

  try {
    const posts = await listQueue(account)
    return NextResponse.json({ posts })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load queue' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { account, content, name } = body as { account: Account; content: string; name?: string }

    if (!account || !content) {
      return NextResponse.json({ error: 'account and content are required' }, { status: 400 })
    }

    const id = await nextPostId(account)
    const raw = buildQueueFile(name || '', content)
    await saveQueuePost(account, id, raw)

    return NextResponse.json({ success: true, id })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save post' },
      { status: 500 }
    )
  }
}
