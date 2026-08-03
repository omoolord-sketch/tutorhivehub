<?php
declare(strict_types=1);

require_once __DIR__ . '/_mailer.php';

require_post();

if (field_value('website') !== '') {
    send_json(200, ['ok' => true]);
}

function timesheet_required_text($value, int $maxLength, string $label): string
{
    if (is_array($value) || is_object($value)) {
        send_json(422, ['ok' => false, 'message' => 'Please check ' . $label . ' and try again.']);
    }
    $text = trim((string)$value);
    if ($text === '' || strlen($text) > $maxLength) {
        send_json(422, ['ok' => false, 'message' => 'Please check ' . $label . ' and try again.']);
    }
    return $text;
}

function timesheet_optional_text($value, int $maxLength, string $label): string
{
    if (is_array($value) || is_object($value)) {
        send_json(422, ['ok' => false, 'message' => 'Please check ' . $label . ' and try again.']);
    }
    $text = trim((string)$value);
    if (strlen($text) > $maxLength) {
        send_json(422, ['ok' => false, 'message' => 'Please shorten ' . $label . ' and try again.']);
    }
    return $text;
}

function timesheet_lower(string $value): string
{
    return function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value);
}

$fields = [
    'tutorName' => field_value('tutorName'),
    'tutorEmail' => field_value('tutorEmail'),
    'tutorPhone' => field_value('tutorPhone'),
    'mainSubjects' => field_value('mainSubjects'),
    'monthCovered' => field_value('monthCovered'),
    'yearCovered' => field_value('yearCovered'),
    'paymentCurrency' => field_value('paymentCurrency'),
    'paymentDetails' => field_value('paymentDetails'),
    'additionalNotes' => field_value('additionalNotes'),
    'tutorDeclaration' => field_value('tutorDeclaration'),
    'lessonsJson' => field_value('lessonsJson'),
];

validate_required($fields, [
    'tutorName',
    'tutorEmail',
    'tutorPhone',
    'mainSubjects',
    'monthCovered',
    'yearCovered',
    'paymentCurrency',
    'paymentDetails',
    'tutorDeclaration',
    'lessonsJson',
]);

$fields['tutorName'] = timesheet_required_text($fields['tutorName'], 160, 'the tutor name');
$fields['tutorPhone'] = timesheet_required_text($fields['tutorPhone'], 80, 'the tutor phone number');
$fields['mainSubjects'] = timesheet_required_text($fields['mainSubjects'], 500, 'the main subject areas');
$fields['paymentDetails'] = timesheet_required_text($fields['paymentDetails'], 2000, 'the payment details');
$fields['additionalNotes'] = timesheet_optional_text($fields['additionalNotes'], 3000, 'the additional notes');

if (!filter_var($fields['tutorEmail'], FILTER_VALIDATE_EMAIL)) {
    send_json(422, ['ok' => false, 'message' => 'Please enter a valid tutor email address.']);
}

$months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

$monthIndex = array_search($fields['monthCovered'], $months, true);
if ($monthIndex === false) {
    send_json(422, ['ok' => false, 'message' => 'Please select a valid month.']);
}

$year = filter_var($fields['yearCovered'], FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 2020, 'max_range' => 2100],
]);
if ($year === false) {
    send_json(422, ['ok' => false, 'message' => 'Please enter a valid year.']);
}

$allowedCurrencies = ['GBP', 'NGN', 'USD', 'EUR', 'Other'];
if (!in_array($fields['paymentCurrency'], $allowedCurrencies, true)) {
    send_json(422, ['ok' => false, 'message' => 'Please select a valid payment currency.']);
}

if ($fields['tutorDeclaration'] !== 'Confirmed') {
    send_json(422, ['ok' => false, 'message' => 'Please confirm the tutor declaration.']);
}

