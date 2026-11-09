import {describe, expect, it} from 'vitest'
import {createPuzzle, differenceAt, scoreFor} from './puzzle.ts'

describe('createPuzzle', ()=>{
    it('builds the same puzzle from the same seed', ()=>{
        expect(createPuzzle('abc')).toEqual(createPuzzle('abc'))
    })
})

describe('differenceAt', ()=>{
    it('finds a tap on a difference, and ignores the one that have been found already', ()=>{
        const pzl = createPuzzle('abc')
        const [id] = pzl.differences.keys()
        const {x,y} = pzl.shapes[id]
        expect(differenceAt(pzl, x, y, [])).toBe(id)
        expect(differenceAt(pzl, x, y, [id])).toBeNull()
    })
})

describe('scoreFor', ()=>{
    it('gives the time bonus under 90 seconds and no bonus after that', ()=>{
        expect(scoreFor({seconds: 60, wrongTaps: 0, hints: 0})).toBe(930)
        expect(scoreFor({seconds: 90, wrongTaps: 0, hints: 0})).toBe(750)
        expect(scoreFor({seconds: 300, wrongTaps: 0, hints: 0})).toBe(750)
    })

    it('takes off points for wrong taps and hints, even after 90 seconds', ()=>{
        expect(scoreFor({seconds: 60, wrongTaps: 1, hints: 0})).toBe(880)
        expect(scoreFor({seconds: 60, wrongTaps: 0, hints: 1})).toBe(830)
        expect(scoreFor({seconds: 300, wrongTaps: 2, hints: 1})).toBe(550)
    })

    it('never goes below 0', ()=>{
        expect(scoreFor({seconds: 300, wrongTaps: 20, hints: 5})).toBe(0)
    })
})