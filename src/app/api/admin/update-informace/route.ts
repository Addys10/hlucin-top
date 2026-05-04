import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdmin } from '@/lib/verify-admin'

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token || !await verifyAdmin(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { content } = await req.json()
  if (!content || typeof content !== 'object') {
    return NextResponse.json({ error: 'Chybí obsah.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('page_content')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('page', 'informace')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
