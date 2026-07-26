import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import GlobalErrorSuppressor from "@/components/GlobalErrorSuppressor";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AbsenKu — Sistem Absensi Digital GPS & Selfie AI untuk Bisnis Indonesia",
  description:
    "Platform absensi karyawan berbasis GPS + verifikasi wajah AI. Anti fake GPS, payroll otomatis (PTKP/BPJS/THR), multi-shift, dan laporan real-time. Gratis 30 hari, tanpa kartu kredit.",
  keywords: [
    "absensi online",
    "absensi digital",
    "absensi karyawan",
    "absensi GPS",
    "absen selfie",
    "payroll otomatis",
    "anti fake GPS",
    "HRIS Indonesia",
    "AbsenKu",
  ],
  authors: [{ name: "AbsenKu" }],
  openGraph: {
    type: "website",
    locale: "id_ID",
    title: "AbsenKu — Absensi Digital GPS & Selfie AI",
    description:
      "Sistem absensi anti-curang dengan verifikasi wajah + GPS. Payroll otomatis, laporan real-time. Dipakai 200+ perusahaan di Indonesia.",
    siteName: "AbsenKu",
  },
  twitter: {
    card: "summary_large_image",
    title: "AbsenKu — Absensi Digital GPS & Selfie AI",
    description:
      "Sistem absensi anti-curang dengan verifikasi wajah + GPS. Dipakai 200+ perusahaan di Indonesia.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          window.onerror = function(msg, src, line, col, err) {
            if (typeof msg === 'string' && (msg.includes('conversation_id') || msg.includes('Cannot destructure property'))) return true;
            return false;
          };
          window.addEventListener('unhandledrejection', function(e) {
            var msg = e && e.reason && (e.reason.message || String(e.reason));
            if (msg && (msg.includes('conversation_id') || msg.includes('Cannot destructure property'))) e.preventDefault();
          });
        ` }} />
      </head>
      <body className="min-h-full flex flex-col">
        <GlobalErrorSuppressor />
        {children}
      </body>
    </html>
  );
}
