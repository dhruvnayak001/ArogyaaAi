# ArogyaAI — Feature Modules Implementation Plan

## Audit Summary

### What Already Exists (DO NOT REWRITE)
| File | Status |
|------|--------|
| `client/src/pages/chat/ChatPage.jsx` | ✅ Complete scaffold — needs route wired + chat-start UX fix |
| `client/src/pages/emergency/EmergencyPage.jsx` | ✅ Complete — works as-is |
| `client/src/pages/records/HealthRecordsPage.jsx` | ✅ Good scaffold — needs upload modal |
| `client/src/pages/appointments/BookAppointmentPage.jsx` | ⚠️ Stub — steps not implemented |
| `client/src/store/chatStore.js` | ✅ Complete |
| `client/src/api/*.js` (all 5 modules) | ✅ Complete |
| `client/src/components/navigation/Sidebar.jsx` | ✅ Complete |
| `client/src/layouts/DashboardLayout.jsx` | ✅ Complete |
| `server/src/services/*.js` (all 5) | ✅ Complete |
| `server/src/controllers/*.js` (all 5) | ✅ Complete |
| `server/src/routes/*.js` (all routes) | ✅ Complete |

### What Is Missing / Incomplete

#### Frontend
1. **App.jsx** — Only `/dashboard` and `/chat` routes exist. `/appointments`, `/records`, `/emergency`, `/profile`, `/settings`, `/doctor/*` routes not wired.
2. **ChatPage** — Works but auto-creates session when sending (needs flow fix: must create session first if none active)
3. **AppointmentsPage** — Stub `BookAppointmentPage.jsx` only. Missing `AppointmentsPage` (list view).
4. **BookAppointmentPage** — All 4 steps are stubs with no real content.
5. **DashboardPage** — Stats show `—`. Needs real data from APIs.
6. **HealthRecordsPage** — Upload button does nothing. Needs upload modal.
7. **Doctor pages** — `/doctor/dashboard` referenced in auth but `DoctorLayout` is empty.
8. **Profile/Settings pages** — Referenced in sidebar but stubs.
9. **`doctors.api.js`** — Missing `getAll()`, `getById()`, `getSlots()` — exists but not checked.
10. **Reusable UI components** — `LoadingSkeleton`, `EmptyState`, `StatusBadge`, `Modal` — none exist.

#### Backend
- All backend code is complete and working. No changes needed except ensuring `nodemon` doesn't crash on port conflict.

---

## Implementation Plan

### Phase 1 — Core Shared UI Components
Create reusable components used across all pages.

#### [NEW] `client/src/components/ui/LoadingSkeleton.jsx`
#### [NEW] `client/src/components/ui/EmptyState.jsx`
#### [NEW] `client/src/components/ui/StatusBadge.jsx`
#### [NEW] `client/src/components/ui/Modal.jsx`
#### [NEW] `client/src/components/ui/ConfirmDialog.jsx`

---

### Phase 2 — App Routing
Wire all missing routes into App.jsx.

#### [MODIFY] `client/src/App.jsx`
Add routes for:
- `/chat` and `/chat/:sessionId`
- `/appointments` and `/appointments/book`
- `/records`
- `/emergency`
- `/profile`
- `/settings`
- `/doctor/dashboard`

---

### Phase 3 — AI Chat Module (Polish)
ChatPage scaffold is 90% complete. Add:
- Auto-create session on first message send
- Markdown rendering for AI responses (using `react-markdown`)
- Message timestamp display
- Mobile responsive layout (hidden sidebar on mobile, hamburger toggle)

#### [MODIFY] `client/src/pages/chat/ChatPage.jsx`

---

### Phase 4 — Appointments System
Full implementation of the booking wizard and list view.

#### [NEW] `client/src/pages/appointments/AppointmentsPage.jsx`
- Upcoming/past tabs
- Appointment cards with status badges
- Cancel action
- Link to book

#### [MODIFY] `client/src/pages/appointments/BookAppointmentPage.jsx`
- Step 1: Specialty selector grid
- Step 2: Doctor cards with real API data (`doctorsApi.getAll`)
- Step 3: Calendar + time slot picker (real slots from `appointmentsApi.getAvailableSlots`)
- Step 4: Confirm summary + submit to `appointmentsApi.book`

---

### Phase 5 — Health Records (Upload Modal)
HealthRecordsPage is mostly done. Add:
- Upload record modal (title, type, date, file drag-drop)
- Delete with confirmation
- Type badge coloring

#### [MODIFY] `client/src/pages/records/HealthRecordsPage.jsx`
#### [NEW] `client/src/components/records/UploadRecordModal.jsx`

---

### Phase 6 — Dashboard Polish
Connect real data to stats cards.

#### [MODIFY] `client/src/pages/dashboard/DashboardPage.jsx`
- Fetch appointment count from `appointmentsApi.getUpcoming()`
- Fetch session count from `chatApi.getSessions()`
- Fetch record count from `recordsApi.getAll()`
- Show recent AI chat sessions
- Show next upcoming appointment

---

### Phase 7 — Doctor Dashboard
Wire the DoctorLayout and create doctor dashboard.

#### [MODIFY] `client/src/layouts/DoctorLayout.jsx`
#### [NEW] `client/src/pages/doctor/DoctorDashboardPage.jsx`
- Patient list section
- Today's appointments
- Stats summary

---

### Phase 8 — Profile & Settings Pages
#### [NEW] `client/src/pages/profile/ProfilePage.jsx`
#### [MODIFY] `client/src/pages/settings/SettingsPage.jsx`

---

## Verification Plan
1. `node --check` all modified backend files
2. `npm run build` on client to catch import errors
3. Live test: register → login → navigate to all pages
4. Live test: create chat session → send message → verify AI response
5. Live test: browse doctors → book appointment → see in list
6. Live test: upload health record → view in list → delete
