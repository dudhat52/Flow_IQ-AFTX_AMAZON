// ==UserScript==
// @name         Flow IQ TOT - Engine
// @namespace    http://tampermonkey.net/
// @version      5.1
// @description  Calculates TOT for every Morning or Afternoon shift in the selected date range
// @match        https://qifcr.na.aftx.amazonoperations.app/XYY1/results*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const TABLE_ID = 'table-inventory-history';
  const PANEL_ID = 'flowiq-tot-panel';
  const APPLY_ID = 'flowiq-tot-apply';
  const STATUS_ID = 'flowiq-tot-status';
  const STORAGE_KEY = 'flowiq-tot-shift';
  const GAP_CLASS = 'flowiq-tot-gap';
  const STYLE_ID = 'flowiq-tot-engine-style';

  const DATE_COLUMN = 0;
  const PERSON_COLUMN = 8;

  const WARNING_MINUTES = 5;
  const ALERT_MINUTES = 10;

  let processing = false;

  const clean = value =>
    String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();

  function setStatus(message) {
    const status =
      document.getElementById(STATUS_ID);

    if (status) {
      status.textContent = message;
    }
  }

  function addStyles() {
    if (
      document.getElementById(
        STYLE_ID
      )
    ) {
      return;
    }

    const style =
      document.createElement('style');

    style.id = STYLE_ID;

    style.textContent = `
      #${TABLE_ID} {
        width: max-content !important;
        min-width: 100% !important;
      }

      #${TABLE_ID}_wrapper {
        overflow-x: auto !important;
      }

      #${TABLE_ID} th.${GAP_CLASS},
      #${TABLE_ID} td.${GAP_CLASS},
      #${TABLE_ID}_wrapper th.${GAP_CLASS} {
        min-width: 135px !important;
        width: 135px !important;
        max-width: 135px !important;
        padding: 8px 10px !important;
        white-space: nowrap !important;
        text-align: center !important;
        vertical-align: middle !important;
        font-weight: 700 !important;
        box-sizing: border-box !important;
      }

      #${TABLE_ID} th.${GAP_CLASS},
      #${TABLE_ID}_wrapper th.${GAP_CLASS} {
        background: #232f3e !important;
        color: #ffffff !important;
      }

      #${TABLE_ID}_wrapper .dataTables_scrollBody thead,
      #${TABLE_ID}_wrapper .dt-scroll-body thead {
        height: 0 !important;
        visibility: collapse !important;
      }

      #${TABLE_ID}_wrapper .dataTables_scrollBody thead tr,
      #${TABLE_ID}_wrapper .dt-scroll-body thead tr {
        height: 0 !important;
      }

      #${TABLE_ID}_wrapper .dataTables_scrollBody thead th,
      #${TABLE_ID}_wrapper .dt-scroll-body thead th {
        height: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        line-height: 0 !important;
        overflow: hidden !important;
        visibility: hidden !important;
      }

      #${TABLE_ID} td.${GAP_CLASS}.ok {
        background: #dff5e1 !important;
        color: #176b2c !important;
      }

      #${TABLE_ID} td.${GAP_CLASS}.warning {
        background: #ff9800 !important;
        color: #000000 !important;
      }

      #${TABLE_ID} td.${GAP_CLASS}.alert {
        background: #ffd6d6 !important;
        color: #a40000 !important;
      }

      #${TABLE_ID} td.${GAP_CLASS}.first {
        background: #e8edf3 !important;
        color: #4d5966 !important;
      }

      #${TABLE_ID} td.${GAP_CLASS}.last {
        background: #d9e8ff !important;
        color: #1f4f8a !important;
      }

      #${TABLE_ID} td.${GAP_CLASS}.single {
        background: #e6ddff !important;
        color: #56368a !important;
      }

      #${TABLE_ID} td.${GAP_CLASS}.outside {
        background: #f3f3f3 !important;
        color: #777777 !important;
      }

      #${TABLE_ID} td.${GAP_CLASS}.invalid {
        background: #eeeeee !important;
        color: #666666 !important;
      }

      #${TABLE_ID} td.${GAP_CLASS}.duplicate {
        background: #ffffff !important;
        color: transparent !important;
      }
    `;

    document.head.appendChild(style);
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

      return Number.isNaN(
        date.getTime()
      )
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

      if (
        /PM/i.test(period) &&
        hour < 12
      ) {
        hour += 12;
      }

      if (
        /AM/i.test(period) &&
        hour === 12
      ) {
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

      return Number.isNaN(
        date.getTime()
      )
        ? null
        : date;
    }

    const date = new Date(text);

    return Number.isNaN(
      date.getTime()
    )
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

      return Number.isNaN(
        date.getTime()
      )
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

      return Number.isNaN(
        date.getTime()
      )
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
        clean(
          element.textContent
        ).toLowerCase() ===
        labelText.toLowerCase()
      );
    });

    for (const label of labels) {
      const containers = [
        label.parentElement,
        label.parentElement
          ?.parentElement,
        label.closest('.a-section'),
        label.closest('.a-row')
      ].filter(Boolean);

      for (const container of containers) {
        for (
          const input
          of container.querySelectorAll(
            'input'
          )
        ) {
          if (
            parseDateOnly(
              input.value
            )
          ) {
            return input;
          }
        }
      }
    }

    return null;
  }

  function getSelectedDateRange() {
    const startInput =
      findDateInput('Start date');

    const endInput =
      findDateInput('End date');

    let startDate =
      parseDateOnly(
        startInput?.value
      );

    let endDate =
      parseDateOnly(
        endInput?.value
      );

    if (!startDate || !endDate) {
      const dateInputs = [
        ...document.querySelectorAll(
          'input'
        )
      ]
        .map(input => ({
          input,
          date: parseDateOnly(
            input.value
          )
        }))
        .filter(item => item.date);

      if (
        !startDate &&
        dateInputs[0]
      ) {
        startDate =
          dateInputs[0].date;
      }

      if (
        !endDate &&
        dateInputs[1]
      ) {
        endDate =
          dateInputs[1].date;
      }
    }

    if (!startDate || !endDate) {
      return null;
    }

    if (
      startDate.getTime() >
      endDate.getTime()
    ) {
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

  function getSelectedShiftId() {
    const checked =
      document.querySelector(
        `#${PANEL_ID} input[name="flowiq-tot-shift"]:checked`
      );

    if (
      checked?.value ===
      'afternoon'
    ) {
      return 'afternoon';
    }

    if (
      checked?.value ===
      'morning'
    ) {
      return 'morning';
    }

    return localStorage.getItem(
      STORAGE_KEY
    ) === 'afternoon'
      ? 'afternoon'
      : 'morning';
  }

  function createShiftWindows(
    range,
    shiftId
  ) {
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

    while (
      current.getTime() <=
      finalDate.getTime()
    ) {
      let start;
      let end;
      let label;
      let display;

      if (
        shiftId === 'afternoon'
      ) {
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

        label = 'Afternoon';
        display = '16:00–02:30';
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

        label = 'Morning';
        display = '05:00–15:30';
      }

      windows.push({
        key: start.getTime(),
        start,
        end,
        label,
        display
      });

      current.setDate(
        current.getDate() + 1
      );
    }

    return windows;
  }

  function findMatchingWindow(
    date,
    windows
  ) {
    if (
      !(date instanceof Date) ||
      Number.isNaN(
        date.getTime()
      )
    ) {
      return null;
    }

    const time =
      date.getTime();

    return (
      windows.find(window => {
        return (
          time >=
            window.start.getTime() &&
          time <=
            window.end.getTime()
        );
      }) || null
    );
  }

  function formatGap(minutes) {
    const total = Math.max(
      0,
      Math.round(minutes)
    );

    if (total < 60) {
      return `${total} min`;
    }

    const hours =
      Math.floor(total / 60);

    const remaining =
      total % 60;

    return remaining
      ? `${hours} hr ${remaining} min`
      : `${hours} hr`;
  }

  function formatWindow(window) {
    const start =
      window.start.toLocaleString(
        [],
        {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }
      );

    const end =
      window.end.toLocaleString(
        [],
        {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }
      );

    return `${start} → ${end}`;
  }

  function getOriginalCells(row) {
    return [
      ...row.children
    ].filter(cell => {
      return !cell.classList.contains(
        GAP_CLASS
      );
    });
  }

  function removeGeneratedColumn() {
    document
      .querySelectorAll(
        `.${GAP_CLASS}`
      )
      .forEach(element => {
        element.remove();
      });
  }

  function isDateHeader(header) {
    const text = clean(
      header.textContent
    ).toLowerCase();

    return (
      text.includes('date') ||
      text.includes('edt') ||
      text.includes('gmt') ||
      text.includes('scan time')
    );
  }

  function addHeaders() {
    const mainTable =
      document.getElementById(
        TABLE_ID
      );

    if (!mainTable) {
      return;
    }

    const wrapper =
      document.getElementById(
        `${TABLE_ID}_wrapper`
      );

    const tables =
      new Set([mainTable]);

    wrapper
      ?.querySelectorAll('table')
      .forEach(table => {
        if (
          table.querySelector(
            'thead'
          )
        ) {
          tables.add(table);
        }
      });

    for (const table of tables) {
      for (
        const row
        of table.querySelectorAll(
          'thead tr'
        )
      ) {
        row
          .querySelectorAll(
            `th.${GAP_CLASS}`
          )
          .forEach(header => {
            header.remove();
          });

        const headers =
          getOriginalCells(row);

        const dateHeader =
          headers.find(
            isDateHeader
          );

        if (!dateHeader) {
          continue;
        }

        const header =
          document.createElement(
            'th'
          );

        header.className =
          GAP_CLASS;

        header.textContent =
          'TOT Time';

        dateHeader.before(header);
      }
    }
  }

  function createGapCell(record) {
    const dateCell =
      record.cells[
        DATE_COLUMN
      ];

    if (!dateCell) {
      return null;
    }

    const cell =
      document.createElement('td');

    cell.className =
      GAP_CLASS;

    dateCell.before(cell);

    return cell;
  }

  function updateCell(
    cell,
    text,
    status,
    title = ''
  ) {
    cell.className =
      `${GAP_CLASS} ${status}`;

    cell.textContent = text;
    cell.title = title;
  }

  function getRecords() {
    const table =
      document.getElementById(
        TABLE_ID
      );

    if (!table) {
      return [];
    }

    return [
      ...table.querySelectorAll(
        'tbody tr'
      )
    ]
      .filter(row => {
        return !row.querySelector(
          '.dataTables_empty'
        );
      })
      .map((row, index) => {
        const cells =
          getOriginalCells(row);

        const dateText =
          clean(
            cells[DATE_COLUMN]
              ?.textContent
          );

        const person =
          clean(
            cells[PERSON_COLUMN]
              ?.textContent
          );

        return {
          row,
          cells,
          index,
          dateText,
          date:
            parseDateTime(
              dateText
            ),
          person,
          gapCell: null,
          shiftWindow: null
        };
      })
      .filter(record => {
        return (
          record.cells.length >
          PERSON_COLUMN
        );
      });
  }

  function assignGroup(
    group,
    text,
    status,
    title
  ) {
    const records =
      group.records;

    if (!records.length) {
      return;
    }

    updateCell(
      records[0].gapCell,
      text,
      status,
      title
    );

    for (
      let index = 1;
      index < records.length;
      index += 1
    ) {
      updateCell(
        records[index].gapCell,
        '',
        'duplicate',
        `Same scan time: ${records[index].dateText}`
      );
    }
  }

  function processShiftGroup(
    records,
    shiftWindow
  ) {
    records.sort(
      (first, second) => {
        return (
          first.date.getTime() -
          second.date.getTime()
        );
      }
    );

    const timestampGroups = [];

    for (const record of records) {
      const timestamp =
        record.date.getTime();

      const previousGroup =
        timestampGroups[
          timestampGroups.length - 1
        ];

      if (
        previousGroup &&
        previousGroup.timestamp ===
          timestamp
      ) {
        previousGroup.records.push(
          record
        );
      } else {
        timestampGroups.push({
          timestamp,
          date: record.date,
          records: [record]
        });
      }
    }

    if (
      timestampGroups.length === 1
    ) {
      assignGroup(
        timestampGroups[0],
        'First / Last scan',
        'single',
        [
          `Employee: ${
            records[0].person ||
            'Unknown'
          }`,
          `Scan: ${
            records[0].dateText
          }`,
          `Shift: ${
            formatWindow(
              shiftWindow
            )
          }`
        ].join('\n')
      );

      return;
    }

    const firstGroup =
      timestampGroups[0];

    assignGroup(
      firstGroup,
      'First scan',
      'first',
      [
        `Employee: ${
          firstGroup.records[0]
            .person ||
          'Unknown'
        }`,
        `Scan: ${
          firstGroup.records[0]
            .dateText
        }`,
        `Shift: ${
          formatWindow(
            shiftWindow
          )
        }`
      ].join('\n')
    );

    for (
      let index = 1;
      index <
        timestampGroups.length - 1;
      index += 1
    ) {
      const previous =
        timestampGroups[
          index - 1
        ];

      const current =
        timestampGroups[index];

      const gapMinutes =
        (
          current.date.getTime() -
          previous.date.getTime()
        ) / 60000;

      let status = 'ok';

      if (
        gapMinutes >=
        ALERT_MINUTES
      ) {
        status = 'alert';
      } else if (
        gapMinutes >=
        WARNING_MINUTES
      ) {
        status = 'warning';
      }

      const gapText =
        formatGap(
          gapMinutes
        );

      assignGroup(
        current,
        status === 'alert'
          ? `⚠ ${gapText}`
          : gapText,
        status,
        [
          `Previous scan: ${
            previous.records[0]
              .dateText
          }`,
          `Current scan: ${
            current.records[0]
              .dateText
          }`,
          `Employee: ${
            current.records[0]
              .person ||
            'Unknown'
          }`,
          `Shift: ${
            formatWindow(
              shiftWindow
            )
          }`,
          `Exact gap: ${
            gapMinutes.toFixed(2)
          } minutes`
        ].join('\n')
      );
    }

    const lastGroup =
      timestampGroups[
        timestampGroups.length - 1
      ];

    assignGroup(
      lastGroup,
      'Last scan',
      'last',
      [
        `Employee: ${
          lastGroup.records[0]
            .person ||
          'Unknown'
        }`,
        `Scan: ${
          lastGroup.records[0]
            .dateText
        }`,
        `Shift: ${
          formatWindow(
            shiftWindow
          )
        }`
      ].join('\n')
    );
  }

  function applyTOT() {
    if (processing) {
      return;
    }

    const table =
      document.getElementById(
        TABLE_ID
      );

    if (!table) {
      setStatus(
        'Run Search first'
      );

      return;
    }

    const range =
      getSelectedDateRange();

    if (!range) {
      setStatus(
        'Could not read selected dates'
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

    const button =
      document.getElementById(
        APPLY_ID
      );

    processing = true;

    if (button) {
      button.disabled = true;
      button.textContent =
        'Applying...';
    }

    setStatus(
      'Applying TOT...'
    );

    try {
      addStyles();
      removeGeneratedColumn();

      const records =
        getRecords();

      if (!records.length) {
        setStatus(
          'No loaded rows found'
        );

        return;
      }

      localStorage.setItem(
        STORAGE_KEY,
        shiftId
      );

      addHeaders();

      const shiftGroups =
        new Map();

      let matchingCount = 0;

      for (const record of records) {
        record.gapCell =
          createGapCell(record);

        if (!record.gapCell) {
          continue;
        }

        if (!record.date) {
          updateCell(
            record.gapCell,
            'Invalid time',
            'invalid',
            record.dateText
          );

          continue;
        }

        const matchingWindow =
          findMatchingWindow(
            record.date,
            windows
          );

        if (!matchingWindow) {
          updateCell(
            record.gapCell,
            'Outside Shift',
            'outside',
            [
              `Employee: ${
                record.person ||
                'Unknown'
              }`,
              `Scan: ${
                record.dateText
              }`,
              `Selected shift: ${
                shiftId ===
                'afternoon'
                  ? 'Afternoon 16:00–02:30'
                  : 'Morning 05:00–15:30'
              }`
            ].join('\n')
          );

          continue;
        }

        matchingCount += 1;

        record.shiftWindow =
          matchingWindow;

        const employeeKey =
          record.person
            .toLowerCase() ||
          `unknown-${record.index}`;

        const groupKey =
          `${employeeKey}|${matchingWindow.key}`;

        if (
          !shiftGroups.has(
            groupKey
          )
        ) {
          shiftGroups.set(
            groupKey,
            {
              window:
                matchingWindow,
              records: []
            }
          );
        }

        shiftGroups
          .get(groupKey)
          .records
          .push(record);
      }

      for (
        const group
        of shiftGroups.values()
      ) {
        processShiftGroup(
          group.records,
          group.window
        );
      }

      const shiftLabel =
        shiftId === 'afternoon'
          ? 'Afternoon'
          : 'Morning';

      setStatus(
        `${shiftLabel} applied · ${matchingCount} rows · ${windows.length} shifts`
      );
    } catch (error) {
      console.error(
        '[Flow IQ TOT Engine]',
        error
      );

      removeGeneratedColumn();

      setStatus(
        'TOT error — check Console'
      );
    } finally {
      processing = false;

      if (button) {
        button.disabled = false;
        button.textContent =
          'Apply TOT';
      }
    }
  }

  addStyles();

  document.addEventListener(
    'click',
    event => {
      const button =
        event.target.closest?.(
          `#${APPLY_ID}`
        );

      if (!button) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      applyTOT();
    },
    true
  );
})();