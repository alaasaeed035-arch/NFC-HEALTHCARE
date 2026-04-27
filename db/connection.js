import mongoose from "mongoose";
import { setDefaultResultOrder, setServers } from "dns";

setServers(["8.8.8.8", "8.8.4.4"]);
setDefaultResultOrder("ipv4first");

// Persists across warm serverless invocations within the same Node.js process
let cached = global.__mongooseCache;
if (!cached) {
  cached = global.__mongooseCache = { conn: null, promise: null };
}

export async function dbConnection() {
  // Fast path: already connected
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // If the connection was dropped, clear the stale promise so we reconnect
  if (mongoose.connection.readyState === 0) {
    cached.conn = null;
    cached.promise = null;
  }

  // Only open one connection attempt even under concurrent requests
  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.DB_URL, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      bufferCommands: false, // never silently buffer — fail fast if not connected
    });
  }

  try {
    cached.conn = await cached.promise;
    console.log("✅ MongoDB connected");
    return cached.conn;
  } catch (err) {
    cached.promise = null; // allow retry on next request
    console.error("❌ MongoDB connection failed:", err.message);
    throw err;
  }
}
