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

describe('hintAreas', ()=>{
    const puzzles = Array.from({length: 50}, (_, i)=> createPuzzle(`seed-${i}`))

    it('gives every difference a quarter-size area that holds the whole shape inside the scene', ()=>{
        for (const pzl of puzzles) {
            expect([...pzl.hintAreas.keys()].sort()).toEqual([...pzl.differences.keys()].sort())
            for (const [id, area] of pzl.hintAreas) {
                const s = pzl.shapes[id]
                expect(area.width).toBe(pzl.width / 2)
                expect(area.height).toBe(pzl.height / 2)
                expect(area.x).toBeGreaterThanOrEqual(0)
                expect(area.y).toBeGreaterThanOrEqual(0)
                expect(area.x + area.width).toBeLessThanOrEqual(pzl.width)
                expect(area.y + area.height).toBeLessThanOrEqual(pzl.height)
                expect(s.x - s.r).toBeGreaterThanOrEqual(area.x)
                expect(s.y - s.r).toBeGreaterThanOrEqual(area.y)
                expect(s.x + s.r).toBeLessThanOrEqual(area.x + area.width)
                expect(s.y + s.r).toBeLessThanOrEqual(area.y + area.height)
            }
        }
    })

    it('rarely puts the difference in the middle of the area', ()=>{
        const areas = puzzles.flatMap((pzl)=> [...pzl.hintAreas].map(([id, area])=> ({s: pzl.shapes[id], area})))
        const centered = areas.filter(({s, area})=>
            Math.abs(area.x + area.width / 2 - s.x) < 5 && Math.abs(area.y + area.height / 2 - s.y) < 5)
        expect(centered.length).toBeLessThan(areas.length * 0.05)
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