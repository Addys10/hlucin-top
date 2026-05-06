import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdmin } from '@/lib/verify-admin'

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token || !await verifyAdmin(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { teamId, action } = await req.json()
  if (!teamId || !['add', 'remove'].includes(action)) {
    return NextResponse.json({ error: 'Chybí teamId nebo akce.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: team, error: fetchError } = await admin
    .from('teams')
    .select('yellow_cards')
    .eq('id', teamId)
    .single()

  if (fetchError || !team) return NextResponse.json({ error: 'Tým nenalezen.' }, { status: 404 })

  const current = team.yellow_cards ?? 0
  const next = action === 'add' ? Math.min(current + 1, 2) : Math.max(current - 1, 0)

  const { error } = await admin.from('teams').update({ yellow_cards: next }).eq('id', teamId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ yellow_cards: next })
}
