/**
 * PUT    /api/queue/[id]?account=personal|company  → update post content
 * DELETE /api/queue/[id]?account=personal|company  → remove from queue
 */

import { NextResponse } from 'next/server'
import { getQueuePost, saveQueuePost, deleteQueuePost, buildQueueFile } from '@/lib/github'
import { Octokit } from '@octokit/rest'
import type { Account } from '@/lib/types'

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url)
  const account = (searchParams.get('account') || 'personal') as Account
  const { id } = params

  try {
    const body = await request.json()
    const { content, name, scheduledDate } = body as {
      content: string
      name?: string
      scheduledDate?: string | null
    }

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })
    const { data } = await octokit.repos.getContent({
      owner: 'mesigetu7',
      repo: 'utopia-linkedin',
      path: `queue/${account}/${id}.txt`,
    })
    const file = data as { sha: string }

    const raw = buildQueueFile(name || '', content, scheduledDate || undefined)
    await saveQueuePost(account, id, raw, file.sha)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update post' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url)
  const account = (searchParams.get('account') || 'personal') as Account
  const { id } = params

  try {
    await deleteQueuePost(account, id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete post' },
      { status: 500 }
    )
  }
}
