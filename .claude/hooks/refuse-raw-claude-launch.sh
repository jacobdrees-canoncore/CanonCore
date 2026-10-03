#!/usr/bin/env bash
# PreToolUse on Bash: refuse a raw `orca terminal create ... claude`. Agents start through the
# dispatch skill's launch.sh, which holds a lock and checks for a Claude tab already standing in the
# worktree: on 1-2 Oct 2026 a timed-out raw create was run again and three worktrees got two agents.
command=$(jq -r '.tool_input.command // empty')
if grep -Eq 'orca[[:space:]]+terminal[[:space:]]+create.*(^|[[:space:]"'"'"'=;&|(])claude([[:space:]"'"'"';&|)]|$)' <<<"$command"; then
  echo "Refused: start a Claude agent with ~/.claude/skills/dispatch/launch.sh <worktree> <TEAM>-<n>, never a raw \`orca terminal create ... claude\` (CanonCore .claude/settings.json)." >&2
  exit 2
fi
exit 0
