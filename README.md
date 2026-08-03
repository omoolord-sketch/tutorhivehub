# TutorHiveHub Website and Portal

TutorHiveHub currently contains the public landing website, existing form endpoints, hidden internal reporting pages, and the Phase 10 secured educational portal foundation.

## Project Structure

- `src/App.tsx` keeps the public landing page and routes `/portal...` into the portal application.
- `src/portal/` contains the portal shell, feature flags, master-data pages, finance pages, learning pages, and reusable portal design-system components.
- `src/components/GlobalErrorBoundary.tsx` provides global React error handling.
- `public/api/` contains the Hostinger PHP endpoints used by the current public forms and internal reports.
- `server/` contains the Node/Express email server, portal authentication routes, master-data routes, finance routes, learning routes, and database helper for server-based deployments.
- `prisma/` contains the MySQL/MariaDB Prisma schema and committed Hostinger portal migrations.

## Current Routes

- `/` public TutorHiveHub landing page.
- `/portal` protected portal dashboard.
- `/portal/login` secure login.
- `/portal/forgot-password` password reset request.
- `/portal/reset-password` password reset completion.
- `/portal/verify-email` email verification.
- `/portal/users` admin user management.
- `/portal/users/new` create portal user.
- `/portal/users/:id/edit` edit portal user.
- `/portal/parents` parent and guardian management.
- `/portal/students` student academic record management.
- `/portal/tutors` tutor profile and readiness management.
- `/portal/subjects` subject catalogue management.
- `/portal/assignments` tutor-to-student subject assignments.
- `/portal/lessons` lesson scheduling and lesson records.
- `/portal/lessons/new` create one-off or weekly recurring lessons.
- `/portal/timetable` daily, weekly, monthly, admin, tutor, and student timetable views.
- `/portal/timetable/availability` tutor availability, unavailable dates, holidays, and temporary availability changes.
- `/portal/lesson-reports` daily lesson reports, outstanding reports, overdue reports, and submitted reports.
- `/portal/lesson-reports/lesson/:id` lesson workspace for preparation, attendance, and daily report completion.
- `/portal/lesson-reports/:id` printable/exportable daily lesson report detail.
- `/portal/timesheets` generated monthly tutor timesheets, rate history, payroll review, and payment checks.
- `/portal/timesheets/:id` monthly timesheet detail, row flags, approvals, adjustments, payment marking, and statement download.
- `/portal/finance` student billing, fee plans, invoices, parent payments, receipts, refunds, and finance dashboard.
- `/portal/finance/invoices/:id` invoice detail, parent payment initiation, confirmed-payment recording, and printable downloads.
- `/portal/homework` homework creation, publishing, student submission, review, feedback, and completion workflow.
- `/portal/resources` permission-controlled learning resource library with file and approved-link support.
- `/portal/progress` learning goals, progress records, and parent-approved summaries.
- `/portal/notifications` in-app portal notification feed and read-state controls.
- `/portal/reports` management reporting, filters, tutor performance indicators, and CSV/PDF exports.
- `/portal/quality` internal lesson observations, tutor reviews, training records, policy acknowledgements, and improvement plans.
- `/portal/security` security readiness, audit logs, data-protection records, retention rules, and deployment checklist.
- `/portal` parent and student dashboard entry point for Parent and Student roles.
- `/portal/children/:id` parent-only linked-child dashboard view.
- `/portal/access-denied` portal restricted-access page.
- `/daily-lesson-report` existing hidden internal daily report page.
- `/monthly-timesheet` existing hidden internal monthly timesheet page.

## Install Dependencies

```bash
npm install
```

## Environment Configuration

Create a local `.env` file from `.env.example` and fill in real values only on your machine or hosting provider.

Required Phase 1 variables:

