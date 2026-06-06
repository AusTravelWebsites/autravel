import { NextRequest, NextResponse } from 'next/server'

// autravel short-circuit: this endpoint was part of bugbitten's community
// "blog_posts" feature which joined user_locations + trips + blog_posts — none
// of which exist in the autravel schema. Returning an empty list keeps the
// BlogRelevantSidebar component silently falling back to its empty state
// without spamming the error log.
export async function GET(_req: NextRequest) {
  return NextResponse.json({ posts: [] })
}
