const mongoose = require("mongoose");

const vendorsSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true, // Assuming username is required
  },
  email: {
    type: String,
    required: true,
    unique: true, // Assuming email should be unique
    match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"], // Email validation
  },
  phoneNumber: {
    type: String,
    required: true, // Assuming phone number is required
  },
  address: {
    type: String,
  },
  city: {
    type: String,
  },
  state: {
    type: String,
  },
  country: {
    type: String,
  },
  zipCode: {
    type: String,
  },
  password: {
    type: String,
    required: true, // Assuming password is required
  },
  tokens: [
    {
      token: {
        type: String,
        required: true, // Assuming token is required
      },
    },
  ],
});

// Create a model for "vendors" collection
module.exports = mongoose.model("vendors", vendorsSchema);
