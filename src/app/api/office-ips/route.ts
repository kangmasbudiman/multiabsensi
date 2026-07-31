import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/office-ips — list IP whitelist org caller
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, org_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 })
  }

  const { data: ips, error } = await admin
    .from('office_ip_whitelist')
    .select('id, ip_address, label, created_at')
    .eq('org_id', profile.org_id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ips: ips ?? [] })
}

// POST /api/office-ips { action, ip_address?, label?, ip_id? }
// Action: 'create' | 'delete'
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: caller } = await admin
    .from('profiles')
    .select('id, org_id, role')
    .eq('id', user.id)
    .single()

  if (!caller || !['admin', 'super_admin', 'hrd'].includes(caller.role)) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }

  const body = await req.json()
  const { action, ip_address, label, ip_id } = body as {
    action: 'create' | 'delete'
    ip_address?: string
    label?: string
    ip_id?: string
  }

  if (action === 'create') {
    if (!ip_address) {
      return NextResponse.json({ error: 'ip_address diperlukan' }, { status: 400 })
    }
    // Validate IPv4 format
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
    const match = ip_address.match(ipv4Regex)
    if (!match || match.slice(1).some(o => Number(o) > 255)) {
      return NextResponse.json({ error: 'Format IP tidak valid (harus IPv4, contoh: 202.43.123.45)' }, { status: 400 })
    }

    const { data: created, error } = await admin
      .from('office_ip_whitelist')
      .insert({
        org_id: caller.org_id,
        ip_address: ip_address.trim(),
        label: label?.trim() || null,
        created_by: caller.id,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'IP sudah ada di whitelist' }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, ip: created })
  }

  if (action === 'delete') {
    if (!ip_id) {
      return NextResponse.json({ error: 'ip_id diperlukan' }, { status: 400 })
    }
    const { error } = await admin
      .from('office_ip_whitelist')
      .delete()
      .eq('id', ip_id)
      .eq('org_id', caller.org_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Aksi tidak dikenal' }, { status: 400 })
}
