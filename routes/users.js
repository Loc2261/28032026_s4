var express = require("express");
var router = express.Router();
let userModel = require("../schemas/users");
let { CreateAnUserValidator, validatedResult, ModifyAnUser } = require('../utils/validateHandler')
let userController = require('../controllers/users')
let { CheckLogin, CheckRole } = require('../utils/authHandler')
const { uploadExcel } = require('../utils/uploadHandler')
const exceljs = require('exceljs')
const path = require('path')
const crypto = require('crypto')
const { sendUserCredentials } = require('../utils/mailHandler')
const roleModel = require('../schemas/roles')

router.get("/", CheckLogin, CheckRole("ADMIN"), async function (req, res, next) {
  let users = await userController.GetAllUser()
  res.send(users);
});

router.get("/:id", CheckLogin, CheckRole("ADMIN", "MODERATOR"), async function (req, res, next) {
  try {
    let result = await userModel
      .find({ _id: req.params.id, isDeleted: false })
    if (result.length > 0) {
      res.send(result);
    }
    else {
      res.status(404).send({ message: "id not found" });
    }
  } catch (error) {
    res.status(404).send({ message: "id not found" });
  }
});

router.post("/", CreateAnUserValidator, validatedResult, async function (req, res, next) {
  try {
    let newItem = await userController.CreateAnUser(
      req.body.username, req.body.password, req.body.email, req.body.role,
      req.body.fullName, req.body.avatarUrl, req.body.status, req.body.loginCount
    )
    let saved = await userModel
      .findById(newItem._id)
    res.send(saved);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put("/:id", ModifyAnUser, validatedResult, async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(id, req.body, { new: true });

    if (!updatedItem) return res.status(404).send({ message: "id not found" });

    let populated = await userModel
      .findById(updatedItem._id)
    res.send(populated);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );
    if (!updatedItem) {
      return res.status(404).send({ message: "id not found" });
    }
    res.send(updatedItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

// Import users from Excel file (user.xlsx)
// username and email are read from the file
// role: 'user', password: auto-gen 16 chars, send email to user
router.post("/import", uploadExcel.single('file'), async function (req, res, next) {
  if (!req.file) {
    return res.status(400).send({ message: "File is required" });
  }

  const workbook = new exceljs.Workbook();
  const pathFile = path.join(__dirname, '../uploads', req.file.filename);

  try {
    await workbook.xlsx.readFile(pathFile);
    const worksheet = workbook.getWorksheet(1);
    const results = [];
    const errors = [];

    // Find the 'user' role
    const userRole = await roleModel.findOne({ name: 'user' });
    if (!userRole) {
      return res.status(500).send({ message: "Role 'user' not found in database" });
    }

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const username = row.getCell(1).value;
      let emailCell = row.getCell(2).value;

      // Handle formula cells from exceljs
      let email = (typeof emailCell === 'object' && emailCell !== null) ? emailCell.result : emailCell;

      if (!username || !email) continue;

      // Generate random 16 character password
      const password = crypto.randomBytes(8).toString('hex');

      try {
        const newUser = new userModel({
          username,
          email,
          password,
          role: userRole._id,
          status: true
        });

        await newUser.save();

        // Send email with credentials
        await sendUserCredentials(email, username, password);

        results.push({ username, email, password, status: 'success' });
      } catch (err) {
        errors.push({ username, email, error: err.message });
      }
    }

    res.send({
      message: "Import completed",
      successCount: results.length,
      failureCount: errors.length,
      results,
      errors
    });

  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

module.exports = router;