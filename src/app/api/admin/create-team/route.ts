import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyAdmin } from '@/lib/verify-admin'

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token || !await verifyAdmin(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, username, password } = await req.json()
  if (!name || !username || !password) {
    return NextResponse.json({ error: 'Chybí povinná pole.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const email = `${username.trim().toLowerCase()}@hlucin.local`

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  const { error: teamError } = await admin.from('teams').insert({
    name: name.trim(),
    auth_user_id: authData.user.id,
    is_admin: false,
  })

  if (teamError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: teamError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
