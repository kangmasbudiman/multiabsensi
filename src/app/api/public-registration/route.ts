import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { encryptDescriptor } from '@/lib/face-crypto'
import { isRateLimited, getClientIp } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface LinkRow {
  id: string
  token: string
  org_id: string
  is_active: boolean
  expires_at: string | null
}

async function fetchValidLink(token: string): Promise<LinkRow | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('org_registration_links')
    .select('id, token, org_id, is_active, expires_at')
    .eq('token', token)
    .single()
  return data as LinkRow | null
}

// GET /api/public-registration?token=xxx
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Token diperlukan' }, { status: 400 })
  }

  const link = await fetchValidLink(token)

  if (!link) {
    return NextResponse.json({ valid: false, reason: 'not_found' }, { status: 404 })
  }
  if (!link.is_active) {
    return NextResponse.json({ valid: false, reason: 'revoked' }, { status: 410 })
  }
  if (link.expires_at && new Date(link.expires_at) <= new Date()) {
    return NextResponse.json({ valid: false, reason: 'expired' }, { status: 410 })
  }

  const admin = createAdminClient()
  const [orgRes, deptRes, posRes] = await Promise.all([
    admin.from('organizations').select('name, app_name').eq('id', link.org_id).single(),
    admin.from('departments').select('id, name').eq('org_id', link.org_id).order('name'),
    admin.from('positions').select('name, label').eq('org_id', link.org_id).eq('is_active', true).order('level', { ascending: false }),
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
    return NextResponse.json({ error: 'Descriptor wajah tidak valid' }, { status: 400 })
  }

  const link = await fetchValidLink(token)

  if (!link) {
    return NextResponse.json({ error: 'Link tidak ditemukan' }, { status: 404 })
  }
  if (!link.is_active) {
    return NextResponse.json({ error: 'Link sudah dinonaktifkan' }, { status: 410 })
  }
  if (link.expires_at && new Date(link.expires_at) <= new Date()) {
    return NextResponse.json({ error: 'Link kedaluwarsa' }, { status: 410 })
  }

  const admin = createAdminClient()

  // Ambil company_code untuk email synthetic
  const { data: orgRow } = await admin
    .from('organizations')
    .select('company_code')
    .eq('id', link.org_id)
    .single()

  if (!orgRow?.company_code) {
    return NextResponse.json({ error: 'Organisasi tidak valid' }, { status: 500 })
  }

  // Generate username & password unik per submit
  const rand = Math.random().toString(36).slice(2, 10)
  const placeholderUsername = `usr_${rand}`
  const placeholderPassword = Array.from({ length: 10 }, () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    return chars[Math.floor(Math.random() * chars.length)]
  }).join('')

  const email = `${placeholderUsername}_${orgRow.company_code}@absenku.app`.toLowerCase()

  // Buat akun baru via edge function (pakai anon session supaya behavior sama)
  const supabase = await createClient()
  const { data: created, error: createError } = await supabase.functions.invoke('create-employee', {
    body: {
      org_id: link.org_id,
      email,
      password: placeholderPassword,
      full_name,
      username: placeholderUsername,
      employee_id: employee_id || null,
      department_id: department_id || null,
    },
  })

  if (createError || !created?.user_id) {
    console.error('[public-registration] create-employee error:', createError, created)
    return NextResponse.json(
      { error: 'Gagal membuat akun', detail: created?.error ?? createError?.message },
      { status: 500 }
    )
  }

  const userId = created.user_id as string

  // Update field tambahan yang edge function mungkin tidak handle
  const updateFields: Record<string, unknown> = { is_active: true }
  if (division) updateFields.division = division
  if (position) updateFields.position = position
  if (phone) updateFields.phone = phone
  if (Object.keys(updateFields).length > 0) {
    await admin.from('profiles').update(updateFields).eq('id', userId)
  }

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

  // Increment use_count + update last_used_at
  await admin
    .from('org_registration_links')
    .update({
      use_count: (await getUseCount(admin, link.id)) + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', link.id)

  return NextResponse.json({
    success: true,
    username: placeholderUsername,
  })
}

async function getUseCount(admin: ReturnType<typeof createAdminClient>, linkId: string): Promise<number> {
  const { data } = await admin
    .from('org_registration_links')
    .select('use_count')
    .eq('id', linkId)
    .single()
  return data?.use_count ?? 0
}
