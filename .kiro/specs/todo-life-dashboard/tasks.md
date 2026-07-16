# Implementation Plan: To-Do Life Dashboard

## Overview

Build a fully client-side personal productivity homepage using pure HTML, CSS, and Vanilla JavaScript. The app consists of exactly three files: `index.html`, `css/style.css`, and `js/app.js`. All logic follows the Module Pattern described in the design; modules are initialised in sequence on `DOMContentLoaded`. All `localStorage` access goes through `StorageService`.

---

## Tasks

- [ ] 1. Scaffold project files and HTML skeleton
  - [ ] 1.1 Create `index.html`, `css/style.css`, and `js/app.js` with empty/boilerplate content
    - Create the three files in the exact paths specified by Requirement 12.3
    - `index.html` must `<link>` to `css/style.css` and `<script defer src="js/app.js">`
    - _Requirements: 12.3, 12.4, 12.5_

  - [ ] 1.2 Add full HTML markup skeleton to `index.html`
    - Add semantic `<header>`, `<main>`, and `<section>` elements for: clock/date, greeting, timer, todo list, quick links
    - Include all IDs and classes referenced by JS modules (`#clock-time`, `#clock-date`, `#greeting-text`, `#greeting-name-input`, `#greeting-save-btn`, `#timer-display`, `#timer-start`, `#timer-stop`, `#timer-reset`, `#pomodoro-input`, `#pomodoro-save`, `#task-input`, `#task-add-btn`, `#task-list`, `#task-sort`, `#link-label-input`, `#link-url-input`, `#link-add-btn`, `#links-list`, `#theme-toggle`, `#storage-warning`)
    - Add the inline `<script>` block for flash-free theme (as shown in design) before `<link rel="stylesheet">`
    - _Requirements: 10.4, 12.3_


- [ ] 2. CSS foundation and theme tokens
  - [ ] 2.1 Write CSS custom properties for both themes and base layout in `css/style.css`
    - Define all colour tokens under `[data-theme="light"]` and `[data-theme="dark"]` on `:root` / `html`
    - Add typography (font stack, sizes, line-heights), spacing scale, and base reset
    - Add flex/grid layout for the dashboard grid (header row + main widget grid)
    - _Requirements: 10.1, 10.2, 12.1_

  - [ ] 2.2 Add full light/dark mode CSS, toggle button styles, and transitions
    - Implement all colour custom properties fully for both themes (background, surface, text, border, accent)
    - Style the `#theme-toggle` button (icon or label swap, accessible focus ring)
    - Add `transition: background-color 0.1s, color 0.1s` to key elements so theme switch completes within 100 ms
    - _Requirements: 10.2, 10.5, 10.6_

  - [ ] 2.3 Add responsive layout and visual polish
    - Media queries for mobile viewport (single column) and desktop (multi-column grid)
    - Style all widget cards, inputs, buttons, error messages, notification banners, strikethrough on completed tasks
    - _Requirements: 12.1, 12.2_


- [ ] 3. StorageService and NotificationService
  - [ ] 3.1 Implement `StorageService` in `js/app.js`
    - Implement `init()` with a probe write/read/delete cycle; set `_available`
    - Implement `get(key)` with `try/catch` around `localStorage.getItem` + `JSON.parse`; return `null` on error and call `NotificationService.showWarning()` on first parse failure
    - Implement `set(key, value)` with `try/catch` around `JSON.stringify` + `localStorage.setItem`; call `NotificationService.showWarning()` on first failure, set `_available = false`
    - Implement `remove(key)` with `try/catch`
    - Implement `isAvailable()`
    - _Requirements: 11.2, 11.3, 11.4, 11.5_

  - [ ]* 3.2 Write property test for StorageService round-trip (Property 7)
    - **Property 7: Name save/load round-trip preserves value**
    - **Validates: Requirements 2.4**
    - Use `fc.string({minLength:1, maxLength:50})` arbitrary; mock `localStorage`

  - [ ]* 3.3 Write property test for corrupted data fallback (Property 25)
    - **Property 25: Corrupted localStorage data always falls back to defaults**
    - **Validates: Requirements 11.5, 4.6**
    - Inject invalid JSON strings into mocked `localStorage`; assert `get()` returns `null` and never throws

  - [ ] 3.4 Implement `NotificationService` in `js/app.js`
    - Implement `showWarning(message)` — renders or updates a persistent `#storage-warning` banner with `role="status"`; does not duplicate if already shown
    - Implement `hideWarning()`
    - Implement `showAlert(message, durationMs)` — renders auto-dismissing `role="alert"` banner; `setTimeout` removes it after `durationMs`
    - _Requirements: 2.5, 3.7, 11.2_


- [ ] 4. ThemeModule
  - [ ] 4.1 Implement `ThemeModule` in `js/app.js`
    - Implement `_detect()`: read `tld_theme` from `StorageService`; if not `"light"` or `"dark"`, check `window.matchMedia('(prefers-color-scheme: dark)')`; default to `"light"`
    - Implement `apply(theme)`: set `data-theme` attribute on `document.documentElement`
    - Implement `toggle()`: flip `_current`, call `apply()`, persist via `StorageService.set("tld_theme", ...)`
    - Implement `init()`: call `_detect()`, call `apply()`, wire `#theme-toggle` click handler
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ]* 4.2 Write property test for theme round-trip (Property 24)
    - **Property 24: Theme value is persisted and restored on reload**
    - **Validates: Requirements 10.3, 10.4**
    - Use `fc.constantFrom('light','dark')`; mock `StorageService`; assert `_detect()` returns the toggled value


- [ ] 5. ClockModule
  - [ ] 5.1 Implement `ClockModule` in `js/app.js`
    - Implement `formatTime(date)` — pure function: zero-pad hours, minutes, seconds → `"HH:MM:SS"`; return `"--:--:--"` if `date` is invalid
    - Implement `formatDate(date)` — pure function: build `"DayName, DD Month YYYY"` using arrays of English day/month names; return `"Unavailable"` if `date` is invalid
    - Implement `_tick()`: get `new Date()`, write to `#clock-time` and `#clock-date`
    - Implement `init()`: call `_tick()` immediately, then `setInterval(_tick, 1000)` and store `_intervalId`
    - Implement `_stop()` for test cleanup
    - _Requirements: 1.1, 1.2, 1.9_

  - [ ]* 5.2 Write property test for `formatTime` (Property 1)
    - **Property 1: Time formatting is always HH:MM:SS**
    - **Validates: Requirements 1.1**
    - Use `fc.date()` arbitrary; assert output matches `/^\d{2}:\d{2}:\d{2}$/` with valid range constraints

  - [ ]* 5.3 Write property test for `formatDate` (Property 2)
    - **Property 2: Date formatting always matches "DayName, DD Month YYYY"**
    - **Validates: Requirements 1.2**
    - Use `fc.date()` arbitrary; assert output matches `/<DayName>, \d{2} <MonthName> \d{4}/`


- [ ] 6. GreetingModule
  - [ ] 6.1 Implement `GreetingModule` pure functions in `js/app.js`
    - Implement `getGreetingWord(hour)`: map integer [0–23] to greeting strings per Requirements 1.3–1.6
    - Implement `formatGreeting(word, name)`: if `name` is non-empty return `"${word}, ${name}!"`; else return `"${word}!"`
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [ ]* 6.2 Write property test for `getGreetingWord` (Property 3)
    - **Property 3: Greeting word maps correctly to all hour ranges**
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.6**
    - Use `fc.integer({min:0, max:23})`; assert correct string for every hour

  - [ ]* 6.3 Write property test for `formatGreeting` with name (Property 4)
    - **Property 4: Greeting with name always follows "[word], [name]!" pattern**
    - **Validates: Requirements 1.7**
    - Use `fc.string()` × `fc.string({minLength:1})`; assert exact concatenation pattern

  - [ ] 6.4 Implement `GreetingModule.saveName`, `render`, and `init` in `js/app.js`
    - `saveName(rawInput)`: trim; if non-empty persist to `StorageService` key `tld_greetingName`; else call `StorageService.remove("tld_greetingName")`; call `render()`
    - `render()`: read name from `StorageService`; read current hour from `new Date()`; compose greeting via pure functions; write to `#greeting-text`
    - `init()`: call `render()`; populate `#greeting-name-input` with stored name; wire save button and Enter-key on input
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 6.5 Write property test for `saveName` trim behaviour (Property 5)
    - **Property 5: Non-whitespace name is trimmed and saved correctly**
    - **Validates: Requirements 2.2**
    - Use `fc.string().filter(s => s.trim().length > 0)`; assert stored value equals `input.trim()`

  - [ ]* 6.6 Write property test for whitespace name removal (Property 6)
    - **Property 6: Whitespace-only or empty name submission removes stored name**
    - **Validates: Requirements 2.3**
    - Use `fc.stringOf(fc.constantFrom(' ','\t','\n'))`; assert greeting rendered without name


- [ ] 7. TimerModule — core state machine
  - [ ] 7.1 Implement `TimerModule` state machine and display in `js/app.js`
    - Implement `formatSeconds(totalSeconds)` — pure function: `Math.floor(s/60)` padded + `:` + remainder padded → `"MM:SS"`
    - Implement `_updateDisplay()`: read `_remaining`, call `formatSeconds`, write to `#timer-display`
    - Implement `_updateButtons()`: enable/disable `#timer-start`, `#timer-stop`, `#timer-reset` per the button-state table in the design
    - Implement `start()`, `stop()`, `reset()`, `_tick()`, `_onComplete()`
    - `_onComplete()`: clear interval, set `_running = false`, set `_remaining = 0`, call `_updateDisplay()`, `_updateButtons()`, `NotificationService.showAlert('Focus session complete!', 5000)`
    - Implement `init()`: read `tld_pomodoroDuration` from `StorageService`, validate and set `_duration` (default 25), set `_remaining = _duration * 60`, call `_updateDisplay()`, `_updateButtons()`, wire button click handlers
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [ ]* 7.2 Write property test for `formatSeconds` — valid range (Property 8 setup)
    - Use `fc.integer({min:0, max:7200})`; assert output matches `MM:SS` format with correct values

  - [ ]* 7.3 Write property test for reset returns duration (Property 8)
    - **Property 8: Reset always returns timer display to current Pomodoro_Duration**
    - **Validates: Requirements 3.6**
    - Use `fc.integer({min:1, max:120})`; set `_duration`, call `reset()`, assert `_remaining === duration * 60`

  - [ ]* 7.4 Write property test for button state consistency (Property 9)
    - **Property 9: Timer button state is always consistent with running state**
    - **Validates: Requirements 3.9, 3.10**
    - Use `fc.constantFrom('running','stopped','atZero')`; assert enabled/disabled state matches design table


- [ ] 8. TimerModule — configurable Pomodoro duration
  - [ ] 8.1 Implement `TimerModule.saveDuration` in `js/app.js`
    - Parse `rawInput` as integer; reject if `NaN`, decimal, less than 1, or greater than 120 — display inline error on `#pomodoro-error`
    - If valid and timer is running, display inline message on `#pomodoro-error` that timer must be stopped first; do not apply change
    - If valid and timer is not running: persist to `StorageService.set("tld_pomodoroDuration", D)`, update `_duration`, call `reset()`
    - Wire `#pomodoro-save` click handler and Enter-key on `#pomodoro-input` in `init()`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 8.2 Write property test for valid duration accepted (Property 10)
    - **Property 10: Valid Pomodoro_Duration in [1, 120] is accepted and displayed**
    - **Validates: Requirements 4.2**
    - Use `fc.integer({min:1, max:120})`; assert storage updated and `_remaining === D * 60`

  - [ ]* 8.3 Write property test for invalid duration rejected (Property 11)
    - **Property 11: Duration outside [1, 120] is always rejected**
    - **Validates: Requirements 4.3, 4.4**
    - Use `fc.oneof(fc.integer({max:0}), fc.integer({min:121}), fc.float(), fc.string())`; assert no storage write and previous duration unchanged


- [ ] 9. Checkpoint — core services and clock/greeting/timer complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. TodoModule — add task
  - [ ] 10.1 Implement `TodoModule._validateTitle` and `addTask` in `js/app.js`
    - `_validateTitle(title, excludeId)` — pure function: trim, check non-empty (max 100 chars), check no case-insensitive duplicate in `_tasks` excluding `excludeId`; return `{valid: bool, error: string|null}`
    - `addTask(title)`: call `_validateTitle`; on failure display error in `#task-add-error`; on success create `{id: crypto.randomUUID(), title: title.trim(), completed: false, createdAt: Date.now()}`, push to `_tasks`, call `_persist()`, call `_render()`
    - Wire `#task-add-btn` click and Enter-key on `#task-input` in `init()`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 10.2 Write property test for unique task grows list (Property 12)
    - **Property 12: Adding a valid unique task increases list length by one**
    - **Validates: Requirements 5.2**
    - Use arrays of unique title strings; assert `_tasks.length === before + 1` and title equals trimmed input

  - [ ]* 10.3 Write property test for duplicate task rejected (Property 13)
    - **Property 13: Case-insensitive duplicate task addition is always rejected**
    - **Validates: Requirements 5.4**
    - Use `fc.string({minLength:1, maxLength:100})`; pre-seed list; call `addTask` with same/different-case string; assert length unchanged


- [ ] 11. TodoModule — edit task
  - [ ] 11.1 Implement `TodoModule.editTask` and inline edit UI in `js/app.js`
    - `editTask(id, newTitle)`: call `_validateTitle(newTitle, id)`; on failure display inline error next to the task's input; on success update `_tasks` entry, call `_persist()`, call `_render()`
    - `_renderTask(task)`: render edit button that replaces the title span with an `<input>` pre-filled with current title (cursor at end), and shows confirm/cancel buttons
    - On cancel: restore original title display without persisting
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

  - [ ]* 11.2 Write property test for valid edit trims and saves (Property 15)
    - **Property 15: Valid edit confirm trims and updates title**
    - **Validates: Requirements 6.4, 6.5**
    - Use `fc.string({minLength:1, maxLength:100}).filter(s => s.trim().length > 0)`; assert stored title equals `input.trim()`

  - [ ]* 11.3 Write property test for invalid edit rejected (Property 16)
    - **Property 16: Whitespace-only or duplicate edit input is always rejected**
    - **Validates: Requirements 6.6, 6.7**
    - Use whitespace-only strings and strings matching another task title; assert original title unchanged


- [ ] 12. TodoModule — complete and delete tasks
  - [ ] 12.1 Implement `TodoModule.toggleComplete` and `deleteTask` in `js/app.js`
    - `toggleComplete(id)`: capture previous `completed` value; flip it in `_tasks`; call `_persist()`; if `StorageService.isAvailable()` is `false` after the call, revert to previous value and re-render; else re-render
    - `deleteTask(id)`: capture task and its index; remove from `_tasks`; call `_persist()`; if `StorageService.isAvailable()` is `false`, re-insert at original index and re-render with error; else re-render
    - `_renderTask(task)`: apply CSS class `task--completed` (strikethrough) when `task.completed === true`
    - Wire checkbox/toggle and delete button in `_renderTask`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_

  - [ ]* 12.2 Write property test for completion rendering (Property 17)
    - **Property 17: Completion toggle state is reflected in rendering**
    - **Validates: Requirements 7.4, 7.5**
    - Use `fc.boolean()`; assert `task--completed` class present iff `completed === true`

  - [ ]* 12.3 Write property test for delete removes task (Property 18)
    - **Property 18: Deleted task no longer appears in list**
    - **Validates: Requirements 7.8**
    - Use `fc.array(taskArbitrary, {minLength:1})`; pick random id; assert list length decreases by 1 and no task with that id remains


- [ ] 13. TodoModule — sort and persistence
  - [ ] 13.1 Implement `TodoModule._getSortedTasks`, `setSortPreference`, `_persist`, `_render`, and `init` in `js/app.js`
    - `_getSortedTasks()`: return a **shallow copy** of `_tasks` sorted per `_sortPref`; never mutate `_tasks`
    - `setSortPreference(pref)`: persist `pref` to `StorageService.set("tld_sortPreference", pref)`, update `_sortPref`, call `_render()`; re-render must complete within 300 ms
    - `_persist()`: call `StorageService.set("tld_tasks", _tasks)`
    - `_render()`: clear `#task-list`, append `_renderTask(task)` for each task in `_getSortedTasks()`
    - `init()`: load tasks from `StorageService.get("tld_tasks")` (validate array, default `[]`), load sort pref (default `"default"`), call `_render()`, wire `#task-sort` change handler
    - _Requirements: 5.5, 8.1, 8.2, 8.3, 8.4, 8.5, 11.1_

  - [ ]* 13.2 Write property test for sort does not mutate task data (Property 19)
    - **Property 19: Sorting does not mutate task data in storage**
    - **Validates: Requirements 8.2**
    - Use `fc.constantFrom('default','az','za','completed-last','completed-first')`; assert `_tasks` array unchanged after `setSortPreference`

  - [ ]* 13.3 Write property test for sort preference round-trip (Property 20)
    - **Property 20: Sort preference is persisted and restored on reload**
    - **Validates: Requirements 8.3, 8.4**
    - Use `fc.constantFrom('default','az','za','completed-last','completed-first')`; assert stored value and re-loaded sort pref match

  - [ ]* 13.4 Write property test for task list round-trip (Property 14)
    - **Property 14: Task list save/load round-trip preserves all tasks and order**
    - **Validates: Requirements 5.5, 11.1**
    - Use array of task objects; call `_persist()` then reload via `init()`; assert task list equals original


- [ ] 14. Checkpoint — TodoModule complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. QuickLinksModule
  - [ ] 15.1 Implement `QuickLinksModule._validateLink`, `addLink`, `deleteLink`, `_render`, `_renderCard`, `_persist`, and `init` in `js/app.js`
    - `_validateLink(label, url)`: pure function — check label non-empty and ≤ 100 chars; check URL starts with `http://` or `https://`; return `{valid, errors}`
    - `addLink(label, url)`: call `_validateLink`; if invalid display field-level errors on `#link-label-error` / `#link-url-error`; if `_links.length >= 20` display error on `#link-cap-error`; on success create `{id, label: label.trim(), url, createdAt: Date.now()}`, push to `_links`, call `_persist()`, call `_render()`
    - `deleteLink(id)`: remove from `_links`, call `_persist()`, call `_render()`
    - `_renderCard(link)`: return `<a href="{url}" target="_blank" rel="noopener noreferrer">` element with a delete button inside
    - `init()`: load `_links` from `StorageService` (validate array, default `[]`), call `_render()`, wire `#link-add-btn` click handler
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_

  - [ ]* 15.2 Write property test for valid link rendered with target="_blank" (Property 21)
    - **Property 21: Valid quick link is added and rendered as an anchor with target="_blank"**
    - **Validates: Requirements 9.2, 9.4**
    - Use `fc.string({minLength:1, maxLength:100})` × URL arbitrary starting with `http://` or `https://`; assert `<a>` has correct `href` and `target`

  - [ ]* 15.3 Write property test for invalid link rejected (Property 22)
    - **Property 22: Invalid quick link is always rejected**
    - **Validates: Requirements 9.3**
    - Use invalid label (empty/over 100 chars) and invalid URL (wrong prefix); assert list length unchanged

  - [ ]* 15.4 Write property test for 20-link cap (Property 23)
    - **Property 23: Quick link addition is rejected when list has 20 items**
    - **Validates: Requirements 9.9**
    - Pre-seed `_links` with exactly 20 entries; attempt `addLink` with valid input; assert list length stays at 20


- [ ] 16. TimeoutGuard
  - [ ] 16.1 Implement `TimeoutGuard` in `js/app.js`
    - `init()`: call `setTimeout(() => TimeoutGuard._showError(), 10000)` and store the timeout id; wire into startup sequence so that `DOMContentLoaded` clears it via `clearTimeout`
    - `_showError()`: display a visible error element (or use `NotificationService.showWarning`) instructing the user to reload the page
    - Place `TimeoutGuard.init()` call at the very top of the script (before `DOMContentLoaded`) per the startup sequence in the design
    - _Requirements: 12.6_

- [ ] 17. Wire all modules in `DOMContentLoaded` and final integration
  - [ ] 17.1 Wire the startup sequence in `js/app.js`
    - Inside `document.addEventListener('DOMContentLoaded', ...)`: call `StorageService.init()`, `ThemeModule.init()`, `ClockModule.init()`, `GreetingModule.init()`, `TimerModule.init()`, `TodoModule.init()`, `QuickLinksModule.init()`
    - Clear `TimeoutGuard` timeout at the end of `DOMContentLoaded`
    - Ensure all module declarations appear before the `DOMContentLoaded` listener
    - _Requirements: 11.1, 12.1, 12.6_

  - [ ]* 17.2 Write integration-level unit tests for full add/edit/delete task cycle
    - Test: add task → edit title → toggle complete → delete; assert state correct at each step
    - Test: add duplicate task → assert rejected; sort change → assert rendered order; persistence survives simulated reload
    - _Requirements: 5.2, 5.4, 6.5, 7.2, 7.8, 8.2_

- [ ] 18. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All property tests use `fast-check` (include as a single-file bundle for Jasmine, or use with Jest + jsdom)
- Each property test must run a minimum of 100 iterations
- Each property test file must start with a comment: `// Feature: todo-life-dashboard, Property N: <title>`
- No ES module syntax — use plain object literals to keep the file loadable via `file://`
- `crypto.randomUUID()` is available in all modern browsers; no polyfill needed for Requirement 12.2 targets
- Checkpoints are manual verification steps; they do not produce artifacts

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1", "3.4"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.1"] },
    { "id": 4, "tasks": ["4.2", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3", "6.4"] },
    { "id": 7, "tasks": ["6.5", "6.6", "7.1"] },
    { "id": 8, "tasks": ["7.2", "7.3", "7.4", "8.1"] },
    { "id": 9, "tasks": ["8.2", "8.3", "10.1"] },
    { "id": 10, "tasks": ["10.2", "10.3", "11.1"] },
    { "id": 11, "tasks": ["11.2", "11.3", "12.1"] },
    { "id": 12, "tasks": ["12.2", "12.3", "13.1"] },
    { "id": 13, "tasks": ["13.2", "13.3", "13.4", "15.1"] },
    { "id": 14, "tasks": ["15.2", "15.3", "15.4", "16.1"] },
    { "id": 15, "tasks": ["17.1"] },
    { "id": 16, "tasks": ["17.2"] }
  ]
}
```
