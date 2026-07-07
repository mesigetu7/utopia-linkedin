/**
 * GET /api/history?account=personal|company|all
 *
 * Returns post history from content_log.json in the repo,
 * optionally filtered by account.
 */

import { NextResponse } from 'next/server'
import { getContentLog } from '@/lib/github'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const account = searchParams.get('account') || 'all'

  try {
    const log = await getContentLog()
    const posts = account === 'all'
      ? log.posts
      : log.posts.filter(p => p.account === account)

    // Most recent first
    const sorted = [...posts].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    return NextResponse.json({ posts: sorted })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load history' },
      { status: 500 }
    )
  }
}
