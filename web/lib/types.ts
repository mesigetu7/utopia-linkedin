export type Account = 'personal' | 'company'
export type PostStatus = 'draft' | 'queued' | 'posted' | 'failed'

export interface QueuePost {
  id: string           // filename without extension, e.g. "post24"
  account: Account
  name: string         // display label — never posted to LinkedIn
  scheduledDate: string | null  // "YYYY-MM-DD" or null = post at next scheduled run
  content: string      // clean post text with headers stripped
  rawContent: string   // original file content including headers
  filename: string     // full path relative to repo root
}

export interface LogPost {
  date: string
  account: Account
  pillar: string
  hook: string
  has_image: boolean
  linkedin_post_id: string
  views: number
  likes: number
  comments: number
  shares: number
}

export interface ContentLog {
  posts: LogPost[]
}

export interface PostRequest {
  text: string
  account: Account
  imageBase64?: string   // optional image as base64 data URL
  imageMime?: string     // e.g. "image/jpeg"
}

export interface PostResult {
  success: boolean
  postId?: string
  error?: string
}

export interface GenerateRequest {
  account: Account
  pillar?: string
  rawIdea?: string
}
