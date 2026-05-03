import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdmin } from '@/lib/verify-admin'

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token || !await verifyAdmin(token)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { teamId } = await req.json()
  if (!teamId) return NextResponse.json({ error: 'Chybí teamId.' }, { status: 400 })

  const admin = createAdminClient()

  const { data: team } = await admin.from('teams').select('auth_user_id, is_admin').eq('id', teamId).single()
  if (!team) return NextResponse.json({ error: 'Tým nenalezen.' }, { status: 404 })
  if (team.is_admin) return NextResponse.json({ error: 'Nelze smazat admin účet.' }, { status: 403 })

  try {
    await admin.from('catches').delete().eq('team_id', teamId)
    await admin.from('teams').delete().eq('id', teamId)
    if (team.auth_user_id) {
      await admin.auth.admin.deleteUser(team.auth_user_id)
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Neznámá chyba'
    return NextResponse.json({ error: `Chyba při mazání: ${msg}` }, { status: 500 })
  }
}
