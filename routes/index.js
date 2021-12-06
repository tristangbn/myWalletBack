var express = require("express");
var router = express.Router();
const userModel = require("../models/users");
const transactionModel = require("../models/transactions");
const bcrypt = require("bcrypt");
const uid2 = require("uid2");
const saltRounds = 10;

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", { title: "Express" });
});

router.post("/sign-up", async function (req, res) {
  const { firstName, lastName, email, password } = req.body;

  bcrypt.hash(password, saltRounds, async function (err, hash) {
    const newUser = new userModel({
      firstName: firstName,
      lastName: lastName,
      email: email,
      password: hash,
      inscriptionDate: new Date(),
      token: uid2(32),
    });

    await newUser.save();

    res.json({ result: true, message: "User added to DB" });
  });
});

module.exports = router;
