# Reading the Signals — Private AI-Powered Reflection Journal

> A private, non-diagnostic AI reflection journal where **every AI observation is grounded in your own words**. It helps you record personal situations, unpack your reactions, and see how your perspective shifts over time — with a strict zero-invention policy: if the entries don't support a claim, the AI says so instead of guessing.

**Live demo:** `<your-cloud-run-url>` &nbsp;·&nbsp; **60-second walkthrough:** `<your-video-link>`

Built with React, Express, Firebase, Cloud Firestore, Google Cloud Run, and the Google Gemini API.

---

## What Makes It Different

Most AI journaling tools summarize or advise. Reading the Signals does neither — it acts as a grounded thinking partner that reflects your own patterns back to you, and can prove every claim it makes:

- **Zero-hallucination groundedness** — every pattern, contradiction, and timeline shift is derived strictly from the text of your own entries, and is verified server-side against your real data before it's shown. No entry support → no claim.
- **Click-to-evidence on everything** — every observation links to the exact entries behind it. Click any citation and the underlying journal entry opens for inspection. Nothing is asserted you can't trace.
- **Non-diagnostic by design** — it never diagnoses, prescribes, or claims to read anyone else's mind. It helps you separate what you *observed* from what you *assumed*.
- **Perspective over time** — the Signal Timeline traces how your reading of a situation evolved, tagged earlier-vs-later and cited to the entries that mark each shift.

These four things are the point of the project — the rest of the app exists to serve them.

---

## Core Features

- **Private journaling + structured signal extraction** — write freeform, or break a reflection into *Situation*, *Behavior/Event*, *Feeling/Reaction*, and *Context*. Gemini generates a structured summary (situation, behavior, emotional reaction, context, subjects, theme, tone, stated interpretation).
- **Multi-turn reflection companion** (`/api/reflect`) — a grounded conversational partner attached to each entry that helps you examine assumptions and what's actually in your control.
- **Cross-entry patterns** (`/api/patterns`) — recurring themes and triggers across entries, with evidence-strength indicators (`thin`, `emerging`, `strong`) based on how many entries actually support them.
- **Perspective differences + gentle questions** (`/api/contradictions`) — detects where similar situations were interpreted differently across entries, and asks one gentle, non-judgmental clarifying question rather than delivering a verdict.
- **Signal Timeline shifts** (`/api/timeline`) — longitudinal change in perspective/emotion/focus, chronologically tagged (`earlier_state`, `later_state`, `context`) with role-tagged citations.
- **Click-to-evidence + modal inspection** — supporting-entry pills on every card open the exact source entry.
- **Shared analysis scope selector** — toggle between **All Entries** and a custom **Selected Entries** subset across all three analysis tabs (requires ≥ 2 structured reflections).
- **Interactive demo mode** — a one-click sample experience pre-loaded with 9 longitudinal entries, held purely in memory with **zero Firestore impact** on the signed-in user's data.

---

## How It Uses Google Technologies

### Firebase Authentication / Google Sign-In
Manages identity client-side (`signInWithPopup` with Google Provider, or `signInAnonymously` for guest testing). Firebase ID tokens are acquired via `getIdToken()` and sent as `Authorization: Bearer <token>` headers to the backend.

### Cloud Firestore
Real-time storage for entries, structured summaries, and reflection logs, strictly partitioned into owner-isolated subcollections under `/users/{userId}/entries/{entryId}`. Subscriptions use `onSnapshot` with `orderBy('date', 'desc')`; payloads are sanitized with `cleanPayload()` to strip `undefined` keys before writes.

### Google Gemini API (`@google/genai`)
Drives all structured extraction, conversational reflection, and cross-entry pattern / contradiction / timeline reasoning. Runs **exclusively server-side** via Express endpoints using structured JSON schemas (`responseSchema`) and strict system instructions that constrain outputs toward grounded, non-diagnostic behavior, backed by server-side evidence verification...
### Google Cloud Secret Manager
Stores the `GEMINI_API_KEY` securely and mounts it as an environment variable in Cloud Run at runtime — no keys in client bundles or source control.

