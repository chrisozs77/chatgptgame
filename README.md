# Degen Tracker

A simple iPhone app for tracking gambling gains and losses, styled like an 8-bit arcade scoreboard. Built with React Native, Expo SDK 57, and TypeScript.

- Log a gain or loss in US dollars with an optional session note.
- See all-time net profit, total gains, total losses, and session count.
- See the latest 10 matching transactions on Tracker, and open **History** for the full log with independent month/year filters and All options.
- Edit an entry's gain/loss type, amount, or note, keeping its original date. Edit and Remove buttons work on phones and computers; removal asks for confirmation.
- Get a randomized arcade reaction in **The Verdict** after a result saves: green for gains, red for losses. The same phrase won't repeat consecutively. Messages last until the next logged result or you close the app; removing the associated result clears its reaction.
- Sign in with an emailed code before using the app. Your remembered account has its own ledger and offline cache; reconnect to sync pending changes.
- Pixel typography and dice artwork are bundled, so the app does not need a font download at runtime.
- The exported web app can be installed on a home screen and used offline after its first successful online load.
- A fixed bottom toolbar switches between **Tracker**, **History**, and **Support**. The free guided support bot covers gambling urges, chasing losses, breaks, and everyday stress, without an AI account or API charges.

Enter the **net result** of each session, not both the payout and profit. Amounts are stored as integer cents. Dates use the device's local timezone for display. This version uses USD and records the current time. Results marked **CLOUD SAVED** can be recovered by signing into the same account; pending changes remain on the device until sync succeeds.

## Cloud backup

See [the Supabase setup guide](docs/CLOUD_SETUP.md) for the database SQL, sign-in email template, and actual two-device validation. The project's URL and publishable key are public client configuration; no privileged key or database password is in the app.

Use **Sign in / Create account** and enter the code emailed to you. The app requires initial sign-in and remembers it on this device. Signing out returns to the sign-in screen. Existing local-only logs are preserved and are not uploaded automatically: **Back up local logs** copies them into the selected account after confirmation. The app owner administers the Supabase database; row-level security keeps users from accessing one another's records through the app.

Signed-in users can log results offline, even when reopening with an expired network token. The cached identity selects only the local ledger; cloud requests still require a valid Supabase session. Changes queue until a successful sync. A new device restores results from the account instead of replacing cloud history with an empty ledger. Deletion wins over stale offline copies.

Cloud backup is ready only after live database/email setup and a successful save-and-restore test. Clearing browser data removes un-synced changes. Switching websites, browser profiles, or devices requires signing in again to recover synced history.

For an existing Supabase installation, run [`supabase/enable-entry-editing.sql`](supabase/enable-entry-editing.sql) once in its SQL Editor to enable versioned editing. It preserves all records and access policies. Fresh projects can run the full schema. Until the upgrade is detected, normal logging and removal continue to sync and Edit stays disabled. Once detected, edits work offline too. Changes retain entry ID and date; a logical clock plus a tie-breaker resolves concurrent edits consistently, and deletion always wins. If an open edit form becomes stale, close it and reopen the latest entry.

History filters use the device's local calendar month/year, and its net total covers the selected range. Tracker totals continue to cover all history. Choosing **View full history** resets the date filters to All; switching tabs otherwise retains the selected filters. History uses a virtualized list for long logs.

## Support tab

The **Support** tab offers prepared, topic-based guidance with follow-up steps. It is a guided bot, not a full conversational AI or a therapist. It works offline, uses no API service, and never reads gambling logs or sends chat messages anywhere. Conversation state stays in memory, survives switching tabs, and resets on reload, account change, or **Clear chat**; it is not included in cloud backups.

Quick prompts cover urges, chasing losses, stress, and taking a break. Users can also type messages about boundaries, money worries, sleep, relationships, or finding human support. The bot avoids betting strategies and directs recognised crisis language to human help. Prepared responses cannot understand every situation or reliably assess emergencies.

**Talk to a person** links to Gambling Therapy, Find a Helpline, and the US 988 Lifeline. Resource websites require internet access. The toolbar and support screen remain usable while tracker storage is loading or unreadable.

## Share with friends without an Apple account

