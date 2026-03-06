# PACWAR — Multiplayer Pac-Man

A real-time multiplayer Pac-Man game built with Node.js, Socket.io, and vanilla JS. Players join a lobby via room code and are split into two teams with opposing objectives.

---

## How to Play

1. Enter your name and create or join a room using a 5-letter code
2. Share the code with friends
3. Host clicks **Start Game** when everyone is in
4. Players are randomly split into two teams:

| Team | Objective |
|------|-----------|
| 🟡 Pac-Men | Eat all the dots before time runs out |
| 👻 Ghosts | Hunt down and eat all the Pac-Men |

**Controls:** Arrow keys or WASD — mobile D-pad on touch devices

---

## Win Conditions

- **Pac-Men win** — all dots eaten
- **Ghosts win** — all Pac-Men eliminated
- **Draw** — timer runs out with dots still remaining

---

## Running Locally

**Prerequisites:** Node.js

```bash
# Clone the repo
git clone https://github.com/yourusername/pacwar.git
cd pacwar

# Install dependencies
npm install

# Start the server
npm start
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

To play multiplayer locally, open multiple tabs or share your local IP with devices on the same network.

---

## Tech Stack

- **Backend** — Node.js, Express, Socket.io
- **Frontend** — Vanilla JS, HTML5 Canvas
- **Fonts** — Press Start 2P, Orbitron (Google Fonts)

---

## Deployment

Deployed on [Railway](https://railway.app). Any platform that supports WebSockets will work — Render and Fly.io are good alternatives. Vercel is **not** compatible as it does not support WebSockets.

---

## Project Structure

```
pacwar/
├── server.js       # Game server, socket events, game loop
├── index.html      # Client — UI, canvas rendering, socket client
├── favicon.ico
├── package.json
└── README.md
```

---

Built for fun. Eat or be eaten. 🟡👻