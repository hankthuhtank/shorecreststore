/* ==========================================================================
   Shorecrest store: the live Printify catalog (through the Worker, with a
   saved snapshot as backup), display names, grouping, and product cards.
   ========================================================================== */
(function () {
  "use strict";
  var SC = window.SC, cfg = SC.cfg;

  var TYPES = {
    canvas: { one: "Canvas", many: "Canvas", blurb: "Gallery-wrapped and framed prints for the walls you live with.", icon: '<path d="M3 4H29V28H3Z M7 8H25V24H7Z M9 20L14 14L18 18L22 12"/>' },
    shirts: { one: "Apparel", many: "Shirts", blurb: "Soft tees and layers with a little of the road on them.", icon: '<path d="M10 5L5 7L1 15L7 18L9 14V29H23V14L25 18L31 15L27 7L22 5Q16 11 10 5Z"/>' },
    mugs: { one: "Mug", many: "Mugs", blurb: "For slow mornings and long views.", icon: '<path d="M5 8H23V24Q23 28 18 28H10Q5 28 5 24Z M23 11H27Q31 11 29 17Q28 20 23 20 M10 2V5 M17 2V5"/>' },
    puzzles: { one: "Puzzle", many: "Puzzles", blurb: "A place to get lost in, one piece at a time.", icon: '<path d="M5 6H13C13 2.5 19 2.5 19 6H27V14C30.5 14 30.5 20 27 20V28H5Z"/>' },
    hats: { one: "Hat", many: "Hats", blurb: "For sun, wind, and the long way around.", icon: '<path d="M5 21C5 13.5 10 9 16.5 9S28 13.5 28 21Z M3 21H30Q30 24 26.5 24H5Q3 24 3 22.5Z M16.5 9V7"/>' },
    more: { one: "Piece", many: "More", blurb: "", icon: '<path d="M16 3L19 12L29 16L19 20L16 29L13 20L3 16L13 12Z"/>' }
  };
  var ORDER = ["canvas", "shirts", "mugs", "puzzles", "hats"];
  var store = (SC.store = { TYPES: TYPES, ORDER: ORDER });

  store.typeIcon = function (type, cls) {
    return '<svg class="' + (cls || "ticon") + '" viewBox="0 0 32 32" aria-hidden="true">' + (TYPES[type] || TYPES.more).icon + "</svg>";
  };

  /* ---------------------------------------------------------------- money */
  var fmt = null;
  store.money = function (cents) {
    if (!fmt) fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: cfg.currency || "USD" });
    return fmt.format((cents || 0) / 100).replace(/\.00$/, "");
  };
  store.priceLabel = function (p) {
    var min = p.groupMin || p.priceMin, max = p.groupMax || p.priceMax;
    if (!min) return "";
    return min === max ? store.money(min) : "From " + store.money(min);
  };

  /* ---------------------------------------------------------------- Printify image sizes
     Printify's mockup server only has three sizes: 400, 1200 (the default) and 2048. */
  store.img = function (src, size) {
    if (!size || size === 1200 || !/images-api\.printify\.com/.test(src)) return src;
    return src + (src.indexOf("?") > -1 ? "&" : "?") + "s=" + (size <= 400 ? 400 : 2048);
  };
  store.srcset = function (src) {
    if (!/images-api\.printify\.com/.test(src)) return "";
    return store.img(src, 400) + " 400w, " + src + " 1200w, " + store.img(src, 2048) + " 2048w";
  };

  /* ---------------------------------------------------------------- display names + places */
  var KINDS = [
    [/\s*framed canvas$/i, "Framed canvas"], [/\s*canvas$/i, "Canvas"],
    [/\s*black accent mug(\s*\([^)]*\))?$/i, "Accent mug"], [/\s*(accent\s+)?mug(\s*\([^)]*\))?$/i, "Mug"],
    [/\s*(jigsaw\s+)?puzzle$/i, "Puzzle"]
  ];
  // [prefix as it appears in product titles, photo collection, display name if different]
  var PLACES = [
    ["Grand Canyon National Park", "Canyon Country"], ["Grand Teton National Park", "Grand Tetons"], ["Glacier National Park", "Glacier"],
    ["Zion National Park", "Zion"], ["Yosemite National Park", "Yosemite"], ["Yellowstone National Park", "Yellowstone"],
    ["Sequoia National Park", "Sequoia"], ["Mount Rainier National Park", "Rainier"], ["North Cascades National Park", "North Cascades"],
    ["Crater Lake National Park", "Crater Lake"], ["Big Sur", "Big Sur"], ["Lake Tahoe", "Tahoe"], ["Mount Shasta", "Shasta"],
    ["California", "California"], ["Oregon", "Oregon"], ["Golden Gate", "Golden Gate"],
    ["Sequoia", "Sequoia", "Sequoia National Park"], ["Yosemite", "Yosemite", "Yosemite National Park"], ["Zion", "Zion", "Zion National Park"],
    ["Yellowstone", "Yellowstone", "Yellowstone National Park"], ["Glacier", "Glacier", "Glacier National Park"],
    ["Grand Teton", "Grand Tetons", "Grand Teton National Park"], ["Mount Rainier", "Rainier", "Mount Rainier National Park"]
  ];
  var COLLECTION_PLACE = {}; // photo collection -> display place
  PLACES.forEach(function (p) { if (!COLLECTION_PLACE[p[1]]) COLLECTION_PLACE[p[1]] = p[2] || p[0]; });

  function parseTitle(title, type) {
    var t = String(title || "").trim();
    var code = (t.match(/\bSC-\d{3}\b/i) || [""])[0].toUpperCase();
    var copy = /^copy of\s+/i.test(t);
    t = t.replace(/^copy of\s+/i, "").replace(/^SC-\d{3}\s+/i, "");
    var parts = t.split(/\s+[—–|]\s+|\s+-\s+(?=[A-Z])/);
    var main = parts[0].trim(), extra = parts.slice(1).join(" / ");
    var out = { name: main, place: "", collection: "", kind: "", extra: extra, code: code, copy: copy };
    if (type === "shirts" || type === "hats" || type === "more") return out;
    for (var k = 0; k < KINDS.length; k++) {
      if (KINDS[k][0].test(main)) { out.kind = KINDS[k][1]; main = main.replace(KINDS[k][0], "").trim(); break; }
    }
    var low = main.toLowerCase();
    for (var i = 0; i < PLACES.length; i++) {
      var pl = PLACES[i][0].toLowerCase();
      if (low === pl || low.indexOf(pl + " ") === 0) {
        out.place = PLACES[i][2] || PLACES[i][0]; out.collection = PLACES[i][1];
        main = main.slice(pl.length).trim();
        break;
      }
    }
    out.name = main || out.place || out.name;
    return out;
  }
  store.parseTitle = parseTitle;

  function sceneFor(p, info) {
    var tagged = (p.tags || []).concat([info.code]).map(function (t) { return String(t).trim().toUpperCase(); })
      .filter(function (t) { return /^SC-\d{3}$/.test(t); })[0];
    if (tagged && SC.byId[tagged]) return SC.byId[tagged];
    var name = " " + info.name.toLowerCase().replace(/[^a-z0-9]+/g, " ") + " ", best = null;
    SC.catalog.forEach(function (s) {
      if (info.collection && s.place !== info.collection) return;
      var st = " " + s.title.toLowerCase().replace(/[^a-z0-9]+/g, " ") + " ";
      if (name.indexOf(st) > -1 && (!best || s.title.length > best.title.length)) best = s;
    });
    return best;
  }

  /* ---------------------------------------------------------------- loading */
  var KEY = "sc-catalog-v3", TTL = 5 * 60 * 1000, promise = null;

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  function snapshot() {
    return (window.SC_SNAPSHOT ? Promise.resolve() : loadScript("assets/js/catalog-snapshot.js")).then(function () {
      var d = window.SC_SNAPSHOT || { products: [] };
      return JSON.parse(JSON.stringify(d));
    });
  }
  function fromWorker() {
    var cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) {}
    if (cached && Date.now() - cached.t < TTL && cached.d && cached.d.products) return Promise.resolve(cached.d);
    return fetch(cfg.apiBase.replace(/\/+$/, "") + "/api/products", { headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) {
        if (!d || !d.products || !d.products.length) throw new Error("Empty catalog");
        try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
        return d;
      })
      .catch(function (err) {
        if (cached && cached.d) return cached.d;
        console.warn("Shorecrest: live catalog unavailable, using the saved snapshot.", err);
        return snapshot();
      });
  }

  store.load = function () {
    if (!promise) promise = (cfg.apiBase ? fromWorker() : snapshot()).then(prepare).catch(function (err) { promise = null; throw err; });
    return promise;
  };

  function prepare(d) {
    var links = cfg.buyLinks || {}, pop = (cfg.popupUrl || d.popup || "").replace(/\/+$/, "");
    var all = (d.products || []).filter(function (p) { return p && p.id && p.images && p.images.length && p.variants && p.variants.length; });
    all.forEach(function (p, i) {
      p.type = TYPES[p.type] ? p.type : "more";
      if (p.rank == null) p.rank = i;
      if (links[p.id]) p.buyUrl = links[p.id];
      if (!p.buyUrl && pop) p.buyUrl = pop + "/products";
      var info = parseTitle(p.title, p.type);
      p.name = info.name; p.kind = info.kind; p.extra = info.extra; p.copy = info.copy;
      p.scene = sceneFor(p, info);
      p.place = info.place || (p.scene ? COLLECTION_PLACE[p.scene.place] || p.scene.place : "");
      p.collection = info.collection || (p.scene ? p.scene.place : "");
      p.colors = colorCount(p);
    });
    // Canvas + Framed canvas of the same photograph become one design with a Style choice;
    // logo variations of the same tee or cap become one product with a Logo choice.
    var labels = cfg.variationLabels || {};
    group(all.filter(function (p) { return p.type === "canvas"; }),
      function (p) { return (p.place + "|" + p.name).toLowerCase(); },
      function (a, b) { return (a.kind === "Framed canvas") - (b.kind === "Framed canvas") || a.priceMin - b.priceMin; },
      function (p) { return labels[p.id] || (p.kind === "Framed canvas" ? "Framed" : "Canvas"); }, "Style");
    group(all.filter(function (p) { return p.type === "shirts" || p.type === "hats"; }),
      function (p) { return (p.type + "|" + p.name).toLowerCase(); },
      function (a, b) { return a.copy - b.copy || a.rank - b.rank; },
      function (p, i) { return labels[p.id] || "Logo " + (i + 1); }, "Logo");
    d.all = all;
    d.products = all.filter(function (p) { return !p.secondary; });
    d.byId = {};
    all.forEach(function (p) { d.byId[p.id] = p; if (p.popupId) d.byId[String(p.popupId)] = p; });
    d.byType = {};
    d.products.forEach(function (p) { d.byType[p.type] = (d.byType[p.type] || 0) + 1; });
    d.places = {};
    d.products.forEach(function (p) { if (p.place) d.places[p.place] = (d.places[p.place] || 0) + 1; });
    store.data = d;
    return d;
  }

  function group(list, keyFn, sortFn, labelFn, choiceName) {
    var groups = {};
    list.forEach(function (p) { var k = keyFn(p); (groups[k] = groups[k] || []).push(p); });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      if (g.length < 2) return;
      g.sort(sortFn);
      var styles = g.map(function (p, i) { return { id: p.id, label: labelFn(p, i), price: p.priceMin }; });
      var min = Math.min.apply(null, g.map(function (p) { return p.priceMin; }));
      var max = Math.max.apply(null, g.map(function (p) { return p.priceMax; }));
      var colors = g.reduce(function (n, p) { return n + p.colors; }, 0);
      g.forEach(function (p, i) {
        p.styles = styles; p.choiceName = choiceName; p.groupMin = min; p.groupMax = max;
        p.groupColors = colors; p.secondary = i > 0; p.primaryId = g[0].id; p.alt = g[1];
      });
    });
  }

  function colorCount(p) {
    var c = (p.options || []).filter(function (o) { return o.name === "Color"; })[0];
    return c ? c.values.length : 0;
  }

  store.get = function (id) {
    return store.load().then(function (d) { return d.byId[id] || null; });
  };

  /* ---------------------------------------------------------------- images */
  store.imagesFor = function (p, variantId) {
    if (variantId == null) return p.images;
    var list = p.images.filter(function (im) { return !im.variants || !im.variants.length || im.variants.indexOf(variantId) > -1; });
    return list.length ? list : p.images;
  };
  store.pick = function (p, prefer) {
    for (var i = 0; i < prefer.length; i++) {
      for (var j = 0; j < p.images.length; j++) if (p.images[j].position === prefer[i]) return p.images[j];
    }
    return p.images[0];
  };
  store.url = function (p) { return "product.html?id=" + encodeURIComponent(p.primaryId || p.id); };

  /* ---------------------------------------------------------------- cards */
  var HOVER = { canvas: ["context-1", "side"], mugs: ["right", "left"], puzzles: ["context-2", "context-1"], shirts: ["folded", "hanging-1", "back-2"], hats: ["person-1-front", "back"] };
  store.card = function (p, i) {
    var t = TYPES[p.type] || TYPES.more, wearable = p.type === "shirts" || p.type === "hats";
    var a = p.images[0], b = store.pick(p, HOVER[p.type] || []);
    if (wearable && p.alt) b = p.alt.images[0];       // hover shows the other logo
    if (b === a) b = p.images[1];
    var colors = p.groupColors || p.colors;
    var kind = p.styles && p.type === "canvas" ? "Canvas or framed" : p.kind || t.one;
    var sub = wearable ? [p.styles ? p.styles.length + " logo styles" : "", colors > 1 ? colors + " colors" : ""].filter(Boolean).join(", ") || t.one
      : p.place && p.place !== p.name ? kind + ", " + p.place.replace(/ National Park$/, "")
      : kind;
    return '<a class="pcard" href="' + store.url(p) + '" style="--n:' + (i || 0) + '">' +
      '<div class="pcard__media">' +
        '<img class="pcard__img fade-img" src="' + SC.esc(a.src) + '" srcset="' + SC.esc(store.srcset(a.src)) + '" sizes="(max-width: 600px) 50vw, (max-width: 1100px) 33vw, 25vw" alt="' + SC.esc(p.title) + '" loading="lazy" decoding="async">' +
        (b ? '<img class="pcard__img pcard__img--alt" src="' + SC.esc(b.src) + '" srcset="' + SC.esc(store.srcset(b.src)) + '" sizes="(max-width: 600px) 50vw, (max-width: 1100px) 33vw, 25vw" alt="" loading="lazy" decoding="async">' : "") +
      "</div>" +
      '<div class="pcard__meta"><h3 class="pcard__title">' + SC.esc(p.name) + "</h3>" +
      '<span class="pcard__price">' + SC.esc(store.priceLabel(p)) + "</span></div>" +
      '<p class="pcard__sub">' + SC.esc(sub) + "</p>" +
      "</a>";
  };
  store.skeletons = function (n) {
    var h = "";
    for (var i = 0; i < n; i++) h += '<div class="pcard is-skel" aria-hidden="true"><div class="pcard__media"></div><span class="skel"></span><span class="skel skel--short"></span></div>';
    return h;
  };
  store.errorNote = function () {
    return '<div class="note-box"><p class="h3">The shop is taking a breather.</p><p>We couldn\'t load the collection just now. Please try again in a moment.</p><button class="btn btn--dark" type="button" data-retry>Try again</button></div>';
  };

  /* ---------------------------------------------------------------- header dropdown */
  var TILE = { canvas: ["front"], shirts: ["front-2", "front"], mugs: ["front"], puzzles: ["front"], hats: ["front"] };
  store.typeImage = function (d, type) {
    var list = d.products.filter(function (p) { return p.type === type; });
    if (!list.length) return null;
    var p = list[0];
    return store.pick(p, TILE[type] || ["front"]).src;
  };
  var filled = false;
  store.fillDropdown = function (panel) {
    if (filled) return;
    filled = true;
    var grid = SC.$(".drop__grid", panel);
    function render(d) {
      grid.innerHTML = ORDER.map(function (type) {
        var t = TYPES[type], count = d ? d.byType[type] || 0 : null, src = d ? store.typeImage(d, type) : null;
        return '<a class="drop__item" href="shop.html?type=' + type + '">' +
          '<span class="drop__img">' + (src ? '<img src="' + SC.esc(store.img(src, 400)) + '" alt="" loading="lazy">' : store.typeIcon(type)) + "</span>" +
          '<span class="drop__name">' + t.many + "</span>" +
          (count != null ? '<span class="drop__count">' + count + (count === 1 ? " design" : " designs") + "</span>" : "") +
          "</a>";
      }).join("");
    }
    render(null);
    store.load().then(render).catch(function () {});
  };
})();
