/**
 * MongoDB Database Connection
 */
const mongoose = require("mongoose");

const connectDB = async (retries = 3) => {
  const mongoURI =
    process.env.MONGODB_URI ||
    "mongodb+srv://meetguide:Sliit123@cluster0.rybodnc.mongodb.net/meetguide?retryWrites=true&w=majority";

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(mongoURI, {
        dbName: process.env.MONGODB_DB_NAME || "meetguide",
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      });

      console.log("MongoDB connected successfully");

      // Handle connection events
      mongoose.connection.on("error", (err) => {
        console.error("MongoDB connection error:", err);
      });

      mongoose.connection.on("disconnected", () => {
        console.log("MongoDB disconnected");
      });

      return; // Success
    } catch (error) {
      console.error(
        `MongoDB connection attempt ${attempt}/${retries} failed:`,
        error.message,
      );

      if (attempt < retries) {
        const delaySeconds = Math.pow(2, attempt); // Exponential backoff: 2s, 4s, 8s
        console.log(`Retrying in ${delaySeconds} seconds...`);
        await new Promise((resolve) =>
          setTimeout(resolve, delaySeconds * 1000),
        );
      } else {
        console.error("MongoDB connection failed after all retries");
        throw error;
      }
    }
  }
};

module.exports = connectDB;
