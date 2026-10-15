/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Y = globalThis, pt = Y.ShadowRoot && (Y.ShadyCSS === void 0 || Y.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, ut = Symbol(), mt = /* @__PURE__ */ new WeakMap();
let Nt = class {
  constructor(t, s, i) {
    if (this._$cssResult$ = !0, i !== ut) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = s;
  }
  get styleSheet() {
    let t = this.o;
    const s = this.t;
    if (pt && t === void 0) {
      const i = s !== void 0 && s.length === 1;
      i && (t = mt.get(s)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), i && mt.set(s, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const Vt = (e) => new Nt(typeof e == "string" ? e : e + "", void 0, ut), Mt = (e, ...t) => {
  const s = e.length === 1 ? e[0] : t.reduce((i, n, r) => i + ((o) => {
    if (o._$cssResult$ === !0) return o.cssText;
    if (typeof o == "number") return o;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + o + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(n) + e[r + 1], e[0]);
  return new Nt(s, e, ut);
}, Ft = (e, t) => {
  if (pt) e.adoptedStyleSheets = t.map((s) => s instanceof CSSStyleSheet ? s : s.styleSheet);
  else for (const s of t) {
    const i = document.createElement("style"), n = Y.litNonce;
    n !== void 0 && i.setAttribute("nonce", n), i.textContent = s.cssText, e.appendChild(i);
  }
}, gt = pt ? (e) => e : (e) => e instanceof CSSStyleSheet ? ((t) => {
  let s = "";
  for (const i of t.cssRules) s += i.cssText;
  return Vt(s);
})(e) : e;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: Zt, defineProperty: Kt, getOwnPropertyDescriptor: Jt, getOwnPropertyNames: Yt, getOwnPropertySymbols: Gt, getPrototypeOf: Qt } = Object, it = globalThis, $t = it.trustedTypes, Xt = $t ? $t.emptyScript : "", te = it.reactiveElementPolyfillSupport, L = (e, t) => e, dt = { toAttribute(e, t) {
  switch (t) {
    case Boolean:
      e = e ? Xt : null;
      break;
    case Object:
    case Array:
      e = e == null ? e : JSON.stringify(e);
  }
  return e;
}, fromAttribute(e, t) {
  let s = e;
  switch (t) {
    case Boolean:
      s = e !== null;
      break;
    case Number:
      s = e === null ? null : Number(e);
      break;
    case Object:
    case Array:
      try {
        s = JSON.parse(e);
      } catch {
        s = null;
      }
  }
  return s;
} }, Rt = (e, t) => !Zt(e, t), bt = { attribute: !0, type: String, converter: dt, reflect: !1, useDefault: !1, hasChanged: Rt };
Symbol.metadata ??= Symbol("metadata"), it.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let E = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ??= []).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, s = bt) {
    if (s.state && (s.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((s = Object.create(s)).wrapped = !0), this.elementProperties.set(t, s), !s.noAccessor) {
      const i = Symbol(), n = this.getPropertyDescriptor(t, i, s);
      n !== void 0 && Kt(this.prototype, t, n);
    }
  }
  static getPropertyDescriptor(t, s, i) {
    const { get: n, set: r } = Jt(this.prototype, t) ?? { get() {
      return this[s];
    }, set(o) {
      this[s] = o;
    } };
    return { get: n, set(o) {
      const a = n?.call(this);
      r?.call(this, o), this.requestUpdate(t, a, i);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? bt;
  }
  static _$Ei() {
    if (this.hasOwnProperty(L("elementProperties"))) return;
    const t = Qt(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(L("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(L("properties"))) {
      const s = this.properties, i = [...Yt(s), ...Gt(s)];
      for (const n of i) this.createProperty(n, s[n]);
    }
    const t = this[Symbol.metadata];
    if (t !== null) {
      const s = litPropertyMetadata.get(t);
      if (s !== void 0) for (const [i, n] of s) this.elementProperties.set(i, n);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [s, i] of this.elementProperties) {
      const n = this._$Eu(s, i);
      n !== void 0 && this._$Eh.set(n, s);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(t) {
    const s = [];
    if (Array.isArray(t)) {
      const i = new Set(t.flat(1 / 0).reverse());
      for (const n of i) s.unshift(gt(n));
    } else t !== void 0 && s.push(gt(t));
    return s;
  }
  static _$Eu(t, s) {
    const i = s.attribute;
    return i === !1 ? void 0 : typeof i == "string" ? i : typeof t == "string" ? t.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise((t) => this.enableUpdating = t), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((t) => t(this));
  }
  addController(t) {
    (this._$EO ??= /* @__PURE__ */ new Set()).add(t), this.renderRoot !== void 0 && this.isConnected && t.hostConnected?.();
  }
  removeController(t) {
    this._$EO?.delete(t);
  }
  _$E_() {
    const t = /* @__PURE__ */ new Map(), s = this.constructor.elementProperties;
    for (const i of s.keys()) this.hasOwnProperty(i) && (t.set(i, this[i]), delete this[i]);
    t.size > 0 && (this._$Ep = t);
  }
  createRenderRoot() {
    const t = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return Ft(t, this.constructor.elementStyles), t;
  }
  connectedCallback() {
    this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((t) => t.hostConnected?.());
  }
  enableUpdating(t) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((t) => t.hostDisconnected?.());
  }
  attributeChangedCallback(t, s, i) {
    this._$AK(t, i);
  }
  _$ET(t, s) {
    const i = this.constructor.elementProperties.get(t), n = this.constructor._$Eu(t, i);
    if (n !== void 0 && i.reflect === !0) {
      const r = (i.converter?.toAttribute !== void 0 ? i.converter : dt).toAttribute(s, i.type);
      this._$Em = t, r == null ? this.removeAttribute(n) : this.setAttribute(n, r), this._$Em = null;
    }
  }
  _$AK(t, s) {
    const i = this.constructor, n = i._$Eh.get(t);
    if (n !== void 0 && this._$Em !== n) {
      const r = i.getPropertyOptions(n), o = typeof r.converter == "function" ? { fromAttribute: r.converter } : r.converter?.fromAttribute !== void 0 ? r.converter : dt;
      this._$Em = n;
      const a = o.fromAttribute(s, r.type);
      this[n] = a ?? this._$Ej?.get(n) ?? a, this._$Em = null;
    }
  }
  requestUpdate(t, s, i, n = !1, r) {
    if (t !== void 0) {
      const o = this.constructor;
      if (n === !1 && (r = this[t]), i ??= o.getPropertyOptions(t), !((i.hasChanged ?? Rt)(r, s) || i.useDefault && i.reflect && r === this._$Ej?.get(t) && !this.hasAttribute(o._$Eu(t, i)))) return;
      this.C(t, s, i);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, s, { useDefault: i, reflect: n, wrapped: r }, o) {
    i && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t) && (this._$Ej.set(t, o ?? s ?? this[t]), r !== !0 || o !== void 0) || (this._$AL.has(t) || (this.hasUpdated || i || (s = void 0), this._$AL.set(t, s)), n === !0 && this._$Em !== t && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t));
  }
  async _$EP() {
    this.isUpdatePending = !0;
    try {
      await this._$ES;
    } catch (s) {
      Promise.reject(s);
    }
    const t = this.scheduleUpdate();
    return t != null && await t, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
        for (const [n, r] of this._$Ep) this[n] = r;
        this._$Ep = void 0;
      }
      const i = this.constructor.elementProperties;
      if (i.size > 0) for (const [n, r] of i) {
        const { wrapped: o } = r, a = this[n];
        o !== !0 || this._$AL.has(n) || a === void 0 || this.C(n, void 0, r, a);
      }
    }
    let t = !1;
    const s = this._$AL;
    try {
      t = this.shouldUpdate(s), t ? (this.willUpdate(s), this._$EO?.forEach((i) => i.hostUpdate?.()), this.update(s)) : this._$EM();
    } catch (i) {
      throw t = !1, this._$EM(), i;
    }
    t && this._$AE(s);
  }
  willUpdate(t) {
  }
  _$AE(t) {
    this._$EO?.forEach((s) => s.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(t)), this.updated(t);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(t) {
    return !0;
  }
  update(t) {
    this._$Eq &&= this._$Eq.forEach((s) => this._$ET(s, this[s])), this._$EM();
  }
  updated(t) {
  }
  firstUpdated(t) {
  }
};
E.elementStyles = [], E.shadowRootOptions = { mode: "open" }, E[L("elementProperties")] = /* @__PURE__ */ new Map(), E[L("finalized")] = /* @__PURE__ */ new Map(), te?.({ ReactiveElement: E }), (it.reactiveElementVersions ??= []).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const ft = globalThis, wt = (e) => e, nt = ft.trustedTypes, vt = nt ? nt.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, jt = "$lit$", b = `lit$${Math.random().toFixed(9).slice(2)}$`, zt = "?" + b, ee = `<${zt}>`, S = document, B = () => S.createComment(""), W = (e) => e === null || typeof e != "object" && typeof e != "function", _t = Array.isArray, se = (e) => _t(e) || typeof e?.[Symbol.iterator] == "function", ot = `[ 	
\f\r]`, P = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, At = /-->/g, xt = />/g, v = RegExp(`>|${ot}(?:([^\\s"'>=/]+)(${ot}*=${ot}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), kt = /'/g, St = /"/g, It = /^(?:script|style|textarea|title)$/i, Dt = (e) => (t, ...s) => ({ _$litType$: e, strings: t, values: s }), p = Dt(1), ne = Dt(2), C = Symbol.for("lit-noChange"), h = Symbol.for("lit-nothing"), Ct = /* @__PURE__ */ new WeakMap(), x = S.createTreeWalker(S, 129);
function Lt(e, t) {
  if (!_t(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return vt !== void 0 ? vt.createHTML(t) : t;
}
const ie = (e, t) => {
  const s = e.length - 1, i = [];
  let n, r = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = P;
  for (let a = 0; a < s; a++) {
    const l = e[a];
    let c, f, d = -1, _ = 0;
    for (; _ < l.length && (o.lastIndex = _, f = o.exec(l), f !== null); ) _ = o.lastIndex, o === P ? f[1] === "!--" ? o = At : f[1] !== void 0 ? o = xt : f[2] !== void 0 ? (It.test(f[2]) && (n = RegExp("</" + f[2], "g")), o = v) : f[3] !== void 0 && (o = v) : o === v ? f[0] === ">" ? (o = n ?? P, d = -1) : f[1] === void 0 ? d = -2 : (d = o.lastIndex - f[2].length, c = f[1], o = f[3] === void 0 ? v : f[3] === '"' ? St : kt) : o === St || o === kt ? o = v : o === At || o === xt ? o = P : (o = v, n = void 0);
    const u = o === v && e[a + 1].startsWith("/>") ? " " : "";
    r += o === P ? l + ee : d >= 0 ? (i.push(c), l.slice(0, d) + jt + l.slice(d) + b + u) : l + b + (d === -2 ? a : u);
  }
  return [Lt(e, r + (e[s] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), i];
};
class V {
  constructor({ strings: t, _$litType$: s }, i) {
    let n;
    this.parts = [];
    let r = 0, o = 0;
    const a = t.length - 1, l = this.parts, [c, f] = ie(t, s);
    if (this.el = V.createElement(c, i), x.currentNode = this.el.content, s === 2 || s === 3) {
      const d = this.el.content.firstChild;
      d.replaceWith(...d.childNodes);
    }
    for (; (n = x.nextNode()) !== null && l.length < a; ) {
      if (n.nodeType === 1) {
        if (n.hasAttributes()) for (const d of n.getAttributeNames()) if (d.endsWith(jt)) {
          const _ = f[o++], u = n.getAttribute(d).split(b), y = /([.?@])?(.*)/.exec(_);
          l.push({ type: 1, index: r, name: y[2], strings: u, ctor: y[1] === "." ? oe : y[1] === "?" ? ae : y[1] === "@" ? ce : rt }), n.removeAttribute(d);
        } else d.startsWith(b) && (l.push({ type: 6, index: r }), n.removeAttribute(d));
        if (It.test(n.tagName)) {
          const d = n.textContent.split(b), _ = d.length - 1;
          if (_ > 0) {
            n.textContent = nt ? nt.emptyScript : "";
            for (let u = 0; u < _; u++) n.append(d[u], B()), x.nextNode(), l.push({ type: 2, index: ++r });
            n.append(d[_], B());
          }
        }
      } else if (n.nodeType === 8) if (n.data === zt) l.push({ type: 2, index: r });
      else {
        let d = -1;
        for (; (d = n.data.indexOf(b, d + 1)) !== -1; ) l.push({ type: 7, index: r }), d += b.length - 1;
      }
      r++;
    }
  }
  static createElement(t, s) {
    const i = S.createElement("template");
    return i.innerHTML = t, i;
  }
}
function O(e, t, s = e, i) {
  if (t === C) return t;
  let n = i !== void 0 ? s._$Co?.[i] : s._$Cl;
  const r = W(t) ? void 0 : t._$litDirective$;
  return n?.constructor !== r && (n?._$AO?.(!1), r === void 0 ? n = void 0 : (n = new r(e), n._$AT(e, s, i)), i !== void 0 ? (s._$Co ??= [])[i] = n : s._$Cl = n), n !== void 0 && (t = O(e, n._$AS(e, t.values), n, i)), t;
}
class re {
  constructor(t, s) {
    this._$AV = [], this._$AN = void 0, this._$AD = t, this._$AM = s;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t) {
    const { el: { content: s }, parts: i } = this._$AD, n = (t?.creationScope ?? S).importNode(s, !0);
    x.currentNode = n;
    let r = x.nextNode(), o = 0, a = 0, l = i[0];
    for (; l !== void 0; ) {
      if (o === l.index) {
        let c;
        l.type === 2 ? c = new T(r, r.nextSibling, this, t) : l.type === 1 ? c = new l.ctor(r, l.name, l.strings, this, t) : l.type === 6 && (c = new le(r, this, t)), this._$AV.push(c), l = i[++a];
      }
      o !== l?.index && (r = x.nextNode(), o++);
    }
    return x.currentNode = S, n;
  }
  p(t) {
    let s = 0;
    for (const i of this._$AV) i !== void 0 && (i.strings !== void 0 ? (i._$AI(t, i, s), s += i.strings.length - 2) : i._$AI(t[s])), s++;
  }
}
class T {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t, s, i, n) {
    this.type = 2, this._$AH = h, this._$AN = void 0, this._$AA = t, this._$AB = s, this._$AM = i, this.options = n, this._$Cv = n?.isConnected ?? !0;
  }
  get parentNode() {
    let t = this._$AA.parentNode;
    const s = this._$AM;
    return s !== void 0 && t?.nodeType === 11 && (t = s.parentNode), t;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t, s = this) {
    t = O(this, t, s), W(t) ? t === h || t == null || t === "" ? (this._$AH !== h && this._$AR(), this._$AH = h) : t !== this._$AH && t !== C && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : se(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== h && W(this._$AH) ? this._$AA.nextSibling.data = t : this.T(S.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    const { values: s, _$litType$: i } = t, n = typeof i == "number" ? this._$AC(t) : (i.el === void 0 && (i.el = V.createElement(Lt(i.h, i.h[0]), this.options)), i);
    if (this._$AH?._$AD === n) this._$AH.p(s);
    else {
      const r = new re(n, this), o = r.u(this.options);
      r.p(s), this.T(o), this._$AH = r;
    }
  }
  _$AC(t) {
    let s = Ct.get(t.strings);
    return s === void 0 && Ct.set(t.strings, s = new V(t)), s;
  }
  k(t) {
    _t(this._$AH) || (this._$AH = [], this._$AR());
    const s = this._$AH;
    let i, n = 0;
    for (const r of t) n === s.length ? s.push(i = new T(this.O(B()), this.O(B()), this, this.options)) : i = s[n], i._$AI(r), n++;
    n < s.length && (this._$AR(i && i._$AB.nextSibling, n), s.length = n);
  }
  _$AR(t = this._$AA.nextSibling, s) {
    for (this._$AP?.(!1, !0, s); t !== this._$AB; ) {
      const i = wt(t).nextSibling;
      wt(t).remove(), t = i;
    }
  }
  setConnected(t) {
    this._$AM === void 0 && (this._$Cv = t, this._$AP?.(t));
  }
}
class rt {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, s, i, n, r) {
    this.type = 1, this._$AH = h, this._$AN = void 0, this.element = t, this.name = s, this._$AM = n, this.options = r, i.length > 2 || i[0] !== "" || i[1] !== "" ? (this._$AH = Array(i.length - 1).fill(new String()), this.strings = i) : this._$AH = h;
  }
  _$AI(t, s = this, i, n) {
    const r = this.strings;
    let o = !1;
    if (r === void 0) t = O(this, t, s, 0), o = !W(t) || t !== this._$AH && t !== C, o && (this._$AH = t);
    else {
      const a = t;
      let l, c;
      for (t = r[0], l = 0; l < r.length - 1; l++) c = O(this, a[i + l], s, l), c === C && (c = this._$AH[l]), o ||= !W(c) || c !== this._$AH[l], c === h ? t = h : t !== h && (t += (c ?? "") + r[l + 1]), this._$AH[l] = c;
    }
    o && !n && this.j(t);
  }
  j(t) {
    t === h ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class oe extends rt {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === h ? void 0 : t;
  }
}
class ae extends rt {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== h);
  }
}
class ce extends rt {
  constructor(t, s, i, n, r) {
    super(t, s, i, n, r), this.type = 5;
  }
  _$AI(t, s = this) {
    if ((t = O(this, t, s, 0) ?? h) === C) return;
    const i = this._$AH, n = t === h && i !== h || t.capture !== i.capture || t.once !== i.once || t.passive !== i.passive, r = t !== h && (i === h || n);
    n && this.element.removeEventListener(this.name, this, i), r && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class le {
  constructor(t, s, i) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = s, this.options = i;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    O(this, t);
  }
}
const de = { I: T }, he = ft.litHtmlPolyfillSupport;
he?.(V, T), (ft.litHtmlVersions ??= []).push("3.3.3");
const pe = (e, t, s) => {
  const i = s?.renderBefore ?? t;
  let n = i._$litPart$;
  if (n === void 0) {
    const r = s?.renderBefore ?? null;
    i._$litPart$ = n = new T(t.insertBefore(B(), r), r, void 0, s ?? {});
  }
  return n._$AI(e), n;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const yt = globalThis;
let H = class extends E {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t.firstChild, t;
  }
  update(t) {
    const s = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = pe(s, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return C;
  }
};
H._$litElement$ = !0, H.finalized = !0, yt.litElementHydrateSupport?.({ LitElement: H });
const ue = yt.litElementPolyfillSupport;
ue?.({ LitElement: H });
(yt.litElementVersions ??= []).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const fe = { CHILD: 2 }, _e = (e) => (...t) => ({ _$litDirective$: e, values: t });
let ye = class {
  constructor(t) {
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AT(t, s, i) {
    this._$Ct = t, this._$AM = s, this._$Ci = i;
  }
  _$AS(t, s) {
    return this.update(t, s);
  }
  update(t, s) {
    return this.render(...s);
  }
};
/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { I: me } = de, Et = (e) => e, Ht = () => document.createComment(""), N = (e, t, s) => {
  const i = e._$AA.parentNode, n = t === void 0 ? e._$AB : t._$AA;
  if (s === void 0) {
    const r = i.insertBefore(Ht(), n), o = i.insertBefore(Ht(), n);
    s = new me(r, o, e, e.options);
  } else {
    const r = s._$AB.nextSibling, o = s._$AM, a = o !== e;
    if (a) {
      let l;
      s._$AQ?.(e), s._$AM = e, s._$AP !== void 0 && (l = e._$AU) !== o._$AU && s._$AP(l);
    }
    if (r !== n || a) {
      let l = s._$AA;
      for (; l !== r; ) {
        const c = Et(l).nextSibling;
        Et(i).insertBefore(l, n), l = c;
      }
    }
  }
  return s;
}, A = (e, t, s = e) => (e._$AI(t, s), e), ge = {}, $e = (e, t = ge) => e._$AH = t, be = (e) => e._$AH, at = (e) => {
  e._$AR(), e._$AA.remove();
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Ot = (e, t, s) => {
  const i = /* @__PURE__ */ new Map();
  for (let n = t; n <= s; n++) i.set(e[n], n);
  return i;
}, g = _e(class extends ye {
  constructor(e) {
    if (super(e), e.type !== fe.CHILD) throw Error("repeat() can only be used in text expressions");
  }
  dt(e, t, s) {
    let i;
    s === void 0 ? s = t : t !== void 0 && (i = t);
    const n = [], r = [];
    let o = 0;
    for (const a of e) n[o] = i ? i(a, o) : o, r[o] = s(a, o), o++;
    return { values: r, keys: n };
  }
  render(e, t, s) {
    return this.dt(e, t, s).values;
  }
  update(e, [t, s, i]) {
    const n = be(e), { values: r, keys: o } = this.dt(t, s, i);
    if (!Array.isArray(n)) return this.ut = o, r;
    const a = this.ut ??= [], l = [];
    let c, f, d = 0, _ = n.length - 1, u = 0, y = r.length - 1;
    for (; d <= _ && u <= y; ) if (n[d] === null) d++;
    else if (n[_] === null) _--;
    else if (a[d] === o[u]) l[u] = A(n[d], r[u]), d++, u++;
    else if (a[_] === o[y]) l[y] = A(n[_], r[y]), _--, y--;
    else if (a[d] === o[y]) l[y] = A(n[d], r[y]), N(e, l[y + 1], n[d]), d++, y--;
    else if (a[_] === o[u]) l[u] = A(n[_], r[u]), N(e, n[d], n[_]), _--, u++;
    else if (c === void 0 && (c = Ot(o, u, y), f = Ot(a, d, _)), c.has(a[d])) if (c.has(a[_])) {
      const m = f.get(o[u]), $ = m !== void 0 ? n[m] : null;
      if ($ === null) {
        const U = N(e, n[d]);
        A(U, r[u]), l[u] = U;
      } else l[u] = A($, r[u]), N(e, n[d], $), n[m] = null;
      u++;
    } else at(n[_]), _--;
    else at(n[d]), d++;
    for (; u <= y; ) {
      const m = N(e, l[y + 1]);
      A(m, r[u]), l[u++] = m;
    }
    for (; d <= _; ) {
      const m = n[d++];
      m !== null && at(m);
    }
    return this.ut = o, $e(e, l), C;
  }
}), F = ["idle", "working", "waiting", "done", "unknown"], Tt = ["cli_unavailable", "cli_timeout", "cli_failed", "invalid_payload", "payload_too_large"];
function I(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function k(e, t = 128, s = !1) {
  return typeof e == "string" && (s || e.length > 0) && Array.from(e).length <= t && !/[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(e);
}
function D(e) {
  return typeof e == "number" && Number.isSafeInteger(e) && e >= 0;
}
function G(e) {
  return e === null || k(e);
}
function M(e, t = 128) {
  return e === null || k(e, t, !0);
}
function Q(e) {
  return e === null || D(e);
}
function we(e) {
  return e === null || typeof e == "boolean";
}
function ve(e) {
  if (!I(e) || e.kind !== "snapshot" || !k(e.sample_id) || typeof e.consistent != "boolean" || typeof e.names_included != "boolean" || typeof e.derived_labels_included != "boolean" || !Array.isArray(e.workspaces) || e.workspaces.length > 64 || !Array.isArray(e.tabs) || e.tabs.length > 256 || !Array.isArray(e.panes) || e.panes.length > 512) return null;
  const t = e.names_included, s = t && e.derived_labels_included, i = [], n = [], r = [], o = /* @__PURE__ */ new Set(), a = /* @__PURE__ */ new Set(), l = /* @__PURE__ */ new Set();
  for (const c of e.workspaces) {
    if (!I(c) || !k(c.workspace_id) || o.has(c.workspace_id) || !M(c.name) || !D(c.tab_count) || !D(c.pane_count)) return null;
    o.add(c.workspace_id), i.push({ workspace_id: c.workspace_id, name: t && c.name || null, tab_count: c.tab_count, pane_count: c.pane_count });
  }
  for (const c of e.tabs) {
    if (!I(c) || !k(c.workspace_id) || !k(c.tab_id) || a.has(c.tab_id) || !Q(c.ordinal) || !M(c.name) || !M(c.label) || !M(c.detected_agent, 64) || !G(c.group_id) || !M(c.group_name) || typeof c.hibernated != "boolean" || !Array.isArray(c.pane_ids) || c.pane_ids.length > 512 || c.pane_ids.some((f) => !D(f) || f === 0) || new Set(c.pane_ids).size !== c.pane_ids.length) return null;
    a.add(c.tab_id), n.push({
      workspace_id: c.workspace_id,
      tab_id: c.tab_id,
      ordinal: c.ordinal,
      name: t && c.name || null,
      label: s && c.label || null,
      detected_agent: c.detected_agent || null,
      pane_ids: [...c.pane_ids],
      group_id: c.group_id,
      group_name: t && c.group_name || null,
      hibernated: c.hibernated
    });
  }
  for (const c of e.panes) {
    if (!I(c) || !D(c.pane_id) || c.pane_id === 0 || l.has(c.pane_id) || !G(c.workspace_id) || !G(c.tab_id) || !we(c.live) || typeof c.hibernated != "boolean" || typeof c.orphan != "boolean") return null;
    l.add(c.pane_id), r.push({ pane_id: c.pane_id, workspace_id: c.workspace_id, tab_id: c.tab_id, live: c.live, hibernated: c.hibernated, orphan: c.orphan });
  }
  return {
    kind: "snapshot",
    sample_id: e.sample_id,
    workspaces: i,
    tabs: n,
    panes: r,
    consistent: e.consistent,
    names_included: t,
    derived_labels_included: s
  };
}
function Ae(e) {
  return !I(e) || !["available", "unavailable"].includes(e.state) || !k(e.collector_version) || !G(e.tty7_build) || !Q(e.control_version) || !Q(e.protocol_version) || !Q(e.uptime_secs) ? null : {
    state: e.state,
    collector_version: e.collector_version,
    tty7_build: e.tty7_build,
    control_version: e.control_version,
    protocol_version: e.protocol_version,
    uptime_secs: e.uptime_secs
  };
}
function qt(e) {
  return e.inferred === !0 ? "inferred" : e.rich === !0 ? "structured_hook" : e.rich === !1 ? "weak_report" : "unknown";
}
function ct(e, t) {
  return e.filter((s) => (t.include_inferred !== !1 || s.inferred !== !0) && (!t.statuses || t.statuses.includes(s.status)) && (!t.agent_types?.length || t.agent_types.includes(s.agent)));
}
function X(e, t) {
  if (!e) return null;
  const s = e.panes.find((n) => n.pane_id === t);
  if (!s || s.orphan || !s.tab_id || !s.workspace_id) return null;
  let i = null;
  for (const n of e.tabs)
    if (n.pane_ids.includes(t)) {
      if (i) return null;
      i = n;
    }
  return i?.tab_id === s.tab_id && i.workspace_id === s.workspace_id ? i : null;
}
const Ut = { waiting: 0, working: 1, done: 2, unknown: 3, idle: 4 };
function Bt(e) {
  return e.reduce((t, s) => !t || Ut[s.status] < Ut[t.status] ? s : t, null);
}
function tt(e) {
  const t = /* @__PURE__ */ new Map();
  for (const s of e.agents) {
    const i = X(e.inventory, s.pane_id);
    if (!i) continue;
    const n = t.get(i) ?? [];
    n.push(s), t.set(i, n);
  }
  return (e.inventory?.tabs ?? []).map((s) => {
    const i = t.get(s) ?? [], n = Bt(i);
    return { identity: JSON.stringify([e.config.roster_entity, s.workspace_id, s.tab_id]), tab: s, agents: i, representative: n };
  });
}
function xe(e) {
  const t = tt(e);
  return (e.inventory?.workspaces ?? []).map((s) => ({
    identity: JSON.stringify([e.config.roster_entity, s.workspace_id]),
    workspace: s,
    tabs: t.filter((i) => i.tab.workspace_id === s.workspace_id)
  }));
}
function Z(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function q(e, t) {
  if (typeof e != "string" || e.length === 0) return !1;
  let s = 0;
  for (let i = 0; i < e.length; i++) {
    const n = e.charCodeAt(i);
    if (n >= 55296 && n <= 56319) {
      const r = e.charCodeAt(++i);
      if (!(r >= 56320 && r <= 57343)) return !1;
    } else if (n >= 56320 && n <= 57343) return !1;
    if (++s > t) return !1;
  }
  return !0;
}
function ht(e) {
  return typeof e == "number" && Number.isSafeInteger(e) && e >= 0;
}
function et(e) {
  const t = () => {
    throw new Error("Configure unique host names, sensor rosters, and binary_sensor connectivity entities.");
  };
  if (!Z(e) || e.type !== "custom:ha-tty7-card" || !Array.isArray(e.hosts) || e.hosts.length > 64 || Object.keys(e).some((r) => !["type", "hosts", "title", "appearance", "group_by", "show_summary", "show_model", "show_effort", "show_session_id", "statuses", "agent_types", "include_inferred"].includes(r)) || Object.hasOwn(e, "title") && (!q(e.title, 128) || !e.title.trim()) || Object.hasOwn(e, "appearance") && !["tty7", "home-assistant"].includes(e.appearance) || Object.hasOwn(e, "group_by") && !["host", "workspace", "tab"].includes(e.group_by)) return t();
  for (const r of ["show_summary", "show_model", "show_effort", "show_session_id", "include_inferred"])
    if (Object.hasOwn(e, r) && typeof e[r] != "boolean") return t();
  if (Object.hasOwn(e, "statuses") && (!Array.isArray(e.statuses) || e.statuses.length > 5 || e.statuses.some((r) => !F.includes(r)) || new Set(e.statuses).size !== e.statuses.length) || Object.hasOwn(e, "agent_types") && (!Array.isArray(e.agent_types) || e.agent_types.length > 256 || e.agent_types.some((r) => !q(r, 64)) || new Set(e.agent_types).size !== e.agent_types.length)) return t();
  const s = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), n = [];
  for (const r of e.hosts) {
    if (!Z(r) || Object.keys(r).some((o) => !["name", "roster_entity", "connectivity_entity"].includes(o)) || !q(r.name, 128) || !r.name.trim() || typeof r.roster_entity != "string" || typeof r.connectivity_entity != "string" || !/^sensor\.[a-z0-9_]+$/.test(r.roster_entity) || !/^binary_sensor\.[a-z0-9_]+$/.test(r.connectivity_entity) || s.has(r.name.trim()) || i.has(r.roster_entity) || i.has(r.connectivity_entity)) return t();
    s.add(r.name.trim()), i.add(r.roster_entity), i.add(r.connectivity_entity), n.push({ name: r.name.trim(), roster_entity: r.roster_entity, connectivity_entity: r.connectivity_entity });
  }
  return {
    type: "custom:ha-tty7-card",
    hosts: n,
    ...Object.hasOwn(e, "title") ? { title: e.title.trim() } : {},
    ...Object.hasOwn(e, "appearance") ? { appearance: e.appearance } : {},
    ...Object.hasOwn(e, "group_by") ? { group_by: e.group_by } : {},
    ...Object.hasOwn(e, "show_summary") ? { show_summary: e.show_summary } : {},
    ...Object.hasOwn(e, "show_model") ? { show_model: e.show_model } : {},
    ...Object.hasOwn(e, "show_effort") ? { show_effort: e.show_effort } : {},
    ...Object.hasOwn(e, "show_session_id") ? { show_session_id: e.show_session_id } : {},
    ...Object.hasOwn(e, "include_inferred") ? { include_inferred: e.include_inferred } : {},
    ...Object.hasOwn(e, "statuses") ? { statuses: [...e.statuses] } : {},
    ...Object.hasOwn(e, "agent_types") ? { agent_types: [...e.agent_types] } : {}
  };
}
function ke(e) {
  if (!Z(e) || !ht(e.pane_id) || e.pane_id === 0 || !q(e.agent, 64) || Object.hasOwn(e, "inferred") && typeof e.inferred != "boolean" || Object.hasOwn(e, "rich") && typeof e.rich != "boolean") return null;
  for (const t of ["session_id", "model", "effort", "permission_mode"])
    if (!(t === "effort" && e[t] === "") && e[t] !== void 0 && e[t] !== null && !q(e[t], 128))
      return null;
  for (const t of ["activity", "turns"])
    if (e[t] !== void 0 && e[t] !== null && !ht(e[t])) return null;
  return {
    pane_id: e.pane_id,
    agent: e.agent,
    session_id: e.session_id ?? null,
    status: F.includes(e.status) ? e.status : "unknown",
    ...e.inferred === !0 ? { inferred: !0 } : {},
    ...typeof e.rich == "boolean" ? { rich: e.rich } : {},
    activity: e.activity ?? null,
    turns: e.turns ?? null,
    model: e.model ?? null,
    effort: e.effort ?? null,
    permission_mode: e.permission_mode ?? null
  };
}
function K(e) {
  return e === null ? null : typeof e != "string" || e.length > 64 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(e) ? NaN : Date.parse(e);
}
function Se(e, t, s) {
  const i = { idle: 0, working: 0, waiting: 0, done: 0, unknown: 0 }, n = {
    config: e,
    state: s ? "loading" : "disconnected",
    agents: [],
    counts: i,
    lastContact: null,
    lastSuccess: null,
    errorCode: null,
    lastKnown: !0,
    confirmedCounts: { idle: 0, working: 0, waiting: 0, done: 0, unknown: 0 },
    inferredCount: 0,
    weakCount: 0,
    unknownOriginCount: 0,
    inventory: null,
    inventoryState: "disabled",
    inventoryLastContact: null,
    inventoryLastSuccess: null,
    inventoryErrorCode: null,
    source: null
  }, r = t[e.roster_entity], o = t[e.connectivity_entity];
  if (!r || !o || (n.state = s ? "malformed" : "disconnected", !Z(r.attributes))) return n;
  const a = r.attributes;
  if (a.schema_version !== 1 || !Array.isArray(a.agents) || a.agents.length > 256 || typeof a.collector_ok != "boolean" || typeof a.baseline_ready != "boolean" || !Z(a.counts) || !Object.hasOwn(a, "error_code") || !Object.hasOwn(a, "last_contact") || !Object.hasOwn(a, "last_success")) return n;
  const l = K(a.last_contact), c = K(a.last_success);
  if (l !== null && !Number.isFinite(l) || c !== null && !Number.isFinite(c) || l !== null && c !== null && c > l || a.baseline_ready && (l === null || c === null) || a.error_code !== null && !Tt.includes(a.error_code) || a.collector_ok && a.error_code !== null || !a.collector_ok && a.baseline_ready) return n;
  const f = [], d = /* @__PURE__ */ new Set();
  for (const u of a.agents) {
    const y = ke(u);
    if (!y || d.has(y.pane_id)) return n;
    d.add(y.pane_id), f.push(y), i[y.status] += 1;
  }
  const _ = a.counts;
  if (F.some((u) => !ht(_[u]) || _[u] !== i[u])) return n;
  n.agents = f.map((u) => ({ ...u, identity: JSON.stringify([e.roster_entity, u.session_id, u.pane_id]) }));
  for (const u of f) {
    const y = qt(u);
    y === "structured_hook" ? n.confirmedCounts[u.status]++ : y === "inferred" ? n.inferredCount++ : y === "weak_report" ? n.weakCount++ : n.unknownOriginCount++;
  }
  return n.inventoryState = ["disabled", "unconfirmed", "healthy", "error", "stale"].includes(a.inventory_state) ? a.inventory_state : a.inventory === void 0 ? "disabled" : "unconfirmed", n.inventoryState !== "disabled" && (n.inventory = ve(a.inventory)), !n.inventory && n.inventoryState === "healthy" && (n.inventoryState = "unconfirmed"), n.source = Ae(a.source), n.inventoryLastContact = typeof a.inventory_last_contact == "string" && Number.isFinite(K(a.inventory_last_contact)) ? a.inventory_last_contact : null, n.inventoryLastSuccess = typeof a.inventory_last_success == "string" && Number.isFinite(K(a.inventory_last_success)) ? a.inventory_last_success : null, n.inventoryErrorCode = Tt.includes(a.inventory_error_code) ? a.inventory_error_code : null, n.lastContact = a.last_contact, n.lastSuccess = a.last_success, n.errorCode = a.error_code, s ? ["unavailable", "unknown"].includes(r.state) || ["unavailable", "unknown"].includes(o.state) ? n.state = "offline" : r.state === "error" ? n.state = n.errorCode === null ? "malformed" : "error" : r.state === "stale" ? n.state = "stale" : r.state === "unconfirmed" ? n.state = "unconfirmed" : n.errorCode !== null || r.state !== String(f.length) ? n.state = "malformed" : !a.collector_ok || !a.baseline_ready || l === null || c === null || o.state === "off" ? n.state = "offline" : o.state !== "on" ? n.state = "malformed" : n.state = f.length === 0 ? "empty" : "healthy" : n.state = "disconnected", n.lastKnown = !["healthy", "empty"].includes(n.state), n;
}
const Ce = Mt`
  :host {
    display: block; min-width: 0;
    font-family: var(--ha-font-family-body, system-ui, sans-serif); font-size: 14px;
  }
  :host(:not([appearance='home-assistant'])) {
    color-scheme: light;
    --tty-bg: #fcfcfb; --tty-ink: #1c1c1e; --tty-rail: #f5f5f3;
    --tty-muted: #626267; --tty-line: #c5c5c4; --tty-hover: #ededec;
    --tty-blue: #1f6bf0; --tty-green: #2f8a52; --tty-amber: #b7791f; --tty-red: #c43c43;
  }
  :host([dark]:not([appearance='home-assistant'])) {
    color-scheme: dark; --tty-bg: #18181a; --tty-ink: #ececed; --tty-rail: #1e1e20;
    --tty-muted: #aaaab0; --tty-line: #505055; --tty-hover: #2b2b2e;
    --tty-blue: #78a8f5; --tty-green: #4cc27a; --tty-amber: #e0a345; --tty-red: #f07878;
  }
  :host([appearance='home-assistant']) {
    color-scheme: inherit;
    --tty-ink: var(--primary-text-color); --tty-muted: var(--secondary-text-color);
    --tty-rail: transparent; --tty-line: var(--divider-color);
    --tty-hover: var(--secondary-background-color);
    --tty-blue: var(--primary-color); --tty-green: var(--success-color);
    --tty-amber: var(--warning-color); --tty-red: var(--error-color);
  }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  ha-card { display: block; overflow: hidden; }
  :host(:not([appearance='home-assistant'])) ha-card {
    background: var(--tty-bg); color: var(--tty-ink);
    border: 1px solid var(--tty-line); border-radius: var(--ha-card-border-radius, 12px);
  }
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 12px 14px; border-bottom: 1px solid var(--tty-line); }
  h1 { margin: 0; min-width: 0; overflow-wrap: anywhere; font-size: 16px; font-weight: 600; letter-spacing: -.02em; }
  .brand { font-family: ui-monospace, 'Cascadia Code', 'DejaVu Sans Mono', monospace; font-weight: 700; }
  label { display: grid; gap: 3px; min-width: 0; max-width: 52%; color: var(--tty-muted); font-size: 12px; }
  select { max-width: 100%; min-width: 0; min-height: 44px; padding: 7px; font: inherit;
    color: var(--tty-ink); background: var(--tty-rail); border: 1px solid var(--tty-line); border-radius: 5px; }
  section { min-width: 0; }
  section + section { border-top: 1px solid var(--tty-line); }
  .host-head { padding: 12px 14px 8px; background: var(--tty-rail); }
  .host-title { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 12px; }
  h2 { font-size: 13px; font-weight: 600; margin: 0; overflow-wrap: anywhere; }
  .host-state { font-size: 12px; font-weight: 600; }
  .host-state[data-state='error'], .host-state[data-state='malformed'] { color: var(--tty-red); }
  .receipt { color: var(--tty-muted); margin: 5px 0 0; font-size: 12px; overflow-wrap: anywhere; }
  .notice { margin: 0; padding: 9px 14px; font-size: 12px; color: var(--tty-muted); background: var(--tty-rail); overflow-wrap: anywhere; }
  ul { padding: 4px 6px 8px; margin: 0; list-style: none; }
  li { min-width: 0; border-radius: 5px; }
  .agent-row { display: grid; width: 100%; grid-template-columns: 26px minmax(0, 1fr) auto 12px;
    align-items: center; gap: 9px; min-height: 58px; padding: 8px;
    border: 0; border-radius: 5px; text-align: left; color: var(--tty-ink); background: transparent; cursor: pointer; font: inherit; }
  .agent-row:hover, .agent-row[aria-expanded='true'] { background: var(--tty-hover); }
  button:focus-visible, select:focus-visible { outline: 2px solid var(--tty-blue); outline-offset: -2px; }
  .agent-icon { width: 24px; height: 24px; border: 1px solid var(--tty-line); border-radius: 6px;
    display: grid; place-items: center; background: var(--tty-rail); color: var(--tty-muted); }
  svg { width: 16px; height: 16px; }
  .agent-copy { min-width: 0; display: grid; gap: 3px; }
  .agent-name { font-size: 14px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .identity { font-size: 12px; color: var(--tty-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-variant-numeric: tabular-nums; }
  .status { display: inline-flex; gap: 5px; align-items: center; font-size: 12px; white-space: nowrap; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--tty-muted); flex-shrink: 0; }
  .status[data-status='working'] .dot { background: var(--tty-blue); }
  .status[data-status='waiting'] .dot { background: var(--tty-amber); }
  .status[data-status='done'] .dot { background: var(--tty-green); }
  .status[data-status='idle'] .dot { background: transparent; border: 1px solid var(--tty-muted); }
  .chevron { color: var(--tty-muted); font-size: 16px; }
  .last-known .agent-row { border-left: 2px solid var(--tty-line); }
  dl { display: grid; grid-template-columns: minmax(80px, 1fr) minmax(0, 2fr); gap: 8px 12px;
    margin: 0 8px 8px; padding: 12px; border-left: 2px solid var(--tty-blue); background: var(--tty-rail); font-size: 12px; }
  dt { color: var(--tty-muted); }
  dd { margin: 0; min-width: 0; overflow-wrap: anywhere; white-space: pre-wrap;
    font-family: ui-monospace, 'Cascadia Code', 'DejaVu Sans Mono', monospace; }
  .configuration { margin: 0; padding: 16px; line-height: 1.5; }
  .metadata { color: var(--tty-muted); font-size: 12px; overflow-wrap: anywhere; min-width: 0; }
  .summary, .filtered-count { color: var(--tty-muted); font-size: 12px; margin: 6px 0 0; font-variant-numeric: tabular-nums; }
  .group-head { display: flex; flex-wrap: wrap; gap: 4px 10px; padding: 9px 8px 5px; font-size: 12px; color: var(--tty-muted); overflow-wrap: anywhere; }
  .group-head h3 { flex-basis: 100%; min-width: 0; margin: 0; font-size: 13px; font-weight: 600; color: var(--tty-ink); }
  .workspace-title { margin: 10px 14px 0; font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
  .tab-group + .tab-group { border-top: 1px solid var(--tty-line); }
  .source { padding: 8px 14px 12px; color: var(--tty-muted); font-size: 12px; }
  .source summary { min-height: 44px; display: list-item; align-content: center; cursor: pointer; }
  .source summary:focus-visible { outline: 2px solid var(--tty-blue); }
  .source dl { margin: 0; }
  .inventory-panes { padding-top: 0; }
  @media (max-width: 380px) {
    header { padding: 10px; gap: 8px; }
    .host-head { padding: 10px; }
    .agent-row { gap: 6px; grid-template-columns: 24px minmax(0, 1fr) auto 10px; }
    dl { padding: 10px; gap: 8px; }
  }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
`, R = new Intl.DateTimeFormat().resolvedOptions().timeZone, lt = R && (R === "UTC" || R === "Etc/UTC" || R.includes("/")) ? R : void 0;
let j;
function J(e, t) {
  const s = t?.locale?.language, i = t?.locale?.date_format ?? "system", n = t?.locale?.time_format ?? "system", r = t?.config?.time_zone ?? lt ?? "UTC", o = t?.locale?.time_zone === "local" && lt ? lt : r, a = `${s}|${i}|${n}|${o}`;
  if (j?.key !== a) {
    const f = n === "12" || n !== "24" && new Intl.DateTimeFormat(n === "language" ? s : void 0, { hour: "numeric" }).resolvedOptions().hour12 === !0;
    j = {
      key: a,
      date: new Intl.DateTimeFormat(i === "system" ? void 0 : s, {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        timeZone: o
      }),
      time: new Intl.DateTimeFormat(s, {
        hour: "numeric",
        minute: "2-digit",
        hourCycle: f ? "h12" : "h23",
        timeZone: o
      })
    };
  }
  const l = new Date(e);
  let c;
  if (i === "language" || i === "system")
    c = j.date.format(l);
  else {
    const f = j.date.formatToParts(l), d = f.find((w) => w.type === "day").value, _ = f.find((w) => w.type === "month").value, u = f.find((w) => w.type === "year").value, y = f.find((w) => w.type === "literal")?.value ?? "", m = f.at(-1), $ = m?.type === "literal" && !(s === "bg" && i === "YMD") ? m.value : "";
    c = (i === "DMY" ? [d, _, u] : i === "MDY" ? [_, d, u] : [u, _, d]).join(y) + $;
  }
  return `${c}, ${j.time.format(l)}`;
}
const Ee = {
  yes: "Yes",
  no: "No",
  title: "tty7 agents",
  working: "Working",
  waiting: "Waiting",
  done: "Done",
  idle: "Idle",
  unknown: "Unknown",
  loading: "Loading",
  healthy: "Online",
  empty: "Online · empty",
  error: "Collector error",
  stale: "Stale",
  unconfirmed: "Unconfirmed",
  malformed: "Malformed data",
  disconnected: "Home Assistant disconnected",
  offline: "Offline",
  notice_loading: "Waiting for the configured Home Assistant entities.",
  notice_empty: "No reported agents. The latest snapshot is healthy and empty.",
  notice_error: "The collector reported a failure. Last-known roster; not live status.",
  notice_stale: "No accepted contact for more than 45 seconds. Last-known roster; not live status.",
  notice_unconfirmed: "Waiting for a fresh snapshot after startup. Last-known roster; not live status.",
  notice_malformed: "Entity data does not match the status contract. Check the configured roster and package version.",
  notice_disconnected: "The Home Assistant connection is down. Last-known roster; not live status.",
  notice_offline: "Host connectivity is unavailable. Last-known roster; not live status.",
  cli_unavailable: "tty7 unavailable",
  cli_timeout: "tty7 read timed out",
  cli_failed: "tty7 read failed",
  invalid_payload: "Invalid status payload",
  payload_too_large: "Status payload too large",
  inferred: "inferred",
  structured_hook: "Structured hook",
  weak_report: "Weak report",
  unknown_origin: "Unknown origin",
  not_reported: "Not reported",
  none_applicable: "None applicable",
  capability_unknown: "Capability unknown",
  agent: "Agent",
  status: "Status",
  pane: "Pane",
  pane_accessible: "pane",
  session: "Session",
  activity: "Activity (as reported)",
  turns: "Turns (as reported)",
  model: "Model",
  effort: "Effort",
  permission: "Permission mode (informational)",
  provenance: "Report origin",
  last_known: "last known",
  show_details: "Show details",
  hide_details: "Hide details",
  no_receipt: "No confirmed receipt",
  last_contact: "Last contact (HA)",
  last_success: "Last successful snapshot (HA)",
  reported: "reported",
  confirmed: "confirmed",
  weak: "weak",
  workspaces: "workspaces",
  tabs: "tabs",
  panes: "panes",
  live: "Live",
  not_live: "Not live",
  hibernated: "Hibernated",
  orphan: "Orphan",
  inventory: "Inventory",
  inventory_disabled: "Inventory collection disabled",
  inventory_unconfirmed: "Inventory unconfirmed",
  inventory_healthy: "Inventory current",
  inventory_error: "Inventory read failed; last-known inventory",
  inventory_stale: "Inventory stale; last-known inventory",
  inventory_pending: "Membership pending reconciliation",
  inventory_contact: "Inventory last contact (HA)",
  inventory_success: "Inventory last success (HA)",
  workspace: "Workspace",
  tab: "Tab",
  detected_only: "Detected only · unreported",
  derived: "Derived label",
  ungrouped: "Ungrouped",
  filtered: "shown / reported",
  source: "Source diagnostics",
  collector_version: "Collector version",
  tty7_build: "tty7 build",
  control_version: "Control version",
  protocol_version: "Protocol version",
  uptime: "Uptime (last sampled seconds)",
  source_unavailable: "Source diagnostics unavailable",
  source_available: "Source diagnostics available",
  configuration_error: "Configuration error",
  not_configured: "Not configured",
  configuration_help: "Configure unique host names, sensor rosters, and binary_sensor connectivity entities.",
  no_hosts: "No hosts selected",
  setup_help: "Add HA-tty7 in Settings · Devices & services, then choose hosts in this card’s visual editor.",
  show_host: "Show host",
  all_hosts: "All hosts",
  editor_intro: "Choose HA-tty7 hosts and dashboard labels. Only status is shown; pairing credentials stay in integration settings.",
  card_title: "Card title (default: tty7 agents)",
  appearance: "Appearance",
  missing_hosts: "No configured HA-tty7 host pairs are available. Add a host in",
  settings_link: "Settings · Devices & services",
  saved_pairs: "then return to this editor. Saved entity pairs remain unchanged.",
  host: "Host",
  host_picker: "HA-tty7 host",
  dashboard_label: "Dashboard label",
  roster: "Roster",
  connectivity: "Connectivity",
  remove_host: "Remove host",
  add_host: "Add host",
  editor_feedback: "Use a title of at most 128 characters and choose a host pair with a unique, non-empty label for each row.",
  group_by: "Group by",
  group_host: "Host",
  group_workspace: "Workspace",
  group_tab: "Tab",
  show_summary: "Show host summary",
  show_model: "Show model",
  show_effort: "Show effort",
  show_session_id: "Show session ID in rows",
  include_inferred: "Include inferred reports",
  statuses: "Statuses",
  agent_types: "Agent types",
  agent_types_help: "One exact reported type per line. Blank means all types."
}, He = {
  title: "Агенты tty7",
  working: "Работает",
  waiting: "Ожидание",
  done: "Завершено",
  idle: "Бездействует",
  unknown: "Неизвестно",
  loading: "Загрузка",
  healthy: "В сети",
  empty: "В сети · пусто",
  error: "Ошибка сборщика",
  stale: "Устарело",
  unconfirmed: "Не подтверждено",
  malformed: "Некорректные данные",
  disconnected: "Нет соединения с Home Assistant",
  offline: "Не в сети",
  notice_loading: "Ожидание настроенных сущностей Home Assistant.",
  notice_empty: "Нет сообщённых агентов. Последний снимок исправен и пуст.",
  yes: "Да",
  no: "Нет",
  notice_error: "Сборщик сообщил об ошибке. Последний известный список; не текущий статус.",
  notice_stale: "Нет принятого сообщения более 45 секунд. Последний известный список; не текущий статус.",
  notice_unconfirmed: "Ожидание свежего снимка после запуска. Последний известный список; не текущий статус.",
  notice_malformed: "Данные сущности не соответствуют контракту. Проверьте выбранный список и версию пакета.",
  notice_disconnected: "Соединение с Home Assistant потеряно. Последний известный список; не текущий статус.",
  notice_offline: "Связь с хостом недоступна. Последний известный список; не текущий статус.",
  cli_unavailable: "tty7 недоступен",
  cli_timeout: "Истекло время чтения tty7",
  cli_failed: "Ошибка чтения tty7",
  invalid_payload: "Некорректные данные статуса",
  payload_too_large: "Данные статуса слишком велики",
  inferred: "предположение",
  structured_hook: "Структурированный хук",
  weak_report: "Слабый отчёт",
  unknown_origin: "Неизвестный источник",
  not_reported: "Не сообщается",
  none_applicable: "Не применяется",
  capability_unknown: "Поддержка неизвестна",
  agent: "Агент",
  status: "Статус",
  pane: "Панель",
  pane_accessible: "панель",
  session: "Сеанс",
  activity: "Активность (как сообщено)",
  turns: "Ходы (как сообщено)",
  model: "Модель",
  effort: "Усилие",
  permission: "Режим разрешений (справочно)",
  provenance: "Источник отчёта",
  last_known: "последнее известное",
  show_details: "Показать подробности",
  hide_details: "Скрыть подробности",
  no_receipt: "Нет подтверждённого получения",
  last_contact: "Последний контакт (HA)",
  last_success: "Последний успешный снимок (HA)",
  reported: "сообщено",
  confirmed: "подтверждено",
  weak: "слабых",
  workspaces: "рабочих пространств",
  tabs: "вкладок",
  panes: "панелей",
  live: "Жива",
  not_live: "Не жива",
  hibernated: "В спячке",
  orphan: "Без владельца",
  inventory: "Инвентаризация",
  inventory_disabled: "Инвентаризация отключена",
  inventory_unconfirmed: "Инвентаризация не подтверждена",
  inventory_healthy: "Инвентаризация актуальна",
  inventory_error: "Ошибка инвентаризации; последние известные данные",
  inventory_stale: "Инвентаризация устарела; последние известные данные",
  inventory_pending: "Связи ожидают согласования",
  inventory_contact: "Последний контакт инвентаризации (HA)",
  inventory_success: "Последний успех инвентаризации (HA)",
  workspace: "Рабочее пространство",
  tab: "Вкладка",
  detected_only: "Только обнаружен · не сообщается",
  derived: "Производная подпись",
  ungrouped: "Без группы",
  filtered: "показано / сообщено",
  source: "Диагностика источника",
  collector_version: "Версия сборщика",
  tty7_build: "Сборка tty7",
  control_version: "Версия управления",
  protocol_version: "Версия протокола",
  uptime: "Время работы (секунды при последнем чтении)",
  source_unavailable: "Диагностика источника недоступна",
  source_available: "Диагностика источника доступна",
  configuration_error: "Ошибка настройки",
  not_configured: "Не настроено",
  configuration_help: "Задайте уникальные имена хостов, списки sensor и связь binary_sensor.",
  no_hosts: "Хосты не выбраны",
  setup_help: "Добавьте HA-tty7 в Настройки · Устройства и службы, затем выберите хосты в редакторе карточки.",
  show_host: "Показать хост",
  all_hosts: "Все хосты",
  editor_intro: "Выберите хосты HA-tty7 и подписи. Только просмотр статуса; учётные данные остаются в настройках интеграции.",
  card_title: "Заголовок карточки (по умолчанию: Агенты tty7)",
  appearance: "Оформление",
  missing_hosts: "Настроенных пар HA-tty7 нет. Добавьте хост в",
  settings_link: "Настройки · Устройства и службы",
  saved_pairs: "и вернитесь в редактор. Сохранённые пары сущностей не меняются.",
  host: "Хост",
  host_picker: "Хост HA-tty7",
  dashboard_label: "Подпись на панели",
  roster: "Список",
  connectivity: "Связь",
  remove_host: "Удалить хост",
  add_host: "Добавить хост",
  editor_feedback: "Укажите заголовок до 128 символов и пару сущностей с уникальной непустой подписью для каждой строки.",
  group_by: "Группировка",
  group_host: "Хост",
  group_workspace: "Рабочее пространство",
  group_tab: "Вкладка",
  show_summary: "Показывать сводку хоста",
  show_model: "Показывать модель",
  show_effort: "Показывать усилие",
  show_session_id: "Показывать ID сеанса в строках",
  include_inferred: "Включать предположения",
  statuses: "Статусы",
  agent_types: "Типы агентов",
  agent_types_help: "Один точный тип на строку. Пусто — все типы."
};
function Wt(e, t) {
  return e?.locale?.language.toLowerCase().split("-")[0] === "ru" ? He[t] : Ee[t];
}
function st(e) {
  if (!e?.entities || !e.devices) return [];
  const t = /* @__PURE__ */ new Map();
  for (const n of Object.values(e.entities)) {
    if (n.platform !== "ha_tty7" || !n.device_id || n.hidden) continue;
    const r = e.devices[n.device_id];
    if (!r || r.disabled_by || !r.config_entries.length || !r.identifiers.some(([a, l]) => a === "ha_tty7" && l.length > 0)) continue;
    const o = t.get(r.id) ?? { rosters: [], connectivity: [] };
    if (n.translation_key === "roster" && /^sensor\.[a-z0-9_]+$/.test(n.entity_id)) o.rosters.push(n.entity_id);
    else if (n.translation_key === "connectivity" && /^binary_sensor\.[a-z0-9_]+$/.test(n.entity_id)) o.connectivity.push(n.entity_id);
    else continue;
    t.set(r.id, o);
  }
  const s = [], i = /* @__PURE__ */ new Set();
  for (const [n, r] of t) {
    if (r.rosters.length !== 1 || r.connectivity.length !== 1 || s.length === 64) continue;
    const o = e.devices[n], a = (o.name_by_user || o.name)?.trim();
    if (!a || Array.from(a).length > 128) continue;
    let l = a, c = 2;
    for (; i.has(l); ) l = `${Array.from(a).slice(0, 120).join("")} (${c++})`;
    i.add(l), s.push({ name: l, roster_entity: r.rosters[0], connectivity_entity: r.connectivity[0] });
  }
  return s;
}
function z(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function Pt(e, t) {
  return typeof e == "string" && Array.from(e).length <= t ? e : "";
}
class Oe extends H {
  constructor() {
    super(...arguments), this.rows = [], this.nextId = 0, this.feedback = "", this.cardTitle = "", this.presentation = {};
  }
  static {
    this.styles = Mt`
    :host { display: block; color: var(--primary-text-color, #1c1c1e); }
    * { box-sizing: border-box; }
    p { line-height: 1.5; color: var(--secondary-text-color, #666); }
    fieldset { min-width: 0; margin: 16px 0; padding: 12px; border: 1px solid var(--divider-color, #ddd); border-radius: 8px; }
    legend { padding: 0 4px; }
    ha-selector { display: block; min-width: 0; margin: 8px 0 12px; }
    .pair { font-size: 12px; overflow-wrap: anywhere; }
    button { min-height: 44px; min-width: 44px; padding: 8px 16px; border: 1px solid var(--divider-color, #bbb);
      border-radius: 6px; color: inherit; background: var(--card-background-color, #fff); font: inherit; cursor: pointer; }
    button:focus-visible, a:focus-visible { outline: 2px solid var(--primary-color, #1f6bf0); outline-offset: 2px; }
    button:disabled { cursor: default; opacity: .5; }
    a { color: var(--primary-color, #1f6bf0); display: inline-block; min-height: 44px; padding: 8px 0; }
    .feedback { color: var(--error-color, #b3261e); }
    .display-options { display: grid; gap: 12px; }
    .display-options label { display: flex; align-items: center; gap: 8px; min-height: 44px; }
    .display-options select, textarea { min-width: 0; max-width: 100%; min-height: 44px; color: inherit; background: var(--card-background-color, #fff); font: inherit; font-size: 16px; padding: 8px; }
    .display-options input { width: 44px; height: 44px; margin: 0; flex-shrink: 0; }
    textarea { width: 100%; }
  `;
  }
  t(t) {
    return Wt(this.currentHass, t);
  }
  set hass(t) {
    this.currentHass = t, this.requestUpdate();
  }
  get hass() {
    return this.currentHass;
  }
  setConfig(t) {
    const s = z(t) && Array.isArray(t.hosts) ? t.hosts.slice(0, 64) : [], i = z(t) ? Pt(t.title, 128) : "";
    this.cardTitle = this.cardTitle.trim() === i ? this.cardTitle : i, this.appearance = z(t) && (t.appearance === "tty7" || t.appearance === "home-assistant") ? t.appearance : void 0;
    const n = { type: "custom:ha-tty7-card", hosts: [] };
    if (z(t)) for (const o of ["group_by", "show_summary", "show_model", "show_effort", "show_session_id", "statuses", "agent_types", "include_inferred"])
      Object.hasOwn(t, o) && (n[o] = t[o]);
    try {
      const { type: o, hosts: a, title: l, appearance: c, ...f } = et(n);
      this.presentation = f;
    } catch {
      this.presentation = {};
    }
    const r = this.rows;
    this.rows = s.filter(z).map((o, a) => {
      const l = r.find((f) => f.host.roster_entity === o.roster_entity && f.host.connectivity_entity === o.connectivity_entity), c = Pt(o.name, 128);
      return { id: l?.id ?? (o.roster_entity ? void 0 : r[a]?.id) ?? this.nextId++, host: {
        // Config echoes must not replace focused controls or eat a space while a label is being typed.
        name: l && l.host.name.trim() === c ? l.host.name : c,
        roster_entity: typeof o.roster_entity == "string" && /^sensor\.[a-z0-9_]+$/.test(o.roster_entity) ? o.roster_entity : "",
        connectivity_entity: typeof o.connectivity_entity == "string" && /^binary_sensor\.[a-z0-9_]+$/.test(o.connectivity_entity) ? o.connectivity_entity : ""
      } };
    }), this.feedback = "", this.requestUpdate();
  }
  publish() {
    let t;
    try {
      t = et({
        type: "custom:ha-tty7-card",
        hosts: this.rows.map((s) => s.host),
        ...this.cardTitle.trim() ? { title: this.cardTitle } : {},
        ...this.appearance ? { appearance: this.appearance } : {},
        ...this.presentation
      });
    } catch {
      this.feedback = this.t("editor_feedback"), this.requestUpdate();
      return;
    }
    this.feedback = "", this.requestUpdate(), this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: t }, bubbles: !0, composed: !0 }));
  }
  selectHost(t, s) {
    t.stopPropagation();
    const i = this.rows.find((a) => a.id === s);
    if (!i) return;
    const n = st(this.currentHass).find((a) => a.roster_entity === t.detail.value);
    if (!n || this.rows.some((a) => a !== i && a.host.roster_entity === n.roster_entity)) return;
    const r = st(this.currentHass).find((a) => a.roster_entity === i.host.roster_entity), o = i.host.name && i.host.name !== r?.name;
    i.host = { ...n, name: o ? i.host.name : n.name }, this.publish();
  }
  labelChanged(t, s) {
    t.stopPropagation();
    const i = this.rows.find((n) => n.id === s);
    i && typeof t.detail.value == "string" && (i.host = { ...i.host, name: t.detail.value }, this.publish());
  }
  titleChanged(t) {
    t.stopPropagation(), typeof t.detail.value == "string" && (this.cardTitle = t.detail.value, this.publish());
  }
  appearanceChanged(t) {
    t.stopPropagation(), !(t.detail.value !== "tty7" && t.detail.value !== "home-assistant") && (this.appearance = t.detail.value, this.publish());
  }
  presentationChanged(t, s) {
    try {
      const { type: i, hosts: n, ...r } = et({
        type: "custom:ha-tty7-card",
        hosts: [],
        ...this.presentation,
        [t]: s
      });
      this.presentation = r, this.publish();
    } catch {
      this.feedback = this.t("editor_feedback"), this.requestUpdate();
    }
  }
  addRow() {
    if (this.rows.length >= 64) return;
    const t = { id: this.nextId++, host: { name: "", roster_entity: "", connectivity_entity: "" } };
    this.rows = [...this.rows, t], this.requestUpdate(), this.updateComplete.then(() => this.shadowRoot?.querySelector(`[data-row="${t.id}"] [data-field="host"]`)?.focus());
  }
  removeRow(t) {
    this.rows.some((s) => s.id === t) && (this.rows = this.rows.filter((s) => s.id !== t), this.publish(), this.updateComplete.then(() => this.shadowRoot?.querySelector('[data-action="add"]')?.focus()));
  }
  render() {
    const t = st(this.currentHass);
    return p`
      <p>${this.t("editor_intro")}</p>
      <ha-selector data-field="title" .hass=${this.currentHass} .label=${this.t("card_title")}
        .selector=${{ text: {} }} .value=${this.cardTitle}
        @value-changed=${this.titleChanged}></ha-selector>
      <ha-selector data-field="appearance" .hass=${this.currentHass} .label=${this.t("appearance")}
        .selector=${{ select: {
      options: [{ value: "tty7", label: "tty7" }, { value: "home-assistant", label: "Home Assistant" }],
      mode: "dropdown",
      custom_value: !1
    } }} .value=${this.appearance ?? "tty7"}
        @value-changed=${this.appearanceChanged}></ha-selector>
      ${t.length ? h : p`<p role="status">${this.t("missing_hosts")}
        <a href="/config/integrations">${this.t("settings_link")}</a>, ${this.t("saved_pairs")}</p>`}
      ${g(this.rows, (s) => s.id, (s, i) => {
      const r = t.filter((o) => o.roster_entity === s.host.roster_entity || !this.rows.some((a) => a !== s && a.host.roster_entity === o.roster_entity)).map((o) => ({ value: o.roster_entity, label: o.name }));
      return s.host.roster_entity && !r.some((o) => o.value === s.host.roster_entity) && r.push({ value: s.host.roster_entity, label: s.host.name || s.host.roster_entity }), p`<fieldset data-row=${s.id}>
          <legend>${this.t("host")} ${i + 1}</legend>
          <ha-selector data-field="host" .hass=${this.currentHass} .label=${`${this.t("host_picker")} ${i + 1}`}
            .selector=${{ select: { options: r, mode: "dropdown", custom_value: !1 } }} .value=${s.host.roster_entity}
            @value-changed=${(o) => this.selectHost(o, s.id)}></ha-selector>
          <ha-selector data-field="name" .hass=${this.currentHass} .label=${`${this.t("dashboard_label")} ${i + 1}`}
            .selector=${{ text: {} }} .value=${s.host.name}
            @value-changed=${(o) => this.labelChanged(o, s.id)}></ha-selector>
          ${s.host.roster_entity && s.host.connectivity_entity ? p`<p class="pair">${this.t("roster")}: ${s.host.roster_entity}<br>
            ${this.t("connectivity")}: ${s.host.connectivity_entity}</p>` : h}
          <button type="button" data-action="remove" aria-label=${`${this.t("remove_host")} ${i + 1}`} @click=${() => this.removeRow(s.id)}>${this.t("remove_host")}</button>
        </fieldset>`;
    })}
      ${this.feedback ? p`<p class="feedback" role="alert">${this.feedback}</p>` : h}
      <button type="button" data-action="add" ?disabled=${this.rows.length >= 64} @click=${this.addRow}>${this.t("add_host")}</button>
      <fieldset class="display-options"><legend>${this.t("group_by")}</legend>
        <label>${this.t("group_by")}<select data-field="group_by" .value=${this.presentation.group_by ?? "host"}
          @change=${(s) => this.presentationChanged("group_by", s.target.value)}>
          ${["host", "workspace", "tab"].map((s) => p`<option value=${s}>${this.t(`group_${s}`)}</option>`)}
        </select></label>
        ${["show_summary", "show_model", "show_effort", "show_session_id", "include_inferred"].map((s) => p`
          <label><input type="checkbox" data-field=${s} .checked=${this.presentation[s] ?? s !== "show_session_id"}
            @change=${(i) => this.presentationChanged(s, i.target.checked)}>${this.t(s)}</label>`)}
        <fieldset><legend>${this.t("statuses")}</legend>${F.map((s) => p`<label><input type="checkbox" data-status=${s}
          .checked=${!this.presentation.statuses || this.presentation.statuses.includes(s)}
          @change=${(i) => {
      const n = this.presentation.statuses ?? [...F];
      this.presentationChanged("statuses", i.target.checked ? [...n, s] : n.filter((r) => r !== s));
    }}>${this.t(s)}</label>`)}</fieldset>
        <label for="agent-types">${this.t("agent_types")}</label>
        <textarea id="agent-types" data-field="agent_types" aria-describedby="agent-types-help" .value=${this.presentation.agent_types?.join(`
`) ?? ""}
          @change=${(s) => this.presentationChanged("agent_types", [...new Set(s.target.value.split(`
`).map((i) => i.trim()).filter(Boolean))])}></textarea>
        <p id="agent-types-help">${this.t("agent_types_help")}</p>
      </fieldset>
    `;
  }
}
document.querySelector("home-assistant") && await customElements.whenDefined("home-assistant");
customElements.get("ha-tty7-card-editor") || customElements.define("ha-tty7-card-editor", Oe);
class Te extends H {
  constructor() {
    super(...arguments), this.configurationError = !1, this.selectedHost = "", this.expanded = /* @__PURE__ */ new Set();
  }
  static {
    this.styles = Ce;
  }
  static async getConfigElement() {
    return !customElements.get("ha-selector") && window.loadCardHelpers && ((await window.loadCardHelpers()).createCardElement({ type: "entities", entities: [] }), await customElements.whenDefined("hui-entities-card"), await customElements.get("hui-entities-card").getConfigElement()), document.createElement("ha-tty7-card-editor");
  }
  static getStubConfig(t) {
    return { type: "custom:ha-tty7-card", hosts: st(t), appearance: "home-assistant" };
  }
  t(t) {
    return Wt(this.currentHass, t);
  }
  setConfig(t) {
    try {
      this.config = et(t), this.configurationError = !1, this.setAttribute("appearance", this.config.appearance ?? "tty7"), this.config.hosts.some((s) => s.roster_entity === this.selectedHost) || (this.selectedHost = "");
    } catch (s) {
      throw this.config = void 0, this.configurationError = !0, this.requestUpdate(), s;
    }
    this.requestUpdate();
  }
  set hass(t) {
    this.currentHass = t, this.toggleAttribute("dark", t?.themes?.darkMode === !0), this.requestUpdate();
  }
  get hass() {
    return this.currentHass;
  }
  getCardSize() {
    return 2 + (this.config?.hosts.length ?? 1) * 2;
  }
  toggleDetails(t) {
    this.expanded.has(t) ? this.expanded.delete(t) : this.expanded.add(t), this.requestUpdate();
  }
  renderAgent(t, s) {
    const i = this.expanded.has(t.identity), n = `${this.t(t.status)}${t.inferred === !0 ? ` (${this.t("inferred")})` : ""}`, r = X(s.inventory, t.pane_id), o = s.inventory?.panes.find(($) => $.pane_id === t.pane_id), a = r?.name ?? r?.label ?? t.agent, l = t.model ?? this.t("not_reported"), c = t.effort === "" ? this.t("none_applicable") : t.effort ?? this.t("not_reported"), f = this.config?.show_model !== !1 && t.model !== null && t.model.trim().length > 0, d = this.config?.show_effort !== !1 && t.effort !== null && (t.effort === "" || t.effort.trim().length > 0), _ = this.config?.show_session_id === !0 && !!t.session_id?.trim(), u = `details-${Array.from(t.identity, ($) => $.codePointAt(0).toString(16)).join("-")}`, y = qt(t), m = [
      [this.t("agent"), t.agent],
      [this.t("status"), n],
      [this.t("pane"), t.pane_id],
      [this.t("session"), t.session_id],
      [this.t("provenance"), this.t(y === "unknown" ? "unknown_origin" : y)],
      [this.t("activity"), t.activity],
      [this.t("turns"), t.turns],
      [this.t("model"), l],
      [this.t("effort"), c],
      [this.t("permission"), t.permission_mode]
    ];
    return (t.model === null || t.effort === null) && m.push([this.t("model"), this.t("capability_unknown")]), r && m.push([this.t("workspace"), r.workspace_id], [this.t("tab"), r.tab_id]), o && m.push(
      [this.t("live"), o.live === null ? this.t("not_reported") : this.t(o.live ? "live" : "not_live")],
      [this.t("hibernated"), this.t(o.hibernated ? "yes" : "no")],
      [this.t("orphan"), this.t(o.orphan ? "yes" : "no")]
    ), p`<li class=${s.lastKnown ? "last-known" : ""}>
      <button class="agent-row" data-pane=${t.pane_id} aria-expanded=${String(i)} aria-controls=${u}
        aria-label=${`${t.agent}, ${this.t("pane_accessible")} ${t.pane_id}, ${n}${a !== t.agent ? `, ${a}` : ""}${s.lastKnown ? `, ${this.t("last_known")}` : ""}. ${this.t(i ? "hide_details" : "show_details")}`}
        @click=${() => this.toggleDetails(t.identity)}>
        <span class="agent-icon" aria-hidden="true">${ne`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="5" width="12" height="11" rx="3"/><path d="M10 2v3M1 9h3m12 0h3M7 16v2m6-2v2"/><circle cx="7.5" cy="10" r=".75" fill="currentColor"/><circle cx="12.5" cy="10" r=".75" fill="currentColor"/><path d="M7 13h6"/></svg>`}</span>
        <span class="agent-copy"><span class="agent-name">${a}</span>
          <span class="identity">${a !== t.agent ? p`${t.agent} · ` : h}${this.t("pane")} ${t.pane_id}${_ ? p` · ${t.session_id}` : h}</span>
          ${f || d ? p`<span class="metadata">${f ? p`${this.t("model")}: ${l}` : h}${f && d ? " · " : h}${d ? p`${this.t("effort")}: ${c}` : h}</span>` : h}
          ${r?.label && !r.name ? p`<span class="metadata">${this.t("derived")}</span>` : h}
          ${o?.hibernated || o?.orphan || o?.live === !1 ? p`<span class="metadata">${o.hibernated ? this.t("hibernated") : ""} ${o.orphan ? this.t("orphan") : ""} ${o.live === !1 ? this.t("not_live") : ""}</span>` : h}
        </span>
        <span class="status" data-status=${t.status}><span class="dot" aria-hidden="true"></span>${n}</span>
        <span class="chevron" aria-hidden="true">${i ? "⌄" : "›"}</span>
      </button>
      <dl id=${u} ?hidden=${!i}>${i ? m.map(([$, U]) => p`<dt>${$}</dt><dd>${U ?? this.t("not_reported")}</dd>`) : h}</dl>
    </li>`;
  }
  renderTab(t, s) {
    const i = ct(t.agents, this.config);
    if (t.agents.length && !i.length || !t.agents.length && (this.config?.statuses && !this.config.statuses.includes("unknown") || this.config?.agent_types?.length && (!t.tab.detected_agent || !this.config.agent_types.includes(t.tab.detected_agent)))) return h;
    const n = Bt(i);
    return p`<li class="tab-group" data-tab=${t.tab.tab_id}>
      <div class="group-head"><h3>${t.tab.name ?? t.tab.label ?? `${this.t("tab")} ${t.tab.ordinal ?? t.tab.tab_id}`}</h3>
        ${n ? p`<span>${n.agent} · ${this.t(n.status)}${n.inferred ? ` (${this.t("inferred")})` : ""}</span>` : t.tab.detected_agent ? p`<span>${t.tab.detected_agent} · ${this.t("unknown")} · ${this.t("detected_only")}</span>` : h}
        ${t.tab.hibernated ? p`<span>${this.t("hibernated")}</span>` : h}
        ${t.tab.group_name ? p`<span>${t.tab.group_name}</span>` : h}
        ${!t.tab.name && t.tab.label ? p`<span>${this.t("derived")}</span>` : h}
      </div>
      ${i.length ? p`<ul>${g(i, (r) => r.identity, (r) => this.renderAgent(r, s))}</ul>` : h}
    </li>`;
  }
  renderInventoryRemainder(t) {
    const s = t.inventory?.panes.filter((i) => i.orphan && !t.agents.some((n) => n.pane_id === i.pane_id)) ?? [];
    return s.length ? p`<ul class="inventory-panes">${g(s, (i) => i.pane_id, (i) => p`<li class="notice">${this.t("orphan")} · ${this.t("pane")} ${i.pane_id} · ${this.t("unknown")}${i.live === null ? "" : ` · ${this.t(i.live ? "live" : "not_live")}`}${i.hibernated ? ` · ${this.t("hibernated")}` : ""}</li>`)}</ul>` : h;
  }
  renderRows(t) {
    const s = ct(t.agents, this.config);
    if (this.config?.group_by === "workspace" && t.inventory) {
      const i = xe(t), n = tt(t).filter((r) => !t.inventory.workspaces.some((o) => o.workspace_id === r.tab.workspace_id));
      return p`${g(i, (r) => r.identity, (r) => p`<div class="workspace-group" data-workspace=${r.workspace.workspace_id}>
        <h3 class="workspace-title">${r.workspace.name ?? `${this.t("workspace")} ${r.workspace.workspace_id}`}</h3><ul>${g(r.tabs, (o) => o.identity, (o) => this.renderTab(o, t))}</ul></div>`)}
        ${n.length ? p`<ul>${g(n, (r) => r.identity, (r) => this.renderTab(r, t))}</ul>` : h}
        <ul>${g(s.filter((r) => !X(t.inventory, r.pane_id)), (r) => r.identity, (r) => this.renderAgent(r, t))}</ul>${this.renderInventoryRemainder(t)}`;
    }
    return this.config?.group_by === "tab" && t.inventory ? p`<ul>${g(tt(t), (i) => i.identity, (i) => this.renderTab(i, t))}
      ${g(s.filter((i) => !X(t.inventory, i.pane_id)), (i) => i.identity, (i) => this.renderAgent(i, t))}</ul>${this.renderInventoryRemainder(t)}` : p`<ul>${g(s, (i) => i.identity, (i) => this.renderAgent(i, t))}
      ${g(tt(t).filter((i) => !i.agents.length), (i) => i.identity, (i) => this.renderTab(i, t))}</ul>${this.renderInventoryRemainder(t)}`;
  }
  renderHost(t) {
    const s = ct(t.agents, this.config), i = Object.values(t.confirmedCounts).reduce((r, o) => r + o, 0), n = `notice_${t.state}`;
    return p`<section aria-label=${t.config.name}>
      <div class="host-head"><div class="host-title"><h2>${t.config.name}</h2><span class="host-state" data-state=${t.state} role="status">${this.t(t.state)}</span></div>
        <p class="receipt">${t.lastContact === null ? this.t("no_receipt") : p`${this.t("last_contact")}: <time datetime=${t.lastContact}>${J(t.lastContact, this.currentHass)}</time>`}</p>
        ${t.lastKnown && t.lastSuccess !== null ? p`<p class="receipt">${this.t("last_success")}: <time datetime=${t.lastSuccess}>${J(t.lastSuccess, this.currentHass)}</time></p>` : h}
        ${this.config?.show_summary !== !1 ? p`<p class="summary">${t.agents.length} ${this.t("reported")} · ${i} ${this.t("confirmed")} · ${t.inferredCount} ${this.t("inferred")} · ${t.weakCount} ${this.t("weak")} · ${t.unknownOriginCount} ${this.t("unknown_origin")}
          ${t.inventory ? p`<br>${t.inventory.workspaces.length} ${this.t("workspaces")} · ${t.inventory.tabs.length} ${this.t("tabs")} · ${t.inventory.panes.length} ${this.t("panes")}` : h}</p>` : h}
        <p class="filtered-count">${s.length} / ${t.agents.length} ${this.t("filtered")}</p>
      </div>
      ${t.state !== "healthy" ? p`<p class="notice">${this.t(n)}${t.errorCode ? p` ${this.t(t.errorCode)}.` : h}</p>` : h}
      <p class="notice inventory-state" data-inventory-state=${t.inventoryState}>${this.t(`inventory_${t.inventoryState}`)}${t.inventoryErrorCode ? p` · ${this.t(t.inventoryErrorCode)}` : h}${t.inventory && !t.inventory.consistent ? p` · ${this.t("inventory_pending")}` : h}</p>
      ${t.inventoryLastContact ? p`<p class="notice">${this.t("inventory_contact")}: <time datetime=${t.inventoryLastContact}>${J(t.inventoryLastContact, this.currentHass)}</time></p>` : h}
      ${t.inventoryLastSuccess && t.inventoryState !== "healthy" ? p`<p class="notice">${this.t("inventory_success")}: <time datetime=${t.inventoryLastSuccess}>${J(t.inventoryLastSuccess, this.currentHass)}</time></p>` : h}
      ${this.renderRows(t)}
      ${t.source ? p`<details class="source"><summary>${this.t("source")}</summary><dl>
        ${[
      ["status", this.t(t.source.state === "available" ? "source_available" : "source_unavailable")],
      ["collector_version", t.source.collector_version],
      ["tty7_build", t.source.tty7_build],
      ["control_version", t.source.control_version],
      ["protocol_version", t.source.protocol_version],
      ["uptime", t.source.uptime_secs]
    ].map(([r, o]) => p`<dt>${this.t(r)}</dt><dd>${o ?? this.t("not_reported")}</dd>`)}
        <dt>${this.t("model")}</dt><dd>${this.t("capability_unknown")}</dd></dl></details>` : h}
    </section>`;
  }
  render() {
    if (!this.config) return p`<ha-card><p class="configuration"><strong>${this.t(this.configurationError ? "configuration_error" : "not_configured")}</strong><br>${this.t("configuration_help")}</p></ha-card>`;
    if (!this.config.hosts.length) return p`<ha-card><p class="configuration"><strong>${this.t("no_hosts")}</strong><br>${this.t("setup_help")}</p></ha-card>`;
    const t = this.config.hosts.map((n) => Se(n, this.currentHass?.states ?? {}, this.currentHass?.connection?.connected ?? !0)), s = new Set(t.flatMap((n) => n.agents.map((r) => r.identity)));
    for (const n of this.expanded) s.has(n) || this.expanded.delete(n);
    const i = this.config.appearance === "home-assistant";
    return p`<ha-card .header=${i ? this.config.title ?? this.t("title") : void 0}>
      ${!i || t.length > 1 ? p`<header>${i ? h : p`<h1>${this.config.title ?? this.t("title")}</h1>`}
        ${t.length > 1 ? p`<label>${this.t("show_host")}<select aria-label=${this.t("show_host")} .value=${this.selectedHost}
          @change=${(n) => {
      this.selectedHost = n.target.value, this.requestUpdate();
    }}>
          <option value="">${this.t("all_hosts")}</option>${this.config.hosts.map((n) => p`<option value=${n.roster_entity}>${n.name}</option>`)}</select></label>` : h}</header>` : h}
      ${g(t.filter((n) => !this.selectedHost || n.config.roster_entity === this.selectedHost), (n) => n.config.roster_entity, (n) => this.renderHost(n))}
    </ha-card>`;
  }
}
customElements.get("ha-tty7-card") || customElements.define("ha-tty7-card", Te);
window.customCards ??= [];
window.customCards.some((e) => e.type === "ha-tty7-card") || window.customCards.push({ type: "ha-tty7-card", name: "HA-tty7", description: "Read-only structured tty7 agent status grouped by host.", preview: !0 });
export {
  Te as HaTty7Card
};
