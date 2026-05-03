# NFC Healthcare Card System

A full-stack healthcare management platform with NFC card integration, AI drug interaction checking, and a patient chatbot.

## Architecture

Four services run together:

```
┌─────────────────────────────────────────────────────────────┐
│              React / Vite Frontend  (Port 5173)             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│           Node.js / Express Backend  (Port 3000)            │
│  Auth · Patients · Doctors · Hospitals · Medical Records    │
└────────┬──────────────────┬──────────────────┬─────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│  DDI Service   │ │Chatbot Service │ │  NFC Bridge    │
│   main.py      │ │  chatbot.py    │ │ nfc_bridge.py  │
│  (Port 8000)   │ │  (Port 8001)   │ │  (Port 8002)   │
│  Groq AI DDI   │ │ Gemini chatbot │ │  ACR122U USB   │
└────────────────┘ └────────────────┘ └────────────────┘
```

## Prerequisites

- **Node.js** v18+
- **Python** 3.8+
- **MongoDB** (local or Atlas)
- **Groq API Key** — [console.groq.com](https://console.groq.com/keys)
- **Google Gemini API Key** — for the chatbot
- **pyscard** — only if using a physical ACR122U NFC reader

## Installation

### 1. Clone & install backend

```bash
cd Nfc-healthcare-card-main
npm install
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

For NFC hardware support:
```bash
pip install pyscard
```

### 3. Install frontend dependencies

```bash
cd vite-frontend
npm install
```

### 4. Configure environment variables

```bash
copy .env.example .env
```

Edit `.env` with your values (see table below).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DB_URL` | Yes | MongoDB connection string |
| `SECRET_KEY` | Yes | App secret |
| `JWT_SECRET` | Yes | JWT signing secret |
| `EMAIL_USER` | Yes | Gmail address for sending emails |
| `EMAIL_PASSWORD` | Yes | Gmail app password |
| `DDI_GROQ_API_KEY` | Yes | Groq API key for DDI service |
| `GEMINI_API_KEY` | Yes | Google Gemini API key for chatbot |
| `PORT` | No | Backend port (default: 3000) |
| `FRONTEND_URL` | No | Frontend URL for email links (default: http://localhost:5173) |
| `DDI_SERVICE_URL` | No | DDI service URL (default: http://localhost:8000) |
| `CHATBOT_SERVICE_URL` | No | Chatbot service URL (default: http://localhost:8001) |

## Running the System

Open four terminals and run each service:

**Terminal 1 — Node.js backend:**
```bash
node index.js
```

**Terminal 2 — DDI AI service:**
```bash
python main.py
```

**Terminal 3 — Chatbot service:**
```bash
python chatbot.py
```

**Terminal 4 — React frontend:**
```bash
cd vite-frontend
npm run dev
```

**Terminal 5 — NFC bridge** *(only needed if using ACR122U hardware)*:
```bash
python nfc_bridge.py
```

## Access Points

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| DDI Service docs | http://localhost:8000/docs |
| Chatbot Service docs | http://localhost:8001/docs |
| NFC Bridge | http://localhost:8002/nfc/card |

## User Roles

| Role | Access |
|---|---|
| `super_admin` | Full system access |
| `admin` | Facility management |
| `admin_hospital` | Hospital staff management |
| `doctor` | Patient queue, medical records, DDI checker |
| `receptionist` | Patient registration, NFC scanning |
| `patient` | Own health passport, chatbot |

## Key Features

### NFC Card Integration
Receptionists can scan a patient's NFC card (via ACR122U reader) to instantly pull up their profile. The NFC Bridge (`nfc_bridge.py`) reads the card UID and exposes it over HTTP so the browser frontend can poll it without special browser APIs.

### AI Drug Interaction Checker (DDI)
When a doctor adds a new medication, the DDI service checks it against the patient's existing treatments by:
1. Fetching drug info from the FDA and RxNorm databases (in parallel)
2. Sending the combined data to Groq AI (`llama-3.3-70b-versatile`) for interaction analysis
3. Returning a severity rating: `none` / `low` / `moderate` / `high` / `critical`

Results are stored in MongoDB and shown in the Doctor Dashboard's Drug Interaction Conflict Log.

### Patient Chatbot
Patients can ask medical questions through a floating chat widget. The chatbot has access to the patient's own medical records and responds using Google Gemini.

### Email Verification
Doctor accounts require email verification before login. The verification link opens the frontend (`/verify-account?token=...`) which completes the verification via the backend API — works on any device, including mobile.

### Password Reset
Any staff member (doctor, receptionist, admin) can reset their password via OTP sent to their email. Appears automatically after 2 failed login attempts.

## Project Structure

```
Nfc-healthcare-card-main/
├── index.js                  # Node.js entry point
├── main.py                   # DDI AI service (Port 8000)
├── chatbot.py                # Patient chatbot service (Port 8001)
├── nfc_bridge.py             # NFC hardware bridge (Port 8002)
├── src/
│   ├── modules/
│   │   ├── auth/             # Authentication & user profiles
│   │   ├── hospital/         # Hospital management
│   │   ├── medicalRecord/    # Medical records & DDI integration
│   │   ├── ddi/              # DDI report routes
│   │   ├── chatbot/          # Chatbot proxy routes
│   │   ├── admin/            # Admin operations
│   │   ├── admin_hospital/   # Hospital admin operations
│   │   └── Receptionist/     # Receptionist operations
│   ├── middleware/           # Auth, validation, error handling
│   └── utils/                # Helpers, email, tokens, enums
├── db/
│   ├── models/
│   │   ├── patient.model.js
│   │   ├── doctor.model.js
│   │   ├── user.model.js     # Staff (admin, receptionist)
│   │   ├── hospital.model.js
│   │   ├── medicalRecord.model.js
│   │   ├── conflictAnalysis.model.js
│   │   └── patientChatLog.model.js
│   └── connection.js
├── vite-frontend/            # React + TypeScript + Tailwind frontend
│   └── src/
│       ├── pages/
│       │   ├── auth/         # Login, signup, verify account
│       │   ├── doctor/       # Doctor dashboard
│       │   ├── receptionist/ # Receptionist dashboard
│       │   ├── patient/      # Health passport
│       │   ├── admin/        # Facility management
│       │   ├── admin_hospital/ # Staff management
│       │   └── profile/      # User profile page
│       ├── components/       # Shared UI components
│       └── api/              # Axios client
├── .env.example              # Environment variable template
└── requirements.txt          # Python dependencies
```

## Troubleshooting

**DDI timeout** — the DDI service fetches from FDA and RxNorm; a slow internet connection can cause delays. Timeouts are set to 120 seconds.

**NFC reader not detected** — ensure `pyscard` is installed and the ACR122U drivers are installed. Run `python nfc_bridge.py` and check the `/health` endpoint.

**Port already in use:**
```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**MongoDB connection failed** — check `DB_URL` in `.env` and ensure your IP is whitelisted in MongoDB Atlas.

**Verification email link not working on mobile** — set `FRONTEND_URL` in `.env` to your deployed frontend URL or your local network IP (e.g. `http://192.168.1.x:5173`) and start Vite with `npm run dev -- --host`.
