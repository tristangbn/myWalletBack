const mongoose = require("mongoose");

const transactionSchema = mongoose.Schema({
  type: String,
  crypto: String,
  platform: String,
  pair: String,
  date: Date,
  price: Number,
  quantity: Number,
  fees: Number,
  from: String,
  to: String,
});

const transactionModel = mongoose.model("transactions", transactionSchema);

module.exports = transactionModel;
