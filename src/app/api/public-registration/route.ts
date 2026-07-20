import { createAdminClient } from '@/lib/supabase/admin'
import { encryptDescriptor } from '@/lib/face-crypto'
import { isRateLimited, getClientIp } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface TokenRow {
  id: string
  token: string
  user_id: string
  org_id: string
  expires_at: string
  used_at: string | null
}

async function fetchValidToken(admin: ReturnType<typeof createAdminClient>, token: string) {
  const { data } = await admin
    .from('employee_registration_tokens')
    .select('id, token, user_id, org_id, expires_at, used_at')
    .eq('token', token)
    .single()
  return data as TokenRow | null
}

// GET /api/public-registration?token=xxx
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Token diperlukan' }, { status: 400 })
  }

  const admin = createAdminClient()
  const tokenRow = await fetchValidToken(admin, token)

  if (!tokenRow) {
    return NextResponse.json({ valid: false, reason: 'not_found' }, { status: 404 })
  }
  if (tokenRow.used_at) {
    return NextResponse.json({ valid: false, reason: 'used' }, { status: 410 })
  }
  if (new Date(tokenRow.expires_at) <= new Date()) {
    return NextResponse.json({ valid: false, reason: 'expired' }, { status: 410 })
  }

  const [orgRes, deptRes, posRes] = await Promise.all([
    admin.from('organizations').select('name, app_name').eq('id', tokenRow.org_id).single(),
    admin.from('departments').select('id, name').eq('org_id', tokenRow.org_id).order('name'),
    admin.from('positions').select('name, label').eq('org_id', tokenRow.org_id).eq('is_active', true).order('level', { ascending: false }),
  ])

  return NextResponse.json({
    valid: true,
    org_name: orgRes.data?.app_name || orgRes.data?.name || 'AbsenKu',
    departments: deptRes.data ?? [],
    positions: posRes.data ?? [],
    divisions: [
      { name: 'umum', label: 'Bagian Umum' },
      { name: 'penunjang', label: 'Bagian Penunjang' },
      { name: 'keperawatan', label: 'Bagian Keperawatan' },
      { name: 'medis', label: 'Bagian Medis' },
    ],
    expires_at: tokenRow.expires_at,
  })
}

// POST /api/public-registration
export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req)
  if (isRateLimited(`reg-submit:${clientIp}`, 10, 5 * 60_000)) {
    return NextResponse.json(
      { error: 'Terlalu banyak permintaan. Tunggu beberapa menit.' },
      { status: 429 }
    )
  }

  const body = await req.json()
  const {
    token,
    full_name,
    employee_id,
    department_id,
    division,
    position,
    phone,
    photo_base64,
    descriptor,
    geometry,
  } = body as {
    token?: string
    full_name?: string
    employee_id?: string
    department_id?: string
    division?: string
    position?: string
    phone?: string
    photo_base64?: string
    descriptor?: number[]
    geometry?: unknown
  }

  if (!token || !full_name || !photo_base64 || !descriptor) {
    return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
  }

  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    return NextResponse.json(
      { error: 'Descriptor wajah tidak valid' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const tokenRow = await fetchValidToken(admin, token)

  if (!tokenRow) {
    return NextResponse.json({ error: 'Token tidak ditemukan' }, { status: 404 })
  }
  if (tokenRow.used_at) {
    return NextResponse.json({ error: 'Token sudah dipakai' }, { status: 410 })
  }
  if (new Date(tokenRow.expires_at) <= new Date()) {
    return NextResponse.json({ error: 'Token kedaluwarsa' }, { status: 410 })
  }

  const userId = tokenRow.user_id

  // Upload foto ke storage
  const photoBytes = Buffer.from(photo_base64, 'base64')
  const photoPath = `${userId}/registered_${Date.now()}.jpg`

  const { error: uploadError } = await admin.storage
    .from('attendance-photos')
    .upload(photoPath, photoBytes, { contentType: 'image/jpeg', upsert: true })

  if (uploadError) {
    console.error('[public-registration] upload error:', uploadError)
    return NextResponse.json({ error: 'Gagal upload foto wajah' }, { status: 500 })
  }

  const photoUrl = `storage://attendance-photos/${photoPath}`

  // Encrypt descriptor
  let encryptedDescriptor: string
  try {
    encryptedDescriptor = encryptDescriptor(descriptor)
  } catch (e) {
    console.error('[public-registration] encrypt error:', e)
    return NextResponse.json({ error: 'Gagal enkripsi data wajah' }, { status: 500 })
  }

  // Update profile
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .update({
      full_name,
      employee_id: employee_id || null,
      department_id: department_id || null,
      division: division || null,
      position: position || null,
      phone: phone || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('username')
    .single()

  if (profileErr) {
    console.error('[public-registration] profile update error:', profileErr)
    return NextResponse.json({ error: 'Gagal menyimpan data karyawan' }, { status: 500 })
  }

  // Upsert face registration
  const upsertData: Record<string, unknown> = {
    user_id: userId,
    face_descriptor_encrypted: encryptedDescriptor,
    face_photo_url: photoUrl,
    updated_at: new Date().toISOString(),
  }
  if (geometry) {
    upsertData.face_data = geometry
  }

  const { error: faceErr } = await admin
    .from('face_registrations')
    .upsert(upsertData, { onConflict: 'user_id' })

  if (faceErr) {
    console.error('[public-registration] face upsert error:', faceErr)
    return NextResponse.json({ error: 'Gagal menyimpan data wajah' }, { status: 500 })
  }

  // Revoke token
  await admin
    .from('employee_registration_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenRow.id)

  return NextResponse.json({
    success: true,
    username: profile.username,
  })
}
