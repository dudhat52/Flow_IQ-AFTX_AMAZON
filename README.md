
# Flow IQ: Warehouse Operations Analytics

A set of browser userscripts that analyse warehouse scan history: selecting a shift window, measuring time-off-task gaps, calculating productivity, counting cages, handling duplicate timestamps, loading records automatically, and surfacing inventory exceptions.

```text
$ flowiq --summary

input     scan-history records shown in a browser-based warehouse tool
output    on-page analytics: TOT gaps, productivity, counts, exceptions
runtime   browser userscripts (JavaScript)
data      intended to be processed in the browser (see verification checklist)
```

| | |
| --- | --- |
| **Language** | JavaScript |
| **Repository** | [dudhat52/Flow_IQ-AFTX_AMAZON](https://github.com/dudhat52/Flow_IQ-AFTX_AMAZON) |
| **Branch** | `master` |
| **Status** | Public scripts published; see the verification column below |

---

## Scope and privacy

This project describes tooling built around a warehouse operations workflow. This README and the repository are written to keep operational data out of the public record:

- No internal URLs, system names, or screenshots of internal tools.
- No employee names, IDs, or real scan records. Every example below uses **synthetic data**.
- No proprietary source from any employer's systems. As userscripts, they are designed to work in the user's own browser on data the page already displays. Confirm this holds for every script (see the checklist).

---

## What problem it solves

Reviewing scan history by hand means scrolling through long lists of timestamps and mentally estimating where a person was idle, how many units moved, and what looks wrong. That is slow, inconsistent between reviewers, and hard to repeat.

Flow IQ turns that review into a consistent set of calculations that run in the page the reviewer is already looking at.

**Manual process**

```text
open scan history → scroll → eyeball gaps → count containers → note oddities → repeat per person
```

**With Flow IQ**

```text
open scan history → records load → shift window applied → gaps, counts, exceptions calculated
```

---

## Features and verification status

The repository contains eight JavaScript files. The table maps each described feature to the file that most plausibly implements it, based on file naming.

| Feature | Likely file | Verification |
| --- | --- | --- |
| Time-off-task (TOT) gap calculation | `flowiq-tot-engine.user.js` | To confirm |
| TOT results panel / display | `flowiq-tot-panel.user.js` | To confirm |
| Morning / afternoon shift selection | `flowiq-tot-engine.user.js`, `flowiq-tot-panel.user.js` | To confirm |
| Productivity analytics | `flowid-productivity.user.js` | To confirm |
| Cage counting | `flowiq-cage-counter.js` | To confirm |
| Duplicate timestamp handling | `flowiq-time-duplicator.user.js` | To confirm |
| Automatic loading of scan records | `flowiq-auto-load.user.js` | To confirm |
| Inventory exception detection | `flowiq-recive.user.js` | To confirm |
| Quick navigation within long lists | `flowiq-quick-scroll.user.js` | To confirm |

**How to read "To confirm":** the file exists and its name points to the feature, but the logic has not been checked line by line for this document. The owner should verify each row before treating it as a completed feature.

---

## Architecture

The repository is a collection of small, single-purpose scripts rather than one application. The `.user.js` suffix is the standard convention for userscripts run by a userscript manager.

```text
┌──────────────────────────────────────────────────────────┐
│                  Browser page (scan history)             │
└───────────────┬──────────────────────────────────────────┘
                │ page DOM
   ┌────────────┼──────────────────────────┐
   ▼            ▼                          ▼
auto-load    quick-scroll             time-duplicator
(get all     (navigate long           (duplicate timestamp
 records)     lists)                   handling)
   │                                       │
   └──────────────┬────────────────────────┘
                  ▼
            normalised scan list
                  │
   ┌──────────────┼───────────────┬───────────────┐
   ▼              ▼               ▼               ▼
tot-engine   productivity   cage-counter     recive
(gaps in     (rate over      (count           (exception
 shift)       active time)    containers)      detection)
   │              │               │               │
   └──────────────┴───────┬───────┴───────────────┘
                          ▼
                    tot-panel (on-page display)
```

**Design choices worth noting**

- **Separation of concerns.** Loading, calculating, and displaying are kept in different files, so a change to the TOT rules doesn't touch the display code.
- **Client-side by design.** Userscripts calculate in the browser on records already on screen. That avoids building any backend and, if no script makes external requests, keeps data from leaving the page.
- **Small scripts over one large one.** Each script can be enabled or disabled independently, which makes debugging much easier.

---

## Calculations

The snippets in this section are **illustrative Python** showing the logic in plain terms. They are not copied from the repository, which is JavaScript, and all thresholds are examples.

### 1. Shift window

A shift selection limits analysis to scans inside a time window, so a morning review isn't polluted by afternoon activity.

```python
in_shift = [s for s in scans if SHIFT_START <= s < SHIFT_END]
```

Using a half-open interval (`>=` start, `<` end) means a scan exactly on the boundary belongs to exactly one shift.

### 2. Duplicate timestamp handling

Two scans can carry the same timestamp. If they are treated as separate events, they create a zero-length gap and inflate counts.

```python
unique = sorted(set(in_shift))
duplicates_removed = len(in_shift) - len(unique)
```

### 3. Time-off-task gaps

Sort the unique timestamps, measure the interval between consecutive scans, and count intervals longer than a threshold as off-task time.

```python
THRESHOLD = timedelta(minutes=5)   # illustrative only

tot = timedelta(0)
for prev, cur in zip(unique, unique[1:]):
    gap = cur - prev
    if gap > THRESHOLD:
        tot += gap
```

A design decision lives here: counting the **whole** gap versus counting only the portion **above** the threshold produces different totals. The right choice depends on how the operation defines time off task, so it should be an explicit, documented setting.

### 4. Productivity

Productivity is a rate: units over *active* time, not over elapsed time.

```text
active_time  = (last_scan − first_scan) − total_TOT
productivity = scan_count / active_time_in_hours
```

Excluding TOT matters. Dividing by elapsed time would penalise someone for a long break that was already recorded as a gap.

### 5. Cage counting

Counting cages means counting distinct container identifiers in the shift window, not total scan rows. A cage scanned several times must still count once.

```python
cages = len({scan.container_id for scan in in_shift})
```

### 6. Exception detection

Exceptions are records that don't fit the expected pattern, such as an item with a receiving event but no matching downstream event. The exact rules are specific to the operation and are not documented publicly.

---

## Worked example (synthetic data)

Fictional scans in a 08:00 to 12:00 window, with an illustrative 5-minute threshold:

| # | Timestamp | Note |
| --- | --- | --- |
| 1 | 08:02:10 | |
| 2 | 08:03:05 | |
| 3 | 08:03:05 | duplicate of #2 |
| 4 | 08:04:40 | |
| 5 | 08:19:55 | gap from #4 |
| 6 | 08:21:10 | |
| 7 | 08:22:00 | |
| 8 | 08:50:30 | gap from #7 |
| 9 | 08:51:15 | |

**Result** (calculated with the logic above):

```text
scans in window ............ 9
duplicates removed ......... 1
unique scans ............... 8

gaps over threshold:
  08:04:40 → 08:19:55 ...... 15m 15s
  08:22:00 → 08:50:30 ...... 28m 30s

total TOT .................. 43m 45s
first → last scan span ..... 49m 05s
active time ................ 5m 20s
```

---

## Technical challenges

These are the problems this kind of tool has to solve. They describe the engineering considerations, not a claim about which ones the current code fully handles.

| Challenge | Why it's hard |
| --- | --- |
| **Depending on page structure** | Userscripts read the DOM. If the host page changes its markup, selectors can break without warning. |
| **Records that load progressively** | Long lists often load in pages. Calculating before everything is loaded gives wrong totals, which is why an auto-load step matters. |
| **Timestamp parsing** | Date formats, time zones, and 12/24-hour display all need consistent parsing before sorting. |
| **Shift boundaries** | Shifts that cross midnight, and scans exactly on a boundary, need explicit rules. |
| **Defining "off task"** | The threshold and the counting method change the numbers, so they need to be configurable and visible. |
| **Keeping scripts independent** | Several scripts share one page. They must not interfere with each other's DOM changes. |

---

## Repository contents

Verified from the repository file list:

```text
Flow_IQ-AFTX_AMAZON/
├── flowid-productivity.user.js
├── flowiq-auto-load.user.js
├── flowiq-cage-counter.js
├── flowiq-quick-scroll.user.js
├── flowiq-recive.user.js
├── flowiq-time-duplicator.user.js
├── flowiq-tot-engine.user.js
└── flowiq-tot-panel.user.js
```
