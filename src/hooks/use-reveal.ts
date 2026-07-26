'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Reveal element when it enters viewport.
 * Returns a ref + isVisible flag. Mounts an IntersectionObserver on first paint.
 *
 * Usage:
 *   const ref = useReveal<HTMLDivElement>()
 *   return <div ref={ref} className={...}>...</div>
 *
 * Pair with `.reveal` CSS class for fade+slide-up animation.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(options?: {
  threshold?: number
  rootMargin?: string
  once?: boolean
}) {
  const { threshold = 0.15, rootMargin = '0px 0px -10% 0px', once = true } = options ?? {}
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    // Respect reduced motion preference — show immediately.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          if (once) observer.disconnect()
        } else if (!once) {
          setVisible(false)
        }
      },
      { threshold, rootMargin },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold, rootMargin, once])

  return { ref, visible }
}
