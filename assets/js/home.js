/* ==========================================================================
   Home
   ========================================================================== */
(function () {
  "use strict";
  var SC = window.SC, $ = SC.$, $$ = SC.$$, store = SC.store, html = document.documentElement;

  function imgReady(img, max) {
    return new Promise(function (res) {
      if (!img || (img.complete && img.naturalWidth)) return res();
      var t = setTimeout(res, max || 5000);
      img.addEventListener("load", function () { clearTimeout(t); res(); }, { once: true });
      img.addEventListener("error", function () { clearTimeout(t); res(); }, { once: true });
    });
  }

  /* ---------------------------------------------------------------- hero */
  function initHero() {
    setTimeout(function () { $$(".hero [data-manual]").forEach(function (el) { el.classList.add("is-in"); }); }, 80);
    var canvas = $(".hero__gl"), img = $(".hero__img"), hero = $(".hero");
    if (!canvas || SC.reduce || !SC.heroWater) return;
    imgReady(img, 8000).then(function () {
      if (!img.naturalWidth) return;
      var water = SC.heroWater(canvas, img, { horizon: 0.556, focus: [0.5, 0.55], hitArea: hero });
      if (!water) return;
      html.classList.add("gl-on");
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (es) { es[0].isIntersecting ? water.play() : water.pause(); }).observe(hero);
      }
      SC.scene(hero, function (p) { water.setZoom(1 + Math.max(0, p - 0.5) * 0.12); });
    });
  }

  /* ---------------------------------------------------------------- categories */
  var CYCLE = { canvas: true }; // tiles that cycle through every design of their type

  // Shuffle, then nudge apart designs from the same place so neighbors look different.
  function mixed(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    for (var k = 1; k < a.length; k++) {
      if (a[k].place && a[k].place === a[k - 1].place) {
        for (var m = k + 1; m < a.length; m++) if (a[m].place !== a[k - 1].place) { var s = a[k]; a[k] = a[m]; a[m] = s; break; }
      }
    }
    return a;
  }
  function tileImg(src) {
    return '<img class="fade-img" src="' + SC.esc(src) + '" alt="" decoding="async">';
  }
  function renderCats(d) {
    var el = $("[data-cats]");
    if (!el) return;
    var cycles = [];
    el.innerHTML = store.ORDER.map(function (type, i) {
      var t = store.TYPES[type], media = store.typeIcon(type);
      if (d && CYCLE[type]) {
        var srcs = mixed(d.products.filter(function (p) { return p.type === type; }))
          .map(function (p) { return store.pick(p, ["front"]).src; });
        if (srcs.length) { media = tileImg(srcs[0]); cycles[i] = srcs; }
      } else if (d) {
        var src = store.typeImage(d, type);
        if (src) media = tileImg(src);
      }
      return '<a class="cat" href="shop.html?type=' + type + '" style="--n:' + i + '">' +
        '<div class="cat__img">' + media + "</div>" +
        '<div class="cat__label"><span class="cat__name">' + t.many + "</span></div>" +
        '<p class="cat__blurb">' + SC.esc(t.blurb) + "</p></a>";
    }).join("");
    SC.fadeImages(el);
    $$(".cat__img", el).forEach(function (box, i) { if (cycles[i]) cycle(box, cycles[i]); });
  }

  // Shows each design for a few seconds, loading the next one before it fades in.
  function cycle(box, srcs) {
    if (srcs.length < 2 || SC.reduce) return;
    var i = 0, visible = false, busy = false, cur = $("img", box);
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(box);
    else visible = true;
    setInterval(function () {
      if (!visible || document.hidden || busy || !cur) return;
      busy = true;
      var j = (i + 1) % srcs.length, pre = new Image();
      pre.onload = function () {
        var next = document.createElement("img");
        next.alt = ""; next.className = "is-off"; next.src = srcs[j];
        box.appendChild(next);
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            next.classList.remove("is-off");
            cur.classList.add("is-off");
            setTimeout(function () { cur.remove(); cur = next; i = j; busy = false; }, 800);
          });
        });
      };
      pre.onerror = function () { srcs.splice(j, 1); busy = false; };
      pre.src = srcs[j];
    }, 3600);
  }

  /* ---------------------------------------------------------------- featured: a mix across types */
  function featured(d) {
    var cfg = SC.cfg;
    if (cfg.featured && cfg.featured.length) {
      return cfg.featured.map(function (id) { var p = d.byId[id]; return p && d.byId[p.primaryId || p.id]; }).filter(Boolean).slice(0, 8);
    }
    var buckets = {}, used = {}, out = [];
    d.products.forEach(function (p) { (buckets[p.type] = buckets[p.type] || []).push(p); });
    ["canvas", "shirts", "puzzles", "mugs", "canvas", "hats", "puzzles", "canvas"].forEach(function (type) {
      var b = buckets[type] || [];
      for (var i = 0; i < b.length; i++) if (!used[b[i].id]) { out.push(b[i]); used[b[i].id] = 1; break; }
    });
    d.products.forEach(function (p) { if (out.length < 8 && !used[p.id]) { out.push(p); used[p.id] = 1; } });
    return out.slice(0, 8);
  }
  function renderFeatured(d) {
    var el = $("[data-featured]");
    if (!el) return;
    el.innerHTML = featured(d).map(store.card).join("");
    $$(".pcard", el).forEach(function (c) { c.classList.add("is-in-anim"); });
    SC.fadeImages(el);
  }

  /* ---------------------------------------------------------------- places */
  function renderPlaces(d) {
    var el = $("[data-places]");
    if (!el) return;
    var names = Object.keys(d.places).sort(function (a, b) { return d.places[b] - d.places[a] || a.localeCompare(b); });
    el.innerHTML = names.map(function (place) {
      var prod = d.products.filter(function (p) { return p.place === place; })[0];
      var scenes = SC.catalog.filter(function (s) { return prod && s.place === prod.collection; });
      var pick = (prod && prod.scene) || scenes.filter(function (s) { return s.featured >= 0; })[0] || scenes[0];
      var img = pick ? SC.photo(pick, 960) : store.img(prod.images[0].src, 600);
      var alt = pick ? pick.alt : "";
      var short = place.replace(/\s+National Park$/, ""), np = short !== place;
      return '<a class="place" href="shop.html?place=' + encodeURIComponent(place) + '">' +
        '<div class="place__img"><img class="fade-img" src="' + SC.esc(img) + '" alt="' + SC.esc(alt) + '" loading="lazy" decoding="async" draggable="false"></div>' +
        '<p class="place__name"><span>' + SC.esc(short) + (np ? '<small>National Park</small>' : "") + '</span><span class="place__count">' + d.places[place] + (d.places[place] === 1 ? " design" : " designs") + "</span></p></a>";
    }).join("");
    SC.fadeImages(el);
    strip(el);
  }

  function strip(el) {
    var prev = $("[data-strip-prev]"), next = $("[data-strip-next]");
    function step() { var c = $(".place", el); return c ? (c.offsetWidth + 20) * 2 : 400; }
    function sync() {
      if (!prev) return;
      prev.disabled = el.scrollLeft < 8;
      next.disabled = el.scrollLeft + el.clientWidth > el.scrollWidth - 8;
    }
    if (prev) prev.addEventListener("click", function () { el.scrollBy({ left: -step(), behavior: "smooth" }); });
    if (next) next.addEventListener("click", function () { el.scrollBy({ left: step(), behavior: "smooth" }); });
    el.addEventListener("scroll", sync, { passive: true });
    sync();
    // drag to scroll with a mouse
    var down = false, startX = 0, startL = 0, moved = 0;
    el.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse") return;
      down = true; moved = 0; startX = e.clientX; startL = el.scrollLeft;
    });
    window.addEventListener("pointermove", function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      if (moved > 4) { el.classList.add("is-drag"); el.scrollLeft = startL - dx; }
    });
    window.addEventListener("pointerup", function () {
      if (!down) return;
      down = false;
      setTimeout(function () { el.classList.remove("is-drag"); }, 0);
    });
    el.addEventListener("click", function (e) { if (moved > 4) { e.preventDefault(); moved = 0; } }, true);
  }

  /* ---------------------------------------------------------------- boot */
  function load() {
    var feat = $("[data-featured]");
    renderCats(null);
    if (feat) feat.innerHTML = store.skeletons(8);
    store.load().then(function (d) {
      renderCats(d);
      renderFeatured(d);
      renderPlaces(d);
      SC.refresh();
    }).catch(function () {
      if (feat) feat.innerHTML = store.errorNote();
      var retry = $("[data-retry]");
      if (retry) retry.addEventListener("click", load);
    });
  }

  SC.onReady(function () {
    initHero();
    load();
  });
})();
