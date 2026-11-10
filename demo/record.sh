#!/bin/sh
# Opens a second Herdr window on the demo (run demo/setup.sh first), fills it with invented spaces and agents, takes
# the screenshots and the walkthrough GIF into docs/screenshots and preview.png, then closes the window and stops the
# demo core. Your own window, home and terminals are not touched: HOME, the Herdr home and the core are the demo's.
# Typing is simulated: the goto-demo mod passes run/app/control/query.txt on as shared "goto.demo.query".
set -eu
here=$(cd "$(dirname "$0")" && pwd)
root=$(dirname "$here")
run="$here/run" user="$here/run/user" fx="$here/fixtures" out="$root/docs/screenshots" frames="$here/run/frames"
export HERDR_APP_HOME="$run/app"
mkdir -p "$out" "$frames"

HOME="$user" SHELL=/bin/zsh PATH="$fx/bin:$PATH" DO_NOT_TRACK=1 HERDR_TELEMETRY=0 \
  /Applications/Herdr.app/Contents/MacOS/Herdr > "$run/herdr.log" 2>&1 &
until herdr-app status > /dev/null 2>&1; do sleep 1; done
sleep 2
do_() { herdr-app do "$@" > /dev/null; }
node -e 'const fs=require("fs"),[k,x]=process.argv.slice(1);const a=JSON.parse(fs.readFileSync(k));Object.assign(a.global,JSON.parse(fs.readFileSync(x)).global);fs.writeFileSync(k,JSON.stringify(a,null,2))' "$run/app/keys.json" "$root/keys.json"
# The provider mod needs a block to run in: a copy of the main layout with a 0 px block for it.
do_ layout.clone --name main --as demo
node -e 'const fs=require("fs"),p=process.argv[1],l=JSON.parse(fs.readFileSync(p));l.children.find((c)=>c.id==="sidebar").children.splice(1,0,{id:"goto-demo",type:"block",size:{px:0},content:{mod:"goto-demo"}});fs.writeFileSync(p,JSON.stringify(l,null,2))' "$run/app/layouts/demo.json"
do_ layout.switch --name demo

json() { node -e 'console.log(JSON.stringify(Object.fromEntries(process.argv.slice(1).map((a)=>{const i=a.indexOf("=");const v=a.slice(i+1);return [a.slice(0,i),v.startsWith("[")?JSON.parse(v):v]}))))' "$@"; }
agent() { printf '["/bin/sh","%s","%s","%s"]' "$fx/agent.sh" "$1" "$fx/screens/$2.txt"; }
term() { printf '["/bin/sh","%s","%s","%s"]' "$fx/term.sh" "$1" "$fx/screens/$2.txt"; }
space() { herdr-app do space.new "$(json name="$1" folder="$user/code/$1" tab="$2" argv="$3")" | node -pe 'JSON.parse(require("fs").readFileSync(0)).space'; }
s1=$(space bookshelf reminders "$(agent working reminders)")
do_ tab.new "$(json space="$s1" name=tests folder="$user/code/bookshelf" argv="$(term "npm test" tests)")"
s2=$(space orbit-sync login "$(agent blocked login)")
do_ tab.new "$(json space="$s2" name=dev folder="$user/code/orbit-sync" argv="$(term "npm run dev" dev)")"
space ledger export "$(agent idle export)" > /dev/null
do_ space.select --id "$s1"; do_ tab.select --index 1
do_ space.select --index 3
sleep 3
# A fresh home greets with the welcome or what's-new screen: close whatever the app opened by itself.
overlays() { herdr-app status | node -pe 'JSON.parse(require("fs").readFileSync(0)).overlays.length'; }
for _ in 1 2 3; do [ "$(overlays)" = 0 ] || do_ overlay.close; done
[ "$(overlays)" = 0 ] || echo "warning: an overlay stays open: $(herdr-app status | tr -d "\n ")" >&2

# A covered window draws only when resized, so every shot nudges it (maximize and back) first. Your mouse over the
# demo window can leave a hover highlight on a row: look at the shots and run again if one has it.
snap() { do_ window.maximize; sleep 0.8; do_ window.maximize; sleep 0.8; herdr-app shot "$1" > /dev/null; }
query() { printf '%s' "$1" > "$run/app/control/query.txt"; sleep "${2:-0.4}"; }
crop() { ffmpeg -loglevel error -y -i "$1" -vf "crop=$3" "$2"; } # in, out, w:h:x:y (window pixels at 2x)

# Screenshots.
is_open() { herdr-app status | grep -q '"goto"' || { echo "Go to did not open" >&2; do_ app.quit; HOME="$user" hc server stop; exit 1; }; }
do_ mod.open --name goto; sleep 1; is_open
query "reminder mail" 2; snap "$frames/s1.png"; crop "$frames/s1.png" "$root/preview.png" 1960:600:0:0
query "https://github.com/acme/bookshelf/pull/7" 2.5; snap "$frames/s2.png"; crop "$frames/s2.png" "$out/pr-link.png" 1400:520:580:70
query "orbit" 2; snap "$frames/s3.png"; crop "$frames/s3.png" "$out/repo-name.png" 1400:720:580:70
query "zoom" 2; snap "$frames/s4.png"; crop "$frames/s4.png" "$out/commands.png" 1400:600:580:70
query "bookshelf: add retry to the mailer" 2; snap "$frames/s5.png"; crop "$frames/s5.png" "$out/start-agent.png" 1400:440:580:70
do_ mod.open --name goto # again: closes it
query ""

# The walkthrough: closed, ⌘⇧P (the empty box), typing "reminder mail", Enter focuses the agent.
n=0
frame() { n=$((n + 1)); snap "$frames/f$(printf %02d $n).png"; echo "file 'f$(printf %02d $n).png'" >> "$frames/list.txt"; echo "duration $1" >> "$frames/list.txt"; }
: > "$frames/list.txt"
frame 1.2
do_ mod.open --name goto; sleep 1; is_open; frame 1.4
q="r"; for c in e m i n d e r " " m a i l; do q="$q$c"; query "$q"; frame 0.12; done
frame 1.6
t=$(herdr-app ls | node -pe 'JSON.parse(require("fs").readFileSync(0)).spaces[0].tabs[0].terminals[0].terminal')
do_ mod.open --name goto; do_ pane.focus --terminal "$t"; sleep 1; frame 2.5
echo "file 'f$(printf %02d $n).png'" >> "$frames/list.txt" # the concat demuxer needs the last file twice
(cd "$frames" && ffmpeg -loglevel error -y -f concat -i list.txt -vf "scale=1100:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" -loop 0 "$out/walkthrough.gif")

[ -z "${KEEP:-}" ] || exit 0 # KEEP=1: leave the demo window open to try things
do_ app.quit || true
HOME="$user" hc server stop > /dev/null || true
ls -l "$root/preview.png" "$out"
