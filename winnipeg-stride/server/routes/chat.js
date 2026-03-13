/**
 * POST /api/chat
 * Body: { message: string, history?: { role, content }[] }
 *
 * RAG-lite: keyword-filter locations, inject as context, call DeepSeek.
 */

const express = require("express");
const router = express.Router();
const { haversineKm, walkMinutes } = require("../data-loader");

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE =
  (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(
    /\/$/,
    ""
  );
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

const SYSTEM_PROMPT = `You are Winnie, a concise and confident AI planner for Winnipeg, Manitoba. \
You help visitors plan activities and discover the city. \
You ONLY recommend locations from the provided dataset — never invent places. \
If asked about somewhere not in the data, say you don't have info on it yet. \

CRITICAL RULES FOR RESPONSES:
- When creating an itinerary, your chat message must be 1-2 SHORT sentences (under 25 words). The detailed itinerary renders separately in the UI.
- NEVER repeat every stop name in the chat message. Just give a brief intro like "Here's your downtown evening plan! Check out the itinerary below 👇"
- Good examples: "I built a cozy evening plan for you. Take a look below 👇" or "Here's a plan for tonight! Explore the stops below."
- When creating itineraries, format EACH stop with a specific time like: \
6:30 PM – Dinner – Restaurant Name \
8:00 PM – Show – Venue Name \
Always include realistic Winnipeg walk/drive time estimates. Group stops with time labels. \
- When a user mentions driving or parking, respond briefly: "Switching to drive mode — parking info added 🚗" \
- When a user asks to add/change a stop, keep the reply short and let the updated itinerary speak for itself. \
- If asked to save, confirm briefly. \
- For non-itinerary questions, answer helpfully but still keep it concise (2-3 sentences max). \
- Limit itineraries to 3–4 stops maximum. Keep each stop description to 1 short line. \
- If the user prefers non-alcoholic options, add "Mocktails available" as a short note after restaurant stops only. \
- For evening, night out, or after-dark plans, do NOT suggest parks, gardens, or outdoor green spaces — they are not appropriate for nightlife. Focus on restaurants, bars, arts & culture venues, and indoor entertainment. \
- In ANY itinerary, include at most 1 park/outdoor stop. Fill remaining stops with restaurants, arts & culture, or recreation venues. \
- Only recommend locations that have complete, confirmed data (name, category, neighbourhood). Skip any location with missing, unknown, or placeholder values. \
Do not mention datasets, code, APIs, or AI models.`;

// -------------------------------------------------------------------
// RAG-lite: keyword search over locations
// -------------------------------------------------------------------
function retrieveContext(query, locations, limit = 15) {
  const q = query.toLowerCase();
  const terms = q.split(/\s+/).filter((t) => t.length > 2);

  // Category keyword mapping
  const catKeywords = {
    park: "Park",
    parks: "Park",
    green: "Park",
    outdoor: "Park",
    nature: "Park",
    restaurant: "Restaurant",
    restaurants: "Restaurant",
    food: "Restaurant",
    eat: "Restaurant",
    dining: "Restaurant",
    coffee: "Restaurant",
    lunch: "Restaurant",
    dinner: "Restaurant",
    brunch: "Restaurant",
    art: "Arts & Culture",
    arts: "Arts & Culture",
    culture: "Arts & Culture",
    museum: "Arts & Culture",
    gallery: "Arts & Culture",
    theatre: "Arts & Culture",
    recreation: "Recreation",
    sports: "Recreation",
    gym: "Recreation",
    swim: "Recreation",
    pool: "Recreation",
  };

  const isEveningQuery = ["night", "evening", "dinner", "tonight", "nightlife", "bar", "downtown evening", "night out", "date night", "fun night", "things to do tonight", "dinner and drinks"].some((kw) => q.includes(kw));

  let filtered = locations;

  // Check for category keywords — skip Park category for evening queries
  for (const term of terms) {
    if (catKeywords[term]) {
      const cat = catKeywords[term];
      if (isEveningQuery && cat === "Park") continue;
      const catFiltered = locations.filter((l) => l.category === cat);
      if (catFiltered.length > 0) {
        filtered = catFiltered;
        break;
      }
    }
  }

  // Score each location by keyword relevance
  const scored = filtered.map((loc) => {
    let score = loc.tourismScore || 0;
    const text = `${loc.name} ${loc.category} ${loc.neighbourhood}`.toLowerCase();
    for (const t of terms) {
      if (text.includes(t)) score += 20;
    }
    return { ...loc, relevance: score };
  });

  const parkLimit = isEveningQuery ? 0 : 1;

  // Separate parks from non-parks, limit parks in result
  let sorted = scored;
  if (q.includes("hidden") || q.includes("gem") || q.includes("secret")) {
    sorted = scored.sort((a, b) => (a.tourismScore || 0) - (b.tourismScore || 0));
  } else {
    sorted = scored.sort((a, b) => b.relevance - a.relevance);
  }

  const PARK_KWS = ["park", "garden", "trail", "greenspace", "green space", "arboretum"];
  const isParkLike = (l) => l.category === "Park" || PARK_KWS.some((kw) => l.name.toLowerCase().includes(kw));
  const nonParks = sorted.filter((l) => !isParkLike(l));
  const parks = sorted.filter((l) => isParkLike(l)).slice(0, parkLimit);
  const combined = [...nonParks, ...parks].sort((a, b) => b.relevance - a.relevance);

  return combined.slice(0, limit);
}

function buildContextString(locations) {
  return locations
    .map(
      (l) =>
        `• ${l.name} (${l.category}) — ${l.neighbourhood} [${l.latitude.toFixed(4)}, ${l.longitude.toFixed(4)}]`
    )
    .join("\n");
}

// -------------------------------------------------------------------
// DeepSeek API call
// -------------------------------------------------------------------
async function callDeepSeek(messages) {
  if (!DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY not configured");
  }

  const resp = await fetch(`${DEEPSEEK_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature: 0.6,
      max_tokens: 400,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`DeepSeek API ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content.trim();
}

// -------------------------------------------------------------------
// POST /api/chat
// -------------------------------------------------------------------
router.post("/", async (req, res) => {
  const { message, history } = req.body;

  // ── INTEGRITY: Validate input ──
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message must be a non-empty string" });
  }
  if (message.length > 1000) {
    return res.status(400).json({ error: "message too long (max 1000 chars)" });
  }
  if (history && !Array.isArray(history)) {
    return res.status(400).json({ error: "history must be an array" });
  }

  const locations = req.app.locals.locations || [];

  // RAG: retrieve relevant context
  const relevant = retrieveContext(message, locations);
  const contextStr = buildContextString(relevant);

  const systemMsg = `${SYSTEM_PROMPT}\n\nHere are relevant Winnipeg locations you can recommend:\n${contextStr}\n\nUse ONLY locations from this list. Do not invent new ones.`;

  // Build conversation
  const messages = [{ role: "system", content: systemMsg }];
  if (history && Array.isArray(history)) {
    for (const h of history.slice(-6)) {
      messages.push({ role: h.role, content: h.content });
    }
  }
  messages.push({ role: "user", content: message });

  try {
    const reply = await callDeepSeek(messages);
    res.json({ reply, context: relevant.map((l) => l.name) });
  } catch (err) {
    console.error("Chat error:", err.message);

    // Graceful fallback — template response
    const fallback = buildFallbackResponse(message, relevant);
    res.json({ reply: fallback, context: relevant.map((l) => l.name), offline: true });
  }
});

// -------------------------------------------------------------------
// Fallback when DeepSeek is unavailable
// -------------------------------------------------------------------
function buildFallbackResponse(query, locs) {
  if (locs.length === 0) {
    return "I'm having trouble connecting right now, but I'd love to help you explore Winnipeg! Try asking about parks, restaurants, or arts & culture.";
  }

  const q = query.toLowerCase();
  let intro = "Here are some great Winnipeg spots I'd recommend:";

  if (q.includes("plan") || q.includes("day") || q.includes("itinerary")) {
    intro = "Here's a quick itinerary idea for your Winnipeg day:";
  } else if (q.includes("food") || q.includes("restaurant") || q.includes("eat")) {
    intro = "Here are some tasty Winnipeg dining options:";
  } else if (q.includes("park") || q.includes("outdoor")) {
    intro = "Check out these Winnipeg green spaces:";
  }

  const picks = locs.slice(0, 5);
  const lines = picks.map(
    (l, i) => `${i + 1}. ${l.name} (${l.category}) — ${l.neighbourhood}`
  );

  return `${intro}\n\n${lines.join("\n")}\n\nI'm running in offline mode right now, so responses are limited. Try again in a moment for the full Winnie experience! 🌾`;
}

module.exports = router;
