<?php
session_start();
include 'db.php';

/*
|--------------------------------------------------------------------------
| CHECK TRAINEE LOGIN
|--------------------------------------------------------------------------
*/

if (
    !isset($_SESSION['trainee_id']) ||
    !isset($_SESSION['admission_number']) ||
    !isset($_SESSION['course'])
) {
    die("Please login as a trainee first.");
}

/*
|--------------------------------------------------------------------------
| GET TRAINEE INFORMATION
|--------------------------------------------------------------------------
*/

$trainee_id = $_SESSION['trainee_id'];
$admission_number = $_SESSION['admission_number'];
$course = $_SESSION['course'];

/*
|--------------------------------------------------------------------------
| QR DATA
|--------------------------------------------------------------------------
| These values are NOT displayed as normal text.
| They are stored inside the QR code.
|--------------------------------------------------------------------------
*/

$qr_data = json_encode([
    "trainee_id" => $trainee_id,
    "admission_number" => $admission_number,
    "course" => $course
]);

?>

<!DOCTYPE html>
<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta name="viewport"
          content="width=device-width, initial-scale=1.0">

    <title>Trainee QR Code</title>

    <!-- QR CODE JAVASCRIPT LIBRARY -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>

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

            background:
                linear-gradient(
                    135deg,
                    #071e3d,
                    #1261a0,
                    #0a9396
                );

            padding: 20px;
        }

        .qr-card {
            width: 100%;
            max-width: 420px;

            padding: 35px;

            text-align: center;

            background: rgba(255,255,255,0.12);

            border: 1px solid rgba(255,255,255,0.3);

            border-radius: 25px;

            backdrop-filter: blur(15px);

            box-shadow:
                0 20px 50px rgba(0,0,0,0.3);
        }

        h1 {
            color: white;
            margin-bottom: 10px;
        }

        .description {
            color: white;
            opacity: .85;
            margin-bottom: 25px;
        }

        #qrcode {
            width: 230px;
            height: 230px;

            margin: auto;

            padding: 15px;

            background: white;

            border-radius: 15px;

            display: flex;
            justify-content: center;
            align-items: center;
        }

        #qrcode img {
            width: 200px;
            height: 200px;
        }

        .status {
            color: #00ffae;
            margin-top: 20px;
            font-weight: bold;
        }

        button {
            width: 100%;
            margin-top: 20px;

            padding: 13px;

            border: none;
            border-radius: 10px;

            background: #00d4ff;
            color: #06233f;

            font-size: 16px;
            font-weight: bold;

            cursor: pointer;

            transition: .3s;
        }

        button:hover {
            transform: translateY(-2px);
        }

        .back {
            display: block;

            margin-top: 12px;

            padding: 13px;

            border-radius: 10px;

            background: rgba(255,255,255,.15);

            color: white;

            text-decoration: none;
        }

    </style>

</head>


<body>

<div class="qr-card">

    <h1>Trainee QR Code</h1>

    <p class="description">
        Scan this QR code for attendance identification.
    </p>


    <!--
        QR CODE IS GENERATED HERE.
        Admission number and course are NOT displayed.
    -->

    <div id="qrcode"></div>


    <div class="status">
        QR CODE READY
    </div>


    <button
        type="button"
        onclick="downloadQR()"
    >
        DOWNLOAD QR CODE
    </button>


    <a
        href="trainee.php"
        class="back"
    >
        BACK TO TRAINEE PORTAL
    </a>

</div>


<script>

/*
|--------------------------------------------------------------------------
| TRAINEE QR DATA
|--------------------------------------------------------------------------
| PHP passes the hidden trainee information to JavaScript.
|--------------------------------------------------------------------------
*/

const qrData = <?= json_encode($qr_data) ?>;


/*
|--------------------------------------------------------------------------
| CREATE QR CODE
|--------------------------------------------------------------------------
*/

const qrContainer =
    document.getElementById("qrcode");

const qrCode =
    new QRCode(qrContainer, {

        text: qrData,

        width: 200,

        height: 200,

        correctLevel:
            QRCode.CorrectLevel.H

    });


/*
|--------------------------------------------------------------------------
| DOWNLOAD QR CODE
|--------------------------------------------------------------------------
*/

function downloadQR() {

    const qrImage =
        document.querySelector("#qrcode img");

    if (!qrImage) {

        alert("QR code is not ready yet.");

        return;
    }

    const link =
        document.createElement("a");

    link.href =
        qrImage.src;

    link.download =
        "trainee-qr-code.png";

    link.click();
}

</script>

</body>

</html>