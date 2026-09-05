# Reading the Signals

A private, evidence-linked reflection journal that uses Gemini to help you see patterns, contradictions, and shifts across your own journal history — not just summarize one entry at a time.

## Live Demo

- **Live Application:** https://signals.flowpilot-ai.site
- **Demo Video:** https://drive.google.com/file/d/15VFHujxMJYxZ3325XHtUUZ4eE0xPStmO/view?usp=sharing
- **Public Repository:** https://github.com/thearyangupta/reading-the-signals

## Why I Built This

Traditional journaling records thoughts, but people often struggle to recognize recurring patterns, contradictions, changes in perspective, and signals distributed across many entries. A single entry can capture a moment clearly, but noticing what repeats, what changed, or where your own read on a situation shifted usually takes rereading everything yourself.

Reading the Signals uses grounded Gemini reasoning to help users reflect across their own journal history while keeping the evidence connected back to their original entries — so the AI's observations are inspectable, not just asserted.

## What Reading the Signals Does

Most journals capture isolated moments. Reading the Signals helps you connect those moments over time:

**Reflect → Remember → Connect → Understand**

1. **Reflect** — write a structured entry; Gemini derives situation, behavior, feeling, context, theme, and tone directly from what you wrote.
2. **Remember** — save concrete facts, preferences, or intentions Gemini notices in an entry as durable, revisitable context.
3. **Connect** — the app analyzes multiple entries together to surface recurring patterns, contradictions, and evidence-linked relationships between reflections.
4. **Understand** — longitudinal views (Signal Timeline, Reflection Wrapped, Then vs Now) and grounded Q&A (Ask My Journal) turn accumulated reflections into a perspective on how you've changed.

## What Makes It Different

1. **Evidence-linked recurring pattern analysis** — surfaces themes and triggers that repeat across entries, with every claim traceable to the specific entries that support it, not presented as an unexplained assertion.
2. **Perspective differences / contradictions across entries** — gently highlights where similar situations were interpreted differently over time, framed as observation rather than accusation.
3. **Signal Timeline / longitudinal reflection** — organizes meaningful shifts in perspective, emotion, or focus across dated entries, not just a chronological list.
4. **Ask My Journal — journal-grounded reasoning** — answers questions using only the user's own entries, and says so explicitly when there isn't enough evidence rather than guessing. This is grounded retrieval over your own history, not a generic chatbot.
5. **Reflection Wrapped / Then vs Now** — turns pattern and timeline results into a concise before/after narrative of how a perspective changed.
6. **Remembered context** — lets you deliberately keep specific facts or intentions surfaced from an entry, rather than relying on the AI to silently "remember" things on its own.
7. **Production daily email reminder workflow** — a complete, deployed backend pipeline (see [Daily Reminder Architecture](#daily-reminder-architecture)), not a toy cron job.
8. **Layered privacy/security** — Firebase Authentication, server-side ID token verification on every AI endpoint, and independent Firestore per-user security rules.

## Key Features

- **Journal** — create, edit, and revisit private reflections; this is the foundation the rest of the product builds on.
- **Structured Gemini observations** — each entry is analyzed into situation, behavior/event, feeling/reaction, important context, subjects, theme, emotional tone, and the user's own stated interpretation, grounded strictly in what was written.
- **Remember** — Gemini can surface up to three concrete, explicitly-stated facts, preferences, or intentions per entry with a suggested follow-up action; the user chooses whether to save one, and each saved signal has a deterministic ID so re-saving the same signal doesn't create duplicates.
- **Recurring Patterns** — cross-entry analysis that requires at least two supporting entries per pattern and is server-verified against the actual supplied entries before display, so cited evidence can't be hallucinated.
- **Perspective Differences (contradictions)** — flags meaningfully different reactions to similar situations across entries, with a single supportive clarifying question per finding.
- **Signal Timeline** — identifies genuine shifts in perspective, emotion, interpretation, or focus over time, distinguishing observable behavior from the user's own interpretation.
- **Reflection Wrapped** and **Then vs Now** — turn pattern/timeline output into a concise longitudinal narrative.
- **Personal Themes** and **Connections** — group recurring ideas and surface evidence-linked relationships between reflections.
- **Ask My Journal** — grounded natural-language Q&A over selected reflections, with explicit "not enough evidence" responses and prompt-injection–resistant handling of both the question and the journal content.
- **Daily email reminders** — implemented, deployed, and production-verified (see below).

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

## How It Works

Gemini is called through server-side Express endpoints to:

- derive structured observations from a single entry;
- identify recurring signals and contradictions across selected entries;
- construct longitudinal timelines and comparisons;
- answer questions grounded in selected journal entries; and
- return structured evidence references that the server re-validates against the reflections actually supplied before the UI links them to source entries.

AI output is presented as a reflection aid, not as medical advice or a claim about another person's hidden thoughts. Every AI endpoint verifies the caller's Firebase ID token before calling Gemini, and users choose whether an analysis uses all reflections or a selected subset.

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
  -> Resend (email provider)
```

| Technology | Responsibility |
|---|---|
| Gemini API | AI reasoning — reflection analysis, grounded cross-entry patterns, contradictions, timelines, and Q&A |
| Firebase Authentication | User identity (Google sign-in and anonymous Guest access) |
| Cloud Firestore | Private, per-user journal and reminder data, enforced by security rules |
| Cloud Run | Production runtime for the combined Express API + React application |
| Secret Manager | Holds the Gemini and Resend credentials outside of source control and the client bundle |
| Cloud Scheduler | Triggers the daily reminder processor on a fixed cadence |
| OIDC | Authenticates the Scheduler-to-application reminder invocation, verified server-side against an exact service-account identity and audience |

The Vite client and Express API are built and served as a single Cloud Run service.

## Privacy & Security

- Firebase Authentication supports Google sign-in and anonymous Guest access.
- Journal data is scoped per authenticated Firebase UID everywhere it's stored.
- Cloud Firestore security rules independently enforce that same per-user isolation — a client can only ever read or write its own `users/{uid}` document tree; everything else is denied by default.
- Every AI endpoint verifies the caller's Firebase ID token server-side before calling Gemini.
- The reminder endpoint is not user-facing: it only accepts requests carrying a verified Google OIDC token issued to one exact, dedicated service-account identity with a matching audience — an unauthenticated or mismatched request is rejected before any processing occurs.
- Reminder emails contain no journal content — only a generic prompt to write today's reflection.
- Each user/day reminder delivery is claimed exactly once through a Firestore transaction, preventing duplicate sends; a delivery stuck mid-failure (e.g. a crash) becomes safely retryable after a bounded TTL, while a successfully sent delivery can never be re-sent.
- Secrets are not committed to source control; server credentials (Gemini, Resend) are read from environment variables or Google Secret Manager, never from client code.
- Evidence IDs returned for cross-entry analysis are checked against the supplied reflections before display.
- `firebase-applet-config.json` contains Firebase Web SDK configuration. Firebase web configuration is intentionally client-visible and is not used as the application's authorization boundary; authorization is enforced through Firebase Authentication and Firestore security rules.

This is standard authenticated-application security (verified identity, per-user authorization, secrets kept out of source and the client), not end-to-end encryption — journal content is readable by the backend when Firestore rules and a valid user session grant access, as is required for the AI features to work.

## Daily Reminder Architecture

The daily reminder feature is implemented, deployed, and production-verified.

- Users configure a reminder time and timezone from the app; the setting is stored per user in Firestore.
- A companion in-browser runtime shows a notification when the app is open and due; the backend pipeline below handles reminding the user by email when it isn't.
- **Cloud Scheduler** invokes the reminder endpoint on a fixed cadence using an **OIDC**-authenticated request to a dedicated service account; the endpoint independently verifies the token's issuer, audience, and exact service-account identity before doing anything else.
- The backend evaluates every enabled user's configured local time (DST-aware) to decide who is currently due.
- **Journal-today suppression** — a user who already wrote a reflection that local day is skipped.
- **Idempotent delivery** — each user/local-day delivery is claimed exactly once via a Firestore transaction; a second concurrent or repeated invocation for the same user/day cannot double-send.
- **Stale-claim recovery** — if a delivery is claimed but never resolves (e.g. a mid-send crash), it becomes safely retryable after a 15-minute TTL instead of being stuck forever.
- **Privacy-conscious content** — the email itself carries no journal content, only a prompt to return and write.
- Outbound email delivery uses Resend via a native `https` request (not the vendor SDK), with sanitized, credential-free diagnostics on failure.
- Full deployment steps (dedicated scheduler service account, OIDC audience configuration, Firestore indexes) are documented in `docs/DAILY_EMAIL_REMINDER_DEPLOYMENT.md`.

## Technology Stack

- React 19, TypeScript, Vite 6, and Tailwind CSS 4
- Node.js and Express
- Gemini through `@google/genai`
- Firebase Authentication and Cloud Firestore
- Google Cloud Run, Secret Manager, and Cloud Scheduler
- Resend for outbound reminder email

## Reliability

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

`npm run dev` serves the development app at `http://localhost:3000`. `npm start` runs the compiled production server after `npm run build`.

## Testing / Verification

```bash
npm run lint
npm run build
npm run test:reminder-delivery-store
npm run test:reminder-eligibility
npm run test:reminder-email
npm run test:reminder-scheduler
npm run test:reminder-hardening
```

The reminder pipeline (eligibility, delivery idempotency and stale-claim recovery, email composition/transport, scheduler authentication, and end-to-end hardening) has 43 passing tests across these five suites. Lint (`tsc --noEmit`) and the production build both pass.

## Deployment

The application is deployed and live on **Google Cloud Run** at https://signals.flowpilot-ai.site. The production build serves the compiled React app and Express API from a single Cloud Run service. Secrets (`GEMINI_API_KEY`, `RESEND_API_KEY`) are stored in **Google Cloud Secret Manager** and injected at runtime rather than embedded in the image or client bundle. The daily reminder pipeline runs on **Google Cloud Scheduler**, invoking the application over an OIDC-authenticated request.

To deploy your own instance:

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

Replace `<SERVICE_NAME>` and `<YOUR_REGION>` with your own Cloud Run service name and region. Before deploying, create the secrets, grant the Cloud Run runtime service account access to them, configure the Firebase project, and deploy `firestore.rules`. For the full daily-reminder-specific deployment steps (dedicated Scheduler service account, OIDC audience configuration, Firestore indexes), see `docs/DAILY_EMAIL_REMINDER_DEPLOYMENT.md`.

## Ideathon / Project Context

**Google technologies used:** Gemini API, Firebase Authentication, Cloud Firestore, Cloud Run, Secret Manager, Cloud Scheduler, and OIDC for authenticated scheduler-to-application invocation.

**Originality statement:** Reading the Signals goes beyond single-entry AI summarization by performing grounded reflection across a user's journal history while preserving links back to the underlying evidence, and pairs that with a production-grade, idempotent daily reminder pipeline rather than a superficial notification feature.

This is not a chatbot layered on a journal. The core experience is longitudinal reflection with inspectable evidence from the user's own writing.
