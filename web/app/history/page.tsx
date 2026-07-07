import { getContentLog } from '@/lib/github'

function score(p: { likes: number; comments: number; shares: number; views: number }) {
  return (p.comments * 4) + (p.shares * 3) + (p.likes * 1) + Math.round(p.views * 0.01)
}

export default async function HistoryPage() {
  const log = await getContentLog().catch(() => ({ posts: [] }))

  const posts = [...log.posts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  const topPost = posts.reduce<typeof posts[0] | null>((best, p) => {
    if (!best) return p
    return score(p) > score(best) ? p : best
  }, null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#e8e8e8]">History</h1>
        <p className="text-[#555] text-sm mt-1">{posts.length} posts published</p>
      </div>

      {/* Top performer */}
      {topPost && score(topPost) > 0 && (
        <div className="bg-[#111] border border-[#c8a96e]/20 rounded-lg p-4">
          <p className="text-xs text-[#c8a96e] mb-2 uppercase tracking-wider">Top performer</p>
          <p className="text-sm text-[#ccc] leading-relaxed">{topPost.hook}</p>
          <div className="flex gap-4 mt-3">
            <EngStat label="Views"    value={topPost.views}    />
            <EngStat label="Likes"    value={topPost.likes}    />
            <EngStat label="Comments" value={topPost.comments} />
            <EngStat label="Shares"   value={topPost.shares}   />
          </div>
        </div>
      )}

      {/* Post list */}
      {posts.length === 0 ? (
        <div className="text-center py-16 text-[#444] text-sm">
          No posts yet. Start posting from the Queue or Write pages.
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p, i) => (
            <div key={i} className="bg-[#111] border border-[#1e1e1e] rounded-lg p-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
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
                    {p.has_image && (
                      <span className="text-xs text-[#555]">📷 image</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {score(p) > 0 ? (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right">
                      <EngStat label="Views"    value={p.views}    small />
                      <EngStat label="Likes"    value={p.likes}    small />
                      <EngStat label="Comments" value={p.comments} small />
                      <EngStat label="Shares"   value={p.shares}   small />
                    </div>
                  ) : (
                    <span className="text-xs text-[#333]">No analytics yet</span>
                  )}
                </div>
              </div>
              {p.linkedin_post_id && (
                <p className="mt-2 text-xs text-[#333] font-mono truncate">{p.linkedin_post_id}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EngStat({ label, value, small }: { label: string; value: number; small?: boolean }) {
  return (
    <div className={small ? '' : 'text-center'}>
      <p className={`font-medium ${small ? 'text-xs text-[#ccc]' : 'text-lg text-[#e8e8e8]'}`}>
        {value.toLocaleString()}
      </p>
      <p className="text-[10px] text-[#444]">{label}</p>
    </div>
  )
}
