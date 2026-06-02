import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { encryptDescriptor, encryptFaceData } from '@/lib/face-crypto'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST /api/register-face — Admin registers employee face from dashboard
export async function POST(req: NextRequest) {
  try {
    // 1. Validate admin auth
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[register-face] Auth error:', authError?.message)
      return NextResponse.json({ error: 'Tidak terautentikasi', detail: authError?.message }, { status: 401 })
    }

    // Check admin role
    const { data: adminProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, org_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !adminProfile) {
      console.error('[register-face] Profile error:', profileError?.message)
      return NextResponse.json({ error: 'Profil tidak ditemukan', detail: profileError?.message }, { status: 403 })
    }

    if (!['admin', 'super_admin'].includes(adminProfile.role)) {
      console.error('[register-face] Role not allowed:', adminProfile.role)
      return NextResponse.json({ error: 'Akses ditolak', detail: `Role: ${adminProfile.role}` }, { status: 403 })
    }

    // 2. Parse request
    const body = await req.json()
    const { user_id, photo_base64, descriptor, geometry } = body as {
      user_id?: string
      photo_base64?: string
      descriptor?: number[]
      geometry?: unknown
    }

    if (!user_id || !photo_base64 || !descriptor) {
      console.error('[register-face] Missing data:', { has_user_id: !!user_id, has_photo: !!photo_base64, has_descriptor: !!descriptor })
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
    }

    // Validate descriptor is 128 floats
    if (!Array.isArray(descriptor) || descriptor.length !== 128) {
      console.error('[register-face] Invalid descriptor length:', descriptor?.length)
      return NextResponse.json({ error: 'Descriptor tidak valid', detail: `Length: ${descriptor?.length}` }, { status: 400 })
    }

    // 3. Validate employee belongs to admin's org
    const admin = createAdminClient()

    const { data: empProfile, error: empError } = await admin
      .from('profiles')
      .select('id, org_id, is_active')
      .eq('id', user_id)
      .single()

    if (empError || !empProfile) {
      console.error('[register-face] Employee not found:', empError?.message)
      return NextResponse.json({ error: 'Karyawan tidak ditemukan', detail: empError?.message }, { status: 404 })
    }

    if (empProfile.org_id !== adminProfile.org_id || !empProfile.is_active) {
      console.error('[register-face] Employee org mismatch or inactive:', { empOrg: empProfile.org_id, adminOrg: adminProfile.org_id, active: empProfile.is_active })
      return NextResponse.json({ error: 'Karyawan tidak valid' }, { status: 404 })
    }

    // 4. Upload face photo to storage
    const photoBytes = Buffer.from(photo_base64, 'base64')
    const photoPath = `${user_id}/registered_${Date.now()}.jpg`

    console.log('[register-face] Uploading photo, size:', photoBytes.length, 'bytes, path:', photoPath)

    const { error: uploadError } = await admin.storage
      .from('attendance-photos')
      .upload(photoPath, photoBytes, { contentType: 'image/jpeg', upsert: true })

    if (uploadError) {
      console.error('[register-face] Upload error:', uploadError.message, uploadError.name)
      return NextResponse.json({ error: 'Gagal upload foto wajah', detail: uploadError.message }, { status: 500 })
    }

    // Generate signed URL
    const { data: urlData, error: urlError } = await admin.storage
      .from('attendance-photos')
      .createSignedUrl(photoPath, 31536000) // 1 year

    if (urlError) {
      console.error('[register-face] Signed URL error:', urlError.message)
    }

    const photoUrl = urlData?.signedUrl ?? ''

    // 5. Encrypt descriptor and geometry
    console.log('[register-face] Encrypting descriptor...')
    let encryptedDescriptor: string
    try {
      encryptedDescriptor = encryptDescriptor(descriptor)
    } catch (encErr) {
      console.error('[register-face] Encryption error:', encErr instanceof Error ? encErr.message : encErr)
      return NextResponse.json({ error: 'Gagal enkripsi data wajah', detail: encErr instanceof Error ? encErr.message : String(encErr) }, { status: 500 })
    }

    const encryptedGeometry = geometry ? encryptFaceData(geometry) : null

    // 6. Upsert face registration
    // Only include columns that exist in the schema
    const upsertData: Record<string, unknown> = {
      user_id,
      face_descriptor_encrypted: encryptedDescriptor,
      face_photo_path: photoPath,
      face_photo_url: photoUrl,
      updated_at: new Date().toISOString(),
    }

    // face_data_encrypted column may not exist in older schemas
    // Descriptor is sufficient for 1:N face identification
    if (encryptedGeometry) {
      upsertData.face_data = geometry // Store as plain JSON in legacy column
    }

    console.log('[register-face] Upserting face registration for user:', user_id)

    const { error: upsertError } = await admin
      .from('face_registrations')
      .upsert(upsertData, { onConflict: 'user_id' })

    if (upsertError) {
      console.error('[register-face] Upsert error:', upsertError.message, upsertError.code, upsertError.details)
      return NextResponse.json({ error: 'Gagal menyimpan data wajah', detail: upsertError.message, code: upsertError.code }, { status: 500 })
    }

    console.log('[register-face] Success for user:', user_id)
    return NextResponse.json({
      success: true,
      photo_url: photoUrl,
    })
  } catch (err) {
    console.error('[register-face] Unexpected error:', err instanceof Error ? err.message : err, err instanceof Error ? err.stack : '')
    return NextResponse.json({
      error: 'Terjadi kesalahan server',
      detail: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}
