# TutorHiveHub Hostinger Deployment

The Hostinger public-site files are in `dist` after running:

```bash
npm run build
```

Important: `hostinger-public-html.zip` is for the public landing site, the existing PHP form endpoints, `/daily-lesson-report`, and `/monthly-timesheet`. The secured educational portal added in the later phases also needs the Hostinger Node/Express app and a Hostinger MySQL/MariaDB database. Do not treat the public ZIP as the full portal backend.

## Upload

1. Open Hostinger hPanel.
2. Go to File Manager.
3. Open the domain's `public_html` folder.
4. Upload `hostinger-public-html.zip`.
5. Extract it inside `public_html`, so `index.html`, `.htaccess`, `api`, `assets`, and the image files sit directly inside `public_html`.

## Portal Deployment

For the educational portal, use Node-capable hosting, ideally:

```text
portal.tutorhivehub.com
```

or a protected `/portal` route behind the Node server.

Production portal steps:

```bash
npm install
npm run db:deploy
npm run portal:seed-roles
npm run portal:create-super-admin
npm run test:phase10
npm run build
npm run server
```

Set production environment variables on the hosting platform, not inside the frontend code. Required values include `DATABASE_URL` in `mysql://USER:PASSWORD@HOST:3306/DATABASE_NAME` format, `AUTH_SECRET`, SMTP settings, upload storage, backup settings, and HTTPS/security flags. Use `PRODUCTION_DEPLOYMENT_CHECKLIST.md` before launch.

## Forms

The production form endpoints are PHP files for Hostinger shared hosting:

- `/api/parent-enquiry` sends parent enquiries to `info@tutorhivehub.com`.
- `/api/tutor-application` sends tutor applications and CV attachments to `admin@tutorhivehub.com` and `info@tutorhivehub.com`.

Email delivery uses Hostinger SMTP. The application reads SMTP environment variables when available. On Hostinger shared hosting, create:

```text
public_html/api/smtp-config.local.php
```

with:

```php
<?php
declare(strict_types=1);

define('SMTP_PASSWORD', 'YOUR_INFO_EMAIL_PASSWORD');
```

Do not upload or share this file. Future website updates should preserve it. The default non-secret settings use `smtp.hostinger.com`, port `465`, SSL, and `info@tutorhivehub.com`.

Each submitted form is also saved as a protected server backup in:

```text
public_html/api/submissions/
```

Open this folder in Hostinger File Manager if email delivery is delayed or blocked. Each submission has its own timestamped folder with `submission.json`; tutor CV uploads are saved beside that JSON file.

## Daily Lesson Report

The hidden internal tutor page is available by direct URL only:

```text
https://tutorhivehub.com/daily-lesson-report
```

It is marked `noindex` and is not linked from the public homepage. Reports are emailed to both `info@tutorhivehub.com` and `admin@tutorhivehub.com`, and are backed up in `public_html/api/submissions/`.

## Monthly Tutor Timesheet

The hidden monthly payment timesheet is available by direct URL only:

```text
https://tutorhivehub.com/monthly-timesheet
```

It is marked `noindex` and is not linked from the public homepage. Tutors can add multiple completed lessons, and the page automatically calculates lesson, student, subject, hour, and payment totals. Submitted timesheets are emailed to both administration addresses and backed up in `public_html/api/submissions/`.

Before testing forms, make sure these email accounts exist in Hostinger:

- `info@tutorhivehub.com`
- `admin@tutorhivehub.com`

If emails still go to spam, set up SPF/DKIM in Hostinger DNS.

## Important

Make sure `.htaccess` is present in `public_html`; it routes clean URLs and maps the form endpoints to the PHP handlers.
