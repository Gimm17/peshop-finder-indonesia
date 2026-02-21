(() => {
  const CONFIG = {
    ...((window && window.APP_CONFIG) || {}),
    defaultCenter: (window.APP_CONFIG || {}).defaultCenter || {
      lat: -2.5,
      lng: 118.0,
    },
    defaultZoom: (window.APP_CONFIG || {}).defaultZoom || 5,
  };

  const INDONESIA_CENTER = {
    lat: CONFIG.defaultCenter.lat,
    lng: CONFIG.defaultCenter.lng,
  };
  const DEFAULT_RADIUS_M = 5000;
  const LOCAL_CACHE_KEY = "petshop_finder_cache_v2";
  const LOCAL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /* ── Dark map style ──────────────────────────────────────── */
  const MAP_STYLES = [
    { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
    {
      featureType: "administrative.country",
      elementType: "geometry.stroke",
      stylers: [{ color: "#4b6878" }],
    },
    {
      featureType: "administrative.province",
      elementType: "geometry.stroke",
      stylers: [{ color: "#4b6878" }],
    },
    {
      featureType: "landscape.man_made",
      elementType: "geometry.stroke",
      stylers: [{ color: "#334e87" }],
    },
    {
      featureType: "landscape.natural",
      elementType: "geometry",
      stylers: [{ color: "#023e58" }],
    },
    {
      featureType: "poi",
      elementType: "geometry",
      stylers: [{ color: "#283d6a" }],
    },
    {
      featureType: "poi",
      elementType: "labels.text.fill",
      stylers: [{ color: "#6f9ba5" }],
    },
    {
      featureType: "poi.park",
      elementType: "geometry.fill",
      stylers: [{ color: "#023e58" }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#304a7d" }],
    },
    {
      featureType: "road",
      elementType: "labels.text.fill",
      stylers: [{ color: "#98a5be" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry",
      stylers: [{ color: "#2c6675" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry.stroke",
      stylers: [{ color: "#255763" }],
    },
    {
      featureType: "transit",
      elementType: "labels.text.fill",
      stylers: [{ color: "#98a5be" }],
    },
    {
      featureType: "water",
      elementType: "geometry.fill",
      stylers: [{ color: "#0e1626" }],
    },
    {
      featureType: "water",
      elementType: "labels.text.fill",
      stylers: [{ color: "#4e6d70" }],
    },
  ];

  /* ── Filter keywords ─────────────────────────────────────── */
  const FILTER_KEYWORDS = {
    grooming: ["grooming", "groom", "salon", "mandi", "potong bulu"],
    hotel: ["hotel", "boarding", "penitipan", "titip"],
    vaksin: [
      "vaksin",
      "klinik",
      "vet",
      "veteriner",
      "dokter hewan",
      "animal clinic",
    ],
    food: [
      "food",
      "makanan",
      "pakan",
      "pet food",
      "petfood",
      "shop",
      "store",
      "toko",
    ],
  };

  /* ── State ───────────────────────────────────────────────── */
  const state = {
    map: null,
    markers: [],
    markersById: new Map(),
    userMarker: null,
    userAccuracyCircle: null,
    directionsService: null,
    directionsRenderer: null,
    infoWindow: null,
    places: [],
    filteredPlaces: [],
    selectedPlaceId: "",
    userLocation: null,
    usingUserLocation: false,
    lastDataSource: "Google Maps",
    googleReady: false,
    activeFilter: "all",
    detailsCache: new Map(),
    deferredInstallPrompt: null,
  };

  const els = {};

  /* ── Boot ─────────────────────────────────────────────────── */
  document.addEventListener("DOMContentLoaded", () => {
    cacheEls();
    setupPWA();
    setupInstallPrompt();
    loadGoogleMaps();
  });

  function loadGoogleMaps() {
    const apiKey = (CONFIG.googleMapsApiKey || "").trim();
    if (!apiKey) {
      setStatus("Memuat tanpa Google Maps...", "loading");
      return;
    }
    if (window.google?.maps) {
      onGoogleMapsReady();
      return;
    }

    window.__onGoogleMapsLoaded = onGoogleMapsReady;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=__onGoogleMapsLoaded`;
    script.async = true;
    script.defer = true;
    script.onerror = () => setStatus("Gagal memuat Google Maps.", "error");
    document.head.appendChild(script);
  }

  function onGoogleMapsReady() {
    state.googleReady = true;
    initMap();
    bindEvents();

    setUserLocation({
      lat: INDONESIA_CENTER.lat,
      lng: INDONESIA_CENTER.lng,
      accuracy: null,
      isApproximate: true,
    });
    requestUserLocation({ silent: true, reloadAfter: true });
    loadPetshops({ silentStatus: false });
  }

  function cacheEls() {
    [
      "locateBtn",
      "refreshDataBtn",
      "radiusSelect",
      "searchInput",
      "sortSelect",
      "fitAllBtn",
      "statusBadge",
      "sourceInfo",
      "totalPetshopCount",
      "nearestPetshopName",
      "nearestPetshopDistance",
      "popularPetshopName",
      "popularPetshopMeta",
      "showNearestRouteBtn",
      "showPopularRouteBtn",
      "petshopDropdown",
      "confirmButton",
      "cancelButton",
      "clearSelectionBtn",
      "petshopDetail",
      "petshopList",
      "listCountBadge",
      "locationLabel",
      "filterBar",
      "installBanner",
      "installBtn",
      "dismissInstall",
    ].forEach((id) => {
      els[id] = document.getElementById(id);
    });
  }

  /* ── PWA ──────────────────────────────────────────────────── */
  function setupPWA() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {
          console.log("Service Worker registered");
        })
        .catch((err) => console.warn("SW registration failed:", err));
    }
  }

  function setupInstallPrompt() {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      state.deferredInstallPrompt = e;
      if (els.installBanner) els.installBanner.classList.remove("hidden");
    });

    if (els.installBtn) {
      els.installBtn.addEventListener("click", async () => {
        if (!state.deferredInstallPrompt) return;
        state.deferredInstallPrompt.prompt();
        const result = await state.deferredInstallPrompt.userChoice;
        console.log("Install:", result.outcome);
        state.deferredInstallPrompt = null;
        if (els.installBanner) els.installBanner.classList.add("hidden");
      });
    }

    if (els.dismissInstall) {
      els.dismissInstall.addEventListener("click", () => {
        if (els.installBanner) els.installBanner.classList.add("hidden");
      });
    }
  }

  /* ── Google Map Init ─────────────────────────────────────── */
  function initMap() {
    state.map = new google.maps.Map(document.getElementById("map"), {
      center: INDONESIA_CENTER,
      zoom: CONFIG.defaultZoom,
      styles: MAP_STYLES,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      gestureHandling: "greedy",
    });

    state.infoWindow = new google.maps.InfoWindow();

    state.directionsService = new google.maps.DirectionsService();
    state.directionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: "#f59e0b",
        strokeWeight: 5,
        strokeOpacity: 0.9,
      },
    });
    state.directionsRenderer.setMap(state.map);
  }

  /* ── Events ──────────────────────────────────────────────── */
  function bindEvents() {
    els.locateBtn.addEventListener("click", () =>
      requestUserLocation({ silent: false, reloadAfter: true }),
    );
    els.refreshDataBtn.addEventListener("click", () =>
      loadPetshops({ forceRefresh: true }),
    );
    els.radiusSelect.addEventListener("change", () => loadPetshops());
    els.searchInput.addEventListener("input", filterSortAndRender);
    els.sortSelect.addEventListener("change", filterSortAndRender);
    els.fitAllBtn.addEventListener("click", fitAllMarkers);

    els.showNearestRouteBtn.addEventListener("click", () => {
      const nearest = getNearestPlace(
        state.filteredPlaces.length ? state.filteredPlaces : state.places,
      );
      if (!nearest) return setStatus("Tidak ada data petshop.", "error");
      selectPlace(nearest.id, { pan: true });
      drawRouteToPlace(nearest);
    });

    els.showPopularRouteBtn.addEventListener("click", () => {
      const popular = getMostPopularPlace(
        state.filteredPlaces.length ? state.filteredPlaces : state.places,
      );
      if (!popular) return setStatus("Tidak ada data petshop.", "error");
      selectPlace(popular.id, { pan: true });
      drawRouteToPlace(popular);
    });

    els.petshopDropdown.addEventListener("change", (e) => {
      if (!e.target.value) return;
      selectPlace(e.target.value, { pan: false });
    });

    els.confirmButton.addEventListener("click", () => {
      const id = els.petshopDropdown.value;
      if (!id) return setStatus("Pilih petshop dulu.", "error");
      const place = state.places.find((p) => p.id === id);
      if (!place) return;
      selectPlace(id, { pan: true });
      drawRouteToPlace(place);
    });

    els.cancelButton.addEventListener("click", () => {
      clearRoute();
      setStatus("Rute dihapus.", "ok");
    });

    els.clearSelectionBtn.addEventListener("click", clearSelection);

    // Filter tags
    if (els.filterBar) {
      els.filterBar.addEventListener("click", (e) => {
        const tag = e.target.closest(".filter-tag");
        if (!tag) return;
        const filter = tag.dataset.filter;
        state.activeFilter = filter;
        els.filterBar
          .querySelectorAll(".filter-tag")
          .forEach((t) =>
            t.classList.toggle("active", t.dataset.filter === filter),
          );
        filterSortAndRender();
      });
    }
  }

  /* ── Data Loading (via backend proxy) ────────────────────── */
  async function loadPetshops({
    silentStatus = false,
    forceRefresh = false,
  } = {}) {
    const radius = Number(els.radiusSelect.value || DEFAULT_RADIUS_M);
    const center = state.userLocation || INDONESIA_CENTER;

    if (!silentStatus) setStatus("Memuat data petshop...", "loading");

    let places = [];
    let source = "Google Maps";

    // Check localStorage cache first
    if (!forceRefresh) {
      const cached = getLocalCache(center, radius);
      if (cached) {
        places = cached;
        source = "cache (lokal)";
      }
    }

    if (!places.length) {
      try {
        const res = await fetch(
          `/api/petshops?lat=${center.lat}&lng=${center.lng}&radius=${radius}`,
        );
        const data = await res.json();
        if (data.places && data.places.length) {
          places = data.places;
          source =
            data.source === "cache"
              ? "Google Maps (server cache)"
              : "Google Maps (Places API)";
          setLocalCache(center, radius, places);
        }
      } catch (err) {
        console.warn("Backend API gagal:", err);
      }
    }

    if (!places.length) {
      source = "Tidak ada petshop ditemukan";
    }

    state.lastDataSource = source;
    let normalized = normalizePlaces(places);

    // Strict distance filter: only keep places within selected radius
    if (state.userLocation && !state.userLocation.isApproximate) {
      normalized = normalized.filter((p) => {
        if (p.distanceMeters == null) return false;
        return p.distanceMeters <= radius;
      });
    }

    state.places = normalized;

    renderMarkers();
    filterSortAndRender();
    setSourceInfo(source);
    setStatus(
      state.places.length
        ? `${state.places.length} petshop dimuat dalam radius ${radius >= 1000 ? radius / 1000 + " km" : radius + " m"} (${source}).`
        : "Tidak ada petshop dalam radius ini. Coba perbesar radius.",
      state.places.length ? "ok" : "error",
    );
  }

  /* ── localStorage cache ──────────────────────────────────── */
  function getLocalCache(center, radius) {
    try {
      const raw = localStorage.getItem(LOCAL_CACHE_KEY);
      if (!raw) return null;
      const cache = JSON.parse(raw);
      const key = `${Number(center.lat).toFixed(3)},${Number(center.lng).toFixed(3)},${radius}`;
      const entry = cache[key];
      if (!entry) return null;
      if (Date.now() - entry.ts > LOCAL_CACHE_TTL) return null;
      return entry.data;
    } catch {
      return null;
    }
  }

  function setLocalCache(center, radius, data) {
    try {
      const key = `${Number(center.lat).toFixed(3)},${Number(center.lng).toFixed(3)},${radius}`;
      let cache = {};
      try {
        cache = JSON.parse(localStorage.getItem(LOCAL_CACHE_KEY) || "{}");
      } catch {}
      cache[key] = { data, ts: Date.now() };
      // Keep only last 5 entries
      const keys = Object.keys(cache);
      if (keys.length > 5) {
        keys.sort((a, b) => cache[a].ts - cache[b].ts);
        keys.slice(0, keys.length - 5).forEach((k) => delete cache[k]);
      }
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cache));
    } catch {}
  }

  function normalizePlaces(places) {
    const seen = new Set();
    const userLoc = state.userLocation;

    return places
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.name)
      .map((p, idx) => {
        const id = p.id || p.placeId || `${slugify(p.name)}-${idx}`;
        const dedupeKey = `${slugify(p.name)}|${round(p.lat, 5)}|${round(p.lng, 5)}`;
        return {
          id,
          dedupeKey,
          name: p.name,
          lat: Number(p.lat),
          lng: Number(p.lng),
          rating:
            p.rating === null ||
            p.rating === undefined ||
            Number.isNaN(Number(p.rating))
              ? null
              : Number(p.rating),
          userRatingsTotal: Number(p.userRatingsTotal || 0),
          address: p.address || p.vicinity || "Alamat tidak tersedia",
          openNow: typeof p.openNow === "boolean" ? p.openNow : null,
          placeId: p.placeId || null,
          types: p.types || [],
          source: p.source || "google",
          distanceMeters: userLoc ? haversineMeters(userLoc, p) : null,
          popularityScore: computePopularityScore(p),
        };
      })
      .filter((p) => {
        if (seen.has(p.dedupeKey)) return false;
        seen.add(p.dedupeKey);
        return true;
      });
  }

  /* ── Markers ─────────────────────────────────────────────── */
  function renderMarkers() {
    state.markers.forEach((m) => m.setMap(null));
    state.markers = [];
    state.markersById.clear();

    // SVG cat face marker icon
    const CAT_SVG =
      encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 56" width="48" height="56">
      <path d="M24 52 C24 52,6 36,6 22 A18 18 0 0 1 42 22 C42 36,24 52,24 52Z" fill="#f59e0b" stroke="#fff" stroke-width="2"/>
      <circle cx="24" cy="22" r="13" fill="#1f2937"/>
      <polygon points="14,12 11,1 19,8" fill="#1f2937" stroke="#f59e0b" stroke-width="1.5"/>
      <polygon points="34,12 37,1 29,8" fill="#1f2937" stroke="#f59e0b" stroke-width="1.5"/>
      <ellipse cx="19" cy="19" rx="2.5" ry="3" fill="#6ee7b7"/>
      <ellipse cx="29" cy="19" rx="2.5" ry="3" fill="#6ee7b7"/>
      <circle cx="19" cy="19" r="1.2" fill="#111"/>
      <circle cx="29" cy="19" r="1.2" fill="#111"/>
      <ellipse cx="24" cy="24" rx="2" ry="1.5" fill="#fca5a5"/>
      <path d="M22 26 Q24 28 26 26" stroke="#9ca3af" stroke-width="1" fill="none"/>
      <line x1="10" y1="21" x2="17" y2="22" stroke="#9ca3af" stroke-width="0.8"/>
      <line x1="10" y1="25" x2="17" y2="24" stroke="#9ca3af" stroke-width="0.8"/>
      <line x1="38" y1="21" x2="31" y2="22" stroke="#9ca3af" stroke-width="0.8"/>
      <line x1="38" y1="25" x2="31" y2="24" stroke="#9ca3af" stroke-width="0.8"/>
    </svg>`);
    const catIcon = {
      url: `data:image/svg+xml,${CAT_SVG}`,
      scaledSize: new google.maps.Size(38, 44),
      anchor: new google.maps.Point(19, 44),
    };

    state.places.forEach((place) => {
      const marker = new google.maps.Marker({
        position: { lat: place.lat, lng: place.lng },
        map: state.map,
        title: place.name,
        icon: catIcon,
      });

      marker.addListener("click", () => {
        selectPlace(place.id, { pan: false });
        state.infoWindow.setContent(buildPopupHtml(place));
        state.infoWindow.open(state.map, marker);
      });

      state.markers.push(marker);
      state.markersById.set(place.id, marker);
    });

    updateUserMarker();
  }

  function updateUserMarker() {
    if (!state.map || !state.userLocation) return;
    if (state.userMarker) state.userMarker.setMap(null);
    if (state.userAccuracyCircle) state.userAccuracyCircle.setMap(null);

    const { lat, lng, accuracy, isApproximate } = state.userLocation;

    state.userMarker = new google.maps.Marker({
      position: { lat, lng },
      map: state.map,
      title: isApproximate ? "Titik awal (perkiraan)" : "Lokasi kamu",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#3b82f6",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3,
      },
      zIndex: 999,
    });

    state.userMarker.addListener("click", () => {
      state.infoWindow.setContent(
        isApproximate
          ? "<div style='padding:4px'><b>Titik awal</b><br>Lokasi perkiraan</div>"
          : "<div style='padding:4px'><b>Lokasi kamu</b><br>GPS aktif</div>",
      );
      state.infoWindow.open(state.map, state.userMarker);
    });

    if (accuracy && Number.isFinite(accuracy)) {
      state.userAccuracyCircle = new google.maps.Circle({
        center: { lat, lng },
        radius: Math.min(accuracy, 300),
        strokeColor: "#3b82f6",
        strokeOpacity: 0.3,
        strokeWeight: 1,
        fillColor: "#3b82f6",
        fillOpacity: 0.08,
        map: state.map,
      });
    }
  }

  /* ── Filter, Sort, Render ────────────────────────────────── */
  function filterSortAndRender() {
    const q = (els.searchInput.value || "").trim().toLowerCase();
    const sortBy = els.sortSelect.value || "nearest";
    const activeFilter = state.activeFilter || "all";

    let items = state.places.filter((p) => {
      // Text search
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !(p.address || "").toLowerCase().includes(q)
      )
        return false;

      // Service filter
      if (activeFilter !== "all") {
        const keywords = FILTER_KEYWORDS[activeFilter] || [];
        const nameAddr = (
          p.name +
          " " +
          (p.address || "") +
          " " +
          (p.types || []).join(" ")
        ).toLowerCase();
        if (!keywords.some((kw) => nameAddr.includes(kw))) return false;
      }

      return true;
    });

    items.sort((a, b) => comparePlaces(a, b, sortBy));
    state.filteredPlaces = items;

    renderPetshopList(items);
    populateDropdown(items);
    updateStats(items);

    // Update marker visibility
    state.markersById.forEach((marker, id) => {
      const visible = items.some((p) => p.id === id);
      marker.setVisible(visible);
    });
  }

  function comparePlaces(a, b, sortBy) {
    switch (sortBy) {
      case "popular":
        return (
          (b.popularityScore || 0) - (a.popularityScore || 0) ||
          nameCompare(a, b)
        );
      case "rating":
        return (b.rating ?? -1) - (a.rating ?? -1) || nameCompare(a, b);
      case "reviews":
        return (
          (b.userRatingsTotal || 0) - (a.userRatingsTotal || 0) ||
          nameCompare(a, b)
        );
      case "name":
        return nameCompare(a, b);
      default:
        return (
          (a.distanceMeters ?? Number.MAX_SAFE_INTEGER) -
            (b.distanceMeters ?? Number.MAX_SAFE_INTEGER) || nameCompare(a, b)
        );
    }
  }

  function nameCompare(a, b) {
    return a.name.localeCompare(b.name, "id");
  }

  function renderPetshopList(items) {
    els.petshopList.innerHTML = "";
    els.listCountBadge.textContent = `${items.length} item`;
    els.totalPetshopCount.textContent = String(items.length);

    if (!items.length) {
      els.petshopList.innerHTML =
        '<div class="empty-list">Tidak ada petshop yang cocok dengan filter saat ini.</div>';
      if (!state.selectedPlaceId) renderDetail(null);
      return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach((place) => {
      const item = document.createElement("div");
      item.className = `list-item${state.selectedPlaceId === place.id ? " active" : ""}`;
      item.dataset.placeId = place.id;

      const ratingText = place.rating
        ? `⭐ ${place.rating.toFixed(1)}`
        : "⭐ -";
      const reviewsText = `${place.userRatingsTotal || 0} review`;
      const distText =
        place.distanceMeters != null
          ? formatDistance(place.distanceMeters)
          : "-";
      const statusBadge =
        place.openNow === true
          ? '<span class="open-badge open">Buka</span>'
          : place.openNow === false
            ? '<span class="open-badge closed">Tutup</span>'
            : '<span class="open-badge unknown">Jam ?</span>';

      item.innerHTML = `
        <div class="list-item-top">
          <h3 class="list-item-title">${escapeHtml(place.name)}</h3>
          ${statusBadge}
        </div>
        <div class="list-item-tags">
          <span class="tag star">${ratingText}</span>
          <span class="tag">${reviewsText}</span>
          <span class="tag dist">${distText}</span>
        </div>
        <div class="list-item-address">${escapeHtml(place.address || "Alamat tidak tersedia")}</div>
      `;

      item.addEventListener("click", () =>
        selectPlace(place.id, { pan: true }),
      );
      fragment.appendChild(item);
    });
    els.petshopList.appendChild(fragment);
  }

  function populateDropdown(items) {
    const prev = els.petshopDropdown.value;
    els.petshopDropdown.innerHTML =
      '<option value="">-- Pilih petshop --</option>';
    items.forEach((p) => {
      const option = document.createElement("option");
      option.value = p.id;
      option.textContent =
        p.distanceMeters != null
          ? `${p.name} (${formatDistance(p.distanceMeters)})`
          : p.name;
      els.petshopDropdown.appendChild(option);
    });
    if (items.some((p) => p.id === prev)) els.petshopDropdown.value = prev;
    else if (items.some((p) => p.id === state.selectedPlaceId))
      els.petshopDropdown.value = state.selectedPlaceId;
  }

  function updateStats(items) {
    const nearest = getNearestPlace(items);
    const popular = getMostPopularPlace(items);
    els.nearestPetshopName.textContent = nearest ? nearest.name : "-";
    els.nearestPetshopDistance.textContent =
      nearest?.distanceMeters != null
        ? formatDistance(nearest.distanceMeters)
        : "-";
    els.popularPetshopName.textContent = popular ? popular.name : "-";
    els.popularPetshopMeta.textContent = popular
      ? `${popular.rating ? popular.rating.toFixed(1) : "-"} • ${popular.userRatingsTotal || 0} review`
      : "-";
  }

  function getNearestPlace(items) {
    if (!items?.length) return null;
    return [...items].sort(
      (a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity),
    )[0];
  }

  function getMostPopularPlace(items) {
    if (!items?.length) return null;
    return [...items].sort(
      (a, b) => (b.popularityScore || 0) - (a.popularityScore || 0),
    )[0];
  }

  /* ── Selection & Detail ──────────────────────────────────── */
  function selectPlace(id, { pan = true } = {}) {
    const place = state.places.find((p) => p.id === id);
    if (!place) return;

    state.selectedPlaceId = id;
    els.petshopDropdown.value = id;
    renderDetail(place);
    syncListActiveItem();

    const marker = state.markersById.get(id);
    if (marker) {
      if (pan) {
        state.map.panTo({ lat: place.lat, lng: place.lng });
        if (state.map.getZoom() < 14) state.map.setZoom(14);
      }
      state.infoWindow.setContent(buildPopupHtml(place));
      state.infoWindow.open(state.map, marker);
    }

    // Fetch detailed info from backend
    if (place.placeId) fetchPlaceDetails(place.placeId);
  }

  function clearSelection() {
    state.selectedPlaceId = "";
    els.petshopDropdown.value = "";
    renderDetail(null);
    syncListActiveItem();
    state.infoWindow.close();
  }

  async function fetchPlaceDetails(placeId) {
    // Check local cache
    if (state.detailsCache.has(placeId)) {
      applyDetails(placeId, state.detailsCache.get(placeId));
      return;
    }

    try {
      const res = await fetch(`/api/petshop/${placeId}`);
      const data = await res.json();
      if (data.detail) {
        state.detailsCache.set(placeId, data.detail);
        applyDetails(placeId, data.detail);
      }
    } catch (err) {
      console.warn("Detail fetch failed:", err);
    }
  }

  function applyDetails(placeId, detail) {
    // Only update if still selected
    if (state.selectedPlaceId !== placeId) return;

    const place = state.places.find((p) => p.id === placeId);
    if (!place) return;

    // Update place data
    if (detail.openNow !== null && detail.openNow !== undefined)
      place.openNow = detail.openNow;
    if (detail.phone) place.phone = detail.phone;
    if (detail.website) place.website = detail.website;
    if (detail.weekdayText) place.weekdayText = detail.weekdayText;
    if (detail.photoRef) place.photoRef = detail.photoRef;
    if (detail.types) place.types = detail.types;

    renderDetail(place);
  }

  function renderDetail(place) {
    if (!place) {
      els.petshopDetail.className = "detail-empty";
      els.petshopDetail.textContent =
        "Pilih marker atau item petshop untuk melihat detail.";
      return;
    }

    els.petshopDetail.className = "detail-content";
    const distanceText =
      place.distanceMeters != null ? formatDistance(place.distanceMeters) : "-";
    const ratingText = place.rating != null ? place.rating.toFixed(1) : "-";
    const reviewsText = place.userRatingsTotal || 0;
    const statusClass =
      place.openNow === true
        ? "status-open"
        : place.openNow === false
          ? "status-closed"
          : "status-unknown";
    const statusText =
      place.openNow === null
        ? "Tidak diketahui"
        : place.openNow
          ? "Sedang buka"
          : "Sedang tutup";
    const mapsLink = buildGoogleMapsLink(place);
    const navLink = buildNavigationLink(place);

    // Photo
    const photoHtml = place.photoRef
      ? `<div class="detail-photo"><img src="/api/photo?ref=${encodeURIComponent(place.photoRef)}&maxwidth=400" alt="${escapeHtml(place.name)}" /></div>`
      : "";

    // Opening hours
    let hoursHtml = "";
    if (place.weekdayText && place.weekdayText.length) {
      hoursHtml = `
        <div class="hours-section">
          <button class="hours-toggle" onclick="this.parentElement.classList.toggle('expanded')">
            🕐 Jam Buka <span class="toggle-arrow">▸</span>
          </button>
          <div class="hours-list">
            ${place.weekdayText.map((line) => `<div class="hours-line">${escapeHtml(line)}</div>`).join("")}
          </div>
        </div>
      `;
    }

    // Contact
    let contactHtml = "";
    if (place.phone || place.website) {
      contactHtml = '<div class="detail-contact">';
      if (place.phone)
        contactHtml += `<a href="tel:${place.phone}" class="contact-link">📞 ${escapeHtml(place.phone)}</a>`;
      if (place.website)
        contactHtml += `<a href="${escapeHtml(place.website)}" target="_blank" rel="noopener" class="contact-link">🌐 Website</a>`;
      contactHtml += "</div>";
    }

    els.petshopDetail.innerHTML = `
      ${photoHtml}
      <h3>${escapeHtml(place.name)}</h3>
      <div class="detail-meta">
        <div class="meta-row"><span>Jarak</span><strong>${distanceText}</strong></div>
        <div class="meta-row"><span>Rating</span><strong>${ratingText}</strong></div>
        <div class="meta-row"><span>Review</span><strong>${reviewsText}</strong></div>
        <div class="meta-row"><span>Status</span><strong class="${statusClass}">${escapeHtml(statusText)}</strong></div>
      </div>
      ${hoursHtml}
      <p class="address">${escapeHtml(place.address || "Alamat tidak tersedia")}</p>
      ${contactHtml}
      <div class="detail-actions-3">
        <button id="detailRouteBtn" class="btn btn-primary">🧭 Rute</button>
        <a class="btn btn-outline" href="${navLink}" target="_blank" rel="noopener">🚗 Navigasi</a>
        <a class="btn btn-outline" href="${mapsLink}" target="_blank" rel="noopener">📍 Maps</a>
      </div>
    `;

    document
      .getElementById("detailRouteBtn")
      ?.addEventListener("click", () => drawRouteToPlace(place));
  }

  function syncListActiveItem() {
    els.petshopList.querySelectorAll(".list-item").forEach((item) => {
      item.classList.toggle(
        "active",
        item.dataset.placeId === state.selectedPlaceId,
      );
    });
  }

  /* ── Routing (Google Directions) ─────────────────────────── */
  function drawRouteToPlace(place) {
    if (!place) return;
    if (!state.userLocation)
      return setStatus(
        "Lokasi awal belum tersedia. Klik 'Gunakan Lokasi Saya'.",
        "error",
      );

    clearRoute();
    const origin = new google.maps.LatLng(
      state.userLocation.lat,
      state.userLocation.lng,
    );
    const destination = new google.maps.LatLng(place.lat, place.lng);

    state.directionsService.route(
      { origin, destination, travelMode: google.maps.TravelMode.DRIVING },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          state.directionsRenderer.setDirections(result);
          const leg = result.routes[0]?.legs[0];
          setStatus(
            leg
              ? `Rute ke ${place.name}: ${leg.distance.text} • ${leg.duration.text}`
              : `Rute ke ${place.name} ditampilkan.`,
            "ok",
          );
        } else {
          setStatus(
            "Gagal menghitung rute. Pastikan Directions API aktif.",
            "error",
          );
        }
      },
    );
  }

  function clearRoute() {
    if (state.directionsRenderer)
      state.directionsRenderer.setDirections({ routes: [] });
  }

  /* ── Geolocation ─────────────────────────────────────────── */
  function requestUserLocation({ silent = false, reloadAfter = false } = {}) {
    if (!navigator.geolocation) {
      if (!silent) setStatus("Browser tidak mendukung geolocation.", "error");
      return;
    }
    if (!silent) setStatus("Mengambil lokasi kamu...", "loading");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        state.usingUserLocation = true;
        setUserLocation({
          lat: latitude,
          lng: longitude,
          accuracy,
          isApproximate: false,
        });
        state.map.panTo({ lat: latitude, lng: longitude });
        state.map.setZoom(14);
        if (!silent) setStatus("Lokasi berhasil diperbarui.", "ok");
        if (reloadAfter) loadPetshops({ silentStatus: true });
        reverseGeocode(latitude, longitude);
      },
      (err) => {
        if (!silent) {
          setStatus(
            err.code === 1
              ? "Akses lokasi ditolak. Coba aktifkan izin lokasi."
              : "Tidak bisa mengakses lokasi.",
            "error",
          );
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 },
    );
  }

  function setUserLocation({
    lat,
    lng,
    accuracy = null,
    isApproximate = false,
  }) {
    state.userLocation = { lat, lng, accuracy, isApproximate };
    if (state.places.length) {
      state.places = state.places.map((p) => ({
        ...p,
        distanceMeters: haversineMeters({ lat, lng }, p),
        popularityScore: computePopularityScore(p),
      }));
      filterSortAndRender();
    }
    if (state.googleReady) updateUserMarker();
  }

  function reverseGeocode(lat, lng) {
    if (!state.googleReady) return;
    new google.maps.Geocoder().geocode(
      { location: { lat, lng } },
      (results, status) => {
        if (status === "OK" && results[0]) {
          let city = "",
            province = "";
          for (const c of results[0].address_components) {
            if (c.types.includes("administrative_area_level_2"))
              city = c.long_name;
            if (c.types.includes("administrative_area_level_1"))
              province = c.long_name;
          }
          const label =
            city && province
              ? `${city}, ${province}`
              : city || province || "Indonesia";
          if (els.locationLabel) els.locationLabel.textContent = label;
        }
      },
    );
  }

  /* ── Fit All ─────────────────────────────────────────────── */
  function fitAllMarkers() {
    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;
    if (state.userLocation) {
      bounds.extend(state.userLocation);
      hasPoints = true;
    }
    state.filteredPlaces.forEach((p) => {
      bounds.extend({ lat: p.lat, lng: p.lng });
      hasPoints = true;
    });
    if (!hasPoints) {
      state.map.setCenter(INDONESIA_CENTER);
      state.map.setZoom(CONFIG.defaultZoom);
      return;
    }
    state.map.fitBounds(bounds, { top: 32, right: 32, bottom: 32, left: 32 });
  }

  /* ── UI Helpers ──────────────────────────────────────────── */
  function setStatus(text, type = "ok") {
    els.statusBadge.textContent = text;
    els.statusBadge.classList.remove("loading", "error");
    if (type === "loading") els.statusBadge.classList.add("loading");
    if (type === "error") els.statusBadge.classList.add("error");
  }

  function setSourceInfo(source) {
    els.sourceInfo.textContent = `Sumber data: ${source}`;
  }

  function buildPopupHtml(place) {
    const dist =
      place.distanceMeters != null
        ? formatDistance(place.distanceMeters)
        : null;
    const rating = place.rating != null ? place.rating.toFixed(1) : null;
    const reviews = place.userRatingsTotal || 0;
    const statusLabel =
      place.openNow === true
        ? "Buka"
        : place.openNow === false
          ? "Tutup"
          : null;
    const statusColor = place.openNow === true ? "#10b981" : "#ef4444";
    const navLink = buildNavigationLink(place);

    return `
      <div style="font-family:Inter,system-ui,sans-serif;min-width:220px;max-width:280px;padding:2px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
          <h4 style="margin:0;font-size:0.95rem;color:#111;font-weight:700;line-height:1.2">${escapeHtml(place.name)}</h4>
          ${statusLabel ? `<span style="flex-shrink:0;font-size:0.65rem;font-weight:700;padding:3px 8px;border-radius:99px;background:${statusColor}18;color:${statusColor};border:1px solid ${statusColor}40">${statusLabel}</span>` : ""}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          ${rating ? `<span style="font-size:0.72rem;padding:3px 8px;border-radius:99px;background:#fef3c7;color:#92400e;font-weight:600">⭐ ${rating}</span>` : ""}
          <span style="font-size:0.72rem;padding:3px 8px;border-radius:99px;background:#f3f4f6;color:#4b5563;font-weight:500">${reviews} review</span>
          ${dist ? `<span style="font-size:0.72rem;padding:3px 8px;border-radius:99px;background:#dbeafe;color:#1e40af;font-weight:500">📏 ${dist}</span>` : ""}
        </div>
        <p style="margin:0 0 8px;color:#6b7280;font-size:0.78rem;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">📍 ${escapeHtml(place.address || "Alamat tidak tersedia")}</p>
        <a href="${navLink}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;font-size:0.75rem;font-weight:600;color:#f59e0b;text-decoration:none;padding:4px 0">🚗 Navigasi langsung →</a>
      </div>
    `;
  }

  /* ── Utility ─────────────────────────────────────────────── */
  function computePopularityScore(place) {
    const rating = Number(place.rating || 0);
    const reviews = Number(place.userRatingsTotal || 0);
    if (!rating && !reviews) return 0;
    return rating * Math.log10(reviews + 10);
  }

  function haversineMeters(a, b) {
    const R = 6371000;
    const dLat = degToRad(b.lat - a.lat);
    const dLng = degToRad(b.lng - a.lng);
    const lat1 = degToRad(a.lat);
    const lat2 = degToRad(b.lat);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const x =
      sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function degToRad(d) {
    return (d * Math.PI) / 180;
  }

  function formatDistance(meters) {
    if (!Number.isFinite(meters)) return "-";
    return meters < 1000
      ? `${Math.round(meters)} m`
      : `${(meters / 1000).toFixed(2)} km`;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function slugify(s) {
    return String(s)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
  }

  function round(n, p = 5) {
    const f = Math.pow(10, p);
    return Math.round(n * f) / f;
  }

  function buildGoogleMapsLink(place) {
    if (place.placeId)
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${encodeURIComponent(place.placeId)}`;
    return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
  }

  function buildNavigationLink(place) {
    // Opens Google Maps turn-by-turn driving navigation
    return `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&travelmode=driving`;
  }
})();
