const Project = require("../models/Project");
const { addTaskToQueue } = require("../services/queueService");

exports.createProject = async (req, res) => {
  try {
    const { vendorId,projectId, projectName, city, businessCategory } = req.body;
    const project = new Project({
      vendorId,
      projectId,
      projectName,
      city,
      businessCategory,
    });
    // Add the project to the scraping queue
    await project.save();
    addTaskToQueue(project);

    res.status(201).json({ message: "Project created successfully", project });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.find({ vendorId: req.params.vendorId });
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
//! delete project
exports.deleteProject = async (req, res) => {
  try {
    const id = req.params.id;
    const projects = await Project.findByIdAndDelete(id);
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
