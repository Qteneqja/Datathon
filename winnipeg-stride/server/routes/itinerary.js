/**
 * POST /api/itinerary
 * Body: { preferences?: string[], neighbourhood?: string, maxStops?: number }
 *
 * Generates an itinerary using the scoring + nearest-neighbor algorithm
 * from src/itinerary.py, then optionally asks DeepSeek for a narrative.
 */

const express = require("express");
const router = express.Router();
const { haversineKm, walkMinutes } = require("../data-loader");

// The Forks — default start point
const DEFAULT_START = { lat: 49.8875, lon: -97.1313 };

const OUTDOOR_CATS = new Set(["Park", "Recreation", "Public Art"]);
const INDOOR_CATS = new Set(["Arts & Culture", "Restaurant"]);

// -------------------------------------------------------------------
// Itinerary generator (mirrors src/itinerary.py logic)
// -------------------------------------------------------------------
function generateItinerary(locations, options = {}) {
  const {
    startLat = DEFAULT_START.lat,
    startLon = DEFAULT_START.lon,
    radiusKm = 3,
    maxStops = 6,
    preferences = [],
    neighbourhood,
  } = options;

  let pool = [...locations];

  // Filter by neighbourhood if specified
  if (neighbourhood) {
    const hoodFiltered = pool.filter((l) => l.neighbourhood === neighbourhood);
    if (hoodFiltered.length >= 3) pool = hoodFiltered;
  }

  // Filter by radius from start
  pool = pool
    .map((l) => ({
      ...l,
      distFromStart: haversineKm(startLat, startLon, l.latitude, l.longitude),
    }))
    .filter((l) => l.distFromStart <= radiusKm);

  if (pool.length === 0) return [];

  // Apply preference bonuses
  for (const loc of pool) {
    let bonus = 0;
    if (preferences.includes("outdoor") && OUTDOOR_CATS.has(loc.category))
      bonus += 10;
    if (preferences.includes("indoor") && INDOOR_CATS.has(loc.category))
      bonus += 10;
    if (
      preferences.includes("hidden_gems") &&
      (loc.tourismScore || 0) < 30
    )
      bonus += 15;
    if (preferences.includes("family")) {
      if (loc.category === "Park" || loc.category === "Recreation") bonus += 8;
    }
    loc.adjustedScore = (loc.tourismScore || 0) + bonus;
  }

  // Diversified selection: pick top from each category
  const selected = [];
  const usedIds = new Set();
  const categories = [...new Set(pool.map((l) => l.category))];

  // Sort categories by adjusted score to prioritize preferred ones
  for (const cat of categories) {
    if (selected.length >= maxStops) break;
    const catPool = pool
      .filter((l) => l.category === cat && !usedIds.has(l.id))
      .sort((a, b) => b.adjustedScore - a.adjustedScore);
    if (catPool.length > 0) {
      selected.push(catPool[0]);
      usedIds.add(catPool[0].id);
    }
  }

  // Fill remaining slots with highest-scored unused
  if (selected.length < maxStops) {
    const remaining = pool
      .filter((l) => !usedIds.has(l.id))
      .sort((a, b) => b.adjustedScore - a.adjustedScore);
    for (const loc of remaining) {
      if (selected.length >= maxStops) break;
      selected.push(loc);
    }
  }

  // Enforce max 1 park-like stop per itinerary
  const PARK_KWS = ["park", "garden", "trail", "greenspace", "green space", "arboretum"];
  const isParkLike = (l) => l.category === "Park" || PARK_KWS.some((kw) => l.name.toLowerCase().includes(kw));
  let parkCount = 0;
  const capped = selected.filter((l) => {
    if (isParkLike(l)) {
      parkCount++;
      if (parkCount > 1) return false;
    }
    return true;
  });

  // Nearest-neighbor ordering
  const ordered = [];
  let curLat = startLat;
  let curLon = startLon;
  const remaining = [...capped];

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(curLat, curLon, remaining[i].latitude, remaining[i].longitude);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    next.walkMinutes = walkMinutes(curLat, curLon, next.latitude, next.longitude);
    curLat = next.latitude;
    curLon = next.longitude;
    ordered.push(next);
  }

  // Assign stop numbers and time slots
  const timeSlots = ["Morning", "Morning", "Lunch", "Afternoon", "Afternoon", "Evening"];
  return ordered.map((loc, i) => ({
    stopNumber: i + 1,
    name: loc.name,
    category: loc.category,
    neighbourhood: loc.neighbourhood,
    latitude: loc.latitude,
    longitude: loc.longitude,
    walkMinutes: loc.walkMinutes,
    timeSlot: timeSlots[i] || "Evening",
    tourismScore: loc.tourismScore,
  }));
}

// -------------------------------------------------------------------
// POST /api/itinerary
// -------------------------------------------------------------------
router.post("/", (req, res) => {
  const locations = req.app.locals.locations || [];
  const { preferences, neighbourhood, maxStops, startLat, startLon } = req.body;

  // ── INTEGRITY: Validate itinerary inputs ──
  const stops = Math.min(Math.max(parseInt(maxStops) || 6, 1), 15);
  const lat = typeof startLat === "number" ? startLat : DEFAULT_START.lat;
  const lon = typeof startLon === "number" ? startLon : DEFAULT_START.lon;

  const itinerary = generateItinerary(locations, {
    preferences: Array.isArray(preferences) ? preferences : [],
    neighbourhood: typeof neighbourhood === "string" ? neighbourhood : undefined,
    maxStops: stops,
    startLat: lat,
    startLon: lon,
    radiusKm: 5,
  });

  res.json({ stops: itinerary });
});

// -------------------------------------------------------------------
// POST /api/itinerary/surprise — random neighbourhood itinerary
// -------------------------------------------------------------------
router.post("/surprise", (req, res) => {
  const locations = req.app.locals.locations || [];

  // Pick a random neighbourhood that has enough locations
  const hoodCounts = {};
  for (const l of locations) {
    hoodCounts[l.neighbourhood] = (hoodCounts[l.neighbourhood] || 0) + 1;
  }
  const viableHoods = Object.entries(hoodCounts)
    .filter(([, c]) => c >= 4)
    .map(([name]) => name);

  if (viableHoods.length === 0) {
    return res.json({ stops: [], neighbourhood: null });
  }

  const hood = viableHoods[Math.floor(Math.random() * viableHoods.length)];
  const hoodLocs = locations.filter((l) => l.neighbourhood === hood);

  // Use the first location as start point
  const start = hoodLocs[0];
  const itinerary = generateItinerary(locations, {
    neighbourhood: hood,
    startLat: start.latitude,
    startLon: start.longitude,
    radiusKm: 5,
    maxStops: 5,
  });

  res.json({ stops: itinerary, neighbourhood: hood });
});

module.exports = router;
