# Karate-Ka Companion setup

Karate-Ka Companion keeps your notes in your own Google Sheet. The app is hosted on Cloudflare Pages at
`https://karate-ka-companion.pages.dev/`. Only your Google account can open it; anyone else has to ask you.

## 1. The Google Sheet (on a computer)

1. Make a new sheet named **Karate-Ka Companion**.
2. Open **Extensions → Apps Script**, replace `Code.gs` with this repo's `Code.gs`, and save.
3. Pick **setup** in the function list and press **Run**. Allow the permissions it asks for
   (your sheets, the Kata Tracker sheet it reads kata names from, checking Google sign-ins, and
   emailing you when someone asks for access). It makes the **Notes**, **My kata** and **Access** tabs.
4. **Deploy → New deployment → Web app**, *Execute as: Me*, *Who has access: Anyone*, **Deploy**.
   Copy the Web app URL (ends in `/exec`). "Anyone" only lets the app reach the script; the script
   itself turns away every request that isn't signed in with an allowed Google account.

## 2. Google sign-in (Google Cloud console, once)

1. At console.cloud.google.com make a project called **Karate-Ka Companion**.
2. **Google Auth Platform → Branding**: app name Karate-Ka Companion, your email, then **Audience → External**
   and **Publish app** (only the basic name/email scopes are used, so no review is needed).
3. **Clients → Create client → Web application**. Authorised JavaScript origin:
   `https://karate-ka-companion.pages.dev`. Copy the client ID.
4. In the sheet: **Karate-Ka Companion → Set Google sign-in client ID…** and paste it.
5. Put the client ID and the `/exec` URL into `CLIENT_ID` and `API_URL` at the top of the script in `index.html`.

## 3. Hosting (Cloudflare Pages)

1. **Workers & Pages → Create → Pages → Connect to Git**, pick the **Karate-Ka-Companion** repo.
2. Project name **karateka-companion**, no build settings, **Save and Deploy**.

## 4. Phone

Open `https://karate-ka-companion.pages.dev/` in Chrome, **Continue with Google**, then
**⋮ → Add to Home screen → Install**.

## Later

- **Someone asks for access**: you get an email. Allow or refuse in the app (account button → Access)
  or on the sheet's Access tab. Allowed people can look but not change anything.
- **Lost phone**: sheet menu **Karate-Ka Companion → Sign out every phone**.
- **App updates**: bump `CACHE` in `sw.js` whenever app files change.
