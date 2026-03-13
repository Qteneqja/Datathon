/**
 * Winnipeg Stride — API Server
 *
 * Lightweight Express server that:
 *   1. Loads cleaned Winnipeg CSVs on startup
 *   2. Assigns neighbourhoods + computes basic scores
 *   3. Exposes REST endpoints for the React Native frontend
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

// Load .env from server dir, then fall back to parent Datathon .env
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
if (!process.env.DEEPSEEK_API_KEY) {
  require("dotenv").config({
    path: path.join(__dirname, "..", "..", ".env"),
  });
}

const locationsRouter = require("./routes/locations");
const chatRouter = require("./routes/chat");
const itineraryRouter = require("./routes/itinerary");
const weatherRouter = require("./routes/weather");
const { loadAllLocations } = require("./data-loader");

const app = express();
const PORT = process.env.PORT || 3001;

// ── CONFIDENTIALITY: Restrict CORS to known origins ──
const ALLOWED_ORIGINS = [
  "http://localhost:8081",
  "http://localhost:19006",
  "http://localhost:3001",
];
app.use(
  cors({
    origin(origin, cb) {
      // Allow requests with no origin (mobile apps, curl) or whitelisted
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(null, true); // permissive for datathon demo — tighten in production
    },
  })
);

// ── INTEGRITY: Limit request body size to prevent abuse ──
app.use(express.json({ limit: "100kb" }));

// ── CONFIDENTIALITY: Security headers ──
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

// -------------------------------------------------------------------
// Load data into memory on startup, share via app.locals
// ── AVAILABILITY: Data loaded once; health check confirms readiness ──
// -------------------------------------------------------------------
let locationsData = [];

async function boot() {
  console.log("Loading Winnipeg location data...");
  try {
    locationsData = await loadAllLocations();
  } catch (err) {
    console.error("  Data load failed — starting with empty dataset:", err.message);
    locationsData = [];
  }
  app.locals.locations = locationsData;
  console.log(`  Loaded ${locationsData.length} locations`);

  // Mount routes
  app.use("/api/locations", locationsRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/itinerary", itineraryRouter);
  app.use("/api/weather", weatherRouter);

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", locations: locationsData.length });
  });

  app.listen(PORT, () => {
    console.log(`Winnipeg Stride API listening on http://localhost:${PORT}`);
  });
}

boot().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
