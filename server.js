const express = require("express");
const http = require("node:http");
const path = require("node:path");
const { Server } = require("socket.io");
const { Chess } = require("chess.js");
const { CheckersGame, SIZE: CHECKERS_SIZE } = require("./games/checkers");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = 3000;
const devices = new Map();
let chess = new Chess();
let checkers = new CheckersGame();
let currentGame = "chess";
let checkersLastMove = null;
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

function getCurrentGameName() {
  return currentGame === "chess" ? "Chess" : "International Draughts";
}

function getBoardSize() {
  return currentGame === "chess" ? 8 : CHECKERS_SIZE;
}

function getChessBoard() {
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

  return board;
}

function getGameResult() {
  if (resignation) {
    return {
      heading: `${resignation.resigned.toUpperCase()} RESIGNS`,
      winner: resignation.winner
    };
  }

  if (currentGame === "chess" && chess.isCheckmate()) {
    return {
      heading: "CHECKMATE",
      winner: chess.turn() === "w" ? "Black" : "White"
    };
  }

  if (currentGame === "chess" && chess.isDraw()) {
    return { heading: "DRAW", winner: null };
  }

  if (currentGame === "checkers") {
    const winner = checkers.getWinner();
    if (winner) {
      return { heading: "NO LEGAL MOVES", winner };
    }
  }

  return null;
}

function getBoardState() {
  const isChess = currentGame === "chess";
  const board = isChess ? getChessBoard() : checkers.board;
  const history = chess.history({ verbose: true });
  const turn = isChess ? (chess.turn() === "w" ? "White" : "Black") : checkers.turn;

  return {
    board,
    game: currentGame,
    gameName: getCurrentGameName(),
    boardSize: getBoardSize(),
    selectedSquare,
    turn,
    lastMove: isChess
      ? (history.length > 0
        ? {
          color: history[history.length - 1].color === "w" ? "White" : "Black",
          from: history[history.length - 1].from,
          to: history[history.length - 1].to,
          capturedPiece: history[history.length - 1].captured
            ? pieceNames[history[history.length - 1].captured]
            : null,
          capturedColor: history[history.length - 1].captured
            ? (history[history.length - 1].color === "w" ? "Black" : "White")
            : null
        }
        : null)
      : checkersLastMove,
    canUndo: isChess ? history.length > 0 : checkers.history.length > 0,
    checkmateWinner: isChess && chess.isCheckmate()
      ? (chess.turn() === "w" ? "Black" : "White")
      : null,
    gameResult: getGameResult(),
    resignation
  };
}

function broadcastBoardState() {
  io.emit("board-update", getBoardState());
}

function isValidSquare(square) {
  return typeof square === "string" && /^[a-j](10|[1-9])$/.test(square);
}

function isSquareOnCurrentBoard(square) {
  if (!isValidSquare(square)) {
    return false;
  }
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number(square.slice(1));
  return file < getBoardSize() && rank <= getBoardSize();
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
  if (!Array.isArray(squares) || squares.length > CHECKERS_SIZE * CHECKERS_SIZE) {
    return false;
  }

  const uniqueSquares = new Set(squares);

  return uniqueSquares.size === squares.length &&
    squares.every(isValidSquare);
}

function isGameOver() {
  return Boolean(getGameResult());
}

function getCheckersPieceColor(piece) {
  if (!piece) {
    return null;
  }
  return piece.startsWith("White-") ? "White" : "Black";
}

function handleChessSquareTap(socket, square) {
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
}

function handleCheckersSquareTap(socket, square) {
  const legalSteps = checkers.getLegalSteps();
  if (selectedSquare === null) {
    const piece = checkers.board[square];
    if (
      getCheckersPieceColor(piece) === checkers.turn &&
      legalSteps.some((step) => step.from === square)
    ) {
      selectedSquare = square;
      broadcastBoardState();
    }
    return;
  }

  if (square === selectedSquare && !checkers.captureOptions) {
    selectedSquare = null;
    broadcastBoardState();
    return;
  }

  if (!checkers.captureOptions) {
    const tappedPiece = checkers.board[square];
    if (
      getCheckersPieceColor(tappedPiece) === checkers.turn &&
      legalSteps.some((step) => step.from === square)
    ) {
      selectedSquare = square;
      broadcastBoardState();
      return;
    }
  }

  const fromSquare = selectedSquare;
  const move = checkers.move(fromSquare, square);
  if (!move) {
    if (!checkers.captureOptions) {
      selectedSquare = null;
      broadcastBoardState();
    }
    socket.emit("move-rejected", { from: fromSquare, to: square });
    return;
  }

  checkersLastMove = {
    color: getCheckersPieceColor(move.piece),
    from: move.from,
    to: move.to,
    capturedPiece: move.capturedPiece ? "checker" : null,
    capturedColor: move.capturedPiece
      ? (getCheckersPieceColor(move.piece) === "White" ? "Black" : "White")
      : null
  };
  selectedSquare = move.turnComplete ? null : move.to;
  console.log(
    `${checkersLastMove.color} moved ${move.from.toUpperCase()} to ${move.to.toUpperCase()}` +
    (move.capturedPiece ? ", capturing a checker" : "")
  );
  broadcastBoardState();
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

  socket.on("change-game", (game) => {
    if (socket.data.deviceName || (game !== "chess" && game !== "checkers")) {
      console.warn(`Ignored invalid game change request from ${socket.id}`);
      return;
    }

    if (game === currentGame) {
      return;
    }

    currentGame = game;
    chess = new Chess();
    checkers = new CheckersGame();
    selectedSquare = null;
    resignation = null;
    checkersLastMove = null;
    console.log(`Game changed to ${getCurrentGameName()}; started a new game`);
    broadcastBoardState();
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

    if (currentGame === "chess") {
      const undoneMove = chess.undo();
      if (!undoneMove) {
        console.warn(`Ignored undo request with no moves from ${socket.id}`);
        return;
      }
      console.log(`Move undone: ${undoneMove.san}`);
    } else {
      if (!checkers.undo()) {
        console.warn(`Ignored undo request with no moves from ${socket.id}`);
        return;
      }
      checkersLastMove = null;
      console.log("International draughts turn undone");
    }

    selectedSquare = null;
    broadcastBoardState();
  });

  socket.on("resign", (color) => {
    if ((color !== "White" && color !== "Black") || isGameOver()) {
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

    if (
      !isSquareOnCurrentBoard(square) ||
      !device ||
      device.socketId !== socket.id ||
      !device.squares.includes(square)
    ) {
      console.warn(`Ignored square tap from unassigned device ${socket.id}`);
      return;
    }

    if (isGameOver()) {
      console.warn(`Ignored square tap after game ended from ${socket.id}`);
      return;
    }

    if (currentGame === "chess") {
      handleChessSquareTap(socket, square);
    } else {
      handleCheckersSquareTap(socket, square);
    }
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
