/**
 * GET /api/weather
 *
 * CONFIDENTIALITY: Proxies weather requests through the backend so the
 * API key never reaches the client. The frontend calls this instead of
 * hitting WeatherAPI.com directly.
 *
 * AVAILABILITY: Returns cached data for 10 minutes and a static fallback
 * if the upstream API is unreachable.
 */

const express = require("express");
const router = express.Router();

const WEATHER_API_KEY = process.env.WEATHER_API_KEY || "";

// ── AVAILABILITY: Simple in-memory cache (10 min TTL) ──
let cached = null;
let cachedAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

// ── AVAILABILITY: Static fallback when API is down ──
const FALLBACK = {
  temp: 0,
  description: "Weather unavailable",
  icon: "cloud",
  cached: true,
};

router.get("/", async (_req, res) => {
  // Serve from cache if fresh
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) {
    return res.json({ ...cached, cached: true });
  }

  if (!WEATHER_API_KEY) {
    return res.json(FALLBACK);
  }

  try {
    const url = `https://api.weatherapi.com/v1/current.json?key=${encodeURIComponent(WEATHER_API_KEY)}&q=Winnipeg`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error(`Weather API ${resp.status}`);
    const data = await resp.json();
    const curr = data.current;
    const tempC = Math.round(curr.temp_c);

    const result = {
      temp: tempC,
      description: curr.condition.text,
      icon: tempC < -10 ? "snow" : tempC > 15 ? "sunny" : "partly-sunny",
    };

    // Update cache
    cached = result;
    cachedAt = Date.now();

    res.json(result);
  } catch (err) {
    console.error("Weather proxy error:", err.message);
    // Return stale cache if available, else static fallback
    res.json(cached || FALLBACK);
  }
});

module.exports = router;
