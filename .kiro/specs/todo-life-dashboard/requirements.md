# Requirements Document

## Introduction

The **To-Do Life Dashboard** is a client-side web application that serves as a personal productivity homepage. It displays the current time and date, greets the user by name based on time of day, provides a configurable Pomodoro focus timer, manages a to-do task list, and offers quick-access links to favorite websites. All data is persisted using the browser's Local Storage API. The application is built with HTML, CSS, and Vanilla JavaScript only — no frameworks, no backend, no build tools required. It supports light and dark mode theming and is usable as a standalone web page or browser new-tab extension.

---

## Glossary

- **Dashboard**: The single-page web application described in this document.
- **User**: The person using the Dashboard in a modern web browser.
- **Task**: A to-do item with a title, completion status, and creation timestamp.
- **Timer**: The Pomodoro-style countdown timer component.
- **Quick_Link**: A saved URL with a display label that opens in a new browser tab.
- **Local_Storage**: The browser's `localStorage` API used for all client-side data persistence.
- **Greeting_Name**: A user-configurable name displayed in the greeting section.
- **Theme**: The visual color scheme of the Dashboard, either "light" or "dark".
- **Pomodoro_Duration**: The user-configurable countdown duration for the Timer, in minutes.
- **Session**: A single browser tab instance of the Dashboard from page load until close or reload.

---

## Requirements

### Requirement 1: Greeting and DateTime Display

**User Story:** As a User, I want to see the current time, date, and a personalized greeting when I open the Dashboard, so that I feel oriented and welcomed at the start of my day.

#### Acceptance Criteria

1. THE Dashboard SHALL display the current time in HH:MM:SS format (24-hour), sourced from the user's local system clock, updated every second.
2. THE Dashboard SHALL display the current date in the format "DayName, DD Month YYYY" (e.g., "Monday, 14 July 2025").
3. WHEN the current hour is between 05:00 and 11:59 (inclusive), THE Dashboard SHALL display the greeting "Good Morning".
4. WHEN the current hour is between 12:00 and 17:59 (inclusive), THE Dashboard SHALL display the greeting "Good Afternoon".
5. WHEN the current hour is between 18:00 and 21:59 (inclusive), THE Dashboard SHALL display the greeting "Good Evening".
6. WHEN the current hour is between 22:00 and 23:59 (inclusive) OR between 00:00 and 04:59 (inclusive), THE Dashboard SHALL display the greeting "Good Night".
7. WHEN a Greeting_Name has been saved, THE Dashboard SHALL display the greeting as "[greeting], [Greeting_Name]!" (e.g., "Good Morning, Havib!").
8. WHEN no Greeting_Name has been saved, THE Dashboard SHALL display the greeting without a name (e.g., "Good Morning!").
9. IF the system clock is unavailable or inaccessible, THEN THE Dashboard SHALL display "--:--:--" for the time, "Unavailable" for the date, and omit the greeting entirely.

---

### Requirement 2: Custom Name in Greeting

**User Story:** As a User, I want to set my name on the Dashboard, so that the greeting feels personal.

#### Acceptance Criteria

1. THE Dashboard SHALL provide an input field (max 50 characters) and a save button for the User to enter a Greeting_Name.
2. WHEN the User submits a Greeting_Name containing at least 1 non-whitespace character, THE Dashboard SHALL trim leading and trailing whitespace, save the trimmed Greeting_Name to Local_Storage, and immediately update the greeting display.
3. WHEN the User submits a Greeting_Name that is empty or contains only whitespace, THE Dashboard SHALL remove the Greeting_Name from Local_Storage and display the greeting without a name.
4. WHEN the Dashboard loads, THE Dashboard SHALL read the Greeting_Name from Local_Storage and restore it without requiring User re-entry.
5. IF a Local_Storage write or read operation fails when saving or loading the Greeting_Name, THEN THE Dashboard SHALL display a non-blocking warning banner informing the User that data persistence is unavailable and allow all interactions to proceed without persistence.

---

### Requirement 3: Focus Timer (Pomodoro)

**User Story:** As a User, I want a countdown timer on my Dashboard, so that I can work in focused time blocks.

