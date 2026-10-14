/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const N = globalThis, F = N.ShadowRoot && (N.ShadyCSS === void 0 || N.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, J = Symbol(), tt = /* @__PURE__ */ new WeakMap();
let gt = class {
  constructor(t, e, i) {
    if (this._$cssResult$ = !0, i !== J) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = e;
  }
  get styleSheet() {
    let t = this.o;
    const e = this.t;
    if (F && t === void 0) {
      const i = e !== void 0 && e.length === 1;
      i && (t = tt.get(e)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), i && tt.set(e, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const Ct = (n) => new gt(typeof n == "string" ? n : n + "", void 0, J), $t = (n, ...t) => {
  const e = n.length === 1 ? n[0] : t.reduce((i, s, r) => i + ((o) => {
    if (o._$cssResult$ === !0) return o.cssText;
    if (typeof o == "number") return o;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + o + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(s) + n[r + 1], n[0]);
  return new gt(e, n, J);
}, kt = (n, t) => {
  if (F) n.adoptedStyleSheets = t.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
  else for (const e of t) {
    const i = document.createElement("style"), s = N.litNonce;
    s !== void 0 && i.setAttribute("nonce", s), i.textContent = e.cssText, n.appendChild(i);
  }
}, et = F ? (n) => n : (n) => n instanceof CSSStyleSheet ? ((t) => {
  let e = "";
  for (const i of t.cssRules) e += i.cssText;
  return Ct(e);
})(n) : n;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: Ht, defineProperty: Ut, getOwnPropertyDescriptor: Pt, getOwnPropertyNames: Ot, getOwnPropertySymbols: Mt, getPrototypeOf: Rt } = Object, L = globalThis, st = L.trustedTypes, Nt = st ? st.emptyScript : "", Tt = L.reactiveElementPolyfillSupport, U = (n, t) => n, W = { toAttribute(n, t) {
  switch (t) {
    case Boolean:
      n = n ? Nt : null;
      break;
    case Object:
    case Array:
      n = n == null ? n : JSON.stringify(n);
  }
  return n;
}, fromAttribute(n, t) {
  let e = n;
  switch (t) {
    case Boolean:
      e = n !== null;
      break;
    case Number:
      e = n === null ? null : Number(n);
      break;
    case Object:
    case Array:
      try {
        e = JSON.parse(n);
      } catch {
        e = null;
      }
  }
  return e;
} }, _t = (n, t) => !Ht(n, t), it = { attribute: !0, type: String, converter: W, reflect: !1, useDefault: !1, hasChanged: _t };
Symbol.metadata ??= Symbol("metadata"), L.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let x = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ??= []).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, e = it) {
    if (e.state && (e.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((e = Object.create(e)).wrapped = !0), this.elementProperties.set(t, e), !e.noAccessor) {
      const i = Symbol(), s = this.getPropertyDescriptor(t, i, e);
      s !== void 0 && Ut(this.prototype, t, s);
    }
  }
  static getPropertyDescriptor(t, e, i) {
    const { get: s, set: r } = Pt(this.prototype, t) ?? { get() {
      return this[e];
    }, set(o) {
      this[e] = o;
    } };
    return { get: s, set(o) {
      const a = s?.call(this);
      r?.call(this, o), this.requestUpdate(t, a, i);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? it;
  }
  static _$Ei() {
    if (this.hasOwnProperty(U("elementProperties"))) return;
    const t = Rt(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(U("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(U("properties"))) {
      const e = this.properties, i = [...Ot(e), ...Mt(e)];
      for (const s of i) this.createProperty(s, e[s]);
    }
    const t = this[Symbol.metadata];
    if (t !== null) {
      const e = litPropertyMetadata.get(t);
      if (e !== void 0) for (const [i, s] of e) this.elementProperties.set(i, s);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [e, i] of this.elementProperties) {
      const s = this._$Eu(e, i);
      s !== void 0 && this._$Eh.set(s, e);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(t) {
    const e = [];
    if (Array.isArray(t)) {
      const i = new Set(t.flat(1 / 0).reverse());
      for (const s of i) e.unshift(et(s));
    } else t !== void 0 && e.push(et(t));
    return e;
  }
  static _$Eu(t, e) {
    const i = e.attribute;
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
    const t = /* @__PURE__ */ new Map(), e = this.constructor.elementProperties;
    for (const i of e.keys()) this.hasOwnProperty(i) && (t.set(i, this[i]), delete this[i]);
    t.size > 0 && (this._$Ep = t);
  }
  createRenderRoot() {
    const t = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return kt(t, this.constructor.elementStyles), t;
  }
  connectedCallback() {
    this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((t) => t.hostConnected?.());
  }
  enableUpdating(t) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((t) => t.hostDisconnected?.());
  }
  attributeChangedCallback(t, e, i) {
    this._$AK(t, i);
  }
  _$ET(t, e) {
    const i = this.constructor.elementProperties.get(t), s = this.constructor._$Eu(t, i);
    if (s !== void 0 && i.reflect === !0) {
      const r = (i.converter?.toAttribute !== void 0 ? i.converter : W).toAttribute(e, i.type);
      this._$Em = t, r == null ? this.removeAttribute(s) : this.setAttribute(s, r), this._$Em = null;
    }
  }
  _$AK(t, e) {
    const i = this.constructor, s = i._$Eh.get(t);
    if (s !== void 0 && this._$Em !== s) {
      const r = i.getPropertyOptions(s), o = typeof r.converter == "function" ? { fromAttribute: r.converter } : r.converter?.fromAttribute !== void 0 ? r.converter : W;
      this._$Em = s;
      const a = o.fromAttribute(e, r.type);
      this[s] = a ?? this._$Ej?.get(s) ?? a, this._$Em = null;
    }
  }
  requestUpdate(t, e, i, s = !1, r) {
    if (t !== void 0) {
      const o = this.constructor;
      if (s === !1 && (r = this[t]), i ??= o.getPropertyOptions(t), !((i.hasChanged ?? _t)(r, e) || i.useDefault && i.reflect && r === this._$Ej?.get(t) && !this.hasAttribute(o._$Eu(t, i)))) return;
      this.C(t, e, i);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, e, { useDefault: i, reflect: s, wrapped: r }, o) {
    i && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t) && (this._$Ej.set(t, o ?? e ?? this[t]), r !== !0 || o !== void 0) || (this._$AL.has(t) || (this.hasUpdated || i || (e = void 0), this._$AL.set(t, e)), s === !0 && this._$Em !== t && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t));
  }
  async _$EP() {
    this.isUpdatePending = !0;
    try {
      await this._$ES;
    } catch (e) {
      Promise.reject(e);
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
        for (const [s, r] of this._$Ep) this[s] = r;
        this._$Ep = void 0;
      }
      const i = this.constructor.elementProperties;
      if (i.size > 0) for (const [s, r] of i) {
        const { wrapped: o } = r, a = this[s];
        o !== !0 || this._$AL.has(s) || a === void 0 || this.C(s, void 0, r, a);
      }
    }
    let t = !1;
    const e = this._$AL;
    try {
      t = this.shouldUpdate(e), t ? (this.willUpdate(e), this._$EO?.forEach((i) => i.hostUpdate?.()), this.update(e)) : this._$EM();
    } catch (i) {
      throw t = !1, this._$EM(), i;
    }
    t && this._$AE(e);
  }
  willUpdate(t) {
  }
  _$AE(t) {
    this._$EO?.forEach((e) => e.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(t)), this.updated(t);
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
    this._$Eq &&= this._$Eq.forEach((e) => this._$ET(e, this[e])), this._$EM();
  }
  updated(t) {
  }
  firstUpdated(t) {
  }
};
x.elementStyles = [], x.shadowRootOptions = { mode: "open" }, x[U("elementProperties")] = /* @__PURE__ */ new Map(), x[U("finalized")] = /* @__PURE__ */ new Map(), Tt?.({ ReactiveElement: x }), (L.reactiveElementVersions ??= []).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Q = globalThis, nt = (n) => n, z = Q.trustedTypes, rt = z ? z.createPolicy("lit-html", { createHTML: (n) => n }) : void 0, bt = "$lit$", $ = `lit$${Math.random().toFixed(9).slice(2)}$`, vt = "?" + $, zt = `<${vt}>`, A = document, P = () => A.createComment(""), O = (n) => n === null || typeof n != "object" && typeof n != "function", G = Array.isArray, Lt = (n) => G(n) || typeof n?.[Symbol.iterator] == "function", I = `[ 	
\f\r]`, k = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, ot = /-->/g, at = />/g, _ = RegExp(`>|${I}(?:([^\\s"'>=/]+)(${I}*=${I}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), lt = /'/g, dt = /"/g, At = /^(?:script|style|textarea|title)$/i, wt = (n) => (t, ...e) => ({ _$litType$: n, strings: t, values: e }), m = wt(1), Dt = wt(2), w = Symbol.for("lit-noChange"), u = Symbol.for("lit-nothing"), ct = /* @__PURE__ */ new WeakMap(), v = A.createTreeWalker(A, 129);
function xt(n, t) {
  if (!G(n) || !n.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return rt !== void 0 ? rt.createHTML(t) : t;
}
const jt = (n, t) => {
  const e = n.length - 1, i = [];
  let s, r = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = k;
  for (let a = 0; a < e; a++) {
    const l = n[a];
    let h, f, d = -1, p = 0;
    for (; p < l.length && (o.lastIndex = p, f = o.exec(l), f !== null); ) p = o.lastIndex, o === k ? f[1] === "!--" ? o = ot : f[1] !== void 0 ? o = at : f[2] !== void 0 ? (At.test(f[2]) && (s = RegExp("</" + f[2], "g")), o = _) : f[3] !== void 0 && (o = _) : o === _ ? f[0] === ">" ? (o = s ?? k, d = -1) : f[1] === void 0 ? d = -2 : (d = o.lastIndex - f[2].length, h = f[1], o = f[3] === void 0 ? _ : f[3] === '"' ? dt : lt) : o === dt || o === lt ? o = _ : o === ot || o === at ? o = k : (o = _, s = void 0);
    const c = o === _ && n[a + 1].startsWith("/>") ? " " : "";
    r += o === k ? l + zt : d >= 0 ? (i.push(h), l.slice(0, d) + bt + l.slice(d) + $ + c) : l + $ + (d === -2 ? a : c);
  }
  return [xt(n, r + (n[e] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), i];
};
class M {
  constructor({ strings: t, _$litType$: e }, i) {
    let s;
    this.parts = [];
    let r = 0, o = 0;
    const a = t.length - 1, l = this.parts, [h, f] = jt(t, e);
    if (this.el = M.createElement(h, i), v.currentNode = this.el.content, e === 2 || e === 3) {
      const d = this.el.content.firstChild;
      d.replaceWith(...d.childNodes);
    }
    for (; (s = v.nextNode()) !== null && l.length < a; ) {
      if (s.nodeType === 1) {
        if (s.hasAttributes()) for (const d of s.getAttributeNames()) if (d.endsWith(bt)) {
          const p = f[o++], c = s.getAttribute(d).split($), y = /([.?@])?(.*)/.exec(p);
          l.push({ type: 1, index: r, name: y[2], strings: c, ctor: y[1] === "." ? qt : y[1] === "?" ? Bt : y[1] === "@" ? Wt : D }), s.removeAttribute(d);
        } else d.startsWith($) && (l.push({ type: 6, index: r }), s.removeAttribute(d));
        if (At.test(s.tagName)) {
          const d = s.textContent.split($), p = d.length - 1;
          if (p > 0) {
            s.textContent = z ? z.emptyScript : "";
            for (let c = 0; c < p; c++) s.append(d[c], P()), v.nextNode(), l.push({ type: 2, index: ++r });
            s.append(d[p], P());
          }
        }
      } else if (s.nodeType === 8) if (s.data === vt) l.push({ type: 2, index: r });
      else {
        let d = -1;
        for (; (d = s.data.indexOf($, d + 1)) !== -1; ) l.push({ type: 7, index: r }), d += $.length - 1;
      }
      r++;
    }
  }
  static createElement(t, e) {
    const i = A.createElement("template");
    return i.innerHTML = t, i;
  }
}
function E(n, t, e = n, i) {
  if (t === w) return t;
  let s = i !== void 0 ? e._$Co?.[i] : e._$Cl;
  const r = O(t) ? void 0 : t._$litDirective$;
  return s?.constructor !== r && (s?._$AO?.(!1), r === void 0 ? s = void 0 : (s = new r(n), s._$AT(n, e, i)), i !== void 0 ? (e._$Co ??= [])[i] = s : e._$Cl = s), s !== void 0 && (t = E(n, s._$AS(n, t.values), s, i)), t;
}
class It {
  constructor(t, e) {
    this._$AV = [], this._$AN = void 0, this._$AD = t, this._$AM = e;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t) {
    const { el: { content: e }, parts: i } = this._$AD, s = (t?.creationScope ?? A).importNode(e, !0);
    v.currentNode = s;
    let r = v.nextNode(), o = 0, a = 0, l = i[0];
    for (; l !== void 0; ) {
      if (o === l.index) {
        let h;
        l.type === 2 ? h = new C(r, r.nextSibling, this, t) : l.type === 1 ? h = new l.ctor(r, l.name, l.strings, this, t) : l.type === 6 && (h = new Vt(r, this, t)), this._$AV.push(h), l = i[++a];
      }
      o !== l?.index && (r = v.nextNode(), o++);
    }
    return v.currentNode = A, s;
  }
  p(t) {
    let e = 0;
    for (const i of this._$AV) i !== void 0 && (i.strings !== void 0 ? (i._$AI(t, i, e), e += i.strings.length - 2) : i._$AI(t[e])), e++;
  }
}
class C {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t, e, i, s) {
    this.type = 2, this._$AH = u, this._$AN = void 0, this._$AA = t, this._$AB = e, this._$AM = i, this.options = s, this._$Cv = s?.isConnected ?? !0;
  }
  get parentNode() {
    let t = this._$AA.parentNode;
    const e = this._$AM;
    return e !== void 0 && t?.nodeType === 11 && (t = e.parentNode), t;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t, e = this) {
    t = E(this, t, e), O(t) ? t === u || t == null || t === "" ? (this._$AH !== u && this._$AR(), this._$AH = u) : t !== this._$AH && t !== w && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : Lt(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== u && O(this._$AH) ? this._$AA.nextSibling.data = t : this.T(A.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    const { values: e, _$litType$: i } = t, s = typeof i == "number" ? this._$AC(t) : (i.el === void 0 && (i.el = M.createElement(xt(i.h, i.h[0]), this.options)), i);
    if (this._$AH?._$AD === s) this._$AH.p(e);
    else {
      const r = new It(s, this), o = r.u(this.options);
      r.p(e), this.T(o), this._$AH = r;
    }
  }
  _$AC(t) {
    let e = ct.get(t.strings);
    return e === void 0 && ct.set(t.strings, e = new M(t)), e;
  }
  k(t) {
    G(this._$AH) || (this._$AH = [], this._$AR());
    const e = this._$AH;
    let i, s = 0;
    for (const r of t) s === e.length ? e.push(i = new C(this.O(P()), this.O(P()), this, this.options)) : i = e[s], i._$AI(r), s++;
    s < e.length && (this._$AR(i && i._$AB.nextSibling, s), e.length = s);
  }
  _$AR(t = this._$AA.nextSibling, e) {
    for (this._$AP?.(!1, !0, e); t !== this._$AB; ) {
      const i = nt(t).nextSibling;
      nt(t).remove(), t = i;
    }
  }
  setConnected(t) {
    this._$AM === void 0 && (this._$Cv = t, this._$AP?.(t));
  }
}
class D {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, e, i, s, r) {
    this.type = 1, this._$AH = u, this._$AN = void 0, this.element = t, this.name = e, this._$AM = s, this.options = r, i.length > 2 || i[0] !== "" || i[1] !== "" ? (this._$AH = Array(i.length - 1).fill(new String()), this.strings = i) : this._$AH = u;
  }
  _$AI(t, e = this, i, s) {
    const r = this.strings;
    let o = !1;
    if (r === void 0) t = E(this, t, e, 0), o = !O(t) || t !== this._$AH && t !== w, o && (this._$AH = t);
    else {
      const a = t;
      let l, h;
      for (t = r[0], l = 0; l < r.length - 1; l++) h = E(this, a[i + l], e, l), h === w && (h = this._$AH[l]), o ||= !O(h) || h !== this._$AH[l], h === u ? t = u : t !== u && (t += (h ?? "") + r[l + 1]), this._$AH[l] = h;
    }
    o && !s && this.j(t);
  }
  j(t) {
    t === u ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class qt extends D {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === u ? void 0 : t;
  }
}
class Bt extends D {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== u);
  }
}
class Wt extends D {
  constructor(t, e, i, s, r) {
    super(t, e, i, s, r), this.type = 5;
  }
  _$AI(t, e = this) {
    if ((t = E(this, t, e, 0) ?? u) === w) return;
    const i = this._$AH, s = t === u && i !== u || t.capture !== i.capture || t.once !== i.once || t.passive !== i.passive, r = t !== u && (i === u || s);
    s && this.element.removeEventListener(this.name, this, i), r && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class Vt {
  constructor(t, e, i) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = e, this.options = i;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    E(this, t);
  }
}
const Kt = { I: C }, Zt = Q.litHtmlPolyfillSupport;
Zt?.(M, C), (Q.litHtmlVersions ??= []).push("3.3.3");
const Ft = (n, t, e) => {
  const i = e?.renderBefore ?? t;
  let s = i._$litPart$;
  if (s === void 0) {
    const r = e?.renderBefore ?? null;
    i._$litPart$ = s = new C(t.insertBefore(P(), r), r, void 0, e ?? {});
  }
  return s._$AI(n), s;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const X = globalThis;
let S = class extends x {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t.firstChild, t;
  }
  update(t) {
    const e = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = Ft(e, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return w;
  }
};
S._$litElement$ = !0, S.finalized = !0, X.litElementHydrateSupport?.({ LitElement: S });
const Jt = X.litElementPolyfillSupport;
Jt?.({ LitElement: S });
(X.litElementVersions ??= []).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Qt = { CHILD: 2 }, Gt = (n) => (...t) => ({ _$litDirective$: n, values: t });
let Xt = class {
  constructor(t) {
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AT(t, e, i) {
    this._$Ct = t, this._$AM = e, this._$Ci = i;
  }
  _$AS(t, e) {
    return this.update(t, e);
  }
  update(t, e) {
    return this.render(...e);
  }
};
/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { I: Yt } = Kt, ht = (n) => n, pt = () => document.createComment(""), H = (n, t, e) => {
  const i = n._$AA.parentNode, s = t === void 0 ? n._$AB : t._$AA;
  if (e === void 0) {
    const r = i.insertBefore(pt(), s), o = i.insertBefore(pt(), s);
    e = new Yt(r, o, n, n.options);
  } else {
    const r = e._$AB.nextSibling, o = e._$AM, a = o !== n;
    if (a) {
      let l;
      e._$AQ?.(n), e._$AM = n, e._$AP !== void 0 && (l = n._$AU) !== o._$AU && e._$AP(l);
    }
    if (r !== s || a) {
      let l = e._$AA;
      for (; l !== r; ) {
        const h = ht(l).nextSibling;
        ht(i).insertBefore(l, s), l = h;
      }
    }
  }
  return e;
}, b = (n, t, e = n) => (n._$AI(t, e), n), te = {}, ee = (n, t = te) => n._$AH = t, se = (n) => n._$AH, q = (n) => {
  n._$AR(), n._$AA.remove();
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const ut = (n, t, e) => {
  const i = /* @__PURE__ */ new Map();
  for (let s = t; s <= e; s++) i.set(n[s], s);
  return i;
}, V = Gt(class extends Xt {
  constructor(n) {
    if (super(n), n.type !== Qt.CHILD) throw Error("repeat() can only be used in text expressions");
  }
  dt(n, t, e) {
    let i;
    e === void 0 ? e = t : t !== void 0 && (i = t);
    const s = [], r = [];
    let o = 0;
    for (const a of n) s[o] = i ? i(a, o) : o, r[o] = e(a, o), o++;
    return { values: r, keys: s };
  }
  render(n, t, e) {
    return this.dt(n, t, e).values;
  }
  update(n, [t, e, i]) {
    const s = se(n), { values: r, keys: o } = this.dt(t, e, i);
    if (!Array.isArray(s)) return this.ut = o, r;
    const a = this.ut ??= [], l = [];
    let h, f, d = 0, p = s.length - 1, c = 0, y = r.length - 1;
    for (; d <= p && c <= y; ) if (s[d] === null) d++;
    else if (s[p] === null) p--;
    else if (a[d] === o[c]) l[c] = b(s[d], r[c]), d++, c++;
    else if (a[p] === o[y]) l[y] = b(s[p], r[y]), p--, y--;
    else if (a[d] === o[y]) l[y] = b(s[d], r[y]), H(n, l[y + 1], s[d]), d++, y--;
    else if (a[p] === o[c]) l[c] = b(s[p], r[c]), H(n, s[d], s[p]), p--, c++;
    else if (h === void 0 && (h = ut(o, c, y), f = ut(a, d, p)), h.has(a[d])) if (h.has(a[p])) {
      const g = f.get(o[c]), j = g !== void 0 ? s[g] : null;
      if (j === null) {
        const Y = H(n, s[d]);
        b(Y, r[c]), l[c] = Y;
      } else l[c] = b(j, r[c]), H(n, s[d], j), s[g] = null;
      c++;
    } else q(s[p]), p--;
    else q(s[d]), d++;
    for (; c <= y; ) {
      const g = H(n, l[y + 1]);
      b(g, r[c]), l[c++] = g;
    }
    for (; d <= p; ) {
      const g = s[d++];
      g !== null && q(g);
    }
    return this.ut = o, ee(n, l), w;
  }
}), St = ["idle", "working", "waiting", "done", "unknown"], ie = ["cli_unavailable", "cli_timeout", "cli_failed", "invalid_payload", "payload_too_large"];
function R(n) {
  return typeof n == "object" && n !== null && !Array.isArray(n);
}
function K(n, t) {
  if (typeof n != "string" || n.length === 0) return !1;
  let e = 0;
  for (let i = 0; i < n.length; i++) {
    const s = n.charCodeAt(i);
    if (s >= 55296 && s <= 56319) {
      const r = n.charCodeAt(++i);
      if (!(r >= 56320 && r <= 57343)) return !1;
    } else if (s >= 56320 && s <= 57343) return !1;
    if (++e > t) return !1;
  }
  return !0;
}
function Z(n) {
  return typeof n == "number" && Number.isSafeInteger(n) && n >= 0;
}
function Et(n) {
  const t = () => {
    throw new Error("Configure unique host names, sensor rosters, and binary_sensor connectivity entities.");
  };
  if (!R(n) || n.type !== "custom:ha-tty7-card" || !Array.isArray(n.hosts) || n.hosts.length > 64 || Object.keys(n).some((r) => !["type", "hosts"].includes(r))) return t();
  const e = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), s = [];
  for (const r of n.hosts) {
    if (!R(r) || Object.keys(r).some((o) => !["name", "roster_entity", "connectivity_entity"].includes(o)) || !K(r.name, 128) || !r.name.trim() || typeof r.roster_entity != "string" || typeof r.connectivity_entity != "string" || !/^sensor\.[a-z0-9_]+$/.test(r.roster_entity) || !/^binary_sensor\.[a-z0-9_]+$/.test(r.connectivity_entity) || e.has(r.name.trim()) || i.has(r.roster_entity) || i.has(r.connectivity_entity)) return t();
    e.add(r.name.trim()), i.add(r.roster_entity), i.add(r.connectivity_entity), s.push({ name: r.name.trim(), roster_entity: r.roster_entity, connectivity_entity: r.connectivity_entity });
  }
  return { type: "custom:ha-tty7-card", hosts: s };
}
function ne(n) {
  if (!R(n) || !Z(n.pane_id) || n.pane_id === 0 || !K(n.agent, 64)) return null;
  for (const t of ["session_id", "model", "effort", "permission_mode"])
    if (n[t] !== void 0 && n[t] !== null && !K(n[t], 128)) return null;
  for (const t of ["activity", "turns"])
    if (n[t] !== void 0 && n[t] !== null && !Z(n[t])) return null;
  return {
    pane_id: n.pane_id,
    agent: n.agent,
    session_id: n.session_id ?? null,
    status: St.includes(n.status) ? n.status : "unknown",
    activity: n.activity ?? null,
    turns: n.turns ?? null,
    model: n.model ?? null,
    effort: n.effort ?? null,
    permission_mode: n.permission_mode ?? null
  };
}
function ft(n) {
  return n === null ? null : typeof n != "string" || n.length > 64 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(n) ? NaN : Date.parse(n);
}
function re(n, t, e) {
  const i = { idle: 0, working: 0, waiting: 0, done: 0, unknown: 0 }, s = {
    config: n,
    state: e ? "loading" : "disconnected",
    agents: [],
    counts: i,
    lastContact: null,
    lastSuccess: null,
    errorCode: null,
    lastKnown: !0
  }, r = t[n.roster_entity], o = t[n.connectivity_entity];
  if (!r || !o || (s.state = e ? "malformed" : "disconnected", !R(r.attributes))) return s;
  const a = r.attributes;
  if (a.schema_version !== 1 || !Array.isArray(a.agents) || a.agents.length > 256 || typeof a.collector_ok != "boolean" || typeof a.baseline_ready != "boolean" || !R(a.counts) || !Object.hasOwn(a, "error_code") || !Object.hasOwn(a, "last_contact") || !Object.hasOwn(a, "last_success")) return s;
  const l = ft(a.last_contact), h = ft(a.last_success);
  if (l !== null && !Number.isFinite(l) || h !== null && !Number.isFinite(h) || l !== null && h !== null && h > l || a.baseline_ready && (l === null || h === null) || a.error_code !== null && !ie.includes(a.error_code) || a.collector_ok && a.error_code !== null || !a.collector_ok && a.baseline_ready) return s;
  const f = [], d = /* @__PURE__ */ new Set();
  for (const c of a.agents) {
    const y = ne(c);
    if (!y || d.has(y.pane_id)) return s;
    d.add(y.pane_id), f.push(y), i[y.status] += 1;
  }
  const p = a.counts;
  return St.some((c) => !Z(p[c]) || p[c] !== i[c]) || (s.agents = f.map((c) => ({ ...c, identity: JSON.stringify([n.roster_entity, c.session_id, c.pane_id]) })), s.lastContact = a.last_contact, s.lastSuccess = a.last_success, s.errorCode = a.error_code, e ? ["unavailable", "unknown"].includes(r.state) || ["unavailable", "unknown"].includes(o.state) ? s.state = "offline" : r.state === "error" ? s.state = s.errorCode === null ? "malformed" : "error" : r.state === "stale" ? s.state = "stale" : r.state === "unconfirmed" ? s.state = "unconfirmed" : s.errorCode !== null || r.state !== String(f.length) ? s.state = "malformed" : !a.collector_ok || !a.baseline_ready || l === null || h === null || o.state === "off" ? s.state = "offline" : o.state !== "on" ? s.state = "malformed" : s.state = f.length === 0 ? "empty" : "healthy" : s.state = "disconnected", s.lastKnown = !["healthy", "empty"].includes(s.state)), s;
}
const oe = $t`
  :host {
    display: block; min-width: 0; color-scheme: light;
    --tty-bg: #fcfcfb; --tty-ink: #1c1c1e; --tty-rail: #f5f5f3;
    --tty-muted: #626267; --tty-line: #c5c5c4; --tty-hover: #ededec;
    --tty-blue: #1f6bf0; --tty-green: #2f8a52; --tty-amber: #b7791f; --tty-red: #c43c43;
    font-family: var(--ha-font-family-body, system-ui, sans-serif); font-size: 14px;
  }
  :host([dark]) {
    color-scheme: dark; --tty-bg: #18181a; --tty-ink: #ececed; --tty-rail: #1e1e20;
    --tty-muted: #aaaab0; --tty-line: #505055; --tty-hover: #2b2b2e;
    --tty-blue: #78a8f5; --tty-green: #4cc27a; --tty-amber: #e0a345; --tty-red: #f07878;
  }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  ha-card { display: block; overflow: hidden; background: var(--tty-bg); color: var(--tty-ink);
    border: 1px solid var(--tty-line); border-radius: var(--ha-card-border-radius, 12px); }
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 12px 14px; border-bottom: 1px solid var(--tty-line); }
  h1 { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -.02em; }
  .brand { font-family: ui-monospace, 'Cascadia Code', 'DejaVu Sans Mono', monospace; font-weight: 700; }
  .subtitle { color: var(--tty-muted); font-size: 12px; }
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
    border: 0; border-radius: 5px; text-align: left; color: inherit; background: transparent; cursor: pointer; font: inherit; }
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
  @media (max-width: 380px) {
    header { padding: 10px; gap: 8px; }
    .host-head { padding: 10px; }
    .agent-row { gap: 6px; grid-template-columns: 24px minmax(0, 1fr) auto 10px; }
    dl { padding: 10px; gap: 8px; }
  }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
`;
function T(n) {
  if (!n?.entities || !n.devices) return [];
  const t = /* @__PURE__ */ new Map();
  for (const s of Object.values(n.entities)) {
    if (s.platform !== "ha_tty7" || !s.device_id || s.hidden) continue;
    const r = n.devices[s.device_id];
    if (!r || r.disabled_by || !r.config_entries.length || !r.identifiers.some(([a, l]) => a === "ha_tty7" && l.length > 0)) continue;
    const o = t.get(r.id) ?? { rosters: [], connectivity: [] };
    if (/^sensor\.[a-z0-9_]+$/.test(s.entity_id)) o.rosters.push(s.entity_id);
    else if (/^binary_sensor\.[a-z0-9_]+$/.test(s.entity_id)) o.connectivity.push(s.entity_id);
    else continue;
    t.set(r.id, o);
  }
  const e = [], i = /* @__PURE__ */ new Set();
  for (const [s, r] of t) {
    if (r.rosters.length !== 1 || r.connectivity.length !== 1 || e.length === 64) continue;
    const o = n.devices[s], a = (o.name_by_user || o.name)?.trim();
    if (!a || Array.from(a).length > 128) continue;
    let l = a, h = 2;
    for (; i.has(l); ) l = `${Array.from(a).slice(0, 120).join("")} (${h++})`;
    i.add(l), e.push({ name: l, roster_entity: r.rosters[0], connectivity_entity: r.connectivity[0] });
  }
  return e;
}
function yt(n) {
  return typeof n == "object" && n !== null && !Array.isArray(n);
}
function ae(n, t) {
  return typeof n == "string" && Array.from(n).length <= t ? n : "";
}
class le extends S {
  constructor() {
    super(...arguments), this.rows = [], this.nextId = 0, this.feedback = "";
  }
  static {
    this.styles = $t`
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
  `;
  }
  set hass(t) {
    this.currentHass = t, this.requestUpdate();
  }
  get hass() {
    return this.currentHass;
  }
  setConfig(t) {
    const e = yt(t) && Array.isArray(t.hosts) ? t.hosts.slice(0, 64) : [], i = this.rows;
    this.rows = e.filter(yt).map((s, r) => {
      const o = i.find((l) => l.host.roster_entity === s.roster_entity && l.host.connectivity_entity === s.connectivity_entity), a = ae(s.name, 128);
      return { id: o?.id ?? (s.roster_entity ? void 0 : i[r]?.id) ?? this.nextId++, host: {
        // Config echoes must not replace focused controls or eat a space while a label is being typed.
        name: o && o.host.name.trim() === a ? o.host.name : a,
        roster_entity: typeof s.roster_entity == "string" && /^sensor\.[a-z0-9_]+$/.test(s.roster_entity) ? s.roster_entity : "",
        connectivity_entity: typeof s.connectivity_entity == "string" && /^binary_sensor\.[a-z0-9_]+$/.test(s.connectivity_entity) ? s.connectivity_entity : ""
      } };
    }), this.feedback = "", this.requestUpdate();
  }
  publish() {
    let t;
    try {
      t = Et({ type: "custom:ha-tty7-card", hosts: this.rows.map((e) => e.host) });
    } catch {
      this.feedback = "Choose a host pair and a unique, non-empty label for each row.", this.requestUpdate();
      return;
    }
    this.feedback = "", this.requestUpdate(), this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: t }, bubbles: !0, composed: !0 }));
  }
  selectHost(t, e) {
    t.stopPropagation();
    const i = this.rows.find((a) => a.id === e);
    if (!i) return;
    const s = T(this.currentHass).find((a) => a.roster_entity === t.detail.value);
    if (!s || this.rows.some((a) => a !== i && a.host.roster_entity === s.roster_entity)) return;
    const r = T(this.currentHass).find((a) => a.roster_entity === i.host.roster_entity), o = i.host.name && i.host.name !== r?.name;
    i.host = { ...s, name: o ? i.host.name : s.name }, this.publish();
  }
  labelChanged(t, e) {
    t.stopPropagation();
    const i = this.rows.find((s) => s.id === e);
    i && typeof t.detail.value == "string" && (i.host = { ...i.host, name: t.detail.value }, this.publish());
  }
  addRow() {
    if (this.rows.length >= 64) return;
    const t = { id: this.nextId++, host: { name: "", roster_entity: "", connectivity_entity: "" } };
    this.rows = [...this.rows, t], this.requestUpdate(), this.updateComplete.then(() => this.shadowRoot?.querySelector(`[data-row="${t.id}"] [data-field="host"]`)?.focus());
  }
  removeRow(t) {
    this.rows.some((e) => e.id === t) && (this.rows = this.rows.filter((e) => e.id !== t), this.publish(), this.updateComplete.then(() => this.shadowRoot?.querySelector('[data-action="add"]')?.focus()));
  }
  render() {
    const t = T(this.currentHass);
    return m`
      <p>Choose HA-tty7 hosts and dashboard labels. Only status is shown; pairing credentials stay in integration settings.</p>
      ${t.length ? u : m`<p role="status">No configured HA-tty7 host pairs are available. Add a host in
        <a href="/config/integrations">Settings · Devices & services</a>, then return to this editor.
        Saved entity pairs remain unchanged.</p>`}
      ${V(this.rows, (e) => e.id, (e, i) => {
      const r = t.filter((o) => o.roster_entity === e.host.roster_entity || !this.rows.some((a) => a !== e && a.host.roster_entity === o.roster_entity)).map((o) => ({ value: o.roster_entity, label: o.name }));
      return e.host.roster_entity && !r.some((o) => o.value === e.host.roster_entity) && r.push({ value: e.host.roster_entity, label: e.host.name || e.host.roster_entity }), m`<fieldset data-row=${e.id}>
          <legend>Host ${i + 1}</legend>
          <ha-selector data-field="host" .hass=${this.currentHass} .label=${`HA-tty7 host ${i + 1}`}
            .selector=${{ select: { options: r, mode: "dropdown", custom_value: !1 } }} .value=${e.host.roster_entity}
            @value-changed=${(o) => this.selectHost(o, e.id)}></ha-selector>
          <ha-selector data-field="name" .hass=${this.currentHass} .label=${`Dashboard label ${i + 1}`}
            .selector=${{ text: {} }} .value=${e.host.name}
            @value-changed=${(o) => this.labelChanged(o, e.id)}></ha-selector>
          ${e.host.roster_entity && e.host.connectivity_entity ? m`<p class="pair">Roster: ${e.host.roster_entity}<br>
            Connectivity: ${e.host.connectivity_entity}</p>` : u}
          <button type="button" data-action="remove" aria-label=${`Remove host ${i + 1}`} @click=${() => this.removeRow(e.id)}>Remove host</button>
        </fieldset>`;
    })}
      ${this.feedback ? m`<p class="feedback" role="alert">${this.feedback}</p>` : u}
      <button type="button" data-action="add" ?disabled=${this.rows.length >= 64} @click=${this.addRow}>Add host</button>
    `;
  }
}
document.querySelector("home-assistant") && await customElements.whenDefined("home-assistant");
customElements.get("ha-tty7-card-editor") || customElements.define("ha-tty7-card-editor", le);
const B = { working: "Working", waiting: "Waiting", done: "Done", idle: "Idle", unknown: "Unknown" }, de = {
  loading: "Loading",
  healthy: "Online",
  empty: "Online · empty",
  error: "Collector error",
  stale: "Stale",
  unconfirmed: "Unconfirmed",
  malformed: "Malformed data",
  disconnected: "Home Assistant disconnected",
  offline: "Offline"
}, mt = {
  loading: "Waiting for the configured Home Assistant entities.",
  empty: "No reported agents. The latest snapshot is healthy and empty.",
  error: "The collector reported a failure. Last-known roster; not live status.",
  stale: "No accepted contact for more than 45 seconds. Last-known roster; not live status.",
  unconfirmed: "Waiting for a fresh snapshot after startup. Last-known roster; not live status.",
  malformed: "Entity data does not match the status contract. Check the configured roster and package version.",
  disconnected: "The Home Assistant connection is down. Last-known roster; not live status.",
  offline: "Host connectivity is unavailable. Last-known roster; not live status."
}, ce = {
  cli_unavailable: "tty7 unavailable",
  cli_timeout: "tty7 read timed out",
  cli_failed: "tty7 read failed",
  invalid_payload: "Invalid status payload",
  payload_too_large: "Status payload too large"
};
class he extends S {
  constructor() {
    super(...arguments), this.configurationError = !1, this.selectedHost = "", this.expanded = /* @__PURE__ */ new Set();
  }
  static {
    this.styles = oe;
  }
  static async getConfigElement() {
    return !customElements.get("ha-selector") && window.loadCardHelpers && ((await window.loadCardHelpers()).createCardElement({ type: "entities", entities: [] }), await customElements.whenDefined("hui-entities-card"), await customElements.get("hui-entities-card").getConfigElement()), document.createElement("ha-tty7-card-editor");
  }
  static getStubConfig(t) {
    return { type: "custom:ha-tty7-card", hosts: T(t) };
  }
  setConfig(t) {
    try {
      this.config = Et(t), this.configurationError = !1, this.selectedHost = "", this.expanded.clear();
    } catch (e) {
      throw this.config = void 0, this.configurationError = !0, this.requestUpdate(), e;
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
  renderAgent(t, e) {
    const i = this.expanded.has(t.identity), s = `details-${Array.from(t.identity, (r) => r.codePointAt(0).toString(16)).join("-")}`;
    return m`<li class=${e ? "last-known" : ""}>
      <button class="agent-row" data-pane=${t.pane_id} aria-expanded=${String(i)} aria-controls=${s}
        aria-label=${`${t.agent}, pane ${t.pane_id}, ${B[t.status]}${e ? ", last known" : ""}. ${i ? "Hide" : "Show"} details`}
        @click=${() => this.toggleDetails(t.identity)}>
        <span class="agent-icon" aria-hidden="true">${Dt`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="5" width="12" height="11" rx="3"/><path d="M10 2v3M1 9h3m12 0h3M7 16v2m6-2v2"/><circle cx="7.5" cy="10" r=".75" fill="currentColor"/><circle cx="12.5" cy="10" r=".75" fill="currentColor"/><path d="M7 13h6"/></svg>`}</span>
        <span class="agent-copy"><span class="agent-name">${t.agent}</span>
          <span class="identity">Pane ${t.pane_id} · ${t.session_id ?? "Session unavailable"}</span></span>
        <span class="status" data-status=${t.status}><span class="dot" aria-hidden="true"></span>${B[t.status]}</span>
        <span class="chevron" aria-hidden="true">${i ? "⌄" : "›"}</span>
      </button>
      <dl id=${s} ?hidden=${!i}>
        ${i ? [
      ["Agent", t.agent],
      ["Status", B[t.status]],
      ["Pane", t.pane_id],
      ["Session", t.session_id],
      ["Activity (as reported)", t.activity],
      ["Turns (as reported)", t.turns],
      ["Model", t.model],
      ["Effort", t.effort],
      ["Permission mode (informational)", t.permission_mode]
    ].map(([r, o]) => m`<dt>${r}</dt><dd>${o ?? "Unavailable"}</dd>`) : u}
      </dl>
    </li>`;
  }
  renderHost(t) {
    return m`<section aria-label=${t.config.name}>
      <div class="host-head"><div class="host-title"><h2>${t.config.name}</h2>
        <span class="host-state" data-state=${t.state} role="status">${de[t.state]}</span></div>
        <p class="receipt">${t.lastContact === null ? "No confirmed receipt" : m`Last contact (HA): <time datetime=${t.lastContact}>${t.lastContact}</time>`}
          ${t.agents.length ? m` · ${t.agents.length} reported` : u}</p>
        ${t.lastKnown && t.lastSuccess !== null ? m`<p class="receipt">Last successful snapshot (HA): <time datetime=${t.lastSuccess}>${t.lastSuccess}</time></p>` : u}
      </div>
      ${mt[t.state] ? m`<p class="notice">${mt[t.state]}${t.errorCode ? m` ${ce[t.errorCode]}.` : u}</p>` : u}
      ${t.agents.length ? m`<ul>${V(t.agents, (e) => e.identity, (e) => this.renderAgent(e, t.lastKnown))}</ul>` : u}
    </section>`;
  }
  render() {
    if (!this.config) return m`<ha-card><p class="configuration"><strong>${this.configurationError ? "Configuration error" : "Not configured"}</strong><br>
      Configure unique host names, sensor rosters, and binary_sensor connectivity entities.</p></ha-card>`;
    if (!this.config.hosts.length) return m`<ha-card><p class="configuration"><strong>No hosts selected</strong><br>
      Add HA-tty7 in Settings · Devices & services, then choose hosts in this card's visual editor.</p></ha-card>`;
    const t = this.config.hosts.map((i) => re(
      i,
      this.currentHass?.states ?? {},
      this.currentHass?.connection?.connected ?? !0
    )), e = new Set(t.flatMap((i) => i.agents.map((s) => s.identity)));
    for (const i of this.expanded) e.has(i) || this.expanded.delete(i);
    return m`<ha-card>
      <header><div><h1><span class="brand">tty7</span> agents</h1><span class="subtitle">Read-only status</span></div>
        ${t.length > 1 ? m`<label>Show host<select aria-label="Show host" .value=${this.selectedHost}
          @change=${(i) => {
      this.selectedHost = i.target.value, this.requestUpdate();
    }}>
          <option value="">All hosts</option>${this.config.hosts.map((i) => m`<option value=${i.roster_entity}>${i.name}</option>`)}
        </select></label>` : u}
      </header>
      ${V(
      t.filter((i) => !this.selectedHost || i.config.roster_entity === this.selectedHost),
      (i) => i.config.roster_entity,
      (i) => this.renderHost(i)
    )}
    </ha-card>`;
  }
}
customElements.get("ha-tty7-card") || customElements.define("ha-tty7-card", he);
window.customCards ??= [];
window.customCards.some((n) => n.type === "ha-tty7-card") || window.customCards.push({ type: "ha-tty7-card", name: "HA-tty7", description: "Read-only structured tty7 agent status grouped by host.", preview: !0 });
export {
  he as HaTty7Card
};
