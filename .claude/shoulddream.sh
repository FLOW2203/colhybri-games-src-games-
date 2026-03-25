#!/bin/bash
# Auto-Dream Hook — declenche si sessions > 5 ET derniere dream > 24h
MEMORY_FILE=".claude/memory.md"
SESSION_COUNT=$(grep "session_count:" $MEMORY_FILE | awk '{print $2}')
LAST_DREAM=$(grep "last_dream:" $MEMORY_FILE | awk '{print $2}')
NOW=$(date +%s)
LAST_TS=$(date -d "$LAST_DREAM" +%s 2>/dev/null || echo 0)
DIFF=$(( (NOW - LAST_TS) / 3600 ))

if [ "$SESSION_COUNT" -gt 5 ] && [ "$DIFF" -gt 24 ]; then
  echo "[AUTO-DREAM] Conditions remplies — lancement consolidation"
  echo "Sessions: $SESSION_COUNT | Derniere dream: ${DIFF}h ago"
fi
