/**
 * GET /api/locations
 * Query params: ?category=Park&neighbourhood=The+Forks&search=assiniboine
 */

const express = require("express");
const router = express.Router();
const { haversineKm, NEIGHBOURHOODS } = require("../data-loader");

router.get("/", (req, res) => {
  let locs = req.app.locals.locations || [];
  const { category, neighbourhood, search, lat, lon, radius } = req.query;

  if (category && category !== "All") {
    locs = locs.filter((l) => l.category === category);
  }
  if (neighbourhood) {
    locs = locs.filter((l) => l.neighbourhood === neighbourhood);
  }
  if (search) {
    const q = search.toLowerCase();
    locs = locs.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q) ||
        l.neighbourhood.toLowerCase().includes(q)
    );
  }
  if (lat && lon) {
    const refLat = parseFloat(lat);
    const refLon = parseFloat(lon);
    const r = parseFloat(radius) || 3;
    locs = locs
      .map((l) => ({
        ...l,
        distanceKm: haversineKm(refLat, refLon, l.latitude, l.longitude),
      }))
      .filter((l) => l.distanceKm <= r)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  res.json(locs);
});

// GET /api/locations/neighbourhoods — list of neighbourhood names
router.get("/neighbourhoods", (_req, res) => {
  res.json(NEIGHBOURHOODS.map(([name]) => name));
});

// GET /api/locations/categories — distinct categories
router.get("/categories", (req, res) => {
  const locs = req.app.locals.locations || [];
  const cats = [...new Set(locs.map((l) => l.category))].sort();
  res.json(cats);
});

// GET /api/locations/stats — for the analytics demo
router.get("/stats", (req, res) => {
  const locs = req.app.locals.locations || [];
  const byCat = {};
  const byHood = {};
  for (const l of locs) {
    byCat[l.category] = (byCat[l.category] || 0) + 1;
    byHood[l.neighbourhood] = (byHood[l.neighbourhood] || 0) + 1;
  }
  const topHoods = Object.entries(byHood)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const avgScore =
    locs.length > 0
      ? Math.round(locs.reduce((s, l) => s + (l.tourismScore || 0), 0) / locs.length)
      : 0;

  res.json({
    total: locs.length,
    byCategory: byCat,
    topNeighbourhoods: topHoods,
    avgTourismScore: avgScore,
  });
});

module.exports = router;
