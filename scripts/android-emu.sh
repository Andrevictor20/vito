#!/usr/bin/env bash
set -euo pipefail

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

AVD_NAME="${1:-vito_pixel}"
MODE="${2:-auto}"

if adb devices | awk 'NR>1 && $2=="device" {found=1} END{exit !found}'; then
  echo "Emulador/dispositivo Android já conectado:"
  adb devices
  exit 0
fi

EXTRA_FLAGS=(-no-audio -no-boot-anim -memory 2048 -feature -Vulkan)
if [[ "$MODE" == "headless" ]]; then
  if [[ -n "${DISPLAY:-}" ]]; then
    EXTRA_FLAGS+=(-no-window -gpu host)
  else
    EXTRA_FLAGS+=(-no-window -gpu guest)
  fi
elif [[ -z "${DISPLAY:-}" ]]; then
  EXTRA_FLAGS+=(-no-window -gpu guest)
else
  EXTRA_FLAGS+=(-gpu host)
fi

echo "Iniciando AVD '$AVD_NAME' (${EXTRA_FLAGS[*]})..."
nohup emulator -avd "$AVD_NAME" "${EXTRA_FLAGS[@]}" >/tmp/vito-emulator.log 2>&1 &
EMU_PID=$!
echo "Emulator PID: $EMU_PID (log em /tmp/vito-emulator.log)"

adb wait-for-device
for _ in $(seq 1 90); do
  if ! kill -0 "$EMU_PID" 2>/dev/null; then
    echo "Processo do emulador encerrou inesperadamente. Últimas linhas do log:" >&2
    tail -n 25 /tmp/vito-emulator.log >&2
    exit 1
  fi
  BOOT=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)
  if [[ "$BOOT" == "1" ]]; then
    echo "Android boot concluído!"
    adb devices
    exit 0
  fi
  sleep 2
done

echo "Timeout aguardando boot do emulador. Veja /tmp/vito-emulator.log" >&2
exit 1
