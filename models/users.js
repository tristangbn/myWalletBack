const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  password: String,
  inscriptionDate: Date,
  token: String,
  ownedCryptos: [
    {
      id: String,
      image: String,
      name: String,
      totalQuantity: Number,
      symbol: String,
      transactions_id: [
        { type: mongoose.Schema.Types.ObjectId, ref: "transactions" },
      ],
    },
  ],
});

const userModel = mongoose.model("users", userSchema);

module.exports = userModel;
