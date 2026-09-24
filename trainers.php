<?php
session_start();
include 'db.php';

$message = "";
$message_type = "";

/*
|--------------------------------------------------------------------------
| LOGOUT
|--------------------------------------------------------------------------
*/
if (isset($_GET['logout'])) {
    session_unset();
    session_destroy();

    header("Location: trainer.php");
    exit;
}


/*
|--------------------------------------------------------------------------
| TRAINER REGISTRATION
|--------------------------------------------------------------------------
*/
if (isset($_POST['register'])) {

    $email = trim($_POST['email']);
    $phone = trim($_POST['phone']);
    $course = trim($_POST['course']);
    $password = $_POST['password'];
    $trainer_id = trim($_POST['trainer_id']);
    $trainer_name = trim($_POST['trainer_name']);

    if (
        empty($email) ||
        empty($phone) ||
        empty($course) ||
        empty($password) ||
        empty($trainer_id) ||
        empty($trainer_name)
    ) {

        $message = "Please fill in all registration fields.";
        $message_type = "error";

    } else {

        // Check whether trainer ID or email already exists
        $check = $conn->prepare(
            "SELECT id FROM trainers WHERE trainer_id = ? OR email = ?"
        );

        $check->bind_param("ss", $trainer_id, $email);
        $check->execute();
        $result = $check->get_result();

        if ($result->num_rows > 0) {

            $message = "Trainer ID or email already exists.";
            $message_type = "error";

        } else {

            // Secure password hashing
            $hashed_password = password_hash(
                $password,
                PASSWORD_DEFAULT
            );

            $stmt = $conn->prepare(
                "INSERT INTO trainers
                (trainer_id, trainer_name, email, phone, course, password)
                VALUES (?, ?, ?, ?, ?, ?)"
            );

            $stmt->bind_param(
                "ssssss",
                $trainer_id,
                $trainer_name,
                $email,
                $phone,
                $course,
                $hashed_password
            );

            if ($stmt->execute()) {

                $message = "Registration successful. You can now login.";
                $message_type = "success";

            } else {

                $message = "Registration failed.";
                $message_type = "error";
            }
        }
    }
}


/*
|--------------------------------------------------------------------------
| TRAINER LOGIN
|--------------------------------------------------------------------------
*/
if (isset($_POST['login'])) {

    $trainer_id = trim($_POST['login_trainer_id']);
    $email = trim($_POST['login_email']);
    $password = $_POST['login_password'];

    $stmt = $conn->prepare(
        "SELECT * FROM trainers
         WHERE trainer_id = ? AND email = ?"
    );

    $stmt->bind_param("ss", $trainer_id, $email);
    $stmt->execute();

    $result = $stmt->get_result();

    if ($result->num_rows === 1) {

        $trainer = $result->fetch_assoc();

        if (password_verify($password, $trainer['password'])) {

            /*
            |--------------------------------------------------------------------------
            | CREATE TRAINER SESSION
            |--------------------------------------------------------------------------
            */

            $_SESSION['trainer_logged_in'] = true;
            $_SESSION['trainer_id'] = $trainer['trainer_id'];
            $_SESSION['trainer_name'] = $trainer['trainer_name'];
            $_SESSION['trainer_email'] = $trainer['email'];
            $_SESSION['trainer_course'] = $trainer['course'];

            header("Location: trainer.php?attendance=1");
            exit;

        } else {

            $message = "Invalid login password.";
            $message_type = "error";
        }

    } else {

        $message = "Invalid trainer ID or email.";
        $message_type = "error";
    }
}


/*
|--------------------------------------------------------------------------
| FORGOT PASSWORD / CHANGE PASSWORD
|--------------------------------------------------------------------------
*/
if (isset($_POST['forgot_password'])) {

    $email = trim($_POST['forgot_email']);
    $old_password = $_POST['old_password'];
    $new_password = $_POST['new_password'];

    $stmt = $conn->prepare(
        "SELECT * FROM trainers WHERE email = ?"
    );

    $stmt->bind_param("s", $email);
    $stmt->execute();

    $result = $stmt->get_result();

    if ($result->num_rows === 1) {

        $trainer = $result->fetch_assoc();

        if (password_verify($old_password, $trainer['password'])) {

            $new_hashed_password = password_hash(
                $new_password,
                PASSWORD_DEFAULT
            );

            $update = $conn->prepare(
                "UPDATE trainers
                 SET password = ?
                 WHERE email = ?"
            );

            $update->bind_param(
                "ss",
                $new_hashed_password,
                $email
            );

            if ($update->execute()) {

                $message = "Password changed successfully.";
                $message_type = "success";

            } else {

                $message = "Unable to change password.";
                $message_type = "error";
            }

        } else {

            $message = "Old password is incorrect.";
            $message_type = "error";
        }

    } else {

        $message = "Email was not found.";
        $message_type = "error";
    }
}


