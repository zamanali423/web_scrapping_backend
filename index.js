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

// Define allowed origins
const allowedOrigins = [
  "http://localhost:3000", // Local development
  "https://webscrappingunipuler.vercel.app" // Deployed frontend
];

// CORS Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true // Enable cookies and auth headers
}));

// WebSocket Server Setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins, // Consistent with HTTP CORS
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket", "polling"] // Ensure WebSocket is enabled
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
