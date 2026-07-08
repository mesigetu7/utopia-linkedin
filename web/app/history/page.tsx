import { getContentLog } from '@/lib/github'
import type { LogPost } from '@/lib/types'

// Always read the live content log — never serve a build-time snapshot.
export const dynamic = 'force-dynamic'

function parseDate(d: string): Date {
  // Handles "YYYY-MM-DD" and "YYYY-MM-DD HH:MM"
  return new Date(d.replace(' ', 'T'))
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

export default async function HistoryPage() {
  const log = await getContentLog().catch(() => ({ posts: [] as LogPost[] }))

  const posts = [...log.posts].sort(
    (a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime()
  )

  const week = daysAgo(7)
  const month = daysAgo(30)

  const total = posts.length
  const personal = posts.filter(p => p.account === 'personal').length
  const company = posts.filter(p => p.account === 'company').length
  const withImage = posts.filter(p => p.has_image).length
  const thisWeek = posts.filter(p => parseDate(p.date) >= week).length
  const thisMonth = posts.filter(p => parseDate(p.date) >= month).length
  const lastPost = posts[0] || null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#e8e8e8]">Performance</h1>
        <p className="text-[#555] text-sm mt-1">Posting activity across both accounts</p>
      </div>

      {/* Activity summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total posts" value={total} />
        <Stat label="This week" value={thisWeek} />
        <Stat label="This month" value={thisMonth} />
        <Stat label="With photo" value={withImage} />
      </div>

      {/* Account split + cadence */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-4">
          <p className="text-xs text-[#555] uppercase tracking-wider mb-3">By account</p>
          <div className="flex gap-6">
            <div>
              <p className="text-2xl font-semibold text-blue-400">{personal}</p>
              <p className="text-xs text-[#555] mt-0.5">Personal</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-purple-400">{company}</p>
              <p className="text-xs text-[#555] mt-0.5">Company</p>
            </div>
          </div>
        </div>
        <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-4">
          <p className="text-xs text-[#555] uppercase tracking-wider mb-3">Last post</p>
          {lastPost ? (
            <>
              <p className="text-sm text-[#ccc] leading-snug line-clamp-2">{lastPost.hook}</p>
              <p className="text-xs text-[#444] mt-2">
                {lastPost.account} · {lastPost.date}
              </p>
            </>
          ) : (
            <p className="text-sm text-[#444]">No posts yet</p>
          )}
        </div>
      </div>

      {/* Post history */}
      <div>
        <p className="text-xs text-[#555] uppercase tracking-wider mb-3">All posts</p>
        {posts.length === 0 ? (
          <div className="text-center py-16 text-[#444] text-sm">
            No posts yet. Start posting from the Queue.
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((p, i) => (
              <div key={i} className="bg-[#111] border border-[#1e1e1e] rounded-lg p-4">
                <p className="text-sm text-[#ccc] leading-relaxed">{p.hook}</p>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    p.account === 'personal'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'bg-purple-500/10 text-purple-400'
                  }`}>
                    {p.account}
                  </span>
                  <span className="text-xs text-[#444]">{p.pillar}</span>
                  <span className="text-xs text-[#333]">{p.date}</span>
                  {p.has_image && <span className="text-xs text-[#555]">📷 photo</span>}
                </div>
                {p.linkedin_post_id && (
                  <p className="mt-2 text-xs text-[#333] font-mono truncate">{p.linkedin_post_id}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-4">
      <p className="text-2xl font-semibold text-[#e8e8e8]">{value.toLocaleString()}</p>
      <p className="text-xs text-[#555] mt-0.5">{label}</p>
    </div>
  )
}
