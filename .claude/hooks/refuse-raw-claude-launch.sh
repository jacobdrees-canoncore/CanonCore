#!/usr/bin/env bash
# PreToolUse on Bash: refuse a raw `orca terminal create ... --command claude`. Agents start through
# the dispatch skill's launch.sh, which holds a lock and checks for a Claude tab already standing in
# the worktree: on 1-2 Oct 2026 a timed-out raw create was run again and three worktrees got two agents.
# It matches only a create whose --command runs claude, so text that merely names the form passes.
# Unreadable input (no jq, bad JSON) reads as an empty command and passes: failing closed would
# refuse every Bash call.
command=$(jq -r '.tool_input.command // empty' | tr '\n' ' ')
if grep -Eq 'orca[[:space:]]+terminal[[:space:]]+create[[:space:]].*--command[=[:space:]]+["'"'"']?([^[:space:]"'"'"']*/)?claude([[:space:]"'"'"';&|)]|$)' <<<"$command"; then
  echo "Refused: start a Claude agent with ~/.claude/skills/dispatch/launch.sh <worktree> <TEAM>-<n>, never a raw \`orca terminal create ... claude\` (CanonCore .claude/settings.json)." >&2
  exit 2
fi
exit 0
