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
    header("Location: trainee.php");
    exit();
}

/*
|--------------------------------------------------------------------------
| REGISTRATION
|--------------------------------------------------------------------------
*/
if (isset($_POST['register'])) {

    $full_name = trim($_POST['full_name']);
    $email = trim($_POST['email']);
    $phone = trim($_POST['phone']);
    $admission_number = trim($_POST['admission_number']);
    $course = trim($_POST['course']);
    $password = $_POST['password'];

    if (
        empty($full_name) ||
        empty($email) ||
        empty($phone) ||
        empty($admission_number) ||
        empty($course) ||
        empty($password)
    ) {
        $message = "Please fill in all registration fields.";
        $message_type = "error";
    } else {

        // Check whether email already exists
        $check = $conn->prepare(
            "SELECT id FROM trainees WHERE email = ? OR admission_number = ?"
        );
        $check->bind_param("ss", $email, $admission_number);
        $check->execute();
        $result = $check->get_result();

        if ($result->num_rows > 0) {

            $message = "Email or admission number already exists.";
            $message_type = "error";

        } else {

            // Hash password
            $hashed_password = password_hash($password, PASSWORD_DEFAULT);

            $stmt = $conn->prepare(
                "INSERT INTO trainees
                (full_name, email, phone, admission_number, course, password)
                VALUES (?, ?, ?, ?, ?, ?)"
            );

            $stmt->bind_param(
                "ssssss",
                $full_name,
                $email,
                $phone,
                $admission_number,
                $course,
                $hashed_password
            );

            if ($stmt->execute()) {

                $message = "Registration successful. Please login.";
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
| LOGIN
|--------------------------------------------------------------------------
*/
if (isset($_POST['login'])) {

    $email = trim($_POST['login_email']);
    $password = $_POST['login_password'];

    $stmt = $conn->prepare(
        "SELECT id, full_name, email, phone, admission_number, course, password
         FROM trainees
         WHERE email = ?"
    );

    $stmt->bind_param("s", $email);
    $stmt->execute();

    $result = $stmt->get_result();

    if ($result->num_rows === 1) {

        $trainee = $result->fetch_assoc();

        if (password_verify($password, $trainee['password'])) {

            $_SESSION['trainee_id'] = $trainee['id'];
            $_SESSION['trainee_name'] = $trainee['full_name'];
            $_SESSION['trainee_email'] = $trainee['email'];
            $_SESSION['trainee_admission'] = $trainee['admission_number'];
            $_SESSION['trainee_course'] = $trainee['course'];

            header("Location: trainee.php");
            exit();

        } else {

            $message = "Invalid email or password.";
            $message_type = "error";
        }

    } else {

        $message = "Invalid email or password.";
        $message_type = "error";
    }
}


/*
|--------------------------------------------------------------------------
| DASHBOARD DATA
|--------------------------------------------------------------------------
*/
$attendance_percentage = 0;
$total_attendance = 0;
$present_count = 0;

if (isset($_SESSION['trainee_id'])) {

    $trainee_id = $_SESSION['trainee_id'];

    $stmt = $conn->prepare(
        "SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present
         FROM attendance
         WHERE trainee_id = ?"
    );

    $stmt->bind_param("i", $trainee_id);
    $stmt->execute();

    $result = $stmt->get_result();
    $attendance = $result->fetch_assoc();

    $total_attendance = (int)$attendance['total'];
    $present_count = (int)$attendance['present'];

    if ($total_attendance > 0) {
        $attendance_percentage =
            round(($present_count / $total_attendance) * 100, 1);
    }
}

?>

<!DOCTYPE html>
<html lang="en">
<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Trainee Portal</title>

<style>

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: Arial, sans-serif;
    min-height: 100vh;
    background: linear-gradient(135deg, #071e3d, #1261a0, #159957);
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px;
}

/* MAIN CONTAINER */

.container {
    width: 100%;
    max-width: 1000px;
}

/* HEADER */

.header {
    text-align: center;
    color: white;
    margin-bottom: 20px;
}

.header h1 {
    font-size: 30px;
}

.header p {
    margin-top: 7px;
}

/* FLIP AREA */

.flip-container {
    width: 100%;
    max-width: 500px;
    min-height: 620px;
    margin: auto;
    perspective: 1200px;
}

.flip-card {
    width: 100%;
    min-height: 620px;
    position: relative;
    transform-style: preserve-3d;
    transition: transform 0.8s ease;
}

.flip-card.flipped {
    transform: rotateY(180deg);
}

.card-side {
    position: absolute;
    width: 100%;
    min-height: 620px;
    backface-visibility: hidden;
    border-radius: 25px;
    padding: 35px;
    background: rgba(255,255,255,0.14);
    border: 1px solid rgba(255,255,255,0.3);
    backdrop-filter: blur(18px);
    box-shadow: 0 20px 50px rgba(0,0,0,0.3);
}

.login-side {
    transform: rotateY(180deg);
}

/* FORM */

h2 {
    color: white;
    text-align: center;
    margin-bottom: 25px;
}

label {
    color: white;
    display: block;
    margin-top: 13px;
    margin-bottom: 6px;
    font-weight: bold;
}

input {
    width: 100%;
    padding: 13px;
    border-radius: 10px;
    border: none;
    outline: none;
    font-size: 15px;
}

select {
    width: 100%;
    padding: 13px;
    border-radius: 10px;
    border: none;
    outline: none;
}

button {
    width: 100%;
    padding: 14px;
    margin-top: 20px;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-size: 16px;
    font-weight: bold;
    background: #00e676;
    color: #062b20;
    transition: 0.3s;
}

button:hover {
    transform: translateY(-2px);
    opacity: 0.9;
}

.secondary {
    background: white;
    color: #1261a0;
}

.forgot {
    display: block;
    text-align: center;
    margin-top: 18px;
    color: white;
    text-decoration: none;
}

.forgot:hover {
    text-decoration: underline;
}

.switch {
    text-align: center;
    color: white;
    margin-top: 20px;
}

.switch span {
    color: #00e676;
    font-weight: bold;
    cursor: pointer;
}

/* MESSAGE */

.message {
    max-width: 500px;
    margin: 0 auto 20px;
    padding: 13px;
    border-radius: 10px;
    text-align: center;
    color: white;
}

.success {
    background: rgba(0, 200, 83, 0.8);
}

.error {
    background: rgba(220, 20, 60, 0.8);
}

/* DASHBOARD */

.dashboard {
    max-width: 900px;
    margin: auto;
    background: rgba(255,255,255,0.14);
    backdrop-filter: blur(18px);
    border: 1px solid rgba(255,255,255,0.3);
    padding: 35px;
    border-radius: 25px;
    color: white;
    box-shadow: 0 20px 50px rgba(0,0,0,0.3);
}

.dashboard h2 {
    margin-bottom: 10px;
}

.welcome {
    text-align: center;
    margin-bottom: 30px;
}

.info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
}

.info-box {
    background: rgba(255,255,255,0.12);
    padding: 18px;
    border-radius: 15px;
}

.info-box strong {
    display: block;
    margin-bottom: 7px;
}

.percentage {
    margin-top: 25px;
    text-align: center;
    background: rgba(0,0,0,0.2);
    padding: 25px;
    border-radius: 20px;
}

.percentage-number {
    font-size: 48px;
    font-weight: bold;
    color: #00e676;
}

.progress {
    width: 100%;
    height: 15px;
    background: rgba(255,255,255,0.25);
    border-radius: 20px;
    overflow: hidden;
    margin-top: 15px;
}

.progress-bar {
    height: 100%;
    background: #00e676;
    width: <?php echo $attendance_percentage; ?>%;
}

.dashboard-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
    margin-top: 25px;
}

.logout {
    background: #ff5252;
    color: white;
}

/* MOBILE */

@media(max-width:600px) {

    .card-side {
        padding: 25px;
    }

    .info-grid {
        grid-template-columns: 1fr;
    }

    .dashboard-buttons {
        grid-template-columns: 1fr;
    }

    .header h1 {
        font-size: 23px;
    }
}

</style>

</head>

<body>

<div class="container">

<div class="header">
    <h1>Rift Valley National Polytechnic</h1>
    <p>Trainee Attendance Portal</p>
</div>


<?php if (!isset($_SESSION['trainee_id'])): ?>

    <?php if ($message != ""): ?>

        <div class="message <?php echo $message_type; ?>">
            <?php echo htmlspecialchars($message); ?>
        </div>

    <?php endif; ?>


    <div class="flip-container">

        <div class="flip-card" id="flipCard">


            <!-- REGISTRATION SIDE -->

            <div class="card-side register-side">

                <h2>Trainee Registration</h2>

                <form method="POST" onsubmit="return validateRegistration()">

                    <label>Full Name</label>
                    <input
                        type="text"
                        name="full_name"
                        id="full_name"
                        required
                    >

                    <label>Email</label>
                    <input
                        type="email"
                        name="email"
                        id="email"
                        required
                    >

                    <label>Phone</label>
                    <input
                        type="text"
                        name="phone"
                        id="phone"
                        required
                    >

                    <label>Admission Number</label>
                    <input
                        type="text"
                        name="admission_number"
                        required
                    >

                    <label>Course</label>
                    <input
                        type="text"
                        name="course"
                        required
                    >

                    <label>Password</label>
                    <input
                        type="password"
                        name="password"
                        id="password"
                        required
                    >

                    <button type="submit" name="register">
                        Register
                    </button>

                </form>

                <div class="switch">
                    Already registered?
                    <span onclick="showLogin()">Login</span>
                </div>

            </div>


            <!-- LOGIN SIDE -->

            <div class="card-side login-side">

                <h2>Trainee Login</h2>

                <form method="POST" onsubmit="return validateLogin()">

                    <label>Email</label>

                    <input
                        type="email"
                        name="login_email"
                        id="login_email"
                        required
                    >

                    <label>Password</label>

                    <input
                        type="password"
                        name="login_password"
                        id="login_password"
                        required
                    >

                    <button type="submit" name="login">
                        Login
                    </button>

                </form>

                <a href="forgot_password.php" class="forgot">
                    Forgot Password?
                </a>

                <div class="switch">
                    Don't have an account?
                    <span onclick="showRegister()">Register</span>
                </div>

            </div>

        </div>

    </div>


<?php else: ?>


    <!-- TRAINEE DASHBOARD -->

    <div class="dashboard">

        <div class="welcome">

            <h2>
                Welcome,
                <?php echo htmlspecialchars($_SESSION['trainee_name']); ?>
            </h2>

            <p>
                Your trainee dashboard
            </p>

        </div>


        <div class="info-grid">

            <div class="info-box">
                <strong>Admission Number</strong>
                <?php echo htmlspecialchars($_SESSION['trainee_admission']); ?>
            </div>

            <div class="info-box">
                <strong>Course</strong>
                <?php echo htmlspecialchars($_SESSION['trainee_course']); ?>
            </div>

            <div class="info-box">
                <strong>Email</strong>
                <?php echo htmlspecialchars($_SESSION['trainee_email']); ?>
            </div>

            <div class="info-box">
                <strong>Total Attendance Records</strong>
                <?php echo $total_attendance; ?>
            </div>

        </div>


        <!-- ATTENDANCE PERCENTAGE -->

        <div class="percentage">

            <h3>Attendance Percentage</h3>

            <div class="percentage-number">
                <?php echo $attendance_percentage; ?>%
            </div>

            <p>
                <?php echo $present_count; ?>
                present out of
                <?php echo $total_attendance; ?>
                attendance records
            </p>

            <div class="progress">

                <div
                    class="progress-bar"
                    style="width: <?php echo $attendance_percentage; ?>%;"
                ></div>

            </div>

        </div>


        <!-- BUTTONS -->

        <div class="dashboard-buttons">

            <a href="view_attendance.php">
                <button type="button">
                    View My Attendance
                </button>
            </a>

            <a href="forgot_password.php">
                <button type="button" class="secondary">
                    Change Password
                </button>
            </a>

            <a href="trainee.php?logout=1">
                <button type="button" class="logout">
                    Logout
                </button>
            </a>

        </div>

    </div>


<?php endif; ?>

</div>


<script>

/*
|--------------------------------------------------------------------------
| FLIP TO LOGIN
|--------------------------------------------------------------------------
*/

function showLogin() {

    document.getElementById("flipCard")
        .classList.add("flipped");

}


/*
|--------------------------------------------------------------------------
| FLIP TO REGISTRATION
|--------------------------------------------------------------------------
*/

function showRegister() {

    document.getElementById("flipCard")
        .classList.remove("flipped");

}


/*
|--------------------------------------------------------------------------
| REGISTRATION VALIDATION
|--------------------------------------------------------------------------
*/

function validateRegistration() {

    let password =
        document.getElementById("password").value;

    if (password.length < 6) {

        alert("Password must contain at least 6 characters.");

        return false;
    }

    return true;
}


/*
|--------------------------------------------------------------------------
| LOGIN VALIDATION
|--------------------------------------------------------------------------
*/

function validateLogin() {

    let email =
        document.getElementById("login_email").value;

    let password =
        document.getElementById("login_password").value;

    if (email === "" || password === "") {

        alert("Please enter your email and password.");

        return false;
    }

    return true;
}

</script>

</body>
</html>