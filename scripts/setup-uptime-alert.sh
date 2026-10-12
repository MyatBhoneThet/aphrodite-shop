#!/usr/bin/env bash
#
# Uptime alert for the shop: Google Cloud checks https://<host>/api/health?deep=1
# every minute from several countries and emails you when it fails.
#
# Safe to run again: it reuses what already exists (matched by display name).
#
#   scripts/setup-uptime-alert.sh <host> <alert-email> [project-id]
#
#   host         the shop's address without https://, e.g.
#                aphrodite-shop-672175800144.asia-southeast1.run.app
#   alert-email  where to send "the shop is down" emails
#   project-id   defaults to the gcloud project you are signed in to
#
# Cost: one check a minute from 6 regions is about 260,000 checks a month; the
# first 1,000,000 a month are free, and alert policies / email are free.
#
# To remove everything later:
#   gcloud monitoring uptime delete <CHECK_ID>
#   gcloud monitoring policies delete <POLICY_ID>
#   (and the "Aphrodite shop alerts" channel in Console > Monitoring > Alerting)

set -euo pipefail

HOST="${1:-}"
EMAIL="${2:-}"
PROJECT="${3:-$(gcloud config get-value project 2>/dev/null)}"
CHECK_NAME="Aphrodite shop health"
CHANNEL_NAME="Aphrodite shop alerts"
POLICY_NAME="Aphrodite shop is down"
CHECK_PATH="/api/health?deep=1"

if [[ -z "$HOST" || -z "$EMAIL" || -z "$PROJECT" ]]; then
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
fi
HOST="${HOST#https://}"; HOST="${HOST%%/*}"

TOKEN="$(gcloud auth print-access-token)"
API="https://monitoring.googleapis.com/v3/projects/${PROJECT}"
auth=(-H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" -H "x-goog-user-project: ${PROJECT}")

echo "Project: ${PROJECT}"
echo "Checking: https://${HOST}${CHECK_PATH}"
echo "Emailing: ${EMAIL}"
echo

# 1. Email notification channel -------------------------------------------------
CHANNEL="$(curl -fsS "${auth[@]}" "${API}/notificationChannels" \
  | python3 -c '
import json,sys
name=sys.argv[1]; email=sys.argv[2]
for c in json.load(sys.stdin).get("notificationChannels",[]):
    if c.get("displayName")==name and c.get("labels",{}).get("email_address")==email:
        print(c["name"]); break
' "$CHANNEL_NAME" "$EMAIL")"

if [[ -z "$CHANNEL" ]]; then
  CHANNEL="$(curl -fsS "${auth[@]}" -X POST "${API}/notificationChannels" \
    -d "{\"type\":\"email\",\"displayName\":\"${CHANNEL_NAME}\",\"labels\":{\"email_address\":\"${EMAIL}\"}}" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["name"])')"
  echo "Created email channel: ${CHANNEL}"
else
  echo "Using existing email channel: ${CHANNEL}"
fi

# 2. Uptime check ---------------------------------------------------------------
CHECK_ID="$(gcloud monitoring uptime list-configs --project="${PROJECT}" --format=json \
  | python3 -c '
import json,sys
for c in json.load(sys.stdin):
    if c.get("displayName")==sys.argv[1]:
        print(c["name"].split("/")[-1]); break
' "$CHECK_NAME")"

if [[ -z "$CHECK_ID" ]]; then
  gcloud monitoring uptime create "${CHECK_NAME}" --project="${PROJECT}" \
    --resource-type=uptime-url \
    --resource-labels="host=${HOST},project_id=${PROJECT}" \
    --protocol=https --path="${CHECK_PATH}" --request-method=get \
    --status-classes=2xx --validate-ssl=true \
    --period=1 --timeout=10 >/dev/null
  CHECK_ID="$(gcloud monitoring uptime list-configs --project="${PROJECT}" --format=json \
    | python3 -c '
import json,sys
for c in json.load(sys.stdin):
    if c.get("displayName")==sys.argv[1]:
        print(c["name"].split("/")[-1]); break
' "$CHECK_NAME")"
  echo "Created uptime check: ${CHECK_ID}"
else
  echo "Using existing uptime check: ${CHECK_ID}"
fi

# 3. Alert policy: the check fails from at least two regions for a minute ------
EXISTING_POLICY="$(curl -fsS "${auth[@]}" "${API}/alertPolicies" \
  | python3 -c '
import json,sys
for p in json.load(sys.stdin).get("alertPolicies",[]):
    if p.get("displayName")==sys.argv[1]:
        print(p["name"]); break
' "$POLICY_NAME")"

if [[ -n "$EXISTING_POLICY" ]]; then
  echo "Using existing alert policy: ${EXISTING_POLICY}"
else
  POLICY_FILE="$(mktemp)"
  cat > "$POLICY_FILE" <<JSON
{
  "displayName": "${POLICY_NAME}",
  "combiner": "OR",
  "documentation": {
    "mimeType": "text/markdown",
    "content": "The shop's health check is failing from several places. Open https://${HOST}/api/health?deep=1 . If it says database false, check Supabase. If the page does not load at all, check Cloud Run."
  },
  "conditions": [{
    "displayName": "Health check failing",
    "conditionThreshold": {
      "filter": "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.label.check_id=\"${CHECK_ID}\" AND resource.type=\"uptime_url\"",
      "aggregations": [{
        "alignmentPeriod": "1200s",
        "perSeriesAligner": "ALIGN_NEXT_OLDER",
        "crossSeriesReducer": "REDUCE_COUNT_FALSE",
        "groupByFields": ["resource.label.*"]
      }],
      "comparison": "COMPARISON_GT",
      "thresholdValue": 1,
      "duration": "60s",
      "trigger": {"count": 1}
    }
  }],
  "notificationChannels": ["${CHANNEL}"]
}
JSON
  gcloud monitoring policies create --project="${PROJECT}" --policy-from-file="${POLICY_FILE}" >/dev/null
  rm -f "$POLICY_FILE"
  echo "Created alert policy: ${POLICY_NAME}"
fi

echo
echo "Done. You will be emailed at ${EMAIL} if the shop stops answering."
echo "Look at it any time: https://console.cloud.google.com/monitoring/uptime?project=${PROJECT}"
