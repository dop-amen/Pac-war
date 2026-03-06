const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname)));

// ── MAP ──────────────────────────────────────────────────────────────────────
// 0 = empty, 1 = wall, 2 = dot, 3 = power pellet
const BASE_MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,0,1],
  [1,0,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,0,1,1,1,1,1,1,1,0,1,0,1,1,0,1],
  [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
  [1,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,1],
  [1,1,1,1,0,1,0,0,0,0,0,0,0,0,0,1,0,1,1,1,1],
  [1,1,1,1,0,1,0,1,1,0,0,0,1,1,0,1,0,1,1,1,1],
  [0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0],
  [1,1,1,1,0,1,0,1,1,1,1,1,1,1,0,1,0,1,1,1,1],
  [1,1,1,1,0,1,0,0,0,0,0,0,0,0,0,1,0,1,1,1,1],
  [1,1,1,1,0,1,0,1,1,1,1,1,1,1,0,1,0,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,0,1],
  [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
  [1,1,0,1,0,1,0,1,1,1,1,1,1,1,0,1,0,1,0,1,1],
  [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
  [1,0,1,1,1,1,1,1,0,1,1,1,0,1,1,1,1,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const ROWS = BASE_MAP.length;
const COLS = BASE_MAP[0].length;

// Power pellet positions (corners of open areas)
const POWER_PELLETS = [
  {r:1,c:1},{r:1,c:19},{r:20,c:1},{r:20,c:19}
];

// Build a fresh map with dots on every open cell (0), power pellets at corners
function buildFreshMap() {
  const map = BASE_MAP.map(row => [...row]);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (map[r][c] === 0) map[r][c] = 2; // dot
    }
  }
  POWER_PELLETS.forEach(({ r, c }) => {
    if (map[r][c] !== 1) map[r][c] = 3; // power pellet
  });
  return map;
}

function countDots(map) {
  let n = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (map[r][c] === 2 || map[r][c] === 3) n++;
  return n;
}

const GAME_DURATION = 240; // seconds

// Spawn points (will be cleared of dots when game starts)
const PACMAN_SPAWNS = [{r:1,c:1},{r:1,c:19},{r:20,c:1},{r:20,c:19},{r:10,c:0},{r:10,c:20}];
const GHOST_SPAWNS  = [{r:1,c:10},{r:20,c:10},{r:10,c:5},{r:10,c:15},{r:5,c:10},{r:15,c:10}];

function getSpawn(spawns, idx) {
  return spawns[idx % spawns.length];
}

// ── ROOM STATE ───────────────────────────────────────────────────────────────
const rooms = {};

function generateCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function createRoom(hostId) {
  const code = generateCode();
  rooms[code] = {
    code,
    host: hostId,
    state: 'lobby',
    players: {},
    map: null,
    timeLeft: GAME_DURATION,
    interval: null,
    timerInterval: null,
  };
  return code;
}

function getRoom(code) { return rooms[code]; }

function assignTeams(room) {
  const ids = Object.keys(room.players);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const half = Math.ceil(ids.length / 2);
  let pacIdx = 0, ghostIdx = 0;
  ids.forEach((id, i) => {
    const p = room.players[id];
    if (i < half) {
      p.team = 'pacman';
      const spawn = getSpawn(PACMAN_SPAWNS, pacIdx++);
      p.row = spawn.r; p.col = spawn.c;
    } else {
      p.team = 'ghost';
      const spawn = getSpawn(GHOST_SPAWNS, ghostIdx++);
      p.row = spawn.r; p.col = spawn.c;
    }
    p.alive = true;
    p.nextDir = null;
    p.dir = null;
  });

  // Clear dots from spawn positions so players don't instantly eat on spawn
  Object.values(room.players).forEach(p => {
    if (room.map[p.row][p.col] !== 1) room.map[p.row][p.col] = 0;
  });
}

function isWall(map, r, c) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
  return map[r][c] === 1;
}

const DIR_DELTA = { up:[-1,0], down:[1,0], left:[0,-1], right:[0,1] };

function endGame(room, winner, reason) {
  if (room.state === 'ended') return;
  room.state = 'ended';
  clearInterval(room.interval);
  clearInterval(room.timerInterval);
  io.to(room.code).emit('gameOver', { winner, reason });
}

function tickRoom(room) {
  if (room.state !== 'playing') return;

  // Move each alive player
  Object.values(room.players).forEach(p => {
    if (!p.alive) return;
    for (const d of [p.nextDir, p.dir]) {
      if (!d) continue;
      const [dr, dc] = DIR_DELTA[d];
      const nr = p.row + dr, nc = p.col + dc;
      if (!isWall(room.map, nr, nc)) {
        p.row = nr; p.col = nc;
        p.dir = d;
        if (d === p.nextDir) p.nextDir = null;
        break;
      }
    }
  });

  // Pacmen eat dots
  Object.values(room.players).forEach(p => {
    if (!p.alive || p.team !== 'pacman') return;
    const cell = room.map[p.row][p.col];
    if (cell === 2 || cell === 3) {
      room.map[p.row][p.col] = 0; // eat dot
    }
  });

  // Ghost eats Pacman — ghost wins the collision, pacman dies
  const alivePlayers = Object.values(room.players).filter(p => p.alive);
  const byCell = {};
  alivePlayers.forEach(p => {
    const key = `${p.row},${p.col}`;
    if (!byCell[key]) byCell[key] = [];
    byCell[key].push(p);
  });

  Object.values(byCell).forEach(group => {
    const hasPac   = group.some(p => p.team === 'pacman');
    const hasGhost = group.some(p => p.team === 'ghost');
    if (hasPac && hasGhost) {
      // Only pacmen die; ghosts survive
      group.forEach(p => { if (p.team === 'pacman') p.alive = false; });
    }
  });

  // Win condition checks
  const aliveNow = Object.values(room.players).filter(p => p.alive);
  const aPac   = aliveNow.filter(p => p.team === 'pacman').length;
  const aGhost = aliveNow.filter(p => p.team === 'ghost').length;
  const dotsLeft = countDots(room.map);

  // Emit current state (with timeLeft)
  io.to(room.code).emit('gameState', buildSnapshot(room));

  if (aPac === 0) {
    endGame(room, 'ghost', 'NO PACMEN REMAIN');
  } else if (dotsLeft === 0) {
    endGame(room, 'pacman', 'ALL DOTS EATEN');
  }
  // Timer expiry is handled separately in timerInterval
}

function buildSnapshot(room) {
  return {
    map: room.map,
    timeLeft: room.timeLeft,
    players: Object.entries(room.players).map(([id, p]) => ({
      id, name: p.name, team: p.team,
      row: p.row, col: p.col, alive: p.alive, dir: p.dir,
    })),
  };
}

// ── SOCKET ───────────────────────────────────────────────────────────────────
io.on('connection', socket => {
  console.log('connect', socket.id);

  socket.on('createRoom', ({ name }) => {
    const code = createRoom(socket.id);
    const room = getRoom(code);
    room.players[socket.id] = { name, team: null, row: 0, col: 0, alive: false, dir: null, nextDir: null };
    socket.join(code);
    socket.roomCode = code;
    socket.emit('roomCreated', { code });
    io.to(code).emit('lobbyUpdate', lobbyInfo(room));
  });

  socket.on('joinRoom', ({ code, name }) => {
    const room = getRoom(code);
    if (!room) { socket.emit('error', 'Room not found'); return; }
    if (room.state !== 'lobby') { socket.emit('error', 'Game already started'); return; }
    room.players[socket.id] = { name, team: null, row: 0, col: 0, alive: false, dir: null, nextDir: null };
    socket.join(code);
    socket.roomCode = code;
    socket.emit('roomJoined', { code });
    io.to(code).emit('lobbyUpdate', lobbyInfo(room));
  });

  socket.on('startGame', () => {
    const room = getRoom(socket.roomCode);
    if (!room || room.host !== socket.id) return;
    if (Object.keys(room.players).length < 2) { socket.emit('error', 'Need at least 2 players'); return; }

    room.state = 'playing';
    room.map = buildFreshMap();      // fresh map with dots
    room.timeLeft = GAME_DURATION;
    assignTeams(room);

    io.to(room.code).emit('gameStart', {
      map: room.map,
      players: buildSnapshot(room).players,
      timer: GAME_DURATION,
    });

    // Game tick (movement + collision + dot eating)
    room.interval = setInterval(() => tickRoom(room), 200); // 5 ticks/sec

    // Countdown timer
    room.timerInterval = setInterval(() => {
      if (room.state !== 'playing') return;
      room.timeLeft--;
      if (room.timeLeft <= 0) {
        endGame(room, 'draw', 'TIME EXPIRED');
      }
    }, 1000);
  });

  socket.on('input', ({ dir }) => {
    const room = getRoom(socket.roomCode);
    if (!room || room.state !== 'playing') return;
    const p = room.players[socket.id];
    if (p && p.alive) p.nextDir = dir;
  });

  socket.on('disconnect', () => {
    const room = getRoom(socket.roomCode);
    if (!room) return;
    delete room.players[socket.id];
    if (room.state === 'lobby') {
      io.to(room.code).emit('lobbyUpdate', lobbyInfo(room));
    }
    if (room.host === socket.id) {
      const remaining = Object.keys(room.players);
      if (remaining.length > 0) {
        room.host = remaining[0];
        io.to(room.code).emit('lobbyUpdate', lobbyInfo(room));
      } else {
        clearInterval(room.interval);
        clearInterval(room.timerInterval);
        delete rooms[room.code];
      }
    }
  });
});

function lobbyInfo(room) {
  return {
    code: room.code,
    host: room.host,
    players: Object.entries(room.players).map(([id, p]) => ({ id, name: p.name })),
  };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));