```bash
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/tutorhivehub"
DB_CONNECTION_LIMIT=5
AUTH_SECRET="replace-with-a-long-random-secret"
APP_URL="http://127.0.0.1:5173"
PORTAL_URL="http://127.0.0.1:5173/portal"
EMAIL_PROVIDER="smtp"
EMAIL_SENDER="TutorHiveHub <info@tutorhivehub.com>"
ADMIN_EMAIL="admin@tutorhivehub.com"
PUBLIC_INFO_EMAIL="info@tutorhivehub.com"
UPLOAD_MAX_BYTES=10485760
LEARNING_UPLOAD_MAX_BYTES=20971520
UPLOAD_STORAGE_PATH="./uploads"
PORTAL_STUDENT_NO_SHOW_PAYABLE=false
CSRF_PROTECTION=true
CONTENT_SECURITY_POLICY=""
FORCE_HTTPS=false
DATA_RETENTION_DEFAULT_MONTHS=84
BACKUP_STORAGE_LOCATION=""
BACKUP_PROCEDURE_URL=""
ERROR_MONITORING_DSN=""
LOG_RETENTION_DAYS=90
FIELD_ENCRYPTION_KEY=""
PAYMENT_PROVIDER="Manual or bank transfer"
PAYMENT_PUBLIC_NAME="TutorHiveHub payments"
PAYMENT_CHECKOUT_URL=""
BANK_TRANSFER_DETAILS="TutorHiveHub bank transfer details will be provided by administration."
INITIAL_ADMIN_EMAIL="owner@tutorhivehub.com"
INITIAL_ADMIN_NAME="TutorHiveHub Super Admin"
INITIAL_ADMIN_PASSWORD="replace-with-a-strong-temporary-password"
```

Do not commit `.env`, SMTP passwords, database credentials, API keys, or `public/api/smtp-config.local.php`.

## Database Setup

Validate the Prisma schema:

```bash
npm run db:validate
```

Generate the Prisma client:

```bash
npm run db:generate
```

Apply the committed Hostinger MySQL baseline migration after `DATABASE_URL` points to a real MySQL/MariaDB database:

```bash
npm run db:deploy
```

Use `npm run db:migrate -- --name your_change_name` only when creating future schema changes locally. The older PostgreSQL phase migrations are archived in `prisma/migrations-postgresql-archive`; the active `prisma/migrations` folder contains the MySQL baseline for Hostinger.

Apply committed migrations in production:

```bash
npm run db:deploy
```

Seed portal roles and permissions:

```bash
npm run portal:seed-roles
```

Create the first Super Admin from environment variables:

```bash
npm run portal:create-super-admin
```

Open Prisma Studio:

```bash
npm run db:studio
```

## Development Mode

Start the Vite frontend:

```bash
npm run dev
```

Start the Express server when using the Node email/API path:

```bash
npm run server
```

The Vite dev server proxies `/api` requests to `http://127.0.0.1:4174`.

## Production Build

```bash
npm run build
```

The build output is written to `dist/`.

## Testing

Run the Phase 10 regression checks:

```bash
npm run test:phase10
```

The checks cover password policy, role permissions, parent/student scoping, homework permissions, report exports, scheduling conflict guards, safeguarding restrictions, timesheet/payroll rules, invoice balance logic, and security readiness flags.

## Phase 2 Authentication

The portal authentication layer is implemented in the Node/Express server and Prisma database path. A production portal should run on Hostinger Node hosting with Hostinger MySQL/MariaDB, ideally at `portal.tutorhivehub.com` or behind `/portal`.

Implemented in Phase 2:

- Secure login and logout.
- Password hashing with Node crypto `scrypt`.
- Signed HttpOnly session cookies with expiry and production `Secure` flag.
- Optional remember-me sessions using longer server-side expiry.
- Forgot password and reset password token flow.
- Email verification token flow.
- Account activation, suspension, and archive-ready statuses.
- Failed-login counting and temporary lockout.
- In-memory request rate limiting for sensitive auth endpoints.
- Server-side API permission checks.
- Audit logging for login and user-management actions.
- Initial Super Admin setup command using environment variables.
- Admin user list, create, edit, activate/deactivate, and reset-password UI.

The public landing page and existing PHP form endpoints remain separate from the portal.

## Phase 3 Master Data

Phase 3 adds database-backed portal modules for:

- Parents and guardians, including contact details, emergency contacts, status, notes, country, and time zone.
- Students, including parent links, subjects, exam pathway, academic goals, learning needs, assigned tutors, start date, and status.
- Tutors, including subjects taught, qualifications, availability, rate information, uploads, status, assigned students, internal notes, and technical-readiness fields.
- Subjects, including category, exam pathway, active/inactive status, and usage counts.
- Tutor assignments, including student, tutor, subject, start/end dates, status, notes, and duplicate-active-assignment confirmation.

