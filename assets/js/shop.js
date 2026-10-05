/* ==========================================================================
   Shop: filter by type and place, search, sort. State lives in the URL.
   ========================================================================== */
(function () {
  "use strict";
  var SC = window.SC, $ = SC.$, $$ = SC.$$, store = SC.store, TYPES = store.TYPES;
  var q = new URLSearchParams(location.search);
  var state = { type: TYPES[q.get("type")] ? q.get("type") : "all", q: q.get("q") || "", place: q.get("place") || "", sort: q.get("sort") || "featured" };
  var data = null;

  // Heading follows the type in the URL; set before the headline is split into lines.
  function heading() {
    var title = $("[data-shop-title]"), lede = $("[data-shop-lede]");
    if (state.type !== "all") {
      var t = TYPES[state.type];
      title.innerHTML = SC.esc(t.many) + " <em>from the road.</em>";
      lede.textContent = t.blurb + " Each one made from an original photograph.";
      document.title = t.many + " | Shorecrest";
    }
  }
  heading();

  function haystack(p) {
    return [p.title, p.name, p.place, p.kind, TYPES[p.type].many, TYPES[p.type].one, p.scene && p.scene.title, p.scene && p.scene.place, (p.tags || []).join(" ")]
      .join(" ").toLowerCase();
  }

  function filtered() {
    var terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    var list = data.products.filter(function (p) {
      if (state.type !== "all" && p.type !== state.type) return false;
      if (state.place && p.place !== state.place) return false;
      if (terms.length) { var h = p._hay || (p._hay = haystack(p)); for (var i = 0; i < terms.length; i++) if (h.indexOf(terms[i]) < 0) return false; }
      return true;
    });
    var price = function (p) { return p.groupMin || p.priceMin; };
    var sorts = {
      featured: function (a, b) { return a.rank - b.rank; },
      new: function (a, b) { return (b.popupId || 0) - (a.popupId || 0) || (b.created || "").localeCompare(a.created || ""); },
      low: function (a, b) { return price(a) - price(b) || a.rank - b.rank; },
      high: function (a, b) { return price(b) - price(a) || a.rank - b.rank; }
    };
    return list.sort(sorts[state.sort] || sorts.featured);
  }

  function syncURL() {
    var p = new URLSearchParams();
    if (state.type !== "all") p.set("type", state.type);
    if (state.place) p.set("place", state.place);
    if (state.q) p.set("q", state.q);
    if (state.sort !== "featured") p.set("sort", state.sort);
    var s = p.toString();
    history.replaceState(null, "", location.pathname + (s ? "?" + s : ""));
  }

  function renderChips() {
    var counts = { all: 0 };
    data.products.forEach(function (p) {
      if (state.place && p.place !== state.place) return;
      counts.all++; counts[p.type] = (counts[p.type] || 0) + 1;
    });
    var types = ["all"].concat(store.ORDER).concat(counts.more ? ["more"] : []);
    $("[data-chips]").innerHTML = types.map(function (t) {
      var label = t === "all" ? "Everything" : TYPES[t].many;
      return '<button class="chip" type="button" data-type="' + t + '" aria-pressed="' + (state.type === t) + '">' +
        (t === "all" ? "" : store.typeIcon(t)) + label + " <small>" + (counts[t] || 0) + "</small></button>";
    }).join("");
  }

  function renderPlaces() {
    var sel = $("[data-place]");
    var names = Object.keys(data.places).sort();
    sel.innerHTML = '<option value="">All places</option>' + names.map(function (n) {
      return '<option value="' + SC.esc(n) + '"' + (n === state.place ? " selected" : "") + ">" + SC.esc(n) + "</option>";
    }).join("");
    if (state.place && names.indexOf(state.place) < 0) state.place = "";
  }

  function apply(animate) {
    var list = filtered(), grid = $("[data-grid]");
    var label = state.type === "all" ? "pieces" : TYPES[state.type].many.toLowerCase();
    $("[data-status]").textContent = list.length + " " + (list.length === 1 && state.type === "all" ? "piece" : label);
    var pills = [];
    if (state.place) pills.push('<span class="pill">' + SC.esc(state.place) + '<button type="button" data-clear="place" aria-label="Clear place filter"><svg viewBox="0 0 10 10"><path d="M2 2l6 6M8 2L2 8"/></svg></button></span>');
    if (state.q) pills.push('<span class="pill">"' + SC.esc(state.q) + '"<button type="button" data-clear="q" aria-label="Clear search"><svg viewBox="0 0 10 10"><path d="M2 2l6 6M8 2L2 8"/></svg></button></span>');
    $("[data-active]").innerHTML = pills.join(" ");
    if (!list.length) {
      grid.innerHTML = '<div class="note-box"><p class="h3">Nothing matches that yet.</p><p>Try another place or word, or browse everything.</p><button class="btn btn--dark" type="button" data-reset>Show everything</button></div>';
    } else {
      grid.innerHTML = list.map(store.card).join("");
      if (animate) $$(".pcard", grid).forEach(function (c) { c.classList.add("is-in-anim"); });
      SC.fadeImages(grid);
    }
    renderChips();
    syncURL();
    SC.refresh();
  }

  function bind() {
    $("[data-chips]").addEventListener("click", function (e) {
      var b = e.target.closest("[data-type]");
      if (!b) return;
      state.type = b.getAttribute("data-type");
      apply(true);
    });
    var input = $("[data-search]");
    input.value = state.q;
    input.addEventListener("input", SC.debounce(function () { state.q = input.value.trim(); apply(false); }, 180));
    $("[data-place]").addEventListener("change", function (e) { state.place = e.target.value; apply(true); });
    var sort = $("[data-sort]");
    sort.value = state.sort;
    sort.addEventListener("change", function () { state.sort = sort.value; apply(true); });
    document.addEventListener("click", function (e) {
      var c = e.target.closest("[data-clear]");
      if (c) { var k = c.getAttribute("data-clear"); state[k] = ""; if (k === "q") input.value = ""; if (k === "place") $("[data-place]").value = ""; apply(true); }
      if (e.target.closest("[data-reset]")) { state = { type: "all", q: "", place: "", sort: state.sort }; input.value = ""; $("[data-place]").value = ""; apply(true); }
    });
  }

  function load() {
    $("[data-grid]").innerHTML = store.skeletons(8);
    store.load().then(function (d) {
      data = d;
      renderPlaces();
      bind();
      apply(true);
    }).catch(function () {
      $("[data-status]").textContent = "";
      $("[data-grid]").innerHTML = store.errorNote();
      var r = $("[data-retry]");
      if (r) r.addEventListener("click", load);
    });
  }

  SC.onReady(load);
})();
