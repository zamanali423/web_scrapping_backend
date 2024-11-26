const Bull = require("bull");
const Project = require("../models/Project");
const { searchGoogleMaps } = require("./scraperService");
const Lead = require("../models/Lead");

console.log("Queue file loaded");

const projectQueue = new Bull("projectQueue", {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    maxRetriesPerRequest: null,
  },
});

async function initQueue(io, mongoose) {
  console.log("initQueue function called");

  return new Promise((resolve, reject) => {
    if (mongoose.connection.readyState !== 1) {
      return reject(new Error("MongoDB not connected"));
    }

    // Ensure the job processing is properly handled with error checks
    projectQueue.process(1, async (job, done) => {
      console.log("Processing job:", job.data);
      const { project } = job.data;

      try {
        // Start job with 'Running' status
        await Project.findByIdAndUpdate(project._id, { status: "Running" });
        io.emit("projectStatusUpdate", {
          projectId: project._id,
          status: "Running",
        });
        job.progress(10);
        // Execute the scraping process
        const data = await searchGoogleMaps(project,io);
        console.log("Google Maps data scraped:", data?.length);
        job.progress(100);
        // Check if the result is empty
        if (!data || data.length === 0) {
          console.log("No data found, skipping this job.");
          await Project.findByIdAndUpdate(project._id, { status: "Finished" });
          io.emit("projectStatusUpdate", {
            projectId: project._id,
            status: "Finished",
          });
          return done();
        }

        const currentProjectStatus = await Project.findOne({
          projectId: project.projectId,
        });
        if (currentProjectStatus?.status === "Cancelled") {
          io.emit("projectStatusUpdate", {
            projectId: project._id,
            status: "Cancelled",
          });
          return done(); // Exit job processing gracefully
        }

        await Project.findByIdAndUpdate(project._id, { status: "Finished" });
        io.emit("projectStatusUpdate", {
          projectId: project._id,
          status: "Finished",
        });

        console.log("Job processed successfully");
        done(); // Ensure done() is called only once
      } catch (error) {
        console.error("Error processing job:", error);
        await Project.findByIdAndUpdate(project._id, { status: "Failed" });
        io.emit("projectStatusUpdate", {
          projectId: project._id,
          status: "Failed",
        });
        done(error); // Ensure error is passed to done() once
      }
    });

    resolve();
  });
}

projectQueue.on("completed", (job) => {
  console.log(`Job with ID ${job.id} completed`);
});

projectQueue.on("failed", (job, err) => {
  console.error(`Job with ID ${job.id} failed with error:`, err);
});

projectQueue.on("error", (error) => {
  console.error("Queue encountered an error:", error);
});

process.on("SIGTERM", async () => {
  console.log("Graceful shutdown initiated");
  await projectQueue.close(); // Stops queue processing
  process.exit(0);
});

function addTaskToQueue(project) {
  projectQueue.add({ project });
  console.log("Task added to the queue:", project);
}

async function cancelTaskFromQueue(projectId, io) {
  try {
    console.log("Cancelling job for project ID:", projectId);

    const jobs = await projectQueue.getJobs([
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
    ]);
    console.log("Number of jobs retrieved:", jobs.length);

    const jobToCancel = jobs.find(
      (job) => job.data.project && job.data.project.projectId === projectId
    );

    await Project.findOneAndUpdate(
      { projectId },
      { cancelRequested: true, status: "Cancelled" },
      { new: true }
    );

    if (jobToCancel) {
      await jobToCancel.remove();
      console.log(`Job with project ID ${projectId} removed from the queue`);
      io.emit("projectStatusUpdate", { projectId, status: "Cancelled" });
    } else {
      console.log(`No active job found with project ID ${projectId}`);
      io.emit("projectStatusUpdate", { projectId, status: "Cancelled" });
    }
  } catch (error) {
    console.error(`Error cancelling job with project ID ${projectId}:`, error);
  }
}

module.exports = { initQueue, addTaskToQueue, cancelTaskFromQueue };