Tutor CV and certificate uploads are stored under `UPLOAD_STORAGE_PATH` and are restricted to PDF, DOC, DOCX, JPG, and PNG files. Uploaded files are ignored by git.

## Phase 4 Timetable and Scheduling

Phase 4 adds database-backed scheduling modules for:

- Tutor weekly availability, approval, override, unavailable dates, holiday dates, and temporary availability changes.
- One-off and weekly recurring lessons.
- One-to-one, group, shadow support, NVQ support, assessment, replacement, and exam-preparation lesson types.
- Lesson fields for students, tutor, subject, date/time, time zone, duration, meeting link, objective, notes, recurrence, and status.
- Daily, weekly, monthly, admin, tutor, and student timetable views.
- Cancellation, rescheduling, replacement tutor assignment, and lesson status updates.
- Conflict checks for tutor double-booking, student double-booking, invalid times, invalid recurrence, and lessons outside approved tutor availability.
- Portal notifications and prepared email reminder hooks for created, updated, rescheduled, cancelled, replacement, and upcoming lesson events.

Apply the committed migrations before testing the scheduling module against a real database:

```bash
npm run db:deploy
```

## Phase 5 Lesson Workspace and Reports

Phase 5 adds the lesson-delivery workspace:

- Tutor dashboard lesson cards with meeting links, objectives, previous lesson summaries, outstanding homework, academic goals, preparation, and report actions.
- Tutor-ready action with technical-readiness checklist.
- Attendance recording for tutor attendance, student attendance, arrival time, lateness, absence reason, and notes.
- Daily lesson reports with understanding, engagement, strengths, support areas, homework, next steps, resources, parent-friendly updates, technical issues, internal tutor notes, and tutor declaration.
- Completed lessons remain `REPORT_OUTSTANDING` until a report is submitted.
- Outstanding and overdue report lists for authorised users.
- Parent-safe report output that excludes internal tutor notes and restricted safeguarding information.
- Restricted safeguarding concern records linked to the lesson/report, with urgent admin notifications and email hooks.
- Student academic timeline built from submitted lesson reports.
- Printable and text-exportable report detail pages.

## Phase 6 Monthly Timesheets and Payroll

Phase 6 adds the tutor payment-calculation module:

- Tutor rate history for standard hourly tutoring, online shadow-session flat rates, NVQ per-unit rates, and approved custom rates.
- Monthly timesheets generated from actual lesson records, not freely invented tutor rows.
- Historical rate lookup by lesson date and rate type.
- Payment eligibility rules for completed lessons, missing reports, tutor absence, cancelled lessons, and student no-shows.
- Automatic totals for lessons, students, subjects, hours, standard tutoring, shadow sessions, NVQ support, adjustments, and final payable amount.
- Tutor review actions to flag missing lessons, incorrect durations, incorrect rates, or other issues.
- Tutor submission with declaration.
- Administrator and finance review actions for under review, returned, approved, rejected, paid, payment date, and transaction reference.
- Authorised adjustment records with approval reason and audit logging.
- Downloadable text payment statement.

Set `PORTAL_STUDENT_NO_SHOW_PAYABLE=true` only if TutorHiveHub has decided that student no-shows are payable by default. Otherwise those rows remain flagged for review.

## Phase 7 Parent and Student Dashboards

Phase 7 adds secure family-facing dashboards:

- Parent dashboard for linked children, upcoming lessons, assigned tutors, subjects, attendance, parent-friendly lesson updates, homework, progress, invoices, payments, receipts, notifications, and support requests.
- Parent child view at `/portal/children/:id` scoped to children linked to the logged-in parent account.
- Student dashboard for today's lesson, upcoming timetable, join-lesson timing, assigned tutors, subjects, homework, approved resources, tutor feedback, goals, progress, notifications, and support requests.
- Support request records for technical issues, schedule concerns, tutor concerns, payment questions, academic support requests, and general enquiries.
- Staff notifications and email hooks for new support requests.
- Student account linking through the Student Management form, including a direct-login disabled setting.

Family dashboards do not expose internal tutor notes, tutor performance notes, safeguarding records, or confidential administrative notes.

