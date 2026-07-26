'use client'

import Link from 'next/link'

interface FooterColumn {
  title: string
  links: ReadonlyArray<string>
}

interface Props {
  t: {
    tagline: string
    columns: ReadonlyArray<FooterColumn>
    copyright: string
    made_in: string
  }
  appName: string
}

export function Footer({ t, appName }: Props) {
  return (
    <footer className="bg-slate-950 text-slate-300">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/30">
                <span className="text-white text-base font-bold">{appName[0]?.toUpperCase() ?? 'A'}</span>
              </div>
              <span className="font-bold text-lg text-white tracking-tight">{appName}</span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs">{t.tagline}</p>

            {/* Social */}
            <div className="flex gap-2 mt-5">
              {[
                { label: 'Instagram', icon: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z' },
                { label: 'Twitter', icon: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
                { label: 'LinkedIn', icon: 'M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z' },
              ].map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-teal-600 flex items-center justify-center transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-slate-300">
                    <path d={s.icon} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {t.columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-semibold text-white text-sm mb-3">{col.title}</h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link}>
                    <Link href="#" className="text-sm text-slate-400 hover:text-teal-400 transition-colors">
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row gap-4 justify-between items-center text-xs text-slate-500">
          <p>{t.copyright}</p>
          <p>{t.made_in}</p>
        </div>
      </div>
    </footer>
  )
}