Use the **installable web app**. Friends open its hosted HTTPS link in Safari on an iPhone, then tap **Share → Add to Home Screen** (enable **Open as Web App** if shown). It gets its own icon and opens as an app. Android and desktop browsers also offer installation. There is no App Store download or Apple Developer membership required for this route.

Open it online and sign in once to cache the app, font, icons, and account. It can then reopen and log results offline. Signed-in accounts can sync and restore logs once Supabase setup is complete; pending changes remain only on the device. Browser storage can be cleared by the user or operating system. App updates preserve saved ledgers and activate after the older app is closed.

The repository includes a GitHub Pages deployment workflow. To enable hosting:

1. Open this repository on GitHub, then **Settings → Pages**.
2. Under **Build and deployment**, select **GitHub Actions** as the source.
3. Open **Actions → Deploy installable web app → Run workflow**, select `degen-tracker`, and run it. If an earlier deployment failed before Pages was enabled, rerun it.
4. After deployment succeeds, use the website link shown under **Settings → Pages**. For this repository, the expected project URL is `https://chrisozs77.github.io/chatgptgame/`. This URL is not live merely because the configuration files exist.

GitHub Pages eligibility depends on repository visibility and your GitHub plan; public repositories are supported on GitHub Free. If Pages is unavailable for your private repository, keep it private and use another static HTTPS host instead.

For a static host serving your app at the domain root:

```sh
npm ci
npm run export
```

Upload the **contents of `dist`**, including `sw.js`, `manifest.webmanifest`, icons, and `_expo`, to a static HTTPS host such as Netlify. The web export contains only app assets, not your ledger or signing credentials. The build does not itself publish the website. For a subdirectory host, use `npm run export -- --base-path /chatgptgame`; the GitHub workflow sets this automatically.

## Run on your iPhone

On a computer with Node.js 22 or newer:

```sh
npm ci
npm start
```

Install **Expo Go** on your iPhone. Keep the computer and phone on the same Wi-Fi network, then scan the terminal's QR code with the iPhone Camera app. Use an Expo Go version that supports SDK 57. Initial use requires email sign-in; a remembered account can log offline afterward. The development bundle still needs a connection to the computer.

If your Expo Go version does not support this SDK, use an Expo development build with compatible native modules. A cloud machine's private LAN address is generally unreachable from a phone; run the checkout on your computer or configure an Expo tunnel. A tunnel is not configured or tested here.

On a Mac with Xcode, `npm run ios` can start an iOS simulator. This cloud environment is Linux and cannot run Xcode or the iOS simulator.

## Install Degen Tracker as a standalone app

The project includes Expo EAS cloud build profiles and the iOS identifier `com.chrisozs77.degentracker`. Confirm this identifier is the one you want before the first signed build. These files prepare the project; no signed build has been created or submitted. Windows and Mac computers can both start cloud builds.

