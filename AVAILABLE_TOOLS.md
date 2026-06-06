# Available Tools

The following tools are available to the AI assistant (Junie) in this project environment:

---

### Terminal / Command Execution

- **bash** — Executes PowerShell commands in the local terminal. Supports background processes for persistent services.

### Search

- **search_project** — In-project search for file names, symbol names, or exact text strings. Supports optional path scoping.

### File Exploration

- **get_file_structure** — Lists all definitions (classes, methods, functions, imports) in a file with line ranges.
- **open** — Opens 100 lines of a file starting from a given line number. Also displays image files.
- **open_entire_file** — Opens the full content of a file (use sparingly for large files).
- **scroll_down** — Scrolls down 100 lines in the currently open file.
- **scroll_up** — Scrolls up 100 lines in the currently open file.

### File Creation & Editing

- **create** — Creates a new file with specified content (or fully rewrites a file created in the current session).
- **search_replace** — Applies a single search-and-replace edit to a file. Requires exact match of existing code.
- **multi_edit** — Applies multiple sequential search-and-replace edits to a single file atomically.

### Refactoring

- **rename_element** — Renames a code element (class, function, variable, etc.) and automatically updates all references across the entire codebase.

### Undo

- **undo_edit** — Reverts the last edit made to the project.

### Session Management

- **submit** — Submits the solution summary and terminates the session.
- **answer** — Provides a comprehensive answer to the user and terminates the session.
- **ask_user** — Asks the user for help or clarification.

---

*Generated: 2026-02-16*
