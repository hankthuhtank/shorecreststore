/* ==========================================================================
   Shorecrest core: smooth scroll, scroll scenes, reveals, header, menus.
   ========================================================================== */
(function () {
  "use strict";

  var SC = (window.SC = window.SC || {});
  var html = document.documentElement;
  html.classList.add("js");

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  SC.reduce = reduce;
  SC.fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  SC.cfg = window.SC_CONFIG || {};
  SC.catalog = window.SC_CATALOG || [];

  /* ---------------------------------------------------------------- utils */
  SC.clamp = function (v, a, b) { a = a == null ? 0 : a; b = b == null ? 1 : b; return v < a ? a : v > b ? b : v; };
  SC.lerp = function (a, b, t) { return a + (b - a) * t; };
  SC.range = function (v, a, b) { return SC.clamp((v - a) / (b - a)); };
  SC.ease = {
    out: function (t) { return 1 - Math.pow(1 - t, 3); },
    io: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  };
  SC.$ = function (s, c) { return (c || document).querySelector(s); };
  SC.$$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  SC.debounce = function (fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; };
  SC.esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  SC.param = function (k) { return new URLSearchParams(location.search).get(k); };
  SC.arrow = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6"/></svg>';

  /* Brand photo catalog helpers (the 65 original photographs) */
  SC.byId = {};
  SC.catalog.forEach(function (s) { SC.byId[s.id] = s; });
  SC.photo = function (s, w) {
    var list = s.photo, pick = list[list.length - 1];
    for (var i = 0; i < list.length; i++) { if (list[i] >= w) { pick = list[i]; break; } }
    return "assets/img/photo/" + s.id + "-" + pick + ".webp";
  };
  SC.photoSet = function (s, max) {
    return s.photo.filter(function (w) { return !max || w <= max; })
      .map(function (w) { return "assets/img/photo/" + s.id + "-" + w + ".webp " + w + "w"; }).join(", ");
  };

  /* ---------------------------------------------------------------- frame loop + smooth scroll */
  var tasks = [];
  SC.raf = function (fn) { tasks.push(fn); return function () { var i = tasks.indexOf(fn); if (i > -1) tasks.splice(i, 1); }; };

  var lenis = null;
  if (!reduce && typeof window.Lenis === "function") {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
    html.classList.add("lenis");
  }
  SC.lenis = lenis;

  SC.scroll = { y: window.scrollY, last: window.scrollY, dir: 1 };
  var dirty = true;
  function onScroll(y) {
    if (Math.abs(y - SC.scroll.last) > 0.5) SC.scroll.dir = y > SC.scroll.last ? 1 : -1;
    SC.scroll.last = y;
    SC.scroll.y = y;
    dirty = true;
  }
  if (lenis) lenis.on("scroll", function (e) { onScroll(e.scroll); });
  else window.addEventListener("scroll", function () { onScroll(window.scrollY); }, { passive: true });

  SC.scrollTo = function (target, opts) {
    opts = opts || {};
    if (lenis) { lenis.scrollTo(target, { duration: opts.duration || 1.4, offset: opts.offset || 0 }); return; }
    var y = typeof target === "number" ? target : target.getBoundingClientRect().top + window.scrollY + (opts.offset || 0);
    window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
  };

  var lastT = performance.now();
  function frame(t) {
    var dt = Math.min(64, t - lastT);
    lastT = t;
    if (lenis) lenis.raf(t);
    if (dirty) { dirty = false; runScenes(); updateHeader(); }
    for (var i = 0; i < tasks.length; i++) tasks[i](t, dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------------------------------------------------------------- scroll scenes
     SC.scene(el, fn) calls fn(progress 0..1) while el travels through the viewport. */
  var scenes = [];
  SC.scene = function (el, fn) {
    if (!el) return null;
    var s = { el: el, fn: fn, top: 0, h: 0, p: -1 };
    scenes.push(s);
    measure(s);
    dirty = true;
    return s;
  };
  function measure(s) { var r = s.el.getBoundingClientRect(); s.top = r.top + SC.scroll.y; s.h = s.el.offsetHeight; }
  function runScenes() {
    var vh = window.innerHeight, y = SC.scroll.y;
    for (var i = 0; i < scenes.length; i++) {
      var s = scenes[i], p = SC.clamp((y + vh - s.top) / (vh + s.h));
      if (p !== s.p) { s.p = p; s.fn(p); }
    }
  }
  SC.refresh = function () { scenes.forEach(measure); scenes.forEach(function (s) { s.p = -1; }); measureThemes(); dirty = true; };
  var refreshSoon = SC.debounce(SC.refresh, 150);
  window.addEventListener("resize", refreshSoon);
  window.addEventListener("load", SC.refresh);
  if ("ResizeObserver" in window) new ResizeObserver(refreshSoon).observe(document.body);

  /* ---------------------------------------------------------------- text splitting (line rises) */
  function tokens(node, wraps, out) {
    node.childNodes.forEach(function (n) {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          out.push(/^\s+$/.test(part) ? { space: true } : { word: part, wraps: wraps.slice() });
        });
      } else if (n.nodeType === 1) {
        if (n.tagName === "BR") out.push({ br: true });
        else tokens(n, wraps.concat([n]), out);
      }
    });
    return out;
  }
  function wordHTML(t) {
    var h = SC.esc(t.word);
    for (var i = t.wraps.length - 1; i >= 0; i--) { var el = t.wraps[i].cloneNode(false); el.innerHTML = h; h = el.outerHTML; }
    return h;
  }
  SC.split = function (el) {
    if (!el._src) el._src = el.innerHTML;
    var holder = document.createElement("div");
    holder.innerHTML = el._src;
    var toks = tokens(holder, [], []);
    el.innerHTML = toks.map(function (t) {
      if (t.space) return " ";
      if (t.br) return '<br class="sw-br">';  // a real break, so words are measured where they'll actually sit
      return '<span class="sw">' + wordHTML(t) + "</span>";
    }).join("");
    var lines = [], cur = null, lastTop = null;
    SC.$$(".sw, .sw-br", el).forEach(function (w) {
      if (w.classList.contains("sw-br")) { cur = null; lastTop = null; return; }
      var top = w.offsetTop;
      if (!cur || lastTop === null || Math.abs(top - lastTop) > 4) { cur = []; lines.push(cur); lastTop = top; }
      cur.push(w.innerHTML);
    });
    // The trailing space keeps words apart in the text (screen readers, search) without changing the layout.
    el.innerHTML = lines.map(function (ws, i) {
      return '<span class="ln" style="--i:' + i + '"><span class="ln__in">' + ws.join(" ") + "</span> </span>";
    }).join("");
    el._splitW = el.clientWidth;
    el.classList.add("is-split");
  };
  var resplit = SC.debounce(function () {
    SC.$$("[data-split].is-split").forEach(function (el) { if (Math.abs(el.clientWidth - el._splitW) > 2) SC.split(el); });
  }, 200);
  window.addEventListener("resize", resplit);

  /* ---------------------------------------------------------------- reveals */
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.1 }) : null;
  SC.observe = function (el) { if (!el) return; if (io && !reduce) io.observe(el); else el.classList.add("is-in"); };
  SC.reveal = function (scope) { SC.$$("[data-reveal]:not([data-manual]), [data-split]:not([data-manual])", scope).forEach(SC.observe); };

  /* ---------------------------------------------------------------- logo */
  SC.logoSVG = function () {
    var L = window.SC_LOGO;
    if (!L) return "";
    return '<svg viewBox="' + L.viewBox + '" role="img" aria-label="Shorecrest"><title>Shorecrest</title>' +
      '<path class="logo-a" fill-rule="evenodd" d="' + L.tide + '"/><path class="logo-b" fill-rule="evenodd" d="' + L.pine + '"/></svg>';
  };
  function initLogos() {
    SC.$$("[data-logo]").forEach(function (el) { var svg = SC.logoSVG(); if (svg) el.innerHTML = svg; });
  }

  /* ---------------------------------------------------------------- header */
  var hdr, themed = [], hidden = false, anchorY = 0;
  function measureThemes() {
    themed = SC.$$("[data-header]").map(function (el) {
      var r = el.getBoundingClientRect();
      return { top: r.top + SC.scroll.y, bottom: r.bottom + SC.scroll.y, theme: el.getAttribute("data-header") };
    });
  }
  function themeAt(y) {
    for (var i = themed.length - 1; i >= 0; i--) if (y >= themed[i].top && y < themed[i].bottom) return themed[i].theme;
    return html.getAttribute("data-default-header") || "light";
  }
  function updateHeader() {
    if (!hdr) return;
    var y = SC.scroll.y;
    hdr.setAttribute("data-theme", themeAt(y + 36));
    hdr.classList.toggle("is-scrolled", y > 30);
    var locked = html.classList.contains("menu-open") || hdr.classList.contains("drop-open");
    if (locked || y < 160) { hidden = false; anchorY = y; }
    else if (y - anchorY > 60) { hidden = true; anchorY = y; }
    else if (anchorY - y > 30) { hidden = false; anchorY = y; }
    else if ((SC.scroll.dir > 0 && y < anchorY) || (SC.scroll.dir < 0 && y > anchorY)) anchorY = y;
    hdr.classList.toggle("is-hidden", hidden);
    html.classList.toggle("hdr-shown", !hidden && y > 160);
  }

  function initDropdown() {
    var btn = SC.$(".nav-shop"), panel = SC.$(".drop");
    if (!btn || !panel) return;
    var closeT;
    function set(open) {
      hdr.classList.toggle("drop-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open && SC.store) SC.store.fillDropdown(panel);
      dirty = true;
    }
    btn.addEventListener("click", function (e) { e.preventDefault(); set(!hdr.classList.contains("drop-open")); });
    if (SC.fine) {
      [btn, panel].forEach(function (el) {
        el.addEventListener("pointerenter", function () { clearTimeout(closeT); set(true); });
        el.addEventListener("pointerleave", function () { closeT = setTimeout(function () { set(false); }, 220); });
      });
    }
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && hdr.classList.contains("drop-open")) { set(false); btn.focus(); } });
    document.addEventListener("click", function (e) { if (!hdr.contains(e.target)) set(false); });
  }

  function initMenu() {
    var btn = SC.$(".menu-btn");
    if (!btn) return;
    function set(open) {
      html.classList.toggle("menu-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      if (lenis) open ? lenis.stop() : lenis.start();
      dirty = true;
    }
    btn.addEventListener("click", function () { set(!html.classList.contains("menu-open")); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && html.classList.contains("menu-open")) { set(false); btn.focus(); } });
    SC.$$(".menu a").forEach(function (a) { a.addEventListener("click", function () { set(false); }); });
  }

  /* ---------------------------------------------------------------- anchors */
  function initAnchors() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute("href");
      if (id.length < 2) return;
      var t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      SC.scrollTo(t, { offset: -20 });
    });
    SC.$$("[data-totop]").forEach(function (b) { b.addEventListener("click", function () { SC.scrollTo(0, { duration: 1.8 }); }); });
  }

  /* ---------------------------------------------------------------- images fade in once decoded */
  SC.fadeImages = function (scope) {
    SC.$$("img.fade-img:not(.is-loaded)", scope).forEach(function (img) {
      if (img.complete && img.naturalWidth) img.classList.add("is-loaded");
      else {
        img.addEventListener("load", function () { img.classList.add("is-loaded"); }, { once: true });
        img.addEventListener("error", function () { img.classList.add("is-loaded", "is-broken"); }, { once: true });
      }
    });
  };

  /* ---------------------------------------------------------------- newsletter */
  function initSignup() {
    SC.$$("form[data-signup]").forEach(function (form) {
      var msg = SC.$(".signup__msg", form.parentNode);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var input = form.querySelector('input[type="email"]');
        var v = (input.value || "").trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
          if (msg) msg.textContent = "That email doesn't look quite right. Mind checking it?";
          input.focus();
          return;
        }
        var cfg = SC.cfg.newsletter || {};
        if (!cfg.action) { if (msg) msg.textContent = "Thank you! Email signups open soon, so check back shortly."; return; }
        var fd = new FormData();
        fd.append(cfg.field || "email", v);
        Object.keys(cfg.extraFields || {}).forEach(function (k) { fd.append(k, cfg.extraFields[k]); });
        if (msg) msg.textContent = "Sending...";
        fetch(cfg.action, { method: cfg.method || "POST", body: fd, mode: "no-cors" })
          .then(function () { if (msg) msg.textContent = "You're on the list. The next view is on its way."; form.reset(); })
          .catch(function () { if (msg) msg.textContent = "Something got in the way. Please try again in a moment."; });
      });
    });
  }

  /* ---------------------------------------------------------------- config-driven links */
  function initConfigBits() {
    var c = SC.cfg, mail = c.supportEmail;
    SC.$$("[data-support-email]").forEach(function (el) {
      if (mail) { el.textContent = mail; if (el.tagName === "A") el.href = "mailto:" + mail; }
      else if (el.hasAttribute("data-hide-empty")) (el.closest("[data-hide-wrap]") || el).hidden = true;
    });
    SC.$$("[data-social]").forEach(function (el) {
      var u = (c.social || {})[el.getAttribute("data-social")];
      if (u) el.href = u; else (el.closest("li") || el).hidden = true;
    });
    SC.$$("[data-studio]").forEach(function (el) { if (c.studioUrl) el.href = c.studioUrl; else (el.closest("li") || el).hidden = true; });
    SC.$$("[data-popup-path]").forEach(function (el) {
      if (c.popupUrl) el.href = c.popupUrl.replace(/\/+$/, "") + el.getAttribute("data-popup-path");
      else (el.closest("li") || el).hidden = true;
    });
    SC.$$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  /* ---------------------------------------------------------------- topographic contours */
  SC.contours = function (svg) {
    var rings = +svg.getAttribute("data-contours") || 6, seed = rings * 7919 + 17;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    function smooth(pts) {
      var n = pts.length, d = "M" + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
      for (var i = 0; i < n; i++) {
        var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
        d += "C" + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + " " + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + " " +
          (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + " " + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + " " + p2[0].toFixed(1) + " " + p2[1].toFixed(1);
      }
      return d + "Z";
    }
    var out = "";
    for (var c = 0; c < 3; c++) {
      var cx = 120 + rnd() * 760, cy = 120 + rnd() * 760, base = 40 + rnd() * 60, k1 = rnd() * 6, k2 = rnd() * 6;
      for (var r = 0; r < rings; r++) {
        var r0 = base + r * (34 + rnd() * 10), pts = [];
        for (var a = 0; a < 48; a++) {
          var t = a / 48 * Math.PI * 2;
          var rr = r0 * (1 + 0.2 * Math.sin(3 * t + k1 + r * 0.18) + 0.09 * Math.sin(5 * t + k2 - r * 0.12) + 0.04 * Math.sin(9 * t + k1 * 2));
          pts.push([cx + Math.cos(t) * rr * 1.15, cy + Math.sin(t) * rr * 0.85]);
        }
        out += '<path d="' + smooth(pts) + '"/>';
      }
    }
    svg.setAttribute("viewBox", "0 0 1000 1000");
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
    svg.innerHTML = '<g fill="none" stroke="currentColor" stroke-width="1">' + out + "</g>";
  };

  /* ---------------------------------------------------------------- boot */
  function boot() {
    hdr = SC.$(".hdr");
    SC.$$("svg[data-contours]").forEach(SC.contours);
    initLogos();
    initDropdown();
    initMenu();
    initAnchors();
    initSignup();
    initConfigBits();
    SC.fadeImages();
    measureThemes();
    var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    if (!reduce) {
      SC.$$("[data-parallax]").forEach(function (img) {
        var f = parseFloat(img.getAttribute("data-parallax")) || 0.1;
        SC.scene(img.parentElement, function (p) { img.style.transform = "translate3d(0," + ((p - 0.5) * f * 100).toFixed(2) + "%,0)"; });
      });
    }
    fontsReady.then(function () {
      SC.$$("[data-split]").forEach(SC.split);
      SC.reveal();
      SC.refresh();
      SC.ready = true;
      document.dispatchEvent(new CustomEvent("sc:ready"));
    });
  }
  SC.onReady = function (fn) { if (SC.ready) fn(); else document.addEventListener("sc:ready", fn, { once: true }); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
