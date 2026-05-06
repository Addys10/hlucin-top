import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdmin } from '@/lib/verify-admin'

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token || !await verifyAdmin(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { catchId, status } = await req.json()
  if (!catchId || !['approved', 'rejected', 'pending'].includes(status)) {
    return NextResponse.json({ error: 'Chybí catchId nebo neplatný status.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('catches').update({ status }).eq('id', catchId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