try {
    $submittedLessons = json_decode($fields['lessonsJson'], true, 512, JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    send_json(422, ['ok' => false, 'message' => 'The lesson entries could not be read. Please try again.']);
}

if (!is_array($submittedLessons) || count($submittedLessons) < 1 || count($submittedLessons) > 500) {
    send_json(422, ['ok' => false, 'message' => 'Please include between 1 and 500 completed lessons.']);
}

$allowedLessonTypes = [
    'One-to-One Tutoring',
    'Homework Support',
    'GCSE Preparation',
    'A-Level Preparation',
    'WAEC Preparation',
    'JAMB Preparation',
    'SAT Preparation',
    'IELTS Preparation',
    'NVQ Support',
    'Online Shadow Support',
    'Other',
];

$lessons = [];
$totalHours = 0.0;
$totalAmount = 0.0;
$students = [];
$subjects = [];
$missingReportRows = [];
$expectedMonth = $monthIndex + 1;

foreach ($submittedLessons as $index => $submittedLesson) {
    $rowNumber = $index + 1;
    if (!is_array($submittedLesson)) {
        send_json(422, ['ok' => false, 'message' => 'Please check lesson row ' . $rowNumber . '.']);
    }

    $date = timesheet_required_text($submittedLesson['date'] ?? '', 10, 'the date in lesson row ' . $rowNumber);
    $time = timesheet_required_text($submittedLesson['time'] ?? '', 5, 'the time in lesson row ' . $rowNumber);
    $student = timesheet_required_text($submittedLesson['student'] ?? '', 160, 'the student in lesson row ' . $rowNumber);
    $subject = timesheet_required_text($submittedLesson['subject'] ?? '', 160, 'the subject in lesson row ' . $rowNumber);
    $lessonType = timesheet_required_text($submittedLesson['lessonType'] ?? '', 100, 'the lesson type in row ' . $rowNumber);
    $reportSubmitted = timesheet_required_text(
        $submittedLesson['reportSubmitted'] ?? '',
        3,
        'the lesson report status in row ' . $rowNumber,
    );
    $notes = timesheet_optional_text($submittedLesson['notes'] ?? '', 1000, 'the notes in lesson row ' . $rowNumber);

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        send_json(422, ['ok' => false, 'message' => 'Please enter a valid date in lesson row ' . $rowNumber . '.']);
    }

    [$lessonYear, $lessonMonth, $lessonDay] = array_map('intval', explode('-', $date));
    if (!checkdate($lessonMonth, $lessonDay, $lessonYear)
        || $lessonYear !== $year
        || $lessonMonth !== $expectedMonth) {
        send_json(422, [
            'ok' => false,
            'message' => 'Every lesson date must fall within ' . $fields['monthCovered'] . ' ' . $year . '.',
        ]);
    }

    if (!preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $time)) {
        send_json(422, ['ok' => false, 'message' => 'Please enter a valid time in lesson row ' . $rowNumber . '.']);
    }

    if (!in_array($lessonType, $allowedLessonTypes, true)) {
        send_json(422, ['ok' => false, 'message' => 'Please select a valid lesson type in row ' . $rowNumber . '.']);
    }

    $hours = $submittedLesson['hours'] ?? null;
    $rate = $submittedLesson['rate'] ?? null;
    if (!is_numeric($hours) || (float)$hours < 0.25 || (float)$hours > 24) {
        send_json(422, ['ok' => false, 'message' => 'Please check the hours taught in lesson row ' . $rowNumber . '.']);
    }
    if (!is_numeric($rate) || (float)$rate < 0 || (float)$rate > 1000000) {
        send_json(422, ['ok' => false, 'message' => 'Please check the rate in lesson row ' . $rowNumber . '.']);
    }
    if (!in_array($reportSubmitted, ['Yes', 'No'], true)) {
        send_json(422, ['ok' => false, 'message' => 'Please confirm the lesson report status in row ' . $rowNumber . '.']);
    }

    $hours = round((float)$hours, 2);
    $rate = round((float)$rate, 2);
    $amount = round($hours * $rate, 2);

    $lessons[] = [
        'date' => $date,
        'time' => $time,
        'student' => $student,
        'subject' => $subject,
        'lessonType' => $lessonType,
        'hours' => $hours,
        'rate' => $rate,
        'amount' => $amount,
        'reportSubmitted' => $reportSubmitted,
        'notes' => $notes,
    ];

    $totalHours += $hours;
    $totalAmount += $amount;
    $students[timesheet_lower($student)] = true;
    $subjects[timesheet_lower($subject)] = true;
    if ($reportSubmitted === 'No') {
        $missingReportRows[] = $rowNumber;
    }
}

