const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema({
  placeId: String,
  address: String,
  category: String,
  projectCategory: String,
  phone: String,
  googleUrl: String,
  bizWebsite: String,
  storeName: String,
  ratingText: String,
  stars: Number,
  numberOfReviews: Number,
  city: String,
  vendorId: String,
  about: String,
  logoUrl: String,
  email: String,
  imageUrl: String,
  socialLinks: {
    youtube: String,
    instagram: String,
    facebook: String,
    linkedin: String,
  },
});

const Lead = mongoose.model("Lead", leadSchema);

module.exports = Lead;
