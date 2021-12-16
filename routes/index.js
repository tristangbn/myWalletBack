var express = require("express");
var router = express.Router();
const userModel = require("../models/users");
const axios = require("axios");

const coinGeckoAPI = axios.create({
  baseURL: "https://api.coingecko.com/api/v3",
  timeout: 2000,
});

router.get("/stocks/:token/:days/:myCryptos", async function (req, res) {
  const maxStocks = 5;
  const user = await userModel.findOne({ token: req.params.token });

  const intervalUpdate = [
    { days: 7, interval: "daily" },
    { days: 1, interval: "hourly" },
  ];

  if (user) {
    let ownedCryptos = [...user.ownedCryptos];
    if (ownedCryptos) {
      let ids = "";
      for (let i = 0; i < ownedCryptos.length; i++) {
        ids += ownedCryptos[i].id + ",";
      }

      coinGeckoAPI
        .get(
          `/coins/markets?vs_currency=eur&order=market_cap_desc&per_page=${maxStocks}&page=1&sparkline=false&price_change_percentage=24h%2C7d` +
            (req.params.myCryptos === "true" ? `&ids=${ids}` : "")
        )
        .then(async (response) => {
          const cryptos = [];
          for (let i = 0; i < response.data.length && i < maxStocks; i++) {
            // On limite i à 20 pour éviter de surcharger le nombre de fetch à coinGecko
            const price = await coinGeckoAPI.get(
              `https://api.coingecko.com/api/v3/coins/${
                response.data[i].id
              }/market_chart?vs_currency=eur&days=${req.params.days}&interval=${
                intervalUpdate.find((e) => e.days == req.params.days).interval
              }`
            );
            cryptos.push({
              image: response.data[i].image,
              name: response.data[i].name,
              id: response.data[i].id,
              currentPrice: response.data[i].current_price,
              price_change_24h:
                response.data[i].price_change_percentage_24h_in_currency,
              price_change_7d:
                response.data[i].price_change_percentage_7d_in_currency,
              prices: price.data.prices,
            });
          }
          Promise.all(cryptos).then((response) =>
            res.json({ result: true, cryptos: response })
          );
        });
    }
  }
});

module.exports = router;
