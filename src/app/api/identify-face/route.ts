import { createAdminClient } from '@/lib/supabase/admin'
import { decryptDescriptor } from '@/lib/face-crypto'
import { findBestMatch } from '@/lib/face-compare'
import { isRateLimited, getClientIp } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Minimum similarity untuk dianggap match valid. Di bawah ini → reject total.
// Dipakai sebagai safety net tambahan di sisi server (selain MATCH_THRESHOLD=0.5
// di face-compare.ts). 0.55 sedikit lebih ketat untuk margin keamanan.
const MIN_ACCEPT_SIMILARITY = 0.55

export async function POST(req: NextRequest) {
  // Rate limit: max 20 identification requests per IP per minute
  const clientIp = getClientIp(req)
  if (isRateLimited(`identify:${clientIp}`, 20, 60_000)) {
    return NextResponse.json(
      { error: 'Terlalu banyak percobaan. Tunggu beberapa saat.', identified: false },
      { status: 429 }
    )
  }

  const body = await req.json()
  const { org_code, captured_descriptor, device_fingerprint } = body as {
    org_code?: string
    captured_descriptor?: number[]
    device_fingerprint?: string
  }
  const userAgent = req.headers.get('user-agent') ?? null

  // Helper: tulis audit log (best-effort, jangan block flow utama kalau gagal)
  const admin = createAdminClient()
  const writeAudit = (params: {
    orgId: string | null
    matchedUserId: string | null
    similarity: number | null
    isMatch: boolean
    error?: string | null
  }) => {
    admin
      .from('face_match_logs')
      .insert({
        org_id: params.orgId,
        matched_user_id: params.matchedUserId,
        similarity: params.similarity !== null ? Number(params.similarity.toFixed(4)) : null,
        is_match: params.isMatch,
        ip_address: clientIp,
        user_agent: userAgent,
        device_fingerprint: device_fingerprint ?? null,
        error: params.error ?? null,
      })
      .then(() => undefined, (e) => console.error('face_match_logs insert failed:', e))
  }

  if (!org_code || !captured_descriptor) {
    return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
  }

  // Validate descriptor is 128 floats
  if (!Array.isArray(captured_descriptor) || captured_descriptor.length !== 128) {
    return NextResponse.json({ error: 'Descriptor tidak valid' }, { status: 400 })
  }

  // Lookup organization
  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .eq('company_code', org_code)
    .single()

  if (!org) {
    writeAudit({ orgId: null, matchedUserId: null, similarity: null, isMatch: false, error: 'org_not_found' })
    return NextResponse.json({ identified: false, similarity: 0 })
  }

  // Get all active employees in this org
  const { data: employees } = await admin
    .from('profiles')
    .select('id, full_name, employee_id, position')
    .eq('org_id', org.id)
    .eq('role', 'employee')
    .eq('is_active', true)

  if (!employees?.length) {
    writeAudit({ orgId: org.id, matchedUserId: null, similarity: null, isMatch: false, error: 'no_employees' })
    return NextResponse.json({ identified: false, similarity: 0 })
  }

  const empIds = employees.map(e => e.id)

  // Get all face registrations with encrypted descriptors
  const { data: faceRegs } = await admin
    .from('face_registrations')
    .select('user_id, face_descriptor_encrypted')
    .in('user_id', empIds)

  if (!faceRegs?.length) {
    writeAudit({ orgId: org.id, matchedUserId: null, similarity: null, isMatch: false, error: 'no_face_registrations' })
    return NextResponse.json({ identified: false, similarity: 0 })
  }

  // Decrypt all descriptors and build comparison set
  const storedDescriptors: Array<{ user_id: string; descriptor: number[] }> = []
  const empMap = new Map(employees.map(e => [e.id, e]))

  for (const reg of faceRegs) {
    if (!reg.face_descriptor_encrypted) continue
    try {
      const descriptor = decryptDescriptor(reg.face_descriptor_encrypted)
      storedDescriptors.push({ user_id: reg.user_id, descriptor })
    } catch {
      // Skip corrupted entries
    }
  }

  if (storedDescriptors.length === 0) {
    writeAudit({ orgId: org.id, matchedUserId: null, similarity: null, isMatch: false, error: 'all_descriptors_corrupted' })
    return NextResponse.json({ identified: false, similarity: 0 })
  }

  // Find best match
  const match = findBestMatch(captured_descriptor, storedDescriptors)

  if (!match || !match.isMatch) {
    writeAudit({
      orgId: org.id,
      matchedUserId: match?.user_id ?? null,
      similarity: match?.similarity ?? null,
      isMatch: false,
    })
    return NextResponse.json({
      identified: false,
      similarity: match?.similarity ?? 0,
    })
  }

  const emp = empMap.get(match.user_id)
  if (!emp) {
    writeAudit({ orgId: org.id, matchedUserId: match.user_id, similarity: match.similarity, isMatch: false, error: 'matched_user_not_in_org' })
    return NextResponse.json({ identified: false, similarity: 0 })
  }

  // Safety net: walau findBestMatch memakai threshold 0.5, kalau similarity
  // masih di bawah MIN_ACCEPT_SIMILARITY (0.55) → reject. Ini margin ekstra
  // untuk minimasi false-accept di edge case (foto blurry, sibling mirip).
  if (match.similarity < MIN_ACCEPT_SIMILARITY) {
    writeAudit({
      orgId: org.id,
      matchedUserId: emp.id,
      similarity: match.similarity,
      isMatch: false,
      error: 'below_min_accept_similarity',
    })
    return NextResponse.json({
      identified: false,
      similarity: match.similarity,
    })
  }

  // Sukses: tulis audit log match positif
  writeAudit({
    orgId: org.id,
    matchedUserId: emp.id,
    similarity: match.similarity,
    isMatch: true,
  })

  return NextResponse.json({
    identified: true,
    user_id: emp.id,
    full_name: emp.full_name,
    employee_id: emp.employee_id,
    position: emp.position,
    similarity: match.similarity,
  })
}
