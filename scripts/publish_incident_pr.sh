#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

command -v git >/dev/null || die "git is required"
command -v gh >/dev/null || die "GitHub CLI (gh) is required"
command -v python >/dev/null || die "python is required"

BRANCH="$(git branch --show-current)"

[ "$BRANCH" = "main" ] || die "Run this from main. Current branch: $BRANCH"

git diff --quiet -- . ':!incident.json' ||
  die "Other tracked files have changes. Commit or restore them first."

git diff --cached --quiet ||
  die "You already have staged changes. Clear them first."

[ -f incident.json ] || die "incident.json is missing"

python scripts/validate_incident.py

if git diff --quiet -- incident.json; then
  die "incident.json has no changes to publish."
fi

ACTIVE="$(
  python - <<'PY'
import json
from pathlib import Path
data = json.loads(Path("incident.json").read_text())
print("true" if data.get("active") else "false")
PY
)"

SEVERITY="$(
  python - <<'PY'
import json
from pathlib import Path
data = json.loads(Path("incident.json").read_text())
print(data.get("severity", "info"))
PY
)"

TITLE="$(
  python - <<'PY'
import json
from pathlib import Path
data = json.loads(Path("incident.json").read_text())
print(data.get("title", "").strip())
PY
)"

STAMP="$(date -u +%Y%m%d-%H%M%S)"

if [ "$ACTIVE" = "true" ]; then
  ACTION="publish"
  SLUG="$SEVERITY"

  COMMIT_TITLE="status: publish ${SEVERITY} incident"

  COMMIT_BODY="Publish the N3XI0M incident notice: ${TITLE:-Untitled incident}."

  PR_TITLE="status: publish ${SEVERITY} incident"

  PR_SUMMARY="Publishes a manual N3XI0M incident notice."
else
  ACTION="clear"
  SLUG="clear"

  COMMIT_TITLE="status: clear manual incident"

  COMMIT_BODY="Clear the active N3XI0M manual incident notice."

  PR_TITLE="status: clear manual incident"

  PR_SUMMARY="Clears the active manual N3XI0M incident notice."
fi

NEW_BRANCH="status/${ACTION}-${SLUG}-${STAMP}"

echo
echo "Preparing incident PR"
echo "  Action:   $ACTION"
echo "  Severity: $SEVERITY"
echo "  Title:    ${TITLE:-none}"
echo "  Branch:   $NEW_BRANCH"
echo

git switch -c "$NEW_BRANCH"

git add incident.json

git commit \
  -m "$COMMIT_TITLE" \
  -m "$COMMIT_BODY"

git push -u origin "$NEW_BRANCH"

gh pr create \
  --base main \
  --head "$NEW_BRANCH" \
  --title "$PR_TITLE" \
  --body "## Summary

$PR_SUMMARY

## Incident

- Active: $ACTIVE
- Severity: $SEVERITY
- Title: ${TITLE:-None}

## Validation

- incident.json validated successfully
- no unrelated tracked changes included

This PR was prepared using the N3XI0M incident publishing helper."

echo
echo "Incident PR created successfully."
echo
echo "Next:"
echo "  gh pr checks"
echo
echo "Then merge only after reviewing the notice."
