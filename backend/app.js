require("dotenv").config();

const express = require("express");
const connectDB = require("./config/db");
const chatRoutes = require("./routes/chatRoutes");
const userRoutes = require("./routes/userRoutes");
const path = require("path");
const cors = require("cors");

const app = express();
connectDB();

// Middleware (put before routes)
app.use(cors());
app.use(express.json());

// API Routes
// const authRoutes = require("./routes/authRoutes");
// app.use('/api/auth', authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/users", userRoutes);

// Add admin routes
const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes);

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Handle SPA routing - send index.html for all non-API routes
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Server
const PORT = process.env.PORT || 5500;
app.listen(PORT, () => {
    console.log(`\n✅ Server running at: http://localhost:${PORT}\n`);
});
