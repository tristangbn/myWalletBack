var express = require("express");
var router = express.Router();
const userModel = require("../models/users");
const transactionModel = require("../models/transactions");
const bcrypt = require("bcrypt");
const uid2 = require("uid2");
const saltRounds = 10;
const axios = require("axios");

const coinGeckoAPI = axios.create({
  baseURL: "https://api.coingecko.com/api/v3",
  timeout: 1000,
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

// Afficher la liste des crypto de l'utilisateur
router.get("/list-crypto/:token", async function (req, res) {
  const user = await userModel.findOne({ token: req.params.token });

  if (user) {
    const ownedCryptos = user.ownedCryptos;
    if (ownedCryptos) {
      res.json({ result: true, ownedCryptos });
    } else {
      res.json({ result: false });
    }
  } else {
    res.json({ result: false });
  }
});

// Ajouter une crypto au portfolio de l'utilisateur
router.post("/add-crypto", async function (req, res) {
  const user = await userModel.findOne({ token: req.body.token });

  if (user && req.body.id) {
    const ownedCryptos = user.ownedCryptos;
    if (!ownedCryptos.find((element) => element.id === req.body.id)) {
      coinGeckoAPI
        .get("/coins/markets", {
          params: { vs_currency: "eur", ids: req.body.id },
        })
        .then(async (response) => {
          const newCrypto = {
            id: response.data[0].id,
            image: response.data[0].image,
            name: response.data[0].name,
            symbol: response.data[0].symbol,
          };
          ownedCryptos.push(newCrypto);
          const update = await userModel.updateOne(
            { token: req.body.token },
            { ownedCryptos }
          );
          if (update) {
            res.json({ result: true });
          } else {
            res.json({ result: false });
          }
        });
    } else {
      res.json({ result: false });
    }
  } else {
    res.json({ result: false });
  }
});

// Supprimer une crypto du portfolio de l’utilisateur
router.delete("/delete-crypto/:id/:token", async function (req, res) {
  const user = await userModel.findOne({ token: req.params.token });

  if (user && req.params.id) {
    const ownedCryptos = user.ownedCryptos;
    const deleteCrypto = ownedCryptos.filter(
      (word) => word.id !== req.params.id
    );

    const update = await userModel.updateOne(
      { token: req.params.token },
      { ownedCryptos: deleteCrypto }
    );

    if (update) {
      res.json({ result: true });
    } else {
      res.json({ result: false });
    }
  } else {
    res.json({ result: false });
  }
});

module.exports = router;
