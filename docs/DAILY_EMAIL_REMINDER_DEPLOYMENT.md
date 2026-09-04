# Daily Email Reminder Deployment Runbook

This runbook prepares the E1–E4 daily email reminder implementation for a controlled production rollout. Do not execute these commands until the E6 deterministic checks and the E7 controlled acceptance plan are approved.

## Known deployment facts

| Setting | Value or status | Repository source |
| --- | --- | --- |
| Google Cloud project | `govprep-v3` | `firebase-applet-config.json` |
| Cloud Run service | `reading-the-signals` | `README.md` deployment command |
| Cloud Run region | `us-central1` | `README.md` deployment command |
| Cloud Run source deployment | `gcloud run deploy reading-the-signals --source . ...` | `README.md` |
| Production URL/Cloud Run host | `<CLOUD_RUN_URL>` | Not recorded; README contains a placeholder |
| Runtime service account | `<RUNTIME_SERVICE_ACCOUNT>` | Not recorded |
| Firestore database | `ai-studio-readingthesignal-15c72f10-00f5-4c77-9363-cdd03a67fe6e` | `firebase-applet-config.json` and `server.ts` |
| Existing server secret | `GEMINI_API_KEY` | `.env.example` and README |

Set these shell placeholders before adapting any command:

```bash
PROJECT_ID="govprep-v3"
CLOUD_RUN_SERVICE="reading-the-signals"
REGION="us-central1"
CLOUD_RUN_URL="<CLOUD_RUN_URL>"
RUNTIME_SERVICE_ACCOUNT="<RUNTIME_SERVICE_ACCOUNT>"
SCHEDULER_SERVICE_ACCOUNT_NAME="reading-signals-reminder-scheduler"
SCHEDULER_SERVICE_ACCOUNT="${SCHEDULER_SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SCHEDULER_JOB="reading-signals-daily-email-reminders"
SCHEDULER_LOCATION="us-central1"
REMINDER_ENDPOINT="${CLOUD_RUN_URL}/internal/daily-email-reminders"
FIRESTORE_DATABASE="ai-studio-readingthesignal-15c72f10-00f5-4c77-9363-cdd03a67fe6e"
```

Confirm the live URL and runtime identity rather than inferring them:

```bash
gcloud run services describe "${CLOUD_RUN_SERVICE}" --project="${PROJECT_ID}" --region="${REGION}" --format='value(status.url)'
gcloud run services describe "${CLOUD_RUN_SERVICE}" --project="${PROJECT_ID}" --region="${REGION}" --format='value(spec.template.spec.serviceAccountName)'
```

If the second command is empty, determine the effective default Compute Engine service account from Cloud Run before granting secret access. Never substitute the Scheduler service account for the runtime service account.

## A. Prerequisites

1. Use an operator identity authorized to manage Cloud Run, Scheduler, service accounts, IAM, Secret Manager, and Firestore indexes in `govprep-v3`.
2. Confirm `gcloud config get-value project` and every explicit `--project` value.
3. Run all repository tests and build checks from the intended branch.
4. Record the current Cloud Run revision, environment variables, secrets, public-access configuration, and runtime service account for rollback:

   ```bash
   gcloud run services describe "${CLOUD_RUN_SERVICE}" --project="${PROJECT_ID}" --region="${REGION}" --format=export
   ```

5. Preserve the existing `GEMINI_API_KEY` secret mapping and all unrelated environment variables.

## B. Configure Resend

1. Create or use the production Resend account.
2. Add a domain or dedicated sending subdomain owned by the project. Resend recommends a subdomain to isolate sending reputation.
3. Publish the SPF and DKIM records shown by Resend and wait until the domain is fully verified.
4. Choose a sender on that exact verified domain, for example:

   ```text
   Reading the Signals <reminders@<VERIFIED_DOMAIN>>
   ```

5. Prefer a sender address that can receive replies. Do not use `example.com` in production.
6. Create a narrowly scoped Resend API key capable of sending email. Never place it in source, `.env.example`, a command argument, logs, or tickets.

The production `REMINDER_EMAIL_FROM` domain must exactly match a domain authorized in Resend before E7.

## C. Store the Resend key in Secret Manager

Use hidden/interactively supplied stdin rather than embedding the key in shell history. The operator may instead use the Secret Manager console.

Create the secret and first version:

```bash
read -rsp "Resend API key: " RESEND_API_KEY_VALUE; echo
printf %s "${RESEND_API_KEY_VALUE}" | gcloud secrets create RESEND_API_KEY \
  --project="${PROJECT_ID}" \
  --replication-policy=automatic \
  --data-file=-
unset RESEND_API_KEY_VALUE
```

For rotation or when the secret already exists:

```bash
read -rsp "New Resend API key: " RESEND_API_KEY_VALUE; echo
printf %s "${RESEND_API_KEY_VALUE}" | gcloud secrets versions add RESEND_API_KEY \
  --project="${PROJECT_ID}" \
  --data-file=-
unset RESEND_API_KEY_VALUE
```

