/* ==========================================================================
   Hero water: the reflection in "Mountain Reflection" (SC-019) breathes,
   and the cursor leaves ripples on the lake. Plain WebGL, no libraries.
   ========================================================================== */
(function () {
  "use strict";
  var SC = (window.SC = window.SC || {});

  var VS = "attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}";
  var FS = [
    "precision highp float;",
    "varying vec2 v;",
    "uniform sampler2D tex;uniform vec2 res;uniform vec2 isz;uniform vec2 focus;",
    "uniform float time;uniform float hz;uniform float zoom;uniform float grade;",
    "uniform vec4 rip[6];",
    "vec2 cover(vec2 uv){float rs=res.x/res.y,ri=isz.x/isz.y;vec2 s=rs>ri?vec2(1.,ri/rs):vec2(rs/ri,1.);return uv*s+(1.-s)*focus;}",
    "void main(){",
    "  vec2 uv=(v-.5)/zoom+.5;",
    "  vec2 iuv=cover(uv);",
    "  float water=smoothstep(hz-.003,hz+.014,iuv.y);",
    "  float depth=clamp((iuv.y-hz)/(1.-hz),0.,1.);",
    "  float w1=sin(iuv.y*230.*(.35+depth)-time*1.35+sin(iuv.x*5.+time*.25)*1.6);",
    "  float w2=sin(iuv.y*92.+iuv.x*8.-time*.75);",
    "  vec2 off=vec2((w1*.0015+w2*.0008)*(.22+depth*1.25),w2*.0005*depth)*water;",
    "  for(int i=0;i<6;i++){",
    "    vec4 r=rip[i];float age=time-r.z;",
    "    if(r.w>0.&&age>0.&&age<3.6){",
    "      vec2 d=iuv-r.xy;d.x*=isz.x/isz.y;d.y*=3.1;",
    "      float dist=length(d),rad=age*.15;",
    "      float ring=sin((dist-rad)*95.)*exp(-pow((dist-rad)*13.,2.));",
    "      float fade=1.-age/3.6;",
    "      off+=normalize(d+1e-5)*ring*.0065*fade*fade*r.w*water;",
    "    }",
    "  }",
    "  vec3 col=texture2D(tex,iuv+off).rgb;",
    "  float g=pow(max(0.,sin(iuv.x*64.+iuv.y*880.-time*2.2)*sin(iuv.x*29.-time*.6)),16.);",
    "  col+=g*.07*water*(.35+depth);",
    "  float l=dot(col,vec3(.299,.587,.114));",
    "  col=mix(col,vec3(l),.1*grade);",
    "  col=mix(col,col*vec3(.9,.97,1.)+vec3(0.,.008,.014),grade);",
    "  vec2 q=v-.5;col*=1.-dot(q,q)*.6*grade;",
    "  gl_FragColor=vec4(col,1.);",
    "}"
  ].join("\n");

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }

  /* SC.heroWater(canvas, img, { horizon, focus:[x,y], hitArea }) -> controller | null */
  SC.heroWater = function (canvas, img, opts) {
    opts = opts || {};
    var gl;
    try { gl = canvas.getContext("webgl", { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: "high-performance" }); } catch (e) { gl = null; }
    if (!gl) return null;

    var vs = compile(gl, gl.VERTEX_SHADER, VS), fs = compile(gl, gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    } catch (e) {
      return null; // e.g. opened from file:// where the browser blocks image textures
    }
    if (gl.getError() !== gl.NO_ERROR) return null;

    var U = {};
    ["tex", "res", "isz", "focus", "time", "hz", "zoom", "grade", "rip"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    gl.uniform1i(U.tex, 0);
    gl.uniform2f(U.isz, img.naturalWidth, img.naturalHeight);
    var focus = opts.focus || [0.5, 0.55];
    gl.uniform2f(U.focus, focus[0], focus[1]);
    gl.uniform1f(U.hz, opts.horizon || 0.556);
    gl.uniform1f(U.grade, opts.grade == null ? 1 : opts.grade);

    var ripples = new Float32Array(24), ri = 0, t0 = performance.now(), zoom = 1, running = true, w = 0, h = 0;
    var dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 800 ? 1.5 : 1.75);

    function size() {
      var cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (!cw || !ch) return;
      if (cw * dpr !== w || ch * dpr !== h) {
        w = Math.round(cw * dpr); h = Math.round(ch * dpr);
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
        gl.uniform2f(U.res, w, h);
      }
    }
    function now() { return (performance.now() - t0) / 1000; }

    function toImage(cx, cy) {
      var r = canvas.getBoundingClientRect();
      var u = (cx - r.left) / r.width, vv = (cy - r.top) / r.height;
      u = (u - 0.5) / zoom + 0.5; vv = (vv - 0.5) / zoom + 0.5;
      var rs = r.width / r.height, ri2 = img.naturalWidth / img.naturalHeight;
      var sx = rs > ri2 ? 1 : rs / ri2, sy = rs > ri2 ? ri2 / rs : 1;
      return [u * sx + (1 - sx) * focus[0], vv * sy + (1 - sy) * focus[1]];
    }
    function addRipple(cx, cy, strength) {
      var p = toImage(cx, cy);
      if (p[1] < (opts.horizon || 0.556)) return;
      ripples[ri * 4] = p[0]; ripples[ri * 4 + 1] = p[1]; ripples[ri * 4 + 2] = now(); ripples[ri * 4 + 3] = strength;
      ri = (ri + 1) % 6;
    }

    var lastX = 0, lastY = 0, lastT = 0, hit = opts.hitArea || canvas;
    hit.addEventListener("pointermove", function (e) {
      var t = performance.now(), dx = e.clientX - lastX, dy = e.clientY - lastY;
      if (t - lastT > 110 && dx * dx + dy * dy > 500) {
        addRipple(e.clientX, e.clientY, e.pointerType === "mouse" ? 0.7 : 1);
        lastX = e.clientX; lastY = e.clientY; lastT = t;
      }
    }, { passive: true });
    hit.addEventListener("pointerdown", function (e) { addRipple(e.clientX, e.clientY, 1.4); }, { passive: true });

    function draw() {
      if (!running) return;
      size();
      gl.uniform1f(U.time, now());
      gl.uniform1f(U.zoom, zoom);
      gl.uniform4fv(U.rip, ripples);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    var stopLoop = SC.raf(draw);
    window.addEventListener("resize", size);
    size();
    draw();

    // A few gentle ripples on their own so the water reads as water before anyone touches it.
    setTimeout(function () {
      var r = canvas.getBoundingClientRect();
      addRipple(r.left + r.width * 0.68, r.top + r.height * 0.8, 0.8);
    }, 1800);

    return {
      setZoom: function (z) { zoom = z; },
      pause: function () { running = false; },
      play: function () { running = true; },
      destroy: function () { running = false; stopLoop(); }
    };
  };
})();
