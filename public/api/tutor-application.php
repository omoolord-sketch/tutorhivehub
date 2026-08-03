<?php
declare(strict_types=1);

require_once __DIR__ . '/_mailer.php';

require_post();

$keys = [
    'tutorName',
    'tutorEmail',
    'tutorPhone',
    'tutorCountry',
    'subjectsCanTeach',
    'highestQualification',
    'teachingExperience',
    'primaryTeachingDevice',
    'operatingSystem',
    'internetConnectionType',
    'averageInternetSpeed',
    'backupInternetAvailable',
    'webcamAvailable',
    'headsetWithMicrophoneAvailable',
    'quietTeachingEnvironment',
    'previousOnlineTeachingExperience',
    'onlineTeachingPlatforms',
    'timeZone',
    'availability',
    'tutorMessage',
];

$fields = collect_fields($keys);
$required = array_values(array_filter($keys, static fn (string $key): bool => $key !== 'onlineTeachingPlatforms'));
validate_required($fields, $required);

if (($fields['previousOnlineTeachingExperience'] ?? '') === 'Yes' && !isset($fields['onlineTeachingPlatforms'])) {
    send_json(422, ['ok' => false, 'message' => 'Please select at least one online teaching platform you have used.']);
}

$attachment = upload_attachment('cvUpload');

finish_submission('tutor application', [ADMIN_EMAIL, PUBLIC_INFO_EMAIL], $fields, $attachment);
