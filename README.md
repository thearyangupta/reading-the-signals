# Reading the Signals

A private, evidence-linked reflection journal that uses Gemini to help you see patterns, contradictions, and shifts across your own journal history — not just summarize one entry at a time.

**Live demo:** https://signals.flowpilot-ai.site
**Demo video:** coming before final submission

## Why I Built This

Traditional journaling records thoughts, but people often struggle to recognize recurring patterns, contradictions, changes in perspective, and signals distributed across many entries. A single entry can capture a moment clearly, but noticing what repeats, what changed, or where your own read on a situation shifted usually takes rereading everything yourself.

Reading the Signals uses grounded Gemini reasoning to help users reflect across their own journal history while keeping the evidence connected back to their original entries — so the AI's observations are inspectable, not just asserted.

## What Makes It Different

1. **Evidence-linked recurring pattern analysis** — surfaces themes and triggers that repeat across entries, with every claim traceable to the specific entries that support it.
2. **Perspective differences / contradictions across entries** — gently highlights where similar situations were interpreted differently over time, framed as observation rather than accusation.
3. **Signal Timeline / longitudinal reflection** — organizes meaningful shifts in perspective, emotion, or focus across dated entries, not just a chronological list.
4. **Ask My Journal with grounded responses** — answers questions using only the user's own entries, and says so explicitly when there isn't enough evidence rather than guessing.
5. **Reflection Wrapped / Then vs Now** — turns pattern and timeline results into a concise before/after narrative.
6. **Daily reminder workflow** — a real backend pipeline, not a toy cron job:
   - timezone-aware due-time evaluation (DST-safe)
   - journal-today suppression (no reminder if you already wrote)
   - deterministic per-user/per-day delivery idempotency
   - Cloud Scheduler + OIDC-authenticated trigger
   - automatic recovery of a delivery stuck mid-crash after a 15-minute stale-claim TTL
7. **Layered privacy/security** — Firebase Authentication, server-side ID token verification on every AI endpoint, and independent Firestore per-user security rules.

## Google Cloud Architecture

```text
Browser
  -> Firebase Authentication
  -> Cloud Run application
       -> Gemini API
       -> Cloud Firestore
       -> Secret Manager

Cloud Scheduler
  -> OIDC-authenticated reminder endpoint
  -> reminder eligibility/idempotency
  -> email provider
```

The Vite client and Express API are built and served as one Cloud Run service. AI endpoints verify a Firebase ID token before calling Gemini, and every Firestore access — from the client or the server's reminder pipeline — is scoped to a single authenticated user.

## How Gemini Is Used

Gemini is called through server-side Express endpoints to:

- summarize entries and support reflection analysis;
- identify recurring signals across selected entries;
- construct longitudinal timelines and comparisons;
- answer questions grounded in selected journal entries; and
- return structured evidence references that the server validates against the reflections supplied for analysis before the UI links them to source entries.

AI output is presented as a reflection aid, not as medical advice or a claim about another person's hidden thoughts.

## Daily Reminder — Known Limitations / Demo Environment

The daily reminder workflow and its authenticated Cloud Scheduler trigger have been implemented and acceptance-tested end-to-end (Scheduler → OIDC → Cloud Run → eligibility → idempotent delivery claim). However:

- **Outbound provider email delivery is currently disabled** until a valid Resend API credential is installed — the configured value is not a usable key.
- **Cloud Scheduler is intentionally paused** in the demo environment to avoid repeated failed automatic send attempts while that credential is outstanding.

No reminder emails currently reach an inbox. Everything upstream of the actual provider call — scheduling, authentication, eligibility, and exactly-once delivery bookkeeping — is functioning and demonstrable.

## Trust & Privacy Design

- Firebase Authentication supports Google sign-in and anonymous Guest access.
- Journal data is scoped per authenticated Firebase UID everywhere it's stored.
- Cloud Firestore security rules independently enforce that same per-user isolation — a client can only ever read or write its own `users/{uid}` document tree, and everything else is denied by default.
- Every AI endpoint verifies the caller's Firebase ID token server-side before calling Gemini.
- Secrets are not committed to source control; server credentials (Gemini, Resend) are expected to come from environment variables or Google Secret Manager, never from client code.
- Users choose whether analysis uses all reflections or a selected subset.
- Evidence IDs returned for cross-entry analysis are checked against the supplied reflections before display.
- `firebase-applet-config.json` contains Firebase Web SDK configuration. Firebase web configuration is intentionally client-visible and is not used as the application's authorization boundary; authorization is enforced through Firebase Authentication and Firestore security rules.