## Phase 8 Finance, Invoices, Receipts, and Parent Payments

Phase 8 adds the student billing and parent-payment module. This remains separate from tutor payroll:

- Fee plans for hourly tutoring, monthly plans, subject packages, exam preparation, homework support, combined support, custom plans, discounts, scholarships, and concessions.
- Invoice records using numbers such as `THH-INV-2026-0001`, with parent, student, service, billing period, quantity, rate, discount, total, due date, status, and notes.
- Receipt records using numbers such as `THH-RCP-2026-0001`, generated only after a payment is confirmed.
- Payment records for bank transfer, card payment, online provider initiation, manual entries, partial payments, refunds, and corrections.
- Parent finance access for viewing invoices, downloading printable invoice/receipt HTML documents, starting payment, seeing history, and checking outstanding balance.
- Finance dashboard for total invoiced, total received, outstanding balance, overdue invoices, payments this month, refunds, and revenue breakdowns.
- Server-side parent scoping so parents can only access their own financial records.
- Audit logs for fee plans, invoices, payments, refunds, corrections, and receipt-generating confirmations.

Set `PAYMENT_CHECKOUT_URL` only when TutorHiveHub has an approved online payment provider. Payment API keys must stay in hosting environment variables and must not be exposed in frontend code.

## Phase 9 Homework, Resources, Progress, and Notifications

Phase 9 adds learning-continuity modules:

- Homework workflow for draft, assigned, submitted, late, reviewed, resubmission-required, completed, and cancelled statuses.
- Student homework submissions with validated uploads, comments, tutor marking, feedback, and resubmission requests.
- Homework and submission downloads through scoped API routes rather than exposed file paths.
- Resource library records for documents, PDFs, presentations, worksheets, images, approved links, videos, and other learning materials.
- Resource organisation by subject, year group, exam pathway, tutor, student, lesson, type, visibility, and status.
- Progress records for goals, baseline and current level, skills achieved, areas for improvement, tutor comments, review date, and goal status.
- Parent and student dashboards only show approved progress summaries and do not expose internal tutor comments.
- In-app notifications for homework assignment, homework submission, feedback availability, progress updates, invoice issued, payment received, and timesheet returned or approved.
- Notification read controls for users, with all-notification review available to authorised administrators.

Learning uploads use `LEARNING_UPLOAD_MAX_BYTES` when set, falling back to `UPLOAD_MAX_BYTES`. Apply committed migrations before testing Phase 9 against a real MySQL/MariaDB database:

```bash
npm run db:deploy
```

## Phase 10 Quality Assurance, Reporting, Security, and Deployment

Phase 10 adds final portal readiness modules:

- Management reports for students, tutors, lessons, attendance, absences, outstanding lesson reports, homework completion, tutor workload, payroll, invoices, payments, balances, revenue, support requests, and technical incidents.
- Filters by date range, student, parent, tutor, subject, exam pathway, and status.
- CSV and simple PDF export endpoints for management reports and audit logs.
- Internal tutor performance indicators for attendance, punctuality, report submission, homework feedback, retention, complaints, and quality-review notes.
- Quality assurance records for lesson observations, tutor reviews, training, policy acknowledgement, improvement plans, review dates, and reviewer notes.
- Audit log review and export for important portal actions.
- Security hardening with CSP, noindex portal headers, HTTPS-ready settings, CSRF protection, rate limiting, secure-cookie readiness, and sanitised API errors.
- Data-protection workflows for consent recording, retention rules, data export/deletion/anonymisation requests, and restricted access to children and safeguarding information.

Before production release:

```bash
npm run db:deploy
npm run portal:seed-roles
npm run portal:create-super-admin
npm run test:phase10
npm run build
```

Use `PRODUCTION_DEPLOYMENT_CHECKLIST.md` before every deployment. Production secrets, database URLs, SMTP passwords, payment credentials, file-storage keys, and encryption keys must stay in hosting environment variables only.

## Phase 1 Foundation

Phase 1 created the portal foundation:

- Portal shell and responsive layout.
- Role-ready navigation.
- Feature flags and coming-later module states.
- Reusable design-system components.
- Global error handling.
- Custom 404 and access-denied pages.
- Prisma schema and initial migration.

Deeper support ticket management and richer safeguarding workflows are still reserved for later phases.
