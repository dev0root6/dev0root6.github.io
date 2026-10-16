<!-- ░▒▓ dev0root · README ▓▒░ -->

<div align="center">

<a href="https://dev0root6.github.io/">
  <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=700&size=30&duration=2800&pause=900&color=00FF88&center=true&vCenter=true&width=720&height=90&lines=dev0root+%2F%2F+S+Deva+Kumar;cybersecurity+researcher+%26+pentester;IoT+hacking+%C2%B7+red+team+%C2%B7+devops;this+is+my+corner+of+the+internet.+welcome+in." alt="dev0root" />
</a>

<br/>

[![Live](https://img.shields.io/badge/live-dev0root6.github.io-00ff88?style=for-the-badge&labelColor=020504)](https://dev0root6.github.io/)
[![Resume](https://img.shields.io/badge/resume-PDF-f59e0b?style=for-the-badge&labelColor=020504)](https://dev0root6.github.io/Dev-resume.pdf)
[![Site](https://img.shields.io/badge/dev0root.in-38bdf8?style=for-the-badge&labelColor=020504)](https://dev0root.in)
[![LinkedIn](https://img.shields.io/badge/linkedin-dev0root-0a66c2?style=for-the-badge&labelColor=020504)](https://www.linkedin.com/in/dev0root)

![profile views](https://komarev.com/ghpvc/?username=dev0root6&style=for-the-badge&color=00ff88&label=VISITORS)

</div>

---

```console
dev0root@kali:~$ whoami
S Deva Kumar (dev0root) — pentester, SRE, club president

dev0root@kali:~$ cat focus.txt
IoT Hacking · Vulnerability Analysis · Prompt Engineering
DevOps · Hardware Hacking · Red Team Ops

dev0root@kali:~$ ./open_portfolio.sh
[+] launching dev0root6.github.io ... matrix rain online █
```

---

## 🌐 What is this?

This repo is the source of my personal portfolio — a terminal-flavoured, matrix-rain, green-on-black site served straight from **GitHub Pages**.

No frameworks. No build step. Just hand-written **HTML, CSS and vanilla JS**.

👉 **[dev0root6.github.io](https://dev0root6.github.io/)**

---

## ⚙️ The Stack

<div align="center">

[![My Skills](https://skillicons.dev/icons?i=html,css,js,python,c,cpp,ts,react,nodejs,docker,linux,bash,arduino,raspberrypi,cloudflare,vercel,postgres,git,github&theme=dark)](https://skillicons.dev)

</div>

---

<details open>
<summary><b>✨ What's inside the site (click to collapse)</b></summary>

<br/>

### 🖥️ Look & Feel
- **Matrix Rain Background** – canvas-rendered falling glyphs behind every page.
- **CRT Vibes** – scanline overlay + vignette for that old-monitor glow.
- **Custom Cursor** – glowing green dot + trailing ring that reacts to links & buttons.
- **Pixel Mouse Trail** – tiny pixels that fade and shrink wherever you move.
- **Glitch Text** – hero name flickers; headings scramble their letters.

### 📟 Content
- **Live Terminal Block** – `whoami`, `cat focus.txt` & friends as a fake shell session.
- **Canvas Ticker Banner** – arithmetic-only text layout, zero DOM reflow (`@chenglou/pretext` style).
- **Gallery Strip** – infinite auto-scroll, desaturated until you hover.
- **Arsenal Grid** – skills as `[ LANG ]`, `[ HACK ]`, `[ SEC ]` cells with animated bars.
- **Project Cards** – clipped-corner cards, a featured project + ASCII "status panel".
- **Contact Form** – posts straight to a Google Apps Script endpoint, no backend to babysit.

</details>

<details>
<summary><b>🎨 Palette &amp; tech (click to expand)</b></summary>

<br/>

| Token | Hex | Used for |
|-------|-----|----------|
| `--bg` | `#020504` | background |
| `--green` | `#00ff88` | accent / glow |
| `--amber` | `#f59e0b` | highlights |
| `--red` | `#ff4757` | disclosure cards |
| `--blue` | `#38bdf8` | terminal output |

| Layer | What's used |
|-------|-------------|
| Markup | HTML5 |
| Styling | CSS3 (custom properties, `clip-path`, `:has()`, keyframes) |
| Scripts | Vanilla JavaScript + Canvas 2D |
| Fonts | JetBrains Mono · Syne · VT323 |
| Forms | Google Apps Script |
| Hosting | GitHub Pages |

</details>

<details>
<summary><b>📂 Repo structure (click to expand)</b></summary>

<br/>

```
dev0root6.github.io/
├── index.html          # main single-page portfolio (hero, about, skills, projects, contact)
├── about.html          # legacy pages ─┐
├── skills.html         #               │ older multi-page version,
├── projects.html       #               │ still reachable
├── contact.html        #             ──┘
├── Dev-resume.pdf      # resume
├── CSS/style.css       # shared styles for the legacy pages
├── JAVASCRIPT/
│   ├── matrix.js       # background canvas animation
│   ├── mouse-trail.js  # pixel mouse trail
│   ├── typhographic.js # random-letter scramble effect
│   └── form-handler.js # contact form → Google Apps Script
└── IMAGES/             # gallery shots + project thumbnails
```

</details>

<details>
<summary><b>🚀 Run it locally (click to expand)</b></summary>

<br/>

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

</details>

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

## 📊 GitHub, Live

<div align="center">

<img height="165" src="https://github-readme-stats.vercel.app/api?username=dev0root6&show_icons=true&hide_border=true&bg_color=020504&title_color=00ff88&icon_color=00ff88&text_color=7aab8e&ring_color=00ff88" alt="stats" />
<img height="165" src="https://github-readme-streak-stats.herokuapp.com/?user=dev0root6&hide_border=true&background=020504&stroke=00ff88&ring=00ff88&fire=f59e0b&currStreakLabel=00ff88&sideLabels=7aab8e&dates=2e5040&currStreakNum=d4f0e0&sideNums=d4f0e0" alt="streak" />

<img height="165" src="https://github-readme-stats.vercel.app/api/top-langs/?username=dev0root6&layout=compact&hide_border=true&bg_color=020504&title_color=00ff88&text_color=7aab8e&langs_count=8" alt="top langs" />

<img src="https://github-profile-trophy.vercel.app/?username=dev0root6&theme=matrix&no-frame=true&no-bg=true&column=7&margin-w=8" alt="trophies" />

<img src="https://github-readme-activity-graph.vercel.app/graph?username=dev0root6&bg_color=020504&color=00ff88&line=00ff88&point=f59e0b&area=true&hide_border=true" alt="activity graph" width="98%" />

</div>

---

## 📫 Reach Me

<div align="center">

[![Website](https://img.shields.io/badge/dev0root.in-00ff88?style=for-the-badge&logo=firefox&logoColor=020504&labelColor=020504)](https://dev0root.in)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0a66c2?style=for-the-badge&logo=linkedin&logoColor=white&labelColor=020504)](https://www.linkedin.com/in/dev0root)
[![GitHub](https://img.shields.io/badge/GitHub-dev0root6-181717?style=for-the-badge&logo=github&logoColor=white&labelColor=020504)](https://github.com/dev0root6)
[![Instagram](https://img.shields.io/badge/Instagram-%40127.4.7.8-e4405f?style=for-the-badge&logo=instagram&logoColor=white&labelColor=020504)](https://instagram.com/127.4.7.8)

</div>

> Open to security research collaborations, red team engagements, DevOps/SRE roles, and hardware hacking projects.

---

<div align="center">

`dev0root` · built with too much caffeine and a soft spot for green-on-black 🧃

</div>
