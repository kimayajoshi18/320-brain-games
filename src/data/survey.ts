import type { GameId } from './games.ts'

export interface SurveyOption {
  id: string
  label: string
  /** Shorter label for phones. */
  short?: string
  /** What is saved in the profile column when it differs from the id. */
  dbValue?: string | null
  /** How strongly this answer says the player struggles with each game. */
  weights?: Partial<Record<GameId, number>>
}

export type SurveyQuestion = { id: string; title: string; hint?: string; optional?: boolean; multiple?: boolean } & (
  | { kind: 'games' }
  | { kind: 'choice'; options: SurveyOption[]; column?: 'play_time' | 'age_range' }
)

/** Answers to the choice questions, by question id. The games question is kept in Onboarding.focus. */
export type SurveyAnswers = Record<string, string[]>

const frequency = (game: GameId): SurveyOption[] =>
  ['Rarely', 'Sometimes', 'Often', 'Almost every day'].map((label, weight) => ({
    id: label.toLowerCase().replace(/ /g, '-'),
    label,
    weights: { [game]: weight },
  }))

/** The login survey, in order. Add or edit a question here and the screen follows. */
export const SURVEY: SurveyQuestion[] = [
  {
    id: 'focus',
    kind: 'games',
    multiple: true,
    title: 'What do you want to train?',
    hint: "Pick any. We'll put these first in your daily three.",
  },
  {
    id: 'forget',
    kind: 'choice',
    title: 'How often do you forget things, like names or where you put your keys?',
    options: frequency('memory'),
  },
  {
    id: 'attention',
    kind: 'choice',
    title: 'How often do you lose focus on what you are doing?',
    options: frequency('colors'),
  },
  {
    id: 'numbers',
    kind: 'choice',
    title: 'How comfortable are you with numbers and puzzles?',
    options: [
      { id: 'very', label: 'Very comfortable', weights: { numbers: 0 } },
      { id: 'okay', label: 'Okay', weights: { numbers: 1 } },
      { id: 'not-very', label: 'Not very', weights: { numbers: 2 } },
    ],
  },
  {
    id: 'when',
    kind: 'choice',
    multiple: true,
    title: 'When do you usually play?',
    hint: 'Pick any. We use this to set your daily reminder.',
    column: 'play_time',
    options: [
      { id: 'commute', label: 'On my commute (offline)', short: 'On my commute' },
      { id: 'morning', label: 'Morning' },
      { id: 'evening', label: 'Evening' },
      { id: 'whenever', label: 'Whenever I remember', short: 'Whenever' },
    ],
  },
  {
    id: 'age',
    kind: 'choice',
    title: 'What is your age range?',
    hint: 'This one is optional.',
    optional: true,
    column: 'age_range',
    options: [
      { id: '13-17', label: '13 to 17' },
      { id: '18-24', label: '18 to 24' },
      { id: '25-34', label: '25 to 34' },
      { id: '35-54', label: '35 to 54' },
      { id: '55+', label: '55 and up' },
      { id: 'none', label: 'Prefer not to say', dbValue: null },
    ],
  },
]

/** The value to store in a profile column for a question, or undefined if it was not answered. */
export function columnValue(question: SurveyQuestion, answers: SurveyAnswers): string | null | undefined {
  if (question.kind !== 'choice') return undefined
  const picked = answers[question.id]?.[0]
  const option = question.options.find((o) => o.id === picked)
  if (!option) return undefined
  return option.dbValue !== undefined ? option.dbValue : option.id
}

/** The option of a multi-select choice question that comes first in the list, e.g. the earliest play time. */
export function firstPicked(question: SurveyQuestion, answers: SurveyAnswers): string | null {
  if (question.kind !== 'choice') return null
  return question.options.find((o) => answers[question.id]?.includes(o.id))?.id ?? null
}

/** How much the answers say the player struggles with a game. Higher means a better fit for the daily three. */
export function struggleScore(answers: SurveyAnswers, game: GameId): number {
  let total = 0
  for (const q of SURVEY) {
    if (q.kind !== 'choice') continue
    for (const o of q.options) if (answers[q.id]?.includes(o.id)) total += o.weights?.[game] ?? 0
  }
  return total
}
