import {
  useEffect,
  useId,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { CircleHelp } from 'lucide-react'
import type { MessageKey } from '../../i18n'

interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

interface Size {
  width: number
  height: number
}

export interface HelpTooltipPosition {
  left: number
  top: number
  placement: 'top' | 'bottom'
}

interface ViewportInsets {
  top?: number
}

interface HelpHintVisibility {
  open: boolean
  pinned: boolean
  hovered: boolean
}

type HelpHintVisibilityEvent =
  'pointerEnter' | 'pointerLeave' | 'focus' | 'activate' | 'dismiss'

export function helpHintVisibility(
  state: HelpHintVisibility,
  event: HelpHintVisibilityEvent,
): HelpHintVisibility {
  if (event === 'pointerEnter') return { ...state, open: true, hovered: true }
  if (event === 'pointerLeave')
    return { ...state, open: state.pinned, hovered: false }
  if (event === 'focus') return { ...state, open: true }
  if (event === 'activate')
    return state.pinned
      ? { ...state, open: false, pinned: false }
      : { ...state, open: true, pinned: true }
  return { ...state, open: false, pinned: false }
}

const VIEWPORT_PADDING = 8
const TOOLTIP_GAP = 8

function clamp(value: number, minimum: number, maximum: number) {
  return maximum < minimum
    ? minimum
    : Math.min(Math.max(value, minimum), maximum)
}

/** Place a fixed tooltip without covering its trigger or crossing a window edge. */
export function placeHelpTooltip(
  anchor: Rect,
  tooltip: Size,
  viewport: Size,
  insets: ViewportInsets = {},
): HelpTooltipPosition {
  const topEdge = Math.max(0, insets.top ?? 0) + VIEWPORT_PADDING
  const roomAbove = anchor.top - topEdge
  const roomBelow = viewport.height - anchor.bottom - VIEWPORT_PADDING
  const placement =
    roomAbove >= tooltip.height + TOOLTIP_GAP || roomAbove >= roomBelow
      ? 'top'
      : 'bottom'
  const idealTop =
    placement === 'top'
      ? anchor.top - tooltip.height - TOOLTIP_GAP
      : anchor.bottom + TOOLTIP_GAP
  return {
    left: clamp(
      (anchor.left + anchor.right - tooltip.width) / 2,
      VIEWPORT_PADDING,
      viewport.width - tooltip.width - VIEWPORT_PADDING,
    ),
    top: clamp(
      idealTop,
      topEdge,
      viewport.height - tooltip.height - VIEWPORT_PADDING,
    ),
    placement,
  }
}

function titleBarTopInset() {
  const titleBar = document.querySelector<HTMLElement>('.title-bar')
  const bottom = titleBar?.getBoundingClientRect().bottom ?? 0
  if (bottom > 0) return bottom
  const token = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(
      '--title-bar-height',
    ),
  )
  return Number.isFinite(token) && token > 0 ? token : 0
}

interface HelpHintProps {
  t(key: MessageKey): string
  topicKey: MessageKey
  textKey: MessageKey
}

export function HelpHint({ t, topicKey, textKey }: HelpHintProps) {
  const text = t(textKey)
  const descriptionId = useId()
  const tooltipId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [visibility, updateVisibility] = useReducer(helpHintVisibility, {
    open: false,
    pinned: false,
    hovered: false,
  })
  const { open } = visibility
  const [position, setPosition] = useState<HelpTooltipPosition | null>(null)

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const button = buttonRef.current
      const tooltip = tooltipRef.current
      if (!button || !tooltip) return
      setPosition(
        placeHelpTooltip(
          button.getBoundingClientRect(),
          tooltip.getBoundingClientRect(),
          { width: window.innerWidth, height: window.innerHeight },
          { top: titleBarTopInset() },
        ),
      )
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, text])

  useEffect(() => {
    if (!open) return
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      updateVisibility('dismiss')
    }
    window.addEventListener('keydown', dismiss, true)
    return () => window.removeEventListener('keydown', dismiss, true)
  }, [open])

  function close() {
    updateVisibility('dismiss')
  }

  return (
    <span
      className="inline-flex shrink-0 align-middle"
      onPointerEnter={() => updateVisibility('pointerEnter')}
      onPointerLeave={() => updateVisibility('pointerLeave')}
    >
      <button
        ref={buttonRef}
        type="button"
        data-help-hint={open ? 'open' : undefined}
        className="inline-grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label={`${t('help.accessibleName')}: ${t(topicKey)}`}
        aria-describedby={descriptionId}
        aria-expanded={open}
        onFocus={() => updateVisibility('focus')}
        onBlur={close}
        onClick={() => updateVisibility('activate')}
      >
        <CircleHelp aria-hidden="true" className="size-4" />
      </button>
      <span id={descriptionId} hidden>
        {text}
      </span>
      {open &&
        createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none fixed z-[100] w-max max-w-[min(20rem,calc(100vw-1rem))] rounded-md border bg-card px-3 py-2 text-sm font-normal text-card-foreground shadow-lg"
            style={
              position
                ? { left: position.left, top: position.top }
                : { left: 0, top: 0, visibility: 'hidden' }
            }
            data-placement={position?.placement}
          >
            {text}
          </div>,
          document.body,
        )}
    </span>
  )
}
