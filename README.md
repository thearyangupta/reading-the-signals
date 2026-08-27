# Reading the Signals — Private AI-Powered Reflection Journal

A secure, private reflection journal that helps individuals examine situations, unpack their emotional reactions, and engage in thoughtful, non-diagnostic multi-turn dialogue with an AI reflection partner powered by Gemini.

---

## 1. Core Architecture & Security Directives

- **Strict Firestore UID Isolation**: All user reflections, structured summaries, and multi-turn chat dialogues are stored under `/users/{userId}/entries/{entryId}`. Firestore security rules strictly restrict reads and writes to `request.auth.uid == userId`.
- **Zero-Exposure Secret Management**: Gemini API keys and credentials are never stored in client-side code. All AI operations are proxied through server-side endpoints (`/api/summarize`, `/api/reflect`).
- **Resilient AI Model Ladder**: All Gemini calls implement an automated 4-tier fallback hierarchy (`gemini-3.6-flash` -> `gemini-3.1-flash-lite` -> `gemini-flash-latest` -> `gemini-3.7-flash`).
- **Non-Diagnostic Partner Policy**: The AI acts strictly as an inquisitive reflection partner helping users unpack facts vs. assumptions, without asserting psychological diagnoses or claiming omniscience regarding others' motives.

---

## 2. Prerequisites & Cloud Setup

Ensure you have the Google Cloud SDK (`gcloud`) and Firebase CLI installed and authenticated:

```bash
# Set your project ID
export PROJECT_ID="YOUR_PROJECT_ID"
export REGION="us-central1"
gcloud config set project $PROJECT_ID

# Enable required Google Cloud APIs
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com
```

---

## 3. Secret Management Setup

Create and bind the `GEMINI_API_KEY` secret in Google Cloud Secret Manager:

```bash
# 1. Create the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"

# 2. Add the API key version
echo -n "YOUR_ACTUAL_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 3. Grant the Cloud Run default service account Secret Accessor permissions
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 4. Firestore Security Rules

Deploy the owner-bound security rules to ensure complete user data isolation:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }

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

Deploy the rules via Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 5. Cloud Run Deployment Flow

Build and deploy the application container to Cloud Run with Secret Manager environment injection:

```bash
# Deploy to Google Cloud Run
gcloud run deploy reading-the-signals \
  --source . \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --port 3000
```

### Campaign Verification Binding
Apply the verification label to register the service:
```bash
gcloud run services update reading-the-signals \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region $REGION
```

---

## 6. Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```
