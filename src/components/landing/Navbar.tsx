'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Menu, X, Globe, Fingerprint, ArrowRight } from 'lucide-react'

interface Props {
  t: {
    absen_web: string
    features: string
    pricing: string
    faq: string
    login: string
    cta: string
  }
  appName: string
  lang: 'id' | 'en'
  onToggleLang: () => void
}

export function Navbar({ t, appName, lang, onToggleLang }: Props) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const navLinks = [
    { href: '#features', label: t.features },
    { href: '#pricing', label: t.pricing },
    { href: '#faq', label: t.faq },
  ]

  // Transparent over dark hero → white text. White bg when scrolled → slate text.
  const onDark = !scrolled && !mobileOpen

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'backdrop-blur-xl bg-white/85 border-b border-slate-200/70 shadow-sm shadow-slate-900/5'
          : 'bg-transparent'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-5 sm:px-8 h-16 sm:h-20 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="relative">
            {/* Glow halo */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 blur-md opacity-50 group-hover:opacity-90 transition-opacity" />
            {/* Logo badge */}
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/40 ring-1 ring-white/30 transition-transform group-hover:scale-105">
              <Fingerprint className="w-5 h-5 text-white" strokeWidth={2.5} />
              {/* Live dot */}
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-white flex items-center justify-center">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping opacity-60" />
              </div>
            </div>
          </div>
          <div className="flex flex-col leading-none">
            <span className={`font-bold text-base sm:text-lg tracking-tight transition-colors ${onDark ? 'text-white' : 'text-slate-900'}`}>
              {appName}
            </span>
            <span className={`text-[9px] sm:text-[10px] font-semibold tracking-[0.15em] uppercase transition-colors mt-0.5 ${onDark ? 'text-teal-100/70' : 'text-slate-500'}`}>
              Absensi Digital
            </span>
          </div>
        </Link>

        {/* Desktop nav links — center pill */}
        <div
          className={`hidden lg:flex items-center gap-0.5 px-1.5 py-1.5 rounded-full transition-all duration-300 ${
            onDark
              ? 'bg-white/10 backdrop-blur-md border border-white/20 shadow-lg shadow-emerald-950/10'
              : 'bg-slate-100/80 border border-slate-200/70'
          }`}
        >
          <Link
            href="/absen"
            className={`px-3.5 py-1.5 text-sm font-medium rounded-full transition-all ${
              onDark
                ? 'text-white/90 hover:text-white hover:bg-white/15'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            {t.absen_web}
          </Link>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-full transition-all ${
                onDark
                  ? 'text-white/90 hover:text-white hover:bg-white/15'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Language toggle */}
          <button
            onClick={onToggleLang}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              onDark
                ? 'text-white/90 hover:bg-white/15 border border-white/20 backdrop-blur-md'
                : 'text-slate-700 hover:bg-slate-100 border border-transparent'
            }`}
            aria-label="Toggle language"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="uppercase tracking-wide">{lang === 'id' ? 'ID' : 'EN'}</span>
          </button>

          <Link
            href="/login"
            className={`hidden sm:inline-flex px-3.5 py-2 text-sm font-semibold transition-colors ${
              onDark ? 'text-white/90 hover:text-white' : 'text-slate-700 hover:text-teal-600'
            }`}
          >
            {t.login}
          </Link>
          <Link
            href="/register"
            className="group hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-sm font-semibold shadow-lg shadow-teal-500/30 hover:shadow-xl hover:shadow-teal-500/50 hover:-translate-y-0.5 transition-all ring-1 ring-white/20"
          >
            <span>{t.cta}</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className={`lg:hidden p-2 rounded-lg transition-colors ${
              onDark ? 'text-white hover:bg-white/15' : 'text-slate-700 hover:bg-slate-100'
            }`}
            aria-label="Menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-xl">
          <div className="px-5 py-4 space-y-1">
            <Link
              href="/absen"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t.absen_web}
            </Link>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={onToggleLang}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700"
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="uppercase">{lang === 'id' ? 'Bahasa Indonesia' : 'English'}</span>
                <span className="text-slate-400">→</span>
                <span className="text-teal-600 uppercase">{lang === 'id' ? 'English' : 'Indonesia'}</span>
              </button>
            </div>
            <div className="pt-3 grid grid-cols-2 gap-2">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="px-4 py-2.5 text-center rounded-lg border border-slate-200 text-sm font-semibold text-slate-700"
              >
                {t.login}
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileOpen(false)}
                className="px-4 py-2.5 text-center rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-sm font-semibold"
              >
                {t.cta}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
