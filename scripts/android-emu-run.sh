#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

bash "$ROOT_DIR/scripts/android-emu.sh" vito_pixel "${1:-headless}"
adb reverse tcp:8081 tcp:8081 || true

cd "$ROOT_DIR/mobile/android"
./gradlew assembleDebug -PreactNativeArchitectures=x86_64
adb install -r "$ROOT_DIR/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
adb shell am start -n com.andrevmp.vito/.MainActivity
echo "App instalado e aberto no emulador! Suba o Metro com: cd mobile && npx expo start --dev-client"
