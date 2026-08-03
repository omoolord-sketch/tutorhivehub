<?php
declare(strict_types=1);

require_once __DIR__ . '/_mailer.php';

require_post();

if (field_value('website') !== '') {
    send_json(200, ['ok' => true]);
}

$fieldLabels = [
    'lessonDate' => 'Date of lesson',
    'lessonStartTime' => 'Lesson start time',
    'lessonEndTime' => 'Lesson end time',
    'tutorName' => 'Tutor full name',
    'tutorEmail' => 'Tutor email',
    'studentName' => 'Student full name',
    'studentAgeYear' => 'Student age/year group',
    'subject' => 'Subject',
    'lessonType' => 'Lesson type',
    'studentAttended' => 'Did the student attend?',
    'arrivalStatus' => 'Student arrival status',
    'minutesLate' => 'Minutes late',
    'topicCovered' => 'Topic covered',
    'lessonSummary' => 'Lesson summary',
    'studentParticipation' => 'Student participation',
    'studentUnderstanding' => 'Student understanding',
    'strengthsObserved' => 'Strengths observed',
    'areasForSupport' => 'Areas needing further support',
    'homeworkGiven' => 'Homework or task given',
    'homeworkDueDate' => 'Homework due date',
    'nextLessonRecommendation' => 'Next lesson recommendation',
    'resourcesNeeded' => 'Resources needed for next lesson',
    'technicalIssue' => 'Any technical issues?',
    'technicalIssueDetails' => 'Technical issue details',
    'safeguardingConcern' => 'Any safeguarding or welfare concern?',
    'safeguardingConcernDetails' => 'Safeguarding concern details',
    'parentUpdate' => 'Short parent update',
    'tutorDeclaration' => 'Tutor declaration',
];

$fields = [];
foreach ($fieldLabels as $key => $label) {
    $fields[$key] = field_value($key);
}

$required = [
    'lessonDate',
    'lessonStartTime',
    'lessonEndTime',
    'tutorName',
    'tutorEmail',
    'studentName',
    'studentAgeYear',
    'subject',
    'lessonType',
    'studentAttended',
    'arrivalStatus',
    'topicCovered',
    'lessonSummary',
    'studentParticipation',
    'studentUnderstanding',
    'strengthsObserved',
    'areasForSupport',
    'homeworkGiven',
    'nextLessonRecommendation',
    'technicalIssue',
    'safeguardingConcern',
    'parentUpdate',
    'tutorDeclaration',
];

validate_required($fields, $required);

if (!filter_var($fields['tutorEmail'], FILTER_VALIDATE_EMAIL)) {
    send_json(422, ['ok' => false, 'message' => 'Please enter a valid tutor email address.']);
}

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fields['lessonDate'])) {
    send_json(422, ['ok' => false, 'message' => 'Please enter a valid lesson date.']);
}

if (!preg_match('/^\d{2}:\d{2}$/', $fields['lessonStartTime'])
    || !preg_match('/^\d{2}:\d{2}$/', $fields['lessonEndTime'])
    || $fields['lessonEndTime'] <= $fields['lessonStartTime']) {
    send_json(422, ['ok' => false, 'message' => 'Lesson end time must be later than the start time.']);
}

$allowed = [
    'lessonType' => [
        'One-to-One Tutoring',
        'Homework Support',
        'GCSE Preparation',
        'A-Level Preparation',
        'WAEC Preparation',
        'JAMB Preparation',
        'SAT Preparation',
        'IELTS Preparation',
        'NVQ Support',
        'University Admission Coaching',
        'Other',
    ],
    'studentAttended' => ['Yes', 'No'],
    'arrivalStatus' => ['On Time', 'Late', 'Did Not Attend'],
    'studentParticipation' => ['Highly Engaged', 'Participated Well', 'Needed Encouragement', 'Disengaged'],
    'studentUnderstanding' => ['Excellent', 'Good', 'Fair', 'Needs Improvement'],
    'technicalIssue' => ['Yes', 'No'],
    'safeguardingConcern' => ['Yes', 'No'],
    'tutorDeclaration' => ['Confirmed'],
];

foreach ($allowed as $key => $values) {
    if (!in_array($fields[$key], $values, true)) {
        send_json(422, ['ok' => false, 'message' => 'Please check the selected form options and try again.']);
    }
}

if ($fields['arrivalStatus'] === 'Late') {
    $minutesLate = filter_var($fields['minutesLate'], FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 1, 'max_range' => 180],
    ]);
    if ($minutesLate === false) {
        send_json(422, ['ok' => false, 'message' => 'Please enter the number of minutes the student was late.']);
    }
} else {
    $fields['minutesLate'] = 'Not applicable';
}

if ($fields['technicalIssue'] === 'Yes' && $fields['technicalIssueDetails'] === '') {
    send_json(422, ['ok' => false, 'message' => 'Please provide details of the technical issue.']);
}

if ($fields['technicalIssue'] === 'No' && $fields['technicalIssueDetails'] === '') {
    $fields['technicalIssueDetails'] = 'None reported';
}

if ($fields['safeguardingConcern'] === 'Yes' && $fields['safeguardingConcernDetails'] === '') {
    send_json(422, ['ok' => false, 'message' => 'Please provide details of the safeguarding or welfare concern.']);
}

if ($fields['safeguardingConcern'] === 'No' && $fields['safeguardingConcernDetails'] === '') {
    $fields['safeguardingConcernDetails'] = 'None reported';
}