$totalLessons = count($lessons);
$totalStudents = count($students);
$totalSubjects = count($subjects);
$totalHours = round($totalHours, 2);
$totalAmount = round($totalAmount, 2);
$currency = $fields['paymentCurrency'];
$additionalNotes = $fields['additionalNotes'] !== '' ? $fields['additionalNotes'] : 'None provided';
$hasMissingReports = count($missingReportRows) > 0;

$emailSubject = 'TutorHiveHub Monthly Timesheet - '
    . preg_replace('/[\r\n]+/', ' ', $fields['tutorName'])
    . ' - '
    . $fields['monthCovered']
    . ' '
    . $year;

$html = '<div style="font-family: Arial, sans-serif; color: #102033; max-width: 1100px; margin: 0 auto;">';
$html .= '<div style="background: #061c3d; color: #ffffff; padding: 24px;">';
$html .= '<p style="margin: 0 0 6px; color: #f2aa00; font-weight: 700;">TutorHiveHub</p>';
$html .= '<h1 style="margin: 0; font-size: 26px;">Monthly Tutor Timesheet</h1>';
$html .= '<p style="margin: 8px 0 0; color: #dbe5f4;">'
    . escape_html($fields['monthCovered'] . ' ' . $year)
    . '</p></div>';

if ($hasMissingReports) {
    $html .= '<div style="margin: 20px 0; border-left: 5px solid #b42318; background: #fff1f0; color: #7a271a; padding: 16px;">';
    $html .= '<strong>WARNING: One or more lessons do not have a submitted daily lesson report. Payment should be verified before processing.</strong>';
    $html .= '<p style="margin: 6px 0 0;">Affected lesson rows: ' . escape_html(implode(', ', $missingReportRows)) . '</p>';
    $html .= '</div>';
}

$html .= '<h2 style="color: #061c3d; font-size: 19px; margin: 24px 0 10px;">Tutor Information</h2>';
$html .= '<table style="width: 100%; border-collapse: collapse;">';
$tutorInfo = [
    'Tutor full name' => $fields['tutorName'],
    'Tutor email' => $fields['tutorEmail'],
    'Tutor phone number' => $fields['tutorPhone'],
    'Month covered' => $fields['monthCovered'],
    'Year' => (string)$year,
    'Main subject area(s)' => $fields['mainSubjects'],
    'Payment currency' => $currency,
    'Payment method/account details' => $fields['paymentDetails'],
];
foreach ($tutorInfo as $label => $value) {
    $html .= '<tr>';
    $html .= '<th style="width: 32%; border: 1px solid #dce3ec; background: #f5f7fa; padding: 10px; text-align: left; vertical-align: top; color: #56657a;">'
        . escape_html($label)
        . '</th>';
    $html .= '<td style="border: 1px solid #dce3ec; padding: 10px; vertical-align: top;">'
        . nl2br(escape_html($value))
        . '</td></tr>';
}
$html .= '</table>';

$html .= '<h2 style="color: #061c3d; font-size: 19px; margin: 24px 0 10px;">Completed Lessons</h2>';
$html .= '<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
$html .= '<thead><tr style="background: #061c3d; color: #ffffff;">';
foreach (['#', 'Date', 'Time', 'Student', 'Subject', 'Lesson type', 'Hours', 'Rate', 'Amount due', 'Report?', 'Notes'] as $heading) {
    $html .= '<th style="border: 1px solid #29446a; padding: 8px; text-align: left;">' . escape_html($heading) . '</th>';
}
$html .= '</tr></thead><tbody>';
foreach ($lessons as $index => $lesson) {
    $rowStyle = $lesson['reportSubmitted'] === 'No' ? 'background: #fff1f0;' : 'background: #ffffff;';
    $html .= '<tr style="' . $rowStyle . '">';
    $rowValues = [
        (string)($index + 1),
        $lesson['date'],
        $lesson['time'],
        $lesson['student'],
        $lesson['subject'],
        $lesson['lessonType'],
        number_format($lesson['hours'], 2),
        $currency . ' ' . number_format($lesson['rate'], 2),
        $currency . ' ' . number_format($lesson['amount'], 2),
        $lesson['reportSubmitted'],
        $lesson['notes'] !== '' ? $lesson['notes'] : '-',
    ];
    foreach ($rowValues as $columnIndex => $value) {
        $cellStyle = $columnIndex === 9 && $lesson['reportSubmitted'] === 'No'
            ? ' color: #b42318; font-weight: 700;'
            : '';
        $html .= '<td style="border: 1px solid #dce3ec; padding: 8px; vertical-align: top;' . $cellStyle . '">'
            . nl2br(escape_html($value))
            . '</td>';
    }
    $html .= '</tr>';
}
$html .= '</tbody></table></div>';

