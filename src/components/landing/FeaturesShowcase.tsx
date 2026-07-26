'use client'

import { Check, MapPin, ShieldOff, MapPinned } from 'lucide-react'
import { useReveal } from '@/hooks/use-reveal'

interface ShowcaseItem {
  tag: string
  title: string
  desc: string
  points: ReadonlyArray<string>
  mockup_kind: 'map' | 'phone' | 'payroll'
}

interface Props {
  t: {
    title: string
    subtitle: string
    items: ReadonlyArray<ShowcaseItem>
  }
}

export function FeaturesShowcase({ t }: Props) {
  return (
    <section id="features" className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <Header title={t.title} subtitle={t.subtitle} />

        <div className="mt-16 space-y-24 sm:space-y-32">
          {t.items.map((item, i) => (
            <ShowcaseRow key={item.title} item={item} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  const { ref, visible } = useReveal<HTMLDivElement>()
  return (
    <div ref={ref} className={`reveal ${visible ? 'is-visible' : ''} max-w-2xl mx-auto text-center`}>
      <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">{title}</h2>
      <p className="mt-3 text-slate-600">{subtitle}</p>
    </div>
  )
}

function ShowcaseRow({ item, index }: { item: ShowcaseItem; index: number }) {
  const { ref, visible } = useReveal<HTMLDivElement>()
  const reversed = index % 2 === 1

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center`}
    >
      {/* Text */}
      <div className={reversed ? 'lg:order-2' : 'lg:order-1'}>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-100 text-teal-700 text-xs font-semibold mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
          {item.tag}
        </div>
        <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-4">
          {item.title}
        </h3>
        <p className="text-slate-600 mb-6 leading-relaxed">{item.desc}</p>
        <ul className="space-y-3">
          {item.points.map((point) => (
            <li key={point} className="flex items-start gap-3">
              <div className="mt-0.5 w-5 h-5 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </div>
              <span className="text-slate-700 text-sm sm:text-base">{point}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Mockup */}
      <div className={reversed ? 'lg:order-1' : 'lg:order-2'}>
        <div className="relative">
          <div className="absolute -inset-6 bg-gradient-to-br from-teal-200/40 via-emerald-200/30 to-cyan-200/40 blur-3xl rounded-full opacity-70" />
          <div className="relative">
            <FeatureMockup kind={item.mockup_kind} />
          </div>
        </div>
      </div>
    </div>
  )
}

function FeatureMockup({ kind }: { kind: ShowcaseItem['mockup_kind'] }) {
  if (kind === 'map') return <MapMockup />
  if (kind === 'phone') return <PhoneMockup />
  return <PayrollMockup />
}

// ─── Map / Geofencing mockup ──────────────────────────────────────────
function MapMockup() {
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl shadow-emerald-950/10 border border-slate-200 bg-white">
      <div className="relative aspect-[4/3] bg-gradient-to-br from-slate-100 to-emerald-50">
        {/* Fake roads */}
        <div className="absolute top-1/3 left-0 right-0 h-1 bg-slate-300/70" />
        <div className="absolute top-2/3 left-0 right-0 h-0.5 bg-slate-300/50" />
        <div className="absolute left-1/4 top-0 bottom-0 w-1 bg-slate-300/70" />
        <div className="absolute left-3/4 top-0 bottom-0 w-0.5 bg-slate-300/50" />

        {/* Fake buildings */}
        <div className="absolute top-4 left-8 w-12 h-8 bg-slate-200/60 rounded" />
        <div className="absolute top-4 right-12 w-16 h-6 bg-slate-200/60 rounded" />
        <div className="absolute bottom-12 left-16 w-10 h-10 bg-slate-200/60 rounded" />

        {/* Geofence circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative">
            <div className="absolute -inset-16 rounded-full bg-teal-400/20 animate-pulse" />
            <div className="absolute -inset-12 rounded-full border-2 border-teal-500 border-dashed" />
            <div className="absolute -inset-12 rounded-full bg-teal-400/10" />

            {/* Center pin */}
            <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-xl shadow-teal-500/40 ring-4 ring-white">
              <MapPinned className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        {/* Distance chips */}
        <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-white shadow-md text-[10px] font-bold text-emerald-700 flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          12m
        </div>
        <div className="absolute bottom-3 left-3 px-2 py-1 rounded-md bg-rose-50 border border-rose-200 shadow-md text-[10px] font-bold text-rose-700 flex items-center gap-1">
          <ShieldOff className="w-3 h-3" />
          Mock GPS blocked
        </div>
      </div>
    </div>
  )
}

// ─── Phone / Face Recognition mockup ──────────────────────────────────
function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[260px]">
      <div className="relative aspect-[9/18] rounded-[2.5rem] bg-slate-900 p-2.5 shadow-2xl shadow-emerald-950/30 border border-slate-700">
        {/* Notch */}
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-20 h-5 rounded-b-2xl bg-slate-900 z-10" />

        {/* Screen */}
        <div className="relative h-full rounded-[2rem] overflow-hidden bg-gradient-to-br from-teal-700 via-emerald-800 to-emerald-900">
          {/* Top bar */}
          <div className="flex justify-between items-center px-4 pt-3 text-[8px] text-white/80">
            <span>09:41</span>
            <span>● ● ●</span>
          </div>

          {/* Title */}
          <div className="px-4 mt-2 text-center">
            <div className="text-[10px] text-emerald-200 font-medium">Verifikasi Wajah</div>
            <div className="text-xs text-white font-bold">Look at camera</div>
          </div>

          {/* Face scan area */}
          <div className="relative mx-auto mt-4 w-32 h-40">
            <div className="absolute inset-0 rounded-[50%] border-2 border-emerald-300/40" />
            <div className="absolute inset-2 rounded-[50%] border-2 border-emerald-300/60 animate-pulse" />

            {/* Face silhouette */}
            <svg viewBox="0 0 100 120" className="absolute inset-0 w-full h-full opacity-90">
              <defs>
                <radialGradient id="face-grad" cx="50%" cy="40%">
                  <stop offset="0%" stopColor="#fef3c7" />
                  <stop offset="100%" stopColor="#fbbf24" />
                </radialGradient>
              </defs>
              <ellipse cx="50" cy="45" rx="22" ry="28" fill="url(#face-grad)" />
              <rect x="28" y="70" width="44" height="40" rx="20" fill="url(#face-grad)" />
              {/* Eyes */}
              <ellipse cx="42" cy="42" rx="2" ry="1" fill="#1e293b" />
              <ellipse cx="58" cy="42" rx="2" ry="1" fill="#1e293b" />
              {/* Mouth */}
              <path d="M 44 56 Q 50 60 56 56" stroke="#1e293b" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>

            {/* Scan corners */}
            {['top-0 left-0 border-t-2 border-l-2', 'top-0 right-0 border-t-2 border-r-2', 'bottom-0 left-0 border-b-2 border-l-2', 'bottom-0 right-0 border-b-2 border-r-2'].map((cls) => (
              <div key={cls} className={`absolute w-4 h-4 border-emerald-300 rounded ${cls}`} />
            ))}
          </div>

          {/* Confidence bar */}
          <div className="px-4 mt-4">
            <div className="flex items-center justify-between text-[8px] text-emerald-100 mb-1">
              <span>Match score</span>
              <span className="font-bold">99.4%</span>
            </div>
            <div className="h-1 rounded-full bg-emerald-950/60 overflow-hidden">
              <div className="h-full w-[99%] rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300" />
            </div>
          </div>

          {/* Bottom button */}
          <div className="absolute bottom-3 left-3 right-3">
            <div className="py-2 rounded-xl bg-white text-emerald-700 text-[10px] font-bold text-center shadow-lg">
              ✓ Verified
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Payroll mockup ───────────────────────────────────────────────────
function PayrollMockup() {
  return (
    <div className="space-y-3">
      {/* Payslip */}
      <div className="rounded-2xl bg-white shadow-2xl shadow-emerald-950/10 border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white">
          <div className="text-[10px] uppercase tracking-wider opacity-80">Slip Gaji</div>
          <div className="font-bold text-sm">September 2026</div>
        </div>
        <div className="p-4 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Gaji Pokok</span>
            <span className="font-mono font-semibold text-slate-900">Rp 5.000.000</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Tunjangan</span>
            <span className="font-mono font-semibold text-emerald-600">+ Rp 1.200.000</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Lembur (8 jam)</span>
            <span className="font-mono font-semibold text-emerald-600">+ Rp 320.000</span>
          </div>
          <div className="border-t border-dashed border-slate-200 my-2" />
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">BPJS</span>
            <span className="font-mono font-semibold text-rose-500">- Rp 52.000</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">PTKP (S/0)</span>
            <span className="font-mono font-semibold text-rose-500">- Rp 132.000</span>
          </div>
          <div className="border-t border-slate-200 my-2" />
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-700 font-medium">Take Home</span>
            <span className="font-mono font-bold text-base bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
              Rp 6.336.000
            </span>
          </div>
        </div>
      </div>

      {/* Floating mini stat */}
      <div className="ml-auto w-fit px-3 py-2 rounded-xl bg-white shadow-xl shadow-emerald-950/10 border border-slate-100 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
          <Check className="w-4 h-4 text-emerald-600" strokeWidth={3} />
        </div>
        <div>
          <div className="text-[10px] text-slate-400 uppercase font-bold">Auto-calculated</div>
          <div className="text-xs font-semibold text-slate-900">80 karyawan · 2 detik</div>
        </div>
      </div>
    </div>
  )
}
