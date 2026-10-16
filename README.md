<div align="center">

```
██████╗ ███████╗██╗   ██╗ ██████╗ ██████╗  ██████╗  ██████╗ ████████╗
██╔══██╗██╔════╝██║   ██║██╔═████╗██╔══██╗██╔═══██╗██╔═══██╗╚══██╔══╝
██║  ██║█████╗  ██║   ██║██║██╔██║██████╔╝██║   ██║██║   ██║   ██║
██║  ██║██╔══╝  ╚██╗ ██╔╝████╔╝██║██╔══██╗██║   ██║██║   ██║   ██║
██████╔╝███████╗ ╚████╔╝ ╚██████╔╝██║  ██║╚██████╔╝╚██████╔╝   ██║
╚═════╝ ╚══════╝  ╚═══╝   ╚═════╝ ╚═╝  ╚═╝ ╚═════╝  ╚═════╝    ╚═╝
```

### `S Deva Kumar` · cybersecurity researcher & pentester · Bengaluru, IN

[![Live](https://img.shields.io/badge/live-dev0root6.github.io-00ff88?style=for-the-badge&labelColor=020504)](https://dev0root6.github.io/)
[![Resume](https://img.shields.io/badge/resume-PDF-f59e0b?style=for-the-badge&labelColor=020504)](https://dev0root6.github.io/Dev-resume.pdf)
[![Site](https://img.shields.io/badge/dev0root.in-38bdf8?style=for-the-badge&labelColor=020504)](https://dev0root.in)

</div>

---

```console
dev0root@kali:~$ whoami
S Deva Kumar (dev0root) — pentester, SRE, club president

dev0root@kali:~$ cat focus.txt
IoT Hacking · Vulnerability Analysis · Prompt Engineering
DevOps · Hardware Hacking · Red Team Ops

dev0root@kali:~$ cat README.md | head -1
# this is my corner of the internet. welcome in. █
```

---

## 🌐 What is this?

This repo is the source of my personal portfolio — a terminal-flavoured, matrix-rain, green-on-black site served straight from **GitHub Pages**.

No frameworks. No build step. Just hand-written **HTML, CSS and vanilla JS**.

👉 **[dev0root6.github.io](https://dev0root6.github.io/)**

## ✨ Features

### 🖥️ Look & Feel
- **Matrix Rain Background** – canvas-rendered falling glyphs running behind every page.
- **CRT Vibes** – scanline overlay + vignette for that old-monitor glow.
- **Custom Cursor** – glowing green dot + trailing ring that reacts to links and buttons.
- **Pixel Mouse Trail** – tiny pixels that fade and shrink wherever you move.
- **Glitch Text** – hero name flickers every few seconds, plus a typographic scramble effect on headings.

### 📟 Content
- **Live Terminal Block** – `whoami`, `cat focus.txt` & friends rendered as a fake shell session.
- **Canvas Ticker Banner** – arithmetic-only text layout on a `<canvas>`, zero DOM reflow (inspired by `@chenglou/pretext`).
- **Gallery Strip** – infinite auto-scroll, desaturated until you hover.
- **Arsenal Grid** – skills laid out as `[ LANG ]`, `[ HACK ]`, `[ SEC ]` cells with animated bars.
- **Project Cards** – clipped-corner cards with tags, a featured project + an ASCII "status panel".
- **Contact Form** – posts straight to a Google Apps Script endpoint, no backend to babysit.

---

## 🛠️ Tech Stack

| Layer | What's used |
|-------|-------------|
| Markup | HTML5 |
| Styling | CSS3 (custom properties, `clip-path`, `:has()`, keyframes) |
| Scripts | Vanilla JavaScript + Canvas 2D |
| Fonts | JetBrains Mono · Syne · VT323 |
| Forms | Google Apps Script |
| Hosting | GitHub Pages |

### 🎨 Palette

| Token | Hex | Used for |
|-------|-----|----------|
| `--bg` | `#020504` | background |
| `--green` | `#00ff88` | accent / glow |
| `--amber` | `#f59e0b` | highlights |
| `--red` | `#ff4757` | disclosure cards |
| `--blue` | `#38bdf8` | terminal output |

---

## 📂 Structure

```
dev0root6.github.io/
├── index.html          # main single-page portfolio (hero, about, skills, projects, contact)
├── about.html          # legacy pages ─┐
├── skills.html         #               │ older multi-page version,
├── projects.html       #               │ still reachable
├── contact.html        #             ──┘
├── Dev-resume.pdf      # resume
├── CSS/
│   └── style.css       # shared styles for the legacy pages
├── JAVASCRIPT/
│   ├── matrix.js       # background canvas animation
│   ├── mouse-trail.js  # pixel mouse trail
│   ├── typhographic.js # random-letter scramble effect
│   └── form-handler.js # contact form → Google Apps Script
└── IMAGES/             # gallery shots + project thumbnails
```

---

## 🚀 Run it Locally

It's a static site, so just about anything works:

```bash
git clone https://github.com/dev0root6/dev0root6.github.io.git
cd dev0root6.github.io

# option 1 – just open it
xdg-open index.html        # or double-click it

# option 2 – serve it (recommended, so fetch/forms behave)
python3 -m http.server 8000
# → http://localhost:8000
```

Push to `main` and GitHub Pages redeploys on its own. That's the whole pipeline. 🙂

---

## 📌 Pinned Projects

| Project | What it is | Stack |
|---------|------------|-------|
| [**Vertex-code-IDE**](https://github.com/dev0root6/Vertex-code-IDE) ⭐ | Next-gen IDE that transforms how developers learn and visualize code — AI tutoring, live call graph, multi-model AI | TypeScript · Gemini · OpenRouter · Ollama |
| [**dev-dashboard**](https://github.com/dev0root6/dev-dashboard) | Centralized interface consolidating system health metrics, logs and dev tools into a single real-time view | HTML · JS |
| [**baadhal**](https://github.com/dev0root6/baadhal) | Lightweight, self-contained observability agent for Ubuntu servers — disk tracking, kernel + Docker health, webhook alerting | Go |
| [**Lab-Programs**](https://github.com/dev0root6/Lab-Programs) | Lab programs for the VTU 2022 Scheme — Computer Science & Data Science | Jupyter Notebook |
| [**SMART-HOME-FOR-PwD**](https://github.com/dev0root6/SMART-HOME-FOR-PwD) | Smart home built for people with disabilities on ESP8266 — relay + LED control via Blynk IoT | C++ · IoT |
| [**keycoms**](https://github.com/dev0root6/keycoms) | Keyboard-driven comms tooling | Python |

<sub>…and a bunch more hardware/security experiments over at **[@dev0root6](https://github.com/dev0root6?tab=repositories)** — BLE spammers, WiFi deauthers, HID attacks, SQL VCS and friends.</sub>

---

## 📫 Reach Me

- 🌍 Site — [dev0root.in](https://dev0root.in)
- 💼 LinkedIn — [in/dev0root](https://www.linkedin.com/in/dev0root)
- 🐙 GitHub — [@dev0root6](https://github.com/dev0root6)
- 📷 Instagram — [@127.4.7.8](https://instagram.com/127.4.7.8)

> Open to security research collaborations, red team engagements, DevOps/SRE roles, and hardware hacking projects.

---

<div align="center">

`dev0root` · built with too much caffeine and a soft spot for green-on-black 🧃

</div>
