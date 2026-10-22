# Karate-Ka Companion — Brief

> **Claude: read this first.** Open only the files a change touches; use the code map to jump to a function.
> `index.html` is ~57 KB: search for a function name (e.g. `grep -n "function render" index.html`) and read just that function.
> At the end of a work session, update **Status** and add one line to **Changelog** (keep about 5).

Gary's private karate notebook: dated notes (Kata / Kihon / Kumite / Sensei says / General) with markers (Goal, Working on, Follow up), a page per kata (feel, kiai count with a note per kiai, key reminders, its notes), a Goals tab and an Assignments tab. Samsung phone, Chrome PWA. No photos (Gary's choice).

## Where things live

| Piece | Location |
| --- | --- |
| Live app | https://karate-ka-companion.pages.dev/ (Cloudflare Pages from `main`) |
| Database | Google Sheet **Karate-Ka Companion**, id `1i-PHNQd0pZOTOAUZvysY61XwsoartfMaU1Fb6Mn73OM`. Tabs: Notes, Assignments, My kata, Access |
| Backend | Apps Script bound to the sheet; source is `Code.gs`. Web app version 6 (Execute as Gary, Anyone), URL in `API_URL` in index.html |
| Kata names | Read-only from the Kata Tracker sheet (`KATA_TRACKER_SHEET_ID`, tab "Kata"), cached 6 h |
| Setup guide | `SETUP.md` |

## Privacy (private to Gary's Google account)

- Google Identity Services sign-in (`CLIENT_ID` in index.html = script property `CLIENT_ID`). OAuth app is in **Testing** with Gary as only test user. To let someone in: add them as a test user, then Approve them. Publishing needs a home page + privacy link on the Branding page. Gary does console.cloud.google.com and dash.cloudflare.com himself.
- `Code.gs` checks the ID token with tokeninfo (audience must match), then issues its own 60-day session token (stored hashed). Every call re-checks the role.
- Owner = `Session.getEffectiveUser()`; no email is hard-coded in this public repo.
- Others get `no_access`; "Ask the owner" adds them to Access and emails Gary (max once a day each). Approved = view only (`read_only` on writes). The Access list only goes to the owner.

## App design rules (`index.html`, one file)

- Starts dark (`data-theme="dark"`); Light is a choice in the account panel (`kc.theme`). Midnight navy, periwinkle accent `#8C9BFF`, blush cheeks, one tint per note type (`--kata-f/--kata-i` etc.).
- Kawaii icons `ICONS`; onigiri-in-a-headband `mascot()`. App icon is the onigiri on periwinkle.
- Goals are a `goal` flag on any note, not a type (old "Goals" rows read as General + goal).
- Markers: Goal = gold star, solid gold pill. Working on = coral flame, solid coral pill (`pinned`, max 3 via `WORK_MAX`, top of Notes). Follow up = sky bell, dashed outline (`followUp`, `ask` Sensei/Senpai/Myself, `answered`).
- Assignments: own tab and sheet tab; only Sensei gives them (no "given by"). Steps one per line, `[x] ` = done. Grouped Overdue / This week / Later / No due date; overdue count = red dot on the tab.
- Note form: sticky Cancel + green **Save changes** ("Save note" when new). Ctrl+S saves, Esc cancels.
- Wide (≥1000px): sidebar (sections, New note, Note types with counts, Settings), list fills the width, docked non-modal right panel (no scrim; × leaves "Pick a note"). Unsaved edit blocks switching. Kata open in the same panel; panels opened from a kata return to it. Keys: N new note, / search.
- Kata tab: Solo, Multi-person, Weapon, then belt most advanced first (flip saved as `kc.ksort`). Kata not on the dojo list show under "My other kata".
- Kiai: `My kata` column "Kiai notes (one per line, in order)"; line N = kiai N; extras past the count are kept but hidden. "Kiai details" starts collapsed every time.
- Press feedback: `.tapping` dip + `.tapped` ring (`replayTap`).
- Sync: optimistic op queue, batched, 60 s polling.
- `?kata=<name>` opens that kata's page.
- Phone Back: one guard history entry; Back closes a panel, then the kata page, then returns to Notes; on Notes "Press back again to close".

## Changing things

- App files: edit, bump `CACHE` in `sw.js`, commit and push to `main`.
- Code.gs: paste into Apps Script, redeploy (Manage deployments → pencil → New version).
- New sheet column: `applyOp_` adds a missing column on first write; or run `setup` (adds missing headers only), then redeploy.
- Tests: `node test/backend.test.js` and `node test/e2e.js <shots dir>`.
- Commits use author `Claude <noreply@anthropic.com>`.

## Code map
API: op-batched like Pantry Pal, signed with a session token from Google sign-in.

| File | Lines | What's in it |
|---|---|---|
| `Code.gs` | 565 | `doGet`/`doPost`/`api`; privacy (`ownerEmail_`, `verifyIdToken_`, `newSession_`, `sessionEmail_`, `roleOf_`, `accessStatus_`, `requestAccess_`); data (`readAll_`, `applyOp_`, `kataList_`); menu (`onOpen`, `setup`, `setClientId`, `openApp`, `signOutAll`); `buildTab_` |
| `index.html` | 706 | theme pre-load (~15), CSS (~16–200), markup (~202–205), one `<script>` (~206–704) |
| `test/` | | `backend.test.js`, `e2e.js`, `mock.js` |

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
- Working: live and in use; notes, kata pages, markers, goals, assignments, Google sign-in. Web app v6, sw v9.
- Open: publishing the OAuth app needs a home page and privacy link on the Branding page.

## Changelog (latest first, keep about 5 lines)
- 2026-10-22: Trimmed this brief
- 2026-10-21: Assignments tab + sheet; Follow up marker; distinct markers. sw v9, web app v6
- 2026-10-20: Kata in the side panel on desktop; belt sort. sw v8
- 2026-10-20: Desktop layout with docked note panel. sw v7

## Working efficiently
- Find code with search first, then read only the relevant lines. Don't read index.html top to bottom.
- Make small, targeted edits. Never regenerate a whole file.
- Don't open a browser to test unless I ask. I'll test on my phone.
- No subagents unless I ask.
- One task per session. I'll /clear between tasks.
