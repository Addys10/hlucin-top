import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdmin } from '@/lib/verify-admin'

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token || !await verifyAdmin(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { teamId, member1, member2 } = await req.json()
  if (!teamId) {
    return NextResponse.json({ error: 'Chybí ID týmu.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('teams')
    .update({ member1: member1?.trim() || null, member2: member2?.trim() || null })
    .eq('id', teamId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
