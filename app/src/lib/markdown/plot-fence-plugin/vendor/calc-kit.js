/* Vendored from Desktop calc-kit runtime (lesson toolchain).
   Patched for ESM export, palette-from-canvas, and resize teardown.
   Do not add a plot npm dependency; update by recopying + re-applying patches.
*/

/* ==========================================================================
   calc-kit runtime — expression parser, 2D/3D plotting engine, and the
   figure components used by generated calculus lessons.

   Lessons never contain drawing code. They declare figures like:

       ```plot riemann
       f: 4 - x^2/2
       domain: [0, 2.5]
       n: 8
       ```

   Vendored into local-pm as an ESM module for Reading View plot fences.
   Page boot (DOMContentLoaded / TOC) is stripped; palette reads from the canvas.
   ========================================================================== */

"use strict";

  /* ======================================================================
     1. Expression language

     Lesson authors write ordinary math: `-x^2`, `2x`, `3sin(x)`, `e^(-x/2)`.
     A hand-written parser is used rather than `new Function` on the raw
     string so that `^` means exponentiation, implicit multiplication works,
     and the same AST can be evaluated over both plain numbers and truncated
     power series (needed for exact Taylor coefficients).
     ====================================================================== */

  var FUNCS = {
    sin: "Math.sin", cos: "Math.cos", tan: "Math.tan",
    asin: "Math.asin", acos: "Math.acos", atan: "Math.atan",
    sinh: "Math.sinh", cosh: "Math.cosh", tanh: "Math.tanh",
    exp: "Math.exp", ln: "Math.log", log: "Math.log10", log2: "Math.log2",
    sqrt: "Math.sqrt", cbrt: "Math.cbrt", abs: "Math.abs",
    floor: "Math.floor", ceil: "Math.ceil", round: "Math.round",
    sign: "Math.sign", min: "Math.min", max: "Math.max", atan2: "Math.atan2"
  };

  var CONSTS = { pi: Math.PI, "\u03c0": Math.PI, e: Math.E, tau: 2 * Math.PI };

  function tokenize(src) {
    var tokens = [];
    var i = 0;
    var s = String(src);
    while (i < s.length) {
      var c = s[i];
      if (c === " " || c === "\t" || c === "\n") { i++; continue; }
      if (/[0-9.]/.test(c)) {
        var num = "";
        while (i < s.length && /[0-9.]/.test(s[i])) num += s[i++];
        if (s[i] === "e" && /[0-9+\-]/.test(s[i + 1] || "")) {
          num += s[i++];
          if (/[+\-]/.test(s[i])) num += s[i++];
          while (i < s.length && /[0-9]/.test(s[i])) num += s[i++];
        }
        tokens.push({ t: "num", v: parseFloat(num) });
        continue;
      }
      if (/[a-zA-Z_\u03b1-\u03c9]/.test(c)) {
        var name = "";
        while (i < s.length && /[a-zA-Z_0-9\u03b1-\u03c9]/.test(s[i])) name += s[i++];
        tokens.push({ t: "name", v: name });
        continue;
      }
      if ("+-*/^(),".indexOf(c) >= 0) { tokens.push({ t: "op", v: c }); i++; continue; }
      throw new Error("Unexpected character '" + c + "' in expression: " + src);
    }
    return tokens;
  }

  function parse(src) {
    var tokens = tokenize(src);
    var pos = 0;

    function peek() { return tokens[pos]; }
    function eat(v) {
      var tk = tokens[pos];
      if (!tk || tk.v !== v) throw new Error("Expected '" + v + "' in: " + src);
      pos++;
      return tk;
    }
    function startsAtom(tk) {
      if (!tk) return false;
      return tk.t === "num" || tk.t === "name" || tk.v === "(";
    }

    function parseAtom() {
      var tk = peek();
      if (!tk) throw new Error("Unexpected end of expression: " + src);
      if (tk.t === "num") { pos++; return { t: "num", v: tk.v }; }
      if (tk.v === "(") {
        pos++;
        var inner = parseExpr();
        eat(")");
        return inner;
      }
      if (tk.t === "name") {
        pos++;
        var lower = tk.v.toLowerCase();
        if (FUNCS[lower] && peek() && peek().v === "(") {
          pos++;
          var args = [];
          if (peek() && peek().v !== ")") {
            args.push(parseExpr());
            while (peek() && peek().v === ",") { pos++; args.push(parseExpr()); }
          }
          eat(")");
          return { t: "call", name: lower, args: args };
        }
        if (Object.prototype.hasOwnProperty.call(CONSTS, lower)) {
          return { t: "num", v: CONSTS[lower] };
        }
        return { t: "var", name: tk.v };
      }
      throw new Error("Unexpected token '" + tk.v + "' in: " + src);
    }

    function parsePower() {
      var base = parseAtom();
      if (peek() && peek().v === "^") {
        pos++;
        return { t: "bin", op: "^", l: base, r: parseUnary() };
      }
      return base;
    }

    function parseUnary() {
      if (peek() && peek().v === "-") { pos++; return { t: "neg", a: parseUnary() }; }
      if (peek() && peek().v === "+") { pos++; return parseUnary(); }
      return parsePower();
    }

    function parseTerm() {
      var left = parseUnary();
      for (;;) {
        var tk = peek();
        if (tk && (tk.v === "*" || tk.v === "/")) {
          pos++;
          left = { t: "bin", op: tk.v, l: left, r: parseUnary() };
        } else if (startsAtom(tk)) {
          // Implicit multiplication: 2x, 3sin(x), x(x+1)
          left = { t: "bin", op: "*", l: left, r: parseUnary() };
        } else {
          return left;
        }
      }
    }

    function parseExpr() {
      var left = parseTerm();
      for (;;) {
        var tk = peek();
        if (tk && (tk.v === "+" || tk.v === "-")) {
          pos++;
          left = { t: "bin", op: tk.v, l: left, r: parseTerm() };
        } else {
          return left;
        }
      }
    }

    var ast = parseExpr();
    if (pos < tokens.length) throw new Error("Trailing input in expression: " + src);
    return ast;
  }

  function emit(node) {
    switch (node.t) {
      case "num": return "(" + node.v + ")";
      case "var": return node.name;
      case "neg": return "(-" + emit(node.a) + ")";
      case "call": return FUNCS[node.name] + "(" + node.args.map(emit).join(",") + ")";
      case "bin":
        if (node.op === "^") return "Math.pow(" + emit(node.l) + "," + emit(node.r) + ")";
        return "(" + emit(node.l) + node.op + emit(node.r) + ")";
    }
    throw new Error("Cannot emit node " + node.t);
  }

  var fnCache = new Map();

  /**
   * Compile a math expression into a JS function of the given variables.
   * Results are cached because components recompile on every redraw.
   */
  function compile(src, vars) {
    vars = vars || ["x"];
    if (typeof src === "function") return src;
    var key = vars.join(",") + "|" + src;
    if (fnCache.has(key)) return fnCache.get(key);
    var ast = parse(src);
    var fn = new Function(vars.join(","), "return " + emit(ast) + ";");
    fnCache.set(key, fn);
    fn.ast = ast;
    return fn;
  }

  /* ---- Truncated power series (jets), for exact Taylor coefficients ---- */

  var Jet = {
    konst: function (v, n) { var a = new Array(n + 1).fill(0); a[0] = v; return a; },
    vari: function (c, n) { var a = new Array(n + 1).fill(0); a[0] = c; if (n >= 1) a[1] = 1; return a; },
    add: function (a, b) { return a.map(function (v, i) { return v + b[i]; }); },
    sub: function (a, b) { return a.map(function (v, i) { return v - b[i]; }); },
    neg: function (a) { return a.map(function (v) { return -v; }); },
    mul: function (a, b) {
      var n = a.length - 1, out = new Array(n + 1).fill(0);
      for (var i = 0; i <= n; i++) for (var k = 0; k <= i; k++) out[i] += a[k] * b[i - k];
      return out;
    },
    div: function (a, b) {
      var n = a.length - 1, out = new Array(n + 1).fill(0);
      for (var i = 0; i <= n; i++) {
        var sum = a[i];
        for (var k = 1; k <= i; k++) sum -= b[k] * out[i - k];
        out[i] = sum / b[0];
      }
      return out;
    },
    exp: function (u) {
      var n = u.length - 1, v = new Array(n + 1).fill(0);
      v[0] = Math.exp(u[0]);
      for (var i = 1; i <= n; i++) {
        var s = 0;
        for (var k = 1; k <= i; k++) s += k * u[k] * v[i - k];
        v[i] = s / i;
      }
      return v;
    },
    log: function (u) {
      var n = u.length - 1, v = new Array(n + 1).fill(0);
      v[0] = Math.log(u[0]);
      for (var i = 1; i <= n; i++) {
        var s = 0;
        for (var k = 1; k <= i - 1; k++) s += k * v[k] * u[i - k];
        v[i] = (u[i] - s / i) / u[0];
      }
      return v;
    },
    sincos: function (u) {
      var n = u.length - 1;
      var s = new Array(n + 1).fill(0), c = new Array(n + 1).fill(0);
      s[0] = Math.sin(u[0]); c[0] = Math.cos(u[0]);
      for (var i = 1; i <= n; i++) {
        var ss = 0, cc = 0;
        for (var k = 1; k <= i; k++) { ss += k * u[k] * c[i - k]; cc += k * u[k] * s[i - k]; }
        s[i] = ss / i;
        c[i] = -cc / i;
      }
      return { sin: s, cos: c };
    },
    // Integer powers by repeated squaring. The Miller recurrence below divides
    // by u[0], so it cannot handle series like x^2 whose constant term is zero.
    ipow: function (u, r) {
      var n = u.length - 1;
      if (r < 0) return Jet.div(Jet.konst(1, n), Jet.ipow(u, -r));
      var out = Jet.konst(1, n);
      var base = u;
      var e = r;
      while (e > 0) {
        if (e & 1) out = Jet.mul(out, base);
        base = Jet.mul(base, base);
        e >>= 1;
      }
      return out;
    },
    pow: function (u, r) {
      if (Number.isInteger(r) && Math.abs(r) <= 64) return Jet.ipow(u, r);
      // J.C.P. Miller recurrence for u^r with u[0] != 0.
      var n = u.length - 1, v = new Array(n + 1).fill(0);
      v[0] = Math.pow(u[0], r);
      for (var i = 1; i <= n; i++) {
        var s = 0;
        for (var k = 1; k <= i; k++) s += (k * r - (i - k)) * u[k] * v[i - k];
        v[i] = s / (i * u[0]);
      }
      return v;
    }
  };

  function evalJet(node, x, order) {
    switch (node.t) {
      case "num": return Jet.konst(node.v, order);
      case "var": return Jet.vari(x, order);
      case "neg": return Jet.neg(evalJet(node.a, x, order));
      case "bin": {
        var l = evalJet(node.l, x, order);
        if (node.op === "^") {
          if (node.r.t === "num") return Jet.pow(l, node.r.v);
          // general u^v = exp(v ln u)
          return Jet.exp(Jet.mul(evalJet(node.r, x, order), Jet.log(l)));
        }
        var r = evalJet(node.r, x, order);
        if (node.op === "+") return Jet.add(l, r);
        if (node.op === "-") return Jet.sub(l, r);
        if (node.op === "*") return Jet.mul(l, r);
        if (node.op === "/") return Jet.div(l, r);
        break;
      }
      case "call": {
        var a = evalJet(node.args[0], x, order);
        switch (node.name) {
          case "sin": return Jet.sincos(a).sin;
          case "cos": return Jet.sincos(a).cos;
          case "tan": { var sc = Jet.sincos(a); return Jet.div(sc.sin, sc.cos); }
          case "exp": return Jet.exp(a);
          case "ln": return Jet.log(a);
          case "sqrt": return Jet.pow(a, 0.5);
          case "cbrt": return Jet.pow(a, 1 / 3);
          case "sinh": { var e1 = Jet.exp(a), e2 = Jet.exp(Jet.neg(a)); return Jet.mul(Jet.sub(e1, e2), Jet.konst(0.5, a.length - 1)); }
          case "cosh": { var f1 = Jet.exp(a), f2 = Jet.exp(Jet.neg(a)); return Jet.mul(Jet.add(f1, f2), Jet.konst(0.5, a.length - 1)); }
        }
        throw new Error("No Taylor rule for " + node.name + "()");
      }
    }
    throw new Error("Cannot expand node " + node.t);
  }

  /** Taylor coefficients c_k of f about `center`, so f(x) ≈ Σ c_k (x-center)^k. */
  function taylorCoefficients(src, center, order) {
    var fn = compile(src, ["x"]);
    return evalJet(fn.ast || parse(src), center, order);
  }

  /* ======================================================================
     2. Small helpers
     ====================================================================== */

  function palette(el) {
    var cs = getComputedStyle(el || document.documentElement);
    function v(name, fallback) {
      var got = cs.getPropertyValue(name).trim();
      return got || fallback;
    }
    return {
      ink: v("--plot-ink", "#1f2328"),
      grid: v("--plot-grid", "#e4e8ed"),
      axis: v("--plot-axis", "#8c959f"),
      curve: v("--plot-curve", "#0969da"),
      curve2: v("--plot-curve-2", "#8250df"),
      curve3: v("--plot-curve-3", "#bf3989"),
      fill: v("--plot-fill", "rgba(9,105,218,0.16)"),
      accent: v("--plot-accent", "#cf222e"),
      accent2: v("--plot-accent-2", "#1a7f37"),
      bg: v("--bg", "#ffffff"),
      muted: v("--fg-muted", "#59636e")
    };
  }

  function fmt(v, digits) {
    if (!isFinite(v)) return "—";
    if (digits === undefined) digits = 3;
    var out = v.toFixed(digits);
    if (Math.abs(parseFloat(out)) < Math.pow(10, -digits) / 2) out = (0).toFixed(digits);
    return out;
  }

  function niceTicks(min, max, target) {
    target = target || 6;
    var span = max - min;
    if (!(span > 0)) return [min];
    var raw = span / target;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var norm = raw / mag;
    var step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    var ticks = [];
    for (var v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) {
      ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    }
    return ticks;
  }

  function tickLabel(v, step) {
    var decimals = Math.max(0, -Math.floor(Math.log10(step)) + (step < 1 ? 0 : 0));
    if (Math.abs(v) >= 1e4 || (v !== 0 && Math.abs(v) < 1e-3)) return v.toExponential(1);
    return parseFloat(v.toFixed(Math.min(6, decimals + 1))).toString();
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* ======================================================================
     3. Plot2D — canvas, coordinates, axes, curve drawing
     ====================================================================== */

  function Plot2D(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.pad = Object.assign({ l: 46, r: 16, t: 14, b: 32 }, opts.pad);
    this.xmin = opts.xmin; this.xmax = opts.xmax;
    this.ymin = opts.ymin; this.ymax = opts.ymax;
    this.equalAspect = !!opts.equalAspect;
    this.w = 0; this.h = 0;
    this.c = palette(this.canvas);
  }

  Plot2D.prototype.resize = function () {
    var dpr = window.devicePixelRatio || 1;
    var rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(240, rect.width);
    this.h = Math.max(180, rect.height);
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.c = palette(this.canvas);
    if (this.equalAspect) this.applyEqualAspect();
  };

  Plot2D.prototype.applyEqualAspect = function () {
    var pw = this.w - this.pad.l - this.pad.r;
    var ph = this.h - this.pad.t - this.pad.b;
    var cx = (this.xmin + this.xmax) / 2;
    var cy = (this.ymin + this.ymax) / 2;
    var sx = (this.xmax - this.xmin) / pw;
    var sy = (this.ymax - this.ymin) / ph;
    var s = Math.max(sx, sy);
    this.xmin = cx - (s * pw) / 2; this.xmax = cx + (s * pw) / 2;
    this.ymin = cy - (s * ph) / 2; this.ymax = cy + (s * ph) / 2;
  };

  Plot2D.prototype.X = function (x) {
    return this.pad.l + ((x - this.xmin) / (this.xmax - this.xmin)) * (this.w - this.pad.l - this.pad.r);
  };
  Plot2D.prototype.Y = function (y) {
    return this.h - this.pad.b - ((y - this.ymin) / (this.ymax - this.ymin)) * (this.h - this.pad.t - this.pad.b);
  };
  Plot2D.prototype.invX = function (px) {
    return this.xmin + ((px - this.pad.l) / (this.w - this.pad.l - this.pad.r)) * (this.xmax - this.xmin);
  };
  Plot2D.prototype.invY = function (py) {
    return this.ymin + ((this.h - this.pad.b - py) / (this.h - this.pad.t - this.pad.b)) * (this.ymax - this.ymin);
  };

  /** Choose a y-range that frames the sampled values without clipping detail. */
  Plot2D.prototype.autoRange = function (fns, padFrac) {
    var lo = Infinity, hi = -Infinity;
    var N = 400;
    for (var f = 0; f < fns.length; f++) {
      for (var i = 0; i <= N; i++) {
        var x = this.xmin + ((this.xmax - this.xmin) * i) / N;
        var y = fns[f](x);
        if (isFinite(y)) { if (y < lo) lo = y; if (y > hi) hi = y; }
      }
    }
    if (!isFinite(lo) || !isFinite(hi)) { lo = -1; hi = 1; }
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    var pad = (hi - lo) * (padFrac === undefined ? 0.12 : padFrac);
    this.ymin = lo - pad;
    this.ymax = hi + pad;
    if (lo >= 0 && this.ymin < 0 && lo < (hi - lo) * 0.4) this.ymin = Math.min(0, lo - pad * 0.3);
  };

  // Filled rather than merely cleared so that printing, PDF export and
  // screenshot capture never composite the figure onto transparency.
  Plot2D.prototype.clear = function () {
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.ctx.fillStyle = this.c.bg;
    this.ctx.fillRect(0, 0, this.w, this.h);
  };

  Plot2D.prototype.drawAxes = function (o) {
    o = o || {};
    var ctx = this.ctx, c = this.c;
    var xt = niceTicks(this.xmin, this.xmax, o.xTarget || 7);
    var yt = niceTicks(this.ymin, this.ymax, o.yTarget || 5);
    var xstep = xt.length > 1 ? xt[1] - xt[0] : 1;
    var ystep = yt.length > 1 ? yt[1] - yt[0] : 1;

    ctx.save();
    ctx.strokeStyle = c.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    xt.forEach(function (v) {
      var px = Math.round(this.X(v)) + 0.5;
      ctx.moveTo(px, this.pad.t); ctx.lineTo(px, this.h - this.pad.b);
    }, this);
    yt.forEach(function (v) {
      var py = Math.round(this.Y(v)) + 0.5;
      ctx.moveTo(this.pad.l, py); ctx.lineTo(this.w - this.pad.r, py);
    }, this);
    ctx.stroke();

    // Axis lines at zero (or clamped to the frame edge).
    ctx.strokeStyle = c.axis;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    var y0 = Math.round(this.Y(clamp(0, this.ymin, this.ymax))) + 0.5;
    ctx.moveTo(this.pad.l, y0); ctx.lineTo(this.w - this.pad.r, y0);
    var x0 = Math.round(this.X(clamp(0, this.xmin, this.xmax))) + 0.5;
    ctx.moveTo(x0, this.pad.t); ctx.lineTo(x0, this.h - this.pad.b);
    ctx.stroke();

    ctx.fillStyle = c.muted;
    ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    xt.forEach(function (v) {
      if (v === 0) return;
      ctx.fillText(tickLabel(v, xstep), this.X(v), this.h - this.pad.b + 6);
    }, this);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    yt.forEach(function (v) {
      if (v === 0) return;
      ctx.fillText(tickLabel(v, ystep), this.pad.l - 7, this.Y(v));
    }, this);

    if (o.xLabel) {
      ctx.textAlign = "right"; ctx.textBaseline = "bottom";
      ctx.fillStyle = c.muted;
      ctx.fillText(o.xLabel, this.w - this.pad.r, this.h - this.pad.b - 4);
    }
    if (o.yLabel) {
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(o.yLabel, this.pad.l + 4, this.pad.t);
    }
    ctx.restore();
  };

  Plot2D.prototype.curve = function (fn, o) {
    o = o || {};
    var ctx = this.ctx;
    var N = o.samples || Math.max(240, Math.round(this.w));
    var from = o.from === undefined ? this.xmin : o.from;
    var to = o.to === undefined ? this.xmax : o.to;
    ctx.save();
    ctx.strokeStyle = o.color || this.c.curve;
    ctx.lineWidth = o.width || 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (o.dash) ctx.setLineDash(o.dash);
    ctx.beginPath();
    var pen = false;
    for (var i = 0; i <= N; i++) {
      var x = from + ((to - from) * i) / N;
      var y = fn(x);
      if (!isFinite(y) || y > this.ymax + (this.ymax - this.ymin) * 4 || y < this.ymin - (this.ymax - this.ymin) * 4) {
        pen = false;
        continue;
      }
      var px = this.X(x), py = this.Y(y);
      if (!pen) { ctx.moveTo(px, py); pen = true; } else { ctx.lineTo(px, py); }
    }
    ctx.stroke();
    ctx.restore();
  };

  Plot2D.prototype.fillUnder = function (fn, from, to, o) {
    o = o || {};
    var ctx = this.ctx;
    var N = o.samples || 240;
    var base = this.Y(clamp(0, this.ymin, this.ymax));
    ctx.save();
    ctx.fillStyle = o.color || this.c.fill;
    ctx.beginPath();
    ctx.moveTo(this.X(from), base);
    for (var i = 0; i <= N; i++) {
      var x = from + ((to - from) * i) / N;
      var y = fn(x);
      ctx.lineTo(this.X(x), this.Y(isFinite(y) ? y : 0));
    }
    ctx.lineTo(this.X(to), base);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  Plot2D.prototype.segment = function (x0, y0, x1, y1, o) {
    o = o || {};
    var ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = o.color || this.c.accent;
    ctx.lineWidth = o.width || 1.8;
    if (o.dash) ctx.setLineDash(o.dash);
    ctx.beginPath();
    ctx.moveTo(this.X(x0), this.Y(y0));
    ctx.lineTo(this.X(x1), this.Y(y1));
    ctx.stroke();
    ctx.restore();
  };

  Plot2D.prototype.point = function (x, y, o) {
    o = o || {};
    var ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.X(x), this.Y(y), o.r || 4.5, 0, Math.PI * 2);
    ctx.fillStyle = o.hollow ? this.c.bg : (o.color || this.c.accent);
    ctx.fill();
    ctx.lineWidth = o.width || 2;
    ctx.strokeStyle = o.color || this.c.accent;
    ctx.stroke();
    ctx.restore();
  };

  Plot2D.prototype.rect = function (x0, y0, x1, y1, o) {
    o = o || {};
    var ctx = this.ctx;
    var px = this.X(Math.min(x0, x1)), py = this.Y(Math.max(y0, y1));
    var pw = Math.abs(this.X(x1) - this.X(x0));
    var ph = Math.abs(this.Y(y1) - this.Y(y0));
    ctx.save();
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fillRect(px, py, pw, ph); }
    if (o.stroke) {
      ctx.strokeStyle = o.stroke;
      ctx.lineWidth = o.width || 1;
      ctx.strokeRect(px + 0.5, py + 0.5, Math.max(0, pw - 1), Math.max(0, ph - 1));
    }
    ctx.restore();
  };

  Plot2D.prototype.arrow = function (x0, y0, x1, y1, o) {
    o = o || {};
    var ctx = this.ctx;
    var ax = this.X(x0), ay = this.Y(y0), bx = this.X(x1), by = this.Y(y1);
    var dx = bx - ax, dy = by - ay;
    var len = Math.hypot(dx, dy);
    if (len < 1.2) return;
    var head = Math.min(o.head || 7, len * 0.4);
    var ang = Math.atan2(dy, dx);
    ctx.save();
    ctx.strokeStyle = ctx.fillStyle = o.color || this.c.curve;
    ctx.lineWidth = o.width || 1.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ax, ay); ctx.lineTo(bx - head * 0.6 * Math.cos(ang), by - head * 0.6 * Math.sin(ang));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - head * Math.cos(ang - 0.42), by - head * Math.sin(ang - 0.42));
    ctx.lineTo(bx - head * Math.cos(ang + 0.42), by - head * Math.sin(ang + 0.42));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  Plot2D.prototype.label = function (x, y, text, o) {
    o = o || {};
    var ctx = this.ctx;
    ctx.save();
    ctx.font = (o.size || 11) + "px " + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = o.align || "left";
    ctx.textBaseline = o.baseline || "bottom";
    var px = this.X(x) + (o.dx || 0), py = this.Y(y) + (o.dy || 0);
    if (o.halo !== false) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = this.c.bg;
      ctx.strokeText(text, px, py);
    }
    ctx.fillStyle = o.color || this.c.ink;
    ctx.fillText(text, px, py);
    ctx.restore();
  };

  /* ======================================================================
     4. Scene3D — surface renderer (no dependencies)

     Default perspective: DEFAULT_CAMERA_DEPTH (camera distance along the
     view axis in the normalized box). Finite spec.cameraDepth > 1 overrides;
     omit for the default; non-finite or ≤ 1 is orthographic.
     ====================================================================== */

  var DEFAULT_CAMERA_DEPTH = 10;

  function resolveCameraDepth(value) {
    if (value === undefined || value === null) return DEFAULT_CAMERA_DEPTH;
    if (typeof value === "number" && isFinite(value) && value > 1) return value;
    return Infinity;
  }

  function Scene3D(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.theta = opts.theta === undefined ? -0.9 : opts.theta;
    this.phi = opts.phi === undefined ? 0.5 : opts.phi;
    this.zoom = opts.zoom || 1;
    this.cameraDepth = resolveCameraDepth(opts.cameraDepth);
    this.w = 0; this.h = 0;
    this.c = palette(this.canvas);
    this.bounds = opts.bounds || { x: [-3, 3], y: [-3, 3], z: [-3, 3] };
  }

  Scene3D.prototype.resize = function () {
    var dpr = window.devicePixelRatio || 1;
    var rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(240, rect.width);
    this.h = Math.max(180, rect.height);
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.c = palette(this.canvas);
  };

  /** World point -> {x, y, depth} in screen space. Larger depth is nearer. */
  Scene3D.prototype.project = function (x, y, z) {
    var b = this.bounds;
    var nx = (x - (b.x[0] + b.x[1]) / 2) / ((b.x[1] - b.x[0]) / 2);
    var ny = (y - (b.y[0] + b.y[1]) / 2) / ((b.y[1] - b.y[0]) / 2);
    var nz = (z - (b.z[0] + b.z[1]) / 2) / ((b.z[1] - b.z[0]) / 2);
    var ct = Math.cos(this.theta), st = Math.sin(this.theta);
    var cp = Math.cos(this.phi), sp = Math.sin(this.phi);
    var rx = ct * nx - st * ny;
    var ry = st * nx + ct * ny;
    var sx = rx;
    var sy = -(ry * sp) + nz * cp;
    var depth = ry * cp + nz * sp;
    var cam = this.cameraDepth;
    if (isFinite(cam) && cam > 1) {
      var denom = cam - depth;
      if (denom < 0.25) denom = 0.25;
      var persp = cam / denom;
      sx *= persp;
      sy *= persp;
    }
    var scale = (Math.min(this.w, this.h) / 2.9) * this.zoom;
    return { x: this.w / 2 + sx * scale, y: this.h / 2 - sy * scale * 0.92, d: depth };
  };

  Scene3D.prototype.clear = function () {
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.ctx.fillStyle = this.c.bg;
    this.ctx.fillRect(0, 0, this.w, this.h);
  };

  Scene3D.prototype.drawBox = function () {
    var b = this.bounds, ctx = this.ctx, self = this;
    var corners = [];
    [0, 1].forEach(function (i) {
      [0, 1].forEach(function (j) {
        [0, 1].forEach(function (k) {
          corners.push([b.x[i], b.y[j], b.z[k]]);
        });
      });
    });
    var edges = [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]];
    ctx.save();
    ctx.strokeStyle = this.c.grid;
    ctx.lineWidth = 1;
    edges.forEach(function (e) {
      var p = self.project.apply(self, corners[e[0]]);
      var q = self.project.apply(self, corners[e[1]]);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    });
    ctx.restore();
  };

  function shadeColor(t, alpha) {
    // Blue -> teal -> amber -> red ramp, readable in both themes.
    var stops = [[13, 81, 166], [9, 105, 218], [88, 166, 255], [255, 178, 87], [207, 34, 46]];
    t = clamp(t, 0, 1) * (stops.length - 1);
    var i = Math.min(Math.floor(t), stops.length - 2);
    var f = t - i;
    var a = stops[i], b = stops[i + 1];
    var r = Math.round(a[0] + (b[0] - a[0]) * f);
    var g = Math.round(a[1] + (b[1] - a[1]) * f);
    var bl = Math.round(a[2] + (b[2] - a[2]) * f);
    return "rgba(" + r + "," + g + "," + bl + "," + (alpha === undefined ? 1 : alpha) + ")";
  }

  /** Painter's-algorithm surface mesh from z = f(x, y). */
  Scene3D.prototype.surface = function (f, o) {
    o = o || {};
    var n = o.res || 30;
    var b = this.bounds;
    var ctx = this.ctx, self = this;
    var quads = [];
    var zlo = b.z[0], zhi = b.z[1];
    for (var i = 0; i < n; i++) {
      for (var j = 0; j < n; j++) {
        var x0 = b.x[0] + ((b.x[1] - b.x[0]) * i) / n;
        var x1 = b.x[0] + ((b.x[1] - b.x[0]) * (i + 1)) / n;
        var y0 = b.y[0] + ((b.y[1] - b.y[0]) * j) / n;
        var y1 = b.y[0] + ((b.y[1] - b.y[0]) * (j + 1)) / n;
        var pts = [
          [x0, y0, clamp(f(x0, y0), zlo, zhi)],
          [x1, y0, clamp(f(x1, y0), zlo, zhi)],
          [x1, y1, clamp(f(x1, y1), zlo, zhi)],
          [x0, y1, clamp(f(x0, y1), zlo, zhi)]
        ];
        var proj = pts.map(function (p) { return self.project(p[0], p[1], p[2]); });
        var depth = (proj[0].d + proj[1].d + proj[2].d + proj[3].d) / 4;
        var zavg = (pts[0][2] + pts[1][2] + pts[2][2] + pts[3][2]) / 4;
        quads.push({ proj: proj, depth: depth, t: (zavg - zlo) / (zhi - zlo || 1) });
      }
    }
    quads.sort(function (a, b2) { return a.depth - b2.depth; });
    ctx.save();
    ctx.lineWidth = 0.5;
    quads.forEach(function (q) {
      ctx.beginPath();
      ctx.moveTo(q.proj[0].x, q.proj[0].y);
      for (var k = 1; k < 4; k++) ctx.lineTo(q.proj[k].x, q.proj[k].y);
      ctx.closePath();
      ctx.fillStyle = shadeColor(q.t, o.alpha === undefined ? 0.93 : o.alpha);
      ctx.fill();
      if (o.wire !== false) { ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.stroke(); }
    });
    ctx.restore();
  };

  Scene3D.prototype.line3 = function (pts, o) {
    o = o || {};
    var ctx = this.ctx, self = this;
    ctx.save();
    ctx.strokeStyle = o.color || this.c.accent;
    ctx.lineWidth = o.width || 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    pts.forEach(function (p, i) {
      var q = self.project(p[0], p[1], p[2]);
      if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    });
    ctx.stroke();
    ctx.restore();
  };

  Scene3D.prototype.arrow3 = function (a, b, o) {
    o = o || {};
    var ctx = this.ctx;
    var p = this.project(a[0], a[1], a[2]);
    var q = this.project(b[0], b[1], b[2]);
    var dx = q.x - p.x, dy = q.y - p.y;
    var len = Math.hypot(dx, dy);
    if (len < 1) return;
    var ang = Math.atan2(dy, dx);
    var head = Math.min(o.head || 6, len * 0.45);
    ctx.save();
    ctx.strokeStyle = ctx.fillStyle = o.color || this.c.ink;
    ctx.lineWidth = o.width || 1.3;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(q.x, q.y);
    ctx.lineTo(q.x - head * Math.cos(ang - 0.42), q.y - head * Math.sin(ang - 0.42));
    ctx.lineTo(q.x - head * Math.cos(ang + 0.42), q.y - head * Math.sin(ang + 0.42));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  Scene3D.prototype.enableOrbit = function (onChange) {
    var self = this, dragging = false, lastX = 0, lastY = 0;
    this.canvas.classList.add("is-grabbable");
    this.canvas.addEventListener("pointerdown", function (ev) {
      dragging = true; lastX = ev.clientX; lastY = ev.clientY;
      self.canvas.setPointerCapture(ev.pointerId);
      self.canvas.classList.add("is-grabbing");
    });
    this.canvas.addEventListener("pointermove", function (ev) {
      if (!dragging) return;
      self.theta -= (ev.clientX - lastX) * 0.01;
      self.phi = clamp(self.phi + (ev.clientY - lastY) * 0.008, -0.2, 1.45);
      lastX = ev.clientX; lastY = ev.clientY;
      onChange();
    });
    ["pointerup", "pointercancel"].forEach(function (evt) {
      self.canvas.addEventListener(evt, function (ev) {
        dragging = false;
        self.canvas.classList.remove("is-grabbing");
        try { self.canvas.releasePointerCapture(ev.pointerId); } catch (e) { /* already released */ }
      });
    });
  };

  /* ======================================================================
     5. Declarative controls
     ====================================================================== */

  function Controls(host) {
    this.host = host;
    this.state = {};
    this.onChange = function () {};
    host.hidden = false;
  }

  Controls.prototype._wrap = function (labelText) {
    var wrap = document.createElement("div");
    wrap.className = "ck-control";
    if (labelText) {
      var lab = document.createElement("span");
      lab.className = "ck-control-label";
      lab.textContent = labelText;
      wrap.appendChild(lab);
    }
    this.host.appendChild(wrap);
    return wrap;
  };

  Controls.prototype.segmented = function (key, label, options, initial) {
    var self = this;
    var wrap = this._wrap(label);
    var group = document.createElement("div");
    group.className = "ck-segmented";
    this.state[key] = initial !== undefined ? initial : options[0].value;
    options.forEach(function (opt) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = opt.label;
      btn.className = opt.value === self.state[key] ? "is-active" : "";
      btn.addEventListener("click", function () {
        self.state[key] = opt.value;
        Array.prototype.forEach.call(group.children, function (c) { c.classList.remove("is-active"); });
        btn.classList.add("is-active");
        self.onChange();
      });
      group.appendChild(btn);
    });
    wrap.appendChild(group);
    return this;
  };

  Controls.prototype.slider = function (key, label, min, max, step, initial, format) {
    var self = this;
    var wrap = this._wrap(label);
    var input = document.createElement("input");
    input.type = "range";
    input.className = "ck-slider";
    input.min = min; input.max = max; input.step = step;
    input.value = initial;
    // Read back rather than trusting `initial`: the browser snaps a range input
    // to the nearest step, and the state must match what the user sees.
    this.state[key] = parseFloat(input.value);
    var out = document.createElement("span");
    out.className = "ck-value";
    var render = function () {
      out.textContent = format ? format(self.state[key]) : String(self.state[key]);
    };
    render();
    input.addEventListener("input", function () {
      self.state[key] = parseFloat(input.value);
      render();
      self.onChange();
    });
    wrap.appendChild(input);
    wrap.appendChild(out);
    this["set_" + key] = function (v) {
      self.state[key] = v; input.value = v; render();
    };
    return this;
  };

  Controls.prototype.toggle = function (key, label, initial) {
    var self = this;
    var wrap = this._wrap(null);
    var lab = document.createElement("label");
    lab.className = "ck-check";
    var input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!initial;
    this.state[key] = !!initial;
    input.addEventListener("change", function () {
      self.state[key] = input.checked;
      self.onChange();
    });
    lab.appendChild(input);
    lab.appendChild(document.createTextNode(label));
    wrap.appendChild(lab);
    return this;
  };

  Controls.prototype.button = function (label, handler) {
    var wrap = this._wrap(null);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ck-btn";
    btn.textContent = label;
    btn.addEventListener("click", handler);
    wrap.appendChild(btn);
    return this;
  };

  function legend(host, items) {
    var el = document.createElement("div");
    el.className = "ck-legend";
    items.forEach(function (it) {
      var span = document.createElement("span");
      span.className = "ck-legend-item";
      span.style.color = it.color;
      var sw = document.createElement("span");
      sw.className = "ck-legend-swatch";
      span.appendChild(sw);
      var txt = document.createElement("span");
      txt.style.color = "var(--fg-muted)";
      txt.textContent = it.label;
      span.appendChild(txt);
      el.appendChild(span);
    });
    host.appendChild(el);
  }

  /* ======================================================================
     6. Numerics shared by components
     ====================================================================== */

  function simpson(f, a, b, n) {
    n = n || 800;
    if (n % 2) n++;
    var h = (b - a) / n, s = f(a) + f(b);
    for (var i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
    return (s * h) / 3;
  }

  function riemannSum(f, a, b, n, rule) {
    var dx = (b - a) / n, total = 0, bars = [];
    for (var i = 0; i < n; i++) {
      var x0 = a + i * dx, x1 = x0 + dx, hgt;
      if (rule === "left") hgt = f(x0);
      else if (rule === "right") hgt = f(x1);
      else if (rule === "midpoint") hgt = f((x0 + x1) / 2);
      else hgt = (f(x0) + f(x1)) / 2; // trapezoid
      bars.push({ x0: x0, x1: x1, h: hgt, y0: rule === "trapezoid" ? f(x0) : hgt, y1: rule === "trapezoid" ? f(x1) : hgt });
      total += hgt * dx;
    }
    return { total: total, bars: bars, dx: dx };
  }

  function rk4Path(slope, x0, y0, h, steps, guard) {
    var pts = [[x0, y0]];
    var x = x0, y = y0;
    for (var i = 0; i < steps; i++) {
      var k1 = slope(x, y);
      var k2 = slope(x + h / 2, y + (h / 2) * k1);
      var k3 = slope(x + h / 2, y + (h / 2) * k2);
      var k4 = slope(x + h, y + h * k3);
      if (![k1, k2, k3, k4].every(isFinite)) break;
      y += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      x += h;
      if (!isFinite(y) || (guard && (y < guard[0] || y > guard[1]))) { pts.push([x, y]); break; }
      pts.push([x, y]);
    }
    return pts;
  }

  /* ======================================================================
     7. Components
     ====================================================================== */

  var components = {};

  function bindResize(fig, draw) {
    var pending = false;
    var raf = 0;
    var ro = new ResizeObserver(function () {
      if (pending) return;
      pending = true;
      raf = requestAnimationFrame(function () { pending = false; draw(); });
    });
    ro.observe(fig.canvas);
    var mq = null;
    var mqHandler = null;
    if (window.matchMedia) {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
      mqHandler = function () { draw(); };
      if (mq.addEventListener) mq.addEventListener("change", mqHandler);
    }
    var mo = new MutationObserver(function () { draw(); });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"]
    });
    fig._teardownResize = function () {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      if (mq && mqHandler && mq.removeEventListener) {
        mq.removeEventListener("change", mqHandler);
      }
      mo.disconnect();
    };
  }

  /* ---- function: curve, tangent line, secant lines, derivative ---- */

  components["function"] = function (fig, spec) {
    var curves = (spec.curves || [{ f: spec.f, label: spec.label }]).map(function (c, i) {
      return {
        fn: compile(c.f, ["x"]),
        color: c.color || [null, "curve2", "curve3"][i] || "curve",
        label: c.label || c.f,
        dash: c.dash
      };
    });
    var dom = spec.domain || [-5, 5];
    var plot = new Plot2D(fig.canvas, { xmin: dom[0], xmax: dom[1] });

    var tangent = spec.tangent || null;
    var secant = spec.secant || null;
    var showDeriv = !!spec.derivative;
    var a = tangent ? (tangent.at !== undefined ? tangent.at : (dom[0] + dom[1]) / 2) : 0;

    var ctrl = null;
    if (secant || showDeriv || (tangent && tangent.draggable !== false)) {
      ctrl = new Controls(fig.controls);
      if (tangent && tangent.draggable !== false) {
        ctrl.slider("a", spec.pointLabel || "point a", dom[0], dom[1], (dom[1] - dom[0]) / 200, a, function (v) { return fmt(v, 2); });
      }
      if (secant) {
        var hmax = secant.max || (dom[1] - dom[0]) / 3;
        ctrl.slider("h", "h", 0.01, hmax, 0.01, secant.h === undefined ? hmax * 0.8 : secant.h, function (v) { return fmt(v, 2); });
        ctrl.button("Animate h → 0", function () {
          var start = ctrl.state.h, t0 = performance.now();
          (function step(now) {
            var u = Math.min(1, (now - t0) / 1600);
            ctrl.set_h(Math.max(0.01, start * (1 - u) + 0.01 * u));
            draw();
            if (u < 1) requestAnimationFrame(step);
          })(t0);
        });
      }
      if (showDeriv) ctrl.toggle("deriv", "show f ′", spec.derivativeOn !== false);
      ctrl.onChange = function () { draw(); };
    }

    function derivAt(fn, x) {
      var h = Math.max(1e-6, Math.abs(x) * 1e-6 + 1e-6);
      return (fn(x + h) - fn(x - h)) / (2 * h);
    }

    function draw() {
      plot.resize();
      plot.xmin = dom[0]; plot.xmax = dom[1];
      var sampleFns = curves.map(function (c) { return c.fn; });
      if (spec.range) { plot.ymin = spec.range[0]; plot.ymax = spec.range[1]; }
      else plot.autoRange(sampleFns);
      plot.clear();
      plot.drawAxes({ xLabel: spec.xLabel || "x", yLabel: spec.yLabel });

      curves.forEach(function (c) {
        plot.curve(c.fn, { color: plot.c[c.color] || c.color, dash: c.dash });
      });

      var f0 = curves[0].fn;
      var av = ctrl && ctrl.state.a !== undefined ? ctrl.state.a : a;

      if (showDeriv && (!ctrl || ctrl.state.deriv)) {
        plot.curve(function (x) { return derivAt(f0, x); }, { color: plot.c.curve2, dash: [5, 4] });
      }

      if (secant) {
        var h = ctrl.state.h;
        var x2 = clamp(av + h, dom[0], dom[1]);
        var y1 = f0(av), y2 = f0(x2);
        var m = (y2 - y1) / (x2 - av);
        if (isFinite(m)) {
          plot.segment(dom[0], y1 + m * (dom[0] - av), dom[1], y1 + m * (dom[1] - av), { color: plot.c.accent2, width: 1.6 });
          plot.point(x2, y2, { color: plot.c.accent2, r: 4 });
          plot.segment(av, y1, x2, y1, { color: plot.c.muted, width: 1, dash: [3, 3] });
          plot.segment(x2, y1, x2, y2, { color: plot.c.muted, width: 1, dash: [3, 3] });
        }
      }

      if (tangent) {
        var yt = f0(av);
        var mt = derivAt(f0, av);
        plot.segment(dom[0], yt + mt * (dom[0] - av), dom[1], yt + mt * (dom[1] - av), { color: plot.c.accent, width: 1.8 });
        plot.point(av, yt, { color: plot.c.accent });
        plot.label(av, yt, "(" + fmt(av, 2) + ", " + fmt(yt, 2) + ")", { dy: -10, dx: 8 });
      }

      if (spec.fill) {
        plot.fillUnder(f0, spec.fill[0], spec.fill[1]);
      }

      var parts = [];
      if (tangent) parts.push("f ′(" + fmt(av, 2) + ") = " + fmt(derivAt(f0, av), 3));
      if (secant) {
        var hh = ctrl.state.h;
        parts.push("secant slope = " + fmt((f0(av + hh) - f0(av)) / hh, 3));
      }
      fig.readout(parts.join("   ·   "));
    }

    if (tangent && tangent.draggable !== false) {
      fig.canvas.classList.add("is-grabbable");
      var dragging = false;
      var move = function (ev) {
        var rect = fig.canvas.getBoundingClientRect();
        var x = clamp(plot.invX(ev.clientX - rect.left), dom[0], dom[1]);
        ctrl.set_a(x);
        draw();
      };
      fig.canvas.addEventListener("pointerdown", function (ev) {
        dragging = true;
        fig.canvas.setPointerCapture(ev.pointerId);
        move(ev);
      });
      fig.canvas.addEventListener("pointermove", function (ev) { if (dragging) move(ev); });
      ["pointerup", "pointercancel"].forEach(function (e) {
        fig.canvas.addEventListener(e, function () { dragging = false; });
      });
    }

    bindResize(fig, draw);
    draw();
  };

  /* ---- extrema: curve, critical points, first-derivative sign chart ---- */

  function derivNumeric(fn, x) {
    var h = Math.max(1e-6, Math.abs(x) * 1e-6 + 1e-6);
    return (fn(x + h) - fn(x - h)) / (2 * h);
  }

  function signOf(v) {
    if (!isFinite(v) || Math.abs(v) < 1e-8) return 0;
    return v > 0 ? 1 : -1;
  }

  function intervalSign(fp, a, b) {
    var probes = [0.18, 0.5, 0.82];
    for (var i = 0; i < probes.length; i++) {
      var s = signOf(fp(a + (b - a) * probes[i]));
      if (s) return s;
    }
    return 0;
  }

  function findCritical(fp, dom) {
    var zeros = [];
    var N = 480;
    var prevX = dom[0], prevY = fp(dom[0]);
    var span = dom[1] - dom[0];
    for (var i = 1; i <= N; i++) {
      var x = dom[0] + (span * i) / N;
      var y = fp(x);
      var jumped = (isFinite(prevY) !== isFinite(y)) ||
        (isFinite(prevY) && isFinite(y) && prevY * y <= 0 && !(prevY === 0 && y === 0));
      if (jumped) {
        var lo = prevX, hi = x, flo = prevY;
        for (var k = 0; k < 36; k++) {
          var mid = (lo + hi) / 2;
          var fm = fp(mid);
          if (!isFinite(flo) || !isFinite(fm) || flo * fm <= 0) hi = mid;
          else { lo = mid; flo = fm; }
        }
        var z = (lo + hi) / 2;
        if (z > dom[0] + span * 1e-4 && z < dom[1] - span * 1e-4) {
          if (!zeros.length || Math.abs(z - zeros[zeros.length - 1]) > span * 0.012) zeros.push(z);
        }
      }
      prevX = x; prevY = y;
    }
    return zeros;
  }

  function uniqueSorted(arr) {
    var out = arr.slice().sort(function (a, b) { return a - b; });
    var uniq = [];
    for (var i = 0; i < out.length; i++) {
      if (!uniq.length || Math.abs(out[i] - uniq[uniq.length - 1]) > 1e-6) uniq.push(out[i]);
    }
    return uniq;
  }

  components.extrema = function (fig, spec) {
    var f = compile(spec.f, ["x"]);
    var fp = spec.fp ? compile(spec.fp, ["x"]) : function (x) { return derivNumeric(f, x); };
    var dom = spec.domain || [-5, 5];
    var showChart = spec.signchart !== false;
    var endpoints = !!spec.endpoints;
    var plot = new Plot2D(fig.canvas, {
      xmin: dom[0], xmax: dom[1],
      pad: { l: 46, r: 16, t: 14, b: showChart ? 64 : 32 }
    });

    var crit = uniqueSorted((spec.critical && spec.critical.length ? spec.critical : findCritical(fp, dom))
      .filter(function (c) { return c > dom[0] + 1e-9 && c < dom[1] - 1e-9; }));

    var probe0 = spec.probe !== undefined ? spec.probe : (dom[0] + dom[1]) / 2;
    var ctrl = new Controls(fig.controls);
    ctrl.slider("x", spec.pointLabel || "probe x", dom[0], dom[1], (dom[1] - dom[0]) / 200, probe0, function (v) { return fmt(v, 2); });
    ctrl.toggle("deriv", "show f ′", !!spec.derivativeOn);
    ctrl.onChange = function () { draw(); };

    function cutsAndSigns() {
      var cuts = uniqueSorted([dom[0]].concat(crit).concat([dom[1]]));
      var signs = [];
      for (var i = 0; i < cuts.length - 1; i++) signs.push(intervalSign(fp, cuts[i], cuts[i + 1]));
      return { cuts: cuts, signs: signs };
    }

    function classifyAt(cuts, signs, i) {
      // i indexes an interior cut
      var L = signs[i - 1], R = signs[i];
      if (L > 0 && R < 0) return "max";
      if (L < 0 && R > 0) return "min";
      return "neither";
    }

    function absExtrema() {
      var xs = uniqueSorted(crit.concat(endpoints ? [dom[0], dom[1]] : []));
      if (!xs.length) return null;
      var vals = xs.map(function (x) { return { x: x, y: f(x) }; }).filter(function (v) { return isFinite(v.y); });
      if (!vals.length) return null;
      var hi = vals[0].y, lo = vals[0].y;
      for (var i = 1; i < vals.length; i++) {
        if (vals[i].y > hi) hi = vals[i].y;
        if (vals[i].y < lo) lo = vals[i].y;
      }
      var tol = Math.max(1e-8, (hi - lo) * 1e-8);
      function xsAt(target) {
        return vals.filter(function (v) { return Math.abs(v.y - target) <= tol; })
          .map(function (v) { return fmt(v.x, 2); }).join(", ");
      }
      return { maxAt: xsAt(hi), minAt: xsAt(lo) };
    }

    function drawSignChart(cuts, signs) {
      var ctx = plot.ctx, c = plot.c;
      var y = plot.h - 22;
      ctx.save();
      ctx.strokeStyle = c.axis;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(plot.X(dom[0]), y);
      ctx.lineTo(plot.X(dom[1]), y);
      ctx.stroke();

      ctx.font = "bold 13px " + getComputedStyle(document.body).fontFamily;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      for (var i = 0; i < signs.length; i++) {
        var x0 = plot.X(cuts[i]), x1 = plot.X(cuts[i + 1]);
        var xm = (x0 + x1) / 2;
        var s = signs[i];
        ctx.fillStyle = s > 0 ? c.accent2 : s < 0 ? c.accent : c.muted;
        ctx.fillText(s > 0 ? "+" : s < 0 ? "−" : "0", xm, y - 6);
        if (s) {
          var dir = s > 0 ? 1 : -1;
          var ax = xm - 14 * dir, bx = xm + 14 * dir;
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(ax, y + 8); ctx.lineTo(bx, y + 8);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(bx, y + 8);
          ctx.lineTo(bx - 5 * dir, y + 4);
          ctx.lineTo(bx - 5 * dir, y + 12);
          ctx.closePath();
          ctx.fill();
        }
      }

      ctx.font = "11px " + getComputedStyle(document.body).fontFamily;
      ctx.textBaseline = "top";
      for (var j = 1; j < cuts.length - 1; j++) {
        var px = plot.X(cuts[j]);
        ctx.strokeStyle = c.ink;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(px, y - 5); ctx.lineTo(px, y + 5);
        ctx.stroke();
        var kind = classifyAt(cuts, signs, j);
        ctx.fillStyle = kind === "max" ? c.accent : kind === "min" ? c.accent2 : c.muted;
        ctx.fillText(kind === "max" ? "max" : kind === "min" ? "min" : "—", px, y + 10);
      }
      if (endpoints) {
        [dom[0], dom[1]].forEach(function (ex) {
          var qx = plot.X(ex);
          ctx.fillStyle = c.muted;
          ctx.fillRect(qx - 3, y - 3, 6, 6);
        });
      }
      ctx.restore();
    }

    function nearestCrit(x) {
      var best = null, bestD = Infinity;
      for (var i = 0; i < crit.length; i++) {
        var d = Math.abs(x - crit[i]);
        if (d < bestD) { bestD = d; best = crit[i]; }
      }
      var tol = (dom[1] - dom[0]) * 0.035;
      return bestD < tol ? best : null;
    }

    function draw() {
      plot.resize();
      plot.xmin = dom[0]; plot.xmax = dom[1];
      if (spec.range) { plot.ymin = spec.range[0]; plot.ymax = spec.range[1]; }
      else plot.autoRange([f]);
      plot.clear();
      plot.drawAxes({ xLabel: spec.xLabel || "x" });

      var xv = ctrl.state.x;
      var pack = cutsAndSigns();
      var c = plot.c;

      for (var i = 0; i < crit.length; i++) {
        plot.segment(crit[i], plot.ymin, crit[i], plot.ymax, { color: c.muted, width: 1, dash: [3, 3] });
      }
      if (endpoints) {
        plot.segment(dom[0], plot.ymin, dom[0], plot.ymax, { color: c.muted, width: 1, dash: [2, 3] });
        plot.segment(dom[1], plot.ymin, dom[1], plot.ymax, { color: c.muted, width: 1, dash: [2, 3] });
      }

      plot.curve(f, { color: c.curve, width: 2.2 });
      if (ctrl.state.deriv) {
        plot.curve(fp, { color: c.curve2, dash: [5, 4], width: 1.7 });
      }

      for (var k = 0; k < crit.length; k++) {
        var cy = f(crit[k]);
        if (!isFinite(cy)) continue;
        var kind = "neither";
        for (var t = 1; t < pack.cuts.length - 1; t++) {
          if (Math.abs(pack.cuts[t] - crit[k]) < 1e-6) { kind = classifyAt(pack.cuts, pack.signs, t); break; }
        }
        var col = kind === "max" ? c.accent : kind === "min" ? c.accent2 : c.muted;
        plot.point(crit[k], cy, { color: col });
        plot.label(crit[k], cy, "x = " + fmt(crit[k], 2), { dy: kind === "max" ? -12 : 16, dx: 7, color: col });
      }

      if (endpoints) {
        plot.point(dom[0], f(dom[0]), { color: c.muted, r: 4 });
        plot.point(dom[1], f(dom[1]), { color: c.muted, r: 4 });
        plot.label(dom[0], f(dom[0]), "end", { dy: -10, dx: 8, color: c.muted });
        plot.label(dom[1], f(dom[1]), "end", { dy: -10, dx: -8, align: "right", color: c.muted });
      }

      plot.point(xv, f(xv), { color: c.accent });
      plot.segment(xv, plot.ymin, xv, f(xv), { color: c.accent, width: 1, dash: [2, 3] });

      if (showChart) drawSignChart(pack.cuts, pack.signs);

      var parts = [];
      var near = nearestCrit(xv);
      var fpv = fp(xv);
      parts.push("f ′(" + fmt(xv, 2) + ") = " + (isFinite(fpv) ? fmt(fpv, 3) : "undefined"));
      if (near !== null) {
        var idx = -1;
        for (var u = 1; u < pack.cuts.length - 1; u++) {
          if (Math.abs(pack.cuts[u] - near) < 1e-6) { idx = u; break; }
        }
        if (idx > 0) {
          var kind2 = classifyAt(pack.cuts, pack.signs, idx);
          var L = pack.signs[idx - 1], R = pack.signs[idx];
          var arrow = (L > 0 ? "+" : L < 0 ? "−" : "0") + " → " + (R > 0 ? "+" : R < 0 ? "−" : "0");
          parts.push(arrow);
          parts.push(kind2 === "max" ? "local max" : kind2 === "min" ? "local min" : "not an extremum");
        }
      } else {
        var sg = signOf(fpv);
        if (!sg) {
          for (var p = 0; p < pack.cuts.length - 1; p++) {
            if (xv >= pack.cuts[p] && xv <= pack.cuts[p + 1]) { sg = pack.signs[p]; break; }
          }
        }
        parts.push(sg > 0 ? "increasing" : sg < 0 ? "decreasing" : "flat");
      }
      if (endpoints) {
        var ext = absExtrema();
        if (ext) parts.push("abs max at x = " + ext.maxAt + "  ·  abs min at x = " + ext.minAt);
      }
      fig.readout(parts.join("   ·   "));
    }

    fig.canvas.classList.add("is-grabbable");
    var dragging = false;
    var move = function (ev) {
      var rect = fig.canvas.getBoundingClientRect();
      var x = clamp(plot.invX(ev.clientX - rect.left), dom[0], dom[1]);
      ctrl.set_x(x);
      draw();
    };
    fig.canvas.addEventListener("pointerdown", function (ev) {
      dragging = true;
      fig.canvas.setPointerCapture(ev.pointerId);
      move(ev);
    });
    fig.canvas.addEventListener("pointermove", function (ev) { if (dragging) move(ev); });
    ["pointerup", "pointercancel"].forEach(function (e) {
      fig.canvas.addEventListener(e, function () { dragging = false; });
    });

    legend(fig.figure, [
      { color: "var(--plot-curve)", label: "f" },
      { color: "var(--plot-curve-2)", label: "f ′ (toggle)" },
      { color: "var(--plot-accent)", label: "local max" },
      { color: "var(--plot-accent-2)", label: "local min" }
    ]);

    bindResize(fig, draw);
    draw();
  };

  /* ---- riemann: left/right/midpoint/trapezoid sums vs the exact integral ---- */

  components.riemann = function (fig, spec) {
    var f = compile(spec.f, ["x"]);
    var dom = spec.domain || [0, 4];
    var a = spec.a === undefined ? dom[0] : spec.a;
    var b = spec.b === undefined ? dom[1] : spec.b;
    var plot = new Plot2D(fig.canvas, { xmin: dom[0], xmax: dom[1] });
    var rules = spec.rules || ["left", "right", "midpoint", "trapezoid"];
    var exact = simpson(f, a, b, 2000);

    var ctrl = new Controls(fig.controls);
    ctrl.segmented("rule", "rule", rules.map(function (r) {
      return { value: r, label: r.charAt(0).toUpperCase() + r.slice(1) };
    }), spec.rule || rules[0]);
    ctrl.slider("n", "n", 1, spec.maxN || 60, 1, spec.n || 8, function (v) { return String(v); });
    ctrl.onChange = function () { draw(); };

    function draw() {
      plot.resize();
      if (spec.range) { plot.ymin = spec.range[0]; plot.ymax = spec.range[1]; }
      else plot.autoRange([f]);
      plot.clear();
      plot.drawAxes({ xLabel: "x" });

      var res = riemannSum(f, a, b, ctrl.state.n, ctrl.state.rule);
      var c = plot.c;
      res.bars.forEach(function (bar) {
        if (ctrl.state.rule === "trapezoid") {
          var ctx = plot.ctx;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(plot.X(bar.x0), plot.Y(0));
          ctx.lineTo(plot.X(bar.x0), plot.Y(bar.y0));
          ctx.lineTo(plot.X(bar.x1), plot.Y(bar.y1));
          ctx.lineTo(plot.X(bar.x1), plot.Y(0));
          ctx.closePath();
          ctx.fillStyle = c.fill;
          ctx.fill();
          ctx.strokeStyle = c.curve;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        } else {
          plot.rect(bar.x0, 0, bar.x1, bar.h, { fill: c.fill, stroke: c.curve, width: 1 });
        }
      });

      plot.curve(f, { color: c.curve, width: 2.2 });
      var err = res.total - exact;
      fig.readout(
        "S" + ctrl.state.n + " = " + fmt(res.total, 4) +
        "   ·   exact = " + fmt(exact, 4) +
        "   ·   error = " + (err >= 0 ? "+" : "") + fmt(err, 4)
      );
    }

    bindResize(fig, draw);
    draw();
  };

  /* ---- accumulation: the FTC picture, area so far vs its antiderivative ---- */

  components.accumulation = function (fig, spec) {
    var f = compile(spec.f, ["x"]);
    var dom = spec.domain || [0, 6];
    var a = spec.a === undefined ? dom[0] : spec.a;
    var plot = new Plot2D(fig.canvas, { xmin: dom[0], xmax: dom[1] });

    var ctrl = new Controls(fig.controls);
    ctrl.slider("x", "upper limit x", dom[0], dom[1], (dom[1] - dom[0]) / 200, spec.x === undefined ? (dom[0] + dom[1]) / 2 : spec.x, function (v) { return fmt(v, 2); });
    ctrl.onChange = function () { draw(); };

    function F(x) { return simpson(f, a, x, 400); }

    function draw() {
      plot.resize();
      var fns = [f, F];
      if (spec.range) { plot.ymin = spec.range[0]; plot.ymax = spec.range[1]; }
      else plot.autoRange(fns);
      plot.clear();
      plot.drawAxes({ xLabel: "x" });

      var xv = ctrl.state.x;
      var c = plot.c;
      plot.fillUnder(f, a, xv, { color: c.fill });
      plot.curve(f, { color: c.curve, width: 2.2 });
      plot.curve(F, { color: c.curve2, width: 2, dash: [6, 4] });
      plot.segment(xv, plot.ymin, xv, plot.ymax, { color: c.muted, width: 1, dash: [3, 3] });
      plot.point(xv, F(xv), { color: c.curve2 });
      plot.point(xv, f(xv), { color: c.curve });
      fig.readout("A(x) = " + fmt(F(xv), 4) + "   ·   A′(x) = f(x) = " + fmt(f(xv), 4));
    }

    legend(fig.figure, [
      { color: "var(--plot-curve)", label: "f (the rate)" },
      { color: "var(--plot-curve-2)", label: "A(x) = ∫ₐˣ f (the accumulation)" }
    ]);

    bindResize(fig, draw);
    draw();
  };

  /* ---- slopefield: dy/dx = g(x, y) with RK4 solution curves ---- */

  components.slopefield = function (fig, spec) {
    var g = compile(spec.dy, ["x", "y"]);
    var dom = spec.domain || [-3, 3];
    var rng = spec.range || [-3, 3];
    var plot = new Plot2D(fig.canvas, { xmin: dom[0], xmax: dom[1], ymin: rng[0], ymax: rng[1] });
    var seeds = (spec.solutions || []).slice();

    var ctrl = new Controls(fig.controls);
    ctrl.button("Clear curves", function () { seeds.length = 0; draw(); });
    ctrl.onChange = function () { draw(); };

    function draw() {
      plot.resize();
      plot.xmin = dom[0]; plot.xmax = dom[1];
      plot.ymin = rng[0]; plot.ymax = rng[1];
      plot.clear();
      plot.drawAxes({ xLabel: "x", yLabel: "y" });

      var c = plot.c;
      var nx = spec.density || 17;
      var ny = Math.round(nx * 0.72);
      // Ticks are sized and oriented in pixel space, so the angle a student
      // measures on screen is the actual slope the equation prescribes.
      var sx = (plot.w - plot.pad.l - plot.pad.r) / (dom[1] - dom[0]);
      var sy = (plot.h - plot.pad.t - plot.pad.b) / (rng[1] - rng[0]);
      var tickPx = Math.min((plot.w - plot.pad.l - plot.pad.r) / nx, (plot.h - plot.pad.t - plot.pad.b) / ny) * 0.78;
      for (var i = 0; i <= nx; i++) {
        for (var j = 0; j <= ny; j++) {
          var x = dom[0] + ((dom[1] - dom[0]) * i) / nx;
          var y = rng[0] + ((rng[1] - rng[0]) * j) / ny;
          var m = g(x, y);
          if (!isFinite(m)) continue;
          var pxDir = sx;
          var pyDir = m * sy;
          var norm = Math.hypot(pxDir, pyDir) || 1;
          var dx = ((pxDir / norm) * (tickPx / 2)) / sx;
          var dy = ((pyDir / norm) * (tickPx / 2)) / sy;
          plot.segment(x - dx, y - dy, x + dx, y + dy, { color: c.axis, width: 1.2 });
        }
      }

      seeds.forEach(function (s, idx) {
        var color = [c.accent, c.curve, c.accent2, c.curve3][idx % 4];
        var step = (dom[1] - dom[0]) / 400;
        var fwd = rk4Path(g, s[0], s[1], step, 400, [rng[0] - 2, rng[1] + 2]);
        var back = rk4Path(g, s[0], s[1], -step, 400, [rng[0] - 2, rng[1] + 2]);
        var pts = back.slice().reverse().concat(fwd.slice(1));
        var ctx = plot.ctx;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.2;
        ctx.lineJoin = "round";
        ctx.beginPath();
        pts.forEach(function (p, i) {
          if (i === 0) ctx.moveTo(plot.X(p[0]), plot.Y(p[1]));
          else ctx.lineTo(plot.X(p[0]), plot.Y(p[1]));
        });
        ctx.stroke();
        ctx.restore();
        plot.point(s[0], s[1], { color: color, r: 4 });
      });

      fig.readout(seeds.length ? seeds.length + " solution curve" + (seeds.length > 1 ? "s" : "") : "click to drop an initial condition");
    }

    fig.canvas.style.cursor = "crosshair";
    fig.canvas.addEventListener("click", function (ev) {
      var rect = fig.canvas.getBoundingClientRect();
      seeds.push([plot.invX(ev.clientX - rect.left), plot.invY(ev.clientY - rect.top)]);
      draw();
    });

    bindResize(fig, draw);
    draw();
  };

  /* ---- taylor: exact Taylor polynomials via power-series arithmetic ---- */

  components.taylor = function (fig, spec) {
    var f = compile(spec.f, ["x"]);
    var dom = spec.domain || [-6, 6];
    var center = spec.center === undefined ? 0 : spec.center;
    var maxDeg = spec.maxDegree || 11;
    var coeffs = taylorCoefficients(spec.f, center, maxDeg);
    var plot = new Plot2D(fig.canvas, { xmin: dom[0], xmax: dom[1] });

    var ctrl = new Controls(fig.controls);
    ctrl.slider("n", "degree n", 0, maxDeg, 1, spec.degree === undefined ? 3 : spec.degree, function (v) { return String(v); });
    ctrl.toggle("err", "show |f − Pₙ|", false);
    ctrl.onChange = function () { draw(); };

    function P(n, x) {
      var s = 0, p = 1, d = x - center;
      for (var k = 0; k <= n; k++) { s += coeffs[k] * p; p *= d; }
      return s;
    }

    function draw() {
      plot.resize();
      if (spec.range) { plot.ymin = spec.range[0]; plot.ymax = spec.range[1]; }
      else plot.autoRange([f]);
      plot.clear();
      plot.drawAxes({ xLabel: "x" });

      var n = ctrl.state.n, c = plot.c;
      plot.curve(f, { color: c.curve, width: 2.4 });
      plot.curve(function (x) { return P(n, x); }, { color: c.accent, width: 2 });
      if (ctrl.state.err) {
        plot.curve(function (x) { return Math.abs(f(x) - P(n, x)); }, { color: c.accent2, width: 1.6, dash: [5, 4] });
      }
      plot.point(center, f(center), { color: c.ink, r: 3.5 });

      // Where does the approximation stay within 0.01?
      var good = 0;
      for (var t = 0; t <= 200; t++) {
        var x = center + ((dom[1] - center) * t) / 200;
        if (Math.abs(f(x) - P(n, x)) < 0.01) good = x - center; else break;
      }
      fig.readout("P" + n + " tracks f to ±0.01 for |x − " + fmt(center, 1) + "| ≲ " + fmt(good, 2));
    }

    legend(fig.figure, [
      { color: "var(--plot-curve)", label: "f(x)" },
      { color: "var(--plot-accent)", label: "Taylor polynomial Pₙ(x)" }
    ]);

    bindResize(fig, draw);
    draw();
  };

  /* ---- vectorfield: 2D field with divergence / curl readout ---- */

  components.vectorfield = function (fig, spec) {
    var fields = spec.fields || [{ F: spec.F, label: spec.label || spec.F }];
    var compiled = fields.map(function (fd) {
      var parts = Array.isArray(fd.F) ? fd.F : String(fd.F).replace(/^\(|\)$/g, "").split(",");
      return {
        label: fd.label || "(" + parts.join(", ") + ")",
        P: compile(parts[0], ["x", "y"]),
        Q: compile(parts[1], ["x", "y"])
      };
    });
    var dom = spec.domain || [-3, 3];
    var plot = new Plot2D(fig.canvas, { xmin: dom[0], xmax: dom[1], ymin: dom[0], ymax: dom[1] });

    var ctrl = new Controls(fig.controls);
    if (compiled.length > 1) {
      ctrl.segmented("i", "field", compiled.map(function (fd, i) { return { value: i, label: fd.label }; }), 0);
    } else {
      ctrl.state.i = 0;
    }
    ctrl.onChange = function () { draw(); };

    function draw() {
      plot.resize();
      plot.xmin = dom[0]; plot.xmax = dom[1];
      plot.ymin = dom[0]; plot.ymax = dom[1];
      plot.equalAspect = true;
      plot.applyEqualAspect();
      plot.clear();
      plot.drawAxes({ xLabel: "x", yLabel: "y" });

      var fd = compiled[ctrl.state.i];
      var n = spec.density || 15;
      var h = 1e-4;
      var maxMag = 0;
      var samples = [];
      for (var i = 0; i <= n; i++) {
        for (var j = 0; j <= n; j++) {
          var x = plot.xmin + ((plot.xmax - plot.xmin) * i) / n;
          var y = plot.ymin + ((plot.ymax - plot.ymin) * j) / n;
          var u = fd.P(x, y), v = fd.Q(x, y);
          if (!isFinite(u) || !isFinite(v)) continue;
          var mag = Math.hypot(u, v);
          maxMag = Math.max(maxMag, mag);
          samples.push({ x: x, y: y, u: u, v: v, mag: mag });
        }
      }
      var cell = (plot.xmax - plot.xmin) / n;
      samples.forEach(function (s) {
        if (s.mag < 1e-9) return;
        var scale = (cell * 0.85) / (maxMag || 1);
        plot.arrow(s.x, s.y, s.x + s.u * scale, s.y + s.v * scale, {
          color: shadeColor(s.mag / (maxMag || 1), 0.95),
          width: 1.3,
          head: 6
        });
      });

      var div = (fd.P(0.7 + h, 0.4) - fd.P(0.7 - h, 0.4)) / (2 * h) + (fd.Q(0.7, 0.4 + h) - fd.Q(0.7, 0.4 - h)) / (2 * h);
      var curl = (fd.Q(0.7 + h, 0.4) - fd.Q(0.7 - h, 0.4)) / (2 * h) - (fd.P(0.7, 0.4 + h) - fd.P(0.7, 0.4 - h)) / (2 * h);
      fig.readout("at (0.7, 0.4):  div F = " + fmt(div, 2) + "   ·   curl F = " + fmt(curl, 2));
    }

    bindResize(fig, draw);
    draw();
  };

  /* ---- surface3d: z = f(x, y), optionally with gradient arrows ---- */

  components.surface3d = function (fig, spec) {
    var surfaces = spec.surfaces || [{ f: spec.f, label: spec.label || spec.f }];
    var compiled = surfaces.map(function (s) {
      return { label: s.label || s.f, fn: compile(s.f, ["x", "y"]), zrange: s.zrange };
    });
    var dom = spec.domain || [-3, 3];
    var scene = new Scene3D(fig.canvas, {
      bounds: { x: dom, y: dom, z: spec.zrange || [0, 8] },
      cameraDepth: spec.cameraDepth
    });

    var ctrl = new Controls(fig.controls);
    if (compiled.length > 1) {
      ctrl.segmented("i", "surface", compiled.map(function (s, i) { return { value: i, label: s.label }; }), 0);
    } else {
      ctrl.state.i = 0;
    }
    if (spec.gradient) ctrl.toggle("grad", "gradient arrows on the floor", true);
    ctrl.onChange = function () { draw(); };

    function draw() {
      scene.resize();
      var s = compiled[ctrl.state.i];
      var zr = s.zrange || spec.zrange;
      if (!zr) {
        var lo = Infinity, hi = -Infinity;
        for (var i = 0; i <= 24; i++) for (var j = 0; j <= 24; j++) {
          var x = dom[0] + ((dom[1] - dom[0]) * i) / 24;
          var y = dom[0] + ((dom[1] - dom[0]) * j) / 24;
          var z = s.fn(x, y);
          if (isFinite(z)) { lo = Math.min(lo, z); hi = Math.max(hi, z); }
        }
        zr = [lo, hi];
      }
      scene.bounds = { x: dom, y: dom, z: zr };
      scene.clear();
      scene.drawBox();
      scene.surface(s.fn, { res: spec.res || 28 });

      if (spec.gradient && ctrl.state.grad) {
        var h = 1e-4, n = 9;
        for (var a = 1; a < n; a++) {
          for (var b = 1; b < n; b++) {
            var px = dom[0] + ((dom[1] - dom[0]) * a) / n;
            var py = dom[0] + ((dom[1] - dom[0]) * b) / n;
            var gx = (s.fn(px + h, py) - s.fn(px - h, py)) / (2 * h);
            var gy = (s.fn(px, py + h) - s.fn(px, py - h)) / (2 * h);
            var mag = Math.hypot(gx, gy) || 1;
            var k = ((dom[1] - dom[0]) / n) * 0.75 / Math.max(1, mag);
            scene.arrow3([px, py, zr[0]], [px + gx * k, py + gy * k, zr[0]], {
              color: shadeColor(Math.min(1, mag / 6), 0.95), width: 1.3
            });
          }
        }
      }
      fig.readout("drag to orbit");
    }

    scene.enableOrbit(draw);
    bindResize(fig, draw);
    draw();
  };

  /* ======================================================================
     8. Mounting + page chrome
     ====================================================================== */

  function makeFigureApi(el) {
    var canvas = el.querySelector("[data-ck-canvas]");
    var controls = el.querySelector("[data-ck-controls]");
    var readoutEl = el.querySelector("[data-ck-readout]");
    return {
      figure: el,
      canvas: canvas,
      controls: controls,
      readout: function (text) { if (readoutEl) readoutEl.textContent = text || ""; }
    };
  }

export { components, compile, makeFigureApi };
