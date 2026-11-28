//Daily games 
//Testing streak and high score rules

import { describe, expect, it } from 'vitest'
import { COLORWORD_DAILY_FROM, dailyGames, GAME_IDS, SYMBOLS_DAILY_FROM, type GameId } from '../data/games.ts'
import { addDays } from '../lib/date.ts'
import { createGuestState, currentStreak, dailyCount, dailyDoneCount, rebuildFromResults, recordResult } from './store.ts'
import type { GameResult } from './types.ts'

const Today = '2026-11-23'
const result = (gameId: GameId, points = 100): GameResult =>({
    gameId, points, durationSec: 60, stats: [], highlight: String(points), playedAt: Today,
})

describe('recordResults', ()=>{
    it('counts only the first play of a game towards the daily count', ()=>{
        let st = createGuestState(Today)
        st = recordResult(st, result('colors', 100))
        st = recordResult(st, result('colors', 500))
        expect(st.todayResults.colors?.points).toBe(100)
        expect(st.gamesPlayed).toBe(2)
        expect(st.lastResult).toMatchObject({daily: false, newBest: true})
    })

    it('completes the day tracker once all the daily games have been played by the user', ()=>{
        let st = createGuestState(Today)
        for (const id of dailyGames(Today)) st = recordResult(st, result(id))
        expect(dailyDoneCount(st)).toBe(4)
        expect(st.completedDays).toEqual([Today])
        expect(currentStreak(st)).toBe(1)
    })

    it('does not complete the day until every daily game is played', ()=>{
        let st = createGuestState(Today)
        for (const id of dailyGames(Today).slice(0, -1)) st = recordResult(st, result(id))
        expect(st.completedDays).toEqual([])
        st = recordResult(st, result(dailyGames(Today).at(-1)!))
        expect(st.completedDays).toEqual([Today])
    })

    it('Keeps only the top three scores, with the highest score firest', ()=>{
        let st = createGuestState(Today)
        for (const pts of [100, 200, 300, 400]) st = recordResult(st, result('memory', pts))
        expect(st.topScores.memory.map((r)=>r.points)).toEqual([400, 300, 200])
    })
});

describe('adding Color & Word to the daily games', ()=>{
    const before = addDays(COLORWORD_DAILY_FROM, -1)
    const original: GameId[] = ['memory', 'numbers', 'colors']
    const play = (day: string, ids: GameId[]) => ids.map((id) => ({ ...result(id), playedAt: day, finishedAt: `${day}T12:00:00.000Z` }))

    it('finishes days before it joined with the original three games', ()=>{
        let st = createGuestState(before)
        expect(dailyCount(st)).toBe(3)
        for (const id of original) st = recordResult(st, result(id))
        expect(st.completedDays).toEqual([before])
    })

    it('needs all four games from the day it joined', ()=>{
        let st = createGuestState(COLORWORD_DAILY_FROM)
        expect(dailyCount(st)).toBe(4)
        for (const id of original) st = recordResult(st, result(id))
        expect(st.completedDays).toEqual([])
        st = recordResult(st, result('colorword'))
        expect(st.completedDays).toEqual([COLORWORD_DAILY_FROM])
    })

    it('treats Color & Word as practice on days before it joined', ()=>{
        const st = recordResult(createGuestState(before), result('colorword'))
        expect(st.lastResult?.daily).toBe(false)
        expect(dailyDoneCount(st)).toBe(0)
    })

    it('keeps a streak running across the day it joined when history is reloaded', ()=>{
        const results = [
            ...play(addDays(before, -1), original),
            ...play(before, original),
            ...play(COLORWORD_DAILY_FROM, GAME_IDS),
        ]
        const st = rebuildFromResults(createGuestState(COLORWORD_DAILY_FROM), results)
        expect(currentStreak(st)).toBe(3)
    })
})

describe('adding Symbol Recall to the daily games', ()=>{
    const before = addDays(SYMBOLS_DAILY_FROM, -1)
    const four: GameId[] = ['memory', 'numbers', 'colors', 'colorword']
    const play = (day: string, ids: GameId[]) => ids.map((id) => ({ ...result(id), playedAt: day, finishedAt: `${day}T12:00:00.000Z` }))

    it('finishes days before it joined with four games', ()=>{
        let st = createGuestState(before)
        expect(dailyCount(st)).toBe(4)
        for (const id of four) st = recordResult(st, result(id))
        expect(st.completedDays).toEqual([before])
    })

    it('needs all five games from the day it joined', ()=>{
        let st = createGuestState(SYMBOLS_DAILY_FROM)
        expect(dailyCount(st)).toBe(5)
        for (const id of four) st = recordResult(st, result(id))
        expect(st.completedDays).toEqual([])
        st = recordResult(st, result('symbols'))
        expect(dailyDoneCount(st)).toBe(5)
        expect(st.completedDays).toEqual([SYMBOLS_DAILY_FROM])
    })

    it('keeps a streak running across the day it joined when history is reloaded', ()=>{
        const results = [
            ...play(addDays(before, -1), four),
            ...play(before, four),
            ...play(SYMBOLS_DAILY_FROM, GAME_IDS),
        ]
        const st = rebuildFromResults(createGuestState(SYMBOLS_DAILY_FROM), results)
        expect(currentStreak(st)).toBe(3)
    })
})

describe ('currentStreak', ()=>{
    it('counts up the number of consecutive days with all the daily games played', ()=>{
        const st = {...createGuestState('2026-11-03'), completedDays: ['2026-10-31', '2026-11-01', '2026-11-02']}
        expect(currentStreak(st)).toBe(3)
    })

    it('streak resets if a day is missed', ()=>{
        const st = {...createGuestState('2026-11-03'), completedDays: ['2026-10-31', '2026-11-02']}
        expect(currentStreak(st)).toBe(1)
    })
})
