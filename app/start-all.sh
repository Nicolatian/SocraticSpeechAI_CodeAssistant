#!/usr/bin/env bash
set -u

pids=()
tts_pid=""

stop_processes() {
  trap - EXIT INT TERM
  for pid in "${pids[@]}" "$tts_pid"; do
    [[ -n "$pid" ]] || continue
    kill "$pid" 2>/dev/null || true
  done
  for pid in "${pids[@]}" "$tts_pid"; do
    [[ -n "$pid" ]] || continue
    wait "$pid" 2>/dev/null || true
  done
}

trap stop_processes EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

start_process() {
  local name=$1
  shift
  printf '[%s] starting\n' "$name"
  "$@" &
  pids+=("$!")
}

start_process PROMPT python ../prompt_server.py
start_process LLM python ../start_llm.py
start_process FRONTEND npm run dev -- --host 0.0.0.0

printf '[TTS] starting (optional)\n'
../chatterbox-tts-env/bin/python ../tts_server.py &
tts_pid=$!

printf '[TTS] waiting up to 120 seconds for readiness\n'
tts_ready=0
deadline=$((SECONDS + 120))
while (( SECONDS < deadline )); do
  if curl --connect-timeout 2 --max-time 3 --silent --fail \
    http://127.0.0.1:8002/health |
    grep -Eq '"pid"[[:space:]]*:[[:space:]]*'"$tts_pid"'([,}])'; then
    tts_ready=1
    break
  fi
  if ! kill -0 "$tts_pid" 2>/dev/null; then
    wait "$tts_pid"
    tts_status=$?
    printf '[TTS] unavailable (status %s); continuing without speech\n' \
      "$tts_status" >&2
    tts_pid=""
    break
  fi
  sleep 2
done

if (( tts_ready )); then
  printf '[TTS] ready\n'
elif [[ -n "$tts_pid" ]]; then
  printf '[TTS] not ready after 120 seconds; continuing without speech\n' >&2
fi

status=0
wait -n "${pids[@]}" || status=$?
exit "$status"
