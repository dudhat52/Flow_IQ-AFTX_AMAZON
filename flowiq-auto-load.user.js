// ==UserScript==
// @name         Flow IQ - Auto Load All Rows
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Automatically loads all Inventory History rows
// @author       Dish Dudhat
// @match        https://qifcr.na.aftx.amazonoperations.app/XYY1/results*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const TABLE_ID = 'table-inventory-history';
  const PANEL_ID = 'flowiq-tot-panel';

  const BUTTON_ID = 'flowiq-auto-load-rows';
  const STYLE_ID = 'flowiq-auto-load-style';

  const CHECK_INTERVAL = 300;
  const MAX_NO_CHANGE_CHECKS = 2;
  const MAX_LOAD_TIME = 60000;

  let loading = false;
  let stopRequested = false;

  function addStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');

    style.id = STYLE_ID;

    style.textContent = `
      #${BUTTON_ID} {
        min-height: 31px !important;
        padding: 5px 13px !important;
        border: 1px solid #879596 !important;
        border-radius: 4px !important;
        background: #ffffff !important;
        color: #111111 !important;
        cursor: pointer !important;
        font-weight: 700 !important;
        white-space: nowrap !important;
      }

      #${BUTTON_ID}:hover {
        background: #f3f7f7 !important;
      }

      #${BUTTON_ID}.loading {
        background: #fff8e1 !important;
        border-color: #d6a700 !important;
      }

      #${BUTTON_ID}.complete {
        background: #e6f4ea !important;
        border-color: #188038 !important;
        color: #176b2c !important;
      }

      #${BUTTON_ID}.error {
        background: #fce8e6 !important;
        border-color: #d93025 !important;
        color: #a40000 !important;
      }
    `;

    document.head.appendChild(style);
  }

  function sleep(ms) {
    return new Promise(resolve => {
      window.setTimeout(resolve, ms);
    });
  }

  function getTable() {
    return document.getElementById(TABLE_ID);
  }

  function getScrollContainer() {
    const table = getTable();

    if (!table) {
      return null;
    }

    const wrapper = document.getElementById(
      `${TABLE_ID}_wrapper`
    );

    if (wrapper) {
      const dataTablesBody = wrapper.querySelector(
        '.dataTables_scrollBody'
      );

      if (dataTablesBody) {
        return dataTablesBody;
      }

      const dtScrollBody = wrapper.querySelector(
        '.dt-scroll-body'
      );

      if (dtScrollBody) {
        return dtScrollBody;
      }
    }

    let element = table.parentElement;

    while (
      element &&
      element !== document.body
    ) {
      const style = window.getComputedStyle(
        element
      );

      const overflowY = style.overflowY;

      if (
        overflowY === 'auto' ||
        overflowY === 'scroll'
      ) {
        return element;
      }

      element = element.parentElement;
    }

    return null;
  }

  function getRowCount() {
    const table = getTable();

    if (!table) {
      return 0;
    }

    return [
      ...table.querySelectorAll('tbody tr')
    ].filter(row => {
      return !row.querySelector(
        '.dataTables_empty'
      );
    }).length;
  }

  function setButton(
    text,
    state = ''
  ) {
    const button = document.getElementById(
      BUTTON_ID
    );

    if (!button) {
      return;
    }

    button.textContent = text;

    button.classList.remove(
      'loading',
      'complete',
      'error'
    );

    if (state) {
      button.classList.add(state);
    }
  }

  function fireScrollEvents(container) {
    container.dispatchEvent(
      new Event('scroll', {
        bubbles: true
      })
    );

    window.dispatchEvent(
      new Event('scroll')
    );
  }

  function moveToBottom(container) {
    container.scrollTop =
      container.scrollHeight;

    fireScrollEvents(container);
  }

  function moveToTop(container) {
    container.scrollTop = 0;

    fireScrollEvents(container);
  }

    async function waitForPossibleNewRows(
    previousCount
    ) {
        for (
            let attempt = 0;
            attempt < 3;
            attempt += 1
        ) {
            await sleep(CHECK_INTERVAL);

            const currentCount =
                  getRowCount();

            if (currentCount > previousCount) {
                return currentCount;
            }
        }

        return getRowCount();
    }

  async function loadAllRows() {
    if (loading) {
      stopRequested = true;

      setButton(
        'Stopping...',
        'loading'
      );

      return;
    }

    const table = getTable();

    if (!table) {
      setButton(
        'Run Search First',
        'error'
      );

      return;
    }

    const container =
      getScrollContainer();

    if (!container) {
      setButton(
        'Table Scroll Not Found',
        'error'
      );

      console.warn(
        '[Flow IQ Auto Load] Inventory History scroll container was not found.'
      );

      return;
    }

    loading = true;
    stopRequested = false;

    const startTime = Date.now();

    let previousCount =
      getRowCount();

    let noChangeChecks = 0;

    setButton(
      `Loading... ${previousCount} rows`,
      'loading'
    );

    try {
      while (!stopRequested) {
        if (
          Date.now() - startTime >
          MAX_LOAD_TIME
        ) {
          break;
        }

        moveToBottom(container);

        const currentCount =
          await waitForPossibleNewRows(
            previousCount
          );

        if (
          currentCount >
          previousCount
        ) {
          previousCount =
            currentCount;

          noChangeChecks = 0;

          setButton(
            `Loading... ${currentCount} rows`,
            'loading'
          );

          continue;
        }

        noChangeChecks += 1;

        setButton(
          `Checking... ${currentCount} rows`,
          'loading'
        );

        if (
          noChangeChecks >=
          MAX_NO_CHANGE_CHECKS
        ) {
          break;
        }

        moveToBottom(container);

        await sleep(
          CHECK_INTERVAL
        );
      }

      const finalCount =
        getRowCount();

      moveToTop(container);

      await sleep(250);

      if (stopRequested) {
        setButton(
          `Stopped · ${finalCount} rows`
        );
      } else {
        setButton(
          `✓ Loaded ${finalCount} Rows`,
          'complete'
        );
      }

      window.dispatchEvent(
        new CustomEvent(
          'flowiq-all-rows-loaded',
          {
            detail: {
              rows: finalCount
            }
          }
        )
      );

    } catch (error) {
      console.error(
        '[Flow IQ Auto Load]',
        error
      );

      setButton(
        'Load Error',
        'error'
      );

    } finally {
      loading = false;
      stopRequested = false;
    }
  }

  function addButton() {
    if (
      document.getElementById(
        BUTTON_ID
      )
    ) {
      return;
    }

    const panel =
      document.getElementById(
        PANEL_ID
      );

    if (!panel) {
      return;
    }

    const button =
      document.createElement(
        'button'
      );

    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent =
      'Load All Rows';

    button.title =
      'Automatically load all Inventory History rows';

    button.addEventListener(
      'click',
      event => {
        event.preventDefault();
        event.stopPropagation();

        loadAllRows();
      }
    );

    panel.appendChild(button);
  }

  function resetButtonAfterSearch() {
    const button =
      document.getElementById(
        BUTTON_ID
      );

    if (!button) {
      return;
    }

    button.textContent =
      'Load All Rows';

    button.classList.remove(
      'loading',
      'complete',
      'error'
    );
  }

  function start() {
    addStyles();
    addButton();

    document.addEventListener(
      'click',
      event => {
        const element =
          event.target.closest?.(
            'button, input[type="submit"]'
          );

        if (!element) {
          return;
        }

        const text = String(
          element.textContent ||
          element.value ||
          ''
        )
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();

        if (text === 'search') {
          stopRequested = true;

          window.setTimeout(
            resetButtonAfterSearch,
            500
          );
        }
      },
      true
    );

    window.setInterval(
      addButton,
      1500
    );
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