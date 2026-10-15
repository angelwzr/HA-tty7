import { LitElement, css, html, nothing } from 'lit';

// Synthetic development-only adapters for consumer interactions. These are NOT HA
// components and cannot establish native API, appearance or compatibility proof.
interface FixtureSelector {
  select?: { options: (string | { value: string; label: string })[]; multiple?: boolean; custom_value?: boolean };
  text?: object;
  boolean?: object;
}
class FixtureHaSelector extends LitElement {
  static override properties = { selector: { attribute: false }, value: { attribute: false }, label: {} };
  static override shadowRootOptions: ShadowRootInit = { mode: 'open', delegatesFocus: true };
  static override styles = css`
    :host { display: block; }
    label { display: grid; gap: 6px; }
    input, select { box-sizing: border-box; width: 100%; min-width: 0; min-height: 44px;
      color: inherit; background: var(--card-background-color, white); font: inherit; font-size: 16px; padding: 8px; }
    input[type=checkbox] { width: 44px; }
    input:focus-visible, select:focus-visible { outline: 2px solid #1f6bf0; outline-offset: 2px; }
  `;
  declare selector: FixtureSelector;
  declare value: unknown;
  declare label: string;
  private change(value: unknown): void {
    this.dispatchEvent(new CustomEvent('value-changed', { detail: { value }, bubbles: true, composed: true }));
  }
  protected override render() {
    if (this.selector.boolean) return html`<label><input type="checkbox" .checked=${this.value === true}
      @change=${(event: Event) => this.change((event.target as HTMLInputElement).checked)}>${this.label}</label>`;
    const select = this.selector.select;
    if (select) {
      const selected = Array.isArray(this.value) ? this.value : [this.value];
      return html`<label>${this.label}<select .value=${select.multiple ? nothing : this.value ?? ''} ?multiple=${select.multiple}
        @change=${(event: Event) => {
          const input = event.target as HTMLSelectElement;
          this.change(select.multiple ? Array.from(input.selectedOptions, option => option.value) : input.value);
        }}>
        ${!select.multiple ? html`<option value="">Choose an option</option>` : nothing}
        ${select.options.map(option => {
          const value = typeof option === 'string' ? option : option.value;
          return html`<option value=${value} .selected=${selected.includes(value)}>${typeof option === 'string' ? option : option.label}</option>`;
        })}
      </select></label>${select.custom_value ? html`<label>${this.label}: add type<input type="text"
        @change=${(event: Event) => {
          const input = event.target as HTMLInputElement;
          if (input.value) this.change([...new Set([...selected.filter(value => typeof value === 'string'), input.value])]);
          input.value = '';
        }}></label>` : nothing}`;
    }
    return html`<label>${this.label}<input type="text" .value=${this.value ?? ''}
      @input=${(event: Event) => this.change((event.target as HTMLInputElement).value)}></label>`;
  }
}
class FixtureHaButton extends LitElement {
  static override properties = { disabled: { type: Boolean }, accessibleName: { attribute: 'aria-label' } };
  static override shadowRootOptions: ShadowRootInit = { mode: 'open', delegatesFocus: true };
  static override styles = css`
    button { min-height: 44px; min-width: 44px; padding: 8px 16px; font: inherit; cursor: pointer; }
  `;
  declare disabled: boolean;
  declare accessibleName: string | undefined;
  protected override render() {
    return html`<button ?disabled=${this.disabled} aria-label=${this.accessibleName ?? nothing}><slot></slot></button>`;
  }
}
if (!customElements.get('ha-selector')) customElements.define('ha-selector', FixtureHaSelector);
if (!customElements.get('ha-button')) customElements.define('ha-button', FixtureHaButton);
