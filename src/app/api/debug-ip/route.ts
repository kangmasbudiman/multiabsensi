// Endpoint debug — return IP yang dilihat server + headers relevant.
// Publik (tanpa auth) supaya bisa dicek dari jaringan mana saja.
// Hanya untuk troubleshooting, hapus setelah selesai debug.

import { NextResponse } from 'next/server'
import { getClientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const clientIp = getClientIp(req)
  const headers = Object.fromEntries(req.headers.entries())

  // Filter hanya headers relevant untuk IP detection
  const ipHeaders = {
    'x-forwarded-for': headers['x-forwarded-for'] ?? null,
    'x-real-ip': headers['x-real-ip'] ?? null,
    'x-vercel-forwarded-for': headers['x-vercel-forwarded-for'] ?? null,
    'x-vercel-ip': headers['x-vercel-ip'] ?? null,
    'x-vercel-ip-country': headers['x-vercel-ip-country'] ?? null,
    'x-vercel-ip-city': headers['x-vercel-ip-city'] ?? null,
  }

  return NextResponse.json({
    detected_client_ip: clientIp,
    ip_headers: ipHeaders,
    note: 'Bandingkan detected_client_ip dengan IP yang ada di /dashboard/network whitelist. Harus SAMA PERSIS.',
  })
}