#### Acceptance Criteria

1. THE Dashboard SHALL display a countdown Timer initialized to the saved Pomodoro_Duration.
2. IF no Pomodoro_Duration has been saved, THEN THE Dashboard SHALL initialize the Timer to 25 minutes.
3. WHEN the User activates the Start button, THE Timer SHALL begin counting down at one-second intervals.
4. WHEN the User activates the Stop button while the Timer is running, THE Timer SHALL pause at its current remaining time.
5. WHEN the User activates the Stop button while the Timer is not running, THE Dashboard SHALL ignore the action.
6. WHEN the User activates the Reset button, THE Timer SHALL stop and return to the current Pomodoro_Duration.
7. WHEN the Timer reaches zero, THE Dashboard SHALL display a non-dismissible alert banner indicating the session has ended, and the alert SHALL remain visible for at least 5 seconds before automatically closing.
8. WHEN the Timer reaches zero, THE Timer SHALL stop and remain at zero until the User activates the Reset button.
9. WHILE the Timer is running, THE Dashboard SHALL disable the Start button and enable the Stop and Reset buttons.
10. WHILE the Timer is stopped or paused, THE Dashboard SHALL enable the Start button, disable the Stop button, and enable the Reset button.

---

### Requirement 4: Configurable Pomodoro Duration

**User Story:** As a User, I want to change the Pomodoro timer duration, so that I can adjust focus blocks to my preferred length.

#### Acceptance Criteria

1. THE Dashboard SHALL provide an input field that accepts positive integers only (no decimals) for the User to enter a custom Pomodoro_Duration in minutes.
2. WHEN the User saves a Pomodoro_Duration between 1 and 120 minutes (inclusive), THE Dashboard SHALL persist the value to Local_Storage and reset the Timer display to the new duration without auto-starting.
3. IF the User enters a Pomodoro_Duration outside the range of 1 to 120 minutes (i.e., less than 1 or greater than 120), THEN THE Dashboard SHALL display an inline validation error, reject the value, and leave the previously saved Pomodoro_Duration unchanged.
4. IF the User enters a non-numeric or decimal value as Pomodoro_Duration, THEN THE Dashboard SHALL display an inline validation error, reject the value, and leave the previously saved Pomodoro_Duration unchanged.
5. WHEN the Dashboard loads, THE Dashboard SHALL read the saved Pomodoro_Duration from Local_Storage, validate it is a positive integer within the range of 1 to 120 minutes, and initialize the Timer accordingly.
6. IF the stored Pomodoro_Duration value is invalid, non-integer, out of range, or missing, THEN THE Dashboard SHALL initialize the Timer to 25 minutes.
7. IF the User attempts to change the Pomodoro_Duration while the Timer is running, THEN THE Dashboard SHALL indicate to the User that the Timer must be stopped before changing the duration, and shall not apply the change.

---

### Requirement 5: To-Do List — Add and Prevent Duplicates

**User Story:** As a User, I want to add tasks to my to-do list and be warned about duplicates, so that my list stays clean and meaningful.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a text input field (max 100 characters) and an add button for creating new Tasks.
2. WHEN the User submits a Task title that is non-empty and unique among all existing Tasks in the list (case-insensitive comparison), THE Dashboard SHALL add the Task to the list and persist all Tasks to Local_Storage.
3. IF the User submits an empty Task title, THEN THE Dashboard SHALL display an inline validation error and reject the addition without performing a duplicate check.
4. IF the User submits a non-empty Task title that matches an existing Task title (case-insensitive), THEN THE Dashboard SHALL reject the addition and immediately display an inline duplicate warning alongside the input field.
5. WHEN the Dashboard loads, THE Dashboard SHALL read all Tasks from Local_Storage and render them in the order they were originally added.

---

### Requirement 6: To-Do List — Edit Tasks

**User Story:** As a User, I want to edit existing task titles, so that I can correct mistakes or update task descriptions.

#### Acceptance Criteria