Grant only the Cloud Run runtime identity access to this secret:

```bash
gcloud secrets add-iam-policy-binding RESEND_API_KEY \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

Pin a tested numeric secret version for production where operationally practical. Do not change, rotate, or remove the existing Gemini secret mapping.

## D. Create the dedicated Scheduler identity

Create a service account used only by this job:

```bash
gcloud iam service-accounts create "${SCHEDULER_SERVICE_ACCOUNT_NAME}" \
  --project="${PROJECT_ID}" \
  --display-name="Reading Signals reminder scheduler"
```

Grant the narrow Cloud Run invocation role on this service only:

```bash
gcloud run services add-iam-policy-binding "${CLOUD_RUN_SERVICE}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --member="serviceAccount:${SCHEDULER_SERVICE_ACCOUNT}" \
  --role="roles/run.invoker"
```

The human or deployment identity creating the Scheduler job also needs permission to act as this service account (`iam.serviceAccounts.actAs`), normally via `roles/iam.serviceAccountUser` scoped to this service account. Do not grant Editor or Owner.

Cloud Scheduler's service agent must retain its Google-managed `roles/cloudscheduler.serviceAgent` role so it can mint the OIDC token. Do not replace that service agent with the dedicated client identity.

## E. Preserve the public Cloud Run application

The React application and Express API share one Cloud Run service. The web application must remain public. Cloud Run IAM applies to a service, not an individual Express route, so it cannot make only `/internal/daily-email-reminders` private while leaving the remaining routes public.

Consequently, the internal route's security boundary on this shared public service is the application's signed Google OIDC verification: signature, audience, issuer, verified email, and exact Scheduler service-account identity. The `roles/run.invoker` binding documents least-privilege intent but does not create an additional route-level barrier when unauthenticated invocation remains allowed for the service.

Do not remove `--allow-unauthenticated`, enable the service-wide Invoker IAM check, or otherwise make the whole service private without a separate migration plan.

## F. Create the required Firestore index

The E4 query filters a collection group:

```text
collectionGroup("settings").where("enabled", "==", true).limit(100)
```

Firestore does not maintain collection-group-scoped automatic indexes by default. This filtered query requires a single-field collection-group index for `settings.enabled`. It is not a composite index.

First inspect any existing field override in the named database:

```bash
gcloud firestore indexes fields describe enabled \
  --project="${PROJECT_ID}" \
  --database="${FIRESTORE_DATABASE}" \
  --collection-group=settings
```

If it is absent, enable collection-group ascending and descending indexes. The update command replaces that field's current single-field index configuration, so preserve any existing modes discovered above:

```bash
gcloud firestore indexes fields update enabled \
  --project="${PROJECT_ID}" \
  --database="${FIRESTORE_DATABASE}" \
  --collection-group=settings \
  --index=order=ASCENDING \
  --index=order=DESCENDING
```

Wait for the index operation to complete before enabling the Scheduler. These commands explicitly target `ai-studio-readingthesignal-15c72f10-00f5-4c77-9363-cdd03a67fe6e`; omitting `--database` risks configuring the default database instead.

No `firebase.json` or index file is added in E5 because this repository currently has no Firebase deployment configuration and adding one could couple index deployment to the existing rules unexpectedly.

## G. Configure Cloud Run

Canonical values:

```text
APP_BASE_URL=<CLOUD_RUN_URL>
REMINDER_SCHEDULER_SERVICE_ACCOUNT=reading-signals-reminder-scheduler@govprep-v3.iam.gserviceaccount.com
REMINDER_SCHEDULER_AUDIENCE=<CLOUD_RUN_URL>/internal/daily-email-reminders
```

`APP_BASE_URL` is the HTTPS service origin without a trailing slash. The canonical OIDC audience is the entire endpoint URL, with no query string. The Scheduler target URI, Scheduler `--oidc-token-audience`, and Cloud Run `REMINDER_SCHEDULER_AUDIENCE` must be byte-for-byte identical.

For an existing service, use additive update flags:

```bash
gcloud run services update "${CLOUD_RUN_SERVICE}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --update-secrets="RESEND_API_KEY=RESEND_API_KEY:<TESTED_NUMERIC_VERSION>" \
  --update-env-vars="REMINDER_EMAIL_FROM=Reading the Signals <reminders@<VERIFIED_DOMAIN>>" \
  --update-env-vars="APP_BASE_URL=${CLOUD_RUN_URL}" \
  --update-env-vars="REMINDER_SCHEDULER_SERVICE_ACCOUNT=${SCHEDULER_SERVICE_ACCOUNT}" \
  --update-env-vars="REMINDER_SCHEDULER_AUDIENCE=${REMINDER_ENDPOINT}"
```

Then deploy the tested source without resetting configuration:

```bash
gcloud run deploy "${CLOUD_RUN_SERVICE}" \
  --source . \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --platform=managed \
  --allow-unauthenticated \
  --port=3000
