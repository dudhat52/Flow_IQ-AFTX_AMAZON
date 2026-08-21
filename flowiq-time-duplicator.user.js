// ==UserScript==
// @name         Flow IQ TOT - Time Deduplicator
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Hides rows with duplicate scan timestamps
// @match        https://qifcr.na.aftx.amazonoperations.app/XYY1/results*
// @grant        none
// @autor        Dish Dudhat (Ajax - XYY1) (ddudhat@id-logistics.com)
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';

    const TABLE_ID = 'table-inventory-history';
    const PANEL_ID = 'flowiq-tot-panel';
    const PRODUCTIVITY_BUTTON_ID = 'flowiq-productivity-button';
    const APPLY_BUTTON_ID = 'flowiq-tot-apply';

    const BUTTON_ID = 'flowiq-time-deduplicator-button';
    const STYLE_ID = 'flowiq-time-deduplicator-style';

    const HIDDEN_CLASS = 'flowiq-duplicate-time-hidden';
    const BADGE_CLASS = 'flowiq-duplicate-time-badge';
    const TOT_CLASS = 'flowiq-tot-gap';

    const DATE_COLUMN = 0;

    let duplicatesHidden = false;
    let summary = null;

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

      #${BUTTON_ID}:disabled {
        opacity: 0.65 !important;
        cursor: wait !important;
      }

      #${TABLE_ID} tbody tr.${HIDDEN_CLASS} {
        display: none !important;
      }

      #${TABLE_ID} .${BADGE_CLASS} {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-width: 28px !important;
        height: 20px !important;
        margin-left: 7px !important;
        padding: 1px 6px !important;
        border-radius: 10px !important;
        background: #232f3e !important;
        color: #ffffff !important;
        font-size: 11px !important;
        font-weight: 800 !important;
        line-height: 18px !important;
        vertical-align: middle !important;
        box-sizing: border-box !important;
      }
    `;

        document.head.appendChild(style);
    }

    function getOriginalCells(row) {
        return [...row.children].filter(cell => {
            return !cell.classList.contains(TOT_CLASS);
        });
    }

    function getTimestamp(row) {
        const cells = getOriginalCells(row);

        return clean(
            cells[DATE_COLUMN]?.textContent
        );
    }

    function getRows() {
        const table = document.getElementById(TABLE_ID);

        if (!table) {
            return [];
        }

        return [
            ...table.querySelectorAll('tbody tr')
        ].filter(row => {
            return (
                !row.querySelector('.dataTables_empty') &&
                getOriginalCells(row).length > 0
            );
        });
    }

    function removeBadges() {
        const rows = getRows();

        for (const row of rows) {
            const cells = getOriginalCells(row);
            const dateCell = cells[DATE_COLUMN];

            if (!dateCell) {
                continue;
            }

            const text = clean(dateCell.textContent);

            dateCell.textContent = text.replace(
                /\s×\d+$/,
                ''
            );

            dateCell.title = '';
        }
    }

    function addCountBadge(row, count) {
        if (count <= 1) {
            return;
        }

        const cells = getOriginalCells(row);
        const dateCell = cells[DATE_COLUMN];

        if (!dateCell) {
            return;
        }

        const originalTime = clean(dateCell.textContent);

        dateCell.textContent = `${originalTime} ×${count}`;
        dateCell.title =
            `${count} rows have the exact same scan time`;
    }

    function restoreAllRows() {
        const table = document.getElementById(TABLE_ID);

        if (!table) {
            return;
        }

        table
            .querySelectorAll(
                `tbody tr.${HIDDEN_CLASS}`
            )
            .forEach(row => {
                row.classList.remove(HIDDEN_CLASS);
            });

        removeBadges();

        duplicatesHidden = false;
        summary = null;

        updateButton();
    }

    function hideDuplicateTimes() {
        const rows = getRows();

        if (!rows.length) {
            setButtonText('No Rows Found');
            return;
        }

        restoreAllRows();

        const groups = new Map();

        for (const row of rows) {
            const timestamp = getTimestamp(row);

            if (!timestamp) {
                continue;
            }

            if (!groups.has(timestamp)) {
                groups.set(timestamp, []);
            }

            groups.get(timestamp).push(row);
        }

        let hiddenRows = 0;
        let duplicateTimes = 0;

        for (const timestampRows of groups.values()) {
            if (timestampRows.length <= 1) {
                continue;
            }

            duplicateTimes += 1;

            addCountBadge(
                timestampRows[0],
                timestampRows.length
            );

            for (
                let index = 1;
                index < timestampRows.length;
                index += 1
            ) {
                timestampRows[index]
                    .classList
                    .add(HIDDEN_CLASS);

                hiddenRows += 1;
            }
        }

        duplicatesHidden = true;

        summary = {
            originalRows: rows.length,
            visibleRows: rows.length - hiddenRows,
            hiddenRows,
            uniqueTimes: groups.size,
            duplicateTimes
        };

        updateButton();
    }

    function setButtonText(text) {
        const button =
            document.getElementById(BUTTON_ID);

        if (button) {
            button.textContent = text;
        }
    }

    function updateButton() {
        const button =
            document.getElementById(BUTTON_ID);

        if (!button) {
            return;
        }

        if (!duplicatesHidden) {
            button.textContent =
                'Hide Duplicate Times';

            button.title =
                'Keep one row for each exact scan timestamp';

            return;
        }

        button.textContent =
            'Show All Times';

        if (summary) {
            button.title = [
                `${summary.hiddenRows} duplicate rows hidden`,
                `${summary.visibleRows} rows visible`,
                `${summary.uniqueTimes} unique scan times`
            ].join('\n');
        }
    }

    function toggleDuplicateTimes() {
        const button =
            document.getElementById(BUTTON_ID);

        if (button) {
            button.disabled = true;
        }

        try {
            if (duplicatesHidden) {
                restoreAllRows();
            } else {
                hideDuplicateTimes();
            }
        } catch (error) {
            console.error(
                '[Flow IQ Time Deduplicator]',
                error
            );

            restoreAllRows();
            setButtonText('Time Filter Error');
        } finally {
            if (button) {
                button.disabled = false;
            }
        }
    }

    function addButton() {
        if (document.getElementById(BUTTON_ID)) {
            return true;
        }

        const panel =
            document.getElementById(PANEL_ID);

        if (!panel) {
            return false;
        }

        const button =
            document.createElement('button');

        button.id = BUTTON_ID;
        button.type = 'button';

        const productivityButton =
            document.getElementById(
                PRODUCTIVITY_BUTTON_ID
            );

        if (productivityButton) {
            productivityButton.after(button);
        } else {
            panel.appendChild(button);
        }

        updateButton();

        return true;
    }

    function resetFilter() {
        if (duplicatesHidden) {
            restoreAllRows();
        }
    }

    function start() {
        addStyles();
        addButton();

        document.addEventListener(
            'click',
            event => {
                const button =
                    event.target.closest?.(
                        `#${BUTTON_ID}`
                    );

                if (!button) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                toggleDuplicateTimes();
            },
            true
        );

        document.addEventListener(
            'click',
            event => {
                const applyButton =
                    event.target.closest?.(
                        `#${APPLY_BUTTON_ID}`
                    );

                if (applyButton) {
                    resetFilter();
                }
            },
            true
        );

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

                const text = clean(
                    element.textContent ||
                    element.value
                ).toLowerCase();

                if (text === 'search') {
                    resetFilter();
                }
            },
            true
        );

        window.setInterval(() => {
            addButton();
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