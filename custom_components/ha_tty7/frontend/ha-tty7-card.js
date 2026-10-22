/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const X = globalThis, ut = X.ShadowRoot && (X.ShadyCSS === void 0 || X.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, _t = Symbol(), gt = /* @__PURE__ */ new WeakMap();
let Mt = class {
  constructor(t, s, i) {
    if (this._$cssResult$ = !0, i !== _t) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = s;
  }
  get styleSheet() {
    let t = this.o;
    const s = this.t;
    if (ut && t === void 0) {
      const i = s !== void 0 && s.length === 1;
      i && (t = gt.get(s)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), i && gt.set(s, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const Jt = (e) => new Mt(typeof e == "string" ? e : e + "", void 0, _t), Rt = (e, ...t) => {
  const s = e.length === 1 ? e[0] : t.reduce((i, n, o) => i + ((r) => {
    if (r._$cssResult$ === !0) return r.cssText;
    if (typeof r == "number") return r;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + r + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(n) + e[o + 1], e[0]);
  return new Mt(s, e, _t);
}, Yt = (e, t) => {
  if (ut) e.adoptedStyleSheets = t.map((s) => s instanceof CSSStyleSheet ? s : s.styleSheet);
  else for (const s of t) {
    const i = document.createElement("style"), n = X.litNonce;
    n !== void 0 && i.setAttribute("nonce", n), i.textContent = s.cssText, e.appendChild(i);
  }
}, $t = ut ? (e) => e : (e) => e instanceof CSSStyleSheet ? ((t) => {
  let s = "";
  for (const i of t.cssRules) s += i.cssText;
  return Jt(s);
})(e) : e;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: Gt, defineProperty: Qt, getOwnPropertyDescriptor: Xt, getOwnPropertyNames: te, getOwnPropertySymbols: ee, getPrototypeOf: se } = Object, rt = globalThis, bt = rt.trustedTypes, ne = bt ? bt.emptyScript : "", ie = rt.reactiveElementPolyfillSupport, q = (e, t) => e, pt = { toAttribute(e, t) {
  switch (t) {
    case Boolean:
      e = e ? ne : null;
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
} }, It = (e, t) => !Gt(e, t), wt = { attribute: !0, type: String, converter: pt, reflect: !1, useDefault: !1, hasChanged: It };
Symbol.metadata ??= Symbol("metadata"), rt.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let E = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ??= []).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, s = wt) {
    if (s.state && (s.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((s = Object.create(s)).wrapped = !0), this.elementProperties.set(t, s), !s.noAccessor) {
      const i = Symbol(), n = this.getPropertyDescriptor(t, i, s);
      n !== void 0 && Qt(this.prototype, t, n);
    }
  }
  static getPropertyDescriptor(t, s, i) {
    const { get: n, set: o } = Xt(this.prototype, t) ?? { get() {
      return this[s];
    }, set(r) {
      this[s] = r;
    } };
    return { get: n, set(r) {
      const a = n?.call(this);
      o?.call(this, r), this.requestUpdate(t, a, i);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? wt;
  }
  static _$Ei() {
    if (this.hasOwnProperty(q("elementProperties"))) return;
    const t = se(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(q("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(q("properties"))) {
      const s = this.properties, i = [...te(s), ...ee(s)];
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
      for (const n of i) s.unshift($t(n));
    } else t !== void 0 && s.push($t(t));
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
    return Yt(t, this.constructor.elementStyles), t;
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
      const o = (i.converter?.toAttribute !== void 0 ? i.converter : pt).toAttribute(s, i.type);
      this._$Em = t, o == null ? this.removeAttribute(n) : this.setAttribute(n, o), this._$Em = null;
    }
  }
  _$AK(t, s) {
    const i = this.constructor, n = i._$Eh.get(t);
    if (n !== void 0 && this._$Em !== n) {
      const o = i.getPropertyOptions(n), r = typeof o.converter == "function" ? { fromAttribute: o.converter } : o.converter?.fromAttribute !== void 0 ? o.converter : pt;
      this._$Em = n;
      const a = r.fromAttribute(s, o.type);
      this[n] = a ?? this._$Ej?.get(n) ?? a, this._$Em = null;
    }
  }
  requestUpdate(t, s, i, n = !1, o) {
    if (t !== void 0) {
      const r = this.constructor;
      if (n === !1 && (o = this[t]), i ??= r.getPropertyOptions(t), !((i.hasChanged ?? It)(o, s) || i.useDefault && i.reflect && o === this._$Ej?.get(t) && !this.hasAttribute(r._$Eu(t, i)))) return;
      this.C(t, s, i);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, s, { useDefault: i, reflect: n, wrapped: o }, r) {
    i && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t) && (this._$Ej.set(t, r ?? s ?? this[t]), o !== !0 || r !== void 0) || (this._$AL.has(t) || (this.hasUpdated || i || (s = void 0), this._$AL.set(t, s)), n === !0 && this._$Em !== t && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t));
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
        for (const [n, o] of this._$Ep) this[n] = o;
        this._$Ep = void 0;
      }
      const i = this.constructor.elementProperties;
      if (i.size > 0) for (const [n, o] of i) {
        const { wrapped: r } = o, a = this[n];
        r !== !0 || this._$AL.has(n) || a === void 0 || this.C(n, void 0, o, a);
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
E.elementStyles = [], E.shadowRootOptions = { mode: "open" }, E[q("elementProperties")] = /* @__PURE__ */ new Map(), E[q("finalized")] = /* @__PURE__ */ new Map(), ie?.({ ReactiveElement: E }), (rt.reactiveElementVersions ??= []).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const ft = globalThis, vt = (e) => e, nt = ft.trustedTypes, At = nt ? nt.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, zt = "$lit$", A = `lit$${Math.random().toFixed(9).slice(2)}$`, Dt = "?" + A, oe = `<${Dt}>`, C = document, W = () => C.createComment(""), F = (e) => e === null || typeof e != "object" && typeof e != "function", yt = Array.isArray, re = (e) => yt(e) || typeof e?.[Symbol.iterator] == "function", ct = `[ 	
\f\r]`, N = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, kt = /-->/g, xt = />/g, k = RegExp(`>|${ct}(?:([^\\s"'>=/]+)(${ct}*=${ct}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), St = /'/g, Ct = /"/g, Lt = /^(?:script|style|textarea|title)$/i, qt = (e) => (t, ...s) => ({ _$litType$: e, strings: t, values: s }), p = qt(1), ae = qt(2), O = Symbol.for("lit-noChange"), h = Symbol.for("lit-nothing"), Ot = /* @__PURE__ */ new WeakMap(), S = C.createTreeWalker(C, 129);
function Bt(e, t) {
  if (!yt(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return At !== void 0 ? At.createHTML(t) : t;
}
const ce = (e, t) => {
  const s = e.length - 1, i = [];
  let n, o = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", r = N;
  for (let a = 0; a < s; a++) {
    const l = e[a];
    let c, _, d = -1, f = 0;
    for (; f < l.length && (r.lastIndex = f, _ = r.exec(l), _ !== null); ) f = r.lastIndex, r === N ? _[1] === "!--" ? r = kt : _[1] !== void 0 ? r = xt : _[2] !== void 0 ? (Lt.test(_[2]) && (n = RegExp("</" + _[2], "g")), r = k) : _[3] !== void 0 && (r = k) : r === k ? _[0] === ">" ? (r = n ?? N, d = -1) : _[1] === void 0 ? d = -2 : (d = r.lastIndex - _[2].length, c = _[1], r = _[3] === void 0 ? k : _[3] === '"' ? Ct : St) : r === Ct || r === St ? r = k : r === kt || r === xt ? r = N : (r = k, n = void 0);
    const u = r === k && e[a + 1].startsWith("/>") ? " " : "";
    o += r === N ? l + oe : d >= 0 ? (i.push(c), l.slice(0, d) + zt + l.slice(d) + A + u) : l + A + (d === -2 ? a : u);
  }
  return [Bt(e, o + (e[s] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), i];
};
class Z {
  constructor({ strings: t, _$litType$: s }, i) {
    let n;
    this.parts = [];
    let o = 0, r = 0;
    const a = t.length - 1, l = this.parts, [c, _] = ce(t, s);
    if (this.el = Z.createElement(c, i), S.currentNode = this.el.content, s === 2 || s === 3) {
      const d = this.el.content.firstChild;
      d.replaceWith(...d.childNodes);
    }
    for (; (n = S.nextNode()) !== null && l.length < a; ) {
      if (n.nodeType === 1) {
        if (n.hasAttributes()) for (const d of n.getAttributeNames()) if (d.endsWith(zt)) {
          const f = _[r++], u = n.getAttribute(d).split(A), y = /([.?@])?(.*)/.exec(f);
          l.push({ type: 1, index: o, name: y[2], strings: u, ctor: y[1] === "." ? de : y[1] === "?" ? he : y[1] === "@" ? pe : at }), n.removeAttribute(d);
        } else d.startsWith(A) && (l.push({ type: 6, index: o }), n.removeAttribute(d));
        if (Lt.test(n.tagName)) {
          const d = n.textContent.split(A), f = d.length - 1;
          if (f > 0) {
            n.textContent = nt ? nt.emptyScript : "";
            for (let u = 0; u < f; u++) n.append(d[u], W()), S.nextNode(), l.push({ type: 2, index: ++o });
            n.append(d[f], W());
          }
        }
      } else if (n.nodeType === 8) if (n.data === Dt) l.push({ type: 2, index: o });
      else {
        let d = -1;
        for (; (d = n.data.indexOf(A, d + 1)) !== -1; ) l.push({ type: 7, index: o }), d += A.length - 1;
      }
      o++;
    }
  }
  static createElement(t, s) {
    const i = C.createElement("template");
    return i.innerHTML = t, i;
  }
}
function T(e, t, s = e, i) {
  if (t === O) return t;
  let n = i !== void 0 ? s._$Co?.[i] : s._$Cl;
  const o = F(t) ? void 0 : t._$litDirective$;
  return n?.constructor !== o && (n?._$AO?.(!1), o === void 0 ? n = void 0 : (n = new o(e), n._$AT(e, s, i)), i !== void 0 ? (s._$Co ??= [])[i] = n : s._$Cl = n), n !== void 0 && (t = T(e, n._$AS(e, t.values), n, i)), t;
}
class le {
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
    const { el: { content: s }, parts: i } = this._$AD, n = (t?.creationScope ?? C).importNode(s, !0);
    S.currentNode = n;
    let o = S.nextNode(), r = 0, a = 0, l = i[0];
    for (; l !== void 0; ) {
      if (r === l.index) {
        let c;
        l.type === 2 ? c = new U(o, o.nextSibling, this, t) : l.type === 1 ? c = new l.ctor(o, l.name, l.strings, this, t) : l.type === 6 && (c = new ue(o, this, t)), this._$AV.push(c), l = i[++a];
      }
      r !== l?.index && (o = S.nextNode(), r++);
    }
    return S.currentNode = C, n;
  }
  p(t) {
    let s = 0;
    for (const i of this._$AV) i !== void 0 && (i.strings !== void 0 ? (i._$AI(t, i, s), s += i.strings.length - 2) : i._$AI(t[s])), s++;
  }
}
class U {
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
    t = T(this, t, s), F(t) ? t === h || t == null || t === "" ? (this._$AH !== h && this._$AR(), this._$AH = h) : t !== this._$AH && t !== O && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : re(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== h && F(this._$AH) ? this._$AA.nextSibling.data = t : this.T(C.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    const { values: s, _$litType$: i } = t, n = typeof i == "number" ? this._$AC(t) : (i.el === void 0 && (i.el = Z.createElement(Bt(i.h, i.h[0]), this.options)), i);
    if (this._$AH?._$AD === n) this._$AH.p(s);
    else {
      const o = new le(n, this), r = o.u(this.options);
      o.p(s), this.T(r), this._$AH = o;
    }
  }
  _$AC(t) {
    let s = Ot.get(t.strings);
    return s === void 0 && Ot.set(t.strings, s = new Z(t)), s;
  }
  k(t) {
    yt(this._$AH) || (this._$AH = [], this._$AR());
    const s = this._$AH;
    let i, n = 0;
    for (const o of t) n === s.length ? s.push(i = new U(this.O(W()), this.O(W()), this, this.options)) : i = s[n], i._$AI(o), n++;
    n < s.length && (this._$AR(i && i._$AB.nextSibling, n), s.length = n);
  }
  _$AR(t = this._$AA.nextSibling, s) {
    for (this._$AP?.(!1, !0, s); t !== this._$AB; ) {
      const i = vt(t).nextSibling;
      vt(t).remove(), t = i;
    }
  }
  setConnected(t) {
    this._$AM === void 0 && (this._$Cv = t, this._$AP?.(t));
  }
}
class at {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, s, i, n, o) {
    this.type = 1, this._$AH = h, this._$AN = void 0, this.element = t, this.name = s, this._$AM = n, this.options = o, i.length > 2 || i[0] !== "" || i[1] !== "" ? (this._$AH = Array(i.length - 1).fill(new String()), this.strings = i) : this._$AH = h;
  }
  _$AI(t, s = this, i, n) {
    const o = this.strings;
    let r = !1;
    if (o === void 0) t = T(this, t, s, 0), r = !F(t) || t !== this._$AH && t !== O, r && (this._$AH = t);
    else {
      const a = t;
      let l, c;
      for (t = o[0], l = 0; l < o.length - 1; l++) c = T(this, a[i + l], s, l), c === O && (c = this._$AH[l]), r ||= !F(c) || c !== this._$AH[l], c === h ? t = h : t !== h && (t += (c ?? "") + o[l + 1]), this._$AH[l] = c;
    }
    r && !n && this.j(t);
  }
  j(t) {
    t === h ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class de extends at {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === h ? void 0 : t;
  }
}
class he extends at {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== h);
  }
}
class pe extends at {
  constructor(t, s, i, n, o) {
    super(t, s, i, n, o), this.type = 5;
  }
  _$AI(t, s = this) {
    if ((t = T(this, t, s, 0) ?? h) === O) return;
    const i = this._$AH, n = t === h && i !== h || t.capture !== i.capture || t.once !== i.once || t.passive !== i.passive, o = t !== h && (i === h || n);
    n && this.element.removeEventListener(this.name, this, i), o && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class ue {
  constructor(t, s, i) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = s, this.options = i;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    T(this, t);
  }
}
const _e = { I: U }, fe = ft.litHtmlPolyfillSupport;
fe?.(Z, U), (ft.litHtmlVersions ??= []).push("3.3.3");
const ye = (e, t, s) => {
  const i = s?.renderBefore ?? t;
  let n = i._$litPart$;
  if (n === void 0) {
    const o = s?.renderBefore ?? null;
    i._$litPart$ = n = new U(t.insertBefore(W(), o), o, void 0, s ?? {});
  }
  return n._$AI(e), n;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const mt = globalThis;
let j = class extends E {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t.firstChild, t;
  }
  update(t) {
    const s = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = ye(s, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return O;
  }
};
j._$litElement$ = !0, j.finalized = !0, mt.litElementHydrateSupport?.({ LitElement: j });
const me = mt.litElementPolyfillSupport;
me?.({ LitElement: j });
(mt.litElementVersions ??= []).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const ge = { CHILD: 2 }, $e = (e) => (...t) => ({ _$litDirective$: e, values: t });
let be = class {
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
const { I: we } = _e, Et = (e) => e, Ht = () => document.createComment(""), M = (e, t, s) => {
  const i = e._$AA.parentNode, n = t === void 0 ? e._$AB : t._$AA;
  if (s === void 0) {
    const o = i.insertBefore(Ht(), n), r = i.insertBefore(Ht(), n);
    s = new we(o, r, e, e.options);
  } else {
    const o = s._$AB.nextSibling, r = s._$AM, a = r !== e;
    if (a) {
      let l;
      s._$AQ?.(e), s._$AM = e, s._$AP !== void 0 && (l = e._$AU) !== r._$AU && s._$AP(l);
    }
    if (o !== n || a) {
      let l = s._$AA;
      for (; l !== o; ) {
        const c = Et(l).nextSibling;
        Et(i).insertBefore(l, n), l = c;
      }
    }
  }
  return s;
}, x = (e, t, s = e) => (e._$AI(t, s), e), ve = {}, Ae = (e, t = ve) => e._$AH = t, ke = (e) => e._$AH, lt = (e) => {
  e._$AR(), e._$AA.remove();
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const jt = (e, t, s) => {
  const i = /* @__PURE__ */ new Map();
  for (let n = t; n <= s; n++) i.set(e[n], n);
  return i;
}, $ = $e(class extends be {
  constructor(e) {
    if (super(e), e.type !== ge.CHILD) throw Error("repeat() can only be used in text expressions");
  }
  dt(e, t, s) {
    let i;
    s === void 0 ? s = t : t !== void 0 && (i = t);
    const n = [], o = [];
    let r = 0;
    for (const a of e) n[r] = i ? i(a, r) : r, o[r] = s(a, r), r++;
    return { values: o, keys: n };
  }
  render(e, t, s) {
    return this.dt(e, t, s).values;
  }
  update(e, [t, s, i]) {
    const n = ke(e), { values: o, keys: r } = this.dt(t, s, i);
    if (!Array.isArray(n)) return this.ut = r, o;
    const a = this.ut ??= [], l = [];
    let c, _, d = 0, f = n.length - 1, u = 0, y = o.length - 1;
    for (; d <= f && u <= y; ) if (n[d] === null) d++;
    else if (n[f] === null) f--;
    else if (a[d] === r[u]) l[u] = x(n[d], o[u]), d++, u++;
    else if (a[f] === r[y]) l[y] = x(n[f], o[y]), f--, y--;
    else if (a[d] === r[y]) l[y] = x(n[d], o[y]), M(e, l[y + 1], n[d]), d++, y--;
    else if (a[f] === r[u]) l[u] = x(n[f], o[u]), M(e, n[d], n[f]), f--, u++;
    else if (c === void 0 && (c = jt(r, u, y), _ = jt(a, d, f)), c.has(a[d])) if (c.has(a[f])) {
      const m = _.get(r[u]), w = m !== void 0 ? n[m] : null;
      if (w === null) {
        const v = M(e, n[d]);
        x(v, o[u]), l[u] = v;
      } else l[u] = x(w, o[u]), M(e, n[d], w), n[m] = null;
      u++;
    } else lt(n[f]), f--;
    else lt(n[d]), d++;
    for (; u <= y; ) {
      const m = M(e, l[y + 1]);
      x(m, o[u]), l[u++] = m;
    }
    for (; d <= f; ) {
      const m = n[d++];
      m !== null && lt(m);
    }
    return this.ut = r, Ae(e, l), O;
  }
}), K = ["idle", "working", "waiting", "done", "unknown"], Vt = ["ready", "missing", "stale", "invalid", "conflict", "unsupported"], it = ["idle", "working", "waiting", "done"], B = [
  "show_last_contact",
  "show_last_success",
  "show_summary",
  "show_inventory_summary",
  "show_filtered_count",
  "show_inventory_status",
  "show_inventory_last_contact",
  "show_inventory_last_success",
  "show_agent_type",
  "show_pane_id",
  "show_model",
  "show_effort",
  "show_session_id",
  "show_derived_label",
  "show_lifecycle",
  "show_group_name"
], Tt = ["cli_unavailable", "cli_timeout", "cli_failed", "invalid_payload", "payload_too_large"];
function J(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function H(e, t = 128, s = !1) {
  return typeof e == "string" && (s || e.length > 0) && Array.from(e).length <= t && !/[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(e);
}
function L(e) {
  return typeof e == "number" && Number.isSafeInteger(e) && e >= 0;
}
function dt(e) {
  return e === null || H(e);
}
function R(e, t = 128) {
  return e === null || H(e, t, !0);
}
function xe(e) {
  return e === null || L(e);
}
function Se(e) {
  return e === null || typeof e == "boolean";
}
function Ce(e) {
  if (!J(e) || e.kind !== "snapshot" || !H(e.sample_id) || typeof e.consistent != "boolean" || typeof e.names_included != "boolean" || typeof e.derived_labels_included != "boolean" || !Array.isArray(e.workspaces) || e.workspaces.length > 64 || !Array.isArray(e.tabs) || e.tabs.length > 256 || !Array.isArray(e.panes) || e.panes.length > 512) return null;
  const t = e.names_included, s = t && e.derived_labels_included, i = [], n = [], o = [], r = /* @__PURE__ */ new Set(), a = /* @__PURE__ */ new Set(), l = /* @__PURE__ */ new Set();
  for (const c of e.workspaces) {
    if (!J(c) || !H(c.workspace_id) || r.has(c.workspace_id) || !R(c.name) || !L(c.tab_count) || !L(c.pane_count)) return null;
    r.add(c.workspace_id), i.push({ workspace_id: c.workspace_id, name: t && c.name || null, tab_count: c.tab_count, pane_count: c.pane_count });
  }
  for (const c of e.tabs) {
    if (!J(c) || !H(c.workspace_id) || !H(c.tab_id) || a.has(c.tab_id) || !xe(c.ordinal) || !R(c.name) || !R(c.label) || !R(c.detected_agent, 64) || !dt(c.group_id) || !R(c.group_name) || typeof c.hibernated != "boolean" || !Array.isArray(c.pane_ids) || c.pane_ids.length > 512 || c.pane_ids.some((_) => !L(_) || _ === 0) || new Set(c.pane_ids).size !== c.pane_ids.length) return null;
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
    if (!J(c) || !L(c.pane_id) || c.pane_id === 0 || l.has(c.pane_id) || !dt(c.workspace_id) || !dt(c.tab_id) || !Se(c.live) || typeof c.hibernated != "boolean" || typeof c.orphan != "boolean") return null;
    l.add(c.pane_id), o.push({ pane_id: c.pane_id, workspace_id: c.workspace_id, tab_id: c.tab_id, live: c.live, hibernated: c.hibernated, orphan: c.orphan });
  }
  return {
    kind: "snapshot",
    sample_id: e.sample_id,
    workspaces: i,
    tabs: n,
    panes: o,
    consistent: e.consistent,
    names_included: t,
    derived_labels_included: s
  };
}
function Wt(e) {
  return e.inferred === !0 ? "inferred" : e.rich === !0 ? "structured_hook" : e.rich === !1 ? "weak_report" : "unknown";
}
function Y(e, t) {
  return e.filter((s) => (t.include_inferred !== !1 || s.inferred !== !0) && (t.statuses ?? it).includes(s.status) && (!t.agent_types?.length || t.agent_types.includes(s.agent)));
}
function V(e, t) {
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
function Pt(e, t) {
  const s = e.inventory;
  if (!t || t.omp?.state !== "ready" || e.inventoryState !== "healthy" || !s?.consistent || !s.names_included || !s.derived_labels_included) return null;
  const i = V(s, t.pane_id);
  return !i || !s.workspaces.some((n) => n.workspace_id === i.workspace_id) ? null : t.omp.session_name ?? null;
}
const Ut = { waiting: 0, working: 1, done: 2, unknown: 3, idle: 4 };
function Ft(e) {
  return e.reduce((t, s) => !t || Ut[s.status] < Ut[t.status] ? s : t, null);
}
function tt(e) {
  const t = /* @__PURE__ */ new Map();
  for (const s of e.agents) {
    const i = V(e.inventory, s.pane_id);
    if (!i) continue;
    const n = t.get(i) ?? [];
    n.push(s), t.set(i, n);
  }
  return (e.inventory?.tabs ?? []).map((s) => {
    const i = t.get(s) ?? [], n = Ft(i);
    return { identity: JSON.stringify([e.config.roster_entity, s.workspace_id, s.tab_id]), tab: s, agents: i, representative: n };
  });
}
function Oe(e) {
  const t = tt(e);
  return (e.inventory?.workspaces ?? []).map((s) => ({
    identity: JSON.stringify([e.config.roster_entity, s.workspace_id]),
    workspace: s,
    tabs: t.filter((i) => i.tab.workspace_id === s.workspace_id)
  }));
}
function P(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function b(e, t) {
  if (typeof e != "string" || e.length === 0) return !1;
  let s = 0;
  for (let i = 0; i < e.length; i++) {
    const n = e.charCodeAt(i);
    if (n >= 55296 && n <= 56319) {
      const o = e.charCodeAt(++i);
      if (!(o >= 56320 && o <= 57343)) return !1;
    } else if (n >= 56320 && n <= 57343) return !1;
    if (++s > t) return !1;
  }
  return !0;
}
function ot(e) {
  return typeof e == "number" && Number.isSafeInteger(e) && e >= 0;
}
function et(e) {
  const t = () => {
    throw new Error("Configure host labels, unique sensor rosters, and binary_sensor connectivity entities.");
  };
  if (!P(e) || e.type !== "custom:ha-tty7-card" || !Array.isArray(e.hosts) || e.hosts.length > 64 || Object.keys(e).some((o) => !["type", "hosts", "title", "appearance", "group_by", ...B, "statuses", "agent_types", "include_inferred"].includes(o)) || Object.hasOwn(e, "title") && (!b(e.title, 128) || !e.title.trim()) || Object.hasOwn(e, "appearance") && !["tty7", "home-assistant"].includes(e.appearance) || Object.hasOwn(e, "group_by") && !["host", "workspace", "tab"].includes(e.group_by)) return t();
  for (const o of [...B, "include_inferred"])
    if (Object.hasOwn(e, o) && typeof e[o] != "boolean") return t();
  if (Object.hasOwn(e, "statuses") && (!Array.isArray(e.statuses) || e.statuses.length > 5 || e.statuses.some((o) => !K.includes(o)) || new Set(e.statuses).size !== e.statuses.length) || Object.hasOwn(e, "agent_types") && (!Array.isArray(e.agent_types) || e.agent_types.length > 256 || e.agent_types.some((o) => !b(o, 64)) || new Set(e.agent_types).size !== e.agent_types.length)) return t();
  const s = /* @__PURE__ */ new Set(), i = [];
  for (const o of e.hosts) {
    if (!P(o) || Object.keys(o).some((r) => !["name", "roster_entity", "connectivity_entity"].includes(r)) || !b(o.name, 128) || !o.name.trim() || typeof o.roster_entity != "string" || typeof o.connectivity_entity != "string" || !/^sensor\.[a-z0-9_]+$/.test(o.roster_entity) || !/^binary_sensor\.[a-z0-9_]+$/.test(o.connectivity_entity) || s.has(o.roster_entity) || s.has(o.connectivity_entity)) return t();
    s.add(o.roster_entity), s.add(o.connectivity_entity), i.push({ name: o.name.trim(), roster_entity: o.roster_entity, connectivity_entity: o.connectivity_entity });
  }
  const n = {};
  for (const o of B) Object.hasOwn(e, o) && (n[o] = e[o]);
  return {
    type: "custom:ha-tty7-card",
    hosts: i,
    ...Object.hasOwn(e, "title") ? { title: e.title.trim() } : {},
    ...Object.hasOwn(e, "appearance") ? { appearance: e.appearance } : {},
    ...Object.hasOwn(e, "group_by") ? { group_by: e.group_by } : {},
    ...n,
    ...Object.hasOwn(e, "include_inferred") ? { include_inferred: e.include_inferred } : {},
    ...Object.hasOwn(e, "statuses") ? { statuses: [...e.statuses] } : {},
    ...Object.hasOwn(e, "agent_types") ? { agent_types: [...e.agent_types] } : {}
  };
}
function Ee(e) {
  return !P(e) || Object.keys(e).some((t) => !["state", "run_id", "background_jobs", "outcome", "input_id", "session_name"].includes(t)) || !Object.hasOwn(e, "state") || !Object.hasOwn(e, "run_id") || !Object.hasOwn(e, "background_jobs") || !Vt.includes(e.state) || e.run_id !== null && !b(e.run_id, 128) || e.background_jobs !== null && !ot(e.background_jobs) || Object.hasOwn(e, "outcome") && e.outcome !== null && !["completed", "failed", "cancelled"].includes(e.outcome) || Object.hasOwn(e, "input_id") && e.input_id !== null && !b(e.input_id, 128) || Object.hasOwn(e, "session_name") && e.session_name !== null && (!b(e.session_name, 256) || !e.session_name.trim() || /[\u0000-\u001f\u007f-\u009f]/u.test(e.session_name)) ? null : {
    state: e.state,
    run_id: e.run_id,
    background_jobs: e.background_jobs,
    ...Object.hasOwn(e, "outcome") ? { outcome: e.outcome } : {},
    ...Object.hasOwn(e, "input_id") ? { input_id: e.input_id } : {},
    ...Object.hasOwn(e, "session_name") ? { session_name: e.session_name } : {}
  };
}
function He(e) {
  if (!P(e) || !ot(e.pane_id) || e.pane_id === 0 || !b(e.agent, 64) || Object.hasOwn(e, "inferred") && typeof e.inferred != "boolean" || Object.hasOwn(e, "rich") && typeof e.rich != "boolean") return null;
  for (const s of ["session_id", "model", "effort", "permission_mode"])
    if (!(s === "effort" && e[s] === "") && e[s] !== void 0 && e[s] !== null && !b(e[s], 128))
      return null;
  for (const s of ["activity", "turns"])
    if (e[s] !== void 0 && e[s] !== null && !ot(e[s])) return null;
  let t;
  if (Object.hasOwn(e, "omp")) {
    const s = Ee(e.omp);
    if (!s || e.agent !== "OhMyPi" || !K.includes(e.status) || e.activity !== null || e.turns !== null) return null;
    if (s.state === "ready") {
      if (e.rich !== !0 || e.inferred === !0 || !b(e.session_id, 128) || s.background_jobs === null) return null;
    } else if (e.status !== "unknown" || e.session_id !== null || e.rich !== !1 || e.inferred === !0 || s.run_id !== null || s.background_jobs !== null || s.outcome != null || s.input_id != null || s.session_name != null) return null;
    if (s.outcome != null && (e.status !== "done" || s.run_id === null || s.background_jobs !== 0 || s.input_id != null) || s.input_id != null && (e.status !== "waiting" || s.run_id === null || s.outcome != null)) return null;
    t = s;
  }
  return {
    pane_id: e.pane_id,
    agent: e.agent,
    session_id: e.session_id ?? null,
    status: K.includes(e.status) ? e.status : "unknown",
    ...e.inferred === !0 ? { inferred: !0 } : {},
    ...typeof e.rich == "boolean" ? { rich: e.rich } : {},
    ...t ? { omp: t } : {},
    activity: e.activity ?? null,
    turns: e.turns ?? null,
    model: e.model ?? null,
    effort: e.effort ?? null,
    permission_mode: e.permission_mode ?? null
  };
}
function G(e) {
  return e === null ? null : typeof e != "string" || e.length > 64 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(e) ? NaN : Date.parse(e);
}
function je(e, t, s) {
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
    inventoryErrorCode: null
  }, o = t[e.roster_entity], r = t[e.connectivity_entity];
  if (!o || !r || (n.state = s ? "malformed" : "disconnected", !P(o.attributes))) return n;
  const a = o.attributes;
  if (a.schema_version !== 1 || !Array.isArray(a.agents) || a.agents.length > 256 || typeof a.collector_ok != "boolean" || typeof a.baseline_ready != "boolean" || !P(a.counts) || !Object.hasOwn(a, "error_code") || !Object.hasOwn(a, "last_contact") || !Object.hasOwn(a, "last_success")) return n;
  const l = G(a.last_contact), c = G(a.last_success);
  if (l !== null && !Number.isFinite(l) || c !== null && !Number.isFinite(c) || l !== null && c !== null && c > l || a.baseline_ready && (l === null || c === null) || a.error_code !== null && !Tt.includes(a.error_code) || a.collector_ok && a.error_code !== null || !a.collector_ok && a.baseline_ready) return n;
  const _ = [], d = /* @__PURE__ */ new Set();
  for (const u of a.agents) {
    const y = He(u);
    if (!y || d.has(y.pane_id)) return n;
    d.add(y.pane_id), _.push(y), i[y.status] += 1;
  }
  const f = a.counts;
  if (K.some((u) => !ot(f[u]) || f[u] !== i[u])) return n;
  n.agents = _.map((u) => ({ ...u, identity: JSON.stringify([e.roster_entity, u.session_id, u.pane_id]) }));
  for (const u of _) {
    const y = Wt(u);
    y === "structured_hook" ? n.confirmedCounts[u.status]++ : y === "inferred" ? n.inferredCount++ : y === "weak_report" ? n.weakCount++ : n.unknownOriginCount++;
  }
  return n.inventoryState = ["disabled", "unconfirmed", "healthy", "error", "stale"].includes(a.inventory_state) ? a.inventory_state : a.inventory === void 0 ? "disabled" : "unconfirmed", n.inventoryState !== "disabled" && (n.inventory = Ce(a.inventory)), !n.inventory && n.inventoryState === "healthy" && (n.inventoryState = "unconfirmed"), n.inventoryLastContact = typeof a.inventory_last_contact == "string" && Number.isFinite(G(a.inventory_last_contact)) ? a.inventory_last_contact : null, n.inventoryLastSuccess = typeof a.inventory_last_success == "string" && Number.isFinite(G(a.inventory_last_success)) ? a.inventory_last_success : null, n.inventoryErrorCode = Tt.includes(a.inventory_error_code) ? a.inventory_error_code : null, n.lastContact = a.last_contact, n.lastSuccess = a.last_success, n.errorCode = a.error_code, s ? ["unavailable", "unknown"].includes(o.state) || ["unavailable", "unknown"].includes(r.state) ? n.state = "offline" : o.state === "error" ? n.state = n.errorCode === null ? "malformed" : "error" : o.state === "stale" ? n.state = "stale" : o.state === "unconfirmed" ? n.state = "unconfirmed" : n.errorCode !== null || o.state !== String(_.length) ? n.state = "malformed" : !a.collector_ok || !a.baseline_ready || l === null || c === null || r.state === "off" ? n.state = "offline" : r.state !== "on" ? n.state = "malformed" : n.state = _.length === 0 ? "empty" : "healthy" : n.state = "disconnected", n.lastKnown = !["healthy", "empty"].includes(n.state), n;
}
const Te = Rt`
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
  .agent-row[aria-expanded='true'] .agent-name { white-space: normal; overflow-wrap: anywhere; overflow: visible; text-overflow: clip; }
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
  .summary, .inventory-summary, .filtered-count { color: var(--tty-muted); font-size: 12px; margin: 6px 0 0; font-variant-numeric: tabular-nums; }
  .group-head { display: flex; flex-wrap: wrap; gap: 4px 10px; padding: 9px 8px 5px; font-size: 12px; color: var(--tty-muted); overflow-wrap: anywhere; }
  .group-head h3 { flex-basis: 100%; min-width: 0; margin: 0; font-size: 13px; font-weight: 600; color: var(--tty-ink); }
  .workspace-title { margin: 10px 14px 0; font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
  .tab-group + .tab-group { border-top: 1px solid var(--tty-line); }
  .inventory-panes { padding-top: 0; }
  @media (max-width: 380px) {
    header { padding: 10px; gap: 8px; }
    .host-head { padding: 10px; }
    .agent-row { gap: 6px; grid-template-columns: 24px minmax(0, 1fr) auto 10px; }
    dl { padding: 10px; gap: 8px; }
  }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
`, I = new Intl.DateTimeFormat().resolvedOptions().timeZone, ht = I && (I === "UTC" || I === "Etc/UTC" || I.includes("/")) ? I : void 0;
let z;
function Q(e, t) {
  const s = t?.locale?.language, i = t?.locale?.date_format ?? "system", n = t?.locale?.time_format ?? "system", o = t?.config?.time_zone ?? ht ?? "UTC", r = t?.locale?.time_zone === "local" && ht ? ht : o, a = `${s}|${i}|${n}|${r}`;
  if (z?.key !== a) {
    const _ = n === "12" || n !== "24" && new Intl.DateTimeFormat(n === "language" ? s : void 0, { hour: "numeric" }).resolvedOptions().hour12 === !0;
    z = {
      key: a,
      date: new Intl.DateTimeFormat(i === "system" ? void 0 : s, {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        timeZone: r
      }),
      time: new Intl.DateTimeFormat(s, {
        hour: "numeric",
        minute: "2-digit",
        hourCycle: _ ? "h12" : "h23",
        timeZone: r
      })
    };
  }
  const l = new Date(e);
  let c;
  if (i === "language" || i === "system")
    c = z.date.format(l);
  else {
    const _ = z.date.formatToParts(l), d = _.find((g) => g.type === "day").value, f = _.find((g) => g.type === "month").value, u = _.find((g) => g.type === "year").value, y = _.find((g) => g.type === "literal")?.value ?? "", m = _.at(-1), w = m?.type === "literal" && !(s === "bg" && i === "YMD") ? m.value : "";
    c = (i === "DMY" ? [d, f, u] : i === "MDY" ? [f, d, u] : [u, f, d]).join(y) + w;
  }
  return `${c}, ${z.time.format(l)}`;
}
const Pe = {
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
  omp_native: "OhMyPi native source",
  omp_status: "Native status",
  background_jobs: "Background jobs",
  omp_unavailable: "OhMyPi native status unavailable",
  omp_ready: "Ready",
  omp_missing: "Missing",
  omp_stale: "Stale",
  omp_invalid: "Invalid",
  omp_conflict: "Conflict",
  omp_unsupported: "Unsupported",
  not_reported: "Not reported",
  none_applicable: "None applicable",
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
  configuration_error: "Configuration error",
  not_configured: "Not configured",
  configuration_help: "Configure host labels, unique sensor rosters, and binary_sensor connectivity entities.",
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
  editor_feedback: "Use a title of at most 128 characters and choose a unique host pair with a non-empty dashboard label for each row.",
  group_by: "Group by",
  group_host: "Host",
  group_workspace: "Workspace",
  group_tab: "Tab",
  show_summary: "Show host summary",
  show_model: "Show model",
  show_effort: "Show effort",
  show_session_id: "Show session ID in rows",
  include_inferred: "Include inferred reports",
  show_last_contact: "Show host last contact",
  show_last_success: "Show host last successful snapshot",
  show_inventory_summary: "Show workspace, tab and pane counts",
  show_filtered_count: "Show filtered report count",
  show_inventory_status: "Show inventory information",
  show_inventory_last_contact: "Show inventory last contact",
  show_inventory_last_success: "Show inventory last success",
  show_agent_type: "Show agent type below names",
  show_pane_id: "Show pane ID",
  show_derived_label: "Show derived-label origin",
  show_lifecycle: "Show hibernation, liveness and orphan labels",
  show_group_name: "Show group names",
  statuses: "Statuses",
  agent_types: "Agent types",
  agent_types_help: "Add exact, case-sensitive reported types. Empty selection means all types."
}, Ue = {
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
  omp_native: "Нативный источник OhMyPi",
  omp_status: "Нативный статус",
  background_jobs: "Фоновые задачи",
  omp_unavailable: "Нативный статус OhMyPi недоступен",
  omp_ready: "Готов",
  omp_missing: "нет источника",
  omp_stale: "устарел",
  omp_invalid: "некорректен",
  omp_conflict: "конфликт",
  omp_unsupported: "не поддерживается",
  not_reported: "Не сообщается",
  none_applicable: "Не применяется",
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
  configuration_error: "Ошибка настройки",
  not_configured: "Не настроено",
  configuration_help: "Задайте подписи хостов, уникальные списки sensor и связь binary_sensor.",
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
  editor_feedback: "Укажите заголовок до 128 символов и уникальную пару сущностей с непустой подписью для каждой строки.",
  group_by: "Группировка",
  group_host: "Хост",
  group_workspace: "Рабочее пространство",
  group_tab: "Вкладка",
  show_summary: "Показывать сводку хоста",
  show_model: "Показывать модель",
  show_effort: "Показывать усилие",
  show_session_id: "Показывать ID сеанса в строках",
  include_inferred: "Включать предположения",
  show_last_contact: "Показывать последний контакт хоста",
  show_last_success: "Показывать последний успешный снимок хоста",
  show_inventory_summary: "Показывать число пространств, вкладок и панелей",
  show_filtered_count: "Показывать число отфильтрованных отчётов",
  show_inventory_status: "Показывать сведения об инвентаризации",
  show_inventory_last_contact: "Показывать последний контакт инвентаризации",
  show_inventory_last_success: "Показывать последний успех инвентаризации",
  show_agent_type: "Показывать тип агента под названием",
  show_pane_id: "Показывать ID панели",
  show_derived_label: "Показывать происхождение производной подписи",
  show_lifecycle: "Показывать спячку, активность панели и отсутствие владельца",
  show_group_name: "Показывать названия групп",
  statuses: "Статусы",
  agent_types: "Типы агентов",
  agent_types_help: "Добавьте точные типы из отчётов с учётом регистра. Пустой выбор — все типы."
};
function Zt(e, t) {
  return e?.locale?.language.toLowerCase().split("-")[0] === "ru" ? Ue[t] : Pe[t];
}
function st(e) {
  if (!e?.entities || !e.devices) return [];
  const t = /* @__PURE__ */ new Map();
  for (const n of Object.values(e.entities)) {
    if (n.platform !== "ha_tty7" || !n.device_id || n.hidden) continue;
    const o = e.devices[n.device_id];
    if (!o || o.disabled_by || !o.config_entries.length || !o.identifiers.some(([a, l]) => a === "ha_tty7" && l.length > 0)) continue;
    const r = t.get(o.id) ?? { rosters: [], connectivity: [] };
    if (n.translation_key === "roster" && /^sensor\.[a-z0-9_]+$/.test(n.entity_id)) r.rosters.push(n.entity_id);
    else if (n.translation_key === "connectivity" && /^binary_sensor\.[a-z0-9_]+$/.test(n.entity_id)) r.connectivity.push(n.entity_id);
    else continue;
    t.set(o.id, r);
  }
  const s = [], i = /* @__PURE__ */ new Set();
  for (const [n, o] of t) {
    if (o.rosters.length !== 1 || o.connectivity.length !== 1 || s.length === 64) continue;
    const r = e.devices[n], a = (r.name_by_user || r.name)?.trim();
    if (!a || Array.from(a).length > 128) continue;
    let l = a, c = 2;
    for (; i.has(l); ) l = `${Array.from(a).slice(0, 120).join("")} (${c++})`;
    i.add(l), s.push({ name: l, roster_entity: o.rosters[0], connectivity_entity: o.connectivity[0] });
  }
  return s;
}
function D(e) {
  return typeof e == "object" && e !== null && !Array.isArray(e);
}
function Nt(e, t) {
  return typeof e == "string" && Array.from(e).length <= t ? e : "";
}
class Ne extends j {
  constructor() {
    super(...arguments), this.rows = [], this.nextId = 0, this.feedback = "", this.cardTitle = "", this.presentation = {};
  }
  static {
    this.styles = Rt`
    :host { display: block; color: var(--primary-text-color, #1c1c1e); }
    * { box-sizing: border-box; }
    p { line-height: 1.5; color: var(--secondary-text-color, #666); }
    fieldset { min-width: 0; margin: 16px 0; padding: 12px; border: 1px solid var(--divider-color, #ddd); border-radius: 8px; }
    legend { padding: 0 4px; }
    ha-selector { display: block; min-width: 0; margin: 8px 0 12px; }
    .pair { font-size: 12px; overflow-wrap: anywhere; }
    a { color: var(--primary-color, #1f6bf0); display: inline-block; min-height: 44px; padding: 8px 0; }
    .feedback { color: var(--error-color, #b3261e); }
    .display-options { display: grid; gap: 12px; }
  `;
  }
  t(t) {
    return Zt(this.currentHass, t);
  }
  set hass(t) {
    this.currentHass = t, this.requestUpdate();
  }
  get hass() {
    return this.currentHass;
  }
  setConfig(t) {
    const s = D(t) && Array.isArray(t.hosts) ? t.hosts.slice(0, 64) : [], i = D(t) ? Nt(t.title, 128) : "";
    this.cardTitle = this.cardTitle.trim() === i ? this.cardTitle : i, this.appearance = D(t) && (t.appearance === "tty7" || t.appearance === "home-assistant") ? t.appearance : void 0;
    const n = { type: "custom:ha-tty7-card", hosts: [] };
    if (D(t)) for (const r of ["group_by", ...B, "statuses", "agent_types", "include_inferred"])
      Object.hasOwn(t, r) && (n[r] = t[r]);
    try {
      const { type: r, hosts: a, title: l, appearance: c, ..._ } = et(n);
      this.presentation = _;
    } catch {
      this.presentation = {};
    }
    const o = this.rows;
    this.rows = s.filter(D).map((r, a) => {
      const l = o.find((_) => _.host.roster_entity === r.roster_entity && _.host.connectivity_entity === r.connectivity_entity), c = Nt(r.name, 128);
      return { id: l?.id ?? (r.roster_entity ? void 0 : o[a]?.id) ?? this.nextId++, host: {
        // Config echoes must not replace focused controls or eat a space while a label is being typed.
        name: l && l.host.name.trim() === c ? l.host.name : c,
        roster_entity: typeof r.roster_entity == "string" && /^sensor\.[a-z0-9_]+$/.test(r.roster_entity) ? r.roster_entity : "",
        connectivity_entity: typeof r.connectivity_entity == "string" && /^binary_sensor\.[a-z0-9_]+$/.test(r.connectivity_entity) ? r.connectivity_entity : ""
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
    const o = st(this.currentHass).find((a) => a.roster_entity === i.host.roster_entity), r = i.host.name && i.host.name !== o?.name;
    i.host = { ...n, name: r ? i.host.name : n.name }, this.publish();
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
      const { type: i, hosts: n, ...o } = et({
        type: "custom:ha-tty7-card",
        hosts: [],
        ...this.presentation,
        [t]: s
      });
      this.presentation = o, this.publish();
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
      ${$(this.rows, (s) => s.id, (s, i) => {
      const o = t.filter((r) => r.roster_entity === s.host.roster_entity || !this.rows.some((a) => a !== s && a.host.roster_entity === r.roster_entity)).map((r) => ({ value: r.roster_entity, label: r.name }));
      return s.host.roster_entity && !o.some((r) => r.value === s.host.roster_entity) && o.push({ value: s.host.roster_entity, label: s.host.name || s.host.roster_entity }), p`<fieldset data-row=${s.id}>
          <legend>${this.t("host")} ${i + 1}</legend>
          <ha-selector data-field="host" .hass=${this.currentHass} .label=${`${this.t("host_picker")} ${i + 1}`}
            .selector=${{ select: { options: o, mode: "dropdown", custom_value: !1 } }} .value=${s.host.roster_entity}
            @value-changed=${(r) => this.selectHost(r, s.id)}></ha-selector>
          <ha-selector data-field="name" .hass=${this.currentHass} .label=${`${this.t("dashboard_label")} ${i + 1}`}
            .selector=${{ text: {} }} .value=${s.host.name}
            @value-changed=${(r) => this.labelChanged(r, s.id)}></ha-selector>
          ${s.host.roster_entity && s.host.connectivity_entity ? p`<p class="pair">${this.t("roster")}: ${s.host.roster_entity}<br>
            ${this.t("connectivity")}: ${s.host.connectivity_entity}</p>` : h}
          <ha-button data-action="remove" size="l" variant="neutral" appearance="outlined" aria-label=${`${this.t("remove_host")} ${i + 1}`} @click=${() => this.removeRow(s.id)}>${this.t("remove_host")}</ha-button>
        </fieldset>`;
    })}
      ${this.feedback ? p`<p class="feedback" role="alert">${this.feedback}</p>` : h}
      <ha-button data-action="add" size="l" appearance="filled" .disabled=${this.rows.length >= 64} @click=${this.addRow}>${this.t("add_host")}</ha-button>
      <fieldset class="display-options"><legend>${this.t("group_by")}</legend>
        <ha-selector data-field="group_by" .hass=${this.currentHass} .label=${this.t("group_by")}
          .selector=${{ select: {
      options: ["host", "workspace", "tab"].map((s) => ({ value: s, label: this.t(`group_${s}`) })),
      mode: "dropdown",
      custom_value: !1
    } }} .value=${this.presentation.group_by ?? "host"}
          @value-changed=${(s) => {
      s.stopPropagation(), this.presentationChanged("group_by", s.detail.value);
    }}></ha-selector>
        ${[...B, "include_inferred"].map((s) => p`
          <ha-selector data-field=${s} .hass=${this.currentHass} .label=${this.t(s)} .selector=${{ boolean: {} }}
            .value=${this.presentation[s] ?? s === "include_inferred"}
            @value-changed=${(i) => {
      i.stopPropagation(), this.presentationChanged(s, i.detail.value);
    }}></ha-selector>`)}
        <ha-selector data-field="statuses" .hass=${this.currentHass} .label=${this.t("statuses")}
          .selector=${{ select: {
      options: K.map((s) => ({ value: s, label: this.t(s) })),
      mode: "list",
      multiple: !0,
      custom_value: !1
    } }} .value=${this.presentation.statuses ?? it}
          @value-changed=${(s) => {
      s.stopPropagation(), this.presentationChanged("statuses", s.detail.value);
    }}></ha-selector>
        <ha-selector data-field="agent_types" .hass=${this.currentHass} .label=${this.t("agent_types")}
          .selector=${{ select: { options: this.presentation.agent_types ?? [], mode: "dropdown", multiple: !0, custom_value: !0 } }}
          .value=${this.presentation.agent_types ?? []} .helper=${this.t("agent_types_help")}
          @value-changed=${(s) => {
      s.stopPropagation(), this.presentationChanged("agent_types", s.detail.value);
    }}></ha-selector>
      </fieldset>
    `;
  }
}
document.querySelector("home-assistant") && await customElements.whenDefined("home-assistant");
customElements.get("ha-tty7-card-editor") || customElements.define("ha-tty7-card-editor", Ne);
class Me extends j {
  constructor() {
    super(...arguments), this.configurationError = !1, this.selectedHost = "", this.expanded = /* @__PURE__ */ new Set();
  }
  static {
    this.styles = Te;
  }
  static async getConfigElement() {
    return !customElements.get("ha-selector") && window.loadCardHelpers && ((await window.loadCardHelpers()).createCardElement({ type: "entities", entities: [] }), await customElements.whenDefined("hui-entities-card"), await customElements.get("hui-entities-card").getConfigElement()), document.createElement("ha-tty7-card-editor");
  }
  static getStubConfig(t) {
    return { type: "custom:ha-tty7-card", hosts: st(t), appearance: "home-assistant" };
  }
  t(t) {
    return Zt(this.currentHass, t);
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
    const i = this.expanded.has(t.identity), n = `${this.t(t.status)}${t.inferred === !0 ? ` (${this.t("inferred")})` : ""}`, o = V(s.inventory, t.pane_id), r = s.inventory?.panes.find((g) => g.pane_id === t.pane_id), a = Pt(s, t), l = (o?.name?.trim() ? o.name : null) ?? a ?? (o?.label?.trim() ? o.label : null) ?? t.agent, c = t.model ?? this.t("not_reported"), _ = t.effort === "" ? this.t("none_applicable") : t.effort ?? this.t("not_reported"), d = this.config?.show_model === !0 && t.model !== null && t.model.trim().length > 0, f = this.config?.show_effort === !0 && t.effort !== null && (t.effort === "" || t.effort.trim().length > 0), u = this.config?.show_session_id === !0 && !!t.session_id?.trim(), y = [
      this.config?.show_agent_type && l !== t.agent ? t.agent : null,
      this.config?.show_pane_id ? `${this.t("pane")} ${t.pane_id}` : null,
      u ? t.session_id : null
    ].filter((g) => g !== null), m = `details-${Array.from(t.identity, (g) => g.codePointAt(0).toString(16)).join("-")}`, w = Wt(t), v = [
      [this.t("agent"), t.agent],
      [this.t("status"), n],
      [this.t("pane"), t.pane_id],
      [this.t("session"), t.session_id],
      [this.t("provenance"), t.omp ? this.t("omp_native") : this.t(w === "unknown" ? "unknown_origin" : w)],
      [this.t("activity"), t.activity],
      [this.t("turns"), t.turns],
      [this.t("model"), c],
      [this.t("effort"), _],
      [this.t("permission"), t.permission_mode]
    ];
    return t.omp && v.push(
      [this.t("omp_status"), this.t(`omp_${t.omp.state}`)],
      [this.t("background_jobs"), t.omp.background_jobs]
    ), o && v.push([this.t("workspace"), o.workspace_id], [this.t("tab"), o.tab_id]), r && v.push(
      [this.t("live"), r.live === null ? this.t("not_reported") : this.t(r.live ? "live" : "not_live")],
      [this.t("hibernated"), this.t(r.hibernated ? "yes" : "no")],
      [this.t("orphan"), this.t(r.orphan ? "yes" : "no")]
    ), p`<li class=${s.lastKnown ? "last-known" : ""}>
      <button class="agent-row" data-pane=${t.pane_id} aria-expanded=${String(i)} aria-controls=${m}
        aria-label=${`${t.agent}, ${this.t("pane_accessible")} ${t.pane_id}, ${n}${l !== t.agent ? `, ${l}` : ""}${s.lastKnown ? `, ${this.t("last_known")}` : ""}. ${this.t(i ? "hide_details" : "show_details")}`}
        @click=${() => this.toggleDetails(t.identity)}>
        <span class="agent-icon" aria-hidden="true">${ae`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="5" width="12" height="11" rx="3"/><path d="M10 2v3M1 9h3m12 0h3M7 16v2m6-2v2"/><circle cx="7.5" cy="10" r=".75" fill="currentColor"/><circle cx="12.5" cy="10" r=".75" fill="currentColor"/><path d="M7 13h6"/></svg>`}</span>
        <span class="agent-copy"><span class="agent-name">${l}</span>
          ${y.length ? p`<span class="identity">${y.join(" · ")}</span>` : h}
          ${d || f ? p`<span class="metadata">${d ? p`${this.t("model")}: ${c}` : h}${d && f ? " · " : h}${f ? p`${this.t("effort")}: ${_}` : h}</span>` : h}
          ${this.config?.show_derived_label && (a || o?.label) && !o?.name?.trim() ? p`<span class="metadata">${this.t("derived")}</span>` : h}
          ${this.config?.show_lifecycle && (r?.hibernated || r?.orphan || r?.live === !1) ? p`<span class="metadata">${r.hibernated ? this.t("hibernated") : ""} ${r.orphan ? this.t("orphan") : ""} ${r.live === !1 ? this.t("not_live") : ""}</span>` : h}
        </span>
        <span class="status" data-status=${t.status}><span class="dot" aria-hidden="true"></span>${n}</span>
        <span class="chevron" aria-hidden="true">${i ? "⌄" : "›"}</span>
      </button>
      <dl id=${m} ?hidden=${!i}>${i ? v.map(([g, Kt]) => p`<dt>${g}</dt><dd>${Kt ?? this.t("not_reported")}</dd>`) : h}</dl>
    </li>`;
  }
  tabVisible(t) {
    return t.agents.length ? Y(t.agents, this.config).length > 0 : (this.config?.statuses ?? it).includes("unknown") && (!this.config?.agent_types?.length || !!t.tab.detected_agent && this.config.agent_types.includes(t.tab.detected_agent));
  }
  renderTab(t, s) {
    if (!this.tabVisible(t)) return h;
    const i = Y(t.agents, this.config), n = Ft(i), o = Pt(s, n);
    return p`<li class="tab-group" data-tab=${t.tab.tab_id}>
      <div class="group-head"><h3>${(t.tab.name?.trim() ? t.tab.name : null) ?? o ?? (t.tab.label?.trim() ? t.tab.label : null) ?? `${this.t("tab")} ${t.tab.ordinal ?? t.tab.tab_id}`}</h3>
        ${n ? p`<span>${this.config?.show_agent_type ? `${n.agent} · ` : ""}${this.t(n.status)}${n.inferred ? ` (${this.t("inferred")})` : ""}</span>` : p`<span>${this.config?.show_agent_type && t.tab.detected_agent ? `${t.tab.detected_agent} · ` : ""}${this.t("unknown")}${this.config?.show_agent_type && t.tab.detected_agent ? ` · ${this.t("detected_only")}` : ""}</span>`}
        ${this.config?.show_lifecycle && t.tab.hibernated ? p`<span>${this.t("hibernated")}</span>` : h}
        ${this.config?.show_group_name && t.tab.group_name ? p`<span>${t.tab.group_name}</span>` : h}
        ${this.config?.show_derived_label && !t.tab.name?.trim() && (o || t.tab.label) ? p`<span>${this.t("derived")}</span>` : h}
      </div>
      ${i.length ? p`<ul>${$(i, (r) => r.identity, (r) => this.renderAgent(r, s))}</ul>` : h}
    </li>`;
  }
  renderInventoryRemainder(t) {
    if (!(this.config?.statuses ?? it).includes("unknown") || this.config?.agent_types?.length) return h;
    const s = t.inventory?.panes.filter((i) => i.orphan && !t.agents.some((n) => n.pane_id === i.pane_id)) ?? [];
    return s.length ? p`<ul class="inventory-panes">${$(s, (i) => i.pane_id, (i) => p`<li class="notice">${this.config?.show_lifecycle ? `${this.t("orphan")} · ` : ""}${this.t("pane")} ${i.pane_id} · ${this.t("unknown")}${this.config?.show_lifecycle && i.live !== null ? ` · ${this.t(i.live ? "live" : "not_live")}` : ""}${this.config?.show_lifecycle && i.hibernated ? ` · ${this.t("hibernated")}` : ""}</li>`)}</ul>` : h;
  }
  renderRows(t) {
    const s = Y(t.agents, this.config);
    if (this.config?.group_by === "workspace" && t.inventory) {
      const i = Oe(t).filter((o) => o.tabs.some((r) => this.tabVisible(r))), n = tt(t).filter((o) => !t.inventory.workspaces.some((r) => r.workspace_id === o.tab.workspace_id));
      return p`${$(i, (o) => o.identity, (o) => p`<div class="workspace-group" data-workspace=${o.workspace.workspace_id}>
        <h3 class="workspace-title">${o.workspace.name ?? `${this.t("workspace")} ${o.workspace.workspace_id}`}</h3><ul>${$(o.tabs, (r) => r.identity, (r) => this.renderTab(r, t))}</ul></div>`)}
        ${n.length ? p`<ul>${$(n, (o) => o.identity, (o) => this.renderTab(o, t))}</ul>` : h}
        <ul>${$(s.filter((o) => !V(t.inventory, o.pane_id)), (o) => o.identity, (o) => this.renderAgent(o, t))}</ul>${this.renderInventoryRemainder(t)}`;
    }
    return this.config?.group_by === "tab" && t.inventory ? p`<ul>${$(tt(t), (i) => i.identity, (i) => this.renderTab(i, t))}
      ${$(s.filter((i) => !V(t.inventory, i.pane_id)), (i) => i.identity, (i) => this.renderAgent(i, t))}</ul>${this.renderInventoryRemainder(t)}` : p`<ul>${$(s, (i) => i.identity, (i) => this.renderAgent(i, t))}
      ${$(tt(t).filter((i) => !i.agents.length), (i) => i.identity, (i) => this.renderTab(i, t))}</ul>${this.renderInventoryRemainder(t)}`;
  }
  renderHost(t) {
    const s = Y(t.agents, this.config), i = Object.values(t.confirmedCounts).reduce((r, a) => r + a, 0), n = `notice_${t.state}`, o = Vt.filter((r) => r !== "ready" && t.agents.some((a) => a.omp?.state === r));
    return p`<section aria-label=${t.config.name}>
      <div class="host-head"><div class="host-title"><h2>${t.config.name}</h2><span class="host-state" data-state=${t.state} role="status">${this.t(t.state)}</span></div>
        ${this.config?.show_last_contact ? p`<p class="receipt">${t.lastContact === null ? this.t("no_receipt") : p`${this.t("last_contact")}: <time datetime=${t.lastContact}>${Q(t.lastContact, this.currentHass)}</time>`}</p>` : h}
        ${this.config?.show_last_success && t.lastSuccess !== null ? p`<p class="receipt">${this.t("last_success")}: <time datetime=${t.lastSuccess}>${Q(t.lastSuccess, this.currentHass)}</time></p>` : h}
        ${this.config?.show_summary ? p`<p class="summary">${t.agents.length} ${this.t("reported")} · ${i} ${this.t("confirmed")} · ${t.inferredCount} ${this.t("inferred")} · ${t.weakCount} ${this.t("weak")} · ${t.unknownOriginCount} ${this.t("unknown_origin")}</p>` : h}
        ${this.config?.show_inventory_summary && t.inventory ? p`<p class="inventory-summary">${t.inventory.workspaces.length} ${this.t("workspaces")} · ${t.inventory.tabs.length} ${this.t("tabs")} · ${t.inventory.panes.length} ${this.t("panes")}</p>` : h}
        ${this.config?.show_filtered_count ? p`<p class="filtered-count">${s.length} / ${t.agents.length} ${this.t("filtered")}</p>` : h}
      </div>
      ${t.state !== "healthy" ? p`<p class="notice">${this.t(n)}${t.errorCode ? p` ${this.t(t.errorCode)}.` : h}</p>` : h}
      ${o.length ? p`<p class="notice omp-warning" role="status">${this.t("omp_unavailable")} · ${o.map((r) => this.t(`omp_${r}`)).join(", ")}</p>` : h}
      ${this.config?.show_inventory_status || t.inventoryState === "error" || t.inventoryState === "stale" || t.inventory && !t.inventory.consistent ? p`<p class="notice inventory-state" data-inventory-state=${t.inventoryState}>${this.t(`inventory_${t.inventoryState}`)}${t.inventoryErrorCode ? p` · ${this.t(t.inventoryErrorCode)}` : h}${t.inventory && !t.inventory.consistent ? p` · ${this.t("inventory_pending")}` : h}</p>` : h}
      ${this.config?.show_inventory_last_contact && t.inventoryLastContact ? p`<p class="notice inventory-contact">${this.t("inventory_contact")}: <time datetime=${t.inventoryLastContact}>${Q(t.inventoryLastContact, this.currentHass)}</time></p>` : h}
      ${this.config?.show_inventory_last_success && t.inventoryLastSuccess ? p`<p class="notice inventory-success">${this.t("inventory_success")}: <time datetime=${t.inventoryLastSuccess}>${Q(t.inventoryLastSuccess, this.currentHass)}</time></p>` : h}
      ${this.renderRows(t)}
    </section>`;
  }
  render() {
    if (!this.config) return p`<ha-card><p class="configuration"><strong>${this.t(this.configurationError ? "configuration_error" : "not_configured")}</strong><br>${this.t("configuration_help")}</p></ha-card>`;
    if (!this.config.hosts.length) return p`<ha-card><p class="configuration"><strong>${this.t("no_hosts")}</strong><br>${this.t("setup_help")}</p></ha-card>`;
    const t = this.config.hosts.map((n) => je(n, this.currentHass?.states ?? {}, this.currentHass?.connection?.connected ?? !0)).sort((n, o) => n.config.name.localeCompare(o.config.name, "en") || n.config.roster_entity.localeCompare(o.config.roster_entity, "en")), s = new Set(t.flatMap((n) => n.agents.map((o) => o.identity)));
    for (const n of this.expanded) s.has(n) || this.expanded.delete(n);
    const i = this.config.appearance === "home-assistant";
    return p`<ha-card .header=${i ? this.config.title ?? this.t("title") : void 0}>
      ${!i || t.length > 1 ? p`<header>${i ? h : p`<h1>${this.config.title ?? this.t("title")}</h1>`}
        ${t.length > 1 ? p`<label>${this.t("show_host")}<select aria-label=${this.t("show_host")} .value=${this.selectedHost}
          @change=${(n) => {
      this.selectedHost = n.target.value, this.requestUpdate();
    }}>
          <option value="">${this.t("all_hosts")}</option>${t.map((n) => p`<option value=${n.config.roster_entity}>${n.config.name}</option>`)}</select></label>` : h}</header>` : h}
      ${$(t.filter((n) => !this.selectedHost || n.config.roster_entity === this.selectedHost), (n) => n.config.roster_entity, (n) => this.renderHost(n))}
    </ha-card>`;
  }
}
customElements.get("ha-tty7-card") || customElements.define("ha-tty7-card", Me);
window.customCards ??= [];
window.customCards.some((e) => e.type === "ha-tty7-card") || window.customCards.push({ type: "ha-tty7-card", name: "HA-tty7", description: "Read-only structured tty7 agent status grouped by host.", preview: !0 });
export {
  Me as HaTty7Card
};