foreach (['homeworkDueDate', 'resourcesNeeded'] as $optionalKey) {
    if ($fields[$optionalKey] === '') {
        $fields[$optionalKey] = 'Not provided';
    }
}

$sections = [
    'Session Information' => [
        'lessonDate',
        'lessonStartTime',
        'lessonEndTime',
        'tutorName',
        'tutorEmail',
        'studentName',
        'studentAgeYear',
        'subject',
        'lessonType',
    ],
    'Attendance' => [
        'studentAttended',
        'arrivalStatus',
        'minutesLate',
    ],
    'Lesson Details' => [
        'topicCovered',
        'lessonSummary',
        'studentParticipation',
        'studentUnderstanding',
        'strengthsObserved',
        'areasForSupport',
    ],
    'Homework / Next Steps' => [
        'homeworkGiven',
        'homeworkDueDate',
        'nextLessonRecommendation',
        'resourcesNeeded',
    ],
    'Technical / Safeguarding' => [
        'technicalIssue',
        'technicalIssueDetails',
        'safeguardingConcern',
        'safeguardingConcernDetails',
    ],
    'Parent-Friendly Update' => [
        'parentUpdate',
    ],
    'Tutor Declaration' => [
        'tutorDeclaration',
    ],
];

$isSafeguarding = $fields['safeguardingConcern'] === 'Yes';
$hasTechnicalIssue = $fields['technicalIssue'] === 'Yes';
$subjectPrefix = $isSafeguarding ? 'URGENT SAFEGUARDING CONCERN - ' : '';
$emailSubject = $subjectPrefix
    . 'TutorHiveHub Lesson Report - '
    . preg_replace('/[\r\n]+/', ' ', $fields['studentName'])
    . ' - '
    . preg_replace('/[\r\n]+/', ' ', $fields['subject'])
    . ' - '
    . $fields['lessonDate'];

$html = '<div style="font-family: Arial, sans-serif; color: #102033; max-width: 780px; margin: 0 auto;">';
$html .= '<div style="background: #061c3d; color: #ffffff; padding: 24px;">';
$html .= '<p style="margin: 0 0 6px; color: #f2aa00; font-weight: 700;">TutorHiveHub</p>';
$html .= '<h1 style="margin: 0; font-size: 26px;">Daily Lesson Report</h1>';
$html .= '</div>';

if ($isSafeguarding) {
    $html .= '<div style="margin: 20px 0; border-left: 5px solid #b42318; background: #fff1f0; color: #7a271a; padding: 16px;">';
    $html .= '<strong>URGENT SAFEGUARDING OR WELFARE CONCERN REPORTED</strong>';
    $html .= '<p style="margin: 6px 0 0;">TutorHiveHub management should review and follow up immediately.</p>';
    $html .= '</div>';
}

foreach ($sections as $sectionTitle => $keys) {
    $sectionStyle = $sectionTitle === 'Technical / Safeguarding' && $hasTechnicalIssue
        ? 'border: 2px solid #f2aa00; background: #fffaf0;'
        : 'border: 1px solid #dce3ec; background: #ffffff;';
    $html .= '<section style="margin: 18px 0; ' . $sectionStyle . '">';
    $html .= '<h2 style="margin: 0; background: #f5f7fa; color: #061c3d; padding: 12px 16px; font-size: 18px;">'
        . escape_html($sectionTitle)
        . '</h2>';
    $html .= '<table style="width: 100%; border-collapse: collapse;">';
    foreach ($keys as $key) {
        $valueStyle = '';
        if ($key === 'technicalIssue' && $hasTechnicalIssue) {
            $valueStyle = ' color: #9a6700; font-weight: 700;';
        }
        if ($key === 'safeguardingConcern' && $isSafeguarding) {
            $valueStyle = ' color: #b42318; font-weight: 700;';
        }
        $html .= '<tr>';
        $html .= '<th style="width: 35%; border-top: 1px solid #e5eaf0; padding: 11px 16px; text-align: left; vertical-align: top; color: #56657a;">'
            . escape_html($fieldLabels[$key])
            . '</th>';
        $html .= '<td style="border-top: 1px solid #e5eaf0; padding: 11px 16px; vertical-align: top;' . $valueStyle . '">'
            . nl2br(escape_html($fields[$key]))
            . '</td>';
        $html .= '</tr>';
    }
    $html .= '</table></section>';
}

$html .= '<p style="margin-top: 24px; color: #56657a; font-size: 13px;">This report was submitted through the TutorHiveHub internal lesson reporting form.</p>';
$html .= '</div>';

$textLines = ['TutorHiveHub Daily Lesson Report', ''];
if ($isSafeguarding) {
    $textLines[] = 'URGENT: SAFEGUARDING OR WELFARE CONCERN REPORTED';
    $textLines[] = '';
}
foreach ($sections as $sectionTitle => $keys) {
    $textLines[] = strtoupper($sectionTitle);
    foreach ($keys as $key) {
        $textLines[] = $fieldLabels[$key] . ': ' . $fields[$key];
    }
    $textLines[] = '';
}
$text = implode("\n", $textLines);

$backupFields = [];
foreach ($fieldLabels as $key => $label) {
    $backupFields[$label] = $fields[$key];
}
$backupId = save_submission_backup('daily lesson report', $backupFields);

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
