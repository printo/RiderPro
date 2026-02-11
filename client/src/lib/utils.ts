import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Scroll the page so the element with the given id is in view.
 * Works when the scroll container is the window, documentElement, or an ancestor with overflow.
 */
export function scrollToElementId(id: string): void {
  const run = () => {
    const el = document.getElementById(id)
    if (!el) return

    const offset = 24
    const rect = el.getBoundingClientRect()

    // 1) Try scrollable ancestor (e.g. main content div with overflow-y: auto)
    let parent: HTMLElement | null = el.parentElement
    while (parent && parent !== document.body) {
      const { overflowY, overflow } = getComputedStyle(parent)
      if (/(auto|scroll|overlay)/.test(overflowY || overflow)) {
        const parentRect = parent.getBoundingClientRect()
        const targetScrollTop = parent.scrollTop + (rect.top - parentRect.top) - offset
        parent.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' })
        return
      }
      parent = parent.parentElement
    }

    // 2) Scroll window
    const top = window.scrollY + rect.top - offset
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })

    // 3) Fallback: scrollIntoView after a short delay (handles odd scroll containers)
    setTimeout(() => {
      const el2 = document.getElementById(id)
      if (el2) {
        const r = el2.getBoundingClientRect()
        if (r.top < 0 || r.top > window.innerHeight - 100) {
          el2.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    }, 150)
  }
  requestAnimationFrame(run)
}