For an app with its own home-screen icon through **TestFlight**, you need an [Expo account](https://expo.dev/signup) and an [Apple Developer Program membership](https://developer.apple.com/programs/) (US $99/year; regional pricing varies). Install Apple's TestFlight app on your iPhone.

In the project folder on your computer, run:

```sh
npm ci
npx eas-cli@24.13.0 login
npx eas-cli@24.13.0 init
npx eas-cli@24.13.0 build --platform ios --profile production
```

Log in to Expo, create or link the EAS project, and follow the build prompts to sign in to Apple. Let EAS manage the signing certificate and provisioning profile. If `eas init` cannot update the dynamic configuration automatically, put the project ID it provides in `app.json` under `expo.extra.eas.projectId`; `app.config.ts` forwards that value. No credentials are embedded in the repository. Keep credentials in the CLI's secure flow, not source files.

Once that build finishes successfully, run:

```sh
npx eas-cli@24.13.0 submit --platform ios --profile production --latest
```

Follow the submission prompts for your App Store Connect app and Apple account. When Apple has processed the build, open **App Store Connect → My Apps → Degen Tracker → TestFlight**, finish any required beta details, and add yourself to an internal testing group. Accept the invitation in TestFlight on your iPhone. TestFlight builds expire after 90 days; they are for testing and do not publish the app to the public App Store. External testers may require beta app review.

The `preview` profile is an alternative for registered devices without TestFlight. It still requires Apple Developer membership for iOS signing:

```sh
npx eas-cli@24.13.0 device:create
npx eas-cli@24.13.0 build --platform ios --profile preview
```

Open the device registration link on your iPhone before building. After the build completes, open its install link on that registered phone. Adding a new phone later requires a build or re-sign that includes the new device.

The EAS profiles and Expo configuration can be validated locally, but Apple provisioning, a signed IPA, physical-device installation, and TestFlight submission need your accounts and have not been validated in the cloud environment.

## Develop and check

```sh
npm run web
npm run typecheck
npm test
npm run export
```

`npm test` covers exact money parsing, totals, local saves, reactions, cloud queues, account isolation, recovery, and PostgreSQL row policies. `npm run export` exports an installable web app with a manifest, icons, and a versioned offline cache. It does not produce a signed native iPhone app. The export clears stale Metro transforms when cloud connection settings or the deployment path change; `--clear` also forces a rebuild.

For the cloud environment's bundled Python Playwright and Chromium:

```sh
python tests/smoke.py
```

Run that after exporting. It serves `dist` on a temporary loopback port and exercises entry, filters, reload persistence, removal confirmation, failed writes, corrupt-save recovery, and 320/390/430-pixel phone layouts. On other machines install Python Playwright and provide `CHROMIUM_PATH` if Chromium is not at `/usr/bin/chromium`.

`python tests/pwa.py` checks installation metadata, cached fonts and icons, offline logging and reload, safe service-worker updates, and preservation of records. For a subdirectory export, run `python tests/pwa.py --directory /tmp/degen-pages --base-path /chatgptgame` after `npm run export -- --base-path /chatgptgame --output-dir /tmp/degen-pages`.

`python tests/support_smoke.py` checks the fixed toolbar, guided conversation, preserved tracker form and logs, offline support, session clearing, phone layouts, human-help links, and support access when tracker storage is unreadable.

`python tests/history_smoke.py` checks the sign-in gate, recent-ten preview, date filters, editing, removal, totals, and phone/desktop layouts. These local browser suites seed a synthetic previously signed-in offline account and block every Supabase request. The separate simulated HTTP suite below exercises actual app sign-in and cross-device edit flows without delivering emails.

To exercise cloud UI against a simulated HTTP API without sending emails:

```sh
CI=1 EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 EXPO_PUBLIC_SUPABASE_URL=https://cloud.degen.test EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test npm run export -- --output-dir /tmp/degen-cloud-test
python tests/cloud_smoke.py
```

These POSIX-shell commands use synthetic public test configuration. The suite covers code sign-in, explicit import, two-device restore, offline reopen with an expired token, sync after reconnecting, deletion, account switching, and recovery after local storage loss. It does not validate hosted Supabase or deliver real emails. Export again without the synthetic environment before deploying a real build.

An iOS JavaScript/Hermes bundle can be validated on Linux:

```sh
CI=1 EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 npx expo export --platform ios --output-dir /tmp/degen-tracker-ios
```

This confirms bundling, not native device execution or signing.

## Cloud environment

Use the existing `/workspace/chatgptgame` checkout; each cloud task is already isolated, so do not create a Git worktree unless requested.

```sh
cd /workspace/chatgptgame
CI=1 npm_config_cache=/tmp/degen-tracker-npm-cache npm ci --no-audit --no-fund
EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 EXPO_UNSTABLE_HEADLESS=1 npm run web -- --localhost --port 8082
```

The cache location keeps writes in a writable directory. Expo's offline CLI mode uses the installed SDK metadata; npm still obtains dependencies from its registry. Headless mode uses browser debugging rather than preparing a desktop DevTools application on the cloud machine. Check `/status` for `packager-status:running`, then load and exercise the UI. Keep this server in a terminal; processes must be restarted in future tasks.

## Storage behavior

The original local-only save key remains `degen-tracker.ledger.v1`. Signed-in caches are namespaced by Supabase project and user ID. Pending changes and records are persisted together before visible totals change. A failed write leaves the prior ledger and form intact. An invalid existing save displays a retry screen and is never silently replaced. There is no automatic reset of damaged data. Only acknowledged cloud sync is labeled **CLOUD SAVED**.
