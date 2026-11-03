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
    it('gives the time bonus under 90 seconds and never goes under the base', ()=>{
        expect(scoreFor(60)).toBe(930)
        expect(scoreFor(90)).toBe(750)
        expect(scoreFor(300)).toBe(750)
    })
})