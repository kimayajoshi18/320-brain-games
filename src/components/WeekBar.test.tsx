//Testing what the user sees and does in the week bar component
import {render, screen} from '@testing-library/react'
import { expect, it } from 'vitest'
import WeekBar from './WeekBar.tsx'

//describe('WeekBar', ()=>{
    
//})

it('displays the days of the week with the correct done/not done status', ()=>{
        render(<WeekBar days={[true, false, true, false, false, true, true]} />)
        expect(screen.getAllByRole('listitem')).toHaveLength(7)
        expect(screen.getByLabelText('Monday: done')).toBeInTheDocument()
        expect(screen.getByLabelText('Tuesday: not done')).toBeInTheDocument()
        expect(screen.getByLabelText('Wednesday: done')).toBeInTheDocument()
        expect(screen.getByLabelText('Thursday: not done')).toBeInTheDocument()
        expect(screen.getByLabelText('Friday: not done')).toBeInTheDocument()
        expect(screen.getByLabelText('Saturday: done')).toBeInTheDocument()
        expect(screen.getByLabelText('Sunday: done')).toBeInTheDocument()
    })