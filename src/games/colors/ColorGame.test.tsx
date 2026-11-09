// Testing the Spot The Difference game screen
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { colorsPoints, HINT_PENALTY_SECONDS, MISTAKE_PENALTY_SECONDS } from '../../lib/scoring.ts'
import { createGuestState } from '../../state/store.ts'
import { TODAY } from '../../test/fixtures.ts'
import { renderWithApp } from '../../test/render.tsx'
import ColorGame from './ColorGame.tsx'
import { createPuzzle, differenceAt } from './puzzle.ts'

// jsdom has no SVG layout, so taps can't be turned into scene coordinates. This makes a tap's
// screen position the same as its scene position.
function mapTapsStraightToScene() {
  Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', {
    configurable: true,
    value: () => ({ inverse: () => ({}) }),
  })
  vi.stubGlobal(
    'DOMPoint',
    class {
      x: number
      y: number
      constructor(x: number, y: number) {
        this.x = x
        this.y = y
      }
      matrixTransform() {
        return this
      }
    },
  )
}

afterEach(() => {
  delete (SVGSVGElement.prototype as { getScreenCTM?: unknown }).getScreenCTM
  vi.unstubAllGlobals()
})

describe('ColorGame', () => {
  it('shows the hint as an area on both scenes, not a mark on the exact shape', async () => {
    const user = userEvent.setup()
    renderWithApp(<ColorGame />, { route: '/play/colors' })

    await user.click(screen.getByRole('button', { name: 'Hint' }))

    const hints = document.querySelectorAll('.scene-hint')
    expect(hints).toHaveLength(2)
    for (const hint of hints) {
      expect(hint.tagName).toBe('rect')
      expect(hint).toHaveAttribute('width', '200')
      expect(hint).toHaveAttribute('height', '150')
    }
  })

  it('saves the round with a wrong tap and a hint once every difference is found', async () => {
    mapTapsStraightToScene()
    const user = userEvent.setup()
    // A guest who hasn't played Colors today gets the daily puzzle, so the test can rebuild it.
    const { actions } = renderWithApp(<ColorGame />, { state: createGuestState(TODAY), route: '/play/colors' })
    const puzzle = createPuzzle(`colors:${TODAY}`)
    const sceneA = screen.getByRole('img', { name: /^Scene A/ })

    await user.click(screen.getByRole('button', { name: 'Hint' }))
    const empty = { x: 0, y: 0 }
    while (differenceAt(puzzle, empty.x, empty.y, []) !== null) empty.x += 10
    fireEvent.click(sceneA, { clientX: empty.x, clientY: empty.y })
    for (const id of puzzle.differences.keys()) {
      fireEvent.click(sceneA, { clientX: puzzle.shapes[id].x, clientY: puzzle.shapes[id].y })
    }

    await waitFor(() => expect(actions.recordResult).toHaveBeenCalledTimes(1), { timeout: 2000 })
    const result = vi.mocked(actions.recordResult).mock.calls[0][0]
    expect(result).toMatchObject({ gameId: 'colors', hintsUsed: 1, hintPenalty: HINT_PENALTY_SECONDS })
    // durationSec includes the penalty seconds; colorsPoints adds them itself.
    const clockSeconds = result.durationSec - MISTAKE_PENALTY_SECONDS - HINT_PENALTY_SECONDS
    expect(result.points).toBe(colorsPoints({ seconds: clockSeconds, wrongTaps: 1, hints: 1 }))
    expect(result.stats).toEqual(expect.arrayContaining(['1 wrong tap', '1 hint']))
  })
})
