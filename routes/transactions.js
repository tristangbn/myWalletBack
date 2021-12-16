var express = require("express");
var router = express.Router();
const userModel = require("../models/users");
const transactionModel = require("../models/transactions");
const { body, validationResult, check } = require("express-validator");

// Ajout d'une transaction
router.post(
  "/add-transaction",
  body("platform")
    .not()
    .isEmpty()
    .trim()
    .escape()
    .withMessage("Please select a platform"),
  body("price")
    .not()
    .isEmpty()
    .trim()
    .escape()
    .withMessage("Please enter a price"),
  body("quantity")
    .not()
    .isEmpty()
    .trim()
    .escape()
    .withMessage("Please select a quantity"),
  body("from")
    .not()
    .isEmpty()
    .trim()
    .escape()
    .withMessage("Please select a platform"),
  body("to")
    .not()
    .isEmpty()
    .trim()
    .escape()
    .withMessage("Please select a platform"),
  async function (req, res) {
    const errors = validationResult(req);
    console.log(errors);
    if (!errors.isEmpty()) {
      res.json(errors);
    } else {
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

      // console.log("TYPE QUANTITY", typeof quantity);

      // Si un utilisateur est trouvé
      if (user) {
        // Création d'une copie de l'array des transactions de cet utilisateur pour la cryptomonnaie reçue
        const userTransactions = user.ownedCryptos.find(
          (crypto) => crypto.id === id
        ).transactions_id;

        let totalQuantity = user.ownedCryptos.find(
          (crypto) => crypto.id === id
        ).totalQuantity;

        // console.log("TOTAL QUANTITY", typeof totalQuantity);

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
        userTransactions.unshift(savedTransaction._id);

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
    }
  }
);

// Supprimer une transaction
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

        // console.log(updatedUserTransactions);

        res.json({
          result: true,
          message: "Transaction deleted",
          totalQuantity,
        });
      } else {
        res.json({ result: false, message: "Transaction not found" });
      }
    } else {
      res.json({ result: false, message: "Error deleting transaction" });
    }
  }
);

// Afficher la liste des transactions de l'utilisateur pour une crypto donnée
router.get("/list-transactions/:token/:id", async function (req, res) {
  const { token, id } = req.params;

  // Trouver l'utilisateur grâce à son token
  const user = await userModel
    .findOne({ token: token })
    .populate("ownedCryptos.transactions_id");

  // Si l'utilisateur existe
  if (user) {
    // On cherche si des transactions existent pour la crypto envoyée
    const transactions = user.ownedCryptos.find((crypto) => crypto.id === id);

    // Si des transactions sont trouvées
    if (transactions) {
      res.json({ result: true, transactions: transactions.transactions_id });
    } else {
      // Si aucune transaction pour cette crypto n'est trouvée
      res.json({
        result: false,
        message: "No transactions found for this asset",
      });
    }
  } else {
    // Si l'utilisateur n'est pas trouvé
    res.json({ result: false, message: "User not found" });
  }
});

router.put(
  "/update-transaction",
  body("platform")
    .not()
    .isEmpty()
    .trim()
    .escape()
    .withMessage("Please select a platform"),

  body("price")
    .not()
    .isEmpty()
    .trim()
    .escape()
    .withMessage("Please enter a price"),
  body("quantity")
    .not()
    .isEmpty()
    .trim()
    .escape()
    .withMessage("Please select a quantity"),
  body("from")
    .not()
    .isEmpty()
    .trim()
    .escape()
    .withMessage("Please select a platform"),
  body("to")
    .not()
    .isEmpty()
    .trim()
    .escape()
    .withMessage("Please select a platform"),
  async function (req, res) {
    const errors = validationResult(req);
    console.log(errors);
    if (!errors.isEmpty()) {
      res.json(errors);
    } else {
      const {
        token,
        _id,
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

      const user = await userModel.findOne({ token: token });

      if (user) {
        const transactionToUpdate = await transactionModel.findOne({
          _id: _id,
        });
        const userCryptoQuantity = user.ownedCryptos.find(
          (crypto) => crypto.id === id
        ).totalQuantity;
        // console.log(userCryptoQuantity);

        // update de la totalQuantity de la crypto impliquer par la transaction
        switch (type) {
          case "transfer":
            await userModel.updateOne(
              {
                token: token,
              },
              {
                $set: {
                  "ownedCryptos.$[crypto].totalQuantity":
                    Number(userCryptoQuantity) +
                    Number(transactionToUpdate.fees) -
                    Number(fees),
                },
              },

              { arrayFilters: [{ "crypto.id": id }] }
            );
            break;
          case "buy":
            await userModel.updateOne(
              {
                token: token,
              },
              {
                $set: {
                  "ownedCryptos.$[crypto].totalQuantity":
                    Number(userCryptoQuantity) -
                    Number(transactionToUpdate.quantity) +
                    Number(quantity),
                },
              },

              { arrayFilters: [{ "crypto.id": id }] }
            );
            break;
          case "sell":
            await userModel.updateOne(
              {
                token: token,
              },
              {
                $set: {
                  "ownedCryptos.$[crypto].totalQuantity":
                    Number(userCryptoQuantity) +
                    Number(transactionToUpdate.quantity) -
                    Number(quantity),
                },
              },

              { arrayFilters: [{ "crypto.id": id }] }
            );
            break;
        }

        if (transactionToUpdate) {
          if (type == "transfer") {
            await transactionModel.updateOne(
              { _id: _id },
              {
                type: type,
                crypto: id,
                platform: "",
                pair: "",
                date: date,
                price: null,
                quantity: quantity,
                fees: fees,
                from: from,
                to: to,
              }
            );
          } else {
            await transactionModel.updateOne(
              { _id: _id },
              {
                type: type,
                crypto: id,
                platform: platform,
                pair: pair,
                date: date,
                price: price,
                quantity: quantity,
                fees: fees,
                from: "",
                to: "",
              }
            );
          }

          res.json({ result: true });
        } else {
          res.json({ result: false, message: "Transaction not found" });
        }
      } else {
        res.json({ result: false, message: "User not found" });
      }
    }
  }
);

module.exports = router;
