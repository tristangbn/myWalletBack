const mongoose = require("mongoose");

const options = {
  connectTimeoutMS: 5000,
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

mongoose.connect(
  "mongodb+srv://admin:admin@cluster0.m8yb3.mongodb.net/myWallet",
  // "mongodb+srv://admin:200392@cluster0.cpene.mongodb.net/myWallet?retryWrites=true&w=majority",
  options,
  function (err) {
    console.log(err || "Connected to MongoDB");
  }
);
