'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function assertSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'super_admin') throw new Error('Forbidden')
  return user.id
}

function safeRole(e: unknown): string {
  if (e instanceof Error) return e.message
  return 'Unauthorized'
}

// Buat magic link baru + whitelist users
export async function createCustomLink(opts: {
  orgId: string
  label?: string
  expiresAt?: string | null
  userIds: string[]
}) {
  if (!opts.orgId) return { error: 'Perusahaan harus dipilih' }
  if (!opts.userIds.length) return { error: 'Pilih minimal 1 karyawan' }

  let actorId: string
  try {
    actorId = await assertSuperAdmin()
  } catch (e) {
    return { error: safeRole(e) }
  }

  const admin = createAdminClient()

  const { data: link, error } = await admin
    .from('custom_attendance_links')
    .insert({
      org_id: opts.orgId,
      label: opts.label?.trim() || null,
      expires_at: opts.expiresAt || null,
      created_by: actorId,
    })
    .select('id, token')
    .single()

  if (error) return { error: error.message }

  const rows = opts.userIds.map(uid => ({ link_id: link.id, user_id: uid }))
  const { error: wlErr } = await admin
    .from('custom_attendance_link_users')
    .insert(rows)

  if (wlErr) return { error: wlErr.message }

  revalidatePath('/dashboard/custom-attendance')
  return { success: true, linkId: link.id, token: link.token }
}

export async function listCustomLinks() {
  try {
    await assertSuperAdmin()
  } catch (e) {
    return { error: safeRole(e) }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('custom_attendance_links')
    .select(`
      id, token, label, org_id, is_active, expires_at, created_at,
      organizations(name),
      custom_attendance_link_users(user_id)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return { error: error.message }
  return { data }
}

export async function addLinkUsers(opts: { linkId: string; userIds: string[] }) {
  if (!opts.linkId || !opts.userIds.length) return { error: 'Input tidak valid' }

  try {
    await assertSuperAdmin()
  } catch (e) {
    return { error: safeRole(e) }
  }

  const admin = createAdminClient()
  const rows = opts.userIds.map(uid => ({ link_id: opts.linkId, user_id: uid }))
  const { error } = await admin
    .from('custom_attendance_link_users')
    .upsert(rows, { onConflict: 'link_id,user_id' })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/custom-attendance')
  return { success: true }
}

export async function removeLinkUser(opts: { linkId: string; userId: string }) {
  if (!opts.linkId || !opts.userId) return { error: 'Input tidak valid' }

  try {
    await assertSuperAdmin()
  } catch (e) {
    return { error: safeRole(e) }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('custom_attendance_link_users')
    .delete()
    .eq('link_id', opts.linkId)
    .eq('user_id', opts.userId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/custom-attendance')
  return { success: true }
}

export async function deactivateLink(linkId: string) {
  if (!linkId) return { error: 'linkId diperlukan' }

  try {
    await assertSuperAdmin()
  } catch (e) {
    return { error: safeRole(e) }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('custom_attendance_links')
    .update({ is_active: false })
    .eq('id', linkId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/custom-attendance')
  return { success: true }
}

// Public: validate token + return org_code for face identification
export async function validateCustomToken(token: string) {
  if (!token) return { error: 'Token diperlukan' }

  const admin = createAdminClient()
  const { data: link, error } = await admin
    .from('custom_attendance_links')
    .select(`
      id, token, is_active, expires_at, org_id,
      organizations(name, company_code)
    `)
    .eq('token', token)
    .maybeSingle()

  if (error) return { error: error.message }
  if (!link) return { error: 'Token tidak ditemukan' }
  if (!link.is_active) return { error: 'Link sudah dinonaktifkan' }

  if (link.expires_at && new Date(link.expires_at) <= new Date()) {
    return { error: 'Link sudah kadaluarsa' }
  }

  const org = link.organizations as unknown as { name: string; company_code: string } | null
  if (!org) return { error: 'Organisasi tidak ditemukan' }

  return {
    data: {
      linkId: link.id,
      orgId: link.org_id,
      orgName: org.name,
      orgCode: org.company_code,
    },
  }
}

// Public: check apakah user_id ada di whitelist link ini
export async function checkWhitelist(token: string, userId: string) {
  if (!token || !userId) return { allowed: false }

  const admin = createAdminClient()
  const { data: link } = await admin
    .from('custom_attendance_links')
    .select('id, is_active, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!link || !link.is_active) return { allowed: false }
  if (link.expires_at && new Date(link.expires_at) <= new Date()) {
    return { allowed: false }
  }

  const { data: wl } = await admin
    .from('custom_attendance_link_users')
    .select('user_id')
    .eq('link_id', link.id)
    .eq('user_id', userId)
    .maybeSingle()

  return { allowed: !!wl }
}

// List employees dalam org (paginate). Dipakai client modal via server action
// biar nggak expose service role key ke browser.
export async function listOrgEmployees(orgId: string) {
  if (!orgId) return { error: 'orgId diperlukan' }

  try {
    await assertSuperAdmin()
  } catch (e) {
    return { error: safeRole(e) }
  }

  const admin = createAdminClient()
  const employees: Array<{ id: string; full_name: string; employee_id: string | null }> = []
  for (let from = 0; from < 50000; from += 1000) {
    const { data: page } = await admin
      .from('profiles')
      .select('id, full_name, employee_id')
      .eq('org_id', orgId)
      .eq('role', 'employee')
      .eq('is_active', true)
      .order('full_name')
      .range(from, from + 999)
    if (!page?.length) break
    employees.push(...(page as any[]))
    if (page.length < 1000) break
  }
  return { data: employees }
}

// Search employees dalam org buat tambah whitelist
export async function searchOrgEmployees(orgId: string, query: string) {
  if (!orgId) return { error: 'orgId diperlukan' }
  const q = query.toLowerCase().trim()
  if (q.length < 2) return { data: [] }

  try {
    await assertSuperAdmin()
  } catch (e) {
    return { error: safeRole(e) }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('id, full_name, employee_id')
    .eq('org_id', orgId)
    .eq('role', 'employee')
    .eq('is_active', true)
    .or(`full_name.ilike.%${q}%,employee_id.ilike.%${q}%`)
    .limit(20)

  if (error) return { error: error.message }
  return { data: data as unknown as Array<{ id: string; full_name: string; employee_id: string | null }> }
}
