#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-Randymanrammer/Global-money-entercper-I-}"
PR_NUMBER="${PR_NUMBER:-}"

if [[ -n "$PR_NUMBER" ]]; then
  PR_NUMBERS="$PR_NUMBER"
else
  echo "Fetching open pull requests for $REPO..."
  PR_NUMBERS="$(gh pr list --repo "$REPO" --json number --jq '.[].number')"
fi

if [[ -z "$PR_NUMBERS" ]]; then
  echo "No open pull requests found."
  exit 0
fi

for PR in $PR_NUMBERS; do
  echo "----------------------------------------"
  echo "Processing PR #${PR}..."

  gh pr ready "$PR" --repo "$REPO" 2>/dev/null || true
  gh pr review "$PR" --repo "$REPO" --approve --body "Auto-approved via automated script." 2>/dev/null || true
  gh pr merge "$PR" --repo "$REPO" --merge --delete-branch --admin

  echo "PR #${PR} merged and branch deleted successfully!"
done
