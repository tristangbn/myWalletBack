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

// Inscription d'un utilisateur
router.post("/sign-up", async function (req, res) {
  const { firstName, lastName, email, password } = req.body;

  // Hash du mot de passe en DB et ajout de l'utilisateur
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

// Connexion d'un utilisateur
router.post("/sign-in", async function (req, res) {
  const { email, password } = req.body;

  // Récupération des informations de l'utilisateur en DB
  const user = await userModel.findOne({ email: email.toLowerCase() });

  // Comparaison du mot de passe entré par l'utilisateur avec celui enregistré en DB
  bcrypt.compare(password, user.password, function (err, result) {
    if (result) res.json({ result: true, message: "User connected" });
    else res.json({ result: false, message: "Wrong credentials" });
  });
});

module.exports = router;
