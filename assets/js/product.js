/* ==========================================================================
   Product page: gallery, options, Buy (opens the Pop-Up checkout page).
   ========================================================================== */
(function () {
  "use strict";
  var SC = window.SC, $ = SC.$, $$ = SC.$$, store = SC.store, TYPES = store.TYPES, cfg = SC.cfg;
  var data, p, sel = {}, variant = null, imgIndex = 0;

  /* ---------------------------------------------------------------- variants */
  function optionIndexOf(valueId) {
    for (var i = 0; i < p.options.length; i++) for (var j = 0; j < p.options[i].values.length; j++) if (p.options[i].values[j].id === valueId) return i;
    return -1;
  }
  function selFromVariant(v) {
    sel = {};
    (v.options || []).forEach(function (id) { var i = optionIndexOf(id); if (i > -1) sel[i] = id; });
  }
  function match(s) {
    return p.variants.filter(function (v) {
      return Object.keys(s).every(function (i) { return v.options.indexOf(s[i]) > -1; });
    });
  }
  function current() { var m = match(sel); return m.filter(function (v) { return v.available; })[0] || m[0] || null; }
  function valueState(i, id) {
    var s = {}; Object.keys(sel).forEach(function (k) { s[k] = sel[k]; }); s[i] = id;
    var m = match(s);
    if (!m.length) return "none";
    return m.some(function (v) { return v.available; }) ? "ok" : "out";
  }
  function choose(i, id) {
    sel[i] = id;
    if (!match(sel).length) {
      var v = p.variants.filter(function (x) { return x.options.indexOf(id) > -1 && x.available; })[0] || p.variants.filter(function (x) { return x.options.indexOf(id) > -1; })[0];
      if (v) selFromVariant(v);
    }
    variant = current();
    imgIndex = 0;
    renderOptions(); renderPrice(); renderGallery();
    syncURL();
  }

  /* ---------------------------------------------------------------- rendering */
  function label(v) {
    return p.options.map(function (o, i) {
      var val = o.values.filter(function (x) { return x.id === sel[i]; })[0];
      return o.values.length > 1 && val ? val.title : "";
    }).filter(Boolean).join(" / ");
  }

  function renderGallery() {
    var imgs = store.imagesFor(p, variant ? variant.id : null);
    if (imgIndex >= imgs.length) imgIndex = 0;
    var main = $(".gallery__main"), thumbs = $(".gallery__thumbs");
    var im = imgs[imgIndex];
    main.innerHTML = '<img src="' + SC.esc(im.src) + '" srcset="' + SC.esc(store.srcset(im.src)) + '" sizes="(max-width: 860px) 100vw, 55vw" alt="' + SC.esc(p.title + (variant ? ", " + label(variant) : "")) + '">';
    main.classList.remove("is-zoom");
    thumbs.innerHTML = imgs.length > 1 ? imgs.map(function (x, i) {
      return '<button type="button" aria-label="View image ' + (i + 1) + ' of ' + imgs.length + '" aria-current="' + (i === imgIndex) + '" data-i="' + i + '"><img src="' + SC.esc(store.img(x.src, 200)) + '" alt="" loading="lazy"></button>';
    }).join("") : "";
  }

  function renderPrice() {
    var el = $(".info__price"), btn = $("[data-buy]"), note = $("[data-avail]");
    var price = variant ? variant.price : p.priceMin;
    el.innerHTML = SC.esc(store.money(price)) + (variant && label(variant) ? "<small>" + SC.esc(label(variant)) + "</small>" : "");
    var out = variant && !variant.available;
    note.hidden = !out;
    btn.classList.toggle("is-out", out);
  }

  function renderOptions() {
    var box = $("[data-options]"), h = "";
    if (p.styles) {
      h += '<div class="opt"><div class="opt__head"><span class="opt__name">' + SC.esc(p.choiceName || "Style") + '</span><b>' + SC.esc(styleOf(p).label) + "</b></div>" +
        '<div class="sizes" role="radiogroup" aria-label="' + SC.esc(p.choiceName || "Style") + '">' + p.styles.map(function (s) {
          return '<button class="size" type="button" role="radio" aria-checked="' + (s.id === p.id) + '" data-style="' + s.id + '">' + SC.esc(s.label) + "</button>";
        }).join("") + "</div></div>";
    }
    p.options.forEach(function (o, i) {
      if (o.values.length < 2) return;
      var curVal = o.values.filter(function (v) { return v.id === sel[i]; })[0];
      var isColor = o.name === "Color" && o.values.some(function (v) { return v.colors && v.colors.length; });
      h += '<div class="opt"><div class="opt__head"><span class="opt__name">' + SC.esc(o.name) + '</span><b>' + SC.esc(curVal ? curVal.title : "") + "</b></div>";
      h += '<div class="' + (isColor ? "swatches" : "sizes") + '" role="radiogroup" aria-label="' + SC.esc(o.name) + '">';
      o.values.forEach(function (v) {
        var st = valueState(i, v.id), on = sel[i] === v.id;
        if (isColor) {
          h += '<button class="swatch" type="button" role="radio" aria-checked="' + on + '" aria-label="' + SC.esc(v.title) + (st !== "ok" ? " (unavailable)" : "") + '" title="' + SC.esc(v.title) + '" style="--sw:' + SC.esc(v.colors[0] || "#ccc") + '" data-opt="' + i + '" data-val="' + v.id + '"' + (st !== "ok" ? " data-off" : "") + "></button>";
        } else {
          h += '<button class="size" type="button" role="radio" aria-checked="' + on + '" data-opt="' + i + '" data-val="' + v.id + '"' + (st !== "ok" ? ' data-off aria-label="' + SC.esc(v.title) + ' (unavailable)"' : "") + ">" + SC.esc(v.title) + "</button>";
        }
      });
      h += "</div></div>";
    });
    var fixed = p.options.filter(function (o) { return o.values.length === 1; }).map(function (o) { return o.name + ": " + o.values[0].title; });
    if (fixed.length) h += '<p class="opt__fixed muted">' + SC.esc(fixed.join(" / ")) + "</p>";
    box.innerHTML = h;
  }

  function styleOf(x) { return (x.styles || []).filter(function (s) { return s.id === x.id; })[0] || { label: "" }; }

  function sizeGuideHTML(g, unit) {
    function conv(mm) { var n = parseFloat(mm); if (!n) return ""; return unit === "cm" ? (n / 10).toFixed(1) : (n / 25.4).toFixed(1); }
    var head = "<tr><th></th>" + g.sizes.map(function (s) { return "<th>" + SC.esc(s) + "</th>"; }).join("") + "</tr>";
    var rows = g.rows.map(function (r) {
      return "<tr><th>" + SC.esc(r.name) + "</th>" + r.values.map(function (v) {
        if (r.unit !== "mm") return "<td>" + SC.esc(v[0]) + "</td>";
        var a = conv(v[0]), b = conv(v[1]);
        return "<td>" + (a && b ? a + "&ndash;" + b : a) + "</td>";
      }).join("") + "</tr>";
    }).join("");
    return '<div class="sg-units" role="group" aria-label="Units"><button type="button" data-unit="in" aria-pressed="' + (unit === "in") + '">Inches</button><button type="button" data-unit="cm" aria-pressed="' + (unit === "cm") + '">Centimeters</button></div>' +
      '<div class="sg-wrap"><table class="sg"><thead>' + head + "</thead><tbody>" + rows + "</tbody></table></div>" +
      '<p class="muted" style="font-size:.95rem">Measurements of the garment laid flat.</p>';
  }

  function originHTML() {
    var s = p.scene;
    if (p.type === "shirts" || p.type === "hats") {
      return '<div class="origin origin--mark"><div class="origin__mark"><img src="assets/brand/crest-cloud.svg" alt=""></div><div>' +
        '<span class="origin__label">The Shorecrest mark</span><h3>Shore below, crest above.</h3>' +
        "<p>Waves at the bottom, a mountain on top: the whole climb in one mark, for anyone finding their way up.</p>" +
        '<a class="link" href="story.html">Why Shorecrest</a></div></div>';
    }
    if (!s && p.collection) {
      var scenes = SC.catalog.filter(function (x) { return x.place === p.collection; });
      s = scenes.filter(function (x) { return x.featured >= 0; })[0] || scenes[0];
      if (!s) return "";
      return '<div class="origin"><img src="' + SC.photo(s, 480) + '" alt="' + SC.esc(s.alt) + '" loading="lazy"><div>' +
        '<span class="origin__label">Where it was taken</span><h3>' + SC.esc(p.place || s.place) + "</h3>" +
        "<p>One of the places from 45 days on the road. Shown: " + SC.esc(s.title) + ", another photograph from the same trip.</p>" +
        (p.place ? '<a class="link" href="shop.html?place=' + encodeURIComponent(p.place) + '">More from ' + SC.esc(p.place.replace(/ National Park$/, "")) + "</a>" : "") + "</div></div>";
    }
    if (!s) return "";
    return '<div class="origin"><img src="' + SC.photo(s, 480) + '" alt="' + SC.esc(s.alt) + '" loading="lazy"><div>' +
      '<span class="origin__label">The original photograph</span><h3>' + SC.esc(s.title) + "</h3>" +
      "<p>" + SC.esc(s.line) + "</p>" +
      (p.place ? '<a class="link" href="shop.html?place=' + encodeURIComponent(p.place) + '">More from ' + SC.esc(p.place.replace(/ National Park$/, "")) + "</a>" : "") + "</div></div>";
  }

  function details() {
    var pol = cfg.policies || {}, h = "";
    var desc = p.description || "";
    if (p.features && p.features.length) desc += "<ul>" + p.features.map(function (f) { return "<li><strong>" + SC.esc(f.name) + ".</strong> " + SC.esc(f.text) + "</li>"; }).join("") + "</ul>";
    if (desc) h += '<details open><summary>Details <i></i></summary><div class="acc__body">' + clean(desc) + "</div></details>";
    if (p.sizeGuide) h += '<details><summary>Size guide <i></i></summary><div class="acc__body" data-sg>' + sizeGuideHTML(p.sizeGuide, "in") + "</div></details>";
    if (p.care && p.care.length) h += '<details><summary>Care <i></i></summary><div class="acc__body"><ul>' + p.care.map(function (c) { return "<li>" + SC.esc(c) + "</li>"; }).join("") + "</ul></div></details>";
    h += '<details><summary>Shipping &amp; returns <i></i></summary><div class="acc__body">' +
      "<p>" + SC.esc(pol.shipping || "Every piece is made to order by Printify's production partners, then shipped to you. Delivery options and times are shown at checkout.") + "</p>" +
      "<p>" + SC.esc(pol.returns || "If something arrives damaged or misprinted, get in touch with your order number and a photo and we'll make it right.") + "</p>" +
      '<p><a class="link" href="faq.html#orders">Orders &amp; shipping FAQ</a></p></div></details>';
    return h;
  }

  // Defense in depth: the Worker already sanitizes descriptions; keep only simple tags here too.
  function clean(html) {
    var doc = new DOMParser().parseFromString("<div>" + html + "</div>", "text/html");
    var ok = { P: 1, BR: 1, UL: 1, OL: 1, LI: 1, STRONG: 1, B: 1, EM: 1, I: 1, H3: 1, H4: 1, TABLE: 1, THEAD: 1, TBODY: 1, TR: 1, TH: 1, TD: 1 };
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 1) {
          if (!ok[n.tagName]) { while (n.firstChild) node.insertBefore(n.firstChild, n); node.removeChild(n); walk(node); return; }
          while (n.attributes.length) n.removeAttribute(n.attributes[0].name);
          walk(n);
        } else if (n.nodeType !== 3) node.removeChild(n);
      });
    })(doc.body.firstChild);
    return doc.body.firstChild.innerHTML;
  }

  function render() {
    var t = TYPES[p.type] || TYPES.more;
    var kind = p.styles && p.type === "canvas" ? "Canvas" : p.kind || t.one;
    var lede = p.scene ? p.scene.line : t.blurb;
    $("[data-crumbs]").innerHTML = '<a href="shop.html">Shop</a><span aria-hidden="true">/</span><a href="shop.html?type=' + p.type + '">' + SC.esc(t.many) + '</a><span aria-hidden="true">/</span><span aria-current="page">' + SC.esc(p.name) + "</span>";
    $("[data-product]").innerHTML =
      '<div class="gallery"><div class="gallery__main" data-zoom title="Click to zoom"></div><div class="gallery__thumbs"></div></div>' +
      '<div class="info">' +
        "<h1>" + SC.esc(p.name) + "</h1>" +
        '<p class="info__kind">' + SC.esc(p.type === "shirts" || p.type === "hats" ? p.extra || kind : kind + (p.place && p.place !== p.name ? ", " + p.place : "")) + "</p>" +
        '<p class="info__price"></p>' +
        (lede ? '<p class="info__lede">' + SC.esc(lede) + "</p>" : "") +
        '<div data-options></div>' +
        '<div class="buy">' +
          '<p class="buy__avail" data-avail hidden>This option is sold out right now. Try another size or color.</p>' +
          '<a class="btn btn--dark btn--block" data-buy href="' + SC.esc(p.buyUrl || cfg.popupUrl || "#") + '">Buy now ' + SC.arrow + "</a>" +
          '<p class="buy__note"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z"/></svg>Secure checkout on our Printify store, where you\'ll confirm your options. Made to order and shipped to you.</p>' +
        "</div>" +
        '<div class="acc">' + details() + "</div>" +
        originHTML() +
      "</div>";
    variant = current();
    renderGallery(); renderOptions(); renderPrice();
    meta();
  }

  function meta() {
    var t = TYPES[p.type] || TYPES.more;
    var title = p.name + (p.place && p.place !== p.name ? ", " + p.place : "") + " | " + (p.kind || t.one) + " | Shorecrest";
    document.title = title;
    var desc = (p.scene ? p.scene.line + " " : "") + "Made to order from an original Shorecrest photograph. " + (p.kind || t.one) + " from " + store.money(p.priceMin) + ".";
    setMeta("description", desc); setOg("og:title", title); setOg("og:description", desc); setOg("og:image", store.img(p.images[0].src, 1200));
    var ld = { "@context": "https://schema.org", "@type": "Product", name: p.title, image: p.images.slice(0, 4).map(function (i) { return i.src; }),
      description: desc, brand: { "@type": "Brand", name: "Shorecrest" },
      offers: { "@type": "AggregateOffer", priceCurrency: cfg.currency || "USD", lowPrice: (p.priceMin / 100).toFixed(2), highPrice: (p.priceMax / 100).toFixed(2), offerCount: p.variants.length, availability: "https://schema.org/InStock", url: location.href } };
    var s = $("#ld-product") || document.head.appendChild(Object.assign(document.createElement("script"), { id: "ld-product", type: "application/ld+json" }));
    s.textContent = JSON.stringify(ld);
  }
  function setMeta(n, v) { var m = $('meta[name="' + n + '"]'); if (m) m.setAttribute("content", v); }
  function setOg(n, v) { var m = $('meta[property="' + n + '"]'); if (m) m.setAttribute("content", v); }

  function syncURL() {
    var q = new URLSearchParams(location.search);
    q.set("id", p.id);
    if (variant) q.set("v", variant.id); else q.delete("v");
    history.replaceState(null, "", location.pathname + "?" + q.toString());
  }

  function related() {
    var pool = data.products.filter(function (x) { return x.primaryId !== (p.primaryId || p.id) && x.id !== (p.primaryId || p.id); });
    var same = pool.filter(function (x) { return x.type === p.type && p.place && x.place === p.place; });
    var type = pool.filter(function (x) { return x.type === p.type && same.indexOf(x) < 0; });
    var other = pool.filter(function (x) { return x.type !== p.type && p.place && x.place === p.place; });
    var list = same.concat(other, type, pool).filter(function (x, i, a) { return a.indexOf(x) === i; }).slice(0, 4);
    if (!list.length) return;
    $("[data-related]").innerHTML = list.map(store.card).join("");
    $("[data-rel-link]").href = "shop.html?type=" + p.type;
    $("[data-related-wrap]").hidden = false;
    SC.fadeImages($("[data-related]"));
  }

  // Products the Worker has only listed so far get their full details (all variants and photos) here.
  function ensureFull(prod) {
    if (!prod.partial || !cfg.apiBase) return Promise.resolve(prod);
    return fetch(cfg.apiBase.replace(/\/+$/, "") + "/api/products/" + encodeURIComponent(prod.id))
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        var f = j.product;
        if (f && !f.partial) {
          ["options", "variants", "images", "priceMin", "priceMax", "description", "sizeGuide", "care", "features"].forEach(function (k) { if (f[k] != null) prod[k] = f[k]; });
          prod.partial = false;
        }
        return prod;
      })
      .catch(function () { return prod; });
  }

  function show(prod, keep) {
    if (prod.partial) { ensureFull(prod).then(function (p2) { if (!p2.partial) show(p2, keep); else showNow(p2, keep); }); return; }
    showNow(prod, keep);
  }

  function showNow(prod, keep) {
    var prevLabel = keep && variant ? label(variant) : "";
    p = prod;
    var start = null, vid = Number(SC.param("v"));
    if (!keep && vid) start = p.variants.filter(function (v) { return v.id === vid; })[0];
    if (!start && prevLabel) start = p.variants.filter(function (v) { return v.title === prevLabel || label(v) === prevLabel; })[0];
    if (!start) start = p.variants.filter(function (v) { return v.default && v.available; })[0] || p.variants.filter(function (v) { return v.available; })[0] || p.variants[0];
    selFromVariant(start);
    imgIndex = 0;
    render();
    syncURL();
    SC.refresh();
  }

  function bind() {
    var root = $("[data-product]");
    root.addEventListener("click", function (e) {
      var b = e.target.closest("[data-val]");
      if (b) { choose(+b.getAttribute("data-opt"), +b.getAttribute("data-val")); return; }
      var st = e.target.closest("[data-style]");
      if (st && st.getAttribute("data-style") !== p.id) { var next = data.byId[st.getAttribute("data-style")]; if (next) show(next, true); return; }
      var th = e.target.closest(".gallery__thumbs [data-i]");
      if (th) { imgIndex = +th.getAttribute("data-i"); renderGallery(); return; }
      var u = e.target.closest("[data-unit]");
      if (u) { $("[data-sg]").innerHTML = sizeGuideHTML(p.sizeGuide, u.getAttribute("data-unit")); return; }
      var z = e.target.closest("[data-zoom]");
      if (z && SC.fine) z.classList.toggle("is-zoom");
    });
    root.addEventListener("pointermove", function (e) {
      var z = e.target.closest(".gallery__main.is-zoom");
      if (!z) return;
      var r = z.getBoundingClientRect(), img = $("img", z);
      img.style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + "% " + ((e.clientY - r.top) / r.height * 100) + "%";
    });
    root.addEventListener("keydown", function (e) {
      if (!e.target.closest(".gallery")) return;
      var n = store.imagesFor(p, variant ? variant.id : null).length;
      if (e.key === "ArrowRight") { imgIndex = (imgIndex + 1) % n; renderGallery(); }
      if (e.key === "ArrowLeft") { imgIndex = (imgIndex - 1 + n) % n; renderGallery(); }
    });
  }

  function notFound() {
    $("[data-product]").innerHTML = '<div class="note-box" style="grid-column:1/-1"><p class="h3">This piece wandered off.</p><p>It may have sold out or moved. The rest of the collection is right this way.</p><a class="btn btn--dark" href="shop.html">Browse the shop</a></div>';
  }

  SC.onReady(function () {
    var id = SC.param("id");
    store.load().then(function (d) {
      data = d;
      var prod = id && d.byId[id];
      if (!prod) { notFound(); return; }
      bind();
      show(prod, false);
      related();
    }).catch(function () {
      $("[data-product]").innerHTML = store.errorNote();
      var r = $("[data-retry]");
      if (r) r.addEventListener("click", function () { location.reload(); });
    });
  });
})();
