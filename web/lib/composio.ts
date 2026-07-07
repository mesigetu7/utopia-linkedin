/**
 * DEPRECATED — Composio has been removed.
 *
 * Posting now goes directly through the LinkedIn API in ./linkedin.ts using
 * LINKEDIN_PERSONAL_TOKEN. This file is kept only as a compatibility shim so
 * any lingering imports of '@/lib/composio' keep working. Prefer '@/lib/linkedin'.
 */

export { postToLinkedIn, checkLinkedInConnection } from './linkedin'
