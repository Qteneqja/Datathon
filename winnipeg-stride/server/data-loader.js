/**
 * CSV data loader + neighbourhood assignment + scoring.
 * Mirrors the Python pipeline (src/clean.py, src/neighbourhoods.py, src/scoring.py).
 */

const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

// Path to the Datathon data/ folder (parent of winnipeg-stride/)
const DATA_DIR = path.join(__dirname, "..", "..", "data");

// -------------------------------------------------------------------
// Neighbourhood centroids (from src/neighbourhoods.py)
// -------------------------------------------------------------------
const NEIGHBOURHOODS = [
  ["Downtown", 49.8951, -97.1384],
  ["Exchange District", 49.899, -97.137],
  ["The Forks", 49.8875, -97.1313],
  ["Osborne Village", 49.8795, -97.1438],
  ["Wolseley", 49.883, -97.186],
  ["River Heights", 49.8635, -97.17],
  ["Crescentwood", 49.868, -97.157],
  ["St. Boniface", 49.8885, -97.1165],
  ["St. Vital", 49.844, -97.112],
  ["Transcona", 49.893, -97.014],
  ["Kildonan Park", 49.936, -97.094],
  ["North Kildonan", 49.926, -97.047],
  ["West Kildonan", 49.931, -97.147],
  ["Garden City", 49.942, -97.138],
  ["Maples", 49.95, -97.156],
  ["Fort Garry", 49.831, -97.157],
  ["Whyte Ridge", 49.823, -97.201],
  ["Linden Woods", 49.835, -97.228],
  ["Charleswood", 49.855, -97.271],
  ["Tuxedo", 49.8685, -97.233],
  ["St. James", 49.892, -97.223],
  ["Polo Park", 49.881, -97.205],
  ["Corydon", 49.874, -97.159],
  ["South Osborne", 49.857, -97.137],
  ["Point Douglas", 49.91, -97.124],
  ["Elmwood", 49.905, -97.102],
  ["East Kildonan", 49.917, -97.072],
  ["Old St. Vital", 49.859, -97.112],
  ["University of Manitoba", 49.8077, -97.1365],
  ["Bridgwater", 49.81, -97.178],
  ["Sage Creek", 49.835, -97.065],
  ["Island Lakes", 49.838, -97.083],
  ["Windsor Park", 49.86, -97.088],
  ["Norwood Flats", 49.877, -97.115],
  ["River-Osborne", 49.883, -97.138],
  ["Spence", 49.893, -97.155],
  ["West End", 49.889, -97.172],
  ["Sargent Park", 49.892, -97.192],
  ["Brooklands", 49.897, -97.233],
  ["Inkster", 49.918, -97.162],
];

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function assignNeighbourhood(lat, lon) {
  let best = "Winnipeg";
  let bestDist = Infinity;
  for (const [name, nLat, nLon] of NEIGHBOURHOODS) {
    const d = haversineKm(lat, lon, nLat, nLon);
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return best;
}

function walkMinutes(lat1, lon1, lat2, lon2) {
  const km = haversineKm(lat1, lon1, lat2, lon2) * 1.3;
  return Math.round((km / 5.0) * 60);
}

// -------------------------------------------------------------------
// INTEGRITY: Validate that coordinates fall within Greater Winnipeg bounds
// Ensures Open Data datasets haven't been corrupted or tampered with
// -------------------------------------------------------------------
const WINNIPEG_BOUNDS = {
  latMin: 49.70,
  latMax: 50.05,
  lonMin: -97.40,
  lonMax: -96.90,
};

function isValidWinnipegCoord(lat, lon) {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= WINNIPEG_BOUNDS.latMin &&
    lat <= WINNIPEG_BOUNDS.latMax &&
    lon >= WINNIPEG_BOUNDS.lonMin &&
    lon <= WINNIPEG_BOUNDS.lonMax
  );
}

// -------------------------------------------------------------------
// Load a single CSV
// -------------------------------------------------------------------
function loadCSV(filename) {
  const fp = path.join(DATA_DIR, filename);
  if (!fs.existsSync(fp)) {
    console.warn(`  CSV not found: ${fp}`);
    return [];
  }
  const raw = fs.readFileSync(fp, "utf-8");
  return parse(raw, { columns: true, skip_empty_lines: true, trim: true });
}

// -------------------------------------------------------------------
// Main loader — merges all CSVs, assigns neighbourhoods, scores
// -------------------------------------------------------------------
async function loadAllLocations() {
  // Try the merged file first
  let rows = loadCSV("all_locations_merged.csv");

  if (rows.length === 0) {
    // Fall back to individual CSVs
    const parks = loadCSV("parks.csv").map((r) => ({
      name: r.park_name || r.name,
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
      category: "Park",
    }));
    const restaurants = loadCSV("restaurants.csv").map((r) => ({
      name: r.name,
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
      category: "Restaurant",
    }));
    const arts = loadCSV("arts_culture.csv").map((r) => ({
      name: r.name,
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
      category: "Arts & Culture",
    }));
    const rec = loadCSV("recreation.csv").map((r) => ({
      name: r.name,
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
      category: "Recreation",
    }));
    rows = [...parks, ...restaurants, ...arts, ...rec];
  }

  // Normalize and enrich — INTEGRITY: validate coordinates
  const locations = rows
    .map((r, i) => ({
      id: i + 1,
      name: String(r.name || "Unknown").slice(0, 200),
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
      category: r.category || "Other",
    }))
    .filter((r) => isValidWinnipegCoord(r.latitude, r.longitude));

  console.log(`  Validated ${locations.length} locations within Winnipeg bounds`);

  // Assign neighbourhoods
  for (const loc of locations) {
    loc.neighbourhood = assignNeighbourhood(loc.latitude, loc.longitude);
  }

  // Simple popularity score (cluster density within 500m)
  for (const loc of locations) {
    let nearby = 0;
    const cats = new Set();
    for (const other of locations) {
      if (other.id === loc.id) continue;
      const d = haversineKm(loc.latitude, loc.longitude, other.latitude, other.longitude);
      if (d <= 0.5) {
        nearby++;
        cats.add(other.category);
      }
    }
    loc.tourismScore = Math.min(100, Math.round(nearby * 2 + cats.size * 10));
  }

  return locations;
}

module.exports = { loadAllLocations, haversineKm, assignNeighbourhood, walkMinutes, NEIGHBOURHOODS, isValidWinnipegCoord };
