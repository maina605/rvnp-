<?php
session_start();
include 'db.php';

$message = "";
$message_type = "";

/*
|--------------------------------------------------------------------------
| CHECK TRAINEE LOGIN
|--------------------------------------------------------------------------
*/
if (!isset($_SESSION['trainee_id'])) {
    header("Location: login.php");
    exit();
}

$trainee_id = (int)$_SESSION['trainee_id'];

/*
|--------------------------------------------------------------------------
| CSRF TOKEN (generate on GET, verify on POST)
|--------------------------------------------------------------------------
*/
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
$csrf_token = $_SESSION['csrf_token'];

/*
|--------------------------------------------------------------------------
| GET TRAINEE DETAILS
|--------------------------------------------------------------------------
*/
$sql = "SELECT id, full_name, admission_number, course
        FROM trainees
        WHERE id = ?";

$stmt = $conn->prepare($sql);
if (!$stmt) {
    die("Database prepare error (trainee select): " . $conn->error);
}

$stmt->bind_param("i", $trainee_id);
$stmt->execute();
$result = $stmt->get_result();
$trainee = $result->fetch_assoc();
$stmt->close();

if (!$trainee) {
    die("Trainee details not found.");
}

/*
|--------------------------------------------------------------------------
| RECORD ATTENDANCE (POST)
|--------------------------------------------------------------------------
*/
if ($_SERVER["REQUEST_METHOD"] === "POST") {

    // Security: CSRF check
    $posted_csrf = $_POST['csrf_token'] ?? '';
    if (!hash_equals($csrf_token, $posted_csrf)) {
        http_response_code(403);
        die("Invalid CSRF token.");
    }

    // Security: status validation
    $unit_name = trim($_POST['unit_name'] ?? '');
    $status    = trim($_POST['status'] ?? '');

    if ($unit_name === "" || $status === "") {
        $message = "Please select the unit and attendance status.";
        $message_type = "error";
    } elseif ($status !== "Present" && $status !== "Absent") {
        $message = "Invalid attendance status.";
        $message_type = "error";
    } elseif (mb_strlen($unit_name) > 100) {
        $message = "Unit name is too long.";
        $message_type = "error";
    } else {

        date_default_timezone_set("Africa/Nairobi");
        $attendance_date = date("Y-m-d");
        $attendance_time = date("H:i:s");

        $insert = "INSERT INTO attendance
            (trainee_id, trainee_name, admission_number, course, unit_name, status, attendance_date, attendance_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

        $stmt = $conn->prepare($insert);
        if (!$stmt) {
            die("Database prepare error (attendance insert): " . $conn->error);
        }

        // Trainer_id/trainee_id are INT, others are strings
        $trainee_name = $trainee['full_name'];
        $admission_number = $trainee['admission_number'];
        $course = $trainee['course'];

        $stmt->bind_param(
            "isssssss",
            $trainee['id'],            // i
            $trainee_name,            // s
            $admission_number,       // s
            $course,                 // s
            $unit_name,              // s
            $status,                 // s
            $attendance_date,        // s (works for DATE column too, but schema matters)
            $attendance_time         // s (works for TIME/DATETIME formatting too, schema matters)
        );

        if ($stmt->execute()) {
            // PRG pattern: redirect to avoid double insert on refresh
            $_SESSION['flash_message'] = "Attendance recorded successfully.";
            $_SESSION['flash_type'] = "success";
            $stmt->close();
            header("Location: " . $_SERVER['PHP_SELF']);
            exit();
        } else {
            $message = "Failed to record attendance.";
            $message_type = "error";
        }

        // Optional: log error
        // error_log("Attendance insert error: " . $stmt->error);

        $stmt->close();
    }
}

/*
|--------------------------------------------------------------------------
| DISPLAY FLASH MESSAGE AFTER REDIRECT
|--------------------------------------------------------------------------
*/
if (!empty($_SESSION['flash_message'])) {
    $message = $_SESSION['flash_message'];
    $message_type = $_SESSION['flash_type'] ?? "success";
    unset($_SESSION['flash_message'], $_SESSION['flash_type']);
}
?>

<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Record Attendance - Rift Valley National Polytechnic</title>

    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }
        body {
            min-height: 100vh;
            background: linear-gradient(135deg, #071e26, #064e5c, #0b8793);
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 30px;
        }
        .container {
            width: 100%;
            max-width: 750px;
            background: rgba(255,255,255,0.12);
            border: 1px solid rgba(255,255,255,0.25);
            backdrop-filter: blur(18px);
            border-radius: 25px;
            padding: 35px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.35);
            color: white;
        }
        .school-name { text-align: center; font-size: 27px; font-weight: bold; margin-bottom: 8px; }
        .page-title { text-align: center; font-size: 18px; opacity: 0.85; margin-bottom: 30px; }
        .trainee-info {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-bottom: 25px;
        }
        .info-box {
            background: rgba(255,255,255,0.12);
            padding: 15px;
            border-radius: 14px;
            border: 1px solid rgba(255,255,255,0.15);
        }
        .info-box span { display: block; font-size: 13px; opacity: 0.7; margin-bottom: 6px; }
        .info-box strong { font-size: 16px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; font-weight: bold; }
        input, select {
            width: 100%;
            padding: 14px;
            border: none;
            outline: none;
            border-radius: 12px;
            background: rgba(255,255,255,0.92);
            color: #123;
            font-size: 15px;
        }
        input:focus, select:focus { box-shadow: 0 0 0 3px rgba(0,220,255,0.3); }
        button {
            width: 100%;
            padding: 15px;
            border: none;
            border-radius: 13px;
            background: #00c6d7;
            color: white;
            font-size: 17px;
            font-weight: bold;
            cursor: pointer;
            transition: 0.3s;
        }
        button:hover { background: #00a7b6; transform: translateY(-2px); }
        .message {
            padding: 14px;
            border-radius: 12px;
            margin-bottom: 20px;
            text-align: center;
            font-weight: bold;
        }
        .success { background: rgba(0,200,100,0.2); border: 1px solid rgba(0,255,150,0.4); }
        .error { background: rgba(255,0,0,0.2); border: 1px solid rgba(255,100,100,0.4); }
        .back { display: block; text-align: center; margin-top: 20px; color: white; text-decoration: none; opacity: 0.8; }
        .back:hover { opacity: 1; }
        @media(max-width:600px) {
            .container { padding: 25px 20px; }
            .trainee-info { grid-template-columns: 1fr; }
            .school-name { font-size: 22px; }
        }
    </style>
</head>

<body>
<div class="container">

    <div class="school-name">Rift Valley National Polytechnic</div>
    <div class="page-title">Attendance Recording</div>

    <?php if (!empty($message)): ?>
        <div class="message <?php echo htmlspecialchars($message_type); ?>">
            <?php echo htmlspecialchars($message); ?>
        </div>
    <?php endif; ?>

    <div class="trainee-info">
        <div class="info-box">
            <span>Trainee ID</span>
            <strong><?php echo htmlspecialchars($trainee['id']); ?></strong>
        </div>
        <div class="info-box">
            <span>Trainee Name</span>
            <strong><?php echo htmlspecialchars($trainee['full_name']); ?></strong>
        </div>
        <div class="info-box">
            <span>Admission Number</span>
            <strong><?php echo htmlspecialchars($trainee['admission_number']); ?></strong>
        </div>
        <div class="info-box">
            <span>Course</span>
            <strong><?php echo htmlspecialchars($trainee['course']); ?></strong>
        </div>
    </div>

    <form method="POST" action="">
        <!-- CSRF token -->
        <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf_token); ?>">

        <div class="form-group">
            <label for="unit_name">Unit Name</label>
            <input
                type="text"
                id="unit_name"
                name="unit_name"
                placeholder="Enter unit name"
                required
                maxlength="100"
            >
        </div>

        <div class="form-group">
            <label for="status">Attendance Status</label>
            <select id="status" name="status" required>
                <option value="">Select attendance status</option>
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
            </select>
        </div>

        <button type="submit">Record Attendance</button>
    </form>

    <a href="trainee.php" class="back">Back to Trainee Dashboard</a>
</div>
</body>
</html>
