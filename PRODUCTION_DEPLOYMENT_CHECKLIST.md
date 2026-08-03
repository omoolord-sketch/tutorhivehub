# TutorHiveHub Production Deployment Checklist

Use this checklist before deploying the TutorHiveHub portal to production.

## Environment

- Set `NODE_ENV=production`.
- Set `APP_URL` and `PORTAL_URL` to the production domain.
- Set `DATABASE_URL` to the production Hostinger MySQL/MariaDB database, using `mysql://USER:PASSWORD@HOST:3306/DATABASE_NAME`.
- Set a strong `AUTH_SECRET` of at least 32 characters.
- Keep `CSRF_PROTECTION=true`.
- Keep `FORCE_HTTPS=true` behind production TLS.
- Set `CONTENT_SECURITY_POLICY` only if the default policy needs to be customised.
- Configure SMTP variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_SENDER`, `ADMIN_EMAIL`, and `PUBLIC_INFO_EMAIL`.
- Configure `UPLOAD_STORAGE_PATH`, `UPLOAD_MAX_BYTES`, and `LEARNING_UPLOAD_MAX_BYTES`.
- Set `BACKUP_STORAGE_LOCATION` or `BACKUP_PROCEDURE_URL`.
- Set `ERROR_MONITORING_DSN` or `LOG_RETENTION_DAYS`.
- Keep all secrets out of source control and frontend code.

## Database

- Back up the production database before deployment.
- Run `npm run db:deploy`.
- Run `npm run portal:seed-roles`.
- Create the first Super Admin with `npm run portal:create-super-admin` only when no Super Admin exists.
- Confirm the Phase 10 migration is listed as applied.
- Test restore from backup on a safe environment at least once per release cycle.

## Security

- Confirm `/portal` and all portal subpages are noindexed.
- Confirm unauthenticated users are redirected to `/portal/login`.
- Confirm parents can only see their linked children.
- Confirm tutors can only see their assigned/private records.
- Confirm finance users cannot access safeguarding records.
- Confirm parents and students cannot see internal tutor notes, QA records, or safeguarding records.
- Confirm upload limits and allowed file types are active.
- Confirm CSRF tokens are required on portal write requests.
- Confirm API errors do not expose stack traces.

## Email and Domain

- Confirm Google Workspace or SMTP sending works from the production server.
- Confirm `info@tutorhivehub.com` and `admin@tutorhivehub.com` receive portal notifications.
- Confirm SPF, DKIM, DMARC, MX, and domain verification records are correct.
- Send a test forgot-password email and a test portal notification.

## File Storage

- Store uploads outside the application source directory.
- Back up uploaded files.
- Restrict direct public access to private homework submissions, CVs, certificates, reports, and safeguarding attachments.
- Confirm file deletion actions are audit logged.

## QA Test Matrix

- Test desktop, tablet, and mobile viewport sizes.
- Test slow-network and empty-state screens.
- Test invalid inputs on forms.
- Test keyboard navigation and visible focus states.
- Test report CSV/PDF exports.
- Test audit log CSV/PDF exports.
- Test lesson scheduling conflicts.
- Test lesson report submission and safeguarding alert restrictions.
- Test timesheet generation, approval, and paid status.
- Test invoice creation, partial payment, receipt generation, and parent finance scoping.
- Run `npm run test:phase10`.
- Run `npm run build`.

## Rollback

- Keep the previous production build archive.
- Keep the pre-deployment database backup.
- Record the migration version deployed.
- If rollback is required, restore the previous build first, then restore database backup if the deployed migration cannot safely remain.
- Record rollback actions in the deployment notes.

## Release Notes

For each release, record:

- Date and time.
- Deployer.
- Git commit or build package name.
- Database migration status.
- Backup location.
- Smoke-test result.
- Known issues or follow-up items.