1. THE Dashboard SHALL provide an edit control for each Task in the list.
2. WHEN the User activates the edit control for a Task, THE Dashboard SHALL replace the Task title display with an editable input pre-filled with the current title and the cursor positioned at the end of the text.
3. WHILE a Task is in edit mode, THE Dashboard SHALL display visible confirm and cancel controls alongside the editable input.
4. WHEN the User confirms an edit, THE Dashboard SHALL trim leading and trailing whitespace from the input value before validation.
5. WHEN the trimmed value is non-empty and does not duplicate another existing Task title (case-insensitive, excluding the Task being edited), THE Dashboard SHALL update the Task title, persist the change to Local_Storage, and exit edit mode.
6. IF the trimmed confirm value is empty, THEN THE Dashboard SHALL display an inline validation error and retain the original title; the current input value SHALL be cleared.
7. IF the trimmed confirm value duplicates another existing Task (case-insensitive, excluding the Task being edited), THEN THE Dashboard SHALL display an inline duplicate warning and retain the original title; the current input value SHALL remain as entered.
8. IF the trimmed confirm value exceeds 100 characters, THEN THE Dashboard SHALL display an inline validation error and retain the original title; the current input value SHALL remain as entered.
9. WHEN the User cancels an edit, THE Dashboard SHALL discard the change and restore the original title display.

---

### Requirement 7: To-Do List — Complete and Delete Tasks

**User Story:** As a User, I want to mark tasks as done and delete tasks I no longer need, so that I can track progress and keep my list tidy.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a checkbox or toggle control for each Task to mark it as complete or incomplete.
2. WHEN the User toggles the completion control, THE Dashboard SHALL update the Task's completion status, update the rendered Task list to reflect the new status, and persist the updated Task list to Local_Storage.
3. IF a Local_Storage write fails when persisting a completion toggle, THEN THE Dashboard SHALL revert the Task's completion status to its previous value and display a non-blocking error message.
4. WHEN a Task's completion status is set to complete, THE Dashboard SHALL apply strikethrough styling to the Task title.
5. WHEN a Task's completion status is set to incomplete, THE Dashboard SHALL display the Task title without strikethrough styling.
6. IF the strikethrough styling fails to apply, THEN THE Dashboard SHALL continue to operate and allow all User interactions with Tasks.
7. THE Dashboard SHALL provide a delete control for each Task.
8. WHEN the User activates the delete control for a Task, THE Dashboard SHALL remove the Task from the list and persist the updated list to Local_Storage.
9. IF a Local_Storage write fails when persisting a deletion, THEN THE Dashboard SHALL retain the Task in the list and display a non-blocking error message.

---

### Requirement 8: To-Do List — Sort Tasks

**User Story:** As a User, I want to sort my task list, so that I can view tasks in a useful order.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a sort control offering exactly the following options: "Default (creation order)", "Alphabetical (A–Z)", "Alphabetical (Z–A)", "Completed last", "Completed first".
2. WHEN the User selects a sort option, THE Dashboard SHALL re-render the Task list in the selected order within 300ms without modifying the underlying Task data in Local_Storage.
3. WHEN the Dashboard loads, THE Dashboard SHALL read the saved sort preference from Local_Storage before rendering the Task list, and apply it; IF no sort preference is saved, THE Dashboard SHALL apply "Default" order.
4. WHEN the User selects a sort option, THE Dashboard SHALL persist the selected sort option to Local_Storage before re-rendering the Task list.
5. IF Local_Storage is unavailable when reading or writing the sort preference, THEN THE Dashboard SHALL silently fall back to "Default" sort order and proceed without displaying an error.

---

### Requirement 9: Quick Links

