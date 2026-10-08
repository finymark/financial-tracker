import { useEffect, type RefObject } from 'react'

const focusableSelector =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'

/** Keep keyboard navigation inside a modal and restore focus when it closes. */
export function useDialogFocus(
  open: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  initialFocusRef: RefObject<HTMLElement | null>,
  fallbackFocusRef?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return
    const previous = document.activeElement
    const fallback = fallbackFocusRef?.current
    const focusInitial = () => {
      initialFocusRef.current?.focus()
      if (!dialog.contains(document.activeElement)) dialog.focus()
    }
    focusInitial()

    const isTopDialog = () =>
      Array.from(document.querySelectorAll('[role="dialog"]')).at(-1) === dialog
    const keepFocus = (event: FocusEvent) => {
      if (!isTopDialog()) return
      if (event.target instanceof Node && !dialog.contains(event.target)) {
        focusInitial()
      }
    }
    const trapTab = (event: KeyboardEvent) => {
      if (!isTopDialog()) return
      if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey)
        return
      const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.getClientRects().length > 0)
      const first = controls[0]
      const last = controls.at(-1)
      if (!first || !last) {
        event.preventDefault()
        dialog.focus()
      } else if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === dialog)
      ) {
        event.preventDefault()
        first.focus()
      }
    }
    dialog.addEventListener('keydown', trapTab)
    document.addEventListener('focusin', keepFocus)
    return () => {
      dialog.removeEventListener('keydown', trapTab)
      document.removeEventListener('focusin', keepFocus)
      if (
        previous instanceof HTMLElement &&
        previous !== document.body &&
        previous !== document.documentElement &&
        previous.isConnected &&
        !previous.matches(':disabled')
      )
        previous.focus()
      else fallback?.focus()
    }
  }, [open, dialogRef, initialFocusRef, fallbackFocusRef])
}
