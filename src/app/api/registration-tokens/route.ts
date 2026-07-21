import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isRateLimited, getClientIp } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import QRCode from 'qrcode'

export const dynamic = 'force-dynamic'

// POST /api/registration-tokens
// Admin: get-or-create link pendaftaran umum per-org.
// - Kalau org sudah punya link aktif → return existing
// - Kalau belum → buat baru (tanpa expiry)
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
  const forceRotate = body.rotate === true

  if (!orgId) {
    return NextResponse.json({ error: 'org_id diperlukan' }, { status: 400 })
  }

  const { data: orgRow } = await admin
    .from('organizations')
    .select('company_code, base_url, name, app_name')
    .eq('id', orgId)
    .single()

  if (!orgRow) {
    return NextResponse.json({ error: 'Organisasi tidak ditemukan' }, { status: 404 })
  }

  // Cek link aktif yang sudah ada (kecuali force rotate)
  if (!forceRotate) {
    const { data: existing } = await admin
      .from('org_registration_links')
      .select('token, is_active, expires_at, created_at, last_used_at, use_count')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      // Cek expired
      const isExpired = existing.expires_at && new Date(existing.expires_at) <= new Date()
      if (!isExpired) {
        return NextResponse.json(await buildResponse(admin, existing.token, orgRow, existing.use_count ?? 0, existing.last_used_at, existing.expires_at))
      }
    }
  }

  // Buat link baru
  if (forceRotate) {
    await admin
      .from('org_registration_links')
      .update({ is_active: false })
      .eq('org_id', orgId)
      .eq('is_active', true)
  }

  const token = randomUUID()

  const { error: insertError } = await admin
    .from('org_registration_links')
    .insert({
      token,
      org_id: orgId,
      created_by: adminProfile.id,
      is_active: true,
      expires_at: null,
    })

  if (insertError) {
    console.error('[registration-tokens] insert error:', insertError)
    return NextResponse.json({ error: 'Gagal membuat link' }, { status: 500 })
  }

  return NextResponse.json(await buildResponse(admin, token, orgRow, 0, null, null))
}

async function buildResponse(
  admin: ReturnType<typeof createAdminClient>,
  token: string,
  org: { company_code: string; base_url: string | null; name: string; app_name: string | null },
  useCount: number,
  lastUsedAt: string | null,
  expiresAt: string | null
) {
  const orgBaseUrl = org.base_url?.trim().replace(/\/+$/, '')
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

  return {
    success: true,
    token,
    qr_data_url: qrDataUrl,
    registration_url: registrationUrl,
    expires_at: expiresAt,
    use_count: useCount,
    last_used_at: lastUsedAt,
    org_name: org.app_name || org.name,
  }
}
