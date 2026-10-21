# Karate-Ka Companion — Brief

> **Claude: read this first.** Open only the files a change touches, and use the code map below to jump to a function instead of reading whole files.
> `index.html` is about 57 KB (~15k tokens): don't read it whole; search for a function name (e.g. `grep -n "function render" index.html`) and read just that function.
> At the end of a work session, update **Status** and add one line to **Changelog** (keep about 10).

Gary's private karate notebook. Dated notes typed Kata / Kihon / Kumite / Sensei says / General; any note can carry markers
(Goal, Working on, Follow up), a page per kata (how it feels, fixed kiai count with a collapsible note per kiai, key reminders,
every note on that kata), a Goals tab and an Assignments tab.
Used on his Samsung phone (Chrome PWA). No photos (Gary's choice).

## Where things live

| Piece | Location |
| --- | --- |
| Live app | https://karate-ka-companion.pages.dev/ (Cloudflare Pages from `main`) |
| Database | Google Sheet **Karate-Ka Companion**, id `1i-PHNQd0pZOTOAUZvysY61XwsoartfMaU1Fb6Mn73OM`. Tabs: Notes, Assignments, My kata, Access |
| Backend | Apps Script project "Karate-Ka Companion" bound to the sheet; source is `Code.gs` here. Web app version 5 (Execute as Gary, access Anyone), URL in `API_URL` in index.html |
| Kata names | Read-only from the dojo Kata Tracker sheet (`KATA_TRACKER_SHEET_ID`, tab "Kata"), cached 6 h |
| Setup guide | `SETUP.md` |

## Privacy model (Gary's requirement: private to his Google account)

- The app signs in with Google Identity Services (`CLIENT_ID` in index.html, same ID in script property `CLIENT_ID`).
  OAuth client lives in Google Cloud project "Karate-Ka Companion" (Gary's account). It is in **Testing** mode with
  Gary as the only test user, so other accounts are blocked by Google before reaching the app. To let someone in:
  add them as a test user, then Approve them. Publishing needs a home page + privacy link on the Branding page.
  The Claude extension can't open console.cloud.google.com or dash.cloudflare.com; Gary does those.
- `Code.gs` verifies the ID token with Google's tokeninfo endpoint (audience must match), then hands out
  its own 60-day session token (stored hashed in script properties). Every call re-checks the role.
- Owner = the account the script runs as (`Session.getEffectiveUser()`), so no email is hard-coded in this public repo.
- Anyone else gets `no_access` and no data. "Ask the owner" adds them to the Access tab and emails Gary (max once a day each).
  Approved = view only (`read_only` on any write); the Access list is only ever sent to the owner.

## App structure (`index.html`, one file)

- Starts dark (`data-theme="dark"`), Light is a choice in the account panel (`kc.theme`).
- Palette: midnight navy ground, periwinkle accent `#8C9BFF`, blush cheeks, one soft tint per note type
  (`--kata-f/--kata-i` etc., light versions in `[data-theme=light]`).
- Kawaii icons: `ICONS` (scroll, belt ball, glove, speech bubble, star, notebook, all with faces) and the
  onigiri-in-a-headband `mascot()` (happy / sleepy / stern). App icon is the same onigiri on periwinkle.
- Goals (Gary, Oct 20): not a note type any more. `goal` flag on any note ("Mark as a goal" switch in the form, ★ Goal badge on cards); Goals tab lists flagged notes. Old "Goals" rows read as General + goal; `setup` → `migrateGoals_` rewrites them in the sheet.
- Markers (Gary, Oct 21): each has its own symbol, colour and shape. Goal = gold star, solid gold pill. Working on = coral flame,
  solid coral pill (`pinned`, max 3 via `WORK_MAX`, coral cards at the top of Notes). Follow up = sky bell, dashed outline
  (`followUp`, `ask` Sensei/Senpai/Myself, `answered`; dashed strip under Working on with a tick button). Mockup: Karate Notes
  mock-up canvas, boards 11–15.
- Assignments (Gary, Oct 21): own tab (4th) and sheet tab. Only Sensei gives them, so there is no "given by" field. Title, kata,
  given, due, steps (one per line, `[x] ` = done; `parseSteps`/`serSteps`), notes, `noteId` (made from a note via "Turn into an
  assignment"). Grouped Overdue / This week / Later / No due date, To do / Done toggle (`asView`). Lavender clipboard, square due tag;
  overdue count shows as a red dot on the tab. Panels: `assignSheet`, `assignForm`, `saveAssign`.
- Note form ends in a sticky bar: Cancel + green **Save changes** ("Save note" when new). Ctrl+S saves, Esc cancels.
- Wide screens (≥1000px, Gary Oct 20): sidebar with brand, sections, **New note**, **Note types** (with counts; replace the chips) and **Settings** at the bottom. The list fills the width between the sidebar and a docked right panel (`--pane`). The panel is not modal: no scrim, the list stays clickable, clicking another note replaces it, × leaves a "Pick a note" placeholder (`paneEmpty`, `markActive`, `wide()`). An unsaved edit blocks switching ("Save or cancel your changes first"). Kata rows open the kata page in the same panel (`kataPage(name,true)`, sheet type `kata`); notes, reminders and kiai panels opened from it carry `back` and return to the kata when closed. Kata actions read `curKata()`. Keys: N new note, / search.
- Kata tab sort (Gary, Oct 20): Solo, Multi-person, Weapon, then belt **most advanced first** by default; the sort button flips to beginner first (`kataSort`, saved as `kc.ksort`). Unknown belts stay last.
- Notes tab: search, type chips, "Working on" (pinned), date filter (7 days / month / 3 months / any month),
  Newest/Oldest sort, grouped under date headings.
- Press feedback: `.tapping` dip + `.tapped` ring, replayed on the redrawn button (`replayTap`).
- Sync: optimistic op queue, batched, 60 s polling (same pattern as Climb Buddy / Pantry Pal).
- `?kata=<name>` opens that kata's page (for links from other apps).
- Phone Back: one guard history entry (`guardBack`, `popstate` handler) so Back closes a panel, then the kata page, then returns to Notes; on Notes it asks "Press back again to close".

## Changing things

- App files: edit, bump `CACHE` in `sw.js`, commit and push to `main`.
- Code.gs: paste into Apps Script and redeploy (Manage deployments → pencil → New version).
- Tests: `node test/backend.test.js` and `node test/e2e.js <shots dir>` (Node mock of Apps Script + Playwright,
  Google sign-in stubbed).
- Commits use author `Claude <noreply@anthropic.com>`.

## Code map
API: op-batched like Pantry Pal, signed with a session token from Google sign-in.

| File | Lines | What's in it |
|---|---|---|
| `Code.gs` | 565 | `doGet`/`doPost`/`api`; privacy (`ownerEmail_`, `verifyIdToken_`, `newSession_`, `sessionEmail_`, `roleOf_`, `accessStatus_`, `requestAccess_`); data (`readAll_`, `applyOp_`, `kataList_` from the Kata Tracker sheet); menu (`onOpen`, `setup`, `setClientId`, `openApp`, `signOutAll`); `buildTab_` |
| `index.html` | 706 | theme pre-load (line ~15), CSS (~16–200), markup (~202–205), one `<script>` (~206–704) |
| `test/` | | `backend.test.js`, `e2e.js`, `mock.js` (Apps Script mock) |

Inside the `index.html` script, search for:
- Sync and cache: `callApi`, `enqueue`, `flush`, `handle`, `normalize`, `saveCache`, `loadCache`, `boot`
- Sign-in: `loadGis`, `initGis`, `drawGis`, `signIn`, `signOut`, `wipeLocal`, `authScreen`
- Layout and theme: `render`, `header`, `nav`, `applyTheme`, `ICONS`, `mascot`
- Notes: `viewNotes`, `notesList`, `noteCard`, `filtered`, `inDate`, `noteSheet`, `saveNote`, `dateSheet`
- Kata: `upsertKata`, `kataNames`, `viewKataList`, `kataRows`, `kataPage`
- Goals: `viewGoals`
- Markers: `marks`, `MK`, `workCount`, `ASKS`, `askLbl`
- Assignments: `viewAssignments`, `asCard`, `assignSheet`, `assignForm`, `saveAssign`, `parseSteps`, `dueLabel`
- Panels: `openSheet`, `renderSheet`, `formSheet`, `remSheet`, `accountSheet`, `toast`
- Tap feedback: `tapKey`, `replayTap`

## Status
- Working: notes, kata pages, goals, Google sign-in private to Gary's account; web app version 2.
- Open: publishing the OAuth app (to let others in without test-user setup) needs a home page and privacy link on the Branding page.

## Changelog (latest first, keep about 10 lines)
- 2026-10-18: Turned the handoff notes into a brief (read-first rules, code map, status, changelog)
- 2026-10-18: Note web app version 2
- 2026-10-18: Use the real Cloudflare address karate-ka-companion.pages.dev
- 2026-10-18: Note sign-in setup in handoff
- 2026-10-18: Add Google sign-in client ID
- 2026-10-18: Connect the app to the live Apps Script web app
- 2026-10-18: Karate-Ka Companion: private karate notebook

## Kiai notes
- `My kata` column "Kiai notes (one per line, in order)": line N = kiai N. Notes past the current count are kept, just hidden.
- On the kata page "Kiai details" starts collapsed every time (`kiaiOpen`, not saved) and opens to a numbered list; owner gets "Edit kiai notes".
- Adding a sheet column: run `setup` once in Apps Script (it only adds missing headers), then redeploy a New version.
  Since Oct 21 `applyOp_` also adds a missing column itself the first time the app writes to it.

## Status
- Working: live at karate-ka-companion.pages.dev, Gary signed in and using it.
- Next up: nothing pending.
- Kata tab: kata not on the dojo list (e.g. Boken no Kata) show under "My other kata" at the bottom.

## Changelog (latest first, keep about 10 lines)
- 2026-10-21: Assignments tab + sheet; Follow up marker; distinct Goal / Working on / Follow up markers. sw v9. Needs web app redeploy.
- 2026-10-20: Kata open in the side panel on desktop; belt sort (most advanced first, flippable). sw v8.
- 2026-10-20: Desktop: full width, docked non-modal note panel, note types + Settings in the sidebar. sw v7.
- 2026-10-20: Goal is a flag on any note (Goals type removed, migrated by setup), sticky Save changes bar, desktop layout. Web app v5.
- 2026-10-19: Phone Back button steps back inside the app instead of closing it
- 2026-10-18: Kata tab grouped Solo / Multi-person / Weapon, then by belt (Category + Belt from the Kata Tracker sheet). Web app v4.
- 2026-10-18: Imported old Samsung Notes (33 notes, 18 kata pages) straight into the sheet
- 2026-10-18: Per-kiai notes on each kata page (collapsed by default, editable). Web app v3.
- 2026-10-18: First release; Google sign-in (Testing mode), moved to karate-ka-companion.pages.dev.

