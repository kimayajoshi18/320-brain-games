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

export type SurveyQuestion = { id: string; title: string; hint?: string } & (
  | { kind: 'games' }
  | { kind: 'choice'; options: SurveyOption[]; optional?: boolean; column?: 'play_time' | 'age_range' }
)

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
    title: 'When do you usually play?',
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

/** The profile column a question is saved to, with the value for the chosen option. */
export function columnValue(question: SurveyQuestion, answer: string | undefined): string | null {
  if (question.kind !== 'choice' || !answer) return null
  const option = question.options.find((o) => o.id === answer)
  return option ? (option.dbValue !== undefined ? option.dbValue : option.id) : null
}

/** How much the answers say the player struggles with a game. Higher means a better fit for the daily three. */
export function struggleScore(answers: Record<string, string>, game: GameId): number {
  let total = 0
  for (const q of SURVEY) {
    if (q.kind !== 'choice') continue
    total += q.options.find((o) => o.id === answers[q.id])?.weights?.[game] ?? 0
  }
  return total
}
