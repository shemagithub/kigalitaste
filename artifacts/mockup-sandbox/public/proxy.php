<?php
/**
 * Same-origin API proxy for phones and networks where backend SSL is missing.
 *
 * The browser only talks to this site (HTTP or HTTPS). This script talks to
 * the Node app over HTTP first, then HTTPS with certificate checks off.
 */
header_remove("X-Powered-By");

$method = strtoupper($_SERVER["REQUEST_METHOD"] ?? "GET");
$uri = $_SERVER["REQUEST_URI"] ?? "/";
$path = parse_url($uri, PHP_URL_PATH) ?: "/";

$allowed =
    preg_match("#^/(api|uploads)(/|$)#", $path) ||
    in_array($path, ["/robots.txt", "/sitemap.xml"], true);

if (!$allowed) {
    http_response_code(404);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode(["error" => "Not found"]);
    exit;
}

if ($method === "OPTIONS") {
    $origin = $_SERVER["HTTP_ORIGIN"] ?? "*";
    header("Access-Control-Allow-Origin: " . $origin);
    header("Access-Control-Allow-Credentials: true");
    header("Access-Control-Allow-Methods: GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Authorization, Content-Type, Accept, X-Requested-With");
    header("Access-Control-Max-Age: 86400");
    http_response_code(204);
    exit;
}

$targets = [];
$envHttp = getenv("KT_BACKEND_HTTP") ?: "";
$envHttps = getenv("KT_BACKEND_HTTPS") ?: "";
if ($envHttp !== "") {
    $targets[] = rtrim($envHttp, "/");
}
$targets[] = "http://backend.kigalitaste.co";
if ($envHttps !== "") {
    $targets[] = rtrim($envHttps, "/");
}
$targets[] = "https://backend.kigalitaste.co";
$targets = array_values(array_unique($targets));

function kt_request_headers()
{
    if (function_exists("getallheaders")) {
        $headers = getallheaders();
        if (is_array($headers) && $headers) {
            return $headers;
        }
    }
    $headers = [];
    foreach ($_SERVER as $key => $value) {
        if (strpos($key, "HTTP_") === 0) {
            $name = str_replace(" ", "-", ucwords(strtolower(str_replace("_", " ", substr($key, 5)))));
            $headers[$name] = $value;
        }
    }
    if (!empty($_SERVER["CONTENT_TYPE"])) {
        $headers["Content-Type"] = $_SERVER["CONTENT_TYPE"];
    }
    return $headers;
}

function kt_skip_request_header($name)
{
    $name = strtolower($name);
    return in_array(
        $name,
        [
            "host",
            "connection",
            "content-length",
            "accept-encoding",
            "transfer-encoding",
            "keep-alive",
            "proxy-connection",
            "expect",
        ],
        true,
    );
}

function kt_skip_response_header($name)
{
    $name = strtolower($name);
    return in_array(
        $name,
        [
            "connection",
            "keep-alive",
            "proxy-authenticate",
            "proxy-authorization",
            "te",
            "trailer",
            "transfer-encoding",
            "upgrade",
        ],
        true,
    );
}

function kt_build_body($method, &$headers)
{
    if (in_array($method, ["GET", "HEAD"], true)) {
        return null;
    }

    $contentType = "";
    foreach ($headers as $name => $value) {
        if (strtolower($name) === "content-type") {
            $contentType = $value;
            break;
        }
    }

    if (stripos($contentType, "multipart/form-data") !== false) {
        foreach (array_keys($headers) as $name) {
            if (strtolower($name) === "content-type") {
                unset($headers[$name]);
            }
        }
        $post = $_POST;
        foreach ($_FILES as $field => $file) {
            if (is_array($file["name"])) {
                foreach ($file["name"] as $i => $name) {
                    $tmp = $file["tmp_name"][$i] ?? "";
                    if ($tmp && is_uploaded_file($tmp)) {
                        $post[$field . "[" . $i . "]"] = new CURLFile(
                            $tmp,
                            $file["type"][$i] ?? "application/octet-stream",
                            $name,
                        );
                    }
                }
            } elseif (!empty($file["tmp_name"]) && is_uploaded_file($file["tmp_name"])) {
                $post[$field] = new CURLFile(
                    $file["tmp_name"],
                    $file["type"] ?? "application/octet-stream",
                    $file["name"] ?? "file",
                );
            }
        }
        return $post;
    }

    return file_get_contents("php://input");
}

function kt_proxy($target, $method, $uri, $headers, $body)
{
    $ch = curl_init(rtrim($target, "/") . $uri);
    if ($ch === false) {
        return [0, "", "Could not start request"];
    }

    $headerLines = [];
    foreach ($headers as $name => $value) {
        if (kt_skip_request_header($name)) {
            continue;
        }
        $headerLines[] = $name . ": " . $value;
    }

    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3,
        CURLOPT_CONNECTTIMEOUT => 6,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_HTTPHEADER => $headerLines,
        CURLOPT_ENCODING => "",
        CURLOPT_POSTREDIR => 7,
    ]);

    if ($body !== null && $body !== false) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }

    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);

    if ($raw === false) {
        return [0, "", $err ?: "Network error"];
    }

    $headerBlob = substr($raw, 0, $headerSize);
    $responseBody = substr($raw, $headerSize);
    return [$status, $headerBlob, $responseBody];
}

$headers = kt_request_headers();
$body = kt_build_body($method, $headers);

$lastError = "Cannot reach API";
$result = null;
foreach ($targets as $target) {
    [$status, $headerBlob, $responseBody] = kt_proxy($target, $method, $uri, $headers, $body);
    if ($status === 0 || $status === 502 || $status === 503 || $status === 504) {
        $lastError = is_string($responseBody) && $responseBody !== "" ? $responseBody : $lastError;
        continue;
    }
    $result = [$status, $headerBlob, $responseBody];
    break;
}

if ($result === null) {
    http_response_code(503);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode(["error" => "Cannot reach API. " . $lastError]);
    exit;
}

[$status, $headerBlob, $responseBody] = $result;
http_response_code($status > 0 ? $status : 502);

$blocks = preg_split("/\r\n\r\n|\n\n/", trim($headerBlob));
$lastHeaders = $blocks ? $blocks[count($blocks) - 1] : "";
foreach (preg_split("/\r\n|\n/", $lastHeaders) as $line) {
    if ($line === "" || stripos($line, "HTTP/") === 0) {
        continue;
    }
    $parts = explode(":", $line, 2);
    if (count($parts) !== 2) {
        continue;
    }
    $name = trim($parts[0]);
    $value = trim($parts[1]);
    if ($name === "" || kt_skip_response_header($name)) {
        continue;
    }
    header($name . ": " . $value, false);
}

echo $responseBody;