/*
|--------------------------------------------------------------------------
| RECORD ATTENDANCE
|--------------------------------------------------------------------------
*/
if (isset($_POST['record_attendance'])) {

    /*
    |--------------------------------------------------------------------------
    | SECURITY CHECK
    |--------------------------------------------------------------------------
    */

    if (
        !isset($_SESSION['trainer_logged_in']) ||
        $_SESSION['trainer_logged_in'] !== true
    ) {

        die("Access denied. Only logged-in trainers can record attendance.");
    }

    $admission_number = trim($_POST['admission_number']);
    $status = trim($_POST['status']);

    // Automatically obtained from trainer session
    $trainer_id = $_SESSION['trainer_id'];
    $trainer_name = $_SESSION['trainer_name'];
    $course = $_SESSION['trainer_course'];

    // Automatically obtained from server
    $attendance_date = date("Y-m-d");
    $attendance_time = date("H:i:s");

    if (empty($admission_number) || empty($status)) {

        $message = "Enter admission number and select attendance status.";
        $message_type = "error";

    } else {

        $stmt = $conn->prepare(
            "INSERT INTO attendance
            (
                trainee_admission_number,
                trainer_id,
                trainer_name,
                course,
                status,
                attendance_date,
                attendance_time
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)"
        );

        $stmt->bind_param(
            "sssssss",
            $admission_number,
            $trainer_id,
            $trainer_name,
            $course,
            $status,
            $attendance_date,
            $attendance_time
        );

        if ($stmt->execute()) {

            $message = "Attendance recorded successfully.";
            $message_type = "success";

        } else {

            $message = "Failed to record attendance.";
            $message_type = "error";
        }
    }
}


/*
|--------------------------------------------------------------------------
| CHECK LOGIN
|--------------------------------------------------------------------------
*/
$is_logged_in =
    isset($_SESSION['trainer_logged_in']) &&
    $_SESSION['trainer_logged_in'] === true;

?>

<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width, initial-scale=1.0">

<title>Trainer Portal</title>

<style>

/* =========================================================
   GENERAL
========================================================= */

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: Arial, sans-serif;
    min-height: 100vh;
    background:
        linear-gradient(135deg, #071e3d, #1261a0, #0a9396);
    padding: 30px;
    color: #ffffff;
}

.container {
    width: 100%;
    max-width: 1200px;
    margin: auto;
}

h1 {
    text-align: center;
    margin-bottom: 10px;
}

.subtitle {
    text-align: center;
    margin-bottom: 30px;
    opacity: .9;
}


/* =========================================================
   MESSAGE
========================================================= */

.message {
    padding: 14px;
    border-radius: 10px;
    margin: 15px auto;
    max-width: 900px;
    text-align: center;
    font-weight: bold;
}

.success {
    background: rgba(0, 180, 100, .85);
}

.error {
    background: rgba(220, 40, 40, .85);
}


/* =========================================================
   MAIN GRID
========================================================= */

.portal {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 25px;
}


/* =========================================================
   CARD
========================================================= */

.card {
    background: rgba(255,255,255,.12);
    border: 1px solid rgba(255,255,255,.25);
    backdrop-filter: blur(15px);
    border-radius: 22px;
    padding: 25px;
    box-shadow: 0 20px 50px rgba(0,0,0,.25);
}

.card h2 {
    text-align: center;
    margin-bottom: 20px;
}


/* =========================================================
   INPUTS
========================================================= */

label {
    display: block;
    margin-top: 12px;
    margin-bottom: 6px;
    font-weight: bold;
}

input,
select {
    width: 100%;
    padding: 13px;
    border: none;
    outline: none;
    border-radius: 10px;
    background: rgba(255,255,255,.92);
    color: #111;
    font-size: 15px;
}