$html .= '<h2 style="color: #061c3d; font-size: 19px; margin: 24px 0 10px;">Monthly Summary</h2>';
$html .= '<table style="width: 100%; border-collapse: collapse;">';
$summary = [
    'Total lessons delivered' => (string)$totalLessons,
    'Total students taught' => (string)$totalStudents,
    'Total subjects taught' => (string)$totalSubjects,
    'Total hours completed' => number_format($totalHours, 2),
    'Total amount due' => $currency . ' ' . number_format($totalAmount, 2),
    'Additional notes for admin' => $additionalNotes,
    'Tutor declaration' => 'Confirmed',
];
foreach ($summary as $label => $value) {
    $html .= '<tr>';
    $html .= '<th style="width: 32%; border: 1px solid #dce3ec; background: #f5f7fa; padding: 10px; text-align: left; vertical-align: top; color: #56657a;">'
        . escape_html($label)
        . '</th>';
    $html .= '<td style="border: 1px solid #dce3ec; padding: 10px; vertical-align: top;">'
        . nl2br(escape_html($value))
        . '</td></tr>';
}
$html .= '</table>';
$html .= '<p style="margin-top: 24px; color: #56657a; font-size: 13px;">This timesheet was submitted through the TutorHiveHub internal monthly timesheet form.</p>';
$html .= '</div>';

$textLines = [
    'TutorHiveHub Monthly Tutor Timesheet',
    $fields['monthCovered'] . ' ' . $year,
    '',
];
if ($hasMissingReports) {
    $textLines[] = 'WARNING: One or more lessons do not have a submitted daily lesson report. Payment should be verified before processing.';
    $textLines[] = 'Affected lesson rows: ' . implode(', ', $missingReportRows);
    $textLines[] = '';
}
$textLines[] = 'TUTOR INFORMATION';
foreach ($tutorInfo as $label => $value) {
    $textLines[] = $label . ': ' . $value;
}
$textLines[] = '';
$textLines[] = 'COMPLETED LESSONS';
foreach ($lessons as $index => $lesson) {
    $textLines[] = 'Lesson ' . ($index + 1)
        . ': ' . $lesson['date']
        . ' | ' . $lesson['time']
        . ' | ' . $lesson['student']
        . ' | ' . $lesson['subject']
        . ' | ' . $lesson['lessonType']
        . ' | Hours: ' . number_format($lesson['hours'], 2)
        . ' | Rate: ' . $currency . ' ' . number_format($lesson['rate'], 2)
        . ' | Amount: ' . $currency . ' ' . number_format($lesson['amount'], 2)
        . ' | Report submitted: ' . $lesson['reportSubmitted']
        . ' | Notes: ' . ($lesson['notes'] !== '' ? $lesson['notes'] : '-');
}
$textLines[] = '';
$textLines[] = 'MONTHLY SUMMARY';
foreach ($summary as $label => $value) {
    $textLines[] = $label . ': ' . $value;
}
$text = implode("\n", $textLines);

$backupFields = $tutorInfo;
$backupFields['Lesson entries'] = json_encode(
    $lessons,
    JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE,
);
foreach ($summary as $label => $value) {
    $backupFields[$label] = $value;
}
$backupId = save_submission_backup('monthly tutor timesheet', $backupFields);

$recipients = [PUBLIC_INFO_EMAIL, ADMIN_EMAIL];
$message = build_custom_email_message(
    $emailSubject,
    $recipients,
    $fields['tutorEmail'],
    $text,
    $html,
);

$sent = smtp_send_message($recipients, $message);
if (!$sent) {
    send_json(500, [
        'ok' => false,
        'message' => 'Something went wrong. Please check your details and try again.',
        'reference' => $backupId,
    ]);
}

send_json(200, ['ok' => true, 'reference' => $backupId]);
