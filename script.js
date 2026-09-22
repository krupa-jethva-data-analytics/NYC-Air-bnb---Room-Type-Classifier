/* ============================================================
   NYC Airbnb Room-Type Classifier — front end logic
   ------------------------------------------------------------
   Talks to the FastAPI endpoint from the brief:

     POST {apiBase}/predict
     body: { latitude, longitude, price, minimum_nights,
             number_of_reviews, reviews_per_month,
             calculated_host_listings_count, availability_365,
             neighbourhood_group, neighbourhood }

   One quirk worth knowing about that backend: it builds the
   response with `str(prediction.tolist())`, so
   "Predicted_room_type" arrives as the *string* "['Private room']"
   rather than a plain label. cleanLabel() below strips the
   brackets/quotes so the UI always shows a clean class name —
   if the backend is ever changed to return the label directly,
   this still works unchanged.
   ============================================================ */

(() => {
  "use strict";

  const CLASS_ORDER = ["Entire home/apt", "Private room", "Shared room"];
  const CLASS_COLOR = {
    "Entire home/apt": "var(--gold)",
    "Private room": "var(--teal)",
    "Shared room": "var(--lavender)",
  };

  const NEIGHBOURHOODS = ["Allerton", "Arden Heights", "Arrochar", "Arverne", "Astoria", "Bath Beach", "Battery Park City", "Bay Ridge", "Bay Terrace", "Bay Terrace, Staten Island", "Baychester", "Bayside", "Bayswater", "Bedford-Stuyvesant", "Belle Harbor", "Bellerose", "Belmont", "Bensonhurst", "Bergen Beach", "Boerum Hill", "Borough Park", "Breezy Point", "Briarwood", "Brighton Beach", "Bronxdale", "Brooklyn Heights", "Brownsville", "Bull's Head", "Bushwick", "Cambria Heights", "Canarsie", "Carroll Gardens", "Castle Hill", "Castleton Corners", "Chelsea", "Chinatown", "City Island", "Civic Center", "Claremont Village", "Clason Point", "Clifton", "Clinton Hill", "Co-op City", "Cobble Hill", "College Point", "Columbia St", "Concord", "Concourse", "Concourse Village", "Coney Island", "Corona", "Crown Heights", "Cypress Hills", "DUMBO", "Ditmars Steinway", "Dongan Hills", "Douglaston", "Downtown Brooklyn", "Dyker Heights", "East Elmhurst", "East Flatbush", "East Harlem", "East Morrisania", "East New York", "East Village", "Eastchester", "Edenwald", "Edgemere", "Elmhurst", "Eltingville", "Emerson Hill", "Far Rockaway", "Fieldston", "Financial District", "Flatbush", "Flatiron District", "Flatlands", "Flushing", "Fordham", "Forest Hills", "Fort Greene", "Fort Hamilton", "Fresh Meadows", "Glendale", "Gowanus", "Gramercy", "Graniteville", "Grant City", "Gravesend", "Great Kills", "Greenpoint", "Greenwich Village", "Grymes Hill", "Harlem", "Hell's Kitchen", "Highbridge", "Hollis", "Holliswood", "Howard Beach", "Howland Hook", "Huguenot", "Hunts Point", "Inwood", "Jackson Heights", "Jamaica", "Jamaica Estates", "Jamaica Hills", "Kensington", "Kew Gardens", "Kew Gardens Hills", "Kingsbridge", "Kips Bay", "Laurelton", "Little Italy", "Little Neck", "Long Island City", "Longwood", "Lower East Side", "Manhattan Beach", "Marble Hill", "Mariners Harbor", "Maspeth", "Melrose", "Middle Village", "Midland Beach", "Midtown", "Midwood", "Mill Basin", "Morningside Heights", "Morris Heights", "Morris Park", "Morrisania", "Mott Haven", "Mount Eden", "Mount Hope", "Murray Hill", "Navy Yard", "Neponsit", "New Brighton", "New Dorp", "New Dorp Beach", "New Springville", "NoHo", "Nolita", "North Riverdale", "Norwood", "Oakwood", "Olinville", "Ozone Park", "Park Slope", "Parkchester", "Pelham Bay", "Pelham Gardens", "Port Morris", "Port Richmond", "Prince's Bay", "Prospect Heights", "Prospect-Lefferts Gardens", "Queens Village", "Randall Manor", "Red Hook", "Rego Park", "Richmond Hill", "Ridgewood", "Riverdale", "Rockaway Beach", "Roosevelt Island", "Rosebank", "Rosedale", "Rossville", "Schuylerville", "Sea Gate", "Sheepshead Bay", "Shore Acres", "Silver Lake", "SoHo", "Soundview", "South Beach", "South Ozone Park", "South Slope", "Springfield Gardens", "Spuyten Duyvil", "St. Albans", "St. George", "Stapleton", "Stuyvesant Town", "Sunnyside", "Sunset Park", "Theater District", "Throgs Neck", "Todt Hill", "Tompkinsville", "Tottenville", "Tremont", "Tribeca", "Two Bridges", "Unionport", "University Heights", "Upper East Side", "Upper West Side", "Van Nest", "Vinegar Hill", "Wakefield", "Washington Heights", "West Brighton", "West Farms", "West Village", "Westchester Square", "Westerleigh", "Whitestone", "Williamsbridge", "Williamsburg", "Willowbrook", "Windsor Terrace", "Woodhaven", "Woodlawn", "Woodside"];

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (id) => document.getElementById(id);

  const form = $("predictForm");
  const apiBaseInput = $("apiBase");
  const settingsToggle = $("settingsToggle");
  const settingsPanel = $("settingsPanel");

  const readoutIdle = $("readoutIdle");
  const readoutLoading = $("readoutLoading");
  const readoutError = $("readoutError");
  const readoutErrorMsg = $("readoutErrorMsg");
  const readoutResult = $("readoutResult");
  const predictedClassEl = $("predictedClass");
  const confidenceNoteEl = $("confidenceNote");
  const probBarsEl = $("probBars");
  const formError = $("formError");
  const predictBtn = $("predictBtn");

  const boroughSelect = $("neighbourhood_group");
  const neighbourhoodInput = $("neighbourhood");
  const latInput = $("latitude");
  const lonInput = $("longitude");

  const minNightsInput = $("minimum_nights");
  const minNightsOut = $("minimum_nights_out");
  const availabilityInput = $("availability_365");
  const availabilityOut = $("availability_365_out");

  const mapPin = $("mapPin");

  /* ---------------- setup: neighbourhood datalist ---------------- */

  (function populateNeighbourhoods() {
    const datalist = $("neighbourhoods");
    const frag = document.createDocumentFragment();
    NEIGHBOURHOODS.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      frag.appendChild(opt);
    });
    datalist.appendChild(frag);
  })();

  /* ---------------- settings panel ---------------- */

  settingsToggle.addEventListener("click", () => {
    const isHidden = settingsPanel.hidden;
    settingsPanel.hidden = !isHidden;
    settingsToggle.setAttribute("aria-expanded", String(isHidden));
  });

  /* ---------------- sliders ---------------- */

  minNightsInput.addEventListener("input", () => {
    minNightsOut.textContent = minNightsInput.value;
  });
  availabilityInput.addEventListener("input", () => {
    availabilityOut.textContent = availabilityInput.value;
  });

  /* ---------------- borough map ---------------- */

  function getSvgPoint(svg, evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  document.querySelectorAll(".borough-shape").forEach((shape) => {
    shape.addEventListener("click", (evt) => {
      const svg = shape.ownerSVGElement;
      const pt = getSvgPoint(svg, evt);
      const bbox = shape.getBBox();

      const rx = (pt.x - bbox.x) / bbox.width - 0.5; // -0.5 .. 0.5, west->east
      const ry = (pt.y - bbox.y) / bbox.height - 0.5; // -0.5 .. 0.5, north->south

      const baseLat = parseFloat(shape.dataset.lat);
      const baseLon = parseFloat(shape.dataset.lon);
      const latRange = parseFloat(shape.dataset.latRange);
      const lonRange = parseFloat(shape.dataset.lonRange);

      const lat = baseLat - ry * latRange; // screen-down means south, so subtract
      const lon = baseLon + rx * lonRange;

      boroughSelect.value = shape.dataset.borough;
      latInput.value = lat.toFixed(4);
      lonInput.value = lon.toFixed(4);

      document.querySelectorAll(".borough-shape").forEach((s) => s.classList.remove("is-selected"));
      shape.classList.add("is-selected");

      mapPin.setAttribute("cx", pt.x);
      mapPin.setAttribute("cy", pt.y);
      mapPin.hidden = false;
      mapPin.classList.remove("is-visible");
      // restart the drop animation
      void mapPin.getBBox();
      mapPin.classList.add("is-visible");
    });
  });

  /* ---------------- readout state machine ---------------- */

  function showState(name) {
    readoutIdle.hidden = name !== "idle";
    readoutLoading.hidden = name !== "loading";
    readoutError.hidden = name !== "error";
    readoutResult.hidden = name !== "result";
  }

  function cleanLabel(raw) {
    // handles both a plain label and the backend's "['Private room']" form
    return String(raw).replace(/[\[\]'"]/g, "").trim();
  }

  function confidenceMessage(sortedProbs) {
    const gap = sortedProbs[0] - sortedProbs[1];
    if (gap > 0.4) return "The model is fairly confident about this one.";
    if (gap > 0.15) return "Reasonably confident — the runner-up isn't far behind.";
    return "This one's close — the top two room types are neck and neck.";
  }

  function animateNumber(el, toValue, duration) {
    if (reduceMotion) {
      el.textContent = `${Math.round(toValue * 100)}%`;
      return;
    }
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = `${Math.round(toValue * eased * 100)}%`;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function renderResult(labelRaw, probabilities) {
    const label = cleanLabel(labelRaw);
    predictedClassEl.textContent = label;

    const paired = CLASS_ORDER.map((cls, i) => ({
      cls,
      prob: probabilities[i] ?? 0,
    })).sort((a, b) => b.prob - a.prob);

    confidenceNoteEl.textContent = confidenceMessage(paired.map((p) => p.prob));

    probBarsEl.innerHTML = "";
    paired.forEach(({ cls, prob }) => {
      const row = document.createElement("div");
      row.className = "prob-bar-row";

      const top = document.createElement("div");
      top.className = "prob-bar-top";
      const name = document.createElement("span");
      name.textContent = cls;
      const pct = document.createElement("span");
      pct.className = "pct";
      pct.textContent = "0%";
      top.append(name, pct);

      const track = document.createElement("div");
      track.className = "prob-bar-track";
      const fill = document.createElement("div");
      fill.className = "prob-bar-fill";
      fill.style.background = CLASS_COLOR[cls] || "var(--gold)";
      track.appendChild(fill);

      row.append(top, track);
      probBarsEl.appendChild(row);

      requestAnimationFrame(() => {
        fill.style.width = `${prob * 100}%`;
      });
      animateNumber(pct, prob, 900);
    });

    showState("result");
    readoutResult.classList.remove("is-revealing");
    void readoutResult.offsetWidth;
    readoutResult.classList.add("is-revealing");

    const panel = $("readoutPanel");
    panel.classList.remove("panel-flash");
    void panel.offsetWidth;
    panel.classList.add("panel-flash");
  }

  /* ---------------- form submit ---------------- */

  function setLoading(isLoading) {
    predictBtn.disabled = isLoading;
    predictBtn.classList.toggle("is-loading", isLoading);
    predictBtn.querySelector(".btn-label").textContent = isLoading ? "Reading the listing…" : "Predict room type";
  }

  form.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    formError.hidden = true;

    if (!form.checkValidity()) {
      formError.textContent = "Fill in every field — the model needs all ten details to make a call.";
      formError.hidden = false;
      form.reportValidity();
      return;
    }

    const payload = {
      latitude: parseFloat(latInput.value),
      longitude: parseFloat(lonInput.value),
      price: parseFloat($("price").value),
      minimum_nights: parseInt(minNightsInput.value, 10),
      number_of_reviews: parseInt($("number_of_reviews").value, 10),
      reviews_per_month: parseFloat($("reviews_per_month").value),
      calculated_host_listings_count: parseInt($("calculated_host_listings_count").value, 10),
      availability_365: parseInt(availabilityInput.value, 10),
      neighbourhood_group: boroughSelect.value,
      neighbourhood: neighbourhoodInput.value,
    };

    const apiBase = apiBaseInput.value.trim().replace(/\/+$/, "") || "https://nyc-air-bnb-room-type-classifier-vzqs.onrender.com";

    setLoading(true);
    showState("loading");

    try {
      const res = await fetch(`${apiBase}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Server responded with ${res.status}. ${text}`.trim());
      }

      const data = await res.json();
      renderResult(data.Predicted_room_type, data.Probability);
    } catch (err) {
      readoutErrorMsg.textContent = `Make sure the FastAPI server is running at ${apiBase} and that CORS is enabled. (${err.message})`;
      showState("error");
    } finally {
      setLoading(false);
    }
  });
})();
