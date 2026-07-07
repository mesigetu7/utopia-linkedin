'use client'

import { useState } from 'react'
import type { Account } from '@/lib/types'

export default function WritePage() {
  const [account, setAccount] = useState<Account>('personal')
  const [name, setName] = useState('')
  const [postText, setPostText] = useState('')
  const [saving, setSaving] = useState(false)
  const [posting, setPosting] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  async function saveToQueue() {
    if (!postText.trim()) return
    setSaving(true)
    const res = await fetch('/api/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account, content: postText, name }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.success) {
      setStatusMsg(`Saved as ${data.id}`)
      setPostText('')
      setName('')
      setTimeout(() => setStatusMsg(''), 3000)
    } else {
      setStatusMsg('Error: ' + data.error)
    }
  }

  async function postNow() {
    if (!postText.trim()) return
    if (!confirm('Post this to LinkedIn now?')) return
    setPosting(true)
    const res = await fetch('/api/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: postText, account }),
    })
    const data = await res.json()
    setPosting(false)
    if (data.success) {
      setStatusMsg('Posted!')
      setPostText('')
    } else {
      setStatusMsg('Error: ' + data.error)
    }
    setTimeout(() => setStatusMsg(''), 4000)
  }

  return (
    <div className="space-y-5 max-w-2xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#e8e8e8]">Write</h1>
        {statusMsg && (
          <span className={`text-sm px-3 py-1 rounded-full ${
            statusMsg.startsWith('Error')
              ? 'bg-red-500/10 text-red-400'
              : 'bg-green-500/10 text-green-400'
          }`}>
            {statusMsg}
          </span>
        )}
      </div>

      {/* How-to hint */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg px-4 py-3 text-sm text-[#555] leading-relaxed">
        Write your post in <span className="text-[#c8a96e]">Cowork</span>, paste it here, give it a name so you can find it in the queue, then save or post.
      </div>

      {/* Account */}
      <div>
        <label className="text-xs text-[#555] mb-2 block uppercase tracking-wider">Account</label>
        <div className="flex gap-2">
          {(['personal', 'company'] as Account[]).map(a => (
            <button
              key={a}
              onClick={() => setAccount(a)}
              className={`flex-1 py-2 text-sm rounded-lg border transition-colors capitalize ${
                account === a
                  ? 'border-[#c8a96e] text-[#c8a96e] bg-[#c8a96e]/5'
                  : 'border-[#222] text-[#555] hover:border-[#333] hover:text-[#999]'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="text-xs text-[#555] mb-2 block uppercase tracking-wider">
          Name <span className="normal-case">(your label — never posted to LinkedIn)</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Stair detail — luxury villa"
          className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-[#ccc] placeholder-[#333] focus:outline-none focus:border-[#c8a96e]/40"
        />
      </div>

      {/* Editor */}
      <div>
        <textarea
          value={postText}
          onChange={e => setPostText(e.target.value)}
          rows={14}
          placeholder="Paste your post here..."
          className="w-full bg-[#111] border border-[#1e1e1e] rounded-lg px-4 py-3 text-sm text-[#ccc] leading-relaxed placeholder-[#333] resize-none focus:outline-none focus:border-[#c8a96e]/40"
        />
        <p className="text-right text-xs text-[#333] mt-1">{postText.length} chars</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={saveToQueue}
          disabled={saving || !postText.trim()}
          className="flex-1 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] text-sm rounded-lg hover:text-[#ccc] hover:border-[#3a3a3a] transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Save to queue'}
        </button>
        <button
          onClick={postNow}
          disabled={posting || !postText.trim()}
          className="flex-1 py-2.5 bg-[#c8a96e] text-black text-sm font-medium rounded-lg hover:bg-[#d4b87a] transition-colors disabled:opacity-40"
        >
          {posting ? 'Posting...' : 'Post now'}
        </button>
      </div>

    </div>
  )
}
