# Degen Tracker

A simple iPhone app for tracking gambling gains and losses, styled like an 8-bit arcade scoreboard. Built with React Native, Expo SDK 57, and TypeScript.

- Log a gain or loss in US dollars with an optional session note.
- See all-time net profit, total gains, total losses, and session count.
- Filter your session history and remove mistakes after confirming.
- Records stay on the device with AsyncStorage. No account, backend, analytics, or credentials required.
- Pixel typography and dice artwork are bundled, so the app does not need a font download at runtime.

Enter the **net result** of each session, not both the payout and profit. Amounts are stored as integer cents. Dates use the device's local timezone for display. This first version uses USD, records the current time, and does not provide cloud backup or cross-device sync. Removing the app may remove its records.

## Run on your iPhone

On a computer with Node.js 22 or newer:

```sh
npm ci
npm start
```

Install **Expo Go** on your iPhone. Keep the computer and phone on the same Wi-Fi network, then scan the terminal's QR code with the iPhone Camera app. Use an Expo Go version that supports SDK 57. The font, ledger, and UI work without an app account; the development bundle still needs a connection to the computer.

If your Expo Go version does not support this SDK, use an Expo development build with compatible native modules. A cloud machine's private LAN address is generally unreachable from a phone; run the checkout on your computer or configure an Expo tunnel. A tunnel is not configured or tested here.

On a Mac with Xcode, `npm run ios` can start an iOS simulator. This cloud environment is Linux and cannot run Xcode or the iOS simulator. Creating a standalone signed app for TestFlight or the App Store requires an Apple Developer account and an iOS build through Xcode or Expo EAS. No Apple account, bundle identifier, signing credentials, or publishing configuration has been assumed.

## Develop and check

```sh
npm run web
npm run typecheck
npm test
npm run export
```

`npm test` covers exact money parsing, totals, removal, formatting, persistence schema validation, and cumulative history. `npm run export` exports the same React Native UI for browser checks; it does not produce an installable iPhone app.

For the cloud environment's bundled Python Playwright and Chromium:

```sh
python tests/smoke.py
```

Run that after exporting. It serves `dist` on a temporary loopback port and exercises entry, filters, reload persistence, removal confirmation, failed writes, corrupt-save recovery, and 320/390/430-pixel phone layouts. On other machines install Python Playwright and provide `CHROMIUM_PATH` if Chromium is not at `/usr/bin/chromium`.

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

The versioned save key is `degen-tracker.ledger.v1`. New records and removals are committed to storage before the visible totals change. A failed write leaves the prior ledger and form intact. An invalid existing save displays a retry screen and is never silently replaced. There is no automatic reset of damaged data.