```

Before running either command, compare the exported current configuration. `--set-env-vars` and `--set-secrets` are destructive replacement operations; do not use them here. `--update-env-vars` and `--update-secrets` are additive, but keys explicitly named still change. Confirm after deployment that `GEMINI_API_KEY` and all unrelated settings remain mapped.

For a first-ever service deployment, assemble one reviewed deploy command containing both the existing Gemini mapping and reminder configuration; do not blindly use this update sequence.

## H. Create Cloud Scheduler only when E7 authorizes it

Cloud Scheduler should run every five minutes in UTC. User-local timezone and due-time decisions remain inside E2.

```bash
gcloud scheduler jobs create http "${SCHEDULER_JOB}" \
  --project="${PROJECT_ID}" \
  --location="${SCHEDULER_LOCATION}" \
  --schedule="*/5 * * * *" \
  --time-zone="Etc/UTC" \
  --uri="${REMINDER_ENDPOINT}" \
  --http-method=POST \
  --oidc-service-account-email="${SCHEDULER_SERVICE_ACCOUNT}" \
  --oidc-token-audience="${REMINDER_ENDPOINT}" \
  --attempt-deadline=120s \
  --max-retry-attempts=0 \
  --description="Check due Reading the Signals daily email reminders"
```

For this application's explicit audience verification, use the full endpoint URL as the canonical audience. Cloud Scheduler permits an explicit audience and recommends the target URL without URL parameters; this route has no query parameters.

Do not create the job until the E7 controlled test is ready. If created before it should run, pause it immediately and verify its state before configuring recipients:

```bash
gcloud scheduler jobs pause "${SCHEDULER_JOB}" --project="${PROJECT_ID}" --location="${SCHEDULER_LOCATION}"
gcloud scheduler jobs describe "${SCHEDULER_JOB}" --project="${PROJECT_ID}" --location="${SCHEDULER_LOCATION}"
```

## I. Authentication and safe verification

Before allowing any live email:

1. Confirm an unauthenticated POST receives `401` and GET receives `405`. This verifies routing only; it does not send because authentication fails.
2. Confirm a signed token with the wrong audience or identity is rejected using a non-production test environment.
3. Keep the Scheduler absent or paused while checking Cloud Run logs for generic status only. Never log tokens or recipient addresses.
4. Confirm missing reminder email configuration fails before candidate discovery/sending.
5. Restrict the first live acceptance to the controlled verified account defined in E7. The current E4 processor does not yet provide an allowlist, so do not unpause a production job containing general enabled users until the E7 mechanism and procedure are approved.

## J. Rollback and kill switch

The fastest operational kill switch is pausing the Scheduler job:

```bash
gcloud scheduler jobs pause "${SCHEDULER_JOB}" --project="${PROJECT_ID}" --location="${SCHEDULER_LOCATION}"
```

Verify it is paused:

```bash
gcloud scheduler jobs describe "${SCHEDULER_JOB}" --project="${PROJECT_ID}" --location="${SCHEDULER_LOCATION}"
```

Delete only if permanent removal is intended:

```bash
gcloud scheduler jobs delete "${SCHEDULER_JOB}" --project="${PROJECT_ID}" --location="${SCHEDULER_LOCATION}"
```

If credentials may be compromised, revoke the Resend key in Resend and disable the corresponding Secret Manager version. Create a new key/version before resuming; do not print either value. Roll Cloud Run back to the previously recorded healthy revision if application rollback is required.

Pausing or deleting this Scheduler affects only background email checks. It does not disable or change the existing foreground/in-app `DailyReminderRuntime` behavior.

## Pre-live checklist

- [ ] Intended branch, lockfile, tests, lint, and production build verified.
- [ ] Cloud project is `govprep-v3`; service and region independently confirmed.
- [ ] Resend sender domain/subdomain is verified.
- [ ] `REMINDER_EMAIL_FROM` exactly uses that verified domain.
- [ ] `APP_BASE_URL` is the correct HTTPS production origin.
- [ ] Dedicated Scheduler service-account email is exact.
- [ ] Scheduler target, OIDC audience, and `REMINDER_SCHEDULER_AUDIENCE` are identical full endpoint URLs.
- [ ] Unauthenticated POST is rejected and GET cannot execute processing.
- [ ] Admin Firestore still explicitly selects `ai-studio-readingthesignal-15c72f10-00f5-4c77-9363-cdd03a67fe6e`.
- [ ] Required `settings.enabled` collection-group index is ready in that named database.
- [ ] Existing `GEMINI_API_KEY` and unrelated Cloud Run configuration are preserved.
- [ ] Web application remains publicly accessible.
- [ ] Scheduler is absent or confirmed paused.
- [ ] E7 first live send is restricted to one controlled, verified test account.
- [ ] Kill-switch operator and rollback revision are recorded.

## Deferred E8 reliability hardening

A delivery left in `claimed` after a process crash or an uncertain post-send persistence failure is intentionally not reclaimed automatically. This preserves at-most-once delivery: changing it to `failed` could resend an email that the provider already accepted. E8 should define an operational reconciliation policy and, only with provider-delivery evidence or a safely bounded lease/idempotency design, stale-claim recovery.
