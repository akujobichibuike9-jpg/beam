# beam

Send files between your phone and laptop with a 4-digit code or a QR, or share
with a whole group in a **team room**. Every file is stored on your Cloudflare
account for **30 days**, then deleted automatically. Admins can see every
transfer and file at `/admin.html`.

Everything runs on Cloudflare:

| Piece | What it does |
|---|---|
| **Worker** (`src/index.js`) | The API, and serves the app from `public/` |
| **Durable Object `Room`** (`src/room.js`) | One per 4-digit code: who's in the room, who can send, live updates over WebSockets |
| **Durable Object `Limiter`** (`src/limiter.js`) | Locks a network out after 5 wrong codes, so codes can't be guessed |
| **R2 bucket `beam-files`** | The files themselves |
| **D1 database `beam`** | History: rooms, people, files, downloads, reports, blocks |
| **Cron (daily, 03:17 UTC)** | Deletes files older than 30 days and old history |

Files go up in 20 MB pieces, because Cloudflare limits a single request to 100 MB
on the Free and Pro plans. That's how one file can be up to 2 GB.

## Run it on your computer

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
cp .dev.vars.example .dev.vars          # local admin password + salt
npm run db:local                        # create the local database tables
npm run dev                             # http://localhost:8787
```

Open http://localhost:8787 in two windows, one sending and one receiving.
The admin is at http://localhost:8787/admin.html. The token is `ADMIN_TOKEN` from `.dev.vars`.

To try it on your phone, open the address your computer shows on your Wi-Fi.
Run `npm run dev -- --ip 0.0.0.0` and use `http://<your-computer's-IP>:8787`.

Run the API tests while `npm run dev` is running (use fresh local data, because the
test deliberately triggers the wrong-code lockout):

```bash
npm test
```

## Put it online

1. **Log in** to Cloudflare: `npx wrangler login`
2. **Create the storage bucket:** `npx wrangler r2 bucket create beam-files`
   (Cloudflare may ask you to turn on R2 in the dashboard first.)
3. **Create the database:** `npx wrangler d1 create beam`
   Copy the `database_id` it prints into `wrangler.jsonc`, replacing
   `REPLACE_WITH_YOUR_D1_DATABASE_ID`.
4. **Create the tables:** `npm run db:remote`
5. **Set the secrets:**
   ```bash
   npx wrangler secret put ADMIN_TOKEN   # a long random password for the admin
   npx wrangler secret put HASH_SALT     # any long random string
   ```
6. **Deploy:** `npm run deploy`

Wrangler prints your address, e.g. `https://beam.<you>.workers.dev`. To use your
own domain, add it under the Worker's **Settings → Domains & Routes** in the dashboard.

### Lock down the admin page (recommended)

The admin API already needs `ADMIN_TOKEN`. For a second lock, put
`/admin.html` and `/api/admin/*` behind **Cloudflare Access** (Zero Trust →
Access → Applications → Self-hosted). Only the email addresses you list can
then reach them.

## Settings

Change these in `wrangler.jsonc` under `vars`, then deploy again:

| Setting | Default | Meaning |
|---|---|---|
| `RETENTION_DAYS` | 30 | Days files and history are kept |
| `CODE_TTL_MIN` | 5 | Minutes a 1-to-1 code stays valid if no one joins |
| `MAX_FILE_MB` | 2048 | Largest single file |
| `MAX_TEAM` | 25 | People per team room, including the host |
| `LOCKOUT_TRIES` | 5 | Wrong codes before a network is locked out |
| `LOCKOUT_MIN` | 15 | How long the lockout lasts |

## How it works

- **1-to-1:** the sender picks files and gets a code. Uploading starts straight
  away, so files are often ready before the other device joins. The receiver types
  the code (or scans the QR, which carries a secret link and skips the guessing
  limit), sees each file fly in, and saves it. The code then stays open for 2 hours.
- **Team rooms:** the host shares the code or QR, and up to 25 people join. The host
  picks **Everyone** or **Only me** for who can send, and can switch individual people
  to receive-only. Everyone sees new files arrive live. A team room stays open for
  12 hours or until the host ends it.
- **Reports and blocks:** receivers can report a file. Admins can delete it and block
  the sender's network. Networks are stored as one-way hashes, never as raw IP addresses.
- **Privacy:** the app tells people before they send that files are kept for 30
  days. Admins can open stored files, so say this clearly in your privacy policy,
  along with the approximate location (city) recorded for each room.

## Costs

On Cloudflare's free allowances a small app costs nothing. Past them:
R2 storage is $0.015 per GB a month, with no charge for downloads; uploads are
$4.50 per million requests (each 20 MB piece is one). The Workers Free plan allows
100,000 requests a day. If you outgrow it, Workers Paid is $5 a month. Check
Cloudflare's pricing pages for current numbers.

## Files

```
src/index.js       Worker: routes, uploads, downloads
src/room.js        Room Durable Object (live state, permissions, WebSockets)
src/limiter.js     Wrong-code lockout
src/admin.js       Admin API + daily clean-up
src/util.js        Helpers
migrations/        D1 tables
public/            The app (index.html, app.js, app.css) and admin (admin.html, admin.js, admin.css)
test/api.test.mjs  End-to-end API test
```

`public/vendor/qrcode.js` is qrcode-generator by Kazuhiko Arase (MIT license).
