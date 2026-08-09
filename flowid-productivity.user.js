// ==UserScript==
// @name         Flow IQ TOT - Productivity Dashboard
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Calculates hourly scan productivity and overall hourly average
// @match        https://qifcr.na.aftx.amazonoperations.app/XYY1/results*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';

    const TABLE_ID = 'table-inventory-history';
    const PANEL_ID = 'flowiq-tot-panel';
    const APPLY_ID = 'flowiq-tot-apply';
    const CAGE_ID = 'flowiq-total-cages';
    const STORAGE_KEY = 'flowiq-tot-shift';
    const TOT_CLASS = 'flowiq-tot-gap';

    const BUTTON_ID = 'flowiq-productivity-button';
    const MODAL_ID = 'flowiq-productivity-modal';
    const STYLE_ID = 'flowiq-productivity-style';

    const DATE_COLUMN = 0;
    const PERSON_COLUMN = 8;

    const TARGET_PRODUCTIVITY = 65;
    const TOT_THRESHOLD_MINUTES = 5;

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

      #${MODAL_ID} {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483647 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 24px !important;
        background: rgba(0, 0, 0, 0.58) !important;
        box-sizing: border-box !important;
        font-family: Arial, sans-serif !important;
      }

      #${MODAL_ID}.flowiq-hidden {
        display: none !important;
      }

      #${MODAL_ID} .flowiq-productivity-window {
        width: min(1000px, 96vw) !important;
        max-height: 90vh !important;
        overflow-y: auto !important;
        border-radius: 10px !important;
        background: #ffffff !important;
        color: #111111 !important;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35) !important;
      }

      #${MODAL_ID} .flowiq-productivity-header {
        position: sticky !important;
        top: 0 !important;
        z-index: 2 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 15px !important;
        padding: 16px 20px !important;
        border-bottom: 1px solid #d5d9d9 !important;
        background: #232f3e !important;
        color: #ffffff !important;
      }

      #${MODAL_ID} .flowiq-productivity-title {
        margin: 0 !important;
        font-size: 21px !important;
        font-weight: 800 !important;
      }

      #${MODAL_ID} .flowiq-productivity-subtitle {
        margin-top: 4px !important;
        color: #d5dbdb !important;
        font-size: 13px !important;
        font-weight: 600 !important;
      }

      #${MODAL_ID} .flowiq-productivity-close {
        width: 34px !important;
        height: 34px !important;
        padding: 0 !important;
        border: 1px solid #ffffff !important;
        border-radius: 50% !important;
        background: transparent !important;
        color: #ffffff !important;
        cursor: pointer !important;
        font-size: 22px !important;
        line-height: 30px !important;
      }

      #${MODAL_ID} .flowiq-productivity-body {
        padding: 20px !important;
      }

      #${MODAL_ID} .flowiq-main-productivity {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 20px !important;
        margin-bottom: 18px !important;
        padding: 18px !important;
        border: 1px solid #d5d9d9 !important;
        border-radius: 8px !important;
        background: #f7fafa !important;
      }

      #${MODAL_ID} .flowiq-main-label {
        color: #565959 !important;
        font-size: 14px !important;
        font-weight: 700 !important;
      }

      #${MODAL_ID} .flowiq-main-value {
        margin-top: 3px !important;
        font-size: 35px !important;
        font-weight: 900 !important;
      }

      #${MODAL_ID} .flowiq-target-box {
        min-width: 180px !important;
        text-align: right !important;
      }

      #${MODAL_ID} .flowiq-target-value {
        margin-top: 4px !important;
        font-size: 18px !important;
        font-weight: 800 !important;
      }

      #${MODAL_ID} .flowiq-positive {
        color: #176b2c !important;
      }

      #${MODAL_ID} .flowiq-negative {
        color: #a40000 !important;
      }

      #${MODAL_ID} .flowiq-neutral {
        color: #9c6500 !important;
      }

      #${MODAL_ID} .flowiq-metric-grid {
        display: grid !important;
        grid-template-columns: repeat(
          auto-fit,
          minmax(180px, 1fr)
        ) !important;
        gap: 12px !important;
        margin-bottom: 22px !important;
      }

      #${MODAL_ID} .flowiq-metric-card {
        min-height: 82px !important;
        padding: 14px !important;
        border: 1px solid #d5d9d9 !important;
        border-radius: 7px !important;
        background: #ffffff !important;
        box-sizing: border-box !important;
      }

      #${MODAL_ID} .flowiq-metric-label {
        margin-bottom: 6px !important;
        color: #565959 !important;
        font-size: 12px !important;
        font-weight: 800 !important;
        letter-spacing: 0.03em !important;
        text-transform: uppercase !important;
      }

      #${MODAL_ID} .flowiq-metric-value {
        color: #111111 !important;
        font-size: 21px !important;
        font-weight: 900 !important;
      }

      #${MODAL_ID} .flowiq-section-title {
        margin: 0 0 10px 0 !important;
        font-size: 18px !important;
        font-weight: 800 !important;
      }

      #${MODAL_ID} .flowiq-hourly-table {
        width: 100% !important;
        border-collapse: collapse !important;
        table-layout: fixed !important;
      }

      #${MODAL_ID} .flowiq-hourly-table th,
      #${MODAL_ID} .flowiq-hourly-table td {
        padding: 10px 12px !important;
        border: 1px solid #d5d9d9 !important;
        text-align: left !important;
      }

      #${MODAL_ID} .flowiq-hourly-table th {
        background: #eaeded !important;
        color: #111111 !important;
        font-size: 12px !important;
        font-weight: 800 !important;
        text-transform: uppercase !important;
      }

      #${MODAL_ID} .flowiq-hourly-count {
        font-weight: 900 !important;
      }

      #${MODAL_ID} .flowiq-bar-track {
        height: 12px !important;
        overflow: hidden !important;
        border-radius: 6px !important;
        background: #eaeded !important;
      }

      #${MODAL_ID} .flowiq-bar-fill {
        height: 100% !important;
        min-width: 0 !important;
        border-radius: 6px !important;
        background: #879596 !important;
      }

      #${MODAL_ID} .flowiq-empty-message {
        padding: 25px !important;
        border: 1px solid #d5d9d9 !important;
        border-radius: 7px !important;
        background: #f7fafa !important;
        color: #565959 !important;
        text-align: center !important;
        font-size: 15px !important;
        font-weight: 700 !important;
      }

      @media (max-width: 650px) {
        #${MODAL_ID} {
          padding: 8px !important;
        }

        #${MODAL_ID} .flowiq-main-productivity {
          align-items: flex-start !important;
          flex-direction: column !important;
        }

        #${MODAL_ID} .flowiq-target-box {
          min-width: 0 !important;
          text-align: left !important;
        }
      }
    `;

        document.head.appendChild(style);
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

    function addProductivityButton() {
        if (document.getElementById(BUTTON_ID)) {
            return true;
        }

        const panel = document.getElementById(PANEL_ID);

        if (!panel) {
            return false;
        }

        const button = document.createElement('button');

        button.id = BUTTON_ID;
        button.type = 'button';
        button.textContent = 'Productivity';

        const cageDisplay = document.getElementById(CAGE_ID);
        const applyButton = document.getElementById(APPLY_ID);

        if (cageDisplay) {
            cageDisplay.after(button);
        } else if (applyButton) {
            applyButton.after(button);
        } else {
            panel.appendChild(button);
        }

        return true;
    }

    function createModal() {
        let modal = document.getElementById(MODAL_ID);

        if (modal) {
            return modal;
        }

        modal = document.createElement('div');

        modal.id = MODAL_ID;
        modal.className = 'flowiq-hidden';

        modal.innerHTML = `
      <div
        class="flowiq-productivity-window"
        role="dialog"
        aria-modal="true"
        aria-label="Productivity Dashboard"
      >
        <div class="flowiq-productivity-header">
          <div>
            <h2 class="flowiq-productivity-title">
              Productivity Dashboard
            </h2>

            <div
              id="flowiq-productivity-subtitle"
              class="flowiq-productivity-subtitle"
            ></div>
          </div>

          <button
            id="flowiq-productivity-close"
            class="flowiq-productivity-close"
            type="button"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div
          id="flowiq-productivity-content"
          class="flowiq-productivity-body"
        ></div>
      </div>
    `;

        document.body.appendChild(modal);

        modal
            .querySelector('#flowiq-productivity-close')
            .addEventListener('click', closeModal);

        modal.addEventListener('click', event => {
            if (event.target === modal) {
                closeModal();
            }
        });

        return modal;
    }

    function openModal() {
        const modal = createModal();

        modal.classList.remove('flowiq-hidden');

        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        const modal = document.getElementById(MODAL_ID);

        if (modal) {
            modal.classList.add('flowiq-hidden');
        }

        document.body.style.overflow = '';
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

            return Number.isNaN(date.getTime())
                ? null
                : date;
        }

        match = text.match(
            /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i
        );

        if (match) {
            let year = Number(match[3]);
            let hour = Number(match[4]);
            const period = match[7] || '';

            if (year < 100) {
                year += 2000;
            }

            if (/PM/i.test(period) && hour < 12) {
                hour += 12;
            }

            if (/AM/i.test(period) && hour === 12) {
                hour = 0;
            }

            const date = new Date(
                year,
                Number(match[1]) - 1,
                Number(match[2]),
                hour,
                Number(match[5]),
                Number(match[6] || 0)
            );

            return Number.isNaN(date.getTime())
                ? null
                : date;
        }

        const date = new Date(text);

        return Number.isNaN(date.getTime())
            ? null
            : date;
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

            return Number.isNaN(date.getTime())
                ? null
                : date;
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

            return Number.isNaN(date.getTime())
                ? null
                : date;
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
                for (
                    const input of container.querySelectorAll(
                        'input'
                    )
                ) {
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
            const dates = [
                ...document.querySelectorAll('input')
            ]
                .map(input => parseDateOnly(input.value))
                .filter(Boolean);

            if (!startDate) {
                startDate = dates[0] || null;
            }

            if (!endDate) {
                endDate = dates[1] || null;
            }
        }

        if (!startDate || !endDate) {
            return null;
        }

        if (startDate.getTime() > endDate.getTime()) {
            [startDate, endDate] = [
                endDate,
                startDate
            ];
        }

        return {
            startDate,
            endDate
        };
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

        const lastDate = new Date(
            range.endDate.getFullYear(),
            range.endDate.getMonth(),
            range.endDate.getDate(),
            0,
            0,
            0,
            0
        );

        while (current.getTime() <= lastDate.getTime()) {
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
                key: start.getTime(),
                start,
                end
            });

            current.setDate(current.getDate() + 1);
        }

        return windows;
    }

    function findMatchingWindow(date, windows) {
        if (
            !(date instanceof Date) ||
            Number.isNaN(date.getTime())
        ) {
            return null;
        }

        const time = date.getTime();

        return (
            windows.find(window => {
                return (
                    time >= window.start.getTime() &&
                    time <= window.end.getTime()
                );
            }) || null
        );
    }

    function getOriginalCells(row) {
        return [...row.children].filter(cell => {
            return !cell.classList.contains(TOT_CLASS);
        });
    }

    function getRecords(windows) {
        const table = document.getElementById(TABLE_ID);

        if (!table) {
            return [];
        }

        return [
            ...table.querySelectorAll('tbody tr')
        ]
            .filter(row => {
                return !row.querySelector(
                    '.dataTables_empty'
                );
            })
            .map((row, index) => {
                const cells = getOriginalCells(row);

                const dateText = clean(
                    cells[DATE_COLUMN]?.textContent
                );

                const person = clean(
                    cells[PERSON_COLUMN]?.textContent
                );

                const date = parseDateTime(dateText);

                return {
                    index,
                    dateText,
                    date,
                    person,
                    window: findMatchingWindow(
                        date,
                        windows
                    )
                };
            })
            .filter(record => {
                return Boolean(
                    record.date &&
                    record.window
                );
            });
    }

    function getUniqueScans(records) {
        const scans = new Map();

        for (const record of records) {
            const employee =
                record.person.toLowerCase() ||
                'unknown';

            const key = [
                employee,
                record.window.key,
                record.date.getTime()
            ].join('|');

            if (!scans.has(key)) {
                scans.set(key, record);
            }
        }

        return [...scans.values()];
    }

    function groupScansByEmployeeAndShift(scans) {
        const groups = new Map();

        for (const scan of scans) {
            const employee =
                scan.person.toLowerCase() ||
                'unknown';

            const key = [
                employee,
                scan.window.key
            ].join('|');

            if (!groups.has(key)) {
                groups.set(key, {
                    person: scan.person,
                    window: scan.window,
                    scans: []
                });
            }

            groups.get(key).scans.push(scan);
        }

        return [...groups.values()];
    }

    function calculateGroupMetrics(group) {
        const scans = [...group.scans].sort(
            (first, second) =>
                first.date.getTime() -
                second.date.getTime()
        );

        const firstScan = scans[0]?.date || null;
        const lastScan =
            scans[scans.length - 1]?.date || null;

        let totalTotMinutes = 0;
        let longestTotMinutes = 0;
        let totOccurrences = 0;

        for (
            let index = 1;
            index < scans.length;
            index += 1
        ) {
            const gapMinutes =
                (
                    scans[index].date.getTime() -
                    scans[index - 1].date.getTime()
                ) / 60000;

            if (
                gapMinutes >
                TOT_THRESHOLD_MINUTES
            ) {
                totalTotMinutes += gapMinutes;
                longestTotMinutes = Math.max(
                    longestTotMinutes,
                    gapMinutes
                );
                totOccurrences += 1;
            }
        }

        const elapsedMinutes =
            firstScan && lastScan
                ? Math.max(
                    0,
                    (
                        lastScan.getTime() -
                        firstScan.getTime()
                    ) / 60000
                )
                : 0;

        const activeMinutes = Math.max(
            0,
            elapsedMinutes - totalTotMinutes
        );

        return {
            scans,
            firstScan,
            lastScan,
            totalScans: scans.length,
            elapsedMinutes,
            totalTotMinutes,
            activeMinutes,
            longestTotMinutes,
            totOccurrences
        };
    }

    function calculateDashboard(records, windows) {
        const uniqueScans =
            getUniqueScans(records);

        const groups =
            groupScansByEmployeeAndShift(
                uniqueScans
            );

        const groupMetrics =
            groups.map(calculateGroupMetrics);

        const validGroups =
            groupMetrics.filter(group => {
                return group.totalScans > 0;
            });

        const totalScans =
            validGroups.reduce(
                (sum, group) =>
                    sum + group.totalScans,
                0
            );

        const totalTotMinutes =
            validGroups.reduce(
                (sum, group) =>
                    sum + group.totalTotMinutes,
                0
            );

        const scheduledMinutes =
            windows.length * 10.5 * 60;

        const activeMinutes = Math.max(
            0,
            scheduledMinutes - totalTotMinutes
        );

        const elapsedMinutes =
            validGroups.reduce(
                (sum, group) =>
                    sum + group.elapsedMinutes,
                0
            );

        const longestTotMinutes =
            validGroups.reduce(
                (largest, group) =>
                    Math.max(
                        largest,
                        group.longestTotMinutes
                    ),
                0
            );

        const totOccurrences =
            validGroups.reduce(
                (sum, group) =>
                    sum + group.totOccurrences,
                0
            );

        const hourly = calculateHourlyProductivity(
            uniqueScans,
            windows
        );

        const productivity =
            hourly.length > 0
                ? hourly.reduce(
                    (sum, bucket) =>
                        sum + bucket.productivity,
                    0
                  ) / hourly.length
                : 0;

        const allDates =
            uniqueScans
                .map(scan => scan.date)
                .sort(
                    (first, second) =>
                        first.getTime() -
                        second.getTime()
                );

        const firstScan =
            allDates[0] || null;

        const lastScan =
            allDates[allDates.length - 1] ||
            null;

        const averageTotMinutes =
            totOccurrences > 0
                ? totalTotMinutes /
                totOccurrences
                : 0;

        return {
            uniqueScans,
            totalScans,
            totalTotMinutes,
            scheduledMinutes,
            activeMinutes,
            elapsedMinutes,
            longestTotMinutes,
            averageTotMinutes,
            totOccurrences,
            productivity,
            firstScan,
            lastScan,
            hourly        };
    }

    function calculateHourlyProductivity(
        scans,
        windows
    ) {
        const buckets = [];

        for (const window of windows) {
            let bucketStart = new Date(
                window.start.getTime()
            );

            while (
                bucketStart.getTime() <
                window.end.getTime()
            ) {
                const bucketEnd = new Date(
                    Math.min(
                        bucketStart.getTime() +
                        60 * 60 * 1000,
                        window.end.getTime()
                    )
                );

                const durationHours =
                    (
                        bucketEnd.getTime() -
                        bucketStart.getTime()
                    ) / 3600000;

                buckets.push({
                    windowKey: window.key,
                    start: bucketStart,
                    end: bucketEnd,
                    durationHours,
                    count: 0,
                    productivity: 0
                });

                bucketStart = bucketEnd;
            }
        }

        for (const scan of scans) {
            const time = scan.date.getTime();

            const bucket = buckets.find(item => {
                return (
                    item.windowKey ===
                    scan.window.key &&
                    time >= item.start.getTime() &&
                    (
                        time < item.end.getTime() ||
                        (
                            item.end.getTime() ===
                            scan.window.end.getTime() &&
                            time <= item.end.getTime()
                        )
                    )
                );
            });

            if (bucket) {
                bucket.count += 1;
            }
        }

        for (const bucket of buckets) {
            bucket.productivity =
                bucket.durationHours > 0
                    ? bucket.count /
                      bucket.durationHours
                    : 0;
        }

        return buckets;
    }

    function formatDuration(minutes) {
        const totalSeconds = Math.max(
            0,
            Math.round(minutes * 60)
        );

        const hours = Math.floor(
            totalSeconds / 3600
        );

        const remainingSeconds =
            totalSeconds % 3600;

        const mins = Math.floor(
            remainingSeconds / 60
        );

        const seconds =
            remainingSeconds % 60;

        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }

        if (mins > 0) {
            return seconds > 0
                ? `${mins}m ${seconds}s`
                : `${mins}m`;
        }

        return `${seconds}s`;
    }

    function formatDateTime(date) {
        if (!date) {
            return '—';
        }

        return date.toLocaleString([], {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    function formatTime(date) {
        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    function formatHourlyRange(bucket) {
        const sameDate =
            bucket.start.toDateString() ===
            bucket.end.toDateString();

        if (sameDate) {
            return (
                `${formatTime(bucket.start)}–` +
                `${formatTime(bucket.end)}`
            );
        }

        return (
            `${formatDateTime(bucket.start)}–` +
            `${formatDateTime(bucket.end)}`
        );
    }

    function getCageTotal() {
        const display =
            document.getElementById(CAGE_ID);

        if (!display) {
            return '—';
        }

        const match =
            clean(display.textContent).match(
                /total cages:\s*(.+)$/i
            );

        return match
            ? match[1]
            : '—';
    }

    function metricCard(label, value) {
        return `
      <div class="flowiq-metric-card">
        <div class="flowiq-metric-label">
          ${label}
        </div>

        <div class="flowiq-metric-value">
          ${value}
        </div>
      </div>
    `;
    }

    function renderDashboard(
        dashboard,
        shiftId,
        windows
    ) {
        const content =
            document.getElementById(
                'flowiq-productivity-content'
            );

        const subtitle =
            document.getElementById(
                'flowiq-productivity-subtitle'
            );

        if (!content || !subtitle) {
            return;
        }

        const shiftLabel =
            shiftId === 'afternoon'
                ? 'Afternoon 16:00–02:30'
                : 'Morning 05:00–15:30';

        subtitle.textContent =
            `${shiftLabel} · ` +
            `${windows.length} selected shift` +
            `${windows.length === 1 ? '' : 's'}`;

        if (!dashboard.totalScans) {
            content.innerHTML = `
        <div class="flowiq-empty-message">
          No scan records were found inside the
          selected shift and date range.
        </div>
      `;

            return;
        }

        const performance =
            dashboard.productivity -
            TARGET_PRODUCTIVITY;

        const performanceClass =
            performance > 0
                ? 'flowiq-positive'
                : performance < 0
                    ? 'flowiq-negative'
                    : 'flowiq-neutral';

        const performanceText =
            performance >= 0
                ? `+${performance.toFixed(1)}`
                : performance.toFixed(1);

        const maximumHourlyCount = Math.max(
            1,
            ...dashboard.hourly.map(
                bucket => bucket.productivity
            )
        );

        const hourlyRows =
            dashboard.hourly
                .map(bucket => {
                    const width =
                        (
                            bucket.productivity /
                            maximumHourlyCount
                        ) * 100;

                    return `
            <tr>
              <td>
                ${formatHourlyRange(bucket)}
              </td>

              <td class="flowiq-hourly-count">
                ${bucket.count}
              </td>

              <td class="flowiq-hourly-count">
                ${bucket.productivity.toFixed(1)}
              </td>

              <td>
                <div class="flowiq-bar-track">
                  <div
                    class="flowiq-bar-fill"
                    style="width:${width.toFixed(2)}%"
                  ></div>
                </div>
              </td>
            </tr>
          `;
                })
                .join('');

        content.innerHTML = `
      <div class="flowiq-main-productivity">
        <div>
          <div class="flowiq-main-label">
            Productivity
          </div>

          <div class="flowiq-main-value">
            ${dashboard.productivity.toFixed(1)}
            <span style="font-size:16px">
              scans/hour average
            </span>
          </div>
        </div>

        <div class="flowiq-target-box">
          <div class="flowiq-main-label">
            Target
          </div>

          <div class="flowiq-target-value">
            ${TARGET_PRODUCTIVITY}
            scans/hour
          </div>

          <div class="${performanceClass}">
            Performance: ${performanceText}
          </div>
        </div>
      </div>

      <div class="flowiq-metric-grid">
        ${metricCard(
            'First Scan',
            formatDateTime(
                dashboard.firstScan
            )
        )}

        ${metricCard(
            'Last Scan',
            formatDateTime(
                dashboard.lastScan
            )
        )}

        ${metricCard(
            'Total Scan Events',
            dashboard.totalScans
                .toLocaleString()
        )}

        ${metricCard(
            'Scheduled Time',
            formatDuration(
                dashboard.scheduledMinutes
            )
        )}

        ${metricCard(
            'Active Time',
            formatDuration(
                dashboard.activeMinutes
            )
        )}

        ${metricCard(
            'Longest TOT',
            formatDuration(
                dashboard.longestTotMinutes
            )
        )}

        ${metricCard(
            'Average TOT',
            formatDuration(
                dashboard.averageTotMinutes
            )
        )}

        ${metricCard(
            'TOT Occurrences',
            dashboard.totOccurrences
        )}

        ${metricCard(
            'Total Cages',
            getCageTotal()
        )}
      </div>

      <h3 class="flowiq-section-title">
        Hourly Productivity
      </h3>

      <table class="flowiq-hourly-table">
        <thead>
          <tr>
            <th style="width:35%">
              Time
            </th>

            <th style="width:15%">
              Scan Events
            </th>

            <th style="width:50%">
              Activity
            </th>
          </tr>
        </thead>

        <tbody>
          ${hourlyRows}
        </tbody>
      </table>
    `;
    }

    function showError(message) {
        openModal();

        const content =
            document.getElementById(
                'flowiq-productivity-content'
            );

        const subtitle =
            document.getElementById(
                'flowiq-productivity-subtitle'
            );

        if (subtitle) {
            subtitle.textContent = '';
        }

        if (content) {
            content.innerHTML = `
        <div class="flowiq-empty-message">
          ${message}
        </div>
      `;
        }
    }

    function buildDashboard() {
        const button =
            document.getElementById(BUTTON_ID);

        if (button) {
            button.disabled = true;
            button.textContent = 'Loading...';
        }

        try {
            const table =
                document.getElementById(TABLE_ID);

            if (!table) {
                showError(
                    'Run the FCResearch search first.'
                );

                return;
            }

            const range =
                getSelectedDateRange();

            if (!range) {
                showError(
                    'Could not read the selected Start date and End date.'
                );

                return;
            }

            const shiftId =
                getSelectedShiftId();

            const windows =
                createShiftWindows(
                    range,
                    shiftId
                );

            const records =
                getRecords(windows);

            const dashboard =
                calculateDashboard(
                    records,
                    windows
                );

            openModal();

            renderDashboard(
                dashboard,
                shiftId,
                windows
            );
        } catch (error) {
            console.error(
                '[Flow IQ Productivity Dashboard]',
                error
            );

            showError(
                'Productivity calculation failed. Check the browser Console.'
            );
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent =
                    'Productivity';
            }
        }
    }

    function start() {
        addStyles();
        createModal();
        addProductivityButton();

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

                buildDashboard();
            },
            true
        );

        document.addEventListener(
            'keydown',
            event => {
                if (event.key === 'Escape') {
                    closeModal();
                }
            }
        );

        window.setInterval(() => {
            addProductivityButton();
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