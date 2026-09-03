# Reading the Signals

Reading the Signals helps people reflect across time by turning their own journal entries into evidence-linked observations, timelines, comparisons, and grounded questions. Instead of presenting AI conclusions as a black box, it makes supporting reflections inspectable and easy to revisit.

**Live demo:** [add final Cloud Run URL before submission]
**Demo video:** [add final submission video URL before submission]

## Why It Matters

Individual journal entries can capture an important moment, but recurring patterns and changes in perspective are difficult to see manually. Reading the Signals brings reflections together across time so users can examine what changed, what repeated, and which entries support each observation.

## What It Does

- **Ask My Journal** answers a user's question using selected reflections and links supporting entries.
- **Signal Timeline** organizes changes in perspective, emotion, or focus across time.
- **Reflection Wrapped** turns existing pattern and timeline results into a concise longitudinal overview.
- **Recurring Patterns** surfaces repeated themes and triggers with inspectable evidence.
- **Then vs Now** compares earlier and later states from the generated timeline.
- **Perspective Differences** highlights where similar situations were interpreted differently and offers a grounded follow-up question.
- **Themes** groups recurring ideas found across selected reflections.
- **Connections** suggests evidence-linked relationships between reflections.

Users can also create and edit journal entries, add AI observations to an entry, and continue a reflection-specific conversation.

## How Gemini Is Used

Gemini is called through server-side Express endpoints to:

- summarize entries and support reflection analysis;
- identify recurring signals across selected entries;
- construct longitudinal timelines and comparisons;
- answer questions grounded in selected journal entries; and
- return structured evidence references that the server validates against the reflections supplied for analysis before the UI links them to source entries.

AI output is presented as a reflection aid, not as medical advice or a claim about another person's hidden thoughts.

## Trust & Privacy Design

- Firebase Authentication supports Google sign-in and anonymous Guest access.
- Cloud Firestore rules isolate journal data by authenticated user ID.
- AI endpoints verify Firebase ID tokens before generation.
- The Gemini API key remains on the server and can be supplied through Google Secret Manager in deployment.
- Users choose whether analysis uses all reflections or a selected subset.
- Evidence IDs returned for cross-entry analysis are checked against the supplied reflections before display.

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
- Google Cloud Run and Google Secret Manager

## Architecture / AI Flow

```text
User
  → React UI
  → Firebase Authentication
  → Express AI endpoint
  → verified Firebase ID token
  → Gemini
  → structured result
  → server-side evidence validation
  → UI linked to journal sources
```

The Vite client and Express API are built and served as one deployable service.

## Reliability for Demo

Gemini generation uses a bounded, sequential model fallback: each model attempt has a 12-second deadline, and the complete server generation has a 28-second budget. The frontend adds a 32-second safety deadline to AI actions so loading states cannot wait indefinitely. SDK attempts are limited, there are no automatic application retries, and timeout, rate-limit, and generation failures receive short user-facing messages.

## Running Locally

Prerequisites: Node.js 20+, npm, a Firebase project with Google and anonymous authentication enabled, Cloud Firestore, and a Gemini API key.

```bash
npm install
cp .env.example .env
npm run dev
```

Set `GEMINI_API_KEY` in `.env`. Keep it out of client code and source control. Configure the Firebase web app in `firebase-applet-config.json`, then deploy the included owner-isolating Firestore rules to the intended Firebase project.

Useful local checks:

```bash
npm run lint
npm run build
npm start
```

`npm run dev` serves the development app at `http://localhost:3000`. `npm start` runs the compiled production server after `npm run build`.

## Deployment

The deployment target is Google Cloud Run. The production build serves the compiled React app and Express API on port 3000; `GEMINI_API_KEY` should be injected from Secret Manager rather than embedded in the image or client bundle.

```bash
gcloud run deploy reading-the-signals \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --port 3000
```

Before deploying, create the secret, grant the Cloud Run runtime service account access to it, configure the Firebase project, and deploy `firestore.rules`.

**Live demo:** [add final Cloud Run URL before submission]
**Demo video:** [add final submission video URL before submission]

## Ideathon Notes

This is not a chatbot layered on a journal. The core experience is longitudinal reflection with inspectable evidence from the user's own writing.
