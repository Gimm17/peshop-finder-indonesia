require("dotenv").config();
const express = require("express");
const https = require("https");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

/* ── In-memory cache ──────────────────────────────────────── */
const cache = new Map();
const CACHE_TTL_SEARCH = 10 * 60 * 1000; // 10 minutes
const CACHE_TTL_DETAILS = 30 * 60 * 1000; // 30 minutes

function getCached(key, ttl) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

// Cleanup old entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (now - entry.ts > CACHE_TTL_DETAILS) cache.delete(key);
    }
  },
  5 * 60 * 1000,
);

/* ── Google API helper ────────────────────────────────────── */
function googleGet(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error("Invalid JSON from Google API"));
          }
        });
      })
      .on("error", reject);
  });
}

/* ── Static files ─────────────────────────────────────────── */
app.use(express.static(path.join(__dirname)));

/* ── Frontend Config ──────────────────────────────────────── */
app.get("/config.js", (req, res) => {
  const config = {
    defaultCenter: { lat: -2.5, lng: 118.0 },
    defaultZoom: 5,
    googleMapsApiKey: API_KEY,
  };
  res.type("application/javascript");
  res.send(`window.APP_CONFIG = ${JSON.stringify(config)};`);
});

/* ── API: Search petshops ─────────────────────────────────── */
app.get("/api/petshops", async (req, res) => {
  try {
    const { lat, lng, radius = 5000 } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: "lat and lng are required" });
    }

    const cacheKey = `search:${Number(lat).toFixed(3)},${Number(lng).toFixed(3)},${radius}`;
    const cached = getCached(cacheKey, CACHE_TTL_SEARCH);
    if (cached) {
      console.log(`[cache hit] ${cacheKey}`);
      return res.json({ places: cached, source: "cache" });
    }

    console.log(
      `[api call] textSearch + nearbySearch @ ${lat},${lng} r=${radius}`,
    );

    const places = [];
    const seen = new Set();

    // textSearch
    const textUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=petshop&location=${lat},${lng}&radius=${radius}&key=${API_KEY}`;
    const textResult = await googleGet(textUrl);

    if (textResult.results) {
      textResult.results.forEach((item) => {
        if (seen.has(item.place_id)) return;
        seen.add(item.place_id);
        places.push(extractPlace(item));
      });
    }

    // nearbySearch
    const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&keyword=petshop&type=pet_store&key=${API_KEY}`;
    const nearbyResult = await googleGet(nearbyUrl);

    if (nearbyResult.results) {
      nearbyResult.results.forEach((item) => {
        if (seen.has(item.place_id)) return;
        seen.add(item.place_id);
        places.push(extractPlace(item));
      });
    }

    setCache(cacheKey, places);
    console.log(`[result] ${places.length} petshops found`);
    res.json({ places, source: "google" });
  } catch (err) {
    console.error("[error] /api/petshops:", err.message);
    res.status(500).json({ error: "Failed to fetch petshops" });
  }
});

/* ── API: Place Details ───────────────────────────────────── */
app.get("/api/petshop/:placeId", async (req, res) => {
  try {
    const { placeId } = req.params;
    if (!placeId) {
      return res.status(400).json({ error: "placeId is required" });
    }

    const cacheKey = `detail:${placeId}`;
    const cached = getCached(cacheKey, CACHE_TTL_DETAILS);
    if (cached) {
      console.log(`[cache hit] ${cacheKey}`);
      return res.json({ detail: cached, source: "cache" });
    }

    console.log(`[api call] placeDetails: ${placeId}`);

    const fields =
      "name,formatted_address,formatted_phone_number,website,opening_hours,rating,user_ratings_total,geometry,types,photos";
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${API_KEY}`;
    const result = await googleGet(url);

    if (result.status !== "OK" || !result.result) {
      return res.status(404).json({ error: "Place not found" });
    }

    const r = result.result;
    const detail = {
      placeId,
      name: r.name,
      address: r.formatted_address,
      phone: r.formatted_phone_number || null,
      website: r.website || null,
      rating: r.rating || null,
      userRatingsTotal: r.user_ratings_total || 0,
      types: r.types || [],
      openNow: r.opening_hours?.open_now ?? null,
      weekdayText: r.opening_hours?.weekday_text || [],
      periods: r.opening_hours?.periods || [],
      photoRef: r.photos?.[0]?.photo_reference || null,
    };

    setCache(cacheKey, detail);
    res.json({ detail, source: "google" });
  } catch (err) {
    console.error("[error] /api/petshop:", err.message);
    res.status(500).json({ error: "Failed to fetch place details" });
  }
});

/* ── API: Place photo proxy ───────────────────────────────── */
app.get("/api/photo", (req, res) => {
  const { ref, maxwidth = 400 } = req.query;
  if (!ref) return res.status(400).send("ref is required");

  const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${ref}&key=${API_KEY}`;

  https
    .get(photoUrl, (proxyRes) => {
      // Google redirects to the actual image
      if (
        proxyRes.statusCode >= 300 &&
        proxyRes.statusCode < 400 &&
        proxyRes.headers.location
      ) {
        return res.redirect(proxyRes.headers.location);
      }
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    })
    .on("error", () => {
      res.status(500).send("Photo fetch failed");
    });
});

/* ── Helper ───────────────────────────────────────────────── */
function extractPlace(item) {
  const loc = item.geometry?.location || {};
  return {
    id: item.place_id,
    placeId: item.place_id,
    name: item.name,
    lat: loc.lat,
    lng: loc.lng,
    rating: item.rating ?? null,
    userRatingsTotal: item.user_ratings_total ?? 0,
    address: item.formatted_address || item.vicinity || "Alamat tidak tersedia",
    openNow: item.opening_hours?.open_now ?? null,
    types: item.types || [],
    source: "google",
  };
}

/* ── Start ────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n🐾 Petshop Finder server running at http://localhost:${PORT}`);
  console.log(
    `   API key: ${API_KEY ? "✅ loaded" : "❌ MISSING — set GOOGLE_MAPS_API_KEY in .env"}`,
  );
  console.log(
    `   Cache TTL: search=${CACHE_TTL_SEARCH / 60000}min, details=${CACHE_TTL_DETAILS / 60000}min\n`,
  );
});
