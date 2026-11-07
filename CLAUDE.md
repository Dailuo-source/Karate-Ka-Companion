# Karate-Ka Companion — Brief

> **Claude: read this first.** Open only the files a change touches; use the code map to jump to a function.
> `web/index.html` is ~57 KB: search for a function name (e.g. `grep -n "function render" web/index.html`) and read just that function.
> At the end of a work session, update **Status** and add one line to **Changelog** (keep about 5). Keep **For Gary** current too: tick off (delete) what's done, add each step Gary must do himself (deploy, sheet menus, settings, checks). App Atlas reads Status, For Gary and Changelog to show where each app is.

Gary's private karate notebook. Tabs (Nov 2026 redesign, sorted by how long he needs a thing): **Now** (home: what to work on next class), **Notes** (dated, list or calendar, monthly review), **Kata** (a page per kata: feel, kiais, key reminders, its notes), **Assignments** (only from Sensei), **Keep in mind** (long-term goals and lessons). Samsung phone, Chrome PWA. No photos (Gary's choice). Approved mockup: Design canvas "Karate-Ka Companion redesign" in the App Creation project.

## Where things live

| Piece | Location |
| --- | --- |
| Live app | https://karate-ka-companion.pages.dev/ (Cloudflare Pages from `main`, build output directory `web`, so only `web/` is published) |
| Database | Google Sheet **Karate-Ka Companion**, id `1i-PHNQd0pZOTOAUZvysY61XwsoartfMaU1Fb6Mn73OM`. Tabs: Notes, Assignments, My kata, Access. Notes columns added Nov 2026: **Keep in mind**, **Month review (YYYY-MM)** |
| Backend | Apps Script bound to the sheet; source is `Code.gs`. Web app version 6 (Execute as Gary, Anyone), URL in `API_URL` in index.html |
| Kata names | Read-only from the Kata Tracker sheet (`KATA_TRACKER_SHEET_ID`, tab "Kata"), cached 6 h |
| Notifications | Push sender: Cloudflare Pages Function `functions/push/[[path]].js` (copied from Home-and-Hobby; `/push/keys`, `/push/send`, stateless). Scheduler: Apps Script `pushTick` every 5 min, started by menu **Turn on notifications**. VAPID keys in Script properties `VAPID_PUBLIC`/`VAPID_PRIVATE`, `PUSH_ON`=1 when on; settings JSON in `NOTIFY`. Tabs **Devices** (phones, owner only) and **Sent** (log; its Tag stops repeats; never sent to the app) |
| Setup guide | `SETUP.md` |

## Privacy (private to Gary's Google account)

- Google Identity Services sign-in (`CLIENT_ID` in index.html = script property `CLIENT_ID`). OAuth app is in **Testing** with Gary as only test user. To let someone in: add them as a test user, then Approve them. Publishing needs a home page + privacy link on the Branding page. Gary does console.cloud.google.com and dash.cloudflare.com himself.
- `Code.gs` checks the ID token with tokeninfo (audience must match), then issues its own 60-day session token (stored hashed). Every call re-checks the role.
- Owner = `Session.getEffectiveUser()`; no email is hard-coded in this public repo.
- Others get `no_access`; "Ask the owner" adds them to Access and emails Gary (max once a day each). Approved = view only (`read_only` on writes). The Access list only goes to the owner.

## App design rules (`index.html`, one file)

