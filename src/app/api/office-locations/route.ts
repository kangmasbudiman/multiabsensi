import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/office-locations — list lokasi + info terakhir diubah
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, org_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 })
  }

  const { data: locations, error } = await admin
    .from('office_locations')
    .select(`
      id, org_id, name, latitude, longitude, radius_meters, is_active,
      updated_at, last_action,
      updated_by:profiles!office_locations_updated_by_fkey(id, full_name, role)
    `)
    .eq('org_id', profile.org_id)
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ locations: locations ?? [] })
}

// POST /api/office-locations { action, location_id?, payload? }
// Action: 'create' | 'update' | 'delete' | 'toggle'
// Tulis audit log otomatis untuk setiap perubahan.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: caller } = await admin
    .from('profiles')
    .select('id, org_id, role, full_name')
    .eq('id', user.id)
    .single()

  if (!caller || !['admin', 'super_admin', 'hrd'].includes(caller.role)) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }

  const body = await req.json()
  const { action, location_id, payload } = body as {
    action: 'create' | 'update' | 'delete' | 'toggle'
    location_id?: string
    payload?: { name?: string; latitude?: number; longitude?: number; radius_meters?: number; is_active?: boolean; org_id?: string }
  }

  // ─── CREATE ──────────────────────────────────────────────────────
  if (action === 'create') {
    if (!payload?.name || payload.latitude == null || payload.longitude == null) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
    }
    const insertPayload = {
      name: payload.name,
      latitude: payload.latitude,
      longitude: payload.longitude,
      radius_meters: payload.radius_meters ?? 100,
      is_active: true,
      org_id: caller.org_id,
      updated_by: caller.id,
      updated_at: new Date().toISOString(),
      last_action: 'create',
    }
    const { data: created, error: insertError } = await admin
      .from('office_locations')
      .insert(insertPayload)
      .select()
      .single()
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    await writeAudit(admin, {
      org_id: caller.org_id,
      location_id: created.id,
      location_name: created.name,
      action: 'create',
      changes: { to: { latitude: created.latitude, longitude: created.longitude, radius_meters: created.radius_meters, is_active: created.is_active } },
      changed_by: caller.id,
      changed_by_name: caller.full_name,
      changed_by_role: caller.role,
    })

    return NextResponse.json({ success: true, location: created })
  }

  // ─── Validasi untuk update/delete/toggle ──────────────────────────
  if (!location_id) {
    return NextResponse.json({ error: 'location_id diperlukan' }, { status: 400 })
  }

  // Fetch existing row untuk audit + safety check
  const { data: existing } = await admin
    .from('office_locations')
    .select('*')
    .eq('id', location_id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Lokasi tidak ditemukan' }, { status: 404 })
  }

  if (existing.org_id !== caller.org_id && caller.role !== 'super_admin') {
    return NextResponse.json({ error: 'Tidak bisa mengubah lokasi org lain' }, { status: 403 })
  }

  // ─── UPDATE ──────────────────────────────────────────────────────
  if (action === 'update') {
    if (!payload) {
      return NextResponse.json({ error: 'payload diperlukan' }, { status: 400 })
    }
    const updatePayload = {
      name: payload.name ?? existing.name,
      latitude: payload.latitude ?? existing.latitude,
      longitude: payload.longitude ?? existing.longitude,
      radius_meters: payload.radius_meters ?? existing.radius_meters,
      updated_by: caller.id,
      updated_at: new Date().toISOString(),
      last_action: 'update',
    }
    const { error: updateError } = await admin
      .from('office_locations')
      .update(updatePayload)
      .eq('id', location_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const from = {
      name: existing.name,
      latitude: existing.latitude,
      longitude: existing.longitude,
      radius_meters: existing.radius_meters,
    }
    const to = {
      name: updatePayload.name,
      latitude: updatePayload.latitude,
      longitude: updatePayload.longitude,
      radius_meters: updatePayload.radius_meters,
    }
    await writeAudit(admin, {
      org_id: existing.org_id,
      location_id: existing.id,
      location_name: updatePayload.name,
      action: 'update',
      changes: { from, to },
      changed_by: caller.id,
      changed_by_name: caller.full_name,
      changed_by_role: caller.role,
    })

    return NextResponse.json({ success: true })
  }

  // ─── TOGGLE (active/inactive) ────────────────────────────────────
  if (action === 'toggle') {
    const newActive = !existing.is_active
    const { error: toggleError } = await admin
      .from('office_locations')
      .update({
        is_active: newActive,
        updated_by: caller.id,
        updated_at: new Date().toISOString(),
        last_action: 'toggle',
      })
      .eq('id', location_id)

    if (toggleError) {
      return NextResponse.json({ error: toggleError.message }, { status: 500 })
    }

    await writeAudit(admin, {
      org_id: existing.org_id,
      location_id: existing.id,
      location_name: existing.name,
      action: 'toggle',
      changes: { from: { is_active: existing.is_active }, to: { is_active: newActive } },
      changed_by: caller.id,
      changed_by_name: caller.full_name,
      changed_by_role: caller.role,
    })

    return NextResponse.json({ success: true })
  }

  // ─── DELETE ──────────────────────────────────────────────────────
  if (action === 'delete') {
    const { error: deleteError } = await admin
      .from('office_locations')
      .delete()
      .eq('id', location_id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    await writeAudit(admin, {
      org_id: existing.org_id,
      location_id: existing.id,
      location_name: existing.name,
      action: 'delete',
      changes: { from: { name: existing.name, latitude: existing.latitude, longitude: existing.longitude, radius_meters: existing.radius_meters } },
      changed_by: caller.id,
      changed_by_name: caller.full_name,
      changed_by_role: caller.role,
    })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Aksi tidak dikenal' }, { status: 400 })
}

// ─── Helper: tulis audit log ────────────────────────────────────────
async function writeAudit(
  admin: ReturnType<typeof createAdminClient>,
  params: {
    org_id: string
    location_id: string
    location_name: string
    action: 'create' | 'update' | 'delete' | 'toggle' | 'legacy'
    changes: Record<string, unknown>
    changed_by: string
    changed_by_name: string
    changed_by_role: string
  }
) {
  try {
    await admin.from('office_location_audits').insert({
      org_id: params.org_id,
      location_id: params.location_id,
      location_name: params.location_name,
      action: params.action,
      changes: params.changes,
      changed_by: params.changed_by,
      changed_by_name: params.changed_by_name,
      changed_by_role: params.changed_by_role,
    })
  } catch (e) {
    // Audit write gagal jangan block operasi utama. Log ke server console.
    console.error('[audit] Failed to write office_location_audits:', e)
  }
}
