// ==UserScript==
// @name         Flow IQ TOT - Panel
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Shift selector below Inventory History
// @match        https://qifcr.na.aftx.amazonoperations.app/XYY1/results*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const TABLE_ID = 'table-inventory-history';
  const PANEL_ID = 'flowiq-tot-panel';
  const STATUS_ID = 'flowiq-tot-status';
  const STORAGE_KEY = 'flowiq-tot-shift';
  const STYLE_ID = 'flowiq-tot-panel-style';

  function addStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');

    style.id = STYLE_ID;

    style.textContent = `
      #${PANEL_ID} {
        position: relative !important;
        z-index: 10 !important;
        display: flex !important;
        align-items: center !important;
        flex-wrap: wrap !important;
        gap: 14px !important;
        width: fit-content !important;
        max-width: 100% !important;
        margin: 10px 0 12px 0 !important;
        padding: 9px 13px !important;
        border: 1px solid #879596 !important;
        border-radius: 6px !important;
        background: #f3f3f3 !important;
        color: #111111 !important;
        box-shadow: none !important;
        font-family: Arial, sans-serif !important;
        font-size: 13px !important;
        line-height: normal !important;
        box-sizing: border-box !important;
      }

      #${PANEL_ID} strong {
        font-weight: 800 !important;
      }

      #${PANEL_ID} label {
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        margin: 0 !important;
        white-space: nowrap !important;
        cursor: pointer !important;
        font-weight: 700 !important;
      }

      #${PANEL_ID} input[type="radio"] {
        width: 16px !important;
        height: 16px !important;
        margin: 0 !important;
        opacity: 1 !important;
        appearance: auto !important;
        cursor: pointer !important;
      }

      #flowiq-tot-apply {
        min-height: 31px !important;
        padding: 5px 13px !important;
        border: 1px solid #879596 !important;
        border-radius: 4px !important;
        background: #ffffff !important;
        color: #111111 !important;
        cursor: pointer !important;
        font-weight: 700 !important;
      }

      #flowiq-tot-apply:hover {
        background: #f7fafa !important;
      }

      #flowiq-tot-apply:disabled {
        opacity: 0.65 !important;
        cursor: wait !important;
      }

      #${STATUS_ID} {
        color: #565959 !important;
        font-weight: 700 !important;
        white-space: nowrap !important;
      }
    `;

    document.head.appendChild(style);
  }

  function getSelectedShift() {
    return localStorage.getItem(STORAGE_KEY) === 'afternoon'
      ? 'afternoon'
      : 'morning';
  }

  function findInventoryHistoryHeading() {
    return [
      ...document.querySelectorAll(
        'h1, h2, h3, h4, div, span'
      )
    ].find(element => {
      return (
        element.children.length === 0 &&
        element.textContent
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase() === 'inventory history'
      );
    }) || null;
  }

  function insertPanel(panel) {
    const heading = findInventoryHistoryHeading();

    if (heading) {
      const headingContainer =
        heading.closest(
          '.a-row, .a-section, header'
        ) ||
        heading.parentElement;

      if (
        headingContainer &&
        headingContainer.parentElement
      ) {
        headingContainer.insertAdjacentElement(
          'afterend',
          panel
        );

        return true;
      }
    }

    const wrapper = document.getElementById(
      `${TABLE_ID}_wrapper`
    );

    if (wrapper?.parentElement) {
      wrapper.parentElement.insertBefore(
        panel,
        wrapper
      );

      return true;
    }

    const table = document.getElementById(TABLE_ID);

    if (table?.parentElement) {
      table.parentElement.insertBefore(
        panel,
        table
      );

      return true;
    }

    return false;
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) {
      updatePanelSelection();
      return true;
    }

    const table = document.getElementById(TABLE_ID);

    if (!table) {
      return false;
    }

    const panel = document.createElement('div');

    panel.id = PANEL_ID;

    panel.innerHTML = `
      <strong>TOT Shift:</strong>

      <label>
        <input
          type="radio"
          name="flowiq-tot-shift"
          value="morning"
        >
        Morning 05:00–15:30
      </label>

      <label>
        <input
          type="radio"
          name="flowiq-tot-shift"
          value="afternoon"
        >
        Afternoon 16:00–02:30
      </label>

      <button
        id="flowiq-tot-apply"
        type="button"
      >
        Apply TOT
      </button>

      <span id="${STATUS_ID}">
        Ready
      </span>
    `;

    if (!insertPanel(panel)) {
      return false;
    }

    panel
      .querySelectorAll(
        'input[name="flowiq-tot-shift"]'
      )
      .forEach(input => {
        input.addEventListener('change', () => {
          if (!input.checked) {
            return;
          }

          localStorage.setItem(
            STORAGE_KEY,
            input.value
          );

          updateStatus(
            input.value === 'morning'
              ? 'Morning selected'
              : 'Afternoon selected'
          );
        });
      });

    panel
      .querySelector('#flowiq-tot-apply')
      .addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();

        const selected = panel.querySelector(
          'input[name="flowiq-tot-shift"]:checked'
        );

        const shift =
          selected?.value ||
          getSelectedShift();

        localStorage.setItem(
          STORAGE_KEY,
          shift
        );

        window.dispatchEvent(
          new CustomEvent('flowiq-apply-tot', {
            detail: {
              shift
            }
          })
        );
      });

    updatePanelSelection();

    return true;
  }

  function updatePanelSelection() {
    const selected = getSelectedShift();

    document
      .querySelectorAll(
        `#${PANEL_ID} input[name="flowiq-tot-shift"]`
      )
      .forEach(input => {
        input.checked =
          input.value === selected;
      });
  }

  function updateStatus(message) {
    const status =
      document.getElementById(
        STATUS_ID
      );

    if (status) {
      status.textContent =
        String(message || '');
    }
  }

  function start() {
    addStyles();
    createPanel();

    window.addEventListener(
      'flowiq-tot-status',
      event => {
        updateStatus(
          event.detail?.message
        );
      }
    );

    window.setInterval(() => {
      if (
        !document.getElementById(
          PANEL_ID
        )
      ) {
        createPanel();
      }
    }, 1500);
  }

  if (document.body) {
    start();
  } else {
    window.addEventListener(
      'DOMContentLoaded',
      start,
      {
        once: true
      }
    );
  }
})();