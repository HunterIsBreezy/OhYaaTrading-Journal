# ohYaaa Trading Journal

A full-stack web app for day traders to track performance, analyze mistakes, and work with mentors.

## Project Structure

```
ohyaaa/
├── src/                        # React frontend (Vite)
│   ├── App.jsx                 # Root component, auth & routing
│   ├── main.jsx                # Entry point
│   ├── firebase.js             # Firebase compat SDK setup
│   ├── contexts/
│   │   └── AuthContext.jsx
│   ├── utils/
│   │   ├── constants.js        # NAV_ITEMS, EMPTY_STATE, categories, etc.
│   │   ├── helpers.js          # calcTradeDerived, formatCurrency, calculateWeekStats, etc.
│   │   └── emailService.js     # sendEmail + email templates
│   ├── components/
│   │   ├── auth/
│   │   │   └── AuthScreens.jsx  # Login, signup, email verification
│   │   ├── shared/
│   │   │   ├── Icons.jsx
│   │   │   ├── Charts.jsx       # SimplePieChart, SimpleBarChart, SetupBarChart, SimpleLineChart
│   │   │   ├── StarRatingAvatar.jsx
│   │   │   ├── Sidebar.jsx      # Desktop sidebar + mobile bottom nav
│   │   │   └── TopBar.jsx       # Top bar with notification bell
│   │   ├── dashboard/
│   │   │   └── Dashboard.jsx
│   │   ├── tradelog/
│   │   │   ├── TradeLog.jsx
│   │   │   ├── TradeModal.jsx
│   │   │   └── Modals.jsx       # ImageModal, NotesModal
│   │   ├── calendar/
│   │   │   └── CalendarPage.jsx
│   │   ├── goals/
│   │   │   └── GoalsPage.jsx
│   │   ├── setups/
│   │   │   └── SetupsPage.jsx
│   │   ├── mistakes/
│   │   │   └── MistakesPage.jsx
│   │   ├── profile/
│   │   │   └── ProfilePage.jsx
│   │   └── mentor/
│   │       ├── StudentPages.jsx  # Student views: CheckinsPage, SessionsPage, AssignmentsPage
│   │       ├── MentorTabs.jsx    # Mentor views: MentorAssignmentsTab, MentorCheckinsTab, MentorSessionsTab
│   │       └── StudentsPage.jsx  # Main mentor dashboard + MentorInviteBanner
│   └── styles/
│       └── index.css
├── functions/
│   ├── index.js                # Cloud Functions (email verification, weekly recap, monthly report)
│   └── package.json
├── firebase.json               # Firebase project config (hosting, firestore, functions)
├── firestore.rules             # Firestore security rules
├── firestore.indexes.json      # Firestore composite indexes
├── .firebaserc                 # Firebase project ID binding
├── package.json                # Frontend deps (React, Vite, Tailwind, Firebase v9)
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## Firebase Project

**Project ID:** `trading-journal-86e97`

**Services used:**
- Firebase Authentication (email/password)
- Cloud Firestore (database)
- Cloud Functions (email verification, scheduled reports)
- Firebase Hosting (production deployment)

## Local Development Setup

```bash
# 1. Install frontend dependencies
npm install

# 2. Install functions dependencies
cd functions && npm install && cd ..

# 3. Start dev server
npm run dev
```

App runs at `http://localhost:5173`

## Production Deployment

```bash
# 1. Build frontend
npm run build

# 2. Deploy everything (hosting + functions + firestore rules)
firebase deploy

# Or deploy individually:
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
```

## Firestore Data Structure

```
users/{uid}
  ├── email, displayName, role, emailVerified
  ├── mentorId, mentorName (if student has mentor)
  ├── pendingMentorId, pendingMentorName (pending invite)
  ├── journalData/state          → { trades[], setups[], mistakes[], dailyNotes{}, yearlyGoal, challenges[] }
  ├── tradeFeedback/{id}         → mentor feedback on trades
  ├── tradeFlags/{id}            → mentor flags on trades
  ├── tradeQuestions/{id}        → student questions, mentor answers
  ├── assignments/{id}           → homework from mentor
  ├── weeklyCheckins/{id}        → weekly review from mentor
  ├── sessions/{id}              → scheduled review sessions
  └── notifications/{id}         → in-app notifications

mentorships/{mentorId}
  ├── students/{studentId}       → active/pending students
  └── mentees/{menteeId}         → legacy collection (backwards compat)
```

## Cloud Functions

| Function | Trigger | Description |
|---|---|---|
| `sendVerificationCode` | HTTP POST | Generates & emails 6-digit code on signup |
| `verifyCode` | HTTP POST | Validates code, marks user as verified |
| `sendEmail` | HTTP POST | General email send endpoint (CORS enabled) |
| `sendWeeklyRecap` | Scheduled (Fri 1PM EST) | Weekly performance recap email |
| `sendMonthlyReport` | Scheduled (last day, 5PM EST) | Monthly summary email |
| `testMonthlyReport` | HTTP GET | Manual trigger for testing monthly reports |

**Email provider:** Resend API (`noti.ohyaatradingjournal.com`)

## Key Architecture Notes

- **Firebase SDK:** Uses v9 **compat** API (`firebase/compat/app`) — matches the original CDN-based codebase. All Firestore calls use `db.collection().doc()` style, not the modular `collection(db, ...)` style.
- **State management:** Journal data lives in Firestore and is subscribed to via `onSnapshot`. Local state is kept in sync and written back via `saveJournalState()` in App.jsx.
- **Mentor system:** Mentors can view student journals read-only, leave trade feedback/flags, answer questions, create assignments and weekly check-ins, and schedule review sessions.
- **Notification system:** 28 notification types covering both mentor→student and student→mentor flows, plus self-notifications for trading milestones.
- **Progress checking:** After every trade save, `checkProgressAndNotify()` checks daily target hits, win streaks, trade milestones, challenge progress, and yearly goal milestones.

## Environment

No `.env` file needed — Firebase config is hardcoded in `src/firebase.js` (public keys, safe to commit). The Resend API key lives in `functions/index.js` — for production, consider moving to Firebase environment config:

```bash
firebase functions:config:set resend.key="re_xxx"
```

Then in `functions/index.js`:
```js
const RESEND_API_KEY = functions.config().resend.key;
```
