# beam

Send files between your phone and laptop with a 5-character code (letters and
numbers, no look-alikes like 0/O or 1/I) or a QR. Codes work for **1 hour**.
Chat one-on-one in a **private chat** (just two people, no sign-up, name optional),
or share with a whole group in a **team room**. You can be in several at once
(say a private chat and two team rooms) and switch between them; rooms you're
not looking at stay connected and show unread counts. Works on phones and has a
desktop layout (side nav, two columns, chat info panel) on laptops. Every file is stored on your Cloudflare
account for **30 days**, then deleted automatically. Admins can see every
transfer and file at `/admin.html`.

Everything runs on Cloudflare:

| Piece | What it does |
|---|---|
| **Worker** (`src/index.js`) | The API, and serves the app from `public/` |
| **Durable Object `Room`** (`src/room.js`) | One per 5-character code (private chat, team room or transfer): who's in the room, who can send, live updates over WebSockets |
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
4. **Create the tables:** `npm run db:remote` (run it again after updates that add files to `migrations/`)
5. **Set the secrets:**
   ```bash
   npx wrangler secret put ADMIN_TOKEN   # a long random password for the admin
   npx wrangler secret put HASH_SALT     # any long random string
   ```
6. **Deploy:** `npm run deploy`

Wrangler prints your address, e.g. `https://beam.<you>.workers.dev`. To use your
own domain, add it under the Worker's **Settings → Domains & Routes** in the dashboard.

### Make calls work on strict networks (recommended)

Calls connect devices directly. Some networks block that, and then a relay is needed.
1. In the Cloudflare dashboard go to **Realtime → TURN Server** and create a TURN key.
2. Add its ID and API token to the Worker as secrets:
   ```bash
   npx wrangler secret put TURN_KEY_ID
   npx wrangler secret put TURN_KEY_API_TOKEN
   ```
   (or under **Settings → Variables and Secrets** in the dashboard).

Without these, calls still work on most home Wi-Fi and mobile networks.

### Lock down the admin page (recommended)

The admin API already needs `ADMIN_TOKEN`. For a second lock, put
`/admin.html` and `/api/admin/*` behind **Cloudflare Access** (Zero Trust →
Access → Applications → Self-hosted). Only the email addresses you list can
then reach them.

## Encryption (Cloudflare can't read it; the admin can)

Turn it on once in the admin dashboard by setting an **admin passphrase**. From
then on, every new transfer, private chat and team room is encrypted on people's
devices before anything is uploaded: Cloudflare only stores scrambled files,
names, previews and messages. The admin keeps full access by unlocking the
dashboard with the passphrase; everything is decrypted in the admin's browser.
Until a passphrase is set, rooms are not encrypted (so the admin never loses access).

- **Admin key:** the dashboard makes a key pair. The public half is handed to
  every device (`/api/config`); the private half is stored on the server only
  locked with the passphrase (PBKDF2, 310k rounds + AES-GCM). Lose the passphrase
  and encrypted rooms can't be read by anyone.
- **Room key:** made by the device that starts a room, sealed to the admin key
  (stored as `rooms.escrow`), and shared with members via the QR/invite link (after
  `#`, never sent to the server) or handed over device-to-device (ECDH) when someone
  types the code.
- **Files:** each file has its own key and is encrypted in 1 MB AES-GCM blocks
  (`public/e2e.js`); the service worker decrypts on the device with Range support,
  so videos stream and seek. Notification previews are unlocked on the phone.
- **Reports** are logged as before, including the reported text or that file's key
  from the reporter's device.
- Calls are encrypted device-to-device (WebRTC) and are not recorded.

## Fast video sending

In private chats and team rooms, big videos are made smaller on the sender's
device before upload, like WhatsApp: 720p H.264 at ~2 Mbit/s (about 15 MB a
minute), using the device's own video encoder (WebCodecs, via the bundled
[Mediabunny](https://mediabunny.dev) library, MPL-2.0, loaded only when needed).
A 50 MB 1080p clip goes as ~5 MB. While one video uploads, the next is already
being shrunk. People can tap **Send original** while it shrinks, or turn
**Smaller videos** off in chat info. One-off phone↔laptop transfers always send
the original file. If a browser can't convert a video, the original is sent.

## Notifications and installing as an app

beam can be installed (Chrome: install icon in the address bar; Android: "Install
app"; iPhone: Share → Add to Home Screen). Tap the bell to turn on pop-ups:

- new messages, voice notes and files show as a notification (one per chat,
  with a count), only when beam isn't on screen, so there's no double alert
- calls ring with Answer / Decline; if nobody picks up you get "Missed call"
- tapping a notification opens that chat, even if beam was closed

This uses standard Web Push (no cron, no extra service). The signing key
(VAPID) is created automatically the first time and stored in D1 (`kv` table),
so there's nothing to configure. iPhone/iPad need iOS 16.4+ and beam added to the
Home Screen. While beam is open, every room's live connection checks itself every
15 seconds and reconnects (and catches up) whenever the phone wakes or the
network comes back, so you never need to refresh.

## Settings

Change these in `wrangler.jsonc` under `vars`, then deploy again:

| Setting | Default | Meaning |
|---|---|---|
| `RETENTION_DAYS` | 30 | Days files and history are kept |
| `CODE_TTL_MIN` | 60 | Minutes a new code stays valid if no one joins |
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
- **Chat in team rooms:** messages and files in one feed, replies, emoji reactions
  (double-tap for ❤️, press and hold for more), "typing…", and voice notes (tap the mic,
  tap again to send). Everyone can always chat. The host decides who can share files and
  voice notes, and can remove people. Messages are kept for 30 days like files.
- **Voice and video calls:** anyone in a team room can start a call, and up to 8 people can
  join. Devices connect straight to each other; the room only introduces them. On strict
  networks (some schools, offices and mobile networks) calls need Cloudflare's TURN relay, see below.
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
