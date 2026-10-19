# Puzzlr frontend

Browser app for Puzzlr, built from the "Puzzlr Wireframes" design: three short brain games a day, streaks, a learning path, friends and a profile. It works on desktop and phones.

Built with React, TypeScript, React Router and Vite.

## Running it

You need Node 22.22 or newer.

```sh
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check and build to dist/
npm run lint
```

## Screens

| Wireframe        | Route           | File                          |
| ---------------- | --------------- | ----------------------------- |
| 01 Landing       | `/`             | `src/screens/Landing.tsx`     |
| 02 Onboarding    | `/onboarding`   | `src/screens/Onboarding.tsx`  |
| 03 Home          | `/home`         | `src/screens/Home.tsx`        |
| 06 Color game    | `/play/colors`  | `src/games/colors/`           |
| 07 Results       | `/results`      | `src/screens/Results.tsx`     |
| 08 Profile       | `/profile`      | `src/screens/Profile.tsx`     |
| 09 Friends       | `/friends`      | `src/screens/Friends.tsx`     |
| 10 Learning path | `/path`         | `src/screens/LearningPath.tsx`|

Each screen has a desktop layout and a phone layout (below 760px wide), matching the two frames in the wireframes.

## What's real and what's mocked

There's no backend yet, so a few things are stand-ins:

- **Google sign-in is fake.** "Continue with Google" or "Log in" signs you in as a demo player, Sam R., with a 12-day streak and some scores. Anything you did as a guest is kept when you sign in.
- **Saving.** Signed-in progress is stored in `localStorage`. Guest progress only lasts for the browser tab, matching "progress isn't saved until they sign in". To start over, clear the site's storage.
- **Friends** on the leaderboard are made-up data in `src/data/mock.ts`.
- **Memory and Numbers** don't have wireframes yet. Their screens are placeholders with a "Finish with a sample score" button so the rest of the flow can be tried.
- **"Why this helps"** text on the results screen still needs real sources.
- **Not built yet:** working offline, sending reminders, and sending invites to contacts.

Spot The Difference is fully playable. Wrong taps add 3 seconds, hints add 5, and you can't fail. Everyone gets the same puzzle each day; practice rounds get a new one.

## Layout of `src/`

```
components/   shared layout: app shell and nav, game header, week bar, game art
data/         game catalog, achievements, mock data
games/        Spot The Difference and the placeholder for unbuilt games
lib/          date, formatting and seeded-random helpers
screens/      one file (plus CSS) per screen
state/        app state: types, pure store functions, React provider
styles/       design tokens and shared button/panel styles
```

Game rules live in `src/state/store.ts` as plain functions (no React), so they're easy to test or move to a server later: what counts toward the daily three, streaks, top scores, and merging guest progress on sign-in.
