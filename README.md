# 🏥 ArogyaAI — AI-Powered Healthcare Platform

> A full-stack, production-grade healthcare web application combining **Google Gemini AI**, **real-time notifications**, **medical record OCR**, **appointment booking with payments**, and a dual-portal (Patient + Doctor) experience.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the App](#running-the-app)
- [API Reference](#api-reference)
- [Data Models](#data-models)
- [AI & ML Features](#ai--ml-features)
- [Security](#security)
- [Cron Jobs](#cron-jobs)

---

## Overview

**ArogyaAI** is a comprehensive digital health platform built to modernize patient–doctor interactions. It leverages Google's Gemini LLM for conversational health assistance, intelligent medical record extraction (PDF/image via OCR), and real-time appointment management backed by Razorpay payments.

The platform supports two distinct roles:
- **Patients** — chat with AI, upload health records, book appointments, manage profile & emergency contacts
- **Doctors** — manage appointments, view patient 360° profiles, access AI-generated clinical summaries

---

## Key Features

### 🤖 AI & Intelligence
| Feature | Description |
|---|---|
| **AI Health Chat** | Conversational health assistant powered by Google Gemini with multi-turn session memory |
| **Medical Record Extraction** | OCR (Tesseract.js) + Gemini AI extracts structured data from uploaded PDFs/images with confidence scoring |
| **AI Confirmation Flow** | Users review and correct AI-extracted data before saving (idle → uploading → extracting → confirming → saving) |
| **Emergency Triage** | AI analyzes reported symptoms + vitals and provides urgency classification |
| **Doctor Summaries** | Gemini generates clinical summaries of patient health records for doctor review |
| **Patient 360° View** | Doctors see an AI-synthesized full history, timeline, and summary of each patient |
| **Model Fallback Chain** | Automatically falls back across Gemini model variants on quota/rate-limit errors |
| **Voice Input** | Voice-to-text for chat input via the voice service |

### 📅 Appointments
- Browse and search doctors by specialty, location, availability
- Slot-based appointment booking system
- Razorpay payment integration (order creation + HMAC-SHA256 signature verification)
- PDF invoice/receipt generation (PDFKit)
- Appointment status lifecycle: `pending → confirmed → completed / cancelled`
- Replay-attack prevention via idempotency checks

### 📂 Health Records
- Upload lab reports, prescriptions, imaging (PDF or image)
- OCR text extraction → AI-structured data with confidence scores
- Manual confirmation & correction before saving
- Filter by type, search by title
- Cloudinary storage for file assets

### 🔔 Notifications
- In-app notification center
- Email reminders via Nodemailer (SMTP Gmail)
- Automated 24-hour and 1-hour appointment reminders (cron jobs)

### 👤 Dual-Portal Design
- **Patient Dashboard** — health summary, quick actions, recent records, upcoming appointments
- **Doctor Portal** — appointment queue, patient list, 360° patient view, AI clinical summaries
- Role-based routing and access guards

### 🔐 Auth & Security
- JWT access/refresh token pair (15m access, 7d refresh) stored in signed cookies
- Email OTP verification on registration
- Forgot/Reset password via time-limited email tokens
- Bcrypt password hashing, HTTP-only cookies

---

## Tech Stack

### Frontend (`/client`)
| Layer | Technology |
|---|---|
| Framework | React 18 + Vite |
| Routing | React Router DOM v6 |
| State Management | Zustand |
| Styling | Tailwind CSS v3 |
| Animations | Framer Motion |
| Forms | React Hook Form |
| HTTP Client | Axios |
| Notifications | React Hot Toast |
| Icons | Lucide React + React Icons |
| Markdown | react-markdown + remark-gfm |
| Date Utilities | date-fns |

### Backend (`/server`)
| Layer | Technology |
|---|---|
| Runtime | Node.js >= 18 |
| Framework | Express 4 |
| Database | MongoDB (Atlas) via Mongoose 8 |
| AI | Google Generative AI SDK (Gemini Flash) |
| OCR | Tesseract.js |
| PDF Parsing | pdf-parse |
| File Storage | Cloudinary |
| Payments | Razorpay |
| Email | Nodemailer (SMTP) |
| Scheduled Jobs | node-cron |
| Logging | Winston + Morgan |
| Security | Helmet, CORS, express-rate-limit, HPP, express-mongo-sanitize |
| Validation | express-validator |
| PDF Generation | PDFKit |
| Authentication | jsonwebtoken + bcryptjs |

---

## Architecture

```
                    CLIENT (Vite + React)
        Patient Portal | Doctor Portal | Auth Pages
                           |
              Zustand Stores (auth, chat, appointments...)
                           |
                     Axios REST API
                           |
                SERVER (Express / Node.js)
          Security: Helmet · CORS · Rate Limiters · HPP
                           |
              Routes /api/v1/* (10 route modules)
                           |
               Services Layer (14 services)
              /                           \
      MongoDB (Atlas)            External: Gemini AI
      Mongoose Models            Cloudinary · Razorpay
                                 Nodemailer (SMTP)
```

---

## Project Structure

```
ArogyaAI/
├── client/                          # React frontend (Vite)
│   ├── src/
│   │   ├── api/                     # Axios instance & API helpers
│   │   ├── components/
│   │   │   ├── appointments/        # Booking UI components
│   │   │   ├── chat/                # Chat bubble, voice input
│   │   │   ├── doctor/              # Doctor-facing components
│   │   │   ├── guards/              # ProtectedRoute, DoctorRoute, PublicRoute
│   │   │   ├── navigation/          # Sidebar, navbar
│   │   │   ├── notifications/       # ReminderBanner, notification list
│   │   │   ├── records/             # Upload, extraction, confirmation modal
│   │   │   └── ui/                  # Shared UI (PageLoader, modals, badges)
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── layouts/                 # RootLayout, AuthLayout, DashboardLayout, DoctorLayout
│   │   ├── pages/
│   │   │   ├── auth/                # Login, Register, ForgotPassword, ResetPassword, VerifyEmail
│   │   │   ├── appointments/        # AppointmentsPage, BookAppointmentPage
│   │   │   ├── chat/                # ChatPage (AI assistant)
│   │   │   ├── dashboard/           # DashboardPage (patient home)
│   │   │   ├── doctor/              # Dashboard, Appointments, Patients, PatientView360, Summaries
│   │   │   ├── emergency/           # EmergencyPage (AI triage)
│   │   │   ├── notifications/       # NotificationsPage
│   │   │   ├── profile/             # ProfilePage
│   │   │   ├── records/             # HealthRecordsPage
│   │   │   └── settings/            # SettingsPage
│   │   ├── services/                # Frontend service wrappers
│   │   ├── store/                   # Zustand stores
│   │   │   ├── authStore.js         # Auth state, login/logout/refresh
│   │   │   ├── chatStore.js         # Chat sessions & message state
│   │   │   ├── appointmentStore.js  # Appointment data
│   │   │   ├── extractionStore.js   # AI extraction confirmation flow
│   │   │   └── notificationStore.js # Notification state
│   │   ├── styles/                  # Global CSS / design tokens
│   │   └── utils/                   # Helpers (normalizeMedicalExtraction, etc.)
│   ├── tailwind.config.js
│   └── vite.config.js
│
└── server/                          # Express backend
    └── src/
        ├── config/
        │   ├── db.js                # MongoDB connection
        │   ├── gemini.js            # Gemini model config & fallback chain
        │   └── logger.js            # Winston logger
        ├── controllers/             # HTTP layer (delegates to services)
        │   ├── auth.controller.js
        │   ├── appointment.controller.js
        │   ├── chat.controller.js
        │   ├── doctor.controller.js
        │   ├── notification.controller.js
        │   ├── otp.controller.js
        │   ├── payment.controller.js
        │   └── record.controller.js
        ├── middleware/
        │   ├── auth.middleware.js   # JWT protect guard
        │   ├── errorHandler.js      # Global error handler
        │   ├── notFound.js          # 404 fallback
        │   └── validate.middleware.js
        ├── models/
        │   ├── User.model.js        # Patient + Doctor shared schema
        │   ├── Appointment.model.js # Booking, payment, reminder flags
        │   ├── ChatSession.model.js # AI chat history
        │   ├── HealthRecord.model.js
        │   ├── Notification.model.js # TTL: 30 days
        │   └── Otp.model.js         # TTL: 10 minutes
        ├── routes/                  # 10 route modules
        ├── services/                # 14 business logic services
        │   ├── gemini.service.js    # Gemini AI, model fallback chain
        │   ├── record.service.js    # Records CRUD + AI extract/confirm
        │   ├── appointment.service.js
        │   ├── doctor.service.js    # Search, availability, patient 360
        │   ├── payment.service.js   # Razorpay + PDF invoice
        │   ├── chat.service.js
        │   ├── auth.service.js
        │   ├── otp.service.js
        │   ├── notification.service.js
        │   ├── cron.service.js      # Reminder cron jobs
        │   ├── ocr.service.js       # Tesseract.js wrapper
        │   ├── pdfParser.service.js
        │   ├── voice.service.js
        │   └── medicalAnalysis.service.js
        └── index.js                 # Express entry point
```

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x
- A **MongoDB Atlas** cluster (free tier works)
- A **Google AI Studio** API key (for Gemini)
- A **Cloudinary** account (free tier works)
- A **Razorpay** account (test mode is fine)
- A Gmail account with an **App Password** enabled

---

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/your-username/ArogyaAI.git
cd ArogyaAI
```

**2. Install server dependencies**
```bash
cd server
npm install
```

**3. Install client dependencies**
```bash
cd ../client
npm install
```

---

### Environment Variables

Copy `server/.env.example` to `server/.env` and fill in your values:

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB Atlas
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/arogyaai

# JWT (use long random strings)
JWT_ACCESS_SECRET=<min 64 chars>
JWT_REFRESH_SECRET=<min 64 chars>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Google Gemini
GEMINI_API_KEY=<your key>
GEMINI_MODEL=gemini-1.5-flash

# Gmail SMTP
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=you@gmail.com
EMAIL_PASS=<Gmail App Password>
EMAIL_FROM=ArogyaAI <noreply@arogyaai.health>

# Cloudinary
CLOUDINARY_CLOUD_NAME=<name>
CLOUDINARY_API_KEY=<key>
CLOUDINARY_API_SECRET=<secret>

# CORS
CLIENT_URL=http://localhost:3000

# Cookie
COOKIE_SECRET=<min 32 chars>

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=<secret>
```

For the client, create `client/.env`:
```env
VITE_API_URL=http://localhost:5000/api/v1
```

---

### Running the App

**Start the backend:**
```bash
cd server
npm run dev        # Runs on http://localhost:5000
```

**Start the frontend (new terminal):**
```bash
cd client
npm run dev        # Runs on http://localhost:3000
```

**Verify server is up:**
```
GET http://localhost:5000/health
```

---

## API Reference

All endpoints are under `/api/v1`.

### Authentication — `/auth`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register (sends OTP email) |
| POST | `/auth/login` | Login (sets JWT cookies) |
| POST | `/auth/logout` | Clear auth cookies |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/verify-email` | Verify email OTP |
| POST | `/auth/forgot-password` | Send reset email |
| POST | `/auth/reset-password` | Reset password with token |

### Users — `/users`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/users/me` | Get current user profile |
| PUT | `/users/profile` | Update profile |
| PUT | `/users/avatar` | Upload avatar |
| PUT | `/users/change-password` | Change password |

### AI Chat — `/chat`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/chat/sessions` | List chat sessions |
| POST | `/chat/sessions` | Create new session |
| GET | `/chat/sessions/:id` | Get session + messages |
| POST | `/chat/sessions/:id/message` | Send message (Gemini reply) |
| DELETE | `/chat/sessions/:id` | Delete session |

### Appointments — `/appointments`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/appointments` | Patient's appointments |
| POST | `/appointments` | Book appointment |
| GET | `/appointments/:id` | Appointment details |
| PATCH | `/appointments/:id/cancel` | Cancel appointment |
| GET | `/appointments/doctor` | Doctor's appointment list |
| PATCH | `/appointments/:id/status` | Update status (doctor) |

### Health Records — `/records`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/records` | List records (filterable) |
| POST | `/records/extract-preview` | Upload → OCR + AI (no save) |
| POST | `/records/confirm` | Confirm extraction → save |
| GET | `/records/:id` | Single record |
| DELETE | `/records/:id` | Delete record |

### Doctors — `/doctors`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/doctors` | Search doctors |
| GET | `/doctors/:id` | Doctor profile + availability |
| GET | `/doctors/:id/slots` | Available time slots |
| GET | `/doctors/patients` | Doctor's patients |
| GET | `/doctors/patients/:id/360` | Patient 360° view |

### Payments — `/payments`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/payments/create-order` | Razorpay order for appointment |
| POST | `/payments/verify` | Verify signature + mark paid |
| GET | `/payments/invoice/:id` | Download PDF invoice |

### Emergency — `/emergency`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/emergency/analyze` | AI triage of symptoms/vitals |

### Notifications — `/notifications`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/notifications` | Get notifications |
| PATCH | `/notifications/:id/read` | Mark as read |
| PATCH | `/notifications/read-all` | Mark all as read |

---

## Data Models

### User
```
name, email, password (hashed, select:false), role (patient|doctor|admin),
avatar, dateOfBirth, gender, phone, address, bloodGroup,
allergies[], chronicConditions[], emergencyContact{name, relationship, phone},
doctorProfile{
  specialization, licenseNumber, experience, clinicName, clinicAddress,
  consultationFee, availability{}, bio, languages[], rating, reviewCount
},
isEmailVerified, passwordResetToken, passwordResetExpires,
refreshToken, lastLogin
```

### Appointment
```
patient (ref:User), doctor (ref:User),
date, startTime, endTime, type (in-person|video|phone),
status (pending|confirmed|completed|cancelled|no-show),
symptoms, notes, consultationFee,
payment{ orderId, paymentId, status, signature (select:false), paidAt },
reminderSent24h, reminderSent1h,
prescription{ medications[], notes, followUpDate }
```

### HealthRecord
```
user (ref:User), title, type (lab|prescription|imaging|other),
fileUrl, fileName, fileType, fileSize,
extractedData{ ...AI-structured fields with { value, confidence } },
rawText (OCR), summary (AI), doctorSummary (AI clinical),
doctorSummaryGeneratedAt
```

### ChatSession
```
user (ref:User), title,
messages[{ role (user|model), content, timestamp }],
lastActivity, isArchived
```

### Notification (TTL: 30 days)
```
user (ref:User), type, title, message, data{}, isRead, createdAt
```

### Otp (TTL: 10 minutes)
```
email, otp (hashed), purpose (email-verification|password-reset),
expiresAt, attempts
```

---

## AI & ML Features

### Gemini Model Fallback Chain
On quota exhaustion (`429` / daily limit), the system automatically moves to the next model variant in the chain. Transient errors (5xx) trigger retries with backoff on the same model. Safety blocks are thrown immediately without retry.

### Medical Record Extraction Flow
```
Upload (PDF / Image)
        |
Text Extraction
  PDF  → pdf-parse
  Image → Tesseract.js (OCR)
        |
Gemini AI Structured Extraction
  Returns: { field: { value, confidence } }
        |
normalizeMedicalExtraction
  (merges OCR raw text + AI output, fills gaps)
        |
extractionStore: idle → uploading → extracting → confirming
        |
User reviews fields in Confirmation Modal
  (low-confidence fields highlighted for correction)
        |
POST /records/confirm → saved to MongoDB
        |
Async: generateAndSaveDoctorSummary
  (Gemini clinical summary for doctors)
```

### Confidence Scoring
| Level | Score | UI Treatment |
|---|---|---|
| High | >= 0.8 | Displayed normally |
| Medium | >= 0.6 | Caution indicator |
| Low | < 0.6 | Highlighted for user correction |

---

## Security

| Mechanism | Implementation |
|---|---|
| HTTP Headers | Helmet with strict CSP |
| CORS | Allowlist of frontend origins + credentials |
| Rate Limiting | Global 300/15min, Auth 20/15min, AI 20/15min, Upload 10/15min, Payment 60/15min, Emergency 10/15min |
| Auth Tokens | Short-lived JWT (15m) + refresh (7d) in HTTP-only signed cookies |
| Passwords | Bcrypt hashing — never returned in queries |
| NoSQL Injection | express-mongo-sanitize |
| HTTP Param Pollution | HPP middleware |
| Payment Replay | HMAC-SHA256 signature + idempotency check on orderId |
| OTP | Hashed in DB + TTL index (10 min) + attempt limiting |

---

## Cron Jobs

Two automated reminder jobs run after the database connects:

| Job | Schedule | Purpose |
|---|---|---|
| 24-hour reminder | Every hour at :00 | Email + in-app notification for appointments in 24–25 hours |
| 1-hour reminder | Every 15 minutes | Email + in-app notification for appointments in 60–75 minutes |

Duplicate sends are prevented by `reminderSent24h` / `reminderSent1h` boolean flags on the Appointment document.

---

## Available Scripts

### Server
```bash
npm run dev      # nodemon dev server (port 5000)
npm start        # Production start
npm run lint     # ESLint
```

### Client
```bash
npm run dev      # Vite dev server (port 3000)
npm run build    # Production build → /dist
npm run preview  # Preview production build locally
npm run lint     # ESLint
```

---

## License

Built for academic/demonstration purposes.
