# TaskFlow

A Kanban task manager with drag-and-drop boards, built as a React 19 + TypeScript single-page app.

**[Live demo](https://taskflow-client-eta.vercel.app)** — sign in with `REPLACE_WITH_DEMO_EMAIL` / `REPLACE_WITH_DEMO_PASSWORD` to skip registration.

<!--
TODO before publishing:
  1. Replace REPLACE_WITH_DEMO_EMAIL / REPLACE_WITH_DEMO_PASSWORD above with the seeded read-only account.
  2. Replace REPLACE_WITH_API_DOCS_URL below with the deployed API documentation URL.
-->

> This is the front-end half of a two-repo project. The REST API it talks to lives in
> **[AtaMusleh/taskflow-api](https://github.com/AtaMusleh/taskflow-api)** —
> [live API docs](REPLACE_WITH_API_DOCS_URL). Nothing here is mocked; every board renders
> from that API.

## Features

- **Auth** — email/password sign-in and registration, access + refresh tokens, session restored on page load, guarded routes that remember the URL you were trying to reach.
- **Projects** — create, rename, and delete, each with a color and a live task count. Sidebar collapses to an icon rail on desktop and moves into a sheet below `md`.
- **Kanban board** — three columns with drag-and-drop reordering, both within a column and across columns. Cards carry a priority badge, due date (highlighted when overdue), and a truncated description.
- **Keyboard-operable dragging** — Tab to a card, Space to lift, arrows to move, Space to drop, Escape to cancel, with each step announced to screen readers.
- **Filters** — priority multi-select, due-date buckets (overdue, today, this week, none), and text search across titles and descriptions. Filter state lives in the URL, so a filtered board can be pasted to someone else.
- **States that aren't blank** — skeletons matching the final layout, distinct empty states for "no tasks yet" and "nothing matches these filters", and a retryable error state when the API is unreachable.
- **Light, dark, and system themes**, responsive from 375px up.

## Tech stack

| | |
|---|---|
| Framework | React 19, TypeScript 6 (`strict`, no `any`), Vite 8 |
| Data | TanStack Query 5, axios |
| Routing | React Router 8 |
| Forms | React Hook Form + Zod |
| Drag and drop | dnd-kit (`core` + `sortable`) |
| UI | Tailwind CSS 4, shadcn/ui on Radix primitives, lucide-react, sonner, next-themes |
| Dates | date-fns |
| Tooling | ESLint 10 with typescript-eslint and the React Compiler rules |

## Architecture

### Optimistic drag with snapshot-and-rollback

Dropping a card repaints instantly; the request happens behind it. In `useMoveTask`
(`src/lib/queries.ts`), `onMutate` first calls `cancelQueries` on that project's task key —
without it, a fetch already in flight can resolve *after* the optimistic write and replace the
board with a list that predates the move. It then snapshots the current task list into the
mutation context, writes the moved card into place, and returns the snapshot. `onError`
restores it verbatim; `onSettled` invalidates either way, so the server's ordering is always the
last word.

Create and delete use the same shape. Optimistically created cards carry an `optimistic-` id
prefix and are deliberately not draggable or editable until the real id arrives — a move
addressed to an id the API has never seen would only fail.

### The client sends neighbour ids, not a position

`PATCH /tasks/:id/move` takes `{ status, beforeId?, afterId? }` — the two cards the dragged one
landed between — and the server computes the actual position value. The alternative, having the
client compute a number, spreads ordering logic across every client and invites two people
reordering at once to derive the same position for different cards. Keeping that math on the
server means there is exactly one implementation of it, and rebalancing a saturated range is an
API concern the client never learns about.

The client does compute a position, but only as a throwaway: a midpoint between the two
neighbours' positions, used purely so the optimistic card sorts correctly for the second or two
before `onSettled` replaces it with the server's answer. Fractions are fine precisely because
the value never persists.

### Single-flight token refresh

An expired access token usually fails several requests at once — the board, the project, the
sidebar. Naively refreshing per failure means N concurrent `POST /auth/refresh` calls racing to
rotate the same token, and all but one losing.

`src/lib/api.ts` holds a module-level `refreshPromise`. The first 401 starts the refresh; every
other 401 arriving while it is in flight awaits that same promise. N failures produce one
refresh and N retries. Details that matter:

- The refresh call goes through a **separate axios instance with no interceptors**, so a 401 from
  `/auth/refresh` itself cannot recurse back into the handler.
- A `_retry` flag on the request config caps replays at one; a 401 on the replay means the fresh
  token is no good, and the session is cleared.
- `/auth/login`, `/auth/register`, and `/auth/refresh` are excluded — a 401 there is the answer,
  not a stale-token symptom. `/auth/me` is deliberately *not* excluded, because refreshing on its
  401 is exactly how a session is restored after the access token expires.

### Filters live in the URL

`src/lib/use-task-filters.ts` reads and writes `?priority=HIGH,MEDIUM&due=overdue&q=launch`
directly. There is no local mirror of the filter state — the query string *is* the state, so a
filtered view survives a refresh and can be shared as a link. Writes use `replace` so typing in
the search box doesn't push a history entry per keystroke.

Parsing is defensive: unknown priorities or due-date buckets in a hand-edited URL are dropped
rather than thrown on. The filter itself (`src/lib/task-filters.ts`) is a pure function taking an
injectable `now`, which keeps the relative date rules — "overdue", "this week" — testable without
mocking the clock.

## Running locally

This app is only the front end. **The API must be running and reachable**, either the deployed
instance or a local copy of [taskflow-api](https://github.com/AtaMusleh/taskflow-api).

Requires Node `^20.19.0 || >=22.12.0` (Vite 8).

```bash
git clone https://github.com/AtaMusleh/taskflow-client.git
cd taskflow-client
npm install

cp .env.example .env
# Point VITE_API_URL at the API, with no trailing slash:
#   VITE_API_URL=http://localhost:4000

npm run dev
```

The dev server runs on `http://localhost:5173`. `VITE_API_URL` is read at build time, so changing
`.env` requires a restart. If it is unset, every request resolves against the app's own origin and
fails.

| Script | |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) then production build |
| `npm run lint` | ESLint |
| `npm run preview` | Serve the production build locally |

## What I learned

**A scroll container only clips what it's the containing block for.** The board scrolled
horizontally on mobile, but so did the entire page — sidebar and top bar sliding along with it.
The cause was `sr-only`, which is `position: absolute`; with no positioned ancestor inside the
columns, those spans resolved against the document, escaped the scroller's clipping, and pushed
the page's scroll width to 881px on a 375px viewport. Adding `min-w-0` to the flex ancestors was
necessary but didn't fix it — a `relative` on the column did. I only found it by measuring
`document.scrollWidth` in a real browser at 375px; it is invisible to type-checking, linting, and
reading the code.

**dnd-kit reorders within a list for free, but not across lists.** Sorting inside one column needs
no state at all — `SortableContext` derives the transforms. Moving a card to a *different* column
needs it to actually exist there during the drag, so the board keeps a preview copy of the columns
for the duration of the gesture and discards it on drop, when the optimistic cache write takes
over.

**`undefined` and `null` are different words in a REST payload.** On create, an empty optional
field should be omitted — `JSON.stringify` drops `undefined`, so the key never reaches the wire.
On PATCH, omitting a key means "leave this as it was", so clearing a description has to send an
explicit `null` or the old value silently survives the save. The same form serialises the same
empty input two different ways depending on direction.

**Verifying is not the same as building.** Three separate rounds of "it compiles, it lints, it
builds" hid a page-level layout bug and a breakpoint where the sidebar squeezed three columns into
under 150px each and wrapped every card title. Both took ten minutes to find once I put the thing in a
browser with realistic data at the widths I claimed to support.
