// server.js
console.log("Server file loaded");

require("dotenv").config();
const express = require("express");
const projectRoutes = require("./routes/projectRoutes");
const userRouter = require("./routes/admin/users/users");
const LeadRouter = require("./routes/Leads");
const connectDB = require("./config/db");
const { initQueue } = require("./services/queueService");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// CORS Middleware
app.use(cors())

// WebSocket Server Setup
const io = new Server(server, {
  cors: {
    origin: ["https://webscrappingunipuler.vercel.app", "*"], // Use an array for multiple origins
    credentials: true // Optional: Allow credentials (cookies, authorization headers, etc.)
  }
});

// Handle WebSocket connection
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });

  socket.on("disconnect", (reason) => {
    console.log(`Disconnected: ${reason}`);
  });
});


// Middleware for JSON handling
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

// Routes
app.get("/", (req, res) => {
  res.send("Server Running");
});
app.use("/api/projects", projectRoutes);
app.use("/", LeadRouter);
app.use("/auth/users", userRouter);

// Initialize MongoDB connection and queue initialization
connectDB()
  .then(() => {
    console.log("MongoDB connected successfully");
    return initQueue(io, require("mongoose")); // Pass mongoose to the initQueue
  })
  .catch((error) => {
    console.error("Error initializing server:", error.message);
    process.exit(1); // Exit on failure
  });

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
