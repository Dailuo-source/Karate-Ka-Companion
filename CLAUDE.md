# Karate-Ka Companion — Brief

> **Claude: read this first.** Open only the files a change touches, and use the code map below to jump to a function instead of reading whole files.
> `index.html` is about 57 KB (~15k tokens): don't read it whole; search for a function name (e.g. `grep -n "function render" index.html`) and read just that function.
> At the end of a work session, update **Status** and add one line to **Changelog** (keep about 10).

Gary's private karate notebook. Dated notes typed Kata / Kihon / Kumite / Sensei says / Goals / General,
a page per kata (how it feels, fixed kiai count with a collapsible note per kiai, key reminders, every note on that kata) and a Goals tab.
Used on his Samsung phone (Chrome PWA). No photos (Gary's choice).

## Where things live

| Piece | Location |
| --- | --- |
| Live app | https://karate-ka-companion.pages.dev/ (Cloudflare Pages from `main`) |
| Database | Google Sheet **Karate-Ka Companion**, id `1i-PHNQd0pZOTOAUZvysY61XwsoartfMaU1Fb6Mn73OM`. Tabs: Notes, My kata, Access |
| Backend | Apps Script project "Karate-Ka Companion" bound to the sheet; source is `Code.gs` here. Web app version 4 (Execute as Gary, access Anyone), URL in `API_URL` in index.html |
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
- Notes tab: search, type chips, "Working on" (pinned), date filter (7 days / month / 3 months / any month),
  Newest/Oldest sort, grouped under date headings.
- Press feedback: `.tapping` dip + `.tapped` ring, replayed on the redrawn button (`replayTap`).
- Sync: optimistic op queue, batched, 60 s polling (same pattern as Climb Buddy / Pantry Pal).
- `?kata=<name>` opens that kata's page (for links from other apps).

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

## Status
- Working: live at karate-ka-companion.pages.dev, Gary signed in and using it.
- Next up: nothing pending.
- Kata tab: kata not on the dojo list (e.g. Boken no Kata) show under "My other kata" at the bottom.

## Changelog (latest first, keep about 10 lines)
- 2026-10-18: Kata tab grouped Solo / Multi-person / Weapon, then by belt (Category + Belt from the Kata Tracker sheet). Web app v4.
- 2026-10-18: Imported old Samsung Notes (33 notes, 18 kata pages) straight into the sheet
- 2026-10-18: Per-kiai notes on each kata page (collapsed by default, editable). Web app v3.
- 2026-10-18: First release; Google sign-in (Testing mode), moved to karate-ka-companion.pages.dev.

