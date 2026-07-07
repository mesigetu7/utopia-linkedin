/**
 * Dashboard — overview of queue status, recent posts, engagement.
 */
import Link from 'next/link'
import { listQueue, getContentLog } from '@/lib/github'

function engagementScore(post: { likes: number; comments: number; shares: number; views: number }) {
  return (post.comments * 4) + (post.shares * 3) + (post.likes * 1) + (post.views * 0.01)
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

  const totalEngagement = log.posts.reduce((s, p) => s + engagementScore(p), 0)
  const avgEngagement = log.posts.length > 0
    ? Math.round(totalEngagement / log.posts.length)
    : 0

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
        <StatCard label="Personal queue" value={String(personalQueue.length)} suffix="posts" />
        <StatCard label="Company queue" value={String(companyQueue.length)} suffix="posts" />
        <StatCard label="Total posted" value={String(log.posts.length)} suffix="all time" />
        <StatCard label="Avg engagement" value={String(avgEngagement)} suffix="score" />
      </div>

      {/* Queue health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <QueueStatus
          account="Personal"
          count={personalQueue.length}
          href="/queue?account=personal"
          nextPost={personalQueue[0]?.content.split('\n')[0] || null}
        />
        <QueueStatus
          account="Company"
          count={companyQueue.length}
          href="/queue?account=company"
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
              <div key={i} className="bg-[#111] border border-[#1e1e1e] rounded-lg p-4">
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
                    </div>
                  </div>
                  {(p.likes > 0 || p.comments > 0) && (
                    <div className="flex items-center gap-3 text-xs text-[#666] shrink-0">
                      <span>{p.likes} likes</span>
                      <span>{p.comments} comments</span>
                    </div>
                  )}
                </div>
              </div>
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

function StatCard({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  return (
    <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-4">
      <p className="text-xs text-[#555] mb-1">{label}</p>
      <p className="text-2xl font-semibold text-[#e8e8e8]">{value}</p>
      <p className="text-xs text-[#444] mt-0.5">{suffix}</p>
    </div>
  )
}

function QueueStatus({
  account, count, href, nextPost
}: {
  account: string; count: number; href: string; nextPost: string | null
}) {
  const status = count === 0 ? 'empty' : count <= 2 ? 'low' : 'healthy'
  const statusColor = { empty: 'text-red-400', low: 'text-yellow-400', healthy: 'text-green-400' }[status]
  const statusText = { empty: 'Empty — needs posts', low: 'Running low', healthy: 'Healthy' }[status]

  return (
    <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-[#ccc]">{account}</span>
        <span className={`text-xs ${statusColor}`}>{statusText}</span>
      </div>
      <p className="text-[#555] text-sm line-clamp-2 min-h-[40px]">
        {nextPost || 'No posts queued'}
      </p>
      <Link
        href={href}
        className="inline-block mt-3 text-xs text-[#c8a96e] hover:underline"
      >
        {count} post{count !== 1 ? 's' : ''} queued →
      </Link>
    </div>
  )
}
