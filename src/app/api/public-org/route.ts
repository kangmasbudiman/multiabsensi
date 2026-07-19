import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/public-org?org_code=xxx
// Gabungan: cari org + ambil karyawan + face reg count + office locations dalam 1 request.
// Semua query dijalankan paralel setelah org ditemukan.
export async function GET(req: NextRequest) {
  const orgCode = req.nextUrl.searchParams.get('org_code')
  if (!orgCode) {
    return NextResponse.json({ error: 'org_code diperlukan' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .select('id, name, address')
    .eq('company_code', orgCode)
    .single()

  if (orgError || !org) {
    return NextResponse.json({ error: 'Kode perusahaan tidak valid' }, { status: 404 })
  }

  // employees & locations independent → paralel. face_regs butuh empIds.
  const [employeesRes, locationsRes] = await Promise.all([
    admin
      .from('profiles')
      .select('id, full_name, employee_id, position')
      .eq('org_id', org.id)
      .eq('role', 'employee')
      .eq('is_active', true)
      .order('full_name'),
    admin
      .from('office_locations')
      .select('name, latitude, longitude, radius_meters')
      .eq('org_id', org.id)
      .eq('is_active', true),
  ])

  const empIds = (employeesRes.data ?? []).map(e => e.id)
  const faceRegUserIds = new Set<string>()
  if (empIds.length > 0) {
    const { data: faceRegs } = await admin
      .from('face_registrations')
      .select('user_id')
      .in('user_id', empIds)
    for (const r of (faceRegs ?? [])) {
      faceRegUserIds.add(r.user_id)
    }
  }

  return NextResponse.json({
    org: { id: org.id, name: org.name, address: org.address },
    face_registration_count: faceRegUserIds.size,
    employees: (employeesRes.data ?? []).map(e => ({
      id: e.id,
      full_name: e.full_name,
      employee_id: e.employee_id,
      position: e.position,
      face_data_exists: faceRegUserIds.has(e.id),
    })),
    locations: locationsRes.data ?? [],
  })
}
