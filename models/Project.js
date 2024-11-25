const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema({
  vendorId: { type: String },
  projectId: { type: String },
  projectName: { type: String },
  city: { type: String, required: true },
  businessCategory: { type: String, required: true },
  status: {
    type: String,
    enum: ["Running", "Finished", "Cancelled"],
    default: "Running",
  },
  createdAt: { type: Date, default: Date.now },
  cancelRequested: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("Project", ProjectSchema);