/* =========================================================
   BUTTONS
========================================================= */

button {
    width: 100%;
    padding: 13px;
    border: none;
    border-radius: 10px;
    margin-top: 18px;
    cursor: pointer;
    font-size: 16px;
    font-weight: bold;
    background: #00d4ff;
    color: #06233f;
    transition: .3s;
}

button:hover {
    transform: translateY(-2px);
    opacity: .9;
}

.login-button {
    background: #00ff9d;
}

.forgot-button {
    background: #ffc107;
}

.logout {
    display: block;
    text-align: center;
    background: #ff4757;
    color: white;
    padding: 13px;
    border-radius: 10px;
    text-decoration: none;
    margin-top: 20px;
}


/* =========================================================
   3D ATTENDANCE AREA
========================================================= */

.attendance-wrapper {
    grid-column: 1 / -1;
    perspective: 1200px;
}

.attendance-card {
    transition: transform .8s;
    transform-style: preserve-3d;
}

.attendance-card.flipped {
    transform: rotateY(180deg);
}

.attendance-front,
.attendance-back {
    backface-visibility: hidden;
}

.attendance-back {
    transform: rotateY(180deg);
}


/* =========================================================
   TRAINER INFO
========================================================= */

.trainer-info {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 20px;
}

.info-box {
    background: rgba(255,255,255,.12);
    border-radius: 12px;
    padding: 15px;
}

.info-box span {
    display: block;
    font-size: 12px;
    opacity: .8;
    margin-bottom: 5px;
}

.info-box strong {
    font-size: 15px;
}


/* =========================================================
   RESPONSIVE
========================================================= */

@media(max-width: 800px) {

    body {
        padding: 15px;
    }

    .portal {
        grid-template-columns: 1fr;
    }

    .trainer-info {
        grid-template-columns: 1fr;
    }
}

</style>

</head>


<body>