**User Story:** As a User, I want to save and access quick-launch links to my favorite websites, so that I can navigate quickly from my dashboard.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a form with a label input (max 100 characters) and a URL input (max 2048 characters) for the User to add a new Quick_Link.
2. WHEN the User submits a Quick_Link with a non-empty label (max 100 characters) and a valid URL beginning with `http://` or `https://`, THE Dashboard SHALL add the Quick_Link and persist all Quick_Links to Local_Storage.
3. IF the User submits a Quick_Link with an empty label, a label exceeding 100 characters, or an invalid URL, THEN THE Dashboard SHALL display an inline validation error identifying the offending field and reject the addition.
4. THE Dashboard SHALL render each saved Quick_Link as a clickable button or card that opens the URL in a new browser tab.
5. THE Dashboard SHALL provide a delete control for each Quick_Link.
6. WHEN the User activates the delete control for a Quick_Link, THE Dashboard SHALL remove the Quick_Link and persist the updated list to Local_Storage.
7. WHEN the Dashboard loads and Quick_Links exist in Local_Storage, THE Dashboard SHALL read and render all Quick_Links.
8. IF no Quick_Links exist in Local_Storage on load, THEN THE Dashboard SHALL render an empty Quick Links section without error.
9. IF the User attempts to add a Quick_Link when 20 Quick_Links already exist, THEN THE Dashboard SHALL reject the addition and display an inline error indicating the maximum limit has been reached.

---

### Requirement 10: Light / Dark Mode

**User Story:** As a User, I want to switch between light and dark color themes, so that I can use the Dashboard comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a theme toggle control that is visible and accessible on the Dashboard at all times.
2. WHEN the User activates the theme toggle, THE Dashboard SHALL switch the active Theme and update the visual appearance within 100ms.
3. WHEN the User activates the theme toggle, THE Dashboard SHALL save the new Theme value (either "light" or "dark") to Local_Storage.
4. WHEN the Dashboard loads, THE Dashboard SHALL read the saved Theme value from Local_Storage and apply it before any content is rendered, such that no flash of the previously inactive theme is visible.
5. IF no Theme is saved in Local_Storage and `prefers-color-scheme` is detectable, THEN THE Dashboard SHALL apply the User's operating system color scheme preference.
6. IF no Theme is saved in Local_Storage and `prefers-color-scheme` is not detectable, THEN THE Dashboard SHALL default to "light" theme.

---

### Requirement 11: Data Persistence and Recovery

**User Story:** As a User, I want my data to survive page reloads, so that I never lose my tasks, links, or settings.

#### Acceptance Criteria

1. WHEN the Dashboard loads, THE Dashboard SHALL restore all Tasks, Quick_Links, Greeting_Name, Pomodoro_Duration, Theme, and sort preference from Local_Storage before rendering the UI.
2. WHEN any Local_Storage read or write operation fails or throws an error (including when storage is unavailable), THE Dashboard SHALL display a non-blocking warning banner informing the User that data persistence is unavailable and allow all User interactions to proceed without persistence.
3. THE Dashboard SHALL write all state changes to Local_Storage synchronously before returning control to the User interaction handler.
4. IF a Local_Storage write operation fails, THE Dashboard SHALL allow the interaction to proceed and display the warning banner per criterion 2.
5. IF data read from Local_Storage on load is corrupted or cannot be parsed (e.g., invalid JSON), THEN THE Dashboard SHALL discard the corrupted data, initialize the affected state to its default value, and display the non-blocking warning banner per criterion 2.

---

### Requirement 12: Performance and Compatibility

**User Story:** As a User, I want the Dashboard to load fast and work reliably across browsers, so that it is genuinely useful as a daily homepage.

#### Acceptance Criteria

1. THE Dashboard SHALL load and become fully interactive (all widgets rendered and accepting user input, measured from navigation start) within 3 seconds on a device released within the last 5 years with a broadband connection of at least 25 Mbps.
2. THE Dashboard SHALL function correctly in the latest stable releases of Chrome, Firefox, Edge, and Safari, where "correctly" means all widgets render, all user interactions respond as specified, and no unhandled JavaScript errors appear in the browser console.
3. THE Dashboard SHALL consist of exactly one HTML file, one CSS file inside a `css/` directory, and one JavaScript file inside a `js/` directory.
4. THE Dashboard SHALL use no external frameworks, libraries, or CDN dependencies; all scripts and styles SHALL be self-contained in project files.
5. THE Dashboard SHALL use no backend server; all data storage, retrieval, and application logic SHALL execute in the browser using browser-native APIs.
6. IF the Dashboard has not become interactive within 10 seconds of navigation start, THEN THE Dashboard SHALL display a visible error message to the User and prompt them to reload the page.
