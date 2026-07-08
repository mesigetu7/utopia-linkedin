/**
 * Dashboard — overview of queue status and recent posting activity.
 * Activity only (no engagement metrics — LinkedIn personal analytics aren't
 * available via the API).
 */
import Link from 'next/link'
import { listQueue, getContentLog } from '@/lib/github'

// Always read live queue + log data — never serve a build-time snapshot.
export const dynamic = 'force-dynamic'

function postedThisWeek(posts: { date: string }[]) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  return posts.filter(p => {
    const t = new Date(p.date).getTime()
    return !isNaN(t) && t >= weekAgo
  }).length
}

export default async function Dashboard() {
  const [personalQueue, companyQueue, log] = await Promise.all([
    listQueue('personal').catch(() => []),
    listQueue('company').catch(() => []),
    getContentLog().catch(() => ({ posts: [] })),
  ])

  const recentPosts = [...log.posts]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  const thisWeek = postedThisWeek(log.posts)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[#e8e8e8]">Dashboard</h1>
        <p className="text-[#666] text-sm mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Personal queue" value={String(personalQueue.length)} suffix="posts" href="/queue?account=personal" />
        <StatCard label="Company queue" value={String(companyQueue.length)} suffix="posts" href="/queue?account=company" />
        <StatCard label="Total posted" value={String(log.posts.length)} suffix="all time" href="/history" />
        <StatCard label="This week" value={String(thisWeek)} suffix="posted" href="/history" />
      </div>

      {/* Queue health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <QueueStatus
          account="Personal"
          count={personalQueue.length}
          href="/queue?account=personal"
          firstPostId={personalQueue[0]?.id || null}
          nextPost={personalQueue[0]?.content.split('\n')[0] || null}
        />
        <QueueStatus
          account="Company"
          count={companyQueue.length}
          href="/queue?account=company"
          firstPostId={companyQueue[0]?.id || null}
          nextPost={companyQueue[0]?.content.split('\n')[0] || null}
        />
      </div>

      {/* Recent posts */}
      {recentPosts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-[#888] uppercase tracking-wider">Recent posts</h2>
            <Link href="/history" className="text-xs text-[#c8a96e] hover:underline">
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {recentPosts.map((p, i) => (
              <Link
                key={i}
                href="/history"
                className="block bg-[#111] border border-[#1e1e1e] rounded-lg p-4 hover:border-[#2a2a2a] transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#ccc] line-clamp-2 leading-relaxed">{p.hook}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        p.account === 'personal'
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-purple-500/10 text-purple-400'
                      }`}>
                        {p.account}
                      </span>
                      <span className="text-xs text-[#555]">{p.date}</span>
                      {p.has_image && (
                        <span className="text-xs text-[#c8a96e]">📷 photo</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-3 pt-2">
        <Link
          href="/write"
          className="px-4 py-2 bg-[#c8a96e] text-black text-sm font-medium rounded-lg hover:bg-[#d4b87a] transition-colors"
        >
          Write new post
        </Link>
        <Link
          href="/queue"
          className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] text-sm rounded-lg hover:text-[#ccc] hover:border-[#3a3a3a] transition-colors"
        >
          Manage queue
        </Link>
      </div>
    </div>
  )
}

function StatCard({ label, value, suffix, href }: { label: string; value: string; suffix: string; href?: string }) {
  const inner = (
    <>
      <p className="text-xs text-[#555] mb-1">{label}</p>
      <p className="text-2xl font-semibold text-[#e8e8e8]">{value}</p>
      <p className="text-xs text-[#444] mt-0.5">{suffix}</p>
    </>
  )
  if (href) {
    return (
      <Link
        href={href}
        className="block bg-[#111] border border-[#1e1e1e] rounded-lg p-4 hover:border-[#c8a96e]/40 hover:bg-white/[0.02] transition-colors"
      >
        {inner}
      </Link>
    )
  }
  return <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-4">{inner}</div>
}

function QueueStatus({
  account, count, href, firstPostId, nextPost
}: {
  account: string; count: number; href: string; firstPostId: string | null; nextPost: string | null
}) {
  const status = count === 0 ? 'empty' : count <= 2 ? 'low' : 'healthy'
  const statusColor = { empty: 'text-red-400', low: 'text-yellow-400', healthy: 'text-green-400' }[status]
  const statusText = { empty: 'Empty — needs posts', low: 'Running low', healthy: 'Healthy' }[status]

  // If there's a queued post, clicking the preview opens it directly.
  const previewHref = firstPostId ? `${href}&open=${encodeURIComponent(firstPostId)}` : href

  return (
    <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-[#ccc]">{account}</span>
        <span className={`text-xs ${statusColor}`}>{statusText}</span>
      </div>
      <Link href={previewHref} className="block group">
        <p className="text-[#555] group-hover:text-[#888] text-sm line-clamp-2 min-h-[40px] transition-colors">
          {nextPost || 'No posts queued'}
        </p>
      </Link>
      <Link
        href={href}
        className="inline-block mt-3 text-xs text-[#c8a96e] hover:underline"
      >
        {count} post{count !== 1 ? 's' : ''} queued →
      </Link>
    </div>
  )
}
