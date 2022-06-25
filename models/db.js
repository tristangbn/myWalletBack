const mongoose = require("mongoose");

const options = {
  connectTimeoutMS: 5000,
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

mongoose.connect(
 
  options,
  function (err) {
    console.log(err || "Connected to MongoDB");
  }
);
