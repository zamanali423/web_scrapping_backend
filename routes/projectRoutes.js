const express = require("express");
const router = express.Router();
const {
  createProject,
  getProjects,
} = require("../controllers/projectController");

router.post("/create", createProject);
router.get("/:vendorId", getProjects);
router.delete("/delete/:id", getProjects);

module.exports = router;
