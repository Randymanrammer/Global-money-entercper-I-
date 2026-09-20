#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-Randymanrammer/Global-money-entercper-I-}"
PR_NUMBER="${PR_NUMBER:-3}"

echo "=== Marking PR #${PR_NUMBER} as ready for review ==="
gh pr ready "$PR_NUMBER" --repo "$REPO"

echo "=== Merging PR #${PR_NUMBER} into main ==="
gh pr merge "$PR_NUMBER" --repo "$REPO" --merge --delete-branch

echo "=== PR #${PR_NUMBER} has been successfully merged! ==="
