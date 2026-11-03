//Daily three games 
//Testing streak and high score rules

import { describe, expect, it } from 'vitest'
import { GAME_IDS, type GameId } from '../data/games.ts'
import { createGuestState, currentStreak, dailyDoneCount, recordResult } from './store.ts'
import type { GameResult } from './types.ts'

const Today = '2026-11-02'
const result = (gameId: GameId, points = 100): GameResult =>({
    gameId, points, durationSec: 60, stats: [], highlight: String(points), playedAt: Today,
})

describe('recordResults', ()=>{
    it('counts only the first play of a game towards the daily three count', ()=>{
        let st = createGuestState(Today)
        st = recordResult(st, result('colors', 100))
        st = recordResult(st, result('colors', 500))
        expect(st.todayResults.colors?.points).toBe(100)
        expect(st.gamesPlayed).toBe(2)
        expect(st.lastResult).toMatchObject({daily: false, newBest: true})
    })

    it('completes the day tracker once all the three games have been played by the user', ()=>{
        let st = createGuestState(Today)
        for (const id of GAME_IDS) st = recordResult(st, result(id))
        expect(dailyDoneCount(st)).toBe(3)
        expect(st.completedDays).toEqual([Today])
        expect(currentStreak(st)).toBe(1)
    })

    it('Keeps only the top three scores, with the highest score firest', ()=>{
        let st = createGuestState(Today)
        for (const pts of [100, 200, 300, 400]) st = recordResult(st, result('memory', pts))
        expect(st.topScores.memory.map((r)=>r.points)).toEqual([400, 300, 200])
    })
});

describe ('currentStreak', ()=>{
    it('counts up the number of consecutive days with all three games played', ()=>{
        const st = {...createGuestState('2026-11-03'), completedDays: ['2026-10-31', '2026-11-01', '2026-11-02']}
        expect(currentStreak(st)).toBe(3)
    })

    it('streak resets if a day is missed', ()=>{
        const st = {...createGuestState('2026-11-03'), completedDays: ['2026-10-31', '2026-11-02']}
        expect(currentStreak(st)).toBe(1)
    })
})
