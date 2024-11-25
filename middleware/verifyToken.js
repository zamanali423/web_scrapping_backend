const jwt = require("jsonwebtoken");
const Admin = require("../models/adminData/adminData");
const Vendor = require("../models/customerData/customerData");

const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization.replace("Bearer ", "");
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const user =
      (await Admin.findById(decoded.id)) || (await Vendor.findById(decoded.id));
    if (!user) {
      return res.status(404).json({ msg: "Unauthorized User" });
    }
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      const token = req.headers.authorization.replace("Bearer ", "");
      const decoded = jwt.decode(token);
      const user =
        (await Admin.findById(decoded.id)) ||
        (await Vendor.findById(decoded.id));
      if (user) {
        user.tokens = user.tokens.filter((t) => t.token !== token);
        await user.save();
      }
      return res
        .status(401)
        .json({ msg: "Token Expired. Please log in again." });
    }
  }
};

module.exports = verifyToken;
