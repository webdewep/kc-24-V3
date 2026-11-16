<?php
// PHP hosting only: configure KS24_SITE_ORIGIN and KS24_MAIL_FROM in server env.
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function respond(int $code, string $message): void {
    http_response_code($code);
    echo json_encode(['ok' => $code === 200, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST'); respond(405, 'Метод не поддерживается');
}
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 8192) respond(413, 'Слишком большой запрос');
$type = strtolower(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]);
if (!in_array($type, ['multipart/form-data', 'application/x-www-form-urlencoded'], true)) respond(415, 'Неверный формат запроса');
// Do not derive email headers or the allowed origin from client-controlled Host.
$origin = rtrim((string)getenv('KS24_SITE_ORIGIN'), '/');
$from = (string)getenv('KS24_MAIL_FROM');
if (!filter_var($origin, FILTER_VALIDATE_URL) || parse_url($origin, PHP_URL_SCHEME) !== 'https' || !filter_var($from, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $from)) respond(503, 'Отправка пока не настроена. Позвоните нам.');
if (rtrim($_SERVER['HTTP_ORIGIN'] ?? '', '/') !== $origin || ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') respond(403, 'Запрос отклонён');
foreach (['name', 'phone', 'consent', 'company'] as $key) {
    if (isset($_POST[$key]) && !is_string($_POST[$key])) respond(422, 'Неверный формат поля');
}
if (trim($_POST['company'] ?? '') !== '') respond(422, 'Запрос отклонён');
$name = preg_replace('/ +/', ' ', trim($_POST['name'] ?? ''));
$phone = trim($_POST['phone'] ?? '');
if ($name === null || !preg_match("/^[\p{L}\p{M}][\p{L}\p{M} .’'\-]{1,119}$/u", $name) || strlen($phone) > 32 || preg_match('/[^0-9+() \-]/', $phone) || ($_POST['consent'] ?? '') !== '1') respond(422, 'Проверьте имя, телефон и согласие');
$digits = preg_replace('/\D/', '', $phone);
if (strlen($digits) === 10) $digits = '7'.$digits;
if (strlen($digits) === 11 && $digits[0] === '8') $digits = '7'.substr($digits, 1);
if (!preg_match('/^7[3489][0-9]{9}$/D', $digits)) respond(422, 'Укажите полный российский номер');
// Atomic per-IP limit: 5 attempts per 15 minutes. No names or phones in rate files.
$ip = $_SERVER['REMOTE_ADDR'] ?? '';
if (!filter_var($ip, FILTER_VALIDATE_IP)) respond(403, 'Запрос отклонён');
$directory = sys_get_temp_dir().'/ks24-form-rate';
if (!is_dir($directory) && !@mkdir($directory, 0700) && !is_dir($directory)) respond(503, 'Попробуйте позже');
$file = @fopen($directory.'/'.hash('sha256', $ip).'.json', 'c+');
if (!$file || !flock($file, LOCK_EX)) respond(503, 'Попробуйте позже');
$now = time();
$times = json_decode(stream_get_contents($file, 4096), true);
$times = is_array($times) ? array_values(array_filter($times, static fn($t) => is_int($t) && $t > $now - 900)) : [];
if (count($times) >= 5 || ($times && $now - end($times) < 30)) {
    flock($file, LOCK_UN); fclose($file);
    header('Retry-After: 900'); respond(429, 'Слишком много запросов. Попробуйте позже');
}
$times[] = $now;
rewind($file);
if (!ftruncate($file, 0) || fwrite($file, json_encode($times)) === false || !fflush($file)) {
    flock($file, LOCK_UN); fclose($file); respond(503, 'Попробуйте позже');
}
flock($file, LOCK_UN); fclose($file);
$message = 'Имя: '.$name."\nТелефон: +".$digits;
$headers = "From: ".$from."\r\nContent-Type: text/plain; charset=UTF-8\r\n";
if (!@mail('OOO-cleaning-service@ya.ru', '=?UTF-8?B?'.base64_encode('Заявка с сайта Клининг Сервис 24').'?=', $message, $headers)) respond(503, 'Не удалось отправить заявку. Позвоните нам.');
respond(200, 'Заявка отправлена');
