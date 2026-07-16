# Design Document — To-Do Life Dashboard

## Overview

The To-Do Life Dashboard is a fully client-side personal productivity homepage built with pure HTML, CSS, and Vanilla JavaScript. It runs entirely in the browser with no build step, no backend, and no external dependencies. All application state is persisted in `localStorage`. The app can be used as a standalone web page or as a browser new-tab extension.

The design follows a simple **Module Pattern** — each feature is a self-contained JavaScript module (object literal with an `init()` method) that the main entry point (`app.js`) initialises in sequence on `DOMContentLoaded`. The HTML file provides the full markup skeleton at load time; JavaScript only mutates existing DOM nodes rather than generating structural markup from scratch, which keeps rendering fast and predictable.

### Key Design Decisions

| Decision | Rationale |
|---|---|
| Single JS file (`app.js`) with logical module sections | Avoids ES-module import/export complexity (requires a dev server or CORS-relaxed browser); keeps the app loadable via `file://` |
| Inline `<script>` block in `<head>` for theme application | Prevents flash-of-wrong-theme (FOUT) before `DOMContentLoaded` |
| Defensive `try/catch` wrapper around every `localStorage` call | Satisfies Requirement 11 across all browsers including Safari private-browsing mode |
| No third-party libraries | Satisfies Requirement 12.4; keeps total page weight well under the 3 s load budget |
| Vanilla `setInterval` for the clock and timer | No dependency; easy to unit-test with `jest.useFakeTimers()` or equivalent |

---

## Architecture

The application has three layers:

```
┌─────────────────────────────────────────────────────────┐
│  index.html   (markup skeleton + single theme script)    │
└──────────────────────────┬──────────────────────────────┘
                           │ loads
            ┌──────────────▼──────────────┐
            │  js/app.js  (all logic)      │
            │                              │
            │  ┌──────────────────────┐    │
            │  │  StorageService      │    │  ← wraps localStorage
            │  └──────────┬───────────┘    │
            │             │ used by        │
            │  ┌──────────▼───────────┐    │
            │  │  Feature Modules     │    │  ← one module per feature
            │  │  • ClockModule       │    │
            │  │  • GreetingModule    │    │
            │  │  • TimerModule       │    │
            │  │  • TodoModule        │    │
            │  │  • QuickLinksModule  │    │
            │  │  • ThemeModule       │    │
            │  └──────────┬───────────┘    │
            │             │ reads/writes   │
            │  ┌──────────▼───────────┐    │
            │  │  DOM (index.html)    │    │
            │  └──────────────────────┘    │
            └─────────────────────────────┘
            │  css/style.css               │
            └──────────────────────────────┘
```

### Startup Sequence

```
1.  <head> inline script  →  read theme from localStorage, set data-theme attribute
2.  DOMContentLoaded fires in app.js
3.  StorageService.init()          ← probe localStorage availability
4.  ThemeModule.init()             ← apply saved theme / OS preference
5.  ClockModule.init()             ← start 1-second setInterval
6.  GreetingModule.init()          ← read name, render greeting
7.  TimerModule.init()             ← read saved duration, render timer
8.  TodoModule.init()              ← read tasks + sort pref, render list
9.  QuickLinksModule.init()        ← read links, render cards
10. TimeoutGuard.init()            ← starts 10 s watchdog, clears itself
```

---

## Components and Interfaces

### StorageService

Central wrapper for all `localStorage` access. All other modules call this service — never `localStorage` directly.

```javascript
const StorageService = {
  _available: true,

  // Returns parsed value or null; sets _available=false on error
  get(key),

  // Serialises value to JSON and stores; sets _available=false on error
  set(key, value),

  // Removes key; sets _available=false on error
  remove(key),

  // Returns current availability flag
  isAvailable(),

  // Probes localStorage with a test write/read/delete cycle
  init(),
};
```

Storage keys used:

| Key | Type | Default |
|---|---|---|
| `tld_greetingName` | `string` | `""` |
| `tld_pomodoroDuration` | `number` (integer, 1–120) | `25` |
| `tld_tasks` | `Task[]` (JSON) | `[]` |
| `tld_sortPreference` | `string` | `"default"` |
| `tld_quickLinks` | `QuickLink[]` (JSON) | `[]` |
| `tld_theme` | `"light" \| "dark"` | `null` (use OS) |

---

### ClockModule

Drives the live time and date display. Uses `setInterval` with a 1000 ms tick.

```javascript
const ClockModule = {
  _intervalId: null,
  init(),        // starts interval, renders immediately
  _tick(),       // called every second
  formatTime(date),   // → "HH:MM:SS" string
  formatDate(date),   // → "DayName, DD Month YYYY" string
  _stop(),       // clears interval (used in tests / cleanup)
};
```

`formatTime` and `formatDate` are **pure functions** — they take a `Date` object and return a string with no side effects, making them straightforwardly testable.

---

### GreetingModule

Reads the stored name and current hour to produce the greeting text.

```javascript
const GreetingModule = {
  init(),
  getGreetingWord(hour),   // hour: 0–23 → "Good Morning" | "Good Afternoon" | "Good Evening" | "Good Night"
  formatGreeting(word, name),  // → "[word], [name]!" or "[word]!"
  saveName(rawInput),      // trims, validates, persists, re-renders
  render(),
};
```

`getGreetingWord` is a pure function over a single integer.  
`formatGreeting` is a pure string composition function.

---

### TimerModule

Manages Pomodoro countdown state. Uses a private `setInterval` reference.

```javascript
const TimerModule = {
  _duration: 25,     // current Pomodoro_Duration in minutes
  _remaining: 1500,  // seconds
  _running: false,
  _intervalId: null,

  init(),
  start(),
  stop(),
  reset(),
  _tick(),           // decrements _remaining; fires _onComplete() at 0
  _onComplete(),     // shows alert banner, clears interval
  _updateDisplay(),  // formats _remaining → "MM:SS", updates DOM
  _updateButtons(),  // enables/disables Start/Stop/Reset per state
  formatSeconds(totalSeconds),  // pure: number → "MM:SS" string
  saveDuration(rawInput),       // validates, persists, resets display
};
```

Button state table (satisfies Requirements 3.9, 3.10):

| State | Start | Stop | Reset |
|---|---|---|---|
| Stopped/paused | enabled | disabled | enabled |
| Running | disabled | enabled | enabled |
| At zero | disabled | disabled | enabled |

---

### TodoModule

Manages the task list: add, edit, complete, delete, sort.

```javascript
const TodoModule = {
  _tasks: [],          // in-memory array (source of truth during session)
  _sortPref: "default",

  init(),
  addTask(title),
  editTask(id, newTitle),
  toggleComplete(id),
  deleteTask(id),
  setSortPreference(pref),
  _getSortedTasks(),   // returns sorted copy, never mutates _tasks
  _render(),
  _renderTask(task),   // returns a DOM element for one task
  _persist(),          // writes _tasks to StorageService
  _validateTitle(title, excludeId),  // pure: returns {valid, error}
};
```

Sort function identifiers map to sort option labels:

| `sortPref` value | Label |
|---|---|
| `"default"` | Default (creation order) |
| `"az"` | Alphabetical (A–Z) |
| `"za"` | Alphabetical (Z–A) |
| `"completed-last"` | Completed last |
| `"completed-first"` | Completed first |

`_getSortedTasks()` returns a **shallow copy** sorted in place — the underlying `_tasks` array is never reordered or mutated by a sort operation.

---

### QuickLinksModule

Manages quick-launch link cards.

```javascript
const QuickLinksModule = {
  _links: [],

  init(),
  addLink(label, url),
  deleteLink(id),
  _validateLink(label, url),  // pure: returns {valid, errors}
  _render(),
  _renderCard(link),   // returns a DOM <a> element
  _persist(),
};
```

URL validation: the `url` must start with `http://` or `https://` (case-sensitive prefix check). No additional URL parsing is performed to avoid cross-browser inconsistencies.

---

### ThemeModule

```javascript
const ThemeModule = {
  _current: "light",

  init(),
  toggle(),
  apply(theme),   // sets data-theme attribute on <html>
  _detect(),      // reads localStorage, then matchMedia, then defaults to "light"
};
```

The `data-theme` attribute is set on `<html>` and all colour tokens are CSS custom properties scoped to `[data-theme="light"]` and `[data-theme="dark"]`.

To prevent flash-of-wrong-theme, an inline `<script>` in `<head>` runs before the stylesheet is applied:

```html
<head>
  <script>
    (function () {
      try {
        var t = localStorage.getItem('tld_theme');
        if (t === 'dark' || t === 'light') {
          document.documentElement.setAttribute('data-theme', t);
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          document.documentElement.setAttribute('data-theme', 'light');
        }
      } catch (e) {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    })();
  </script>
  <link rel="stylesheet" href="css/style.css">
  ...
</head>
```

---

### NotificationService

Handles the two types of banners described in the requirements:

1. **Warning banner** — non-blocking, persistent, shown when `localStorage` is unavailable or data is corrupted.
2. **Completion alert** — auto-dismissing after ≥5 seconds, shown when Pomodoro timer reaches zero.

```javascript
const NotificationService = {
  showWarning(message),   // renders persistent #storage-warning banner
  hideWarning(),
  showAlert(message, durationMs),  // renders auto-dismissing alert, setTimeout to remove
};
```

---

### TimeoutGuard

Watches for the 10-second load timeout (Requirement 12.6).

```javascript
const TimeoutGuard = {
  init(),   // sets a 10-second setTimeout; clears it on DOMContentLoaded
  _showError(),
};
```

---

## Data Models

### Task

```javascript
{
  id: string,          // crypto.randomUUID() or Date.now() fallback
  title: string,       // 1–100 chars, trimmed
  completed: boolean,  // default false
  createdAt: number,   // Date.now() at creation
}
```

### QuickLink

```javascript
{
  id: string,
  label: string,    // 1–100 chars, trimmed
  url: string,      // must start with http:// or https://
  createdAt: number,
}
```

### AppState (persisted)

The full persisted state across all `localStorage` keys is logically:

```javascript
{
  tld_greetingName:     string | null,
  tld_pomodoroDuration: number,      // integer 1–120
  tld_tasks:            Task[],
  tld_sortPreference:   string,
  tld_quickLinks:       QuickLink[],
  tld_theme:            "light" | "dark" | null,
}
```

Each key is stored independently so that corruption of one key does not affect others.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Time formatting is always HH:MM:SS

*For any* valid `Date` object, `ClockModule.formatTime(date)` SHALL return a string of the form `HH:MM:SS` where HH is in [00, 23], MM in [00, 59], and SS in [00, 59].

**Validates: Requirements 1.1**

---

### Property 2: Date formatting always matches "DayName, DD Month YYYY"

*For any* valid `Date` object, `ClockModule.formatDate(date)` SHALL return a string matching the pattern `<DayName>, <DD> <MonthName> <YYYY>` where DayName and MonthName are the correct English names for that date.

**Validates: Requirements 1.2**

---

### Property 3: Greeting word maps correctly to all hour ranges

*For any* integer hour H in [0, 23], `GreetingModule.getGreetingWord(H)` SHALL return:
- `"Good Morning"` when H ∈ [5, 11]
- `"Good Afternoon"` when H ∈ [12, 17]
- `"Good Evening"` when H ∈ [18, 21]
- `"Good Night"` when H ∈ [22, 23] ∪ [0, 4]

**Validates: Requirements 1.3, 1.4, 1.5, 1.6**

---

### Property 4: Greeting with name always follows "[word], [name]!" pattern

*For any* greeting word W and any non-empty name string N, `GreetingModule.formatGreeting(W, N)` SHALL return the string `W + ", " + N + "!"`.

**Validates: Requirements 1.7**

---

### Property 5: Non-whitespace name is trimmed and saved correctly

*For any* string S containing at least one non-whitespace character, calling `GreetingModule.saveName(S)` SHALL persist `S.trim()` to `StorageService`, and subsequent retrieval SHALL return the trimmed value.

**Validates: Requirements 2.2**

---

### Property 6: Whitespace-only or empty name submission removes stored name

*For any* string S composed entirely of whitespace characters (including the empty string), calling `GreetingModule.saveName(S)` SHALL remove the greeting name from storage such that the greeting is rendered without a name.

**Validates: Requirements 2.3**

---

### Property 7: Name save/load round-trip preserves value

*For any* valid trimmed name string N, saving N via `StorageService.set("tld_greetingName", N)` and then reading it back via `StorageService.get("tld_greetingName")` SHALL return a value equal to N.

**Validates: Requirements 2.4**

---

### Property 8: Reset always returns timer display to current Pomodoro_Duration

*For any* valid Pomodoro_Duration D in [1, 120] minutes, calling `TimerModule.reset()` SHALL set the timer display to the value representing D minutes (i.e., `D * 60` seconds formatted as MM:SS).

**Validates: Requirements 3.6**

---

### Property 9: Timer button state is always consistent with running state

*For any* timer state (running or stopped/at-zero), the button enabled/disabled state SHALL match the table: when running, Start is disabled and Stop is enabled; when stopped or at zero, Start is enabled and Stop is disabled; Reset is always enabled except when the timer is at zero (where only Reset is enabled).

**Validates: Requirements 3.9, 3.10**

---

### Property 10: Valid Pomodoro_Duration in [1, 120] is accepted and displayed

*For any* integer D where 1 ≤ D ≤ 120, calling `TimerModule.saveDuration(String(D))` SHALL persist D to storage and set the timer display to D minutes.

**Validates: Requirements 4.2**

---

### Property 11: Duration outside [1, 120] is always rejected

*For any* integer D where D < 1 or D > 120, and for any non-integer string, calling `TimerModule.saveDuration(input)` SHALL return a validation error and leave the previously saved duration unchanged.

**Validates: Requirements 4.3, 4.4**

---

### Property 12: Adding a valid unique task increases list length by one

*For any* task list L and any title string T that is non-empty (after trimming) and does not case-insensitively match any title already in L, calling `TodoModule.addTask(T)` SHALL result in a task list of length `|L| + 1` containing a task with title `T.trim()`.

**Validates: Requirements 5.2**

---

### Property 13: Case-insensitive duplicate task addition is always rejected

*For any* non-empty task list L containing a task with title T, and for any string S where `S.toLowerCase() === T.toLowerCase()`, calling `TodoModule.addTask(S)` SHALL be rejected and the task list length SHALL remain `|L|`.

**Validates: Requirements 5.4**

---

### Property 14: Task list save/load round-trip preserves all tasks and order

*For any* list of tasks L (each with unique id, non-empty title, boolean completed, numeric createdAt), saving L to storage and reloading it via `TodoModule.init()` SHALL produce a task list equal to L in the same order.

**Validates: Requirements 5.5, 11.1**

---

### Property 15: Valid edit confirm trims and updates title

*For any* task with title T and any confirm input string S where `S.trim()` is non-empty, does not duplicate another task (case-insensitive), and does not exceed 100 characters, calling `TodoModule.editTask(id, S)` SHALL store `S.trim()` as the new title.

**Validates: Requirements 6.4, 6.5**

---

### Property 16: Whitespace-only or duplicate edit input is always rejected

*For any* task with title T:
- *For any* all-whitespace confirm string: the edit is rejected, T is unchanged.
- *For any* confirm string that case-insensitively matches another existing task title: the edit is rejected, T is unchanged.

**Validates: Requirements 6.6, 6.7**

---

### Property 17: Completion toggle state is reflected in rendering

*For any* task with `completed = true`, the rendered task element SHALL have the strikethrough CSS class applied. *For any* task with `completed = false`, the rendered task element SHALL NOT have the strikethrough CSS class applied.

**Validates: Requirements 7.4, 7.5**

---

### Property 18: Deleted task no longer appears in list

*For any* task list L containing a task with id I, calling `TodoModule.deleteTask(I)` SHALL produce a task list that does not contain any task with id I, and the length SHALL be `|L| - 1`.

**Validates: Requirements 7.8**

---

### Property 19: Sorting does not mutate task data in storage

*For any* sort option O and any task list L, calling `TodoModule.setSortPreference(O)` SHALL re-render the list in the correct order for O but SHALL NOT modify the title, id, completed, or createdAt fields of any task in `_tasks` or in stored data.

**Validates: Requirements 8.2**

---

### Property 20: Sort preference is persisted and restored on reload

*For any* sort option O (one of the five valid values), selecting O via `TodoModule.setSortPreference(O)` SHALL persist O to storage, and a subsequent `TodoModule.init()` call SHALL apply sort order O when rendering.

**Validates: Requirements 8.3, 8.4**

---

### Property 21: Valid quick link is added and rendered as an anchor with target="_blank"

*For any* non-empty label L (≤ 100 chars) and URL U starting with `http://` or `https://`, calling `QuickLinksModule.addLink(L, U)` SHALL add the link to the list and render an `<a>` element with `href = U` and `target = "_blank"`.

**Validates: Requirements 9.2, 9.4**

---

### Property 22: Invalid quick link is always rejected

*For any* quick link submission where the label is empty, exceeds 100 characters, or the URL does not start with `http://` or `https://`, `QuickLinksModule.addLink()` SHALL be rejected and the link list length SHALL be unchanged.

**Validates: Requirements 9.3**

---

### Property 23: Quick link addition is rejected when list has 20 items

*For any* valid quick link (L, U), when `_links.length === 20`, calling `QuickLinksModule.addLink(L, U)` SHALL be rejected with an error indicating the maximum limit has been reached.

**Validates: Requirements 9.9**

---

### Property 24: Theme value is persisted and restored on reload

*For any* theme value V ∈ `{"light", "dark"}`, calling `ThemeModule.toggle()` (resulting in V) SHALL persist V to storage, and on next initialisation `ThemeModule._detect()` SHALL return V.

**Validates: Requirements 10.3, 10.4**

---

### Property 25: Corrupted localStorage data always falls back to defaults

*For any* storage key K containing an invalid JSON string or an out-of-range value, `StorageService.get(K)` SHALL return `null` (never throw), and the consuming module SHALL initialise its state to the documented default value and display the warning banner.

**Validates: Requirements 11.5, 4.6**

---

## Error Handling

### localStorage Unavailability

Every `StorageService.get()`, `set()`, and `remove()` call is wrapped in `try/catch`. On the first caught error, `StorageService._available` is set to `false` and `NotificationService.showWarning()` is called. Subsequent calls still attempt the operation (storage may recover mid-session) but do not re-show the banner.

```javascript
set(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (this._available) {
      this._available = false;
      NotificationService.showWarning('Data persistence is unavailable. Changes will not be saved.');
    }
  }
}
```

### Corrupted JSON

`StorageService.get()` wraps `JSON.parse()` in a `try/catch`. If parsing fails, it returns `null` and records the corruption:

```javascript
get(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch (e) {
    NotificationService.showWarning('Some saved data could not be read and has been reset to defaults.');
    return null;
  }
}
```

### Timer Completion Alert

When the timer reaches zero, `_onComplete()` calls `NotificationService.showAlert()` which renders a non-dismissible banner. A `setTimeout` of 5000 ms removes it. The banner uses `role="alert"` for screen-reader accessibility.

### Completion Toggle Rollback

Before persisting a toggle, the previous state is captured. If `StorageService.set()` fails (detected by checking `StorageService.isAvailable()` after the call), the task's `completed` field is reverted to the captured previous value and the task list is re-rendered.

### Delete Rollback

Similarly, before removing a task, it is captured. If persistence fails, the task is re-inserted at its original index.

### Input Validation

All validation errors are rendered as `<span class="error-msg">` elements adjacent to the offending input. They are cleared on the next valid submission or when the input is next focused.

---

## Testing Strategy

### Unit Tests

Unit tests verify specific functions and edge cases in isolation. They target pure functions and individual module methods with mocked `localStorage` and `Date`.

Recommended framework: **Jasmine** (no Node.js server required; runs in a standalone HTML `SpecRunner.html`). This fits the no-build-tools constraint while providing a proper assertion library.

Alternatively, if a Node.js environment is available: **Jest** with `jsdom` as the test environment.

**Pure function tests (deterministic — no mocking needed):**
- `ClockModule.formatTime(date)` — various dates including midnight, noon, single-digit values
- `ClockModule.formatDate(date)` — all 12 months, all 7 weekdays, year boundaries
- `GreetingModule.getGreetingWord(hour)` — all 24 hours, boundary values (5, 12, 18, 22)
- `GreetingModule.formatGreeting(word, name)` — non-empty name, empty name
- `TimerModule.formatSeconds(totalSeconds)` — 0, 1, 59, 60, 3599, 7200
- `TodoModule._validateTitle(title, excludeId)` — empty, whitespace, duplicate, over 100 chars, valid
- `QuickLinksModule._validateLink(label, url)` — various invalid/valid combinations

