import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isRateLimited, getClientIp } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import QRCode from 'qrcode'

export const dynamic = 'force-dynamic'

// POST /api/registration-tokens
// Admin membuat undangan pendaftaran mandiri (placeholder user + token + QR)
export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req)
  if (isRateLimited(`reg-token:${clientIp}`, 20, 60_000)) {
    return NextResponse.json(
      { error: 'Terlalu banyak permintaan. Tunggu beberapa saat.' },
      { status: 429 }
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: adminProfile } = await admin
    .from('profiles')
    .select('id, org_id, role')
    .eq('id', user.id)
    .single()

  if (!adminProfile || !['admin', 'super_admin'].includes(adminProfile.role)) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const orgId = body.org_id ?? adminProfile.org_id

  if (!orgId) {
    return NextResponse.json({ error: 'org_id diperlukan' }, { status: 400 })
  }

  // Ambil company_code untuk email synthetic
  const { data: orgRow } = await admin
    .from('organizations')
    .select('company_code, base_url')
    .eq('id', orgId)
    .single()

  if (!orgRow?.company_code) {
    return NextResponse.json({ error: 'Organisasi tidak valid' }, { status: 404 })
  }

  // Generate username & password placeholder
  const rand = Math.random().toString(36).slice(2, 10)
  const placeholderUsername = `usr_${rand}`
  const placeholderPassword = Array.from({ length: 10 }, () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    return chars[Math.floor(Math.random() * chars.length)]
  }).join('')

  const email = `${placeholderUsername}_${orgRow.company_code}@absenku.app`.toLowerCase()

  // Buat akun via edge function (pola: lihat EmployeesClient.handleSave)
  const { data: created, error: createError } = await supabase.functions.invoke('create-employee', {
    body: {
      org_id: orgId,
      email,
      password: placeholderPassword,
      full_name: 'Pendaftar Baru',
      username: placeholderUsername,
      employee_id: null,
      department_id: null,
    },
  })

  if (createError || !created?.user_id) {
    console.error('[registration-tokens] create-employee error:', createError, created)
    return NextResponse.json(
      { error: 'Gagal membuat akun placeholder', detail: created?.error ?? createError?.message },
      { status: 500 }
    )
  }

  const newUserId = created.user_id as string

  // Set is_active = false sampai karyawan menyelesaikan registrasi
  await admin.from('profiles').update({ is_active: false }).eq('id', newUserId)

  // Buat token
  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 hari

  const { error: tokenError } = await admin
    .from('employee_registration_tokens')
    .insert({
      token,
      user_id: newUserId,
      org_id: orgId,
      created_by: adminProfile.id,
      expires_at: expiresAt.toISOString(),
    })

  if (tokenError) {
    console.error('[registration-tokens] token insert error:', tokenError)
    return NextResponse.json({ error: 'Gagal membuat token' }, { status: 500 })
  }

  // Build URL + QR
  const orgBaseUrl = orgRow.base_url?.trim().replace(/\/+$/, '')
  const baseUrl =
    orgBaseUrl ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null) ??
    'http://localhost:3000'

  const registrationUrl = `${baseUrl}/register/${token}`
  const qrDataUrl = await QRCode.toDataURL(registrationUrl, {
    width: 256,
    margin: 2,
    color: { dark: '#0f172a', light: '#ffffff' },
  })

  return NextResponse.json({
    success: true,
    token,
    qr_data_url: qrDataUrl,
    registration_url: registrationUrl,
    expires_at: expiresAt.toISOString(),
    placeholder_username: placeholderUsername,
    placeholder_password: placeholderPassword,
  })
}
