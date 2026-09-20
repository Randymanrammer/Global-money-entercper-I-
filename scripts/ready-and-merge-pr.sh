#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-Randymanrammer/Global-money-entercper-I-}"
PR_NUMBER="${PR_NUMBER:-}"
APPROVE_PR="${APPROVE_PR:-true}"
APPROVAL_TOKEN="${APPROVAL_TOKEN:-}"
ADMIN_MERGE="${ADMIN_MERGE:-false}"

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

  if [[ "$APPROVE_PR" == "true" && -n "$APPROVAL_TOKEN" ]]; then
    GH_TOKEN="$APPROVAL_TOKEN" gh pr review "$PR" --repo "$REPO" --approve --body "Auto-approved via automated script."
  fi

  REVIEW_DECISION="$(gh pr view "$PR" --repo "$REPO" --json reviewDecision --jq '.reviewDecision // ""')"
  MERGE_STATE_STATUS="$(gh pr view "$PR" --repo "$REPO" --json mergeStateStatus --jq '.mergeStateStatus // ""')"
  if [[ "$APPROVE_PR" == "true" && -z "$APPROVAL_TOKEN" && "$REVIEW_DECISION" == "REVIEW_REQUIRED" ]]; then
    echo "Skipping PR #${PR} because approval is still required and APPROVAL_TOKEN is not configured."
    continue
  fi

  if [[ "$MERGE_STATE_STATUS" != "CLEAN" ]]; then
    echo "Skipping PR #${PR} because it is not currently mergeable (mergeStateStatus=$MERGE_STATE_STATUS)."
    continue
  fi

  MERGE_ARGS=(--merge --delete-branch)
  if [[ "$ADMIN_MERGE" == "true" ]]; then
    MERGE_ARGS+=(--admin)
  fi

  gh pr merge "$PR" --repo "$REPO" "${MERGE_ARGS[@]}"

  echo "PR #${PR} merged and branch deleted successfully!"
done
