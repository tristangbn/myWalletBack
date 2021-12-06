const mongoose = require("mongoose");

const options = {
  connectTimeoutMS: 5000,
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

mongoose.connect(
  "mongodb+srv://admin:200392@cluster0.cpene.mongodb.net/myWallet?retryWrites=true&w=majority",
  options,
  function (err) {
    console.log(err);
  }
);
