<?php
declare(strict_types=1);

require_once __DIR__ . '/_mailer.php';

require_post();

$keys = [
    'parentName',
    'parentEmail',
    'parentPhone',
    'parentCountry',
    'studentName',
    'studentAge',
    'schoolYear',
    'subjectNeeded',
    'preferredSupportType',
    'startDate',
    'totalIntendedHours',
    'academicGoal',
];

$fields = collect_fields($keys);
validate_required($fields, $keys);

$subjectChoices = field_values('subjectNeeded');
if (count($subjectChoices) < 1 || count($subjectChoices) > 4) {
    send_json(422, ['ok' => false, 'message' => 'Please select between 1 and 4 subjects or areas of help.']);
}

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fields['startDate'])) {
    send_json(422, ['ok' => false, 'message' => 'Please enter a valid start date.']);
}

$totalIntendedHours = filter_var($fields['totalIntendedHours'], FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1, 'max_range' => 1000],
]);
if ($totalIntendedHours === false) {
    send_json(422, ['ok' => false, 'message' => 'Please enter the total intended hours per child.']);
}

finish_submission('parent enquiry', PUBLIC_INFO_EMAIL, $fields);
