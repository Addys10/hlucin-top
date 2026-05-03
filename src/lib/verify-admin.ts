import { createClient } from '@supabase/supabase-js'

export async function verifyAdmin(token: string): Promise<boolean> {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user } } = await client.auth.getUser()
  if (!user) return false
  const { data } = await client.from('teams').select('is_admin').eq('auth_user_id', user.id).single()
  return data?.is_admin === true
}
