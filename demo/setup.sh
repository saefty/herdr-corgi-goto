#!/bin/sh
# Builds the Go to demo in demo/run (recreated on every run, ignored by git):
#   run/user  a stand-in home: ~/code holds invented clones (acme/bookshelf, acme/orbit-sync, acme/orbit-web,
#             acme/ledger), and herdr-core's config points it at its own core, so the demo never shares
#             terminals with yours (the core's socket is /tmp/herdr-goto-demo/core.sock: socket paths must be short)
#   run/app   a Herdr home with the goto mod, the goto-demo provider mod and goto.config.json
# Then demo/record.sh opens a second Herdr window on it, fills it and takes the screenshots.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
root=$(dirname "$here")
run="$here/run" user="$here/run/user" app="$here/run/app"
core=$(command -v herdr-core || command -v hc)
rm -rf "$run"
mkdir -p "$user/.config/herdr-core" "$app/mods" "$app/control" /tmp/herdr-goto-demo

printf 'socket = "/tmp/herdr-goto-demo/core.sock"\nshell = ["/bin/zsh"]\n' > "$user/.config/herdr-core/config.toml"
# Demo shells: a plain prompt and the stand-in gh first on PATH.
printf 'export PATH="%s:$PATH"\n' "$here/fixtures/bin" > "$user/.zprofile"
printf "PROMPT='%%F{cyan}%%~%%f %%# '\n" > "$user/.zshrc"

repo() { # name, branch
  d="$user/code/$1"
  git init -q -b main "$d"
  git -C "$d" config user.name "Demo"; git -C "$d" config user.email "noreply@example.com"
  printf '# %s\n' "$1" > "$d/README.md"
  git -C "$d" add -A
  GIT_COMMITTER_DATE="2026-10-01T10:00:00Z" git -C "$d" commit -q --date "2026-10-01T10:00:00Z" -m "chore: start $1"
  git -C "$d" remote add origin "git@github.com:acme/$1.git"
  [ -z "${2:-}" ] || git -C "$d" checkout -q -b "$2"
}
repo bookshelf feat/due-reminders
repo orbit-sync fix/login-redirect
repo orbit-web
repo ledger

cp -R "$root/mods/goto" "$here/fixtures/goto-demo" "$app/mods/"
printf '{ "roots": ["~/code"], "depth": 2 }\n' > "$app/goto.config.json"
printf '{ "appearance": "dark", "telemetry": false, "sounds": { "enabled": false }, "core": "%s" }\n' "$core" > "$app/settings.json"
# Mostly off screen, so your mouse doesn't hover rows in the shots; skip the welcome tour and the "Updated" pill.
printf '{ "state": "windowed", "bounds": [1800.0, 900.0, 1280.0, 760.0] }\n' > "$app/window.json"
printf '{ "frame.welcomed": "skipped" }\n' > "$app/shared.json"
printf '{ "last_run": "%s", "presented": [] }\n' "$(herdr-app --version | grep -o '[0-9][0-9.]*' | head -1)" > "$app/update-notes.json"
: > "$app/control/query.txt"
echo "demo ready: $run"