### Google Cloud Run
Hosts the unified full-stack container, serving Vite-compiled static assets and routing `/api/*` on port 3000 with automatic HTTPS, scaling, and health monitoring.

---

## Security & Privacy

- **Zero-exposure secret hygiene** — `GEMINI_API_KEY` is accessed only in backend code via `process.env.GEMINI_API_KEY`; no secrets in client bundles or markup.
- **Server-side token verification** — every analysis endpoint verifies the caller's Firebase ID token with the Firebase Admin SDK (`adminAuth.verifyIdToken`) before processing.
- **Owner-bound database isolation** — Firestore rules forbid cross-user access, restricting reads/writes to the authenticated user whose `request.auth.uid` matches the path.
- **Sanitized prose citations** — server-side post-processing strips raw internal database IDs from Gemini's prose, replacing them with human-readable titles and dates.

### How groundedness is enforced
1. **Strict reflection groundedness** — every observation derives only from explicit entry text/signals; insufficient evidence → the AI says so.
2. **No third-party mind-reading** — never infers another person's hidden thoughts or motives; helps distinguish observed behavior from the user's own interpretation.
3. **Zero psychological diagnosis** — an inquisitive thinking partner only; no medical, psychiatric, or clinical assessment.
4. **Deterministic server-side verification** — outputs are validated against real entries; any pattern/contradiction/shift must be backed by ≥ 2 distinct verified entries, with raw IDs stripped from prose.

---

## Architecture & Tech Stack

**Frontend:** React 19 + TypeScript · Tailwind CSS v4 · Motion (`motion/react`) · Lucide React · Vite 6
**Backend:** Node.js + Express 4 · Firebase Admin SDK (server-side JWT verification) · `@google/genai` v2.4.0 · `tsx` (dev) / `esbuild` → `dist/server.cjs` (prod)
**Cloud & data:** Firebase Auth (Google Sign-In + anonymous guest) · Cloud Firestore (per-user real-time docs) · Secret Manager (API-key injection) · Cloud Run (containerized hosting)

### Gemini model configuration & fallback
All requests use the `generateWithFallback` helper, which walks a 4-tier ladder and recovers automatically from `429` / `RESOURCE_EXHAUSTED` / quota errors, moving to the next tier without breaking the session. If all tiers are exhausted, the server returns a clean status that lets the frontend show a non-destructive **Retry**.

```typescript
const FALLBACK_MODELS = [
  'gemini-3.6-flash',      // 1. Primary: fast, efficient structured generation
  'gemini-3.1-flash-lite', // 2. High-availability, ultra-low latency
  'gemini-flash-latest',   // 3. Dynamic alias: high-throughput stable release
  'gemini-3.7-flash',      // 4. Deep reasoning: advanced cross-entry fallback
];
```

---

## Local Setup

**Prerequisites:** Node.js v20+, npm, Google Cloud SDK (`gcloud`), Firebase CLI (`npm install -g firebase-tools`), and a Google Cloud project with billing enabled.

```bash
# 1. Clone & install
git clone <repository-url>
cd reading-the-signals
npm install

# 2. Configure environment
cp .env.example .env
```

Populate `.env`:
```env
# Required: server-side Gemini key for all AI generation
GEMINI_API_KEY="your-gemini-api-key-here"

# Optional template variable (present in .env.example, not consumed at runtime)
APP_URL="http://localhost:3000"
```

> `GEMINI_API_KEY` is strictly required by the backend for extraction, the reflection companion, and cross-entry reasoning. `APP_URL` is a template/config placeholder and is not consumed by the runtime.

**Firebase client config** — ensure `firebase-applet-config.json` in the project root holds your Firebase web app config:
```json
{
  "projectId": "YOUR_PROJECT_ID",
  "appId": "YOUR_FIREBASE_APP_ID",
  "apiKey": "YOUR_FIREBASE_API_KEY",
  "authDomain": "YOUR_PROJECT_ID.firebaseapp.com",
  "firestoreDatabaseId": "(default)",
  "storageBucket": "YOUR_PROJECT_ID.firebasestorage.app",
  "messagingSenderId": "YOUR_MESSAGING_SENDER_ID",
  "oAuthClientId": "YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com"
}
```

**Enable required APIs, then run:**
```bash
export PROJECT_ID="YOUR_PROJECT_ID"
gcloud config set project $PROJECT_ID
gcloud services enable run.googleapis.com secretmanager.googleapis.com firestore.googleapis.com cloudbuild.googleapis.com

npm run dev        # http://localhost:3000
```

**Production bundle locally:**
```bash
npm run lint       # type check + lint
npm run build      # build client + bundle server
npm start          # start compiled production server
```

---

## Deployment (Cloud Run)

```bash
# 1. Store the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Grant the Cloud Run runtime service account access to the secret.
# (Default compute SA shown; if you use a custom runtime SA, grant it roles/secretmanager.secretAccessor instead.)
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# 2. Deploy
export REGION="us-central1"
gcloud run deploy reading-the-signals \
  --source . \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --port 3000

# 3. Apply the required challenge label
gcloud run services update reading-the-signals \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region $REGION
```

### Firestore security rules
Default-deny everything; access to `/users/{userId}` is restricted to the authenticated owner. Deploy with `firebase deploy --only firestore:rules`.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Default deny
    match /{document=**} {
      allow read, write: if false;
    }
    // Isolate all user data by Firebase UID
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      match /entries/{entryId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
        match /{subcollection=**} {
          allow read, write: if request.auth != null && request.auth.uid == userId;
        }
      }
    }
  }
}
```

---

## Post-Deploy Verification

1. **Health & load** — open the Cloud Run URL; app loads cleanly, no console errors.
2. **Auth** — test Google Sign-In (popup) and Guest (anonymous) sign-in.
3. **Journaling + extraction** — create an entry, click *Generate Structured Summary*, confirm grounded extraction.
4. **Reflection partner** — open the chat; confirm grounded, non-diagnostic responses.
5. **Cross-entry reasoning** — with ≥ 2 entries (or Demo Mode), check Patterns, Differences, and Timeline all produce grounded observations with clickable pills.
6. **Scope selector** — select a subset; confirm analysis updates for that scope.
7. **Click-to-evidence** — click a supporting pill; confirm the cited entry opens.
8. **Label check** — `gcloud run services describe reading-the-signals --region $REGION --format="yaml(metadata.labels)"` shows `dev-tutorial: cloud-run-ai-challenge`.

---

## Demo Mode

Accessible via "Explore Demo Mode" on the sign-in screen and navbar. Backed by `src/data/sampleEntries.ts` (9 chronologically spaced sample entries modeling a realistic communication pattern). Demo reflections live purely in client memory — no writes, edits, or deletes hit Firestore, and the user's real entries stay untouched. All cross-entry analysis and click-to-evidence work fully on the sample data.

---

## Repository Structure

```
.
├── .env.example                 # Env templates (GEMINI_API_KEY, APP_URL)
├── firebase-applet-config.json  # Firebase client SDK config
├── firestore.rules              # Firestore security rules (UID isolation)
├── index.html                   # HTML entry point
├── package.json                 # Dependencies, build & run scripts
├── server.ts                    # Express server, Admin verification, Gemini fallback, API routes
├── tsconfig.json                # TypeScript config
├── vite.config.ts               # Vite config (React + Tailwind)
└── src/
    ├── main.tsx                 # React DOM entry
    ├── App.tsx                  # Root state, auth listener, view router
    ├── types.ts                 # Shared interfaces (JournalEntry, Summary, Patterns, Shifts)
    ├── index.css                # Tailwind imports
    ├── data/sampleEntries.ts    # In-memory Demo Mode dataset
    ├── lib/firebase.ts          # Firebase Auth/Firestore init & helpers
    └── components/
        ├── AuthView.tsx             # Google Sign-In + Guest screen
        ├── EntryDetailModal.tsx     # Entry detail, summary extractor, chat launcher
        ├── EntryList.tsx            # Chronological feed with search & badges
        ├── JournalEditor.tsx        # Create/edit entry modal
        ├── Navbar.tsx               # Header: auth status, Demo toggle, new entry
        ├── PatternAnalysisSection.tsx # Patterns / Differences / Timeline / Scope hub
        └── ReflectionChat.tsx       # Multi-turn grounded reflection companion
```
