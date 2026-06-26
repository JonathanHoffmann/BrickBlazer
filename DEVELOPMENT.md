# Development Commands

## Start The Game

Install dependencies once:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

Vite prints a local URL, usually:

```text
http://localhost:5173/
```

## Start With Dev Levels

Level 00 is kept in the codebase as a development/test level, but it is hidden from normal play.

Enable dev levels while starting the dev server:

```bash
VITE_ENABLE_DEV_LEVELS=true npm run dev
```

This adds `level00` before the normal playable levels during Vite dev mode only. Production builds and normal dev runs do not include it.

The same flag also enables the in-game dev power-up menu. During gameplay, use the `Dev` button and click a power-up name to spawn it above the paddle.

## Build

Create a production build:

```bash
npm run build
```

The output is written to `dist/`.

## Build Android APK

Create a debug Android APK with Capacitor:

```bash
npm run build:android
```

The APK is copied to `apk-output/brickblaze-v1.0.apk`, using the Android `versionName` from `android/app/build.gradle`. Change `versionName` there to change the visible version number, and increase `versionCode` for installable Android upgrades. This requires a local Android SDK and JDK that can run the generated Gradle project. If the SDK is not in `$HOME/Android/Sdk`, set `ANDROID_HOME` or `ANDROID_SDK_ROOT` before running the command.

The Android project uses a custom Capacitor activity that enables immersive sticky mode, so Android navigation buttons stay hidden until the user swipes up from the edge.

To create an unsigned release APK instead:

```bash
BUILD_TYPE=release npm run build:android
```

## Preview Production Build

Serve the built output locally:

```bash
npm run preview
```

Run `npm run build` before previewing if `dist/` is missing or stale.

## Regenerate Sound Assets

Sound effects and background music are generated from [assets/generateSounds.mjs](assets/generateSounds.mjs):

```bash
node assets/generateSounds.mjs
```

Run `npm run build` afterward to verify the generated assets bundle correctly.