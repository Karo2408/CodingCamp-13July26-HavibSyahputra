/* js/app.js — To-Do Life Dashboard application logic */

/*
 * Startup sequence (called after DOMContentLoaded):
 *   TimeoutGuard.init()        ← starts 10 s watchdog (called before DOMContentLoaded)
 *   StorageService.init()      ← probe localStorage availability
 *   ThemeModule.init()         ← apply saved theme / OS preference
 *   ClockModule.init()         ← start 1-second setInterval
 *   GreetingModule.init()      ← read name, render greeting
 *   TimerModule.init()         ← read saved duration, render timer
 *   TodoModule.init()          ← read tasks + sort pref, render list
 *   QuickLinksModule.init()    ← read links, render cards
 */

/* =========================================================================
   NotificationService — handles warning banners and auto-dismissing alerts.
   Defined first so StorageService.init() can call it during its probe.
   ========================================================================= */

const NotificationService = {
  /**
   * Renders or updates the persistent #storage-warning banner.
   * The element already exists in the HTML; it is hidden via CSS when empty.
   * If the banner is already showing (non-empty textContent), the message is
   * updated in place — no duplicate element is created.
   *
   * @param {string} message  Text to display in the warning banner.
   */
  showWarning(message) {
    const banner = document.getElementById('storage-warning');
    if (!banner) return;
    // Setting textContent replaces any prior message — no duplicates possible.
    banner.textContent = message;
    banner.setAttribute('role', 'status');
  },

  /**
   * Hides the persistent warning banner by clearing its textContent.
   * The CSS rule `#storage-warning:empty { display: none }` takes over.
   */
  hideWarning() {
    const banner = document.getElementById('storage-warning');
    if (!banner) return;
    banner.textContent = '';
  },

  /**
   * Renders an auto-dismissing alert banner appended to document.body.
   * The banner uses role="alert" for screen-reader accessibility and is
   * automatically removed from the DOM after `durationMs` milliseconds.
   *
   * @param {string} message     Text to display in the alert.
   * @param {number} durationMs  Milliseconds before the alert is removed.
   */
  showAlert(message, durationMs) {
    const alert = document.createElement('div');
    alert.setAttribute('role', 'alert');
    alert.className = 'notification-alert';
    alert.textContent = message;
    document.body.appendChild(alert);

    setTimeout(function () {
      if (alert.parentNode) {
        alert.parentNode.removeChild(alert);
      }
    }, durationMs);
  },
};

/* =========================================================================
   StorageService — central wrapper for all localStorage access.
   All other modules call this service, never localStorage directly.
   ========================================================================= */

const StorageService = {
  _available: true,

  /**
   * Probes localStorage with a test write/read/delete cycle.
   * Sets _available = false and shows a warning if any step fails.
   */
  init() {
    const probeKey = '__tld_probe__';
    const probeValue = '1';
    try {
      localStorage.setItem(probeKey, probeValue);
      const readBack = localStorage.getItem(probeKey);
      localStorage.removeItem(probeKey);
      if (readBack !== probeValue) {
        throw new Error('Probe read-back mismatch');
      }
      this._available = true;
    } catch (e) {
      this._available = false;
      NotificationService.showWarning(
        'Data persistence is unavailable. Changes will not be saved.'
      );
    }
  },

  /**
   * Retrieves and JSON-parses the value stored under `key`.
   * Returns null if the key is missing or if parsing fails.
   * On a parse error, calls NotificationService.showWarning().
   *
   * @param {string} key
   * @returns {*} parsed value, or null
   */
  get(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch (e) {
      NotificationService.showWarning(
        'Some saved data could not be read and has been reset to defaults.'
      );
      return null;
    }
  },

  /**
   * JSON-serialises `value` and stores it under `key`.
   * On the first failure, sets _available = false and shows a warning.
   *
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      if (this._available) {
        this._available = false;
        NotificationService.showWarning(
          'Data persistence is unavailable. Changes will not be saved.'
        );
      }
    }
  },

  /**
   * Removes the entry stored under `key`.
   * Silently swallows any error (e.g. storage unavailable in private mode).
   *
   * @param {string} key
   */
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // Storage unavailable — nothing further to do here.
    }
  },

  /**
   * Returns whether localStorage is currently considered available.
   *
   * @returns {boolean}
   */
  isAvailable() {
    return this._available;
  },
};

/* ========= ThemeModule ========= */

const ThemeModule = {
  _current: 'light',

  /**
   * Detects the appropriate theme by checking in order:
   *  1. Saved value in localStorage via StorageService ("light" or "dark")
   *  2. OS/browser prefers-color-scheme media query
   *  3. Default: "light"
   *
   * @returns {"light"|"dark"}
   */
  _detect() {
    const saved = StorageService.get('tld_theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  },

  /**
   * Applies the given theme by setting the data-theme attribute on <html>
   * and updating the internal _current state.
   *
   * @param {"light"|"dark"} theme
   */
  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this._current = theme;
  },

  /**
   * Flips the current theme between "light" and "dark", applies the new
   * theme, and persists the selection to localStorage via StorageService.
   */
  toggle() {
    const next = this._current === 'light' ? 'dark' : 'light';
    this.apply(next);
    StorageService.set('tld_theme', this._current);
  },

  /**
   * Initialises the ThemeModule:
   *  1. Detects the correct theme (localStorage → OS preference → default)
   *  2. Applies it to <html>
   *  3. Wires the #theme-toggle button click handler
   */
  init() {
    const detected = this._detect();
    this.apply(detected);

    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggle());
    }
  },
};

/* ========= ClockModule ========= */

const ClockModule = {
  _intervalId: null,

  /**
   * Pure function — formats a Date object as "HH:MM:SS" (24-hour, zero-padded).
   * Returns "--:--:--" if the argument is not a valid Date.
   *
   * @param {Date} date
   * @returns {string}
   */
  formatTime(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return '--:--:--';
    }
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  },

  /**
   * Pure function — formats a Date object as "DayName, DD Month YYYY".
   * Returns "Unavailable" if the argument is not a valid Date.
   *
   * @param {Date} date
   * @returns {string}
   */
  formatDate(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return 'Unavailable';
    }
    const DAYS = [
      'Sunday', 'Monday', 'Tuesday', 'Wednesday',
      'Thursday', 'Friday', 'Saturday',
    ];
    const MONTHS = [
      'January', 'February', 'March', 'April',
      'May', 'June', 'July', 'August',
      'September', 'October', 'November', 'December',
    ];
    const dayName   = DAYS[date.getDay()];
    const dd        = String(date.getDate()).padStart(2, '0');
    const monthName = MONTHS[date.getMonth()];
    const yyyy      = date.getFullYear();
    return `${dayName}, ${dd} ${monthName} ${yyyy}`;
  },

  /**
   * Reads the current system time, then writes the formatted time and date
   * strings to the #clock-time and #clock-date DOM elements.
   */
  _tick() {
    const now = new Date();
    const timeEl = document.getElementById('clock-time');
    const dateEl = document.getElementById('clock-date');
    if (timeEl) timeEl.textContent = this.formatTime(now);
    if (dateEl) dateEl.textContent = this.formatDate(now);
  },

  /**
   * Starts the clock: renders the current time immediately, then updates
   * every second via setInterval.
   */
  init() {
    this._tick();
    this._intervalId = setInterval(() => this._tick(), 1000);
  },

  /**
   * Stops the clock interval. Used for test cleanup.
   */
  _stop() {
    clearInterval(this._intervalId);
  },
};

/* ========= GreetingModule ========= */

const GreetingModule = {
  /**
   * Maps the current hour (0–23) to the appropriate greeting word.
   * Pure function — no side effects.
   *
   * Hour ranges:
   *   05–11  → "Good Morning"
   *   12–17  → "Good Afternoon"
   *   18–21  → "Good Evening"
   *   22–23, 00–04 → "Good Night"
   *
   * @param {number} hour  Integer in [0, 23]
   * @returns {"Good Morning"|"Good Afternoon"|"Good Evening"|"Good Night"}
   */
  getGreetingWord(hour) {
    if (hour >= 5 && hour <= 11) {
      return 'Good Morning';
    } else if (hour >= 12 && hour <= 17) {
      return 'Good Afternoon';
    } else if (hour >= 18 && hour <= 21) {
      return 'Good Evening';
    } else {
      // Covers 22–23 and 00–04
      return 'Good Night';
    }
  },

  /**
   * Composes the final greeting string from a greeting word and an optional name.
   * Pure function — no side effects.
   *
   * @param {string} word  One of the four greeting words.
   * @param {string|null|undefined} name  The user's saved name (may be empty/null/undefined).
   * @returns {string}  "[word], [name]!" if name is non-empty after trim; "[word]!" otherwise.
   */
  formatGreeting(word, name) {
    if (name && name.trim().length > 0) {
      return word + ', ' + name.trim() + '!';
    }
    return word + '!';
  },

  /**
   * Trims the raw input. If the trimmed value is non-empty, persists it to
   * StorageService under key "tld_greetingName". If empty/whitespace-only,
   * removes the key from storage. Then re-renders the greeting.
   *
   * Satisfies Requirements 2.2, 2.3.
   *
   * @param {string} rawInput  The unprocessed value from the name input field.
   */
  saveName(rawInput) {
    const trimmed = (rawInput || '').trim();
    if (trimmed.length > 0) {
      StorageService.set('tld_greetingName', trimmed);
    } else {
      StorageService.remove('tld_greetingName');
    }
    this.render();
  },

  /**
   * Reads the saved Greeting_Name and the current system hour, composes the
   * greeting via the pure helper functions, and writes it to #greeting-text.
   *
   * Satisfies Requirements 1.3–1.8, 2.1, 2.4.
   */
  render() {
    const name = StorageService.get('tld_greetingName') || '';
    const hour = new Date().getHours();
    const word = this.getGreetingWord(hour);
    const greeting = this.formatGreeting(word, name);
    const el = document.getElementById('greeting-text');
    if (el) el.textContent = greeting;
  },

  /**
   * Initialises the GreetingModule:
   *  1. Renders the greeting immediately (picks up any saved name).
   *  2. Pre-populates #greeting-name-input with the stored name.
   *  3. Wires the #greeting-save-btn click handler.
   *  4. Wires the Enter-key handler on #greeting-name-input.
   *
   * Satisfies Requirements 2.1, 2.4, 2.5.
   */
  init() {
    this.render();

    const nameInput = document.getElementById('greeting-name-input');
    const saveBtn = document.getElementById('greeting-save-btn');
    const storedName = StorageService.get('tld_greetingName') || '';

    if (nameInput) nameInput.value = storedName;

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveName(nameInput ? nameInput.value : '');
      });
    }

    if (nameInput) {
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.saveName(nameInput.value);
        }
      });
    }
  },
};

/* ========= TimerModule ========= */

const TimerModule = {
  _duration: 25,     // current Pomodoro_Duration in minutes
  _remaining: 1500,  // seconds remaining
  _running: false,
  _intervalId: null,

  /**
   * Pure function — converts a total number of seconds to a "MM:SS" string.
   * Both parts are zero-padded to two digits.
   *
   * @param {number} totalSeconds  Non-negative integer
   * @returns {string}  e.g. "25:00", "09:05", "00:00"
   */
  formatSeconds(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  },

  /**
   * Reads _remaining, formats it, and writes the result to #timer-display.
   * Satisfies Requirements 3.1, 3.2.
   */
  _updateDisplay() {
    const el = document.getElementById('timer-display');
    if (el) el.textContent = this.formatSeconds(this._remaining);
  },

  /**
   * Enables/disables #timer-start, #timer-stop, and #timer-reset
   * according to the button-state table (Requirements 3.9, 3.10):
   *
   *   State            | Start    | Stop     | Reset
   *   -----------------|----------|----------|---------
   *   Running          | disabled | enabled  | enabled
   *   Stopped/paused   | enabled  | disabled | enabled
   *   At zero          | disabled | disabled | enabled
   */
  _updateButtons() {
    const startBtn = document.getElementById('timer-start');
    const stopBtn  = document.getElementById('timer-stop');
    const resetBtn = document.getElementById('timer-reset');

    if (this._running) {
      // Running state
      if (startBtn) startBtn.disabled = true;
      if (stopBtn)  stopBtn.disabled  = false;
      if (resetBtn) resetBtn.disabled = false;
    } else if (this._remaining === 0) {
      // At-zero state
      if (startBtn) startBtn.disabled = true;
      if (stopBtn)  stopBtn.disabled  = true;
      if (resetBtn) resetBtn.disabled = false;
    } else {
      // Stopped/paused state
      if (startBtn) startBtn.disabled = false;
      if (stopBtn)  stopBtn.disabled  = true;
      if (resetBtn) resetBtn.disabled = false;
    }
  },

  /**
   * Starts the countdown. No-ops if already running or if time is at zero.
   * Satisfies Requirement 3.3.
   */
  start() {
    if (this._running || this._remaining === 0) return;
    this._running = true;
    this._updateButtons();
    this._intervalId = setInterval(() => this._tick(), 1000);
  },

  /**
   * Pauses the countdown. No-ops if not currently running.
   * Satisfies Requirements 3.4, 3.5.
   */
  stop() {
    if (!this._running) return;
    clearInterval(this._intervalId);
    this._intervalId = null;
    this._running = false;
    this._updateButtons();
  },

  /**
   * Stops the timer and resets remaining time to _duration * 60.
   * Satisfies Requirement 3.6.
   */
  reset() {
    clearInterval(this._intervalId);
    this._intervalId = null;
    this._running = false;
    this._remaining = this._duration * 60;
    this._updateDisplay();
    this._updateButtons();
  },

  /**
   * Called every second by the interval. Decrements _remaining by one,
   * updates the display, and fires _onComplete() when it reaches zero.
   */
  _tick() {
    this._remaining--;
    this._updateDisplay();
    if (this._remaining <= 0) {
      this._onComplete();
    }
  },

  /**
   * Called when the timer reaches zero. Clears the interval, marks the
   * timer as stopped, zeroes remaining time, updates display and buttons,
   * then shows the completion alert banner for 5 seconds.
   * Satisfies Requirements 3.7, 3.8.
   */
  _onComplete() {
    clearInterval(this._intervalId);
    this._intervalId = null;
    this._running = false;
    this._remaining = 0;
    this._updateDisplay();
    this._updateButtons();
    FocusModal.show();
  },

  /**
   * Validates rawInput as a Pomodoro_Duration, persists it, and resets the timer.
   * Satisfies Requirements 4.1–4.7.
   *
   * Validation rules:
   *  - Must be a whole (integer) number — no decimals, no NaN.
   *  - Must be in the range [1, 120].
   * If the timer is currently running, the change is rejected with an inline message.
   *
   * @param {string} rawInput  Raw value from the #pomodoro-input field.
   */
  saveDuration(rawInput) {
    const errorEl = document.getElementById('pomodoro-error');
    const D = Number(rawInput);

    // Clear previous error/message
    if (errorEl) errorEl.textContent = '';

    // Validation: must be a positive integer in [1, 120]
    if (!Number.isInteger(D) || D < 1 || D > 120) {
      if (errorEl) errorEl.textContent = 'Please enter a whole number between 1 and 120.';
      return;
    }

    // Cannot change while running
    if (this._running) {
      if (errorEl) errorEl.textContent = 'Stop the timer before changing the duration.';
      return;
    }

    // Valid and not running — apply
    StorageService.set('tld_pomodoroDuration', D);
    this._duration = D;
    this.reset();
  },

  /**
   * Initialises the TimerModule:
   *  1. Reads `tld_pomodoroDuration` from StorageService; validates it
   *     (positive integer 1–120); falls back to 25 if absent/invalid.
   *  2. Sets _duration and _remaining accordingly.
   *  3. Renders the display and button states.
   *  4. Wires click handlers for #timer-start, #timer-stop, #timer-reset.
   *  5. Pre-populates #pomodoro-input with the current duration.
   *  6. Wires the #pomodoro-save click handler and Enter-key on #pomodoro-input
   *     to call saveDuration().
   *
   * Satisfies Requirements 3.1, 3.2, 4.1–4.7.
   */
  init() {
    // Read and validate saved duration
    const saved = StorageService.get('tld_pomodoroDuration');
    const DEFAULT_DURATION = 25;

    if (
      saved !== null &&
      Number.isInteger(saved) &&
      saved >= 1 &&
      saved <= 120
    ) {
      this._duration = saved;
    } else {
      this._duration = DEFAULT_DURATION;
    }

    this._remaining = this._duration * 60;
    this._updateDisplay();
    this._updateButtons();

    // Wire timer control button handlers
    const startBtn = document.getElementById('timer-start');
    const stopBtn  = document.getElementById('timer-stop');
    const resetBtn = document.getElementById('timer-reset');

    if (startBtn) startBtn.addEventListener('click', () => this.start());
    if (stopBtn)  stopBtn.addEventListener('click',  () => this.stop());
    if (resetBtn) resetBtn.addEventListener('click', () => this.reset());

    // Wire duration save controls
    const saveBtn       = document.getElementById('pomodoro-save');
    const pomodoroInput = document.getElementById('pomodoro-input');

    // Pre-populate the duration input with the current (or restored) duration
    if (pomodoroInput) pomodoroInput.value = this._duration;

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveDuration(pomodoroInput ? pomodoroInput.value : '');
      });
    }

    if (pomodoroInput) {
      pomodoroInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.saveDuration(pomodoroInput.value);
        }
      });
    }
  },
};

/* ========= TodoModule ========= */

const TodoModule = {
  _tasks: [],
  _sortPref: 'default',

  /**
   * Pure function — validates a task title for add or edit operations.
   *
   * Validation order:
   *  1. Trim title; if empty → error
   *  2. If longer than 100 chars → error
   *  3. Case-insensitive duplicate check against _tasks (excluding excludeId) → error
   *  4. Otherwise → valid
   *
   * @param {string} title      The raw title string to validate.
   * @param {string|null} excludeId  Task id to exclude from duplicate check (use null for new tasks).
   * @returns {{ valid: boolean, error: string|null }}
   */
  _validateTitle(title, excludeId) {
    const trimmed = (title || '').trim();
    if (trimmed.length === 0) {
      return { valid: false, error: 'Task title cannot be empty.' };
    }
    if (trimmed.length > 100) {
      return { valid: false, error: 'Task title must be 100 characters or fewer.' };
    }
    const lower = trimmed.toLowerCase();
    for (let i = 0; i < this._tasks.length; i++) {
      if (this._tasks[i].id !== excludeId && this._tasks[i].title.toLowerCase() === lower) {
        return { valid: false, error: 'A task with this title already exists.' };
      }
    }
    return { valid: true, error: null };
  },

  /**
   * Adds a new task to the list after validating the title.
   * On failure: displays the validation error in #task-add-error.
   * On success: creates a task object, pushes to _tasks, persists, renders,
   * and clears the #task-input field.
   *
   * Satisfies Requirements 5.1, 5.2, 5.3, 5.4.
   *
   * @param {string} title  The raw title value from the input field.
   */
  addTask(title) {
    const errorEl = document.getElementById('task-add-error');
    if (errorEl) errorEl.textContent = '';

    const validation = this._validateTitle(title, null);
    if (!validation.valid) {
      if (errorEl) errorEl.textContent = validation.error;
      return;
    }

    const task = {
      id: crypto.randomUUID(),
      title: title.trim(),
      completed: false,
      createdAt: Date.now(),
    };
    this._tasks.push(task);
    this._persist();
    this._render();

    const taskInput = document.getElementById('task-input');
    if (taskInput) taskInput.value = '';
  },

  // ── Stub methods (to be implemented in later tasks) ───────────────────────

  /**
   * Updates the title of an existing task after validation.
   * On failure: displays an inline error next to the task's edit input.
   * On success: updates _tasks entry, persists, and re-renders the list.
   *
   * Satisfies Requirements 6.4, 6.5, 6.6, 6.7, 6.8.
   *
   * @param {string} id        The id of the task to edit.
   * @param {string} newTitle  The raw new title value from the edit input.
   */
  editTask(id, newTitle) {
    const validation = this._validateTitle(newTitle, id);

    if (!validation.valid) {
      // Display the inline error next to the task's edit input
      const errorEl = document.getElementById('task-edit-error-' + id);
      if (errorEl) errorEl.textContent = validation.error;
      return;
    }

    // Find and update the task in _tasks
    for (let i = 0; i < this._tasks.length; i++) {
      if (this._tasks[i].id === id) {
        this._tasks[i].title = newTitle.trim();
        break;
      }
    }

    this._persist();
    this._render();
  },

  /**
   * Toggles the completed state of a task.
   * Captures the previous value, flips it, persists, then checks if storage
   * is still available. If not, reverts to the previous value before re-rendering.
   *
   * Satisfies Requirements 7.1, 7.2, 7.3.
   *
   * @param {string} id  The id of the task to toggle.
   */
  toggleComplete(id) {
    // Find the task
    var task = null;
    for (var i = 0; i < this._tasks.length; i++) {
      if (this._tasks[i].id === id) {
        task = this._tasks[i];
        break;
      }
    }
    if (!task) return;

    // Capture previous state and flip
    var previous = task.completed;
    task.completed = !previous;

    // Persist
    this._persist();

    // If storage write failed, revert
    if (!StorageService.isAvailable()) {
      task.completed = previous;
      this._render();
      NotificationService.showAlert(
        'Could not save completion status. Changes will not be persisted.',
        5000
      );
      return;
    }

    this._render();
  },

  /**
   * Removes a task from the list and persists the change.
   * Captures the task and its index before removal. If persistence fails,
   * re-inserts at the original index and shows a non-blocking error.
   *
   * Satisfies Requirements 7.7, 7.8, 7.9.
   *
   * @param {string} id  The id of the task to delete.
   */
  deleteTask(id) {
    // Find the task and its index
    var taskIndex = -1;
    var task = null;
    for (var i = 0; i < this._tasks.length; i++) {
      if (this._tasks[i].id === id) {
        taskIndex = i;
        task = this._tasks[i];
        break;
      }
    }
    if (taskIndex === -1) return;

    // Remove from array
    this._tasks.splice(taskIndex, 1);

    // Persist
    this._persist();

    // If storage write failed, re-insert at original index
    if (!StorageService.isAvailable()) {
      this._tasks.splice(taskIndex, 0, task);
      this._render();
      NotificationService.showAlert(
        'Could not delete task. Data persistence is unavailable.',
        5000
      );
      return;
    }

    this._render();
  },

  /**
   * Persists the sort preference, updates _sortPref, and re-renders the list.
   * The re-render must complete within 300 ms (Requirement 8.2, 8.4).
   *
   * @param {string} pref  One of: "default", "az", "za", "completed-last", "completed-first"
   */
  setSortPreference(pref) {
    StorageService.set('tld_sortPreference', pref);
    this._sortPref = pref;
    this._render();
  },

  /**
   * Returns a shallow copy of _tasks sorted according to the current _sortPref.
   * Never mutates the underlying _tasks array (Requirement 8.2, Property 19).
   *
   * Sort options:
   *  "default"         → creation order (ascending createdAt)
   *  "az"              → alphabetical A→Z (case-insensitive)
   *  "za"              → alphabetical Z→A (case-insensitive)
   *  "completed-last"  → incomplete first, then completed
   *  "completed-first" → completed first, then incomplete
   *
   * @returns {Array}
   */
  _getSortedTasks() {
    const copy = this._tasks.slice();

    switch (this._sortPref) {
      case 'az':
        copy.sort(function (a, b) {
          return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
        });
        break;

      case 'za':
        copy.sort(function (a, b) {
          return b.title.toLowerCase().localeCompare(a.title.toLowerCase());
        });
        break;

      case 'completed-last':
        // false (0) sorts before true (1) → incomplete first
        copy.sort(function (a, b) {
          return (a.completed ? 1 : 0) - (b.completed ? 1 : 0);
        });
        break;

      case 'completed-first':
        // true (1) sorts before false (0) → completed first
        copy.sort(function (a, b) {
          return (b.completed ? 1 : 0) - (a.completed ? 1 : 0);
        });
        break;

      case 'default':
      default:
        // Creation order: ascending createdAt
        copy.sort(function (a, b) {
          return a.createdAt - b.createdAt;
        });
        break;
    }

    return copy;
  },

  /**
   * Clears #task-list and re-renders all tasks using _getSortedTasks().
   * Satisfies Requirements 5.5, 6.5, 8.2.
   */
  _render() {
    const listEl = document.getElementById('task-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    const sorted = this._getSortedTasks();
    for (let i = 0; i < sorted.length; i++) {
      listEl.appendChild(this._renderTask(sorted[i]));
    }
  },

  /**
   * Creates and returns a fully interactive <li> DOM element for one task.
   *
   * The element contains:
   *  - A checkbox to toggle completion (TODO: wired in task 12.1)
   *  - A <span> showing the task title (hidden in edit mode)
   *  - An Edit button that enters inline edit mode
   *  - In edit mode: a text <input> pre-filled with the current title,
   *    a Confirm button (✓), and a Cancel button (✗), plus an error <span>
   *  - A Delete button (TODO: wired in task 12.1)
   *
   * Applies CSS class `task--completed` when task.completed is true.
   *
   * Satisfies Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9.
   *
   * @param {Object} task  { id, title, completed, createdAt }
   * @returns {HTMLLIElement}
   */
  _renderTask(task) {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.completed ? ' task--completed' : '');
    li.dataset.taskId = task.id;

    // ── Completion checkbox (wired in task 12.1) ────────────────────────────
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.className = 'task-checkbox';
    checkbox.setAttribute('aria-label', 'Mark task complete');
    checkbox.addEventListener('change', function () { TodoModule.toggleComplete(task.id); });

    // ── Title span (normal display mode) ────────────────────────────────────
    const titleSpan = document.createElement('span');
    titleSpan.className = 'task-title';
    titleSpan.textContent = task.title;

    // ── Edit mode elements (hidden until Edit is clicked) ───────────────────
    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'task-edit-input';
    editInput.maxLength = 100;
    editInput.value = task.title;
    editInput.setAttribute('aria-label', 'Edit task title');
    editInput.style.display = 'none';

    const editErrorSpan = document.createElement('span');
    editErrorSpan.className = 'task-edit-error error-msg';
    editErrorSpan.id = 'task-edit-error-' + task.id;
    editErrorSpan.style.display = 'none';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'task-confirm-btn';
    confirmBtn.textContent = '✓';
    confirmBtn.setAttribute('aria-label', 'Confirm edit');
    confirmBtn.style.display = 'none';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'task-cancel-btn';
    cancelBtn.textContent = '✗';
    cancelBtn.setAttribute('aria-label', 'Cancel edit');
    cancelBtn.style.display = 'none';

    // ── Edit button (visible in normal mode) ────────────────────────────────
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'task-edit-btn';
    editBtn.textContent = 'Edit';
    editBtn.setAttribute('aria-label', 'Edit task');

    // ── Delete button (wired in task 12.1) ──────────────────────────────────
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'task-delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('aria-label', 'Delete task');
    deleteBtn.addEventListener('click', function () { TodoModule.deleteTask(task.id); });

    // ── Enter edit mode ─────────────────────────────────────────────────────
    function enterEditMode() {
      titleSpan.style.display = 'none';
      editBtn.style.display = 'none';
      deleteBtn.style.display = 'none';

      editInput.value = task.title;
      editInput.style.display = '';
      editErrorSpan.style.display = '';
      confirmBtn.style.display = '';
      cancelBtn.style.display = '';

      // Position cursor at end of text (Req 6.2)
      editInput.focus();
      editInput.setSelectionRange(editInput.value.length, editInput.value.length);
    }

    // ── Exit edit mode (restore normal display) ─────────────────────────────
    function exitEditMode() {
      editInput.style.display = 'none';
      editErrorSpan.style.display = 'none';
      editErrorSpan.textContent = '';
      confirmBtn.style.display = 'none';
      cancelBtn.style.display = 'none';

      titleSpan.style.display = '';
      editBtn.style.display = '';
      deleteBtn.style.display = '';
    }

    // ── Wire Edit button ─────────────────────────────────────────────────────
    editBtn.addEventListener('click', function () {
      enterEditMode();
    });

    // ── Wire Confirm button ──────────────────────────────────────────────────
    confirmBtn.addEventListener('click', function () {
      // Clear previous error before attempting validation
      editErrorSpan.textContent = '';
      TodoModule.editTask(task.id, editInput.value);
      // If editTask succeeded it calls _render(), which replaces this element.
      // If it failed, the error span was populated by editTask — keep edit mode open.
    });

    // ── Wire Enter key on edit input (same as Confirm) ──────────────────────
    editInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        editErrorSpan.textContent = '';
        TodoModule.editTask(task.id, editInput.value);
      } else if (e.key === 'Escape') {
        exitEditMode();
      }
    });

    // ── Wire Cancel button ───────────────────────────────────────────────────
    cancelBtn.addEventListener('click', function () {
      exitEditMode(); // Req 6.9 — discard change, restore original display
    });

    // ── Assemble the <li> ────────────────────────────────────────────────────
    li.appendChild(checkbox);
    li.appendChild(titleSpan);
    li.appendChild(editInput);
    li.appendChild(editErrorSpan);
    li.appendChild(confirmBtn);
    li.appendChild(cancelBtn);
    li.appendChild(editBtn);
    li.appendChild(deleteBtn);

    return li;
  },

  /**
   * Stub — writes _tasks to StorageService.
   */
  _persist() {
    StorageService.set('tld_tasks', this._tasks);
  },

  /**
   * Initialises the TodoModule:
   *  1. Loads tasks from storage (validates array, defaults to []).
   *  2. Loads sort preference from storage (validates against known values, defaults to "default").
   *  3. Sets #task-sort select value to match the loaded preference.
   *  4. Renders the task list (using the loaded sort preference).
   *  5. Wires #task-add-btn click to addTask().
   *  6. Wires Enter-key on #task-input to addTask().
   *  7. Clears #task-add-error when the input is focused.
   *  8. Wires #task-sort change handler to setSortPreference().
   *
   * Satisfies Requirements 5.1, 5.5, 8.1, 8.3, 8.4, 8.5, 11.1.
   */
  init() {
    // 1. Load tasks
    const savedTasks = StorageService.get('tld_tasks');
    this._tasks = Array.isArray(savedTasks) ? savedTasks : [];

    // 2. Load sort preference
    const VALID_PREFS = ['default', 'az', 'za', 'completed-last', 'completed-first'];
    const savedPref = StorageService.get('tld_sortPreference');
    this._sortPref = VALID_PREFS.indexOf(savedPref) !== -1 ? savedPref : 'default';

    // 3. Sync the select element to the loaded preference
    const sortSelect = document.getElementById('task-sort');
    if (sortSelect) {
      sortSelect.value = this._sortPref;
    }

    // 4. Render with the loaded sort preference
    this._render();

    const taskInput = document.getElementById('task-input');
    const addBtn    = document.getElementById('task-add-btn');
    const errorEl   = document.getElementById('task-add-error');

    // 5. Wire add button
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.addTask(taskInput ? taskInput.value : '');
      });
    }

    // 6 & 7. Wire task input keyboard and focus events
    if (taskInput) {
      taskInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.addTask(taskInput.value);
        }
      });

      taskInput.addEventListener('focus', () => {
        if (errorEl) errorEl.textContent = '';
      });
    }

    // 8. Wire sort select change handler
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        TodoModule.setSortPreference(sortSelect.value);
      });
    }
  },
};

/* ========= QuickLinksModule ========= */

const QuickLinksModule = {
  _links: [],

  /**
   * Pure function — validates a quick link label and URL.
   *
   * Validation rules:
   *  - label: non-empty after trim, max 100 characters
   *  - url: must start with "http://" or "https://" (case-sensitive prefix check)
   *
   * @param {string} label  Raw label string from the input field.
   * @param {string} url    Raw URL string from the input field.
   * @returns {{ valid: boolean, errors: { label: string|null, url: string|null } }}
   */
  _validateLink(label, url) {
    const errors = { label: null, url: null };
    const trimmedLabel = (label || '').trim();

    if (trimmedLabel.length === 0) {
      errors.label = 'Label cannot be empty.';
    } else if (trimmedLabel.length > 100) {
      errors.label = 'Label must be 100 characters or fewer.';
    }

    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      errors.url = 'URL must begin with http:// or https://';
    }

    const valid = errors.label === null && errors.url === null;
    return { valid, errors };
  },

  /**
   * Attempts to add a new quick link after validation.
   *
   * Order of checks:
   *  1. If _links.length >= 20, show error on #link-cap-error and return.
   *  2. Run _validateLink; if invalid, show field-level errors and return.
   *  3. On success: create link object, push to _links, persist, render,
   *     and clear the input fields.
   *
   * Satisfies Requirements 9.2, 9.3, 9.9.
   *
   * @param {string} label  Raw label value from #link-label-input.
   * @param {string} url    Raw URL value from #link-url-input.
   */
  addLink(label, url) {
    // Clear all previous errors
    const labelErrorEl = document.getElementById('link-label-error');
    const urlErrorEl   = document.getElementById('link-url-error');
    const capErrorEl   = document.getElementById('link-cap-error');

    if (labelErrorEl) labelErrorEl.textContent = '';
    if (urlErrorEl)   urlErrorEl.textContent   = '';
    if (capErrorEl)   capErrorEl.textContent   = '';

    // Cap check — must happen BEFORE validation per spec
    if (this._links.length >= 20) {
      if (capErrorEl) capErrorEl.textContent = 'Maximum of 20 quick links reached.';
      return;
    }

    // Field-level validation
    const { valid, errors } = this._validateLink(label, url);
    if (!valid) {
      if (labelErrorEl && errors.label) labelErrorEl.textContent = errors.label;
      if (urlErrorEl   && errors.url)   urlErrorEl.textContent   = errors.url;
      return;
    }

    // Create and store the new link
    const link = {
      id: crypto.randomUUID(),
      label: label.trim(),
      url: url,
      createdAt: Date.now(),
    };
    this._links.push(link);
    this._persist();
    this._render();

    // Clear input fields on success
    const labelInput = document.getElementById('link-label-input');
    const urlInput   = document.getElementById('link-url-input');
    if (labelInput) labelInput.value = '';
    if (urlInput)   urlInput.value   = '';
  },

  /**
   * Removes a quick link from the list by its id, then persists and re-renders.
   *
   * Satisfies Requirements 9.5, 9.6.
   *
   * @param {string} id  The id of the quick link to remove.
   */
  deleteLink(id) {
    this._links = this._links.filter(function (link) {
      return link.id !== id;
    });
    this._persist();
    this._render();
  },

  /**
   * Creates and returns a DOM <a> element representing a single quick link card.
   *
   * Produces:
   *  <a href="{url}" target="_blank" rel="noopener noreferrer" class="link-card">
   *    <span class="link-label">{label}</span>
   *    <button type="button" class="link-delete-btn" aria-label="Delete link">×</button>
   *  </a>
   *
   * Satisfies Requirements 9.4, 9.5.
   *
   * @param {{ id: string, label: string, url: string, createdAt: number }} link
   * @returns {HTMLAnchorElement}
   */
  _renderCard(link) {
    const anchor = document.createElement('a');
    anchor.href = link.url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.className = 'link-card';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'link-label';
    labelSpan.textContent = link.label;

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'link-delete-btn';
    deleteBtn.setAttribute('aria-label', 'Delete link');
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', function (e) {
      // Prevent the anchor from navigating when the delete button is clicked
      e.preventDefault();
      e.stopPropagation();
      QuickLinksModule.deleteLink(link.id);
    });

    anchor.appendChild(labelSpan);
    anchor.appendChild(deleteBtn);

    return anchor;
  },

  /**
   * Clears #links-list and re-renders all link cards.
   *
   * Satisfies Requirements 9.4, 9.7, 9.8.
   */
  _render() {
    const listEl = document.getElementById('links-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    for (let i = 0; i < this._links.length; i++) {
      listEl.appendChild(this._renderCard(this._links[i]));
    }
  },

  /**
   * Writes the current _links array to StorageService under "tld_quickLinks".
   *
   * Satisfies Requirements 9.2, 9.6, 11.3.
   */
  _persist() {
    StorageService.set('tld_quickLinks', this._links);
  },

  /**
   * Initialises the QuickLinksModule:
   *  1. Reads "tld_quickLinks" from StorageService; validates it is an array,
   *     defaults to [] if absent or invalid (satisfies Requirements 9.7, 9.8, 11.1).
   *  2. Renders the link list immediately.
   *  3. Wires the #link-add-btn click handler to read #link-label-input and
   *     #link-url-input values and call addLink().
   *
   * Satisfies Requirements 9.7, 9.8, 11.1.
   */
  init() {
    // 1. Load and validate stored links
    const saved = StorageService.get('tld_quickLinks');
    this._links = Array.isArray(saved) ? saved : [];

    // 2. Render whatever we loaded
    this._render();

    // 3. Wire the add button
    const addBtn    = document.getElementById('link-add-btn');
    const labelInput = document.getElementById('link-label-input');
    const urlInput   = document.getElementById('link-url-input');

    if (addBtn) {
      addBtn.addEventListener('click', function () {
        QuickLinksModule.addLink(
          labelInput ? labelInput.value : '',
          urlInput   ? urlInput.value   : ''
        );
      });
    }
  },
};

/* ========= FocusModal ========= */

/**
 * FocusModal — centered modal popup shown when the focus timer completes.
 * Replaces the auto-dismissing toast notification with a deliberate,
 * attention-grabbing dialog that the user must explicitly dismiss.
 *
 * Dismissal paths:
 *   1. Click the OK button  (#focus-modal-ok)
 *   2. Press the Escape key
 *   3. Click the backdrop outside the modal box
 *
 * All paths call FocusModal.hide().
 */
const FocusModal = {
  _isOpen: false,
  _boundKeyHandler: null,

  /**
   * Shows the modal by adding the `is-open` class to the backdrop element.
   * Traps focus on the OK button and registers the Escape + backdrop-click
   * handlers. No-ops if already open.
   */
  show() {
    if (this._isOpen) return;
    this._isOpen = true;

    const backdrop = document.getElementById('focus-modal-backdrop');
    const okBtn    = document.getElementById('focus-modal-ok');

    if (!backdrop) return;

    // Make it visible (CSS transition handles the fade + scale)
    backdrop.classList.add('is-open');

    // Prevent scrolling the page behind the modal
    document.body.style.overflow = 'hidden';

    // Focus the OK button so keyboard users can dismiss immediately
    if (okBtn) {
      // Small delay lets the CSS transition start before focus fires
      setTimeout(function () { okBtn.focus(); }, 50);
    }

    // Wire the OK button (once, via a one-shot listener)
    if (okBtn) {
      okBtn.addEventListener('click', function handler() {
        okBtn.removeEventListener('click', handler);
        FocusModal.hide();
      });
    }

    // Wire backdrop click — close only when clicking the backdrop itself,
    // not when clicking inside the modal box
    backdrop.addEventListener('click', function handler(e) {
      if (e.target === backdrop) {
        backdrop.removeEventListener('click', handler);
        FocusModal.hide();
      }
    });

    // Wire Escape key
    this._boundKeyHandler = function (e) {
      if (e.key === 'Escape') {
        FocusModal.hide();
      }
    };
    document.addEventListener('keydown', this._boundKeyHandler);
  },

  /**
   * Hides the modal by removing the `is-open` class.
   * Restores page scrolling and removes the keyboard handler.
   */
  hide() {
    if (!this._isOpen) return;
    this._isOpen = false;

    const backdrop = document.getElementById('focus-modal-backdrop');
    if (backdrop) {
      backdrop.classList.remove('is-open');
    }

    // Restore page scrolling
    document.body.style.overflow = '';

    // Remove the Escape key listener
    if (this._boundKeyHandler) {
      document.removeEventListener('keydown', this._boundKeyHandler);
      this._boundKeyHandler = null;
    }
  },
};

/* =========================================================================
   TimeoutGuard — watches for the 10-second load timeout (Requirement 12.6).
   Starts a watchdog timer immediately (before DOMContentLoaded). The
   DOMContentLoaded handler (added in task 17.1) clears it via
   clearTimeout(TimeoutGuard._timeoutId) once the page is ready.
   ========================================================================= */

const TimeoutGuard = {
  _timeoutId: null,

  /**
   * Starts the 10-second watchdog timer.
   * Must be called at the very top of the startup sequence, before
   * DOMContentLoaded, so that slow-loading pages are caught.
   * Stores the timeout id in _timeoutId so DOMContentLoaded can cancel it.
   *
   * Satisfies Requirement 12.6.
   */
  init() {
    this._timeoutId = setTimeout(function () {
      TimeoutGuard._showError();
    }, 10000);
  },

  /**
   * Displays a visible error message prompting the user to reload the page.
   * Tries NotificationService.showWarning() first (requires the DOM to be ready).
   * Since this fires after 10 seconds the DOM should always be available, but
   * falls back to inserting a plain <div> into document.body if the banner
   * element is missing.
   *
   * Satisfies Requirement 12.6.
   */
  _showError() {
    const message = 'The page took too long to load. Please reload.';

    // Primary path: use the existing #storage-warning banner.
    var banner = document.getElementById('storage-warning');
    if (banner) {
      NotificationService.showWarning(message);
      return;
    }

    // Fallback: inject a minimal error element if the banner isn't in the DOM yet.
    if (document.body) {
      var fallback = document.createElement('div');
      fallback.id = 'timeout-error';
      fallback.setAttribute('role', 'alert');
      fallback.style.cssText =
        'position:fixed;top:0;left:0;right:0;padding:12px;background:#c0392b;' +
        'color:#fff;text-align:center;font-weight:bold;z-index:9999;';
      fallback.textContent = message;
      document.body.insertBefore(fallback, document.body.firstChild);
    }
  },
};

// ── Startup: begin the watchdog immediately (before DOMContentLoaded) ──────
TimeoutGuard.init();

/* =========================================================================
   Startup — wire all modules in DOMContentLoaded sequence.
   TimeoutGuard.init() already ran at script parse time (above).
   ========================================================================= */
document.addEventListener('DOMContentLoaded', function () {
  StorageService.init();
  ThemeModule.init();
  ClockModule.init();
  GreetingModule.init();
  TimerModule.init();
  TodoModule.init();
  QuickLinksModule.init();

  // Cancel the TimeoutGuard watchdog — page loaded successfully.
  clearTimeout(TimeoutGuard._timeoutId);
});
