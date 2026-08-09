// ==UserScript==
// @name         Flow IQ TOT - Cage Counter
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  Counts unique cages across every selected shift in the date range
// @match        https://qifcr.na.aftx.amazonoperations.app/XYY1/results*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const TABLE_ID = 'table-inventory-history';
  const PANEL_ID = 'flowiq-tot-panel';
  const APPLY_ID = 'flowiq-tot-apply';
  const DISPLAY_ID = 'flowiq-total-cages';
  const STORAGE_KEY = 'flowiq-tot-shift';
  const TOT_CLASS = 'flowiq-tot-gap';
  const STYLE_ID = 'flowiq-cage-counter-style';

  const DATE_COLUMN = 0;
  const OLD_BIN_COLUMN = 9;

  const clean = value =>
    String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();

  function addStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');

    style.id = STYLE_ID;

    style.textContent = `
      #${DISPLAY_ID} {
        display: inline-flex !important;
        align-items: center !important;
        min-height: 30px !important;
        padding: 4px 10px !important;
        border: 1px solid #aab7b8 !important;
        border-radius: 4px !important;
        background: #ffffff !important;
        color: #111111 !important;
        font-weight: 800 !important;
        white-space: nowrap !important;
      }
    `;

    document.head.appendChild(style);
  }

  function addDisplay() {
    if (document.getElementById(DISPLAY_ID)) {
      return true;
    }

    const panel = document.getElementById(PANEL_ID);

    if (!panel) {
      return false;
    }

    const display = document.createElement('span');

    display.id = DISPLAY_ID;
    display.textContent = 'Total Cages: —';

    const button = document.getElementById(APPLY_ID);

    if (button) {
      button.after(display);
    } else {
      panel.appendChild(display);
    }

    return true;
  }

  function setTotal(value) {
    addDisplay();

    const display = document.getElementById(DISPLAY_ID);

    if (display) {
      display.textContent = `Total Cages: ${value}`;
    }
  }

  function parseDateTime(value) {
    const text = clean(value);

    if (!text) {
      return null;
    }

    let match = text.match(
      /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
    );

    if (match) {
      const date = new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5]),
        Number(match[6] || 0)
      );

      return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(text);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  function parseDateOnly(value) {
    const text = clean(value);

    let match = text.match(
      /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/
    );

    if (match) {
      let year = Number(match[3]);

      if (year < 100) {
        year += 2000;
      }

      const date = new Date(
        year,
        Number(match[1]) - 1,
        Number(match[2]),
        0,
        0,
        0,
        0
      );

      return Number.isNaN(date.getTime()) ? null : date;
    }

    match = text.match(
      /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/
    );

    if (match) {
      const date = new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        0,
        0,
        0,
        0
      );

      return Number.isNaN(date.getTime()) ? null : date;
    }

    return null;
  }

  function findDateInput(labelText) {
    const labels = [
      ...document.querySelectorAll(
        'label, span, div, strong'
      )
    ].filter(element => {
      return (
        clean(element.textContent).toLowerCase() ===
        labelText.toLowerCase()
      );
    });

    for (const label of labels) {
      const containers = [
        label.parentElement,
        label.parentElement?.parentElement,
        label.closest('.a-section'),
        label.closest('.a-row')
      ].filter(Boolean);

      for (const container of containers) {
        for (const input of container.querySelectorAll('input')) {
          if (parseDateOnly(input.value)) {
            return input;
          }
        }
      }
    }

    return null;
  }

  function getSelectedDateRange() {
    const startInput = findDateInput('Start date');
    const endInput = findDateInput('End date');

    let startDate = parseDateOnly(startInput?.value);
    let endDate = parseDateOnly(endInput?.value);

    if (!startDate || !endDate) {
      const dateInputs = [
        ...document.querySelectorAll('input')
      ]
        .map(input => parseDateOnly(input.value))
        .filter(Boolean);

      if (!startDate) {
        startDate = dateInputs[0] || null;
      }

      if (!endDate) {
        endDate = dateInputs[1] || null;
      }
    }

    if (!startDate || !endDate) {
      return null;
    }

    if (startDate.getTime() > endDate.getTime()) {
      [startDate, endDate] = [endDate, startDate];
    }

    return {
      startDate,
      endDate
    };
  }

  function getSelectedShiftId() {
    const checked = document.querySelector(
      `#${PANEL_ID} input[name="flowiq-tot-shift"]:checked`
    );

    if (checked?.value === 'afternoon') {
      return 'afternoon';
    }

    if (checked?.value === 'morning') {
      return 'morning';
    }

    return localStorage.getItem(STORAGE_KEY) === 'afternoon'
      ? 'afternoon'
      : 'morning';
  }

  function createShiftWindows(range, shiftId) {
    const windows = [];

    const current = new Date(
      range.startDate.getFullYear(),
      range.startDate.getMonth(),
      range.startDate.getDate(),
      0,
      0,
      0,
      0
    );

    const finalDate = new Date(
      range.endDate.getFullYear(),
      range.endDate.getMonth(),
      range.endDate.getDate(),
      0,
      0,
      0,
      0
    );

    while (current.getTime() <= finalDate.getTime()) {
      let start;
      let end;

      if (shiftId === 'afternoon') {
        start = new Date(
          current.getFullYear(),
          current.getMonth(),
          current.getDate(),
          16,
          0,
          0,
          0
        );

        end = new Date(
          current.getFullYear(),
          current.getMonth(),
          current.getDate() + 1,
          2,
          30,
          0,
          0
        );
      } else {
        start = new Date(
          current.getFullYear(),
          current.getMonth(),
          current.getDate(),
          5,
          0,
          0,
          0
        );

        end = new Date(
          current.getFullYear(),
          current.getMonth(),
          current.getDate(),
          15,
          30,
          0,
          0
        );
      }

      windows.push({
        start,
        end
      });

      current.setDate(current.getDate() + 1);
    }

    return windows;
  }

  function isInsideAnyWindow(date, windows) {
    if (
      !(date instanceof Date) ||
      Number.isNaN(date.getTime())
    ) {
      return false;
    }

    const time = date.getTime();

    return windows.some(window => {
      return (
        time >= window.start.getTime() &&
        time <= window.end.getTime()
      );
    });
  }

  function getOriginalCells(row) {
    return [...row.children].filter(cell => {
      return !cell.classList.contains(TOT_CLASS);
    });
  }

  function getRecords() {
    const table = document.getElementById(TABLE_ID);

    if (!table) {
      return [];
    }

    return [
      ...table.querySelectorAll('tbody tr')
    ]
      .filter(row => {
        return !row.querySelector('.dataTables_empty');
      })
      .map(row => {
        const cells = getOriginalCells(row);

        return {
          date: parseDateTime(
            cells[DATE_COLUMN]?.textContent
          ),
          oldBin: clean(
            cells[OLD_BIN_COLUMN]?.textContent
          )
        };
      })
      .filter(record => record.date);
  }

  function countCages() {
    addDisplay();

    const range = getSelectedDateRange();

    if (!range) {
      setTotal('Date error');
      return;
    }

    const shiftId = getSelectedShiftId();

    const windows = createShiftWindows(
      range,
      shiftId
    );

    const records = getRecords();

    if (!records.length) {
      setTotal('No rows');
      return;
    }

    const cages = new Set();

    for (const record of records) {
      if (!isInsideAnyWindow(record.date, windows)) {
        continue;
      }

      const cage = clean(
        record.oldBin
      ).toLowerCase();

      if (
        /^tscage[a-z0-9_-]*$/i.test(cage)
      ) {
        cages.add(cage);
      }
    }

    setTotal(cages.size);
  }

  function start() {
    addStyles();
    addDisplay();

    document.addEventListener(
      'click',
      event => {
        const button = event.target.closest?.(
          `#${APPLY_ID}`
        );

        if (!button) {
          return;
        }

        window.setTimeout(
          countCages,
          150
        );
      },
      true
    );

    document.addEventListener(
      'change',
      event => {
        const input = event.target.closest?.(
          `#${PANEL_ID} input[name="flowiq-tot-shift"]`
        );

        if (!input) {
          return;
        }

        window.setTimeout(
          countCages,
          50
        );
      },
      true
    );

    window.setInterval(() => {
      addDisplay();
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