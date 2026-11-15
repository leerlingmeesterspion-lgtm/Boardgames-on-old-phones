const express = require("express");
const http = require("node:http");
const path = require("node:path");
const { Server } = require("socket.io");
const { Chess } = require("chess.js");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = 3000;
const devices = new Map();
const chess = new Chess();
const pieceNames = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king"
};
const files = "abcdefgh";
const ranks = "12345678";
let selectedSquare = null;
let resignation = null;

function getMoveSummary(move) {
  return {
    color: move.color === "w" ? "White" : "Black",
    from: move.from,
    to: move.to,
    capturedPiece: move.captured ? pieceNames[move.captured] : null,
    capturedColor: move.captured
      ? (move.color === "w" ? "Black" : "White")
      : null
  };
}

function getBoardState() {
  const board = {};

  for (const file of files) {
    for (const rank of ranks) {
      const square = `${file}${rank}`;
      const piece = chess.get(square);
      board[square] = piece
        ? `${piece.color === "w" ? "white" : "black"}-${pieceNames[piece.type]}`
        : null;
    }
  }

  const history = chess.history({ verbose: true });

  return {
    board,
    selectedSquare,
    turn: chess.turn() === "w" ? "White" : "Black",
    lastMove: history.length > 0 ? getMoveSummary(history[history.length - 1]) : null,
    canUndo: history.length > 0,
    checkmateWinner: chess.isCheckmate()
      ? (chess.turn() === "w" ? "Black" : "White")
      : null,
    resignation
  };
}

function broadcastBoardState() {
  io.emit("board-update", getBoardState());
}

function isValidSquare(square) {
  return typeof square === "string" && /^[a-h][1-8]$/.test(square);
}

function getConnectedDevices() {
  const connectedDevices = [];

  for (const [name, device] of devices) {
    if (device.socketId) {
      connectedDevices.push({
        id: device.socketId,
        name,
        squares: device.squares
      });
    }
  }

  return connectedDevices;
}

function getDeviceBySocketId(socketId) {
  for (const device of devices.values()) {
    if (device.socketId === socketId) {
      return device;
    }
  }
}

function areValidSquares(squares) {
  if (!Array.isArray(squares) || squares.length > 64) {
    return false;
  }

  const uniqueSquares = new Set(squares);

  return uniqueSquares.size === squares.length &&
    squares.every(isValidSquare);
}

function broadcastDeviceNames() {
  io.emit("devices-update", getConnectedDevices());
}

app.use(express.static(path.join(__dirname, "public"), {
  setHeaders(response, filePath) {
    if (path.extname(filePath) === ".html") {
      response.setHeader("Cache-Control", "no-store");
    }
  }
}));

app.get("/admin", (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.sendFile(path.join(__dirname, "public", "admin.html"), {
    cacheControl: false
  });
});

io.on("connection", (socket) => {
  socket.emit("devices-update", getConnectedDevices());
  socket.emit("board-update", getBoardState());

  socket.on("register-device", (deviceName) => {
    if (typeof deviceName !== "string" || !/^[A-Z]{2,10}-[A-Z]{2,10}-\d{2}$/.test(deviceName)) {
      console.warn(`Ignored invalid device name from ${socket.id}`);
      return;
    }

    let device = devices.get(deviceName);
    if (!device) {
      device = { socketId: null, squares: [] };
    }
    device.socketId = socket.id;
    devices.set(deviceName, device);
    socket.data.deviceName = deviceName;
    socket.emit("squares-update", device.squares);
    console.log(`${deviceName} connected`);
    broadcastDeviceNames();
  });

  socket.on("identify-device", (deviceId) => {
    const device = typeof deviceId === "string" ? getDeviceBySocketId(deviceId) : undefined;
    if (!device) {
      console.warn(`Ignored identify request for unknown device from ${socket.id}`);
      return;
    }

    io.to(deviceId).emit("identify");
  });

  socket.on("save-device-squares", (assignment) => {
    if (!assignment || typeof assignment !== "object") {
      console.warn(`Ignored invalid square assignment from ${socket.id}`);
      return;
    }

    const { deviceId, squares } = assignment;
    const device = typeof deviceId === "string" ? getDeviceBySocketId(deviceId) : undefined;
    if (!device || !areValidSquares(squares)) {
      console.warn(`Ignored invalid square assignment from ${socket.id}`);
      return;
    }

    device.squares = squares;
    io.to(deviceId).emit("squares-update", device.squares);
    broadcastDeviceNames();
  });

  socket.on("undo-move", () => {
    if (resignation) {
      console.warn(`Ignored undo request after resignation from ${socket.id}`);
      return;
    }

    if (socket.data.deviceName) {
      console.warn(`Ignored undo request from board device ${socket.id}`);
      return;
    }

    const undoneMove = chess.undo();
    if (!undoneMove) {
      console.warn(`Ignored undo request with no moves from ${socket.id}`);
      return;
    }

    selectedSquare = null;
    console.log(`Move undone: ${undoneMove.san}`);
    broadcastBoardState();
  });

  socket.on("resign", (color) => {
    if ((color !== "White" && color !== "Black") || resignation || chess.isGameOver()) {
      console.warn(`Ignored invalid resignation request from ${socket.id}`);
      return;
    }

    resignation = {
      resigned: color,
      winner: color === "White" ? "Black" : "White"
    };
    console.log(`${resignation.resigned} resigns; ${resignation.winner} wins`);
    broadcastBoardState();
  });

  socket.on("square-tapped", (square) => {
    const deviceName = socket.data.deviceName;
    const device = deviceName ? devices.get(deviceName) : undefined;
    if (resignation) {
      console.warn(`Ignored square tap after resignation from ${socket.id}`);
      return;
    }

    if (!isValidSquare(square) || !device || device.socketId !== socket.id || !device.squares.includes(square)) {
      console.warn(`Ignored square tap from unassigned device ${socket.id}`);
      return;
    }

    if (selectedSquare === null) {
      const piece = chess.get(square);
      if (piece && piece.color === chess.turn()) {
        selectedSquare = square;
        broadcastBoardState();
      }
      return;
    }

    if (square === selectedSquare) {
      selectedSquare = null;
      broadcastBoardState();
      return;
    }

    const tappedPiece = chess.get(square);
    if (tappedPiece && tappedPiece.color === chess.turn()) {
      selectedSquare = square;
      broadcastBoardState();
      return;
    }

    const fromSquare = selectedSquare;
    const legalMove = chess.moves({ square: fromSquare, verbose: true })
      .find((move) => move.to === square);
    if (!legalMove) {
      selectedSquare = null;
      socket.emit("move-rejected", { from: fromSquare, to: square });
      broadcastBoardState();
      return;
    }

    const move = chess.move({
      from: fromSquare,
      to: square,
      promotion: "q"
    });
    selectedSquare = null;
    console.log(`Move accepted: ${move.san}`);
    broadcastBoardState();
  });

  socket.on("disconnect", () => {
    const deviceName = socket.data.deviceName;
    const device = deviceName ? devices.get(deviceName) : undefined;
    if (device && device.socketId === socket.id) {
      if (device.squares.includes(selectedSquare)) {
        selectedSquare = null;
        broadcastBoardState();
      }
      device.socketId = null;
      console.log(`${deviceName} disconnected`);
      broadcastDeviceNames();
    }
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
