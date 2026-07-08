'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Account, QueuePost } from '@/lib/types'

export default function QueuePage() {
  const [account, setAccount] = useState<Account>('personal')
  const [posts, setPosts] = useState<QueuePost[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editDate, setEditDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [posting, setPosting] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [statusOk, setStatusOk] = useState(true)

  // Per-post photo state
  const [photoData, setPhotoData] = useState<Record<string, { base64: string; mime: string; name: string }>>({})
  const photoRef = useRef<HTMLInputElement>(null)
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null)

  const loadQueue = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/queue?account=${account}`)
    const data = await res.json()
    setPosts(data.posts || [])
    setLoading(false)
  }, [account])

  useEffect(() => { loadQueue() }, [loadQueue])

  function openPost(post: QueuePost) {
    setOpenId(post.id)
    setEditContent(post.content)
    setEditDate(post.scheduledDate || '')
  }

  function closePost() {
    setOpenId(null)
    setEditContent('')
    setEditDate('')
  }

  async function saveEdit(post: QueuePost) {
    setSaving(true)
    const res = await fetch(`/api/queue/${post.id}?account=${account}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent, name: post.name, scheduledDate: editDate || null }),
    })
    setSaving(false)
    if (res.ok) {
      setStatus('Saved', true)
      closePost()
      loadQueue()
    } else {
      const d = await res.json()
      setStatus('Error: ' + d.error, false)
    }
  }

  function setStatus(msg: string, ok: boolean) {
    setStatusMsg(msg)
    setStatusOk(ok)
    setTimeout(() => setStatusMsg(''), 3000)
  }

  function attachPhoto(postId: string) {
    setActivePhotoId(postId)
    photoRef.current?.click()
  }

  function removePhoto(postId: string) {
    setPhotoData(prev => {
      const next = { ...prev }
      delete next[postId]
      return next
    })
  }

  function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !activePhotoId) return
    const reader = new FileReader()
    reader.onload = ev => {
      setPhotoData(prev => ({
        ...prev,
        [activePhotoId]: {
          base64: ev.target?.result as string,
          mime: file.type,
          name: file.name,
        },
      }))
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function postNow(post: QueuePost) {
    const photo = photoData[post.id]
    setPosting(post.id)

    const body: Record<string, unknown> = {
      text: post.content,
      account,
      queueId: post.id,
    }

    // If a photo is attached, include it — /api/post uploads it to LinkedIn
    // directly and posts your text verbatim (no paid API, no rewriting).
    if (photo) {
      body.imageBase64 = photo.base64
      body.imageMime = photo.mime
    }

    const res = await fetch('/api/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setPosting(null)

    if (data.success) {
      setStatus('Posted!', true)
      removePhoto(post.id)
      loadQueue()
    } else {
      setStatus('Error: ' + data.error, false)
    }
  }

  async function deletePost(post: QueuePost) {
    if (!confirm(`Remove "${post.name}"?`)) return
    await fetch(`/api/queue/${post.id}?account=${account}`, { method: 'DELETE' })
    loadQueue()
  }

  const openPost_ = posts.find(p => p.id === openId)

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#e8e8e8]">Queue</h1>
        {statusMsg && (
          <span className={`text-sm px-3 py-1 rounded-full ${statusOk ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
            {statusMsg}
          </span>
        )}
      </div>

      {/* Account tabs */}
      <div className="flex gap-1 bg-[#111] border border-[#1e1e1e] rounded-lg p-1 w-fit">
        {(['personal', 'company'] as Account[]).map(a => (
          <button key={a} onClick={() => setAccount(a)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors capitalize ${account === a ? 'bg-[#c8a96e] text-black font-medium' : 'text-[#666] hover:text-[#ccc]'}`}>
            {a}
          </button>
        ))}
      </div>

      {/* Hidden photo input */}
      <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhotoSelected} />

      {/* ── Post list ── */}
      {loading ? (
        <p className="text-[#444] text-sm py-8 text-center">Loading...</p>
      ) : posts.length === 0 ? (
        <div className="text-center py-14 border border-dashed border-[#1e1e1e] rounded-xl">
          <p className="text-[#444] text-sm mb-3">No posts queued for {account}</p>
          <a href="/write" className="text-[#c8a96e] text-sm hover:underline">Add a post →</a>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post, idx) => {
            const photo = photoData[post.id]
            const isOpen = openId === post.id
            return (
              <div key={post.id} className={`bg-[#111] border rounded-xl overflow-hidden transition-colors ${isOpen ? 'border-[#c8a96e]/30' : 'border-[#1e1e1e]'}`}>

                {/* ── Collapsed row ── */}
                <button
                  onClick={() => isOpen ? closePost() : openPost(post)}
                  className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-xs text-[#333] font-mono w-6 shrink-0">#{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    {/* NAME — this is what they see in the list */}
                    <p className="text-sm font-medium text-[#e0e0e0] truncate">{post.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {post.scheduledDate ? (
                        <span className="text-xs text-[#c8a96e]">📅 {post.scheduledDate}</span>
                      ) : (
                        <span className="text-xs text-[#333]">Next run</span>
                      )}
                    </div>
                  </div>
                  {photo && (
                    <span className="text-xs bg-[#c8a96e]/10 text-[#c8a96e] px-2 py-0.5 rounded-full shrink-0">📷</span>
                  )}
                  <span className="text-[#333] text-xs shrink-0">{isOpen ? '▲' : '▼'}</span>
                </button>

                {/* ── Expanded panel ── */}
                {isOpen && (
                  <div className="border-t border-[#1e1e1e] p-4 space-y-4">

                    {/* Post content editor */}
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      rows={10}
                      className="w-full bg-[#0d0d0d] border border-[#222] rounded-lg px-3 py-3 text-sm text-[#ccc] leading-relaxed resize-none focus:outline-none focus:border-[#c8a96e]/40 font-mono"
                    />
                    <p className="text-right text-xs text-[#333] -mt-3">{editContent.length} chars</p>

                    {/* Schedule date */}
                    <div>
                      <label className="text-xs text-[#444] mb-1.5 block uppercase tracking-wider">
                        Schedule date <span className="normal-case">(leave blank = post at next GitHub Actions run)</span>
                      </label>
                      <input
                        type="date"
                        value={editDate}
                        onChange={e => setEditDate(e.target.value)}
                        className="bg-[#0d0d0d] border border-[#222] rounded-lg px-3 py-2 text-sm text-[#ccc] focus:outline-none focus:border-[#c8a96e]/40 w-full"
                      />
                      {editDate && (
                        <button
                          onClick={() => setEditDate('')}
                          className="text-xs text-[#444] hover:text-[#888] mt-1"
                        >
                          Clear date (post at next run instead)
                        </button>
                      )}
                    </div>

                    {/* Photo attachment */}
                    <div>
                      {photo ? (
                        <div className="flex items-center gap-3 bg-[#0d0d0d] border border-[#222] rounded-lg px-3 py-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.base64} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                          <span className="flex-1 text-xs text-[#666] truncate">{photo.name}</span>
                          <button onClick={() => removePhoto(post.id)} className="text-xs text-[#444] hover:text-red-400 shrink-0">Remove</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => attachPhoto(post.id)}
                          className="w-full py-2.5 border border-dashed border-[#2a2a2a] rounded-lg text-sm text-[#555] hover:text-[#888] hover:border-[#333] transition-colors"
                        >
                          + Attach photo (optional)
                        </button>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => saveEdit(post)}
                        disabled={saving}
                        className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-[#777] text-sm rounded-lg hover:text-[#ccc] transition-colors disabled:opacity-40"
                      >
                        {saving ? 'Saving...' : 'Save edits'}
                      </button>
                      <button
                        onClick={() => postNow(post)}
                        disabled={posting === post.id}
                        className="flex-1 py-2 bg-[#c8a96e] text-black text-sm font-medium rounded-lg hover:bg-[#d4b87a] transition-colors disabled:opacity-40"
                      >
                        {posting === post.id
                          ? (photo ? 'Uploading & posting...' : 'Posting...')
                          : (photo ? 'Post with photo' : 'Post now')}
                      </button>
                      <button
                        onClick={() => deletePost(post)}
                        className="px-3 py-2 text-[#444] hover:text-red-400 text-sm rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        Delete
                      </button>
                    </div>

                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
