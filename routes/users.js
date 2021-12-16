var express = require("express");
var router = express.Router();
const userModel = require("../models/users");
const bcrypt = require("bcrypt");
const uid2 = require("uid2");
const saltRounds = 10;
const { body, validationResult, check } = require("express-validator");

// Inscription d'un utilisateur
router.post(
  "/sign-up",
  body("firstName")
    .not()
    .isEmpty()
    .trim()
    .escape()
    .withMessage("Please enter your first name"),
  body("lastName")
    .not()
    .isEmpty()
    .trim()
    .escape()
    .withMessage("Please enter your last name"),
  body("email").custom(async (email) => {
    return await userModel
      .findOne({ email: email.toLowerCase() })
      .then((user) => {
        if (user) {
          return Promise.reject("E-mail already in use");
        }
      });
  }),
  check("password", "The password must be 5+ chars long and contain a number")
    .not()
    .isIn(["123", "password", "god", "azerty", "qwerty"])
    .withMessage("Do not use a common word as the password")
    .isLength({ min: 5 })
    .matches(/\d/),
  check("email")
    .trim()
    .isEmail()
    .withMessage("Please enter a valid email address"),
  async function (req, res) {
    const errors = validationResult(req);
    console.log(errors);
    if (!errors.isEmpty()) {
      res.json(errors);
    } else {
      const { firstName, lastName, email, password } = req.body;

      // Hash du mot de passe en DB et ajout de l'utilisateur en DB
      bcrypt.hash(password, saltRounds, async function (err, hash) {
        const newUser = new userModel({
          firstName: firstName,
          lastName: lastName,
          email: email.toLowerCase(),
          password: hash,
          inscriptionDate: new Date(),
          token: uid2(32),
        });

        await newUser.save();

        res.json({
          result: true,
          message: "User added to DB",
          userToken: newUser.token,
          firstName: newUser.firstName,
        });
      });
    }
  }
);

// Connexion d'un utilisateur
router.post(
  "/sign-in",
  body("email")
    .not()
    .isEmpty()
    .trim()
    .escape()
    .withMessage("Please enter your e-mail"),
  body("password")
    .not()
    .isEmpty()
    .trim()
    .escape()
    .withMessage("Please enter your password"),
  check("email").isEmail().withMessage("Please enter a valid email address"),
  body("email").custom(async (email) => {
    return await userModel
      .findOne({ email: email.toLowerCase() })
      .then((user) => {
        if (!user) {
          return Promise.reject("User doesn't exists");
        }
      });
  }),
  async function (req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(errors);
      res.json(errors);
    } else {
      const { email, password } = req.body;

      // Récupération des informations de l'utilisateur en DB
      const user = await userModel.findOne({ email: email.toLowerCase() });

      // Comparaison du mot de passe entré par l'utilisateur avec celui enregistré en DB
      bcrypt.compare(password, user.password, function (err, result) {
        if (result)
          res.json({
            result: true,
            message: "User connected",
            userToken: user.token,
            firstName: user.firstName,
          });
        else
          res.json({
            result: false,
            errors: [
              {
                value: "",
                msg: "Password or email is incorrect",
                param: "password",
                location: "body",
              },
              {
                value: "",
                msg: "",
                param: "email",
                location: "body",
              },
            ],
          });
      });
    }
  }
);

// Connexion via token LocalStorage
router.post("/sign-in-token", async function (req, res) {
  const user = await userModel.findOne({ token: req.body.token });

  if (user) res.json({ result: true, message: "Token exists" });
  else res.json({ result: false, message: "Token invalid" });
});

module.exports = router;
