/**
 * GitHub API helpers for reading and writing queue files and content_log.json.
 * Queue files live in the utopia-linkedin repo alongside the Python scripts.
 */

import { Octokit } from '@octokit/rest'
import type { Account, QueuePost, ContentLog } from './types'

const OWNER = 'mesigetu7'
const REPO = 'utopia-linkedin'

function getOctokit() {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN is not set')
  return new Octokit({ auth: token })
}

function decodeContent(base64: string): string {
  return Buffer.from(base64.replace(/\n/g, ''), 'base64').toString('utf-8')
}

function encodeContent(text: string): string {
  return Buffer.from(text, 'utf-8').toString('base64')
}

/**
 * Queue file format — all header lines are optional and never posted to LinkedIn:
 *
 *   [NAME: Stair detail — luxury villa]
 *   [DATE: 2026-07-10]
 *
 *   The actual LinkedIn post content starts here...
 */
export function parseQueueFile(raw: string): {
  name: string
  scheduledDate: string | null
  content: string
} {
  let rest = raw
  let name = ''
  let scheduledDate: string | null = null

  // Strip [NAME: ...] header
  const nameMatch = rest.match(/^\[NAME:\s*(.+?)\]\s*\n/)
  if (nameMatch) {
    name = nameMatch[1].trim()
    rest = rest.slice(nameMatch[0].length)
  }

  // Strip [DATE: ...] header
  const dateMatch = rest.match(/^\[DATE:\s*(\d{4}-\d{2}-\d{2})\]\s*\n/)
  if (dateMatch) {
    scheduledDate = dateMatch[1].trim()
    rest = rest.slice(dateMatch[0].length)
  }

  const content = rest.trim()

  if (!name) {
    const firstLine = content.split('\n')[0] || ''
    name = firstLine.slice(0, 55) + (firstLine.length > 55 ? '…' : '')
  }

  return { name, scheduledDate, content }
}

/**
 * Build the raw file content with optional headers.
 */
export function buildQueueFile(name: string, content: string, scheduledDate?: string): string {
  const headers: string[] = []
  if (name.trim()) headers.push(`[NAME: ${name.trim()}]`)
  if (scheduledDate?.trim()) headers.push(`[DATE: ${scheduledDate.trim()}]`)
  if (headers.length > 0) {
    return headers.join('\n') + '\n\n' + content.trim() + '\n'
  }
  return content.trim() + '\n'
}

// ─── Queue ────────────────────────────────────────────────────────────────────

/**
 * List all queued posts for an account.
 * Reads .txt files from queue/{account}/ (excludes /posted/ subfolder).
 */
export async function listQueue(account: Account): Promise<QueuePost[]> {
  const octokit = getOctokit()
  const path = `queue/${account}`

  try {
    const { data } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path })
    if (!Array.isArray(data)) return []

    const posts: QueuePost[] = []
    for (const item of data) {
      if (item.type !== 'file' || !item.name.endsWith('.txt')) continue

      const fileResp = await octokit.repos.getContent({
        owner: OWNER, repo: REPO, path: item.path
      })
      const fileData = fileResp.data as { content?: string; sha: string }
      const raw = fileData.content ? decodeContent(fileData.content) : ''
      const { name, scheduledDate, content } = parseQueueFile(raw)

      posts.push({
        id: item.name.replace('.txt', ''),
        account,
        name,
        scheduledDate,
        content,
        rawContent: raw,
        filename: item.path,
      })
    }

    // Sort numerically by post number
    posts.sort((a, b) => {
      const na = parseInt(a.id.replace(/\D/g, '')) || 0
      const nb = parseInt(b.id.replace(/\D/g, '')) || 0
      return na - nb
    })

    return posts
  } catch {
    return []
  }
}

/**
 * Get a single queue post by id (e.g. "post24").
 */
export async function getQueuePost(account: Account, id: string): Promise<QueuePost | null> {
  const octokit = getOctokit()
  const path = `queue/${account}/${id}.txt`
  try {
    const { data } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path })
    const file = data as { content?: string; sha: string; name: string }
    const raw = file.content ? decodeContent(file.content) : ''
    const { name, scheduledDate, content } = parseQueueFile(raw)
    return { id, account, name, scheduledDate, content, rawContent: raw, filename: path }
  } catch {
    return null
  }
}

/**
 * Save (create or update) a queue post.
 * Pass sha for updates, omit for new files.
 */
export async function saveQueuePost(
  account: Account,
  id: string,
  content: string,
  existingSha?: string
): Promise<void> {
  const octokit = getOctokit()
  const path = `queue/${account}/${id}.txt`

  await octokit.repos.createOrUpdateFileContents({
    owner: OWNER,
    repo: REPO,
    path,
    message: existingSha ? `Edit queue post: ${id}` : `Add queue post: ${id}`,
    content: encodeContent(content),
    ...(existingSha ? { sha: existingSha } : {}),
  })
}

/**
 * Delete a queue post by moving it to the posted folder.
 * (Hard delete not used — file moves happen via Python post.py scripts)
 * For the web app, we just delete the file outright.
 */
export async function deleteQueuePost(account: Account, id: string): Promise<void> {
  const octokit = getOctokit()
  const path = `queue/${account}/${id}.txt`

  const { data } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path })
  const file = data as { sha: string }

  await octokit.repos.deleteFile({
    owner: OWNER,
    repo: REPO,
    path,
    message: `Remove posted queue file: ${id}`,
    sha: file.sha,
  })
}

/**
 * Get the next available post filename for an account.
 * e.g. if post24.txt is the highest, returns "post25"
 */
export async function nextPostId(account: Account): Promise<string> {
  const posts = await listQueue(account)
  if (posts.length === 0) {
    // Also check posted/ folder for highest number
    const octokit = getOctokit()
    try {
      const { data } = await octokit.repos.getContent({
        owner: OWNER, repo: REPO, path: `queue/${account}/posted`
      })
      if (Array.isArray(data)) {
        const nums = data
          .filter(f => f.name.endsWith('.txt'))
          .map(f => parseInt(f.name.replace(/\D/g, '')) || 0)
        const max = Math.max(0, ...nums)
        return `post${String(max + 1).padStart(2, '0')}`
      }
    } catch { /* posted/ folder may not exist */ }
    return 'post01'
  }
  const nums = posts.map(p => parseInt(p.id.replace(/\D/g, '')) || 0)
  const max = Math.max(...nums)
  return `post${String(max + 1).padStart(2, '0')}`
}

// ─── Content Log ──────────────────────────────────────────────────────────────

/**
 * Read content_log.json from the repo.
 */
export async function getContentLog(): Promise<ContentLog> {
  const octokit = getOctokit()
  try {
    const { data } = await octokit.repos.getContent({
      owner: OWNER, repo: REPO, path: 'content_log.json'
    })
    const file = data as { content?: string }
    const raw = file.content ? decodeContent(file.content) : '{"posts":[]}'
    return JSON.parse(raw) as ContentLog
  } catch {
    return { posts: [] }
  }
}
