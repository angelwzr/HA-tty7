/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const L = globalThis, X = L.ShadowRoot && (L.ShadyCSS === void 0 || L.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, tt = Symbol(), nt = /* @__PURE__ */ new WeakMap();
let wt = class {
  constructor(t, e, n) {
    if (this._$cssResult$ = !0, n !== tt) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = e;
  }
  get styleSheet() {
    let t = this.o;
    const e = this.t;
    if (X && t === void 0) {
      const n = e !== void 0 && e.length === 1;
      n && (t = nt.get(e)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), n && nt.set(e, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const Pt = (i) => new wt(typeof i == "string" ? i : i + "", void 0, tt), At = (i, ...t) => {
  const e = i.length === 1 ? i[0] : t.reduce((n, s, r) => n + ((o) => {
    if (o._$cssResult$ === !0) return o.cssText;
    if (typeof o == "number") return o;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + o + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(s) + i[r + 1], i[0]);
  return new wt(e, i, tt);
}, Tt = (i, t) => {
  if (X) i.adoptedStyleSheets = t.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
  else for (const e of t) {
    const n = document.createElement("style"), s = L.litNonce;
    s !== void 0 && n.setAttribute("nonce", s), n.textContent = e.cssText, i.appendChild(n);
  }
}, rt = X ? (i) => i : (i) => i instanceof CSSStyleSheet ? ((t) => {
  let e = "";
  for (const n of t.cssRules) e += n.cssText;
  return Pt(e);
})(i) : i;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: Mt, defineProperty: Nt, getOwnPropertyDescriptor: Rt, getOwnPropertyNames: Dt, getOwnPropertySymbols: zt, getPrototypeOf: jt } = Object, W = globalThis, ot = W.trustedTypes, Lt = ot ? ot.emptyScript : "", It = W.reactiveElementPolyfillSupport, M = (i, t) => i, Y = { toAttribute(i, t) {
  switch (t) {
    case Boolean:
      i = i ? Lt : null;
      break;
    case Object:
    case Array:
      i = i == null ? i : JSON.stringify(i);
  }
  return i;
}, fromAttribute(i, t) {
  let e = i;
  switch (t) {
    case Boolean:
      e = i !== null;
      break;
    case Number:
      e = i === null ? null : Number(i);
      break;
    case Object:
    case Array:
      try {
        e = JSON.parse(i);
      } catch {
        e = null;
      }
  }
  return e;
} }, xt = (i, t) => !Mt(i, t), at = { attribute: !0, type: String, converter: Y, reflect: !1, useDefault: !1, hasChanged: xt };
Symbol.metadata ??= Symbol("metadata"), W.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let S = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ??= []).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, e = at) {
    if (e.state && (e.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((e = Object.create(e)).wrapped = !0), this.elementProperties.set(t, e), !e.noAccessor) {
      const n = Symbol(), s = this.getPropertyDescriptor(t, n, e);
      s !== void 0 && Nt(this.prototype, t, s);
    }
  }
  static getPropertyDescriptor(t, e, n) {
    const { get: s, set: r } = Rt(this.prototype, t) ?? { get() {
      return this[e];
    }, set(o) {
      this[e] = o;
    } };
    return { get: s, set(o) {
      const a = s?.call(this);
      r?.call(this, o), this.requestUpdate(t, a, n);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? at;
  }
  static _$Ei() {
    if (this.hasOwnProperty(M("elementProperties"))) return;
    const t = jt(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(M("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(M("properties"))) {
      const e = this.properties, n = [...Dt(e), ...zt(e)];
      for (const s of n) this.createProperty(s, e[s]);
    }
    const t = this[Symbol.metadata];
    if (t !== null) {
      const e = litPropertyMetadata.get(t);
      if (e !== void 0) for (const [n, s] of e) this.elementProperties.set(n, s);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [e, n] of this.elementProperties) {
      const s = this._$Eu(e, n);
      s !== void 0 && this._$Eh.set(s, e);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(t) {
    const e = [];
    if (Array.isArray(t)) {
      const n = new Set(t.flat(1 / 0).reverse());
      for (const s of n) e.unshift(rt(s));
    } else t !== void 0 && e.push(rt(t));
    return e;
  }
  static _$Eu(t, e) {
    const n = e.attribute;
    return n === !1 ? void 0 : typeof n == "string" ? n : typeof t == "string" ? t.toLowerCase() : void 0;
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
    for (const n of e.keys()) this.hasOwnProperty(n) && (t.set(n, this[n]), delete this[n]);
    t.size > 0 && (this._$Ep = t);
  }
  createRenderRoot() {
    const t = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return Tt(t, this.constructor.elementStyles), t;
  }
  connectedCallback() {
    this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((t) => t.hostConnected?.());
  }
  enableUpdating(t) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((t) => t.hostDisconnected?.());
  }
  attributeChangedCallback(t, e, n) {
    this._$AK(t, n);
  }
  _$ET(t, e) {
    const n = this.constructor.elementProperties.get(t), s = this.constructor._$Eu(t, n);
    if (s !== void 0 && n.reflect === !0) {
      const r = (n.converter?.toAttribute !== void 0 ? n.converter : Y).toAttribute(e, n.type);
      this._$Em = t, r == null ? this.removeAttribute(s) : this.setAttribute(s, r), this._$Em = null;
    }
  }
  _$AK(t, e) {
    const n = this.constructor, s = n._$Eh.get(t);
    if (s !== void 0 && this._$Em !== s) {
      const r = n.getPropertyOptions(s), o = typeof r.converter == "function" ? { fromAttribute: r.converter } : r.converter?.fromAttribute !== void 0 ? r.converter : Y;
      this._$Em = s;
      const a = o.fromAttribute(e, r.type);
      this[s] = a ?? this._$Ej?.get(s) ?? a, this._$Em = null;
    }
  }
  requestUpdate(t, e, n, s = !1, r) {
    if (t !== void 0) {
      const o = this.constructor;
      if (s === !1 && (r = this[t]), n ??= o.getPropertyOptions(t), !((n.hasChanged ?? xt)(r, e) || n.useDefault && n.reflect && r === this._$Ej?.get(t) && !this.hasAttribute(o._$Eu(t, n)))) return;
      this.C(t, e, n);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, e, { useDefault: n, reflect: s, wrapped: r }, o) {
    n && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t) && (this._$Ej.set(t, o ?? e ?? this[t]), r !== !0 || o !== void 0) || (this._$AL.has(t) || (this.hasUpdated || n || (e = void 0), this._$AL.set(t, e)), s === !0 && this._$Em !== t && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t));
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
      const n = this.constructor.elementProperties;
      if (n.size > 0) for (const [s, r] of n) {
        const { wrapped: o } = r, a = this[s];
        o !== !0 || this._$AL.has(s) || a === void 0 || this.C(s, void 0, r, a);
      }
    }
    let t = !1;
    const e = this._$AL;
    try {
      t = this.shouldUpdate(e), t ? (this.willUpdate(e), this._$EO?.forEach((n) => n.hostUpdate?.()), this.update(e)) : this._$EM();
    } catch (n) {
      throw t = !1, this._$EM(), n;
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
S.elementStyles = [], S.shadowRootOptions = { mode: "open" }, S[M("elementProperties")] = /* @__PURE__ */ new Map(), S[M("finalized")] = /* @__PURE__ */ new Map(), It?.({ ReactiveElement: S }), (W.reactiveElementVersions ??= []).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const et = globalThis, lt = (i) => i, q = et.trustedTypes, ct = q ? q.createPolicy("lit-html", { createHTML: (i) => i }) : void 0, St = "$lit$", $ = `lit$${Math.random().toFixed(9).slice(2)}$`, Ct = "?" + $, qt = `<${Ct}>`, A = document, N = () => A.createComment(""), R = (i) => i === null || typeof i != "object" && typeof i != "function", st = Array.isArray, Bt = (i) => st(i) || typeof i?.[Symbol.iterator] == "function", F = `[ 	
\f\r]`, O = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, dt = /-->/g, ht = />/g, b = RegExp(`>|${F}(?:([^\\s"'>=/]+)(${F}*=${F}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), pt = /'/g, ut = /"/g, Et = /^(?:script|style|textarea|title)$/i, kt = (i) => (t, ...e) => ({ _$litType$: i, strings: t, values: e }), m = kt(1), Wt = kt(2), x = Symbol.for("lit-noChange"), f = Symbol.for("lit-nothing"), ft = /* @__PURE__ */ new WeakMap(), w = A.createTreeWalker(A, 129);
function Ht(i, t) {
  if (!st(i) || !i.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return ct !== void 0 ? ct.createHTML(t) : t;
}
const Vt = (i, t) => {
  const e = i.length - 1, n = [];
  let s, r = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = O;
  for (let a = 0; a < e; a++) {
    const l = i[a];
    let h, p, c = -1, u = 0;
    for (; u < l.length && (o.lastIndex = u, p = o.exec(l), p !== null); ) u = o.lastIndex, o === O ? p[1] === "!--" ? o = dt : p[1] !== void 0 ? o = ht : p[2] !== void 0 ? (Et.test(p[2]) && (s = RegExp("</" + p[2], "g")), o = b) : p[3] !== void 0 && (o = b) : o === b ? p[0] === ">" ? (o = s ?? O, c = -1) : p[1] === void 0 ? c = -2 : (c = o.lastIndex - p[2].length, h = p[1], o = p[3] === void 0 ? b : p[3] === '"' ? ut : pt) : o === ut || o === pt ? o = b : o === dt || o === ht ? o = O : (o = b, s = void 0);
    const d = o === b && i[a + 1].startsWith("/>") ? " " : "";
    r += o === O ? l + qt : c >= 0 ? (n.push(h), l.slice(0, c) + St + l.slice(c) + $ + d) : l + $ + (c === -2 ? a : d);
  }
  return [Ht(i, r + (i[e] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), n];
};
class D {
  constructor({ strings: t, _$litType$: e }, n) {
    let s;
    this.parts = [];
    let r = 0, o = 0;
    const a = t.length - 1, l = this.parts, [h, p] = Vt(t, e);
    if (this.el = D.createElement(h, n), w.currentNode = this.el.content, e === 2 || e === 3) {
      const c = this.el.content.firstChild;
      c.replaceWith(...c.childNodes);
    }
    for (; (s = w.nextNode()) !== null && l.length < a; ) {
      if (s.nodeType === 1) {
        if (s.hasAttributes()) for (const c of s.getAttributeNames()) if (c.endsWith(St)) {
          const u = p[o++], d = s.getAttribute(c).split($), y = /([.?@])?(.*)/.exec(u);
          l.push({ type: 1, index: r, name: y[2], strings: d, ctor: y[1] === "." ? Ft : y[1] === "?" ? Kt : y[1] === "@" ? Jt : V }), s.removeAttribute(c);
        } else c.startsWith($) && (l.push({ type: 6, index: r }), s.removeAttribute(c));
        if (Et.test(s.tagName)) {
          const c = s.textContent.split($), u = c.length - 1;
          if (u > 0) {
            s.textContent = q ? q.emptyScript : "";
            for (let d = 0; d < u; d++) s.append(c[d], N()), w.nextNode(), l.push({ type: 2, index: ++r });
            s.append(c[u], N());
          }
        }
      } else if (s.nodeType === 8) if (s.data === Ct) l.push({ type: 2, index: r });
      else {
        let c = -1;
        for (; (c = s.data.indexOf($, c + 1)) !== -1; ) l.push({ type: 7, index: r }), c += $.length - 1;
      }
      r++;
    }
  }
  static createElement(t, e) {
    const n = A.createElement("template");
    return n.innerHTML = t, n;
  }
}
function E(i, t, e = i, n) {
  if (t === x) return t;
  let s = n !== void 0 ? e._$Co?.[n] : e._$Cl;
  const r = R(t) ? void 0 : t._$litDirective$;
  return s?.constructor !== r && (s?._$AO?.(!1), r === void 0 ? s = void 0 : (s = new r(i), s._$AT(i, e, n)), n !== void 0 ? (e._$Co ??= [])[n] = s : e._$Cl = s), s !== void 0 && (t = E(i, s._$AS(i, t.values), s, n)), t;
}
class Zt {
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
    const { el: { content: e }, parts: n } = this._$AD, s = (t?.creationScope ?? A).importNode(e, !0);
    w.currentNode = s;
    let r = w.nextNode(), o = 0, a = 0, l = n[0];
    for (; l !== void 0; ) {
      if (o === l.index) {
        let h;
        l.type === 2 ? h = new k(r, r.nextSibling, this, t) : l.type === 1 ? h = new l.ctor(r, l.name, l.strings, this, t) : l.type === 6 && (h = new Yt(r, this, t)), this._$AV.push(h), l = n[++a];
      }
      o !== l?.index && (r = w.nextNode(), o++);
    }
    return w.currentNode = A, s;
  }
  p(t) {
    let e = 0;
    for (const n of this._$AV) n !== void 0 && (n.strings !== void 0 ? (n._$AI(t, n, e), e += n.strings.length - 2) : n._$AI(t[e])), e++;
  }
}
class k {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t, e, n, s) {
    this.type = 2, this._$AH = f, this._$AN = void 0, this._$AA = t, this._$AB = e, this._$AM = n, this.options = s, this._$Cv = s?.isConnected ?? !0;
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
    t = E(this, t, e), R(t) ? t === f || t == null || t === "" ? (this._$AH !== f && this._$AR(), this._$AH = f) : t !== this._$AH && t !== x && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : Bt(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== f && R(this._$AH) ? this._$AA.nextSibling.data = t : this.T(A.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    const { values: e, _$litType$: n } = t, s = typeof n == "number" ? this._$AC(t) : (n.el === void 0 && (n.el = D.createElement(Ht(n.h, n.h[0]), this.options)), n);
    if (this._$AH?._$AD === s) this._$AH.p(e);
    else {
      const r = new Zt(s, this), o = r.u(this.options);
      r.p(e), this.T(o), this._$AH = r;
    }
  }
  _$AC(t) {
    let e = ft.get(t.strings);
    return e === void 0 && ft.set(t.strings, e = new D(t)), e;
  }
  k(t) {
    st(this._$AH) || (this._$AH = [], this._$AR());
    const e = this._$AH;
    let n, s = 0;
    for (const r of t) s === e.length ? e.push(n = new k(this.O(N()), this.O(N()), this, this.options)) : n = e[s], n._$AI(r), s++;
    s < e.length && (this._$AR(n && n._$AB.nextSibling, s), e.length = s);
  }
  _$AR(t = this._$AA.nextSibling, e) {
    for (this._$AP?.(!1, !0, e); t !== this._$AB; ) {
      const n = lt(t).nextSibling;
      lt(t).remove(), t = n;
    }
  }
  setConnected(t) {
    this._$AM === void 0 && (this._$Cv = t, this._$AP?.(t));
  }
}
class V {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, e, n, s, r) {
    this.type = 1, this._$AH = f, this._$AN = void 0, this.element = t, this.name = e, this._$AM = s, this.options = r, n.length > 2 || n[0] !== "" || n[1] !== "" ? (this._$AH = Array(n.length - 1).fill(new String()), this.strings = n) : this._$AH = f;
  }
  _$AI(t, e = this, n, s) {
    const r = this.strings;
    let o = !1;
    if (r === void 0) t = E(this, t, e, 0), o = !R(t) || t !== this._$AH && t !== x, o && (this._$AH = t);
    else {
      const a = t;
      let l, h;
      for (t = r[0], l = 0; l < r.length - 1; l++) h = E(this, a[n + l], e, l), h === x && (h = this._$AH[l]), o ||= !R(h) || h !== this._$AH[l], h === f ? t = f : t !== f && (t += (h ?? "") + r[l + 1]), this._$AH[l] = h;
    }
    o && !s && this.j(t);
  }
  j(t) {
    t === f ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class Ft extends V {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === f ? void 0 : t;
  }
}
class Kt extends V {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== f);
  }
}
class Jt extends V {
  constructor(t, e, n, s, r) {
    super(t, e, n, s, r), this.type = 5;
  }
  _$AI(t, e = this) {
    if ((t = E(this, t, e, 0) ?? f) === x) return;
    const n = this._$AH, s = t === f && n !== f || t.capture !== n.capture || t.once !== n.once || t.passive !== n.passive, r = t !== f && (n === f || s);
    s && this.element.removeEventListener(this.name, this, n), r && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class Yt {
  constructor(t, e, n) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = e, this.options = n;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    E(this, t);
  }
}
const Qt = { I: k }, Gt = et.litHtmlPolyfillSupport;
Gt?.(D, k), (et.litHtmlVersions ??= []).push("3.3.3");
const Xt = (i, t, e) => {
  const n = e?.renderBefore ?? t;
  let s = n._$litPart$;
  if (s === void 0) {
    const r = e?.renderBefore ?? null;
    n._$litPart$ = s = new k(t.insertBefore(N(), r), r, void 0, e ?? {});
  }
  return s._$AI(i), s;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const it = globalThis;
let C = class extends S {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t.firstChild, t;
  }
  update(t) {
    const e = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = Xt(e, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return x;
  }
};
C._$litElement$ = !0, C.finalized = !0, it.litElementHydrateSupport?.({ LitElement: C });
const te = it.litElementPolyfillSupport;
te?.({ LitElement: C });
(it.litElementVersions ??= []).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const ee = { CHILD: 2 }, se = (i) => (...t) => ({ _$litDirective$: i, values: t });
let ie = class {
  constructor(t) {
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AT(t, e, n) {
    this._$Ct = t, this._$AM = e, this._$Ci = n;
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
const { I: ne } = Qt, yt = (i) => i, mt = () => document.createComment(""), U = (i, t, e) => {
  const n = i._$AA.parentNode, s = t === void 0 ? i._$AB : t._$AA;
  if (e === void 0) {
    const r = n.insertBefore(mt(), s), o = n.insertBefore(mt(), s);
    e = new ne(r, o, i, i.options);
  } else {
    const r = e._$AB.nextSibling, o = e._$AM, a = o !== i;
    if (a) {
      let l;
      e._$AQ?.(i), e._$AM = i, e._$AP !== void 0 && (l = i._$AU) !== o._$AU && e._$AP(l);
    }
    if (r !== s || a) {
      let l = e._$AA;
      for (; l !== r; ) {
        const h = yt(l).nextSibling;
        yt(n).insertBefore(l, s), l = h;
      }
    }
  }
  return e;
}, v = (i, t, e = i) => (i._$AI(t, e), i), re = {}, oe = (i, t = re) => i._$AH = t, ae = (i) => i._$AH, K = (i) => {
  i._$AR(), i._$AA.remove();
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const gt = (i, t, e) => {
  const n = /* @__PURE__ */ new Map();
  for (let s = t; s <= e; s++) n.set(i[s], s);
  return n;
}, Q = se(class extends ie {
  constructor(i) {
    if (super(i), i.type !== ee.CHILD) throw Error("repeat() can only be used in text expressions");
  }
  dt(i, t, e) {
    let n;
    e === void 0 ? e = t : t !== void 0 && (n = t);
    const s = [], r = [];
    let o = 0;
    for (const a of i) s[o] = n ? n(a, o) : o, r[o] = e(a, o), o++;
    return { values: r, keys: s };
  }
  render(i, t, e) {
    return this.dt(i, t, e).values;
  }
  update(i, [t, e, n]) {
    const s = ae(i), { values: r, keys: o } = this.dt(t, e, n);
    if (!Array.isArray(s)) return this.ut = o, r;
    const a = this.ut ??= [], l = [];
    let h, p, c = 0, u = s.length - 1, d = 0, y = r.length - 1;
    for (; c <= u && d <= y; ) if (s[c] === null) c++;
    else if (s[u] === null) u--;
    else if (a[c] === o[d]) l[d] = v(s[c], r[d]), c++, d++;
    else if (a[u] === o[y]) l[y] = v(s[u], r[y]), u--, y--;
    else if (a[c] === o[y]) l[y] = v(s[c], r[y]), U(i, l[y + 1], s[c]), c++, y--;
    else if (a[u] === o[d]) l[d] = v(s[u], r[d]), U(i, s[c], s[u]), u--, d++;
    else if (h === void 0 && (h = gt(o, d, y), p = gt(a, c, u)), h.has(a[c])) if (h.has(a[u])) {
      const g = p.get(o[d]), H = g !== void 0 ? s[g] : null;
      if (H === null) {
        const Z = U(i, s[c]);
        v(Z, r[d]), l[d] = Z;
      } else l[d] = v(H, r[d]), U(i, s[c], H), s[g] = null;
      d++;
    } else K(s[u]), u--;
    else K(s[c]), c++;
    for (; d <= y; ) {
      const g = U(i, l[y + 1]);
      v(g, r[d]), l[d++] = g;
    }
    for (; c <= u; ) {
      const g = s[c++];
      g !== null && K(g);
    }
    return this.ut = o, oe(i, l), x;
  }
}), Ot = ["idle", "working", "waiting", "done", "unknown"], le = ["cli_unavailable", "cli_timeout", "cli_failed", "invalid_payload", "payload_too_large"];
function z(i) {
  return typeof i == "object" && i !== null && !Array.isArray(i);
}
function B(i, t) {
  if (typeof i != "string" || i.length === 0) return !1;
  let e = 0;
  for (let n = 0; n < i.length; n++) {
    const s = i.charCodeAt(n);
    if (s >= 55296 && s <= 56319) {
      const r = i.charCodeAt(++n);
      if (!(r >= 56320 && r <= 57343)) return !1;
    } else if (s >= 56320 && s <= 57343) return !1;
    if (++e > t) return !1;
  }
  return !0;
}
function G(i) {
  return typeof i == "number" && Number.isSafeInteger(i) && i >= 0;
}
function Ut(i) {
  const t = () => {
    throw new Error("Configure unique host names, sensor rosters, and binary_sensor connectivity entities.");
  };
  if (!z(i) || i.type !== "custom:ha-tty7-card" || !Array.isArray(i.hosts) || i.hosts.length > 64 || Object.keys(i).some((r) => !["type", "hosts", "title", "appearance"].includes(r)) || Object.hasOwn(i, "title") && (!B(i.title, 128) || !i.title.trim()) || Object.hasOwn(i, "appearance") && !["tty7", "home-assistant"].includes(i.appearance)) return t();
  const e = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set(), s = [];
  for (const r of i.hosts) {
    if (!z(r) || Object.keys(r).some((o) => !["name", "roster_entity", "connectivity_entity"].includes(o)) || !B(r.name, 128) || !r.name.trim() || typeof r.roster_entity != "string" || typeof r.connectivity_entity != "string" || !/^sensor\.[a-z0-9_]+$/.test(r.roster_entity) || !/^binary_sensor\.[a-z0-9_]+$/.test(r.connectivity_entity) || e.has(r.name.trim()) || n.has(r.roster_entity) || n.has(r.connectivity_entity)) return t();
    e.add(r.name.trim()), n.add(r.roster_entity), n.add(r.connectivity_entity), s.push({ name: r.name.trim(), roster_entity: r.roster_entity, connectivity_entity: r.connectivity_entity });
  }
  return {
    type: "custom:ha-tty7-card",
    hosts: s,
    ...Object.hasOwn(i, "title") ? { title: i.title.trim() } : {},
    ...Object.hasOwn(i, "appearance") ? { appearance: i.appearance } : {}
  };
}
function ce(i) {
  if (!z(i) || !G(i.pane_id) || i.pane_id === 0 || !B(i.agent, 64) || Object.hasOwn(i, "inferred") && typeof i.inferred != "boolean") return null;
  for (const t of ["session_id", "model", "effort", "permission_mode"])
    if (i[t] !== void 0 && i[t] !== null && !B(i[t], 128)) return null;
  for (const t of ["activity", "turns"])
    if (i[t] !== void 0 && i[t] !== null && !G(i[t])) return null;
  return {
    pane_id: i.pane_id,
    agent: i.agent,
    session_id: i.session_id ?? null,
    status: Ot.includes(i.status) ? i.status : "unknown",
    ...i.inferred === !0 ? { inferred: !0 } : {},
    activity: i.activity ?? null,
    turns: i.turns ?? null,
    model: i.model ?? null,
    effort: i.effort ?? null,
    permission_mode: i.permission_mode ?? null
  };
}
function $t(i) {
  return i === null ? null : typeof i != "string" || i.length > 64 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(i) ? NaN : Date.parse(i);
}
function de(i, t, e) {
  const n = { idle: 0, working: 0, waiting: 0, done: 0, unknown: 0 }, s = {
    config: i,
    state: e ? "loading" : "disconnected",
    agents: [],
    counts: n,
    lastContact: null,
    lastSuccess: null,
    errorCode: null,
    lastKnown: !0
  }, r = t[i.roster_entity], o = t[i.connectivity_entity];
  if (!r || !o || (s.state = e ? "malformed" : "disconnected", !z(r.attributes))) return s;
  const a = r.attributes;
  if (a.schema_version !== 1 || !Array.isArray(a.agents) || a.agents.length > 256 || typeof a.collector_ok != "boolean" || typeof a.baseline_ready != "boolean" || !z(a.counts) || !Object.hasOwn(a, "error_code") || !Object.hasOwn(a, "last_contact") || !Object.hasOwn(a, "last_success")) return s;
  const l = $t(a.last_contact), h = $t(a.last_success);
  if (l !== null && !Number.isFinite(l) || h !== null && !Number.isFinite(h) || l !== null && h !== null && h > l || a.baseline_ready && (l === null || h === null) || a.error_code !== null && !le.includes(a.error_code) || a.collector_ok && a.error_code !== null || !a.collector_ok && a.baseline_ready) return s;
  const p = [], c = /* @__PURE__ */ new Set();
  for (const d of a.agents) {
    const y = ce(d);
    if (!y || c.has(y.pane_id)) return s;
    c.add(y.pane_id), p.push(y), n[y.status] += 1;
  }
  const u = a.counts;
  return Ot.some((d) => !G(u[d]) || u[d] !== n[d]) || (s.agents = p.map((d) => ({ ...d, identity: JSON.stringify([i.roster_entity, d.session_id, d.pane_id]) })), s.lastContact = a.last_contact, s.lastSuccess = a.last_success, s.errorCode = a.error_code, e ? ["unavailable", "unknown"].includes(r.state) || ["unavailable", "unknown"].includes(o.state) ? s.state = "offline" : r.state === "error" ? s.state = s.errorCode === null ? "malformed" : "error" : r.state === "stale" ? s.state = "stale" : r.state === "unconfirmed" ? s.state = "unconfirmed" : s.errorCode !== null || r.state !== String(p.length) ? s.state = "malformed" : !a.collector_ok || !a.baseline_ready || l === null || h === null || o.state === "off" ? s.state = "offline" : o.state !== "on" ? s.state = "malformed" : s.state = p.length === 0 ? "empty" : "healthy" : s.state = "disconnected", s.lastKnown = !["healthy", "empty"].includes(s.state)), s;
}
const he = At`
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
  @media (max-width: 380px) {
    header { padding: 10px; gap: 8px; }
    .host-head { padding: 10px; }
    .agent-row { gap: 6px; grid-template-columns: 24px minmax(0, 1fr) auto 10px; }
    dl { padding: 10px; gap: 8px; }
  }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
`, P = new Intl.DateTimeFormat().resolvedOptions().timeZone, J = P && (P === "UTC" || P === "Etc/UTC" || P.includes("/")) ? P : void 0;
let T;
function _t(i, t) {
  const e = t?.locale?.language, n = t?.locale?.date_format ?? "system", s = t?.locale?.time_format ?? "system", r = t?.config?.time_zone ?? J ?? "UTC", o = t?.locale?.time_zone === "local" && J ? J : r, a = `${e}|${n}|${s}|${o}`;
  if (T?.key !== a) {
    const p = s === "12" || s !== "24" && new Intl.DateTimeFormat(s === "language" ? e : void 0, { hour: "numeric" }).resolvedOptions().hour12 === !0;
    T = {
      key: a,
      date: new Intl.DateTimeFormat(n === "system" ? void 0 : e, {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        timeZone: o
      }),
      time: new Intl.DateTimeFormat(e, {
        hour: "numeric",
        minute: "2-digit",
        hourCycle: p ? "h12" : "h23",
        timeZone: o
      })
    };
  }
  const l = new Date(i);
  let h;
  if (n === "language" || n === "system")
    h = T.date.format(l);
  else {
    const p = T.date.formatToParts(l), c = p.find((_) => _.type === "day").value, u = p.find((_) => _.type === "month").value, d = p.find((_) => _.type === "year").value, y = p.find((_) => _.type === "literal")?.value ?? "", g = p.at(-1), H = g?.type === "literal" && !(e === "bg" && n === "YMD") ? g.value : "";
    h = (n === "DMY" ? [c, u, d] : n === "MDY" ? [u, c, d] : [d, u, c]).join(y) + H;
  }
  return `${h}, ${T.time.format(l)}`;
}
function I(i) {
  if (!i?.entities || !i.devices) return [];
  const t = /* @__PURE__ */ new Map();
  for (const s of Object.values(i.entities)) {
    if (s.platform !== "ha_tty7" || !s.device_id || s.hidden) continue;
    const r = i.devices[s.device_id];
    if (!r || r.disabled_by || !r.config_entries.length || !r.identifiers.some(([a, l]) => a === "ha_tty7" && l.length > 0)) continue;
    const o = t.get(r.id) ?? { rosters: [], connectivity: [] };
    if (/^sensor\.[a-z0-9_]+$/.test(s.entity_id)) o.rosters.push(s.entity_id);
    else if (/^binary_sensor\.[a-z0-9_]+$/.test(s.entity_id)) o.connectivity.push(s.entity_id);
    else continue;
    t.set(r.id, o);
  }
  const e = [], n = /* @__PURE__ */ new Set();
  for (const [s, r] of t) {
    if (r.rosters.length !== 1 || r.connectivity.length !== 1 || e.length === 64) continue;
    const o = i.devices[s], a = (o.name_by_user || o.name)?.trim();
    if (!a || Array.from(a).length > 128) continue;
    let l = a, h = 2;
    for (; n.has(l); ) l = `${Array.from(a).slice(0, 120).join("")} (${h++})`;
    n.add(l), e.push({ name: l, roster_entity: r.rosters[0], connectivity_entity: r.connectivity[0] });
  }
  return e;
}
function j(i) {
  return typeof i == "object" && i !== null && !Array.isArray(i);
}
function bt(i, t) {
  return typeof i == "string" && Array.from(i).length <= t ? i : "";
}
class pe extends C {
  constructor() {
    super(...arguments), this.rows = [], this.nextId = 0, this.feedback = "", this.cardTitle = "";
  }
  static {
    this.styles = At`
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
    const e = j(t) && Array.isArray(t.hosts) ? t.hosts.slice(0, 64) : [], n = j(t) ? bt(t.title, 128) : "";
    this.cardTitle = this.cardTitle.trim() === n ? this.cardTitle : n, this.appearance = j(t) && (t.appearance === "tty7" || t.appearance === "home-assistant") ? t.appearance : void 0;
    const s = this.rows;
    this.rows = e.filter(j).map((r, o) => {
      const a = s.find((h) => h.host.roster_entity === r.roster_entity && h.host.connectivity_entity === r.connectivity_entity), l = bt(r.name, 128);
      return { id: a?.id ?? (r.roster_entity ? void 0 : s[o]?.id) ?? this.nextId++, host: {
        // Config echoes must not replace focused controls or eat a space while a label is being typed.
        name: a && a.host.name.trim() === l ? a.host.name : l,
        roster_entity: typeof r.roster_entity == "string" && /^sensor\.[a-z0-9_]+$/.test(r.roster_entity) ? r.roster_entity : "",
        connectivity_entity: typeof r.connectivity_entity == "string" && /^binary_sensor\.[a-z0-9_]+$/.test(r.connectivity_entity) ? r.connectivity_entity : ""
      } };
    }), this.feedback = "", this.requestUpdate();
  }
  publish() {
    let t;
    try {
      t = Ut({
        type: "custom:ha-tty7-card",
        hosts: this.rows.map((e) => e.host),
        ...this.cardTitle.trim() ? { title: this.cardTitle } : {},
        ...this.appearance ? { appearance: this.appearance } : {}
      });
    } catch {
      this.feedback = "Use a title of at most 128 characters and choose a host pair with a unique, non-empty label for each row.", this.requestUpdate();
      return;
    }
    this.feedback = "", this.requestUpdate(), this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: t }, bubbles: !0, composed: !0 }));
  }
  selectHost(t, e) {
    t.stopPropagation();
    const n = this.rows.find((a) => a.id === e);
    if (!n) return;
    const s = I(this.currentHass).find((a) => a.roster_entity === t.detail.value);
    if (!s || this.rows.some((a) => a !== n && a.host.roster_entity === s.roster_entity)) return;
    const r = I(this.currentHass).find((a) => a.roster_entity === n.host.roster_entity), o = n.host.name && n.host.name !== r?.name;
    n.host = { ...s, name: o ? n.host.name : s.name }, this.publish();
  }
  labelChanged(t, e) {
    t.stopPropagation();
    const n = this.rows.find((s) => s.id === e);
    n && typeof t.detail.value == "string" && (n.host = { ...n.host, name: t.detail.value }, this.publish());
  }
  titleChanged(t) {
    t.stopPropagation(), typeof t.detail.value == "string" && (this.cardTitle = t.detail.value, this.publish());
  }
  appearanceChanged(t) {
    t.stopPropagation(), !(t.detail.value !== "tty7" && t.detail.value !== "home-assistant") && (this.appearance = t.detail.value, this.publish());
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
    const t = I(this.currentHass);
    return m`
      <p>Choose HA-tty7 hosts and dashboard labels. Only status is shown; pairing credentials stay in integration settings.</p>
      <ha-selector data-field="title" .hass=${this.currentHass} .label=${"Card title (default: tty7 agents)"}
        .selector=${{ text: {} }} .value=${this.cardTitle}
        @value-changed=${this.titleChanged}></ha-selector>
      <ha-selector data-field="appearance" .hass=${this.currentHass} .label=${"Appearance"}
        .selector=${{ select: {
      options: [{ value: "tty7", label: "tty7" }, { value: "home-assistant", label: "Home Assistant" }],
      mode: "dropdown",
      custom_value: !1
    } }} .value=${this.appearance ?? "tty7"}
        @value-changed=${this.appearanceChanged}></ha-selector>
      ${t.length ? f : m`<p role="status">No configured HA-tty7 host pairs are available. Add a host in
        <a href="/config/integrations">Settings · Devices & services</a>, then return to this editor.
        Saved entity pairs remain unchanged.</p>`}
      ${Q(this.rows, (e) => e.id, (e, n) => {
      const r = t.filter((o) => o.roster_entity === e.host.roster_entity || !this.rows.some((a) => a !== e && a.host.roster_entity === o.roster_entity)).map((o) => ({ value: o.roster_entity, label: o.name }));
      return e.host.roster_entity && !r.some((o) => o.value === e.host.roster_entity) && r.push({ value: e.host.roster_entity, label: e.host.name || e.host.roster_entity }), m`<fieldset data-row=${e.id}>
          <legend>Host ${n + 1}</legend>
          <ha-selector data-field="host" .hass=${this.currentHass} .label=${`HA-tty7 host ${n + 1}`}
            .selector=${{ select: { options: r, mode: "dropdown", custom_value: !1 } }} .value=${e.host.roster_entity}
            @value-changed=${(o) => this.selectHost(o, e.id)}></ha-selector>
          <ha-selector data-field="name" .hass=${this.currentHass} .label=${`Dashboard label ${n + 1}`}
            .selector=${{ text: {} }} .value=${e.host.name}
            @value-changed=${(o) => this.labelChanged(o, e.id)}></ha-selector>
          ${e.host.roster_entity && e.host.connectivity_entity ? m`<p class="pair">Roster: ${e.host.roster_entity}<br>
            Connectivity: ${e.host.connectivity_entity}</p>` : f}
          <button type="button" data-action="remove" aria-label=${`Remove host ${n + 1}`} @click=${() => this.removeRow(e.id)}>Remove host</button>
        </fieldset>`;
    })}
      ${this.feedback ? m`<p class="feedback" role="alert">${this.feedback}</p>` : f}
      <button type="button" data-action="add" ?disabled=${this.rows.length >= 64} @click=${this.addRow}>Add host</button>
    `;
  }
}
document.querySelector("home-assistant") && await customElements.whenDefined("home-assistant");
customElements.get("ha-tty7-card-editor") || customElements.define("ha-tty7-card-editor", pe);
const ue = { working: "Working", waiting: "Waiting", done: "Done", idle: "Idle", unknown: "Unknown" }, fe = {
  loading: "Loading",
  healthy: "Online",
  empty: "Online · empty",
  error: "Collector error",
  stale: "Stale",
  unconfirmed: "Unconfirmed",
  malformed: "Malformed data",
  disconnected: "Home Assistant disconnected",
  offline: "Offline"
}, vt = {
  loading: "Waiting for the configured Home Assistant entities.",
  empty: "No reported agents. The latest snapshot is healthy and empty.",
  error: "The collector reported a failure. Last-known roster; not live status.",
  stale: "No accepted contact for more than 45 seconds. Last-known roster; not live status.",
  unconfirmed: "Waiting for a fresh snapshot after startup. Last-known roster; not live status.",
  malformed: "Entity data does not match the status contract. Check the configured roster and package version.",
  disconnected: "The Home Assistant connection is down. Last-known roster; not live status.",
  offline: "Host connectivity is unavailable. Last-known roster; not live status."
}, ye = {
  cli_unavailable: "tty7 unavailable",
  cli_timeout: "tty7 read timed out",
  cli_failed: "tty7 read failed",
  invalid_payload: "Invalid status payload",
  payload_too_large: "Status payload too large"
};
class me extends C {
  constructor() {
    super(...arguments), this.configurationError = !1, this.selectedHost = "", this.expanded = /* @__PURE__ */ new Set();
  }
  static {
    this.styles = he;
  }
  static async getConfigElement() {
    return !customElements.get("ha-selector") && window.loadCardHelpers && ((await window.loadCardHelpers()).createCardElement({ type: "entities", entities: [] }), await customElements.whenDefined("hui-entities-card"), await customElements.get("hui-entities-card").getConfigElement()), document.createElement("ha-tty7-card-editor");
  }
  static getStubConfig(t) {
    return { type: "custom:ha-tty7-card", hosts: I(t) };
  }
  setConfig(t) {
    try {
      this.config = Ut(t), this.configurationError = !1, this.setAttribute("appearance", this.config.appearance ?? "tty7"), this.selectedHost = "", this.expanded.clear();
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
    const n = this.expanded.has(t.identity), s = `${ue[t.status]}${t.inferred === !0 ? " (inferred)" : ""}`, r = `details-${Array.from(t.identity, (o) => o.codePointAt(0).toString(16)).join("-")}`;
    return m`<li class=${e ? "last-known" : ""}>
      <button class="agent-row" data-pane=${t.pane_id} aria-expanded=${String(n)} aria-controls=${r}
        aria-label=${`${t.agent}, pane ${t.pane_id}, ${s}${e ? ", last known" : ""}. ${n ? "Hide" : "Show"} details`}
        @click=${() => this.toggleDetails(t.identity)}>
        <span class="agent-icon" aria-hidden="true">${Wt`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="5" width="12" height="11" rx="3"/><path d="M10 2v3M1 9h3m12 0h3M7 16v2m6-2v2"/><circle cx="7.5" cy="10" r=".75" fill="currentColor"/><circle cx="12.5" cy="10" r=".75" fill="currentColor"/><path d="M7 13h6"/></svg>`}</span>
        <span class="agent-copy"><span class="agent-name">${t.agent}</span>
          <span class="identity">Pane ${t.pane_id} · ${t.session_id ?? "Session unavailable"}</span></span>
        <span class="status" data-status=${t.status}><span class="dot" aria-hidden="true"></span>${s}</span>
        <span class="chevron" aria-hidden="true">${n ? "⌄" : "›"}</span>
      </button>
      <dl id=${r} ?hidden=${!n}>
        ${n ? [
      ["Agent", t.agent],
      ["Status", s],
      ["Pane", t.pane_id],
      ["Session", t.session_id],
      ["Activity (as reported)", t.activity],
      ["Turns (as reported)", t.turns],
      ["Model", t.model],
      ["Effort", t.effort],
      ["Permission mode (informational)", t.permission_mode]
    ].map(([o, a]) => m`<dt>${o}</dt><dd>${a ?? "Unavailable"}</dd>`) : f}
      </dl>
    </li>`;
  }
  renderHost(t) {
    return m`<section aria-label=${t.config.name}>
      <div class="host-head"><div class="host-title"><h2>${t.config.name}</h2>
        <span class="host-state" data-state=${t.state} role="status">${fe[t.state]}</span></div>
        <p class="receipt">${t.lastContact === null ? "No confirmed receipt" : m`Last contact (HA): <time datetime=${t.lastContact}>${_t(t.lastContact, this.currentHass)}</time>`}
          ${t.agents.length ? m` · ${t.agents.length} reported` : f}</p>
        ${t.lastKnown && t.lastSuccess !== null ? m`<p class="receipt">Last successful snapshot (HA): <time datetime=${t.lastSuccess}>${_t(t.lastSuccess, this.currentHass)}</time></p>` : f}
      </div>
      ${vt[t.state] ? m`<p class="notice">${vt[t.state]}${t.errorCode ? m` ${ye[t.errorCode]}.` : f}</p>` : f}
      ${t.agents.length ? m`<ul>${Q(t.agents, (e) => e.identity, (e) => this.renderAgent(e, t.lastKnown))}</ul>` : f}
    </section>`;
  }
  render() {
    if (!this.config) return m`<ha-card><p class="configuration"><strong>${this.configurationError ? "Configuration error" : "Not configured"}</strong><br>
      Configure unique host names, sensor rosters, and binary_sensor connectivity entities.</p></ha-card>`;
    if (!this.config.hosts.length) return m`<ha-card><p class="configuration"><strong>No hosts selected</strong><br>
      Add HA-tty7 in Settings · Devices & services, then choose hosts in this card's visual editor.</p></ha-card>`;
    const t = this.config.hosts.map((s) => de(
      s,
      this.currentHass?.states ?? {},
      this.currentHass?.connection?.connected ?? !0
    )), e = new Set(t.flatMap((s) => s.agents.map((r) => r.identity)));
    for (const s of this.expanded) e.has(s) || this.expanded.delete(s);
    const n = this.config.appearance === "home-assistant";
    return m`<ha-card .header=${n ? this.config.title ?? "tty7 agents" : void 0}>
      ${!n || t.length > 1 ? m`<header>
        ${n ? f : m`<h1>${this.config.title ?? m`<span class="brand">tty7</span> agents`}</h1>`}
        ${t.length > 1 ? m`<label>Show host<select aria-label="Show host" .value=${this.selectedHost}
          @change=${(s) => {
      this.selectedHost = s.target.value, this.requestUpdate();
    }}>
          <option value="">All hosts</option>${this.config.hosts.map((s) => m`<option value=${s.roster_entity}>${s.name}</option>`)}
        </select></label>` : f}
      </header>` : f}
      ${Q(
      t.filter((s) => !this.selectedHost || s.config.roster_entity === this.selectedHost),
      (s) => s.config.roster_entity,
      (s) => this.renderHost(s)
    )}
    </ha-card>`;
  }
}
customElements.get("ha-tty7-card") || customElements.define("ha-tty7-card", me);
window.customCards ??= [];
window.customCards.some((i) => i.type === "ha-tty7-card") || window.customCards.push({ type: "ha-tty7-card", name: "HA-tty7", description: "Read-only structured tty7 agent status grouped by host.", preview: !0 });
export {
  me as HaTty7Card
};