<div class="container">

    <h1>TRAINER PORTAL</h1>

    <p class="subtitle">
        Trainer Registration, Login and Attendance
    </p>


    <?php if (!empty($message)): ?>

        <div class="message <?= $message_type ?>">
            <?= htmlspecialchars($message) ?>
        </div>

    <?php endif; ?>


    <div class="portal">


        <!-- =================================================
             REGISTRATION
        ================================================== -->

        <div class="card">

            <h2>Trainer Registration</h2>

            <form method="POST">

                <label>Trainer ID</label>

                <input
                    type="text"
                    name="trainer_id"
                    placeholder="Enter trainer ID"
                    required
                >


                <label>Trainer Name</label>

                <input
                    type="text"
                    name="trainer_name"
                    placeholder="Enter trainer name"
                    required
                >


                <label>Email</label>

                <input
                    type="email"
                    name="email"
                    placeholder="Enter email"
                    required
                >


                <label>Phone</label>

                <input
                    type="text"
                    name="phone"
                    placeholder="Enter phone number"
                    required
                >


                <label>Course</label>

                <input
                    type="text"
                    name="course"
                    placeholder="Enter course"
                    required
                >


                <label>Password</label>

                <input
                    type="password"
                    name="password"
                    placeholder="Create password"
                    required
                >


                <button type="submit" name="register">
                    REGISTER
                </button>

            </form>

        </div>



        <!-- =================================================
             LOGIN
        ================================================== -->

        <div class="card">

            <h2>Trainer Login</h2>

            <form method="POST">

                <label>Trainer ID</label>

                <input
                    type="text"
                    name="login_trainer_id"
                    placeholder="Enter trainer ID"
                    required
                >


                <label>Email</label>

                <input
                    type="email"
                    name="login_email"
                    placeholder="Enter email"
                    required
                >


                <label>Password</label>

                <input
                    type="password"
                    name="login_password"
                    placeholder="Enter password"
                    required
                >


                <button
                    type="submit"
                    name="login"
                    class="login-button"
                    id="loginButton"
                >
                    LOGIN
                </button>

            </form>


            <!-- =================================================
                 FORGOT PASSWORD
            ================================================== -->

            <h2 style="margin-top:30px;">
                Forgot Password
            </h2>

            <form method="POST">

                <label>Email</label>

                <input
                    type="email"
                    name="forgot_email"
                    placeholder="Enter your email"
                    required
                >


                <label>Old Password</label>

                <input
                    type="password"
                    name="old_password"
                    placeholder="Enter old password"
                    required
                >


                <label>New Password</label>

                <input
                    type="password"
                    name="new_password"
                    placeholder="Enter new password"
                    required
                >


                <button
                    type="submit"
                    name="forgot_password"
                    class="forgot-button"
                >
                    CHANGE PASSWORD
                </button>

            </form>

        </div>



        <?php if ($is_logged_in): ?>

        <!-- =================================================
             RECORD ATTENDANCE
        ================================================== -->

        <div class="attendance-wrapper">

            <div class="card attendance-card">

                <div class="attendance-front">

                    <h2>Trainer Attendance Area</h2>

                    <div class="trainer-info">

                        <div class="info-box">

                            <span>Trainer ID</span>

                            <strong>
                                <?= htmlspecialchars($_SESSION['trainer_id']) ?>
                            </strong>

                        </div>


                        <div class="info-box">

                            <span>Trainer Name</span>

                            <strong>
                                <?= htmlspecialchars($_SESSION['trainer_name']) ?>
                            </strong>

                        </div>


                        <div class="info-box">

                            <span>Course</span>

                            <strong>
                                <?= htmlspecialchars($_SESSION['trainer_course']) ?>
                            </strong>

                        </div>

                    </div>


                    <form method="POST">

                        <label>
                            Trainee Admission Number
                        </label>

                        <input
                            type="text"
                            name="admission_number"
                            placeholder="Enter trainee admission number"
                            required
                        >


                        <label>
                            Attendance Status
                        </label>

                        <select name="status" required>

                            <option value="">
                                Select status
                            </option>

                            <option value="Present">
                                Present
                            </option>

                            <option value="Absent">
                                Absent
                            </option>

                            <option value="Late">
                                Late
                            </option>

                        </select>


                        <!-- DATE AND TIME ARE AUTOMATIC -->

                        <label>
                            Date
                        </label>

                        <input
                            type="text"
                            value="<?= date('Y-m-d') ?>"
                            readonly
                        >


                        <label>
                            Time
                        </label>

                        <input
                            type="text"
                            id="liveTime"
                            value="<?= date('H:i:s') ?>"
                            readonly
                        >


                        <button
                            type="submit"
                            name="record_attendance"
                        >
                            RECORD ATTENDANCE
                        </button>

                    </form>


                    <a
                        href="trainer.php?logout=1"
                        class="logout"
                    >
                        LOGOUT
                    </a>

                </div>

            </div>

        </div>

        <?php endif; ?>

    </div>

</div>



<script>

/*
|--------------------------------------------------------------------------
| LIVE TIME
|--------------------------------------------------------------------------
*/

function updateTime() {

    const timeBox = document.getElementById("liveTime");

    if (!timeBox) {
        return;
    }

    const now = new Date();

    const hours = String(
        now.getHours()
    ).padStart(2, "0");

    const minutes = String(
        now.getMinutes()
    ).padStart(2, "0");

    const seconds = String(
        now.getSeconds()
    ).padStart(2, "0");

    timeBox.value =
        hours + ":" +
        minutes + ":" +
        seconds;
}

setInterval(updateTime, 1000);

updateTime();


/*
|--------------------------------------------------------------------------
| LOGIN BUTTON
|--------------------------------------------------------------------------
| The PHP login itself performs the security check.
| After successful login, trainer.php reloads with attendance=1.
|--------------------------------------------------------------------------
*/

const loginButton =
    document.getElementById("loginButton");

if (loginButton) {

    loginButton.addEventListener(
        "click",
        function() {

            this.style.transform =
                "rotateY(360deg)";

        }
    );
}


/*
|--------------------------------------------------------------------------
| ATTENDANCE FLIP EFFECT
|--------------------------------------------------------------------------
*/

const urlParams =
    new URLSearchParams(
        window.location.search
    );

if (urlParams.get("attendance") === "1") {

    const attendanceCard =
        document.querySelector(
            ".attendance-card"
        );

    if (attendanceCard) {

        setTimeout(function() {

            attendanceCard.classList.add(
                "flipped"
            );

            setTimeout(function() {

                attendanceCard.classList.remove(
                    "flipped"
                );

            }, 1000);

        }, 300);

    }
}

</script>

</body>
</html>