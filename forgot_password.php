<?php
session_start();
include 'db.php';

$message = "";
$message_type = "";

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    $account_type = trim($_POST["account_type"] ?? "");
    $email        = trim($_POST["email"] ?? "");
    $old_password = $_POST["old_password"] ?? "";
    $new_password = $_POST["new_password"] ?? "";

    // Basic validation
    if (empty($account_type) || empty($email) || empty($old_password) || empty($new_password)) {
        $message = "Please fill in all fields.";
        $message_type = "error";
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $message = "Please enter a valid email address.";
        $message_type = "error";
    } elseif (strlen($new_password) < 6) {
        $message = "New password must be at least 6 characters.";
        $message_type = "error";
    } else {

        // Select the correct table
        if ($account_type === "trainer") {
            $table = "trainers";
        } elseif ($account_type === "trainee") {
            $table = "trainees";
        } else {
            $table = "";
        }

        if ($table === "") {
            $message = "Invalid account type.";
            $message_type = "error";
        } else {

            // Find account by email
            $sql = "SELECT id, email, password FROM $table WHERE email = ? LIMIT 1";
            $stmt = mysqli_prepare($conn, $sql);

            if ($stmt) {

                mysqli_stmt_bind_param($stmt, "s", $email);
                mysqli_stmt_execute($stmt);

                $result = mysqli_stmt_get_result($stmt);

                if (mysqli_num_rows($result) === 1) {

                    $user = mysqli_fetch_assoc($result);

                    // Check old password
                    if (password_verify($old_password, $user["password"])) {

                        // Make sure new password is different
                        if (password_verify($new_password, $user["password"])) {

                            $message = "New password must be different from the old password.";
                            $message_type = "error";

                        } else {

                            // Hash new password
                            $hashed_password = password_hash(
                                $new_password,
                                PASSWORD_DEFAULT
                            );

                            // Update password
                            $update_sql = "UPDATE $table SET password = ? WHERE id = ?";
                            $update_stmt = mysqli_prepare($conn, $update_sql);

                            if ($update_stmt) {

                                mysqli_stmt_bind_param(
                                    $update_stmt,
                                    "si",
                                    $hashed_password,
                                    $user["id"]
                                );

                                if (mysqli_stmt_execute($update_stmt)) {

                                    $message = "Password changed successfully. You can now login.";
                                    $message_type = "success";

                                } else {

                                    $message = "Failed to update password.";
                                    $message_type = "error";
                                }

                                mysqli_stmt_close($update_stmt);

                            } else {

                                $message = "Database update error.";
                                $message_type = "error";
                            }
                        }

                    } else {

                        $message = "Old password is incorrect.";
                        $message_type = "error";
                    }

                } else {

                    $message = "No account was found with that email.";
                    $message_type = "error";
                }

                mysqli_stmt_close($stmt);

            } else {

                $message = "Database error.";
                $message_type = "error";
            }
        }
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Forgot Password</title>

    <style>

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #071a2f, #123c69, #087f8c);
            padding: 20px;
        }

        .container {
            width: 100%;
            max-width: 480px;
            padding: 35px;
            border-radius: 22px;
            background: rgba(255,255,255,0.12);
            border: 1px solid rgba(255,255,255,0.25);
            backdrop-filter: blur(15px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.3);
        }

        h1 {
            text-align: center;
            color: white;
            margin-bottom: 10px;
        }

        .subtitle {
            text-align: center;
            color: #d9f3ff;
            margin-bottom: 25px;
            font-size: 14px;
        }

        label {
            display: block;
            color: white;
            margin-bottom: 7px;
            font-weight: bold;
        }

        input,
        select {
            width: 100%;
            padding: 13px;
            margin-bottom: 18px;
            border: none;
            border-radius: 10px;
            outline: none;
            font-size: 15px;
        }

        input:focus,
        select:focus {
            box-shadow: 0 0 0 3px rgba(0, 220, 255, 0.3);
        }

        button {
            width: 100%;
            padding: 14px;
            border: none;
            border-radius: 10px;
            background: #00c6ff;
            color: white;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: 0.3s;
        }

        button:hover {
            background: #0099cc;
            transform: translateY(-2px);
        }

        .message {
            padding: 12px;
            margin-bottom: 20px;
            border-radius: 8px;
            text-align: center;
            font-weight: bold;
        }

        .success {
            background: rgba(0, 200, 100, 0.2);
            color: #b8ffd8;
            border: 1px solid #00d084;
        }

        .error {
            background: rgba(255, 50, 50, 0.2);
            color: #ffd0d0;
            border: 1px solid #ff5555;
        }

        .links {
            text-align: center;
            margin-top: 20px;
        }

        .links a {
            color: white;
            text-decoration: none;
            font-weight: bold;
        }

        .links a:hover {
            text-decoration: underline;
        }

        .password-box {
            position: relative;
        }

        .password-box input {
            padding-right: 45px;
        }

        .toggle {
            position: absolute;
            right: 12px;
            top: 11px;
            cursor: pointer;
            color: #555;
            font-size: 14px;
        }

    </style>
</head>

<body>

<div class="container">

    <h1>Change Password</h1>

    <p class="subtitle">
        Enter your account details to change your password
    </p>

    <?php if (!empty($message)): ?>

        <div class="message <?php echo $message_type; ?>">
            <?php echo htmlspecialchars($message); ?>
        </div>

    <?php endif; ?>

    <form method="POST" id="passwordForm">

        <label>Account Type</label>

        <select name="account_type" id="account_type" required>

            <option value="">Select account type</option>

            <option value="trainee"
                <?php echo (($_POST["account_type"] ?? "") === "trainee") ? "selected" : ""; ?>>
                Trainee
            </option>

            <option value="trainer"
                <?php echo (($_POST["account_type"] ?? "") === "trainer") ? "selected" : ""; ?>>
                Trainer
            </option>

        </select>


        <label>Email</label>

        <input
            type="email"
            name="email"
            placeholder="Enter your email"
            value="<?php echo htmlspecialchars($_POST["email"] ?? ""); ?>"
            required
        >


        <label>Old Password</label>

        <div class="password-box">

            <input
                type="password"
                name="old_password"
                id="old_password"
                placeholder="Enter old password"
                required
            >

            <span class="toggle" onclick="togglePassword('old_password', this)">
                Show
            </span>

        </div>


        <label>New Password</label>

        <div class="password-box">

            <input
                type="password"
                name="new_password"
                id="new_password"
                placeholder="Enter new password"
                required
            >

            <span class="toggle" onclick="togglePassword('new_password', this)">
                Show
            </span>

        </div>


        <button type="submit">
            Change Password
        </button>

    </form>


    <div class="links">
        <a href="trainer.php">Trainer Login</a>
        &nbsp; | &nbsp;
        <a href="trainee.php">Trainee Login</a>
    </div>

</div>


<script>

function togglePassword(id, element) {

    const input = document.getElementById(id);

    if (input.type === "password") {

        input.type = "text";
        element.textContent = "Hide";

    } else {

        input.type = "password";
        element.textContent = "Show";
    }
}


document.getElementById("passwordForm").addEventListener("submit", function(event) {

    const accountType = document.getElementById("account_type").value;
    const oldPassword = document.getElementById("old_password").value;
    const newPassword = document.getElementById("new_password").value;

    if (accountType === "") {

        alert("Please select Trainer or Trainee.");
        event.preventDefault();
        return;
    }

    if (newPassword.length < 6) {

        alert("New password must be at least 6 characters.");
        event.preventDefault();
        return;
    }

    if (oldPassword === newPassword) {

        alert("New password must be different from the old password.");
        event.preventDefault();
    }

});

</script>

</body>
</html>