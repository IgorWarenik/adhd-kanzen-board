# Kaizen Board

> A minimalist macOS Kanban board that keeps you honest about what actually matters.

![macOS](https://img.shields.io/badge/macOS-12%2B-black?logo=apple&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-latest-47848F?logo=electron&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)
![Build](https://github.com/IgorWarenik/kaizen-board/actions/workflows/build.yml/badge.svg)

![Kaizen Board — board overview](docs/assets/board.png)

---

## What is Kaizen Board?

Kaizen Board is a native macOS desktop app for managing tasks the way the kaizen philosophy intends: small, meaningful, continuously improving. It is a Kanban board — but stripped of everything that usually gets in the way of actually using one.

No accounts. No subscription. No cloud sync required. Your data lives on your Mac in a plain JSON file, and the app launches silently with your system.

---

## Why Kaizen Board instead of Notion, Trello, or Linear?

| | Kaizen Board | Notion / Trello / Linear |
|---|---|---|
| **Startup time** | Instant — native Electron app | Browser tab, login screen, loading spinner |
| **Data location** | Local file on your Mac | Someone else's server |
| **Distraction level** | Zero — no comments, no team feeds, no notifications from others | High — designed for collaboration, not focus |
| **Shows task impact** | Yes — every card has an Impact field | No |
| **Kaizen progress** | Built-in Pomodoro + subtask progress bar | Requires integrations |
| **Price** | Free, open source | Free tier limited; paid plans $8–$16/month |
| **Offline** | Always works | Depends on connectivity |

The core idea: **if you don't know why a task matters, you shouldn't start it**. Kaizen Board makes you state the impact of every card before it moves forward.

---

## Features

### Kanban board with four stages
Cards flow through **Idea → To Do → In Progress → Done**. Columns can be collapsed to a 44px rail to focus on what's active. Drag and drop reorders cards within and between columns.

### Impact field — the kaizen difference
Every card has an **Impact** field: a short answer to "why does this matter?". Completed cards with impact defined show a green **KAIZEN** badge in the Done column. Over time, your Done column becomes a record of decisions that had a real effect — not just a graveyard of checkboxes.

### Subtasks with a live progress bar
Break any card into subtasks with individual checkboxes. A progress bar on the card face updates in real time. When all subtasks are checked, the card moves to Done automatically and a macOS notification fires.

![Subtask progress and auto-move to Done](docs/assets/subtasks.gif)

### Deadline awareness
Set a deadline on any card. The badge changes colour as the date approaches — **grey → yellow → red blinking** — and overdue cards pulse with a red outline. Cards with a deadline today get a purple highlight and auto-expand their column if it was collapsed.

### Pomodoro timer
Start a 25-minute focus session directly from a card. A macOS notification fires when the session ends, then a 5-minute break begins automatically.

![Pomodoro timer](docs/assets/pomodoro.gif)

### Full-text search
One click on the magnifier in the toolbar dims everything except matching cards. Search covers titles, body text, tags, and impact notes across all active columns.

### Tags and priority filters
Attach free-form tags to cards and filter the board by tag from a dropdown. Priority chips (HIGH / NORMAL / LOW) are shown as a coloured stripe on each card and can be filtered in one click.

### Archive
Move completed cards out of Done into a hidden archive. The archive overlay has its own full-text search and a date-range filter — useful for retrospectives.

### Retro panel
A weekly retrospective view shows statistics and all Done cards grouped by the week they were completed.

### Settings
A gear icon in the toolbar opens a settings panel with:
- **Dark / Light theme** toggle
- **Launch at Login** — the app starts hidden at macOS login, ready when you need it
- **Reset all data** — wipes the board and recreates the seed cards

### Native macOS behaviour
- Closes to background (Command-W hides the window, does not quit)
- Auto-saves on every change via a local `state.json` file
- Signed and notarized — Gatekeeper never blocks it on any Mac

---

## Installation

Download the latest `.dmg` from the [Releases](https://github.com/IgorWarenik/kaizen-board/releases) page, open it, drag **Kaizen Board.app** to Applications. That's it.

Because the app is signed and notarized with an Apple Developer ID certificate, macOS opens it without any security warning on the first launch.

---

## Development

```bash
git clone https://github.com/IgorWarenik/kaizen-board.git
cd kaizen-board
npm install
npm start
```

Requires Node.js 18+ and npm 9+.

---

## Build a signed & notarized DMG

Every push to `master` triggers GitHub Actions which:
1. Installs dependencies via `npm ci`
2. Signs the `.app` with your Developer ID certificate
3. Notarizes via Apple's `notarytool`
4. Uploads the `.dmg` + `.zip` as a workflow artifact (kept 30 days)

To publish a public GitHub Release with a download link, push a version tag:

```bash
# Bump version in package.json first, then:
git tag v1.0.1
git push origin v1.0.1
```

GitHub Actions builds, signs, notarizes and attaches the `.dmg` + `.zip` to a new Release automatically. Release notes are generated from commit messages.

### One-time setup: GitHub Secrets

Go to **Settings → Secrets and variables → Actions → New repository secret** and add the five secrets below.

---

#### 1. `CSC_CONTENT` — Developer ID certificate (base64)

On your Mac:

```bash
# Export "Developer ID Application: ..." from Keychain Access as .p12
# Then encode it:
base64 -i ~/Desktop/certificate.p12 | pbcopy
```

Paste the clipboard content as the secret value.

#### 2. `CSC_KEY_PASSWORD` — password you set when exporting the .p12

#### 3. `APPLE_ID` — your Apple ID email

e.g. `dev@example.com`

#### 4. `APPLE_APP_PASSWORD` — app-specific password

Generate at [appleid.apple.com](https://appleid.apple.com) →
**Sign-In and Security → App-Specific Passwords**.

#### 5. `APPLE_TEAM_ID` — 10-character Team ID

Find it at [developer.apple.com/account](https://developer.apple.com/account) →
top-right corner next to your team name, e.g. `AB12CD34EF`.

---

### Skip notarization locally

```bash
SKIP_NOTARIZE=true npm run build
```

---

## Contributing

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/IgorWarenik/kaizen-board/issues).
Issue templates are provided for both bug reports and feature requests.

---

## License

MIT
