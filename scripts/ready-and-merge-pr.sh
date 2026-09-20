#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-Randymanrammer/Global-money-entercper-I-}"
PR_NUMBER="${PR_NUMBER:-}"
APPROVE_PR="${APPROVE_PR:-true}"
APPROVAL_TOKEN="${APPROVAL_TOKEN:-}"
ADMIN_MERGE="${ADMIN_MERGE:-false}"

if [[ -n "$PR_NUMBER" ]]; then
  PR_LIST="$(gh pr view "$PR_NUMBER" --repo "$REPO" --json number,isDraft --jq '.')"
else
  echo "Fetching open pull requests for $REPO..."
  PR_LIST="$(gh pr list --repo "$REPO" --json number,isDraft --jq '.[]')"
fi

if [[ -z "$PR_LIST" ]]; then
  echo "No open pull requests found."
  exit 0
fi

echo "$PR_LIST" | jq -c '.' | while read -r pr; do
  PR="$(echo "$pr" | jq -r '.number')"
  IS_DRAFT="$(echo "$pr" | jq -r '.isDraft')"

  echo "----------------------------------------"
  echo "Processing PR #${PR}..."

  if [[ "$IS_DRAFT" == "true" ]]; then
    echo "Marking PR #${PR} as ready for review..."
    gh pr ready "$PR" --repo "$REPO" || true
  fi

  if [[ "$APPROVE_PR" == "true" && -n "$APPROVAL_TOKEN" ]]; then
    GH_TOKEN="$APPROVAL_TOKEN" gh pr review "$PR" --repo "$REPO" --approve --body "Auto-approved via automated script."
  fi

  for attempt in 1 2 3 4 5; do
    read -r REVIEW_DECISION MERGEABLE_STATE MERGE_STATE_STATUS < <(
      gh pr view "$PR" --repo "$REPO" --json reviewDecision,mergeable,mergeStateStatus --jq '[.reviewDecision // "", .mergeable // "", .mergeStateStatus // ""] | @tsv'
    )
    if [[ ! "$REVIEW_DECISION" =~ ^(REVIEW_REQUIRED|CHANGES_REQUESTED)$ && "$MERGEABLE_STATE" == "MERGEABLE" && ! "$MERGE_STATE_STATUS" =~ ^(BEHIND|BLOCKED|DIRTY|DRAFT|UNKNOWN)$ ]]; then
      break
    fi
    if [[ "$attempt" -lt 5 ]]; then
      sleep 2
    fi
  done

  if [[ "$REVIEW_DECISION" == "CHANGES_REQUESTED" ]]; then
    echo "Skipping PR #${PR} because changes are still requested."
    continue
  fi

  if [[ "$APPROVE_PR" == "true" && -z "$APPROVAL_TOKEN" && "$REVIEW_DECISION" == "REVIEW_REQUIRED" ]]; then
    echo "Skipping PR #${PR} because approval is still required and APPROVAL_TOKEN is not configured."
    continue
  fi

  if [[ "$MERGEABLE_STATE" != "MERGEABLE" || "$MERGE_STATE_STATUS" =~ ^(BEHIND|BLOCKED|DIRTY|DRAFT|UNKNOWN)$ ]]; then
    echo "Skipping PR #${PR} because it is not currently mergeable (mergeable=$MERGEABLE_STATE, mergeStateStatus=$MERGE_STATE_STATUS)."
    continue
  fi

  echo "Merging PR #${PR}..."
  MERGE_ARGS=(--merge --delete-branch)
  if [[ "$ADMIN_MERGE" == "true" ]]; then
    MERGE_ARGS+=(--admin)
  fi

  gh pr merge "$PR" --repo "$REPO" "${MERGE_ARGS[@]}" || \
    gh pr merge "$PR" --repo "$REPO" --auto --merge --delete-branch

  echo "PR #${PR} successfully processed!"
done