- Starts dark (`data-theme="dark"`); Light is a choice in the account panel (`kc.theme`). Midnight navy, periwinkle accent `#8C9BFF`, blush cheeks, one tint per note type (`--kata-f/--kata-i` etc.).
- Kawaii icons `ICONS`; onigiri-in-a-headband `mascot()`. App icon is the onigiri on periwinkle.
- Notes are **point form only**: the Note column holds one point per line (`toPoints` also splits old prose by line and sentence for display/editing). A note can be on **several kata**: Kata column = "Bassai Dai, Bassai Sho" (`kataOf`, `hasKata`).
- **Now** = `pinned` notes (tag *Practice*), open follow-ups (`followUp` && !`answered`, tag *Ask*, `ask` Sensei/Senpai/Myself) and assignments due within 14 days (tag *From Sensei*). No limit (WORK_MAX removed, Gary Nov 3). Rows expand (chevron) to show points; the small box on the right ticks them off (`now-done` → pinned false, `answer`, `as-done`). A practice item untouched for 35 days asks "Still on it?" (Yes / Move to Keep).
- **Keep in mind** = goals (`goal`, box = reached → `done`) and lessons (`keep`, box = second nature → keep false). Lessons grouped by kata, then General.
- Note form ends with **Where should this go?**: Just a note / Now (Practice or A question to ask) / Keep in mind (A lesson or A goal) / Assignment (saves, then opens the assignment form linked to the note).
- **Month review** (Notes → "October review" button by each month): last month's takeaway, wins (goals reached, assignments done, questions answered), still working on, Sensei's points, notes by kata, and an editable takeaway saved as a Notes row with `review` = "YYYY-MM" (kept in `S.reviews`, never listed as a note). No counts or metrics (Gary's choice).
- **Notifications**: bell on Now (and in the sidebar / Account panel) → `notifySheet`: this phone (Turn on / Send test / Turn off), class days + start/end times, Before class (Now list), After class (write notes, skipped if a note exists that day), Assignment due (days before + time), Long-running Now items (weekly), Month in review (1st), quiet hours. Every change saves straight away (`saveNotify` → `notify` in the next request). Tapping a notification opens its screen (`openLink`: now · new · a:<id> · review:YYYY-MM).
- Phone: big action button fixed above the tab bar ("Write today's notes" / "New note" / "New assignment" / "Add to Keep in mind"); compact rows. The app always opens on Now.
- Assignments: own tab and sheet tab; only Sensei gives them (no "given by"). Steps one per line, `[x] ` = done. Grouped Overdue / This week / Later / No due date; overdue count = red dot on the tab.
- Note form: sticky Cancel + green **Save changes** ("Save note" when new). Ctrl+S saves, Esc cancels.
- Wide (≥1000px): sidebar (sections, New note, Note types with counts, Settings), list fills the width, docked non-modal right panel (no scrim; × leaves "Pick a note"). Unsaved edit blocks switching. Kata open in the same panel; panels opened from a kata return to it. Keys: N new note, / search.
- Kata tab: Solo, Multi-person, Weapon, then belt most advanced first (flip saved as `kc.ksort`). Kata not on the dojo list show under "My other kata".
- Kiai: `My kata` column "Kiai notes (one per line, in order)"; line N = kiai N; extras past the count are kept but hidden. "Kiai details" starts collapsed every time.
- Press feedback: `.tapping` dip + `.tapped` ring (`replayTap`).
- Sync: optimistic op queue, batched, 60 s polling.
- `?kata=<name>` opens that kata's page.
- Phone Back: one guard history entry; Back closes a panel, then the kata page, then returns to Now; on Now "Press back again to close".

## Changing things

- App files: edit, bump `CACHE` in `web/sw.js`, commit and push to `main`.
- Code.gs: paste into Apps Script, redeploy (Manage deployments → pencil → New version).
- New sheet column: `applyOp_` adds a missing column on first write; or run `setup` (adds missing headers only), then redeploy.
- Tests: `node test/backend.test.js` and `node test/e2e.js <shots dir>` (serves the page from `web/`).
- Commits use author `Claude <noreply@anthropic.com>`.

## Deploying Code.gs

- Web app deployment ID: `AKfycbx0UcyEU5g-BdHWa9DfxAKFNYdbsZjDaGCLehJsaAWMk9ug1zVMlhDjFOGZdwQm4OdT`. Always update this deployment so the /exec URL never changes.
- From this folder, `.clasp.json` points clasp at the script project (rootDir is the repo root, where `Code.gs` is):
  ```
  clasp push
  clasp deploy -i AKfycbx0UcyEU5g-BdHWa9DfxAKFNYdbsZjDaGCLehJsaAWMk9ug1zVMlhDjFOGZdwQm4OdT -d "what changed"
  ```
- Never run `clasp deploy` without `-i`: that creates a new deployment with a new /exec URL. `clasp deployments` lists them.

## Code map
API: op-batched like Pantry Pal, signed with a session token from Google sign-in.

| File | Lines | What's in it |
|---|---|---|
| `Code.gs` | 880 | `doGet`/`doPost`/`api` (+ `notify` settings, `test`); notifications (`dueList_` pure and tested, `pushTick`, `deliver_`, `sendTest_`, `cleanNotify_`, `unquiet_`, `turnOnNotifications`/`turnOffNotifications`); privacy (`ownerEmail_`, `verifyIdToken_`, `newSession_`, `sessionEmail_`, `roleOf_`, `accessStatus_`, `requestAccess_`); data (`readAll_`, `applyOp_`, `kataList_`); menu (`onOpen`, `setup`, `setClientId`, `openApp`, `signOutAll`); `buildTab_` |
| `web/index.html` | 1416 | theme pre-load (~15), CSS (~16–480), markup, one `<script>` |
| `functions/push/[[path]].js` | 130 | Web Push signing (VAPID ES256) and aes128gcm encryption |
| `web/sw.js` | 60 | offline cache, `push`, `notificationclick` |
| `test/` | | `backend.test.js` (incl. `dueList_`), `e2e.js`, `mock.js` |

Inside the `index.html` script, search for:
- Sync and cache: `callApi`, `enqueue`, `flush`, `handle`, `normalize`, `saveCache`, `loadCache`, `boot`
- Sign-in: `loadGis`, `initGis`, `drawGis`, `signIn`, `signOut`, `wipeLocal`, `authScreen`
- Layout and theme: `render`, `header`, `nav`, `actbar`, `applyTheme`, `ICONS`, `mascot`
- Now: `viewNow`, `nowList`, `noteRowNow`, `xrow` (expandable row), `isStale`
- Notes: `viewNotes`, `notesList`, `nrow`, `viewCal`, `filtered`, `inDate`, `noteSheet`, `formSheet`, `saveNote`, `addPoint`, `kataChips`, `dateSheet` (types + dates filter)
- Keep in mind: `viewKeep`, `keepBody`
- Month review: `reviewSheet`, `saveReview`, `reviewOf`
- Kata: `upsertKata`, `kataNames`, `viewKataList`, `kataRows`, `kataPage`
- Tags and points: `TG`, `noteTags`, `toPoints`, `ptsHtml`, `ASKS`, `askLbl`
- Assignments: `viewAssignments`, `asRow`, `assignSheet`, `assignForm`, `saveAssign`, `parseSteps`, `dueLabel`
- Panels: `openSheet`, `renderSheet`, `formSheet`, `remSheet`, `accountSheet`, `toast`
- Tap feedback: `tapKey`, `replayTap`
- Notifications: `notifySheet`, `setNotify`, `saveNotify`, `pushOn`/`pushOff`, `checkPushSub`, `pushStatus`, `openLink` (actions `bell`, `push-on`, `push-test`, `nday`)

## Status
- Working: Nov 2026 redesign (Now / Notes / Kata / Assignments / Keep in mind, point-form notes, multi-kata, month review). sw v10.
- Notifications built (2026-11-03): push sender, scheduler, settings panel. Needs Code.gs deployed, then menu **Turn on notifications** once, then the bell on Now → Turn on (per phone). sw v11.
- Open: publishing the OAuth app needs a home page and privacy link on the Branding page.

## For Gary

Steps only Gary can do (App Atlas shows these as his to-dos). One line each; delete a line once it's done.

- [ ] Sheet menu: Karate-Ka Companion, Turn on notifications
- [ ] In the app: bell on Now, Turn on (each phone)
- [ ] Set your class days and times
- [ ] Add a home page and privacy link on the Google sign-in Branding page

## Changelog (latest first, keep about 5 lines)
- 2026-11-03: Notifications: before/after class, assignment due, long-running Now items, month review, quiet hours; functions/push; Devices + Sent tabs; sw v11
- 2026-11-03: Redesign: Now home, Notes list + calendar, Keep in mind tab, expandable rows, point-form notes, multi-kata, month review. Keep + review columns. sw v10
- 2026-10-21: Moved the site files into `web/`; only that folder is published
- 2026-10-22: Trimmed this brief
- 2026-10-21: Assignments tab + sheet; Follow up marker; distinct markers. sw v9, web app v6

## Working efficiently
- Find code with search first, then read only the relevant lines. Don't read index.html top to bottom.
- Make small, targeted edits. Never regenerate a whole file.
- Don't open a browser to test unless I ask. I'll test on my phone.
- No subagents unless I ask.
- One task per session. I'll /clear between tasks.
