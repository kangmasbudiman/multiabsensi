'use client'

import Link from 'next/link'
import {
  ArrowRight,
  PlayCircle,
  ShieldCheck,
  Star,
  Sparkles,
  CheckCircle2,
  Users,
  Clock,
  MapPin,
  ScanFace,
} from 'lucide-react'
import { DashboardMockup } from './DashboardMockup'

interface Props {
  t: {
    badge: string
    title_1: string
    title_highlight: string
    subtitle: string
    primary_cta: string
    secondary_cta: string
    no_card_required: string
    trusted_by: string
  }
  appName: string
}

export function Hero({ t, appName }: Props) {
  return (
    <section className="relative overflow-hidden pt-28 sm:pt-36 pb-20 sm:pb-24">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-teal-600 via-emerald-700 to-teal-800 animate-gradient-pan" />
      <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/40 via-transparent to-transparent" />

      {/* Drifting glow blobs */}
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-cyan-400/30 blur-3xl animate-glow animate-blob-1" />
      <div className="absolute top-20 -right-40 w-[600px] h-[600px] rounded-full bg-emerald-400/25 blur-3xl animate-glow animate-blob-2" />
      <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full bg-teal-300/20 blur-3xl animate-glow animate-blob-1" style={{ animationDelay: '4s' }} />

      {/* Animated grid pattern */}
      <div className="absolute inset-0 bg-grid-pattern-animated opacity-40" />

      {/* Decorative floating dots */}
      <div className="absolute top-32 left-[8%] w-2 h-2 rounded-full bg-cyan-300/60 animate-float" />
      <div className="absolute top-1/2 left-[5%] w-1.5 h-1.5 rounded-full bg-emerald-200/60 animate-float-delayed" />
      <div className="absolute bottom-32 right-[8%] w-2 h-2 rounded-full bg-teal-200/60 animate-float" />
      <div className="absolute top-1/3 right-[3%] w-1.5 h-1.5 rounded-full bg-white/60 animate-float-delayed" />

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        {/* ─── HERO ROW: split layout ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center mb-20 lg:mb-28">
          {/* ─── LEFT: text content (staggered entrance) ─── */}
          <div className="text-center lg:text-left hero-stagger">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs sm:text-sm font-medium mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              {t.badge}
            </div>

            {/* H1 */}
            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-white leading-[1.1] tracking-tight mb-6">
              {t.title_1}{' '}
              <span className="block mt-2 bg-gradient-to-r from-cyan-200 via-emerald-200 to-teal-200 bg-clip-text text-transparent">
                {t.title_highlight}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-teal-50/90 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              {t.subtitle}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-6">
              <Link
                href="/register"
                className="group relative inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white text-teal-700 font-semibold shadow-2xl shadow-emerald-950/30 hover:shadow-xl hover:-translate-y-0.5 transition-all overflow-hidden"
              >
                {/* Shimmer sweep */}
                <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                  <span className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-teal-200/50 to-transparent animate-shimmer" />
                </span>
                <span className="relative">{t.primary_cta}</span>
                <ArrowRight className="relative w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="#features"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/30 text-white font-semibold hover:bg-white/20 transition-all"
              >
                <PlayCircle className="w-4 h-4" />
                {t.secondary_cta}
              </Link>
            </div>

            {/* Footnote */}
            <p className="text-xs text-teal-100/70 mb-8">{t.no_card_required}</p>

            {/* Trust line */}
            <div className="flex items-center justify-center lg:justify-start gap-3 flex-wrap">
              <div className="flex -space-x-2">
                {[12, 32, 47, 5, 23].map((id) => (
                  <img
                    key={id}
                    src={`https://i.pravatar.cc/64?img=${id}`}
                    alt=""
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full ring-2 ring-white/80 object-cover"
                    loading="lazy"
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-white">
                <div className="flex">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                  ))}
                </div>
                <span className="text-xs sm:text-sm text-teal-50/90">{t.trusted_by}</span>
              </div>
            </div>
          </div>

          {/* ─── RIGHT: visual stack ─── */}
          <div className="relative hero-slide-in">
            {/* Inner glow (pulsing) */}
            <div className="absolute -inset-6 bg-gradient-to-tr from-cyan-300/30 via-emerald-300/30 to-teal-300/30 blur-3xl rounded-full animate-glow" />

            {/* Main photo card */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-emerald-950/40 border border-white/20 aspect-[4/5] sm:aspect-[5/6] max-w-md mx-auto">
              <img
                src="https://images.unsplash.com/photo-1592890288564-76628a30a657?auto=format&fit=crop&w=900&q=80"
                alt="Karyawan melakukan absensi selfie dengan smartphone"
                className="absolute inset-0 w-full h-full object-cover"
                loading="eager"
              />
              {/* Photo overlay tint */}
              <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/40 via-transparent to-teal-500/10" />

              {/* Top gradient bar */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

              {/* Face-scan overlay — moves up & down over the photo */}
              <div className="absolute inset-x-0 top-0 h-full overflow-hidden pointer-events-none">
                {/* Scan line */}
                <div className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-emerald-300/40 to-transparent animate-scan">
                  <div className="absolute bottom-0 inset-x-0 h-px bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.8)]" />
                </div>
                {/* Corner brackets (face-detection frame) */}
                <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-emerald-300/80 rounded-tl-lg" />
                <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-emerald-300/80 rounded-tr-lg" />
                <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-emerald-300/80 rounded-bl-lg" />
                <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-emerald-300/80 rounded-br-lg" />
              </div>

              {/* HUD label top-center */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 backdrop-blur-md border border-emerald-300/40">
                <ScanFace className="w-3 h-3 text-emerald-300 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-200 tracking-wider uppercase">Scanning…</span>
              </div>
            </div>

            {/* Floating chip: face verified (top-right of photo) */}
            <div className="absolute -top-3 -right-2 sm:-right-6 flex items-center gap-2 px-3 py-2 rounded-xl bg-white shadow-2xl shadow-emerald-950/30 animate-float">
              <div className="relative">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                {/* Pulse ring */}
                <span className="absolute inset-0 rounded-lg bg-emerald-400 animate-pulse-ring" />
              </div>
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Wajah</div>
                <div className="text-xs text-slate-900 font-bold">Terverifikasi 99.4%</div>
              </div>
            </div>

            {/* Floating chip: GPS check (bottom-left, overlapping photo) */}
            <div className="absolute -bottom-3 -left-2 sm:-left-6 flex items-center gap-2 px-3 py-2 rounded-xl bg-white shadow-2xl shadow-emerald-950/30 animate-float-delayed">
              <div className="relative">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <span className="absolute inset-0 rounded-lg bg-teal-400 animate-pulse-ring" style={{ animationDelay: '0.6s' }} />
              </div>
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Mock GPS</div>
                <div className="text-xs text-slate-900 font-bold">Diblokir ✓</div>
              </div>
            </div>

            {/* Floating mini stat: live Check-ins (right side, mid) */}
            <div className="hidden sm:flex absolute top-1/2 -right-4 lg:-right-8 -translate-y-1/2 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/95 backdrop-blur-md shadow-2xl shadow-emerald-950/30 animate-float" style={{ animationDelay: '0.5s' }}>
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-left">
                <div className="text-[9px] uppercase tracking-wide text-slate-400 font-bold">Hadir Hari Ini</div>
                <div className="text-xs text-slate-900 font-bold">94% • 247 karyawan</div>
              </div>
            </div>

            {/* Floating chip: clock-in time (bottom-right) */}
            <div className="hidden sm:flex absolute bottom-12 -right-2 lg:-right-6 items-center gap-2 px-3 py-2 rounded-xl bg-white/95 backdrop-blur-md shadow-xl shadow-emerald-950/20 animate-float-delayed" style={{ animationDelay: '1.5s' }}>
              <div className="w-7 h-7 rounded-lg bg-cyan-100 flex items-center justify-center">
                <Clock className="w-4 h-4 text-cyan-600" />
              </div>
              <div className="text-left">
                <div className="text-[9px] uppercase tracking-wide text-slate-400 font-bold">Check-in</div>
                <div className="text-xs text-slate-900 font-bold font-mono">08:02:14</div>
              </div>
            </div>

            {/* Floating mini-map pin chip (top-left of photo) */}
            <div className="hidden sm:flex absolute top-1/4 -left-4 lg:-left-8 items-center gap-2 px-3 py-2 rounded-xl bg-white/95 backdrop-blur-md shadow-xl shadow-emerald-950/20 animate-bob">
              <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-left">
                <div className="text-[9px] uppercase tracking-wide text-slate-400 font-bold">Lokasi</div>
                <div className="text-xs text-slate-900 font-bold">Kantor Pusat</div>
              </div>
            </div>

            {/* Decorative sparkle */}
            <div className="absolute -top-8 left-1/4 hidden sm:block">
              <Sparkles className="w-5 h-5 text-amber-300 animate-float" />
            </div>
            <div className="absolute top-1/3 -right-10 hidden lg:block">
              <Sparkles className="w-4 h-4 text-cyan-200 animate-float-delayed" />
            </div>
          </div>
        </div>

        {/* ─── DASHBOARD MOCKUP (full width preview below) ────────────── */}
        <div className="relative max-w-5xl mx-auto">
          <div className="absolute -inset-4 bg-gradient-to-r from-teal-400/20 via-emerald-400/20 to-cyan-400/20 blur-2xl rounded-3xl" />
          <div className="relative">
            <DashboardMockup appName={appName} />
          </div>
        </div>
      </div>

      {/* Wave divider */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 100" fill="none" preserveAspectRatio="none" className="w-full h-16 sm:h-24">
          <path d="M0,64 C240,100 480,100 720,72 C960,44 1200,44 1440,72 L1440,100 L0,100 Z" fill="white" />
        </svg>
      </div>
    </section>
  )
}
