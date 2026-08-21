// ==UserScript==
// @name         Flow IQ - Quick Scroll
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Scroll only inside Inventory History table
// @author       Dish Dudhat
// @match        https://qifcr.na.aftx.amazonoperations.app/XYY1/results*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const TABLE_ID = 'table-inventory-history';
  const PANEL_ID = 'flowiq-tot-panel';

  const BOTTOM_BUTTON_ID = 'flowiq-scroll-bottom';
  const TOP_BUTTON_ID = 'flowiq-scroll-top';
  const STYLE_ID = 'flowiq-quick-scroll-style';

  function addStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');

    style.id = STYLE_ID;

    style.textContent = `
      #${BOTTOM_BUTTON_ID},
      #${TOP_BUTTON_ID} {
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

      #${BOTTOM_BUTTON_ID}:hover,
      #${TOP_BUTTON_ID}:hover {
        background: #f3f7f7 !important;
      }
    `;

    document.head.appendChild(style);
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
      const dataTablesBody =
        wrapper.querySelector(
          '.dataTables_scrollBody'
        );

      if (dataTablesBody) {
        return dataTablesBody;
      }

      const dtScrollBody =
        wrapper.querySelector(
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
      const style =
        window.getComputedStyle(element);

      const overflowY =
        style.overflowY;

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

  function scrollTableToBottom() {
    const container =
      getScrollContainer();

    if (!container) {
      console.warn(
        '[Flow IQ Quick Scroll] Table scroll container not found.'
      );

      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth'
    });
  }

  function scrollTableToTop() {
    const container =
      getScrollContainer();

    if (!container) {
      console.warn(
        '[Flow IQ Quick Scroll] Table scroll container not found.'
      );

      return;
    }

    container.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  function createButton(
    id,
    text,
    title,
    handler
  ) {
    const button =
      document.createElement('button');

    button.id = id;
    button.type = 'button';
    button.textContent = text;
    button.title = title;

    button.addEventListener(
      'click',
      event => {
        event.preventDefault();
        event.stopPropagation();

        handler();
      }
    );

    return button;
  }

  function addButtons() {
    const panel =
      document.getElementById(PANEL_ID);

    if (!panel) {
      return;
    }

    if (
      !document.getElementById(
        BOTTOM_BUTTON_ID
      )
    ) {
      const bottomButton =
        createButton(
          BOTTOM_BUTTON_ID,
          '↓ Bottom',
          'Scroll Inventory History to bottom',
          scrollTableToBottom
        );

      panel.appendChild(
        bottomButton
      );
    }

    if (
      !document.getElementById(
        TOP_BUTTON_ID
      )
    ) {
      const topButton =
        createButton(
          TOP_BUTTON_ID,
          '↑ Top',
          'Scroll Inventory History to top',
          scrollTableToTop
        );

      panel.appendChild(
        topButton
      );
    }
  }

  function start() {
    addStyles();
    addButtons();

    window.setInterval(
      addButtons,
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