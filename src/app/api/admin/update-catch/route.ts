import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdmin } from '@/lib/verify-admin'

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token || !await verifyAdmin(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { catchId, fish_type, weight_g, photo_url_1, photo_url_2, photo_url_3 } = await req.json()
  if (!catchId || !fish_type || !weight_g) {
    return NextResponse.json({ error: 'Chybí povinná pole.' }, { status: 400 })
  }

  const update: Record<string, unknown> = { fish_type, weight_g }
  if (photo_url_1) update.photo_url_1 = photo_url_1
  if (photo_url_2) update.photo_url_2 = photo_url_2
  if (photo_url_3) update.photo_url_3 = photo_url_3

  const admin = createAdminClient()
  const { error } = await admin.from('catches').update(update).eq('id', catchId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
