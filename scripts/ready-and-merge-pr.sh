#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-Randymanrammer/Global-money-entercper-I-}"
PR_NUMBER="${PR_NUMBER:-}"
APPROVE_PR="${APPROVE_PR:-true}"
APPROVAL_TOKEN="${APPROVAL_TOKEN:-}"

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

  IS_DRAFT="$(gh pr view "$PR" --repo "$REPO" --json isDraft --jq '.isDraft')"
  if [[ "$IS_DRAFT" == "true" ]]; then
    gh pr ready "$PR" --repo "$REPO"
  fi

  if [[ "$APPROVE_PR" == "true" ]]; then
    if [[ -n "$APPROVAL_TOKEN" ]]; then
      GH_TOKEN="$APPROVAL_TOKEN" gh pr review "$PR" --repo "$REPO" --approve --body "Auto-approved via automated script."
    else
      gh pr review "$PR" --repo "$REPO" --approve --body "Auto-approved via automated script."
    fi
  fi

  gh pr merge "$PR" --repo "$REPO" --merge --delete-branch --admin

  echo "PR #${PR} merged and branch deleted successfully!"
done