Journal text selected for an AI action is sent to Gemini for processing.

## Demo Flow

1. Sign in as a Guest or Google user.
2. Select **Add Sample Reflections** to import the sample story into that user's journal.
3. Open one reflection in **Journal** and show its structured AI observations.
4. Open **Insights**.
5. Ask one question with **Ask My Journal**.
6. Show **Signal Timeline** or **Reflection Wrapped**.
7. Open cited evidence to inspect the source reflection.

This flow is designed to fit a 3–5 minute judge demonstration.

## Sample Story

The included nine sample reflections form a chronological story about interpreting another person's signals, stepping back from repeated uncertainty, and noticing a change in perspective. They are imported into the signed-in user's normal Firestore journal and can be removed like other entries.

## Tech Stack

- React 19, TypeScript, Vite 6, and Tailwind CSS 4
- Node.js and Express
- Gemini through `@google/genai`
- Firebase Authentication and Cloud Firestore
- Google Cloud Run, Secret Manager, and Cloud Scheduler

## Reliability for Demo

Gemini generation uses a bounded, sequential model fallback: each model attempt has a 12-second deadline, and the complete server generation has a 28-second budget. The frontend adds a 32-second safety deadline to AI actions so loading states cannot wait indefinitely. SDK attempts are limited, there are no automatic application retries, and timeout, rate-limit, and generation failures receive short user-facing messages.

## Running Locally

Prerequisites: Node.js 20+, npm, a Firebase project with Google and anonymous authentication enabled, Cloud Firestore, and a Gemini API key.

```bash
npm install
cp .env.example .env
npm run dev
```

`.env.example` documents the environment variable **names** the app expects (`GEMINI_API_KEY`, `RESEND_API_KEY`, `REMINDER_EMAIL_FROM`, `APP_BASE_URL`, `REMINDER_SCHEDULER_SERVICE_ACCOUNT`, `REMINDER_SCHEDULER_AUDIENCE`, and others) — it contains no real values. Fill in your own local values in `.env`, never in `.env.example`, and never commit `.env` (it's already gitignored).

Configure the Firebase web app in `firebase-applet-config.json`, then deploy the included owner-isolating Firestore rules (`firestore.rules`) to the intended Firebase project.

Useful local checks:

```bash
npm run lint
npm run build
npm start
```

`npm run dev` serves the development app at `http://localhost:3000`. `npm start` runs the compiled production server after `npm run build`.

## Deployment

The deployment target is Google Cloud Run. The production build serves the compiled React app and Express API on a single port. Secrets (`GEMINI_API_KEY`, `RESEND_API_KEY`) should be injected from Secret Manager rather than embedded in the image or client bundle.

```bash
gcloud run deploy <SERVICE_NAME> \
  --source . \
  --region <YOUR_REGION> \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --set-secrets RESEND_API_KEY=RESEND_API_KEY:latest \
  --port 3000
```

Replace `<SERVICE_NAME>` and `<YOUR_REGION>` with your own Cloud Run service name and region (this project's live demo runs in `asia-southeast1`). Before deploying, create the secrets, grant the Cloud Run runtime service account access to them, configure the Firebase project, and deploy `firestore.rules`. For the full daily-reminder-specific deployment steps (dedicated Scheduler service account, OIDC audience configuration, Firestore indexes), see `docs/DAILY_EMAIL_REMINDER_DEPLOYMENT.md`.

**Live demo:** https://signals.flowpilot-ai.site
**Demo video:** coming before final submission

## For Evaluators

**Google technologies used:**

- Gemini API — reflection analysis, timelines, contradictions, and grounded Q&A
- Firebase Authentication — Google + anonymous sign-in, verified server-side on every AI call
- Cloud Firestore — per-user journal storage with independent security rules
- Cloud Run — hosts the single deployable Express + React service
- Secret Manager — holds provider credentials outside of source and the client bundle
- Cloud Scheduler — OIDC-authenticated trigger for the daily reminder pipeline

**Originality statement:** Reading the Signals goes beyond single-entry AI summarization by performing grounded reflection across a user's journal history while preserving links back to the underlying evidence.

## Ideathon Notes

This is not a chatbot layered on a journal. The core experience is longitudinal reflection with inspectable evidence from the user's own writing.
