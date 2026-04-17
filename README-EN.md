# Kanzen Board

> A minimalist macOS task board built around how the ADHD brain actually works — not how productivity gurus think it should.

![macOS](https://img.shields.io/badge/macOS-12%2B-black?logo=apple&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-latest-47848F?logo=electron&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)
![Build](https://github.com/IgorWarenik/kanzen-board/actions/workflows/build.yml/badge.svg)

Also available in: [Русский](README-RU.md)

![Kanzen Board — board overview](docs/assets/board.png)

---

## Why this exists

Most task managers are built for neurotypical brains: long lists, deep hierarchies, weekly reviews, complex setups. For an ADHD brain, that's a trap. You spend more time organizing your tasks than doing them. The system becomes the procrastination.

**Kanzen Board** combines two ideas that are independently proven to work for ADHD brains:

- **Kanban** — everything is visible at once, on one screen, as cards on a board. No drilling into menus, no hidden backlogs.
- **Kaizen** (改善, "continuous improvement") — every task has an *impact* field. You write one sentence: why does this matter? If you can't answer that, the task probably shouldn't exist.

The name **Kanzen** (完全) means "complete" in Japanese — a task isn't done until it's moved, tracked, and its impact is felt.

---

## Why Kanban + Kaizen works for ADHD

### The ADHD brain needs to *see* work to do it

Out of sight is genuinely out of mind. A to-do list in an app you don't open is invisible. A board on your screen with cards you can drag is not. Kanban makes every task physically present — you can't forget what's on the board because the board is always there.

[Research confirms](https://leantime.io/navigating-adhd-as-a-project-manager/) that visual organization is one of the most effective strategies for ADHD. Cards, columns, and colors activate the visual processing strengths common in ADHD brains, while reducing the cognitive load of remembering what needs doing.

### Drag = dopamine

The ADHD brain is chronically low on dopamine — the neurotransmitter behind motivation, follow-through, and the feeling that something was *worth doing*. Moving a card from **In Progress** to **Done** is a physical gesture that delivers a small but real dopamine hit. [Reddit's r/ADHD community calls this](https://www.reddit.com/r/ADHD/comments/z7i15a/having_a_kanban_probably_saved_my_job/) "hacking the dopamine system." It's not a trick — it's how the brain works.

### WIP limits prevent task-hopping

One of the most disruptive ADHD patterns is jumping between tasks before finishing any of them. Kanban's core rule — limit work in progress — gives you a structure to resist that impulse. The **In Progress** column is the constraint: if a card is already there, you finish it before starting something new.

### Kaizen kills the "meaningless busy" trap

ADHD brains are wired for interest, not importance. That makes it easy to fill a day with low-stakes tasks that *feel* productive while the important ones stay in Idea forever. The **Impact** field forces a one-sentence answer to "why does this matter?" before a card gets moved forward.

### Pomodoro matches the ADHD attention window

ADHD attention is not absent — it's *variable*. The 25-minute Pomodoro session is calibrated to the realistic focused attention window for most ADHD brains. Built into every card, one click starts a session. A macOS notification fires when it ends.

### Small steps build momentum (kaizen)

Subtasks with a live progress bar make large, paralyzing cards manageable: break it into 3–5 steps and check them off one at a time. When the last subtask is checked, the card moves to Done automatically.

---

## Feature overview

| Feature | Why it helps with ADHD |
|---|---|
| **Kanban board** (Idea → To Do → In Progress → Done) | Everything visible on one screen — nothing is hidden |
| **Drag & drop** | Physical gesture = dopamine reward for moving work forward |
| **Impact field + KAIZEN badge** | Forces you to articulate *why* a task matters before starting it |
| **Subtasks + live progress bar** | Breaks paralysis — big tasks become small steps |
| **Auto-move to Done at 100%** | Removes the decision step, instant completion reward |
| **Pomodoro timer (25/5 min)** | Structured focus sessions matched to ADHD attention windows |
| **Deadline badges** (grey → yellow → red pulse) | Visual urgency without calendar anxiety |
| **Priority filter** (High / Normal / Low) | One click to see only what matters right now |
| **Tags + tag filter** | Cluster related work across columns without nested folders |
| **Full-text search** | Find anything instantly — no memory required |
| **Collapsible columns** | Hide Done/Archived noise, focus on active work |
| **Dark / Light theme** | Reduce visual strain for long sessions |
| **Launch at Login** | App is always ready — no friction to open it |
| **Archive** | Move completed cards out of sight without deleting them |
| **Retro panel** | Weekly review of what you actually shipped |
| **Local data, no account** | Works offline, no login screen, instant start |

---

## Demo

### Subtasks → automatic Done move

![Subtask progress and auto-move to Done](docs/assets/subtasks.gif)

### Pomodoro timer

![Pomodoro timer](docs/assets/pomodoro.gif)

---

## Installation

### Download (recommended)

Download the latest `.dmg` from the [Releases](https://github.com/IgorWarenik/kanzen-board/releases) page, open it, drag **Kanzen Board.app** to Applications.

> **Note: the app is currently unsigned.**
> The developer does not have a paid Apple Developer account ($99/year), so the DMG is built without a code signing certificate. macOS Gatekeeper will show a warning on first launch.
>
> **To open it anyway:**
> 1. Right-click the app → **Open**
> 2. In the dialog, click **Open** again
>
> You only need to do this once. After that, the app opens normally.
>
> Alternatively, you can allow it system-wide: **System Settings → Privacy & Security** → scroll down to the blocked app → click **Open Anyway**.

---

## Development

```bash
git clone https://github.com/IgorWarenik/kanzen-board.git
cd kanzen-board
npm install
npm start
```

Requires Node.js 18+ and npm 9+.

---

## Build

Every push to `master` triggers GitHub Actions which builds a `.dmg` for macOS (universal, x64 + arm64).

To publish a GitHub Release with a download link, push a version tag:

```bash
git tag v1.0.1
git push origin v1.0.1
```

---

## Contributing

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/IgorWarenik/kanzen-board/issues).

---

## License

MIT
