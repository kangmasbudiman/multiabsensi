import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST /api/delete-employee { user_id }
// Hard-delete karyawan: profile + auth user + semua data terkait.
// Safety: karyawan harus dalam keadaan nonaktif dulu (checked di sini + di client).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Verify caller is admin/hrd
  const { data: caller } = await admin
    .from('profiles')
    .select('id, org_id, role')
    .eq('id', user.id)
    .single()

  if (!caller || !['admin', 'super_admin', 'hrd'].includes(caller.role)) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }

  const { user_id } = await req.json()
  if (!user_id) {
    return NextResponse.json({ error: 'user_id diperlukan' }, { status: 400 })
  }

  // Fetch target profile
  const { data: target } = await admin
    .from('profiles')
    .select('id, org_id, role, is_active, full_name')
    .eq('id', user_id)
    .single()

  if (!target) {
    return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 })
  }

  // Super-admin bisa akses org manapun via inspect mode; lainnya harus same org
  if (caller.role !== 'super_admin' && target.org_id !== caller.org_id) {
    return NextResponse.json({ error: 'Tidak bisa menghapus karyawan dari org lain' }, { status: 403 })
  }

  // Tidak boleh hapus diri sendiri
  if (target.id === caller.id) {
    return NextResponse.json({ error: 'Tidak bisa menghapus akun sendiri' }, { status: 400 })
  }

  // Hanya karyawan yang bisa dihapus (bukan admin/hrd lain)
  if (target.role !== 'employee') {
    return NextResponse.json({ error: 'Hanya karyawan (role: employee) yang bisa dihapus' }, { status: 400 })
  }

  // Safety: harus nonaktif dulu
  if (target.is_active) {
    return NextResponse.json(
      { error: 'Nonaktifkan karyawan dulu sebelum menghapus permanen' },
      { status: 400 }
    )
  }

  // Cleanup storage: hapus folder foto absensi user
  try {
    const { data: userPhotos } = await admin.storage
      .from('attendance-photos')
      .list(`${user_id}/`)
    if (userPhotos && userPhotos.length > 0) {
      const paths = userPhotos.map(p => `${user_id}/${p.name}`)
      await admin.storage.from('attendance-photos').remove(paths)
    }
  } catch {
    // Non-critical — lanjutkan cleanup DB
  }

  // Cleanup related tables (some may have ON DELETE CASCADE, but we delete
  // explicitly to be safe across schema versions).
  await Promise.all([
    admin.from('face_registrations').delete().eq('user_id', user_id),
    admin.from('employee_salaries').delete().eq('user_id', user_id),
    admin.from('employee_shifts').delete().eq('user_id', user_id),
    admin.from('shift_schedules').delete().eq('user_id', user_id),
  ])

  // Leave requests & approvals — coba hapus, abaikan error kalau table belum ada
  await admin.from('leave_requests').delete().eq('user_id', user_id).then(() => {})
  await admin.from('leave_approvers').delete().eq('user_id', user_id).then(() => {})

  // Attendances — historis. Hapus semua.
  await admin.from('attendances').delete().eq('user_id', user_id)

  // Hapus auth user (ini cascade ke profiles kalau FK diset ON DELETE CASCADE)
  const { error: authError } = await admin.auth.admin.deleteUser(user_id)
  if (authError) {
    return NextResponse.json(
      { error: `Gagal menghapus akun auth: ${authError.message}` },
      { status: 500 }
    )
  }

  // Safety: pastikan profile juga hilang (kalau tidak cascade)
  await admin.from('profiles').delete().eq('id', user_id)

  return NextResponse.json({
    success: true,
    deleted: { id: user_id, name: target.full_name },
  })
}
