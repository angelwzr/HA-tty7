import { LitElement, css, html } from 'lit';

// Development-only boundary adapter: native browser controls implement HA's documented
// selector property/value-changed contract. Actual HA selectors are exercised by isolated HA UAT.
interface FixtureSelector { select?: { options: { value: string; label: string }[] }; text?: object }
class FixtureHaSelector extends LitElement {
  static override properties = { selector: { attribute: false }, value: {}, label: {} };
  static override shadowRootOptions: ShadowRootInit = { mode: 'open', delegatesFocus: true };
  static override styles = css`
    :host { display: block; }
    label { display: grid; gap: 6px; }
    input, select { box-sizing: border-box; width: 100%; min-width: 0; min-height: 44px;
      color: inherit; background: var(--card-background-color, white); font: inherit; font-size: 16px; padding: 8px; }
    input:focus-visible, select:focus-visible { outline: 2px solid #1f6bf0; outline-offset: 2px; }
  `;
  declare selector: FixtureSelector;
  declare value: string;
  declare label: string;
  private change(event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.dispatchEvent(new CustomEvent('value-changed', { detail: { value }, bubbles: true, composed: true }));
  }
  protected override render() {
    return html`<label>${this.label}${this.selector.select ? html`
      <select .value=${this.value ?? ''} @change=${this.change}>
        <option value="">Choose a host</option>
        ${this.selector.select.options.map(option => html`<option value=${option.value}>${option.label}</option>`)}
      </select>` : html`<input type="text" .value=${this.value ?? ''} @input=${this.change}>`}</label>`;
  }
}
if (!customElements.get('ha-selector')) customElements.define('ha-selector', FixtureHaSelector);
