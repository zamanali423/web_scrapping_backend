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

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));
const allowedOrigins = [
  "http://localhost:3000", // For local development
  "https://webscrappingunipuler.vercel.app" // Your deployed frontend
];

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
  credentials: true // Enable if you need cookies or authorization headers
}));

const io = new Server(server, {
  cors: {
    origin: allowedOrigins, // Use the same array as above
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});


app.get("/",(req,res)=>{
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "1800");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, PATCH, OPTIONS"); 
  
  // Send a response to complete the request
  res.send("CORS headers set successfully!");
})

// Routes
app.use("/api/projects", projectRoutes);
app.use("/", LeadRouter);
app.use("/auth/users", userRouter);

// Initialize MongoDB connection and queue initialization
connectDB()
  .then(() => {
    // After MongoDB connection is established, initialize the queue
    console.log("MongoDB connected successfully");

    // Wait for queue initialization to complete before continuing
    return initQueue(io, require("mongoose")); // Pass mongoose to the initQueue
  })
  .catch((error) => {
    console.error("Error initializing server:", error.message);
    process.exit(1); // Exit the process if connection or initialization fails
  });

    // Start server once MongoDB and queue are ready
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));


// Handle socket connection
io.on("connection", (socket) => {
  console.log("A user connected");
  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});
