var express = require("express");
var router = express.Router();
const userModel = require("../models/users");
const transactionModel = require("../models/transactions");
const bcrypt = require("bcrypt");
const uid2 = require("uid2");
const saltRounds = 10;
const axios = require("axios");
const { body, validationResult, check } = require("express-validator");

const coinGeckoAPI = axios.create({
  baseURL: "https://api.coingecko.com/api/v3",
  timeout: 1000,
});

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

// Afficher la liste des crypto de l'utilisateur
router.get("/list-crypto/:token", async function (req, res) {
  const user = await userModel.findOne({ token: req.params.token });

  if (user) {
    let ownedCryptos = [...user.ownedCryptos];
    if (ownedCryptos) {
      let ids = "";
      for (let i = 0; i < ownedCryptos.length; i++) {
        ids += ownedCryptos[i].id + ",";
      }

      coinGeckoAPI
        .get("/simple/price", {
          params: { vs_currencies: "eur", ids },
        })
        .then((response) => {
          let ownedCryptosCopy = [];

          for (let i = 0; i < ownedCryptos.length; i++) {
            const crypto = {
              id: ownedCryptos[i].id,
              image: ownedCryptos[i].image,
              name: ownedCryptos[i].name,
              symbol: ownedCryptos[i].symbol,
              transactions_id: ownedCryptos[i].transactions_id,
              current_price: response.data[ownedCryptos[i].id]["eur"],
              _id: ownedCryptos[i]._id,
            };
            ownedCryptosCopy.push(crypto);
          }

          res.json({
            result: true,
            message: "ownedCryptos array correctly loaded",
            ownedCryptos: ownedCryptosCopy,
          });
        });
    } else {
      res.json({ result: false, message: "No ownedCryptos array found" });
    }
  } else {
    res.json({ result: false, message: "No user found" });
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
            totalQuantity: 0,
            name: response.data[0].name,
            symbol: response.data[0].symbol,
          };
          ownedCryptos.push(newCrypto);
          const update = await userModel.updateOne(
            { token: req.body.token },
            { ownedCryptos }
          );
          if (update) {
            res.json({ result: true, message: "Correctly added crypto to db" });
          } else {
            res.json({
              result: false,
              message: "Error while adding crypto to db",
            });
          }
        });
    } else {
      res.json({ result: false, message: "Element already in db" });
    }
  } else {
    res.json({ result: false, message: "No user found or missing body entry" });
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
      res.json({ result: true, message: "Correctly deleted crypto from db" });
    } else {
      res.json({
        result: false,
        message: "Error while deleting crypto from db",
      });
    }
  } else {
    res.json({ result: false, message: "No user found or missing body entry" });
  }
});

router.post("/add-transaction", async function (req, res) {
  const {
    token,
    type,
    id,
    platform,
    pair,
    date,
    price,
    quantity,
    fees,
    from,
    to,
  } = req.body;

  // Trouver l'utilisateur grâce à son token
  const user = await userModel.findOne({ token: token });

  console.log("TYPE QUANTITY", typeof quantity);

  // Si un utilisateur est trouvé
  if (user) {
    // Création d'une copie de l'array des transactions de cet utilisateur pour la cryptomonnaie reçue
    const userTransactions = user.ownedCryptos.find(
      (crypto) => crypto.id === id
    ).transactions_id;

    let totalQuantity = user.ownedCryptos.find(
      (crypto) => crypto.id === id
    ).totalQuantity;

    console.log("TOTAL QUANTITY", typeof totalQuantity);

    // Création d'une nouvelle transaction
    const newTransaction = new transactionModel({
      type: type,
      crypto: id,
      platform: platform,
      pair: pair,
      date: date,
      price: price,
      quantity: quantity,
      fees: fees,
      from: from,
      to: to,
    });

    // Sauvegarde de la transaction en BDD
    const savedTransaction = await newTransaction.save();

    // Ajout de l'ID de la nouvelle transaction dans la copie de l'array des transactions
    userTransactions.push(savedTransaction._id);

    // Mise à jour de totalQuantity de la crypto fonction du type de transaction
    switch (type) {
      case "buy":
        totalQuantity += Number(quantity);
        break;
      case "sell":
        totalQuantity -= Number(quantity);
        break;
      case "transfer":
        totalQuantity -= Number(fees);
        break;
    }

    // Mise à jour de l'array des transactions de l'utilisateur pour la crypto
    const updatedUserTransactions = await userModel.updateOne(
      // Filtre sur le token pour viser l'utilisateur
      {
        token: token,
      },
      // On met à jour l'array transactions_id pour la crypto associée à la transaction
      {
        $set: {
          "ownedCryptos.$[crypto].transactions_id": userTransactions,
          "ownedCryptos.$[crypto].totalQuantity": totalQuantity,
        },
      },
      // On filtre l'array pour se positier dans dans la bonne crypto associée à la transaction
      { arrayFilters: [{ "crypto.id": id }] }
    );

    res.json({
      result: true,
      message: "Transaction added",
      transactionID: savedTransaction._id,
    });
  } else {
    res.json({ result: false, message: "Error adding transaction" });
  }
});

router.delete(
  "/delete-transaction/:token/:crypto/:id",
  async function (req, res) {
    const token = req.params.token;
    const crypto_id = req.params.crypto;
    const id = req.params.id;

    // Trouver l'utilisateur grâce à son token
    const user = await userModel.findOne({ token });

    // Si un utilisateur est trouvé
    if (user) {
      // Suppression de la transaction dans la collection transactions
      const deleteTransaction = await transactionModel
        .findOne({ _id: id })
        .catch((e) => console.log(e));

      if (deleteTransaction) {
        await transactionModel.deleteOne({ _id: id });

        // Création d'une copie de l'array des transactions de cet utilisateur pour la cryptomonnaie reçue
        let userTransactions = user.ownedCryptos.find(
          (crypto) => crypto.id === crypto_id
        ).transactions_id;

        let totalQuantity = user.ownedCryptos.find(
          (crypto) => crypto.id === crypto_id
        ).totalQuantity;

        switch (deleteTransaction.type) {
          case "buy":
            totalQuantity -= Number(deleteTransaction.quantity);
            break;
          case "sell":
            totalQuantity += Number(deleteTransaction.quantity);
            break;
          case "transfer":
            totalQuantity += Number(deleteTransaction.fees);
            break;
        }

        // // Suppression de l'ID de la nouvelle transaction dans la copie de l'array des transactions
        userTransactions = userTransactions.filter((element) => element != id);

        // Mise à jour de l'array des transactions de l'utilisateur pour la crypto
        const updatedUserTransactions = await userModel.updateOne(
          // Filtre sur le token pour viser l'utilisateur
          {
            token: token,
          },
          // On met à jour l'array transactions_id pour la crypto associée à la transaction
          {
            $set: {
              "ownedCryptos.$[crypto].transactions_id": userTransactions,
              "ownedCryptos.$[crypto].totalQuantity": totalQuantity,
            },
          },
          // On filtre l'array pour se positier dans dans la bonne crypto associée à la transaction
          { arrayFilters: [{ "crypto.id": crypto_id }] }
        );

        res.json({
          result: true,
          message: "Transaction deleted",
        });
      } else {
        res.json({ result: false, message: "Transaction not found" });
      }
    } else {
      res.json({ result: false, message: "Error deleting transaction" });
    }
  }
);

module.exports = router;
