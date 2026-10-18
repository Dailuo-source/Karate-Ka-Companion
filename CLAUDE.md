# Karate-Ka Companion: handoff notes

Gary's private karate notebook. Dated notes typed Kata / Kihon / Kumite / Sensei says / Goals / General,
a page per kata (how it feels, fixed kiai count, key reminders, every note on that kata) and a Goals tab.
Used on his Samsung phone (Chrome PWA). No photos (Gary's choice).

## Where things live

| Piece | Location |
| --- | --- |
| Live app | https://karate-ka-companion.pages.dev/ (Cloudflare Pages from `main`) |
| Database | Google Sheet **Karate-Ka Companion**, id `1i-PHNQd0pZOTOAUZvysY61XwsoartfMaU1Fb6Mn73OM`. Tabs: Notes, My kata, Access |
| Backend | Apps Script project "Karate-Ka Companion" bound to the sheet; source is `Code.gs` here. Web app version 1 (Execute as Gary, access Anyone), URL in `API_URL` in index.html |
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
