<?php
declare(strict_types=1);

const PUBLIC_INFO_EMAIL = 'info@tutorhivehub.com';
const ADMIN_EMAIL = 'admin@tutorhivehub.com';
const MAIL_FROM_EMAIL = 'info@tutorhivehub.com';
const MAIL_FROM_NAME = 'TutorHiveHub Website';
const MAX_ATTACHMENT_BYTES = 10485760;

$smtpConfigPath = __DIR__ . '/smtp-config.php';
if (file_exists($smtpConfigPath)) {
    require_once $smtpConfigPath;
}

function submissions_dir(): string
{
    return __DIR__ . '/submissions';
}

function send_json(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload);
    exit;
}

function require_post(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        send_json(405, ['ok' => false, 'message' => 'Method not allowed.']);
    }
}

function field_value(string $key): string
{
    return implode(', ', field_values($key));
}

function field_values(string $key): array
{
    $value = $_POST[$key] ?? '';
    $values = is_array($value) ? $value : [$value];
    $cleaned = [];

    foreach ($values as $item) {
        $item = trim((string)$item);
        if ($item !== '') {
            $cleaned[] = $item;
        }
    }

    return $cleaned;
}

function collect_fields(array $keys): array
{
    $fields = [];
    foreach ($keys as $key) {
        $value = field_value($key);
        if ($value !== '') {
            $fields[$key] = $value;
        }
    }
    return $fields;
}

function validate_required(array $fields, array $required): void
{
    $missing = [];
    foreach ($required as $key) {
        if (!isset($fields[$key]) || trim((string)$fields[$key]) === '') {
            $missing[] = $key;
        }
    }

    if (count($missing) > 0) {
        send_json(422, ['ok' => false, 'message' => 'Please complete all required fields.']);
    }
}

function escape_html(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function format_label(string $key): string
{
    $label = preg_replace('/([A-Z])/', ' $1', $key);
    return ucwords(trim((string)$label));
}

function build_html_table(array $fields, string $formName): string
{
    $rows = '';
    foreach ($fields as $key => $value) {
        $rows .= '<tr>';
        $rows .= '<th style="border: 1px solid #e2e8f0; padding: 10px; text-align: left; background: #f8fafc; width: 220px;">' . escape_html(format_label($key)) . '</th>';
        $rows .= '<td style="border: 1px solid #e2e8f0; padding: 10px;">' . nl2br(escape_html((string)$value)) . '</td>';
        $rows .= '</tr>';
    }

    return '<div style="font-family: Arial, sans-serif; color: #102033;">'
        . '<h2 style="color: #061C3D;">TutorHiveHub ' . escape_html($formName) . ' Submission</h2>'
        . '<table style="border-collapse: collapse; width: 100%;">' . $rows . '</table>'
        . '</div>';
}

function build_text_body(array $fields, string $formName): string
{
    $lines = ['TutorHiveHub ' . $formName . ' Submission', ''];
    foreach ($fields as $key => $value) {
        $lines[] = format_label($key) . ': ' . (string)$value;
    }
    return implode("\n", $lines);
}

function upload_attachment(string $fieldName): ?array
{
    if (!isset($_FILES[$fieldName]) || !is_array($_FILES[$fieldName])) {
        return null;
    }

    $file = $_FILES[$fieldName];
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        send_json(422, ['ok' => false, 'message' => 'The uploaded CV could not be processed.']);
    }

    if ((int)$file['size'] > MAX_ATTACHMENT_BYTES) {
        send_json(422, ['ok' => false, 'message' => 'The uploaded CV is too large. Please keep it under 10MB.']);
    }

    $originalName = (string)($file['name'] ?? 'cv-upload');
    $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    if (!in_array($extension, ['pdf', 'doc', 'docx'], true)) {
        send_json(422, ['ok' => false, 'message' => 'Please upload a PDF, DOC, or DOCX CV.']);
    }

    $tmpName = (string)($file['tmp_name'] ?? '');
    if ($tmpName === '' || !is_uploaded_file($tmpName)) {
        send_json(422, ['ok' => false, 'message' => 'The uploaded CV could not be verified.']);
    }

    return [
        'name' => basename($originalName),
        'type' => (string)($file['type'] ?? 'application/octet-stream'),
        'content' => file_get_contents($tmpName),
    ];
}

function recipient_header($recipient): string
{
    if (is_array($recipient)) {
        return implode(', ', array_filter(array_map('strval', $recipient)));
    }

    return (string)$recipient;
}

function safe_filename(string $value): string
{
    $filename = preg_replace('/[^A-Za-z0-9._-]+/', '-', $value);
    $filename = trim((string)$filename, '.-');
    return $filename !== '' ? $filename : 'upload';
}

function ensure_submissions_dir(): void
{
    $dir = submissions_dir();
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }

    $denyFile = $dir . '/.htaccess';
    if (!file_exists($denyFile)) {
        file_put_contents($denyFile, "Require all denied\n");
    }
}

function save_submission_backup(string $formName, array $fields, ?array $attachment = null): string
{
    ensure_submissions_dir();

    $id = gmdate('Ymd-His') . '-' . bin2hex(random_bytes(4));
    $dir = submissions_dir() . '/' . $id;
    mkdir($dir, 0755, true);

    $attachmentName = null;
    if ($attachment !== null) {
        $attachmentName = safe_filename((string)$attachment['name']);
        file_put_contents($dir . '/' . $attachmentName, (string)$attachment['content']);
    }

    $payload = [
        'id' => $id,
        'createdAt' => gmdate('c'),
        'formName' => $formName,
        'fields' => $fields,
        'attachment' => $attachmentName,
    ];

    file_put_contents(
        $dir . '/submission.json',
        json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
    );

    return $id;
}

function recipient_list($recipient): array
{
    if (is_array($recipient)) {
        return array_values(array_filter(array_map('strval', $recipient)));
    }

    return [(string)$recipient];
}

function smtp_configured(): bool
{
    return defined('SMTP_HOST')
        && defined('SMTP_PORT')
        && defined('SMTP_USERNAME')
        && defined('SMTP_PASSWORD')
        && defined('SMTP_FROM_EMAIL')
        && SMTP_PASSWORD !== ''
        && SMTP_PASSWORD !== 'REPLACE_WITH_INFO_EMAIL_PASSWORD';
}

function build_custom_email_message(
    string $subject,
    $recipient,
    string $replyTo,
    string $textBody,
    string $htmlBody,
    ?array $attachment = null
): string
{
    $to = recipient_header($recipient);
    $fromEmail = defined('SMTP_FROM_EMAIL') ? SMTP_FROM_EMAIL : MAIL_FROM_EMAIL;
    $fromName = defined('SMTP_FROM_NAME') ? SMTP_FROM_NAME : MAIL_FROM_NAME;
    $from = $fromName . ' <' . $fromEmail . '>';
    $boundary = 'thh-' . bin2hex(random_bytes(12));

    if ($attachment === null) {
        $altBoundary = $boundary . '-alt';
        return implode("\r\n", [
            'From: ' . $from,
            'To: ' . $to,
            'Reply-To: ' . $replyTo,
            'Subject: ' . $subject,
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $altBoundary . '"',
            '',
            "--{$altBoundary}",
            'Content-Type: text/plain; charset=UTF-8',
            '',
            $textBody,
            '',
            "--{$altBoundary}",
            'Content-Type: text/html; charset=UTF-8',
            '',
            $htmlBody,
            '',
            "--{$altBoundary}--",
            '',
        ]);
    }

    $headers = implode("\r\n", [
        'From: ' . $from,
        'To: ' . $to,
        'Reply-To: ' . $replyTo,
        'Subject: ' . $subject,
        'MIME-Version: 1.0',
        'Content-Type: multipart/mixed; boundary="' . $boundary . '"',
    ]);

    $message = $headers . "\r\n\r\n";
    $message .= "--{$boundary}\r\n";
    $message .= "Content-Type: multipart/alternative; boundary=\"{$boundary}-alt\"\r\n\r\n";
    $message .= "--{$boundary}-alt\r\n";
    $message .= "Content-Type: text/plain; charset=UTF-8\r\n\r\n";
    $message .= $textBody . "\r\n\r\n";
    $message .= "--{$boundary}-alt\r\n";
    $message .= "Content-Type: text/html; charset=UTF-8\r\n\r\n";
    $message .= $htmlBody . "\r\n\r\n";
    $message .= "--{$boundary}-alt--\r\n";
    $message .= "--{$boundary}\r\n";
    $message .= "Content-Type: " . $attachment['type'] . "; name=\"" . addslashes($attachment['name']) . "\"\r\n";
    $message .= "Content-Transfer-Encoding: base64\r\n";
    $message .= "Content-Disposition: attachment; filename=\"" . addslashes($attachment['name']) . "\"\r\n\r\n";
    $message .= chunk_split(base64_encode((string)$attachment['content'])) . "\r\n";
    $message .= "--{$boundary}--";

    return $message;
}

function build_email_message(string $formName, $recipient, array $fields, ?array $attachment = null): string
{
    $replyTo = $fields['parentEmail'] ?? $fields['tutorEmail'] ?? PUBLIC_INFO_EMAIL;
    $subject = 'TutorHiveHub ' . $formName . ' submission';
    $htmlBody = build_html_table($fields, $formName);
    $textBody = build_text_body($fields, $formName);

    return build_custom_email_message($subject, $recipient, $replyTo, $textBody, $htmlBody, $attachment);
}

function smtp_read($socket): string
{
    $data = '';
    while (($line = fgets($socket, 515)) !== false) {
        $data .= $line;
        if (strlen($line) >= 4 && $line[3] === ' ') {
            break;
        }
    }
    return $data;
}

function smtp_expect($socket, array $codes): void
{
    $response = smtp_read($socket);
    $code = (int)substr($response, 0, 3);
    if (!in_array($code, $codes, true)) {
        throw new RuntimeException('SMTP error: ' . trim($response));
    }
}

function smtp_command($socket, string $command, array $codes): void
{
    fwrite($socket, $command . "\r\n");
    smtp_expect($socket, $codes);
}

function smtp_send_message($recipient, string $message): bool
{
    if (!smtp_configured()) {
        return false;
    }

    $host = SMTP_HOST;
    $port = (int)SMTP_PORT;
    $scheme = defined('SMTP_SECURE') && SMTP_SECURE === 'ssl' ? 'ssl://' : '';
    $socket = @fsockopen($scheme . $host, $port, $errno, $errstr, 20);
    if (!$socket) {
        error_log('TutorHiveHub SMTP connection failed: ' . $errstr);
        return false;
    }

    stream_set_timeout($socket, 20);

    try {
        smtp_expect($socket, [220]);
        smtp_command($socket, 'EHLO tutorhivehub.com', [250]);
        smtp_command($socket, 'AUTH LOGIN', [334]);
        smtp_command($socket, base64_encode(SMTP_USERNAME), [334]);
        smtp_command($socket, base64_encode(SMTP_PASSWORD), [235]);
        smtp_command($socket, 'MAIL FROM:<' . SMTP_FROM_EMAIL . '>', [250]);
        foreach (recipient_list($recipient) as $address) {
            smtp_command($socket, 'RCPT TO:<' . $address . '>', [250, 251]);
        }
        smtp_command($socket, 'DATA', [354]);
        $message = preg_replace('/^\./m', '..', $message);
        fwrite($socket, $message . "\r\n.\r\n");
        smtp_expect($socket, [250]);
        smtp_command($socket, 'QUIT', [221]);
        fclose($socket);
        return true;
    } catch (Throwable $error) {
        error_log('TutorHiveHub SMTP send failed: ' . $error->getMessage());
        fclose($socket);
        return false;
    }
}

function send_submission_email(string $formName, $recipient, array $fields, ?array $attachment = null): bool
{
    $message = build_email_message($formName, $recipient, $fields, $attachment);
    return smtp_send_message($recipient, $message);
}

function finish_submission(string $formName, $recipient, array $fields, ?array $attachment = null): void
{
    $backupId = save_submission_backup($formName, $fields, $attachment);
    $sent = send_submission_email($formName, $recipient, $fields, $attachment);
    if (!$sent) {
        send_json(500, [
            'ok' => false,
            'message' => 'TutorHiveHub saved this submission, but email delivery failed. Please contact us directly.',
            'reference' => $backupId,
        ]);
    }

    send_json(200, ['ok' => true, 'reference' => $backupId]);
}
