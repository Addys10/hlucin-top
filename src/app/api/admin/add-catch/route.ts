import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdmin } from '@/lib/verify-admin'

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token || !await verifyAdmin(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { team_id, fish_type, weight_g, length_mm, photo_url_1, photo_url_2 } = await req.json()
  if (!team_id || !fish_type || !weight_g || !photo_url_1 || !photo_url_2) {
    return NextResponse.json({ error: 'Chybí povinná pole.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('catches').insert({
    team_id,
    fish_type,
    weight_g,
    length_mm: length_mm ?? null,
    photo_url_1,
    photo_url_2,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
