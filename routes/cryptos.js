var express = require("express");
var router = express.Router();
const userModel = require("../models/users");
const transactionModel = require("../models/transactions");
const axios = require("axios");

const coinGeckoAPI = axios.create({
  baseURL: "https://api.coingecko.com/api/v3",
  timeout: 2000,
});

// Afficher la liste des crypto de l'utilisateur
router.get("/list-crypto/:token", async function (req, res) {
  const user = await userModel
    .findOne({ token: req.params.token })
    .populate("ownedCryptos.transactions_id");

  if (user) {
    let ownedCryptos = [...user.ownedCryptos];
    if (ownedCryptos) {
      let ids = "";
      for (let i = 0; i < ownedCryptos.length; i++) {
        ids += ownedCryptos[i].id + ",";
      }

      const buyTransactions = ownedCryptos.map((crypto) =>
        crypto.transactions_id.filter(
          (transaction) => transaction.type === "buy"
        )
      );

      const sellTransactions = ownedCryptos.map((crypto) =>
        crypto.transactions_id.filter(
          (transaction) => transaction.type === "sell"
        )
      );

      // console.log(buyTransactions);

      const totalInvestmentPerCrypto = [];

      if (buyTransactions.length > 0 && buyTransactions[0].length > 0) {
        for (let el of buyTransactions) {
          // console.log(crypto);

          if (el.length > 0) {
            const crypto = {
              crypto: el[0].crypto,
              totalInvestment: el.reduce((acc, val) => {
                return acc + val.price * val.quantity + val.fees;
              }, 0),
            };
            totalInvestmentPerCrypto.push(crypto);
          }
        }
      }

      if (sellTransactions.length > 0 && sellTransactions[0].length > 0) {
        for (let el of sellTransactions) {
          // console.log(crypto);
          if (el.length > 0) {
            const cryptoIndex = totalInvestmentPerCrypto.findIndex(
              (crypto) => crypto.crypto === el[0].crypto
            );

            totalInvestmentPerCrypto[cryptoIndex].totalInvestment -= el.reduce(
              (acc, val) => {
                return acc + val.price * val.quantity - val.fees;
              },
              0
            );
          }
        }
      }

      // console.log(buyTransactions);
      // console.log(totalInvestmentPerCrypto);

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
              totalQuantity: ownedCryptos[i].totalQuantity,
              transactions_id: ownedCryptos[i].transactions_id,
              currentPrice: response.data[ownedCryptos[i].id]["eur"],
              _id: ownedCryptos[i]._id,
              totalInvestment: totalInvestmentPerCrypto.find(
                (el) => el.crypto === ownedCryptos[i].id
              )
                ? totalInvestmentPerCrypto.find(
                    (el) => el.crypto === ownedCryptos[i].id
                  ).totalInvestment
                : 0,
            };
            ownedCryptosCopy.push(crypto);
          }

          const totalPortfolioInvestment = totalInvestmentPerCrypto.reduce(
            (acc, val) => {
              return acc + val.totalInvestment;
            },
            0
          );

          let portfolioVariationInPercent = 0;
          for (el of totalInvestmentPerCrypto) {
            const index = ownedCryptosCopy.findIndex(
              (crypto) => crypto.id === el.crypto
            );

            console.log(typeof ownedCryptos[index].currentPrice);

            const variationInFiat =
              ownedCryptosCopy[index].totalQuantity *
                ownedCryptosCopy[index].currentPrice -
              el.totalInvestment;

            const variation = variationInFiat / el.totalInvestment;

            el.ratio = el.totalInvestment / totalPortfolioInvestment;

            el.variation = variation;

            portfolioVariationInPercent += el.ratio * el.variation * 100;
          }

          console.log(totalInvestmentPerCrypto);
          console.log(portfolioVariationInPercent);

          res.json({
            result: true,
            message: "ownedCryptos array correctly loaded",
            ownedCryptos: ownedCryptosCopy,
            totalPortfolioInvestment,
            totalInvestmentPerCrypto,
            portfolioVariationInPercent,
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
    const transactions = user.ownedCryptos.find(
      (crypto) => crypto.id === req.params.id
    ).transactions_id;

    const deletedTransactions = await transactionModel.deleteMany({
      _id: { $in: transactions },
    });

    if (deletedTransactions) {
      const ownedCryptos = user.ownedCryptos;
      const deleteCrypto = ownedCryptos.filter(
        (word) => word.id !== req.params.id
      );
      const update = await userModel.updateOne(
        { token: req.params.token },
        { ownedCryptos: deleteCrypto }
      );
      if (update) {
        res.json({
          result: true,
          message: "Correctly deleted crypto from db",
        });
      } else {
        res.json({
          result: false,
          message: "Error while deleting crypto from db",
        });
      }
    } else {
      res.json({
        result: false,
        message: "Error while deleting Transaction from db",
      });
    }
  } else {
    res.json({ result: false, message: "No user found or missing body entry" });
  }
});

module.exports = router;
