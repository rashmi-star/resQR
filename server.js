const express = require("express");
const path = require("path");
const app = express();
const bodyParser = require("body-parser");
const QRCode = require("qrcode");
const nodemailer = require("nodemailer");
const axios = require("axios");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

const viewsDir = path.join(__dirname, "views");
// const firebase = require("firebase");
app.use(express.static(viewsDir));

app.use(express.static(path.join(__dirname, "./public")));
app.use(express.static(path.join(__dirname, "./images")));

const PORT = 4000;

const mysql = require("mysql");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "new_password",
  port: 3306,
  database: "resQR",
});

// // Connecting MYSQL
db.connect((err) => {
  if (err) {
    throw err;
  }
  console.log("MSQL CONNECTED ");
});

app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*"); // Replace with the actual origin
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.send();
});

app.listen(PORT, () => console.log(`server is running on ${PORT}`));

let accidentLatitude = null;

let accidentLongitude = null;
// Set up the Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "resqrorganization@gmail.com",
    pass: "lcdo oqrh achi awbp",
  },
});

app.get("/", (req, res) => {
  res.sendFile(path.join(viewsDir, "resQR_registration.html"));
});

app.get("/getUserDetailsFromDatabase", (req, res) => {
  let resQRTextValue = req.query.key;
  try {
    const query = `
    SELECT Owner.*, Dependent.*
    FROM Owner
    LEFT JOIN Dependent ON Owner.owner_id = Dependent.owner_id
    WHERE Owner.resQRText = ?
  `;

    db.query(query, [resQRTextValue], (error, results, fields) => {
      if (error) {
        console.error("Error performing query:", error);
      } else {
        // Initialize an object to store owners and their dependents
        const ownersWithDependents = {};

        // Process the results
        results.forEach((result) => {
          // Extract owner and dependent data from the result
          const ownerData = {
            owner_id: result.owner_id,
            ownerVIN: result.ownerVIN,
            ownerFullName: result.ownerFullName,
            ownerEmailId: result.ownerEmailId,
            ownerPhoneNumber: result.ownerPhoneNumber,
            ownerDateOfBirth: result.ownerDateOfBirth,
            ownerBloodGroup: result.ownerBloodGroup,
            ownerGender: result.ownerGender,
            resQRText: result.resQRText,
            // Add other owner-related fields
          };

          const dependentData = {
            dependent_id: result.dependent_id,
            dependentType: result.dependentType,
            dependentFullName: result.dependentFullName,
            dependentEmailId: result.dependentEmailId,
            dependentPhoneNumber: result.dependentPhoneNumber,
            dependentDateOfBirth: result.dependentDateOfBirth,
            dependentBloodGroup: result.dependentBloodGroup,
            dependentGender: result.dependentGender,
            // Add other dependent-related fields
          };

          // If the owner is not already in the ownersWithDependents object, add them
          if (!ownersWithDependents[ownerData.owner_id]) {
            ownersWithDependents[ownerData.owner_id] = ownerData;
            ownersWithDependents[ownerData.owner_id].dependents = [];
          }

          // Add the dependent to the owner's dependents array
          ownersWithDependents[ownerData.owner_id].dependents.push(
            dependentData
          );
        });

        // Convert the object into an array
        const resultArray = Object.values(ownersWithDependents);

        res.json(resultArray);
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/generate_qr", (req, res) => {
  try {
    postDataToDatabase(req.body.resQR_user);

    const data = req.body.resQR_user.resQRText;
    if (!data) {
      return res
        .status(400)
        .json({ error: "Invalid data in the request body." });
    }

    // Construct the URL using the received data
    const url = `http://localhost:4000/emergency?key=${data}`;

    QRCode.toFile(path.join(__dirname, "qrcode.png"), url, (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      const qrCodePath = path.join(__dirname, "qrcode.png");
      res.sendFile(qrCodePath);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function postDataToDatabase(resQR_user) {
  // let encryptedText = encrypt(resQR_user.resQRText);
  const sql = "INSERT INTO Owner SET ?";

  const ownerData = {
    ownerVIN: resQR_user.ownerVIN,
    ownerFullName: resQR_user.ownerFullName,
    ownerEmailId: resQR_user.ownerEmailId,
    ownerPhoneNumber: resQR_user.ownerPhoneNumber,
    ownerDateOfBirth: resQR_user.ownerDateOfBirth,
    ownerBloodGroup: resQR_user.ownerBloodGroup,
    ownerGender: resQR_user.ownerGender,
    resQRText: resQR_user.resQRText,
  };

  db.query(sql, ownerData, (err, ownerResults) => {
    if (err) {
      throw err;
    }

    console.log("Owner data inserted successfully!");

    // Get the owner_id of the inserted owner for the foreign key in Dependent table
    const owner_id = ownerResults.insertId;

    /// Insert dependent data
    const dependentData = resQR_user.dependents.map((dependent) => [
      owner_id,
      dependent.dependentType,
      dependent.dependentFullName,
      dependent.dependentEmailId,
      dependent.dependentPhoneNumber,
      dependent.dependentDateOfBirth,
      dependent.dependentBloodGroup,
      dependent.dependentGender,
    ]);

    const sqlDependent =
      "INSERT INTO Dependent (owner_id, dependentType, dependentFullName, dependentEmailId, dependentPhoneNumber, dependentDateOfBirth, dependentBloodGroup, dependentGender) VALUES ?";
    db.query(sqlDependent, [dependentData], (errDependent, depResults) => {
      if (errDependent) {
        console.error("Error inserting dependent data:", errDependent);
        // return res.status(500).json({ error: "Internal Server Error" });
      }

      console.log("Dependent data inserted successfully!");

      // return res.status(200).json({ success: true });
      // Close the MySQL connection
      // db.end();
    });
  });
}

// Your API endpoint for Google Places API
app.get("/hospitals", async (req, res) => {
  const { location, radius, key } = req.query;

  const [lat, lng] = location.split(",");

  // Convert the string values to numbers if needed
  accidentLatitude = parseFloat(lat);
  accidentLongitude = parseFloat(lng);

  const apiUrlHospitals = ``;
  // get Hospitals list
  try {
    const response = await axios.get(apiUrlHospitals);
    const hospitals = response.data.results;
    // Send the hospitals data in the response
    res.json({ hospitals });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/policeStations", async (req, res) => {
  const { location, radius, key } = req.query;
  // get Police Stations list
  const apiUrlPolice = ``;
  try {
    const response = await axios.get(apiUrlPolice);
    const policeStations = response.data.results;
    // Send the  Police Stations data in the response
    res.json({ policeStations });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/getLocationName", async (req, res) => {
  const { location, key } = req.query;
  console.log(accidentLatitude, accidentLongitude);
  const apiUrlLocationName = ``;

  axios
    .get(apiUrlLocationName)
    .then((response) => {
      const data = response.data;
      console.log(data);
      // Check if the API returned any results
      if (data.results.length > 0) {
        const placeName = data.results[0].formatted_address;
        console.log("Place Name:", placeName);
      } else {
        console.log("No results found for the given coordinates.");
      }
    })
    .catch((error) => {
      console.error("Error:", error.message);
    });
});

// Define a route to handle the POST request
app.post("/send_email", (req, res) => {
  const emailBody = `
  Dear ResQR user,
  
  We regret to inform you that a user, has met with an accident at the following location: Latitude: ${accidentLatitude} Longitude: ${accidentLongitude}.
    
  Your prompt attention to this matter is crucial. If you have any questions or require additional information, please contact us immediately.
  
  Thank you for your cooperation.
  
  Sincerely,
  resQR
  `;
  const emailIds = req.body.emailIdsList; // Assuming req.body has an 'emailIds' array

  const mailOptions = {
    from: "resqrorganization@gmail.com",
    to: emailIds.join(", "),
    subject: "'Emergency: resQR User Accident Notification',",
    text: emailBody,
  };

  // Send the email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(error);
      res.status(500).send("Internal Server Error");
    } else {
      console.log("Email sent: " + info.response);
      res.status(200).send("Email sent successfully");
    }
  });
});

// Page to handle the redirection
app.get("/emergency", (req, res) => {
  const key = req.query.key;
  // Perform any actions with the key, for example, log it
  res.sendFile(path.join(viewsDir, "emergency_form.html"), (err) => {
    if (err) {
      console.error(err);
      res.status(500).send("Internal Server Error");
    }
  });
});
