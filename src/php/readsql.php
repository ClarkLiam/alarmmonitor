<?php

require_once 'config.php';

function get_fahrzeuge($pdo) {
    $stmt = $pdo->query('SELECT * FROM fahrzeuge');

    $fahrzeuge = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $fahrzeuge[] = [
            'id' => $row['id'],
            'typ' => $row['typ'],
            'stellplatz' => $row['stellplatz'],
        ];
    }

    return $fahrzeuge;
}

function get_status($pdo) {
    $stmt = $pdo->query('SELECT * FROM status');

    $status = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $status[] = [
            'id' => $row['id'],
            'rufname' => $row['rufname'],
            'status' => $row['status'],
        ];
    }

    return $status;
}

$dsn = "sqlite:$db";

try {
    $pdo = new \PDO($dsn);

    $fahrzeuge = get_fahrzeuge($pdo);
    var_dump($fahrzeuge);

    $status = get_status($pdo);
    var_dump($status);
} catch (PDOException $e) {
    echo "Verbindungsfehler: " . $e->getMessage();
}