import { LitElement, html, TemplateResult, CSSResult, css } from "lit-element";
import { classMap } from "lit-html/directives/class-map";
import yaml from "js-yaml";

import "@polymer/app-layout/app-header-layout/app-header-layout";
import "@polymer/app-layout/app-header/app-header";
import "@polymer/app-layout/app-toolbar/app-toolbar";
import "@material/mwc-button";
import "@polymer/paper-icon-button/paper-icon-button";
import "@polymer/paper-spinner/paper-spinner";

import { struct } from "./common/structs/struct";
import { Lovelace } from "./types";

import "../../components/ha-icon";
import { haStyle } from "../../resources/styles";
import "../../components/ha-code-editor";
// This is not a duplicate import, one is for types, one is for element.
// tslint:disable-next-line
import { HaCodeEditor } from "../../components/ha-code-editor";
import { HomeAssistant } from "../../types";
import { computeRTL } from "../../common/util/compute_rtl";

const lovelaceStruct = struct.interface({
  title: "string?",
  views: ["object"],
  resources: struct.optional(["object"]),
});

class LovelaceFullConfigEditor extends LitElement {
  public hass!: HomeAssistant;
  public lovelace?: Lovelace;
  public closeEditor?: () => void;
  private _saving?: boolean;
  private _changed?: boolean;
  private _generation = 1;

  static get properties() {
    return {
      hass: {},
      lovelace: {},
      closeEditor: {},
      _saving: {},
      _changed: {},
    };
  }

  public render(): TemplateResult | void {
    return html`
      <app-header-layout>
        <app-header>
          <app-toolbar>
            <paper-icon-button
              icon="hass:close"
              @click="${this._closeEditor}"
            ></paper-icon-button>
            <div main-title>
              ${this.hass!.localize(
                "ui.panel.lovelace.editor.raw_editor.header"
              )}
            </div>
            <div
              class="save-button
              ${classMap({
                saved: this._saving! === false || this._changed === true,
              })}"
            >
              ${this._changed
                ? this.hass!.localize(
                    "ui.panel.lovelace.editor.raw_editor.unsaved_changes"
                  )
                : this.hass!.localize(
                    "ui.panel.lovelace.editor.raw_editor.saved"
                  )}
            </div>
            <mwc-button raised @click="${this._handleSave}"
              >${this.hass!.localize(
                "ui.panel.lovelace.editor.raw_editor.save"
              )}</mwc-button
            >
          </app-toolbar>
        </app-header>
        <div class="content">
          <ha-code-editor
            mode="yaml"
            autofocus
            .rtl=${computeRTL(this.hass)}
            .hass="${this.hass}"
            @value-changed="${this._yamlChanged}"
            @editor-save="${this._handleSave}"
          >
          </ha-code-editor>
        </div>
      </app-header-layout>
    `;
  }

  protected firstUpdated() {
    this.yamlEditor.value = yaml.safeDump(this.lovelace!.config);
  }

  static get styles(): CSSResult[] {
    return [
      haStyle,
      css`
        :host {
          --code-mirror-height: 100%;
        }

        app-header-layout {
          height: 100vh;
        }

        app-toolbar {
          background-color: var(--dark-background-color, #455a64);
          color: var(--dark-text-color);
        }

        .comments {
          font-size: 16px;
        }

        .content {
          height: calc(100vh - 68px);
        }

        hui-code-editor {
          height: 100%;
        }

        .save-button {
          opacity: 0;
          font-size: 14px;
          padding: 0px 10px;
        }

        .saved {
          opacity: 1;
        }
      `,
    ];
  }

  private _yamlChanged() {
    this._changed = !this.yamlEditor
      .codemirror!.getDoc()
      .isClean(this._generation);
    if (this._changed && !window.onbeforeunload) {
      window.onbeforeunload = () => {
        return true;
      };
    } else if (!this._changed && window.onbeforeunload) {
      window.onbeforeunload = null;
    }
  }

  private _closeEditor() {
    if (this._changed) {
      if (
        !confirm("You have unsaved changes, are you sure you want to exit?")
      ) {
        return;
      }
    }
    window.onbeforeunload = null;
    if (this.closeEditor) {
      this.closeEditor();
    }
  }

  private async _handleSave() {
    this._saving = true;

    if (this.yamlEditor.hasComments) {
      if (
        !confirm(
          "Your config contains comment(s), these will not be saved. Do you want to continue?"
        )
      ) {
        return;
      }
    }

    let value;
    try {
      value = yaml.safeLoad(this.yamlEditor.value);
    } catch (err) {
      alert(`Unable to parse YAML: ${err}`);
      this._saving = false;
      return;
    }
    try {
      value = lovelaceStruct(value);
    } catch (err) {
      alert(`Your config is not valid: ${err}`);
      return;
    }
    try {
      await this.lovelace!.saveConfig(value);
    } catch (err) {
      alert(`Unable to save YAML: ${err}`);
    }
    this._generation = this.yamlEditor
      .codemirror!.getDoc()
      .changeGeneration(true);
    window.onbeforeunload = null;
    this._saving = false;
    this._changed = false;
  }

  private get yamlEditor(): HaCodeEditor {
    return this.shadowRoot!.querySelector("ha-code-editor")! as HaCodeEditor;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-editor": LovelaceFullConfigEditor;
  }
}

customElements.define("hui-editor", LovelaceFullConfigEditor);
