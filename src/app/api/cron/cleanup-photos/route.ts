import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const RETENTION_DAYS = 60
const BATCH_SIZE = 200

export async function GET(req: NextRequest) {
  // Vercel Cron injects `Authorization: Bearer <CRON_SECRET>`.
  // Reject anything that doesn't match — this route can purge production data.
  const authHeader = req.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // date column is DATE (no time), so a YYYY-MM-DD cutoff string works with `.lt()`.
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000)
    .toISOString()
    .split('T')[0]

  const { data: stale, error } = await admin
    .from('attendances')
    .select('id, check_in_photo_url, check_out_photo_url')
    .lt('date', cutoff)
    .or('check_in_photo_url.not.is.null,check_out_photo_url.not.is.null')
    .order('date', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let processed = 0
  let failed = 0
  const errors: string[] = []
  const purgedAt = new Date().toISOString()

  for (const rec of stale ?? []) {
    const urls = [rec.check_in_photo_url, rec.check_out_photo_url].filter(
      (u): u is string => !!u
    )
    for (const url of urls) {
      const path = extractStoragePath(url)
      if (!path) continue
      const { error: delErr } = await admin
        .storage
        .from('attendance-photos')
        .remove([path])
      if (delErr) {
        failed++
        if (errors.length < 10) errors.push(`${path}: ${delErr.message}`)
      }
    }

    const { error: updErr } = await admin
      .from('attendances')
      .update({
        check_in_photo_url: null,
        check_out_photo_url: null,
        photo_purged_at: purgedAt,
      })
      .eq('id', rec.id)

    if (updErr) {
      failed++
      if (errors.length < 10) errors.push(`db:${rec.id}: ${updErr.message}`)
    } else {
      processed++
    }
  }

  return NextResponse.json({
    processed,
    failed,
    cutoff,
    remaining: stale?.length === BATCH_SIZE ? 'more' : 'done',
    errors,
  })
}

// Signed URL format:
// https://<project>.supabase.co/storage/v1/object/sign/attendance-photos/<path>?token=...
//                                  ^ marker              ^ extract until '?'
function extractStoragePath(signedUrl: string): string | null {
  const marker = '/attendance-photos/'
  const idx = signedUrl.indexOf(marker)
  if (idx === -1) return null
  return signedUrl.slice(idx + marker.length).split('?')[0]
}
