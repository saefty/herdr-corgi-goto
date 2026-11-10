#!/bin/sh
# A stand-in terminal program: sets the title, shows a fixed screen.   term.sh <title> <screen file>
printf '\033]0;%s\007' "$1"
clear
cat "$2"
exec sleep 86400
