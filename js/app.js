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
    NotificationService.showAlert('Focus session complete!', 5000);
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
   * Stub — edit an existing task title.
   * @param {string} id
   * @param {string} newTitle
   */
  editTask(id, newTitle) {
    // TODO: implement in a later task
  },

  /**
   * Stub — toggle the completed state of a task.
   * @param {string} id
   */
  toggleComplete(id) {
    // TODO: implement in a later task
  },

  /**
   * Stub — delete a task from the list.
   * @param {string} id
   */
  deleteTask(id) {
    // TODO: implement in a later task
  },

  /**
   * Stub — set and persist the sort preference, then re-render.
   * @param {string} pref
   */
  setSortPreference(pref) {
    // TODO: implement in a later task
  },

  /**
   * Stub — returns a sorted shallow copy of _tasks.
   * @returns {Array}
   */
  _getSortedTasks() {
    return this._tasks.slice();
  },

  /**
   * Stub — clears #task-list and re-renders all tasks.
   */
  _render() {
    const listEl = document.getElementById('task-list');
    if (listEl) listEl.innerHTML = '';
    // TODO: render individual task elements in a later task
  },

  /**
   * Stub — creates and returns a DOM element for one task.
   * @param {Object} task
   * @returns {HTMLElement}
   */
  _renderTask(task) {
    // TODO: implement in a later task
    return document.createElement('li');
  },

  /**
   * Stub — writes _tasks to StorageService.
   */
  _persist() {
    StorageService.set('tld_tasks', this._tasks);
  },

  /**
   * Initialises the TodoModule:
   *  1. Loads tasks from storage (falls back to empty array).
   *  2. Renders the task list.
   *  3. Wires #task-add-btn click to addTask().
   *  4. Wires Enter-key on #task-input to addTask().
   *  5. Clears #task-add-error when the input is focused.
   *
   * Satisfies Requirements 5.1, 5.5.
   */
  init() {
    const saved = StorageService.get('tld_tasks');
    this._tasks = Array.isArray(saved) ? saved : [];
    this._render();

    const taskInput = document.getElementById('task-input');
    const addBtn    = document.getElementById('task-add-btn');
    const errorEl   = document.getElementById('task-add-error');

    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.addTask(taskInput ? taskInput.value : '');
      });
    }

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
  },
};