**Interaction tests (DOM + mocked localStorage):**
- Task add/edit/delete/toggle cycles
- Sort rendering order for all 5 sort options
- Timer start/stop/reset/complete cycle with fake timers
- Quick link add/delete cycle
- Theme toggle sequence

### Property-Based Tests

Property-based testing is applicable here because the core logic — time formatting, greeting selection, title validation, task persistence, sort ordering — consists of pure or near-pure functions over large input spaces. Using a PBT library against these functions will surface edge cases (e.g., Unicode in task titles, dates near day boundaries, sort stability with identical completion states) that example-based tests are unlikely to cover.

**Recommended library:** [`fast-check`](https://github.com/dubzzz/fast-check) (can be included as a single-file bundle for Jasmine, or used with Jest in Node.js environment).

Each property test must run a **minimum of 100 iterations**.

Each property test is tagged with a comment referencing the design property:

```javascript
// Feature: todo-life-dashboard, Property 1: Time formatting is always HH:MM:SS
```

**Property tests to implement:**

| Property | Module | fast-check Arbitraries |
|---|---|---|
| P1: formatTime | ClockModule | `fc.date()` |
| P2: formatDate | ClockModule | `fc.date()` |
| P3: getGreetingWord | GreetingModule | `fc.integer({min:0, max:23})` |
| P4: formatGreeting with name | GreetingModule | `fc.string()` × `fc.string({minLength:1})` |
| P5: saveName trims | GreetingModule | `fc.string().filter(s => s.trim().length > 0)` |
| P6: whitespace name removes | GreetingModule | `fc.stringOf(fc.constantFrom(' ','\t','\n'))` |
| P7: name round-trip | StorageService | `fc.string({minLength:1, maxLength:50})` |
| P8: reset returns duration | TimerModule | `fc.integer({min:1, max:120})` |
| P9: button state consistency | TimerModule | `fc.constantFrom('running','stopped','atZero')` |
| P10: valid duration accepted | TimerModule | `fc.integer({min:1, max:120})` |
| P11: invalid duration rejected | TimerModule | `fc.oneof(fc.integer({max:0}), fc.integer({min:121}), fc.float(), fc.string())` |
| P12: add unique task grows list | TodoModule | `fc.array(fc.string({minLength:1, maxLength:100}), {maxLength:50})` |
| P13: duplicate task rejected | TodoModule | `fc.string({minLength:1, maxLength:100})` |
| P14: task list round-trip | TodoModule | `fc.array(taskArbitrary, {maxLength:50})` |
| P15: edit trims and saves | TodoModule | `fc.string({minLength:1, maxLength:100})` |
| P16: invalid edit rejected | TodoModule | `fc.stringOf(fc.constantFrom(' ','\t','\n'))` |
| P17: completion rendering | TodoModule | `fc.boolean()` |
| P18: delete removes task | TodoModule | `fc.array(taskArbitrary, {minLength:1})` |
| P19: sort does not mutate | TodoModule | `fc.constantFrom('default','az','za','completed-last','completed-first')` |
| P20: sort pref round-trip | TodoModule | `fc.constantFrom('default','az','za','completed-last','completed-first')` |
| P21: valid link rendered | QuickLinksModule | `fc.string({minLength:1, maxLength:100})` × valid URL arbitrary |
| P22: invalid link rejected | QuickLinksModule | invalid label/URL combinations |
| P23: 20-link cap | QuickLinksModule | array of 20 valid links + one extra |
| P24: theme round-trip | ThemeModule | `fc.constantFrom('light','dark')` |
| P25: corrupted data → defaults | StorageService | `fc.string()` (not valid JSON) |

### Integration / Smoke Tests

These are run manually or via a simple Playwright/Puppeteer script against the running page:

- Page loads and all widgets are visible within 3 seconds (Requirement 12.1)
- No unhandled JavaScript errors in browser console (Requirement 12.2)
- File structure matches specification (Requirement 12.3)
- No `<script src>` or `<link rel="stylesheet">` pointing outside the project (Requirement 12.4)
- localStorage persistence survives page reload (Requirement 11.1)
- Warning banner appears when localStorage is disabled (private browsing mode)
- Theme is applied before first paint (no flash of wrong theme — Requirement 10.4)
