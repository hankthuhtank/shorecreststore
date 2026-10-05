/* ==========================================================================
   Our story: the road map (drawn once when it comes into view) + photographs.
   ========================================================================== */
(function () {
  "use strict";
  var SC = window.SC, $ = SC.$, $$ = SC.$$;

  // [lat, lon, label side]
  var PLACES = {
    "Big Sur": [36.27, -121.81, "l"], "Golden Gate": [37.82, -122.48, "l"], "Yosemite": [37.75, -119.59, "r"],
    "Sequoia": [36.49, -118.57, "r"], "Tahoe": [39.09, -120.03, "r"], "Shasta": [41.41, -122.19, "r"],
    "Crater Lake": [42.94, -122.1, "r"], "Oregon": [44.4, -121.95, "r"], "Rainier": [46.85, -121.76, "r"],
    "North Cascades": [48.7, -121.2, "r"], "Glacier": [48.7, -113.72, "r"], "Yellowstone": [44.43, -110.59, "r"],
    "Grand Tetons": [43.74, -110.8, "l"], "Colorado": [39.5, -106.0, "r"], "Utah": [38.6, -110.0, "r"],
    "Grand Canyon": [36.4, -111.9, "r"], "Zion": [37.3, -113.03, "l"]
  };
  // The order the line connects them. Reorder to match the trip.
  var ROUTE = ["Big Sur", "Golden Gate", "Tahoe", "Shasta", "Crater Lake", "Oregon", "Rainier", "North Cascades",
    "Glacier", "Yellowstone", "Grand Tetons", "Colorado", "Utah", "Grand Canyon", "Zion", "Sequoia", "Yosemite"];
  var COAST = [[31.4,-116.62],[31.87,-116.68],[32.3,-117.05],[32.53,-117.12],[32.7,-117.26],[33,-117.28],[33.2,-117.39],[33.45,-117.7],[33.6,-117.9],[33.72,-118.1],[33.74,-118.4],[33.85,-118.4],[34.01,-118.5],[34.03,-118.8],[34.09,-119.06],[34.2,-119.25],[34.4,-119.7],[34.42,-120.1],[34.45,-120.47],[34.58,-120.64],[34.9,-120.64],[35.17,-120.75],[35.37,-120.87],[35.66,-121.28],[35.88,-121.46],[36.1,-121.63],[36.3,-121.9],[36.52,-121.95],[36.62,-121.9],[36.8,-121.79],[36.97,-122.03],[37.11,-122.32],[37.5,-122.5],[37.78,-122.51],[37.81,-122.42],[37.6,-122.25],[37.45,-122.1],[37.7,-122.22],[37.9,-122.32],[38.05,-122.26],[38.02,-122.45],[37.85,-122.48],[37.9,-122.7],[38,-123],[38.3,-123.05],[38.95,-123.73],[39.4,-123.82],[40,-124.07],[40.44,-124.41],[40.8,-124.2],[41.3,-124.1],[41.75,-124.2],[42,-124.21],[42.4,-124.42],[42.84,-124.56],[43.35,-124.35],[43.9,-124.12],[44.6,-124.06],[45,-124.01],[45.5,-123.96],[46,-123.93],[46.25,-124.05],[46.7,-124.1],[47,-124.17],[47.4,-124.33],[47.9,-124.63],[48.38,-124.72],[48.2,-124.2],[48.12,-123.4],[48.15,-122.95],[47.9,-122.68],[47.6,-122.58],[47.3,-122.62],[47.08,-122.9],[47.28,-122.45],[47.6,-122.36],[47.95,-122.22],[48.3,-122.45],[48.75,-122.5],[49,-122.76],[49.1,-123.08],[49.3,-123.15],[49.6,-123.35]];
  var ISLAND = [[48.31,-123.55],[48.42,-123.27],[48.75,-123.52],[49.15,-123.88],[49.62,-124.55],[49.62,-125.5],[49.05,-125.5],[48.85,-125.15],[48.58,-124.45],[48.4,-123.9]];
  var RANGES = [
    [[42,-122.2],[43,-122],[44,-121.8],[45,-121.7],[46,-121.5],[47,-121.4],[48,-121.2],[48.9,-121]],
    [[40.2,-121],[39.5,-120.4],[38.7,-119.9],[37.9,-119.4],[37.2,-118.8],[36.4,-118.3],[35.7,-118.1]],
    [[41.8,-123.6],[40.8,-123.4],[39.8,-122.9]],
    [[49,-114.2],[48,-113.5],[47,-112.8],[46,-112.6],[45,-111.5],[44.2,-110.9],[43.5,-110.8],[42.8,-110.2]],
    [[41,-106.3],[40,-105.8],[39.2,-106.1],[38.4,-106.3],[37.6,-106.6],[37,-105.4]],
    [[42,-111.6],[41,-111.8],[40.6,-111],[40.7,-110]],
    [[47,-115.4],[46,-115],[45,-114.8],[44.2,-114.6]],
    [[34.4,-118.9],[34.3,-117.6],[33.6,-116.7],[32.9,-116.5]]
  ];

  function proj(p) { return [(p[1] + 125.5) * 41.5, (49.6 - p[0]) * 55]; }
  function poly(pts) { return pts.map(function (p, i) { var q = proj(p); return (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1); }).join(""); }
  function spline(pts, closed, k) {
    var n = pts.length, d = "M" + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
    function g(i) { return closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]; }
    for (var i = 0; i < (closed ? n : n - 1); i++) {
      var p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
      d += "C" + (p1[0] + (p2[0] - p0[0]) * k / 6).toFixed(1) + " " + (p1[1] + (p2[1] - p0[1]) * k / 6).toFixed(1) + " " +
        (p2[0] - (p3[0] - p1[0]) * k / 6).toFixed(1) + " " + (p2[1] - (p3[1] - p1[1]) * k / 6).toFixed(1) + " " + p2[0].toFixed(1) + " " + p2[1].toFixed(1);
    }
    return d + (closed ? "Z" : "");
  }

  function initMap() {
    var svg = $("[data-map]");
    if (!svg) return;
    $(".map__land", svg).setAttribute("d", poly(COAST) + "L920 0L920 1000Z" + poly(ISLAND) + "Z");
    $(".map__coast", svg).setAttribute("d", poly(COAST) + poly(ISLAND) + "Z");

    var seed = 3, peaks = "";
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    RANGES.forEach(function (rg) {
      var P = rg.map(proj);
      for (var i = 0; i < P.length - 1; i++) {
        var a = P[i], b = P[i + 1], steps = Math.max(1, Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / 17));
        for (var s = 0; s < steps; s++) {
          var t = s / steps, x = a[0] + (b[0] - a[0]) * t + (rnd() - 0.5) * 12, y = a[1] + (b[1] - a[1]) * t + (rnd() - 0.5) * 8, z = 0.75 + rnd() * 0.6;
          peaks += "M" + (x - 6 * z).toFixed(1) + " " + y.toFixed(1) + "L" + x.toFixed(1) + " " + (y - 9 * z).toFixed(1) + "L" + (x + 6 * z).toFixed(1) + " " + y.toFixed(1);
        }
      }
    });
    $(".map__peaks", svg).innerHTML = '<path d="' + peaks + '"/>';

    var cont = "";
    [[44.5, -116.5, 9], [38.5, -114.5, 8], [41.5, -107.5, 7], [35.2, -116.5, 6]].forEach(function (c, ci) {
      var C = proj(c);
      for (var r = 1; r <= c[2]; r++) {
        var pts = [];
        for (var a2 = 0; a2 < 40; a2++) {
          var th = a2 / 40 * Math.PI * 2, rr = r * 16 * (1 + 0.22 * Math.sin(3 * th + ci + r * 0.2) + 0.1 * Math.sin(5 * th - ci));
          pts.push([C[0] + Math.cos(th) * rr * 1.3, C[1] + Math.sin(th) * rr]);
        }
        cont += '<path d="' + spline(pts, true, 1) + '"/>';
      }
    });
    $(".map__contours", svg).innerHTML = cont;

    var pts = ROUTE.map(function (n) { return proj(PLACES[n]); });
    var route = $(".map__route", svg), d = spline(pts, true, 0.85);
    route.setAttribute("d", d);
    $(".map__route-bg", svg).setAttribute("d", d);
    var L = route.getTotalLength();
    route.style.strokeDasharray = L + " " + L;
    route.style.strokeDashoffset = L;

    var samples = [];
    for (var s2 = 0; s2 <= L; s2 += 4) { var pt = route.getPointAtLength(s2); samples.push([s2, pt.x, pt.y]); }
    var html = "", at = [];
    ROUTE.forEach(function (name, i) {
      var q = pts[i], best = 0, bd = 1e9;
      samples.forEach(function (m) { var dd = (m[1] - q[0]) * (m[1] - q[0]) + (m[2] - q[1]) * (m[2] - q[1]); if (dd < bd) { bd = dd; best = m[0]; } });
      at.push(i === 0 ? 0 : best / L);
      var left = PLACES[name][2] === "l";
      html += '<g class="map__pin"><circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="5"/>' +
        '<text x="' + (q[0] + (left ? -12 : 12)).toFixed(1) + '" y="' + (q[1] + 5).toFixed(1) + '" text-anchor="' + (left ? "end" : "start") + '">' + name + "</text></g>";
    });
    $(".map__pins", svg).innerHTML = html;
    var pins = $$(".map__pin", svg);

    function draw() {
      var dur = SC.reduce ? 0 : 5500;
      route.style.strokeDashoffset = 0;
      pins.forEach(function (pin, i) { setTimeout(function () { pin.classList.add("is-on"); }, at[i] * dur * 0.95); });
    }
    if (!("IntersectionObserver" in window)) return draw();
    var ob = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { ob.disconnect(); draw(); }
    }, { threshold: 0.35 });
    ob.observe(svg);
  }

  function initPhotos() {
    var el = $("[data-photos]");
    if (!el) return;
    var picks = ["SC-003", "SC-019", "SC-045", "SC-061", "SC-031", "SC-035", "SC-022", "SC-058"].map(function (id) { return SC.byId[id]; }).filter(Boolean);
    el.innerHTML = picks.map(function (s, i) {
      return '<figure class="photo" data-reveal style="--d:' + (i % 4) * 90 + '"><div class="photo__img"><img src="' + SC.photo(s, 960) + '" alt="' + SC.esc(s.alt) + '" loading="lazy" decoding="async"></div>' +
        "<figcaption><span>" + SC.esc(s.title) + "</span>" + SC.esc(s.place) + "</figcaption></figure>";
    }).join("");
    SC.reveal(el);
  }

  SC.onReady(function () { initMap(); initPhotos(); });
})();
