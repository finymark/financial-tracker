import { describe, expect, test } from 'vitest'
import { helpHintVisibility, placeHelpTooltip } from './help-hint'

const tooltip = { width: 240, height: 96 }
const viewport = { width: 800, height: 600 }

describe('placeHelpTooltip', () => {
  test('places the tooltip above the control when there is room', () => {
    expect(
      placeHelpTooltip(
        { left: 380, top: 300, right: 400, bottom: 320 },
        tooltip,
        viewport,
      ),
    ).toEqual({ left: 270, top: 196, placement: 'top' })
  })

  test('flips below a control near the top edge', () => {
    expect(
      placeHelpTooltip(
        { left: 380, top: 20, right: 400, bottom: 40 },
        tooltip,
        viewport,
      ),
    ).toEqual({ left: 270, top: 48, placement: 'bottom' })
  })

  test('treats the title bar as a top viewport inset', () => {
    expect(
      placeHelpTooltip(
        { left: 380, top: 100, right: 400, bottom: 120 },
        { width: 240, height: 50 },
        viewport,
        { top: 36 },
      ),
    ).toEqual({ left: 270, top: 128, placement: 'bottom' })
  })

  test('shifts horizontally to stay inside the viewport', () => {
    expect(
      placeHelpTooltip(
        { left: 2, top: 300, right: 22, bottom: 320 },
        tooltip,
        viewport,
      ),
    ).toEqual({ left: 8, top: 196, placement: 'top' })

    expect(
      placeHelpTooltip(
        { left: 780, top: 300, right: 800, bottom: 320 },
        tooltip,
        viewport,
      ),
    ).toEqual({ left: 552, top: 196, placement: 'top' })
  })

  test('clamps an oversized tooltip within every viewport edge', () => {
    expect(
      placeHelpTooltip(
        { left: 5, top: 10, right: 25, bottom: 30 },
        { width: 500, height: 400 },
        { width: 320, height: 200 },
      ),
    ).toEqual({ left: 8, top: 8, placement: 'bottom' })
  })
})

describe('helpHintVisibility', () => {
  test('pins on first activation and closes on second activation', () => {
    const hovered = helpHintVisibility(
      { open: false, pinned: false, hovered: false },
      'pointerEnter',
    )
    const pinned = helpHintVisibility(hovered, 'activate')
    expect(pinned).toEqual({ open: true, pinned: true, hovered: true })
    expect(helpHintVisibility(pinned, 'activate')).toEqual({
      open: false,
      pinned: false,
      hovered: true,
    })
  })

  test('reopens when the pointer leaves and hovers again after dismissal', () => {
    const dismissed = helpHintVisibility(
      { open: true, pinned: false, hovered: true },
      'dismiss',
    )
    const left = helpHintVisibility(dismissed, 'pointerLeave')
    expect(helpHintVisibility(left, 'pointerEnter')).toEqual({
      open: true,
      pinned: false,
      hovered: true,
    })
  })
})
