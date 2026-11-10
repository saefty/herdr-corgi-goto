#!/bin/sh
# A stand-in agent: reports its status the way coding agents do (OSC 7501), then shows a fixed screen.
#   agent.sh <working|blocked|idle> <screen file>
printf '\033]7501;app=claude-code:state=%s\007' "$1"
clear
cat "$2"
exec sleep 86400
