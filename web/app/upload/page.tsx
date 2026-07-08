'use client'

import { useState, useRef, useCallback } from 'react'
import type { Account } from '@/lib/types'

type Stage = 'drop' | 'preview' | 'caption' | 'done'

export default function UploadPage() {
  const [stage, setStage] = useState<Stage>('drop')
  const [account, setAccount] = useState<Account>('personal')
  const [imageBase64, setImageBase64] = useState('')
  const [imageMime, setImageMime] = useState('')
  const [imageName, setImageName] = useState('')
  const [captionIdea, setCaptionIdea] = useState('')
  const [caption, setCaption] = useState('')
  const [generating, setGenerating] = useState(false)
  const [posting, setPosting] = useState(false)
  const [postId, setPostId] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please drop an image file (JPG, PNG, or WEBP)')
      return
    }
    setError('')
    setImageMime(file.type)
    setImageName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      setImageBase64(e.target?.result as string)
      setStage('preview')
    }
    reader.readAsDataURL(file)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  async function generateCaption() {
    setGenerating(true)
    setError('')
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, imageMime, account, captionIdea, postNow: false }),
    })
    const data = await res.json()
    setGenerating(false)
    if (data.caption) {
      setCaption(data.caption)
      setStage('caption')
    } else {
      setError(data.error || 'Generation failed')
    }
  }

  async function postNow() {
    setPosting(true)
    setError('')
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, imageMime, account, captionIdea, postNow: true }),
    })
    const data = await res.json()
    setPosting(false)
    if (data.success) {
      setPostId(data.postId)
      setStage('done')
    } else {
      setError(data.error || 'Post failed')
    }
  }

  function reset() {
    setStage('drop')
    setImageBase64('')
    setImageMime('')
    setImageName('')
    setCaptionIdea('')
    setCaption('')
    setPostId('')
    setError('')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-[#e8e8e8]">Upload</h1>
        <p className="text-[#555] text-sm mt-1">
          Drop a photo — Claude writes the caption in the founder's voice, image goes straight to LinkedIn.
        </p>
      </div>

      {/* Account selector */}
      <div className="flex gap-2">
        {(['personal', 'company'] as Account[]).map(a => (
          <button
            key={a}
            onClick={() => setAccount(a)}
            className={`px-4 py-2 text-sm rounded-lg border transition-colors capitalize ${
              account === a
                ? 'border-[#c8a96e] text-[#c8a96e] bg-[#c8a96e]/5'
                : 'border-[#222] text-[#666] hover:border-[#333] hover:text-[#999]'
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* ── STAGE: drop ── */}
      {stage === 'drop' && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-[#c8a96e] bg-[#c8a96e]/5'
              : 'border-[#222] hover:border-[#333] hover:bg-white/[0.02]'
          }`}
        >
          <div className="text-4xl mb-4">📷</div>
          <p className="text-[#ccc] text-sm font-medium">Tap to take a photo</p>
          <p className="text-[#444] text-xs mt-1">or choose from camera roll</p>
          <p className="text-[#333] text-xs mt-3 hidden md:block">On desktop: drop a file here</p>
          {/* No capture attribute — lets mobile show Photo Library, Take Photo,
              and Choose File instead of forcing the camera. */}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
          />
        </div>
      )}

      {/* ── STAGE: preview (image loaded, add idea, generate caption) ── */}
      {(stage === 'preview' || stage === 'caption') && imageBase64 && (
        <div className="space-y-4">
          {/* Image preview */}
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageBase64}
              alt="Preview"
              className="w-full rounded-xl max-h-[400px] object-cover border border-[#1e1e1e]"
            />
            <button
              onClick={reset}
              className="absolute top-3 right-3 w-7 h-7 bg-black/60 hover:bg-black/80 text-white text-xs rounded-full flex items-center justify-center transition-colors"
            >
              ✕
            </button>
            <div className="absolute bottom-3 left-3">
              <span className="text-xs bg-black/60 text-[#888] px-2 py-1 rounded">{imageName}</span>
            </div>
          </div>

          {/* Caption idea input */}
          {stage === 'preview' && (
            <>
              <div>
                <label className="text-xs text-[#666] mb-2 block uppercase tracking-wider">
                  Your idea for the caption <span className="normal-case">(optional)</span>
                </label>
                <textarea
                  value={captionIdea}
                  onChange={e => setCaptionIdea(e.target.value)}
                  rows={3}
                  placeholder="e.g. This is fresh out of the mold — first look at the stair detail..."
                  className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-sm text-[#ccc] placeholder-[#444] resize-none focus:outline-none focus:border-[#c8a96e]/50"
                />
              </div>
              <button
                onClick={generateCaption}
                disabled={generating}
                className="w-full py-3 bg-[#c8a96e] text-black text-sm font-medium rounded-lg hover:bg-[#d4b87a] transition-colors disabled:opacity-50"
              >
                {generating ? 'Claude is writing the caption...' : 'Generate caption'}
              </button>
            </>
          )}

          {/* Caption editor */}
          {stage === 'caption' && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-[#666] uppercase tracking-wider">Caption</label>
                  <button
                    onClick={generateCaption}
                    disabled={generating}
                    className="text-xs text-[#c8a96e] hover:underline disabled:opacity-50"
                  >
                    {generating ? 'Rewriting...' : 'Regenerate'}
                  </button>
                </div>
                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  rows={12}
                  className="w-full bg-[#111] border border-[#1e1e1e] rounded-lg px-4 py-3 text-sm text-[#ccc] leading-relaxed resize-none focus:outline-none focus:border-[#c8a96e]/50"
                />
                <p className="text-right text-xs text-[#333] mt-1">{caption.length} characters</p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={reset}
                  className="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] text-[#666] text-sm rounded-lg hover:text-[#ccc] transition-colors"
                >
                  Start over
                </button>
                <button
                  onClick={postNow}
                  disabled={posting || !caption.trim()}
                  className="flex-1 py-2.5 bg-[#c8a96e] text-black text-sm font-medium rounded-lg hover:bg-[#d4b87a] transition-colors disabled:opacity-50"
                >
                  {posting ? 'Uploading image & posting...' : 'Post to LinkedIn'}
                </button>
              </div>

              <p className="text-xs text-[#333] text-center">
                Image uploads to LinkedIn via asset API → caption attaches → post goes live.
              </p>
            </>
          )}
        </div>
      )}

      {/* ── STAGE: done ── */}
      {stage === 'done' && (
        <div className="text-center py-12 space-y-4">
          <div className="text-5xl">✓</div>
          <p className="text-lg font-medium text-[#e8e8e8]">Posted</p>
          <p className="text-sm text-[#555]">Image and caption are live on LinkedIn</p>
          {postId && (
            <p className="text-xs text-[#333] font-mono">{postId}</p>
          )}
          <button
            onClick={reset}
            className="mt-4 px-6 py-2.5 bg-[#c8a96e] text-black text-sm font-medium rounded-lg hover:bg-[#d4b87a] transition-colors"
          >
            Post another photo
          </button>
        </div>
      )}
    </div>
  )
}
