const express = require("express");
const http = require("node:http");
const path = require("node:path");
const { Server } = require("socket.io");
const { Chess } = require("chess.js");
const { CheckersGame, SIZE: CHECKERS_SIZE } = require("./games/checkers");
const { MorrisGame, points: MORRIS_POINTS } = require("./games/morris");
const { LudoGame, WIDTH: LUDO_SIZE } = require("./games/ludo");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = Number(process.env.PORT) || 3000;
const devices = new Map();
let chess = new Chess();
let checkers = new CheckersGame();
let morris = new MorrisGame();
let ludo = new LudoGame();
let currentGame = "chess";
let checkersLastMove = null;
let ludoDiceDeviceName = null;
let isShuttingDown = false;
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
  if (currentGame === "chess") {
    return "Chess";
  }
  if (currentGame === "checkers") {
    return "International Draughts";
  }
  if (currentGame === "morris") {
    return "Nine Men's Morris";
  }
  return "Ludo";
}

function getBoardSize() {
  if (currentGame === "chess") {
    return 8;
  }
  if (currentGame === "checkers") {
    return CHECKERS_SIZE;
  }
  if (currentGame === "morris") {
    return 7;
  }
  return LUDO_SIZE;
}

function getBoardDimensions() {
  const size = getBoardSize();
  return { boardWidth: size, boardHeight: size };
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

  if (currentGame === "morris") {
    const winner = morris.getWinner();
    if (winner) {
      const currentPlayerPieces = MORRIS_POINTS.filter((point) =>
        morris.board[point] === `${morris.turn}-stone`
      ).length;
      return {
        heading: currentPlayerPieces < 3 ? "FEWER THAN THREE PIECES" : "NO LEGAL MOVES",
        winner
      };
    }
  }

  if (currentGame === "ludo") {
    const winner = ludo.getWinner();
    if (winner) {
      return { heading: "ALL FOUR TOKENS FINISHED", winner };
    }
  }

  return null;
}

function getBoardState() {
  const isChess = currentGame === "chess";
  const isCheckers = currentGame === "checkers";
  const isMorris = currentGame === "morris";
  const isLudo = currentGame === "ludo";
  const board = isChess
    ? getChessBoard()
    : isCheckers ? checkers.board
      : isMorris ? morris.board : ludo.board;
  const history = chess.history({ verbose: true });
  const turn = isChess
    ? (chess.turn() === "w" ? "White" : "Black")
    : isCheckers ? checkers.turn : isMorris ? morris.turn : ludo.turn;
  const lastMove = isChess
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
    : isCheckers ? checkersLastMove : isMorris ? morris.lastMove : ludo.lastMove;
  const dimensions = getBoardDimensions();

  return {
    board,
    game: currentGame,
    gameName: getCurrentGameName(),
    boardSize: getBoardSize(),
    ...dimensions,
    selectedSquare,
    turn,
    lastMove,
    phase: isMorris ? morris.phase : null,
    piecesToPlace: currentGame === "morris"
      ? { White: 9 - morris.placed.White, Black: 9 - morris.placed.Black }
      : null,
    currentRoll: isLudo ? ludo.currentRoll : null,
    lastRoll: isLudo ? ludo.lastRoll : null,
    ludoLayout: isLudo ? ludo.getLayout() : null,
    ludoDiceDeviceName: isLudo ? ludoDiceDeviceName : null,
    pendingCapture: isMorris && morris.pendingCapture,
    selectableSquares: currentGame === "morris"
      ? (morris.pendingCapture
        ? morris.getCapturablePoints()
        : morris.phase === "placing"
          ? MORRIS_POINTS.filter((point) => morris.board[point] === null)
          : morris.getLegalMoves(selectedSquare))
      : isLudo
        ? (selectedSquare === null
          ? ludo.pieces
            .map((piece) => ludo.getPosition(piece))
            .filter((square, index, squares) =>
              square && squares.indexOf(square) === index && ludo.getLegalMoves(square).length > 0)
          : ludo.getLegalMoves(selectedSquare))
        : [],
    canUndo: isChess
      ? history.length > 0
      : isCheckers
        ? checkers.history.length > 0
        : isMorris ? morris.history.length > 0 : ludo.history.length > 0,
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
  return typeof square === "string" && /^[a-o](1[0-5]|[1-9])$/.test(square);
}

function isSquareOnCurrentBoard(square) {
  if (!isValidSquare(square)) {
    return false;
  }
  if (currentGame === "morris") {
    return MORRIS_POINTS.includes(square);
  }
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number(square.slice(1));
  const { boardWidth, boardHeight } = getBoardDimensions();
  return file < boardWidth && rank <= boardHeight;
}

function getConnectedDevices() {
  const connectedDevices = [];

  for (const [name, device] of devices) {
    if (device.socketId) {
      connectedDevices.push({
        id: device.socketId,
        name,
        squares: getDeviceSquares(device),
        isLudoDice: name === ludoDiceDeviceName
      });
    }
  }

  return connectedDevices;
}

function getDeviceSquares(device) {
  if (currentGame === "morris") {
    return device.morrisSquares || [];
  }
  return currentGame === "ludo" ? device.ludoSquares || [] : device.squares;
}

function getDeviceBySocketId(socketId) {
  for (const device of devices.values()) {
    if (device.socketId === socketId) {
      return device;
    }
  }
}

function areValidSquares(squares) {
  if (!Array.isArray(squares) || squares.length > LUDO_SIZE * LUDO_SIZE) {
    return false;
  }

  const uniqueSquares = new Set(squares);

  return uniqueSquares.size === squares.length &&
    squares.every((square) => currentGame === "morris"
      ? MORRIS_POINTS.includes(square)
      : isValidSquare(square));
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

function handleMorrisSquareTap(socket, square) {
  if (morris.pendingCapture) {
    const result = morris.capture(square);
    if (!result) {
      socket.emit("move-rejected", { from: "mill", to: square });
      return;
    }

    selectedSquare = null;
    console.log(`${result.capturedColor} piece removed from ${square.toUpperCase()}`);
    broadcastBoardState();
    return;
  }

  if (morris.phase === "placing") {
    const result = morris.place(square);
    if (!result) {
      socket.emit("move-rejected", { from: "place", to: square });
      return;
    }

    selectedSquare = null;
    console.log(`${result.color} placed a stone on ${square.toUpperCase()}`);
    broadcastBoardState();
    return;
  }

  if (selectedSquare === null) {
    if (morris.getLegalMoves(square).length > 0) {
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

  if (morris.board[square] === `${morris.turn}-stone`) {
    if (morris.getLegalMoves(square).length > 0) {
      selectedSquare = square;
      broadcastBoardState();
    }
    return;
  }

  const fromSquare = selectedSquare;
  const result = morris.move(fromSquare, square);
  if (!result) {
    selectedSquare = null;
    socket.emit("move-rejected", { from: fromSquare, to: square });
    broadcastBoardState();
    return;
  }

  selectedSquare = null;
  console.log(`${result.color} moved ${fromSquare.toUpperCase()} to ${square.toUpperCase()}`);
  broadcastBoardState();
}

function handleLudoSquareTap(socket, square) {
  if (ludo.currentRoll === null) {
    socket.emit("move-rejected", { from: square, to: square });
    return;
  }

  if (square === selectedSquare) {
    selectedSquare = null;
    broadcastBoardState();
    return;
  }

  if (selectedSquare === null) {
    if (ludo.getLegalMoves(square).length > 0) {
      selectedSquare = square;
      broadcastBoardState();
      return;
    }
  }

  if (square === selectedSquare) {
    selectedSquare = null;
    broadcastBoardState();
    return;
  }

  const fromSquare = selectedSquare;
  const move = fromSquare ? ludo.move(fromSquare, square) : null;
  if (!move) {
    if (ludo.getLegalMoves(square).length > 0) {
      selectedSquare = square;
      broadcastBoardState();
      return;
    }
    socket.emit("move-rejected", { from: fromSquare || "select", to: square });
    return;
  }

  selectedSquare = null;
  console.log(`${move.color} moved ${move.from.toUpperCase()} to ${move.to.toUpperCase()} with a roll of ${move.roll}` +
    (move.capturedCount ? `, capturing ${move.capturedCount} token(s)` : "") +
    (move.finished ? ", finishing a token" : ""));
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
      device = { socketId: null, squares: [], morrisSquares: [], ludoSquares: [] };
    }
    device.socketId = socket.id;
    devices.set(deviceName, device);
    socket.data.deviceName = deviceName;
    socket.emit("squares-update", getDeviceSquares(device));
    console.log(`${deviceName} connected`);
    broadcastDeviceNames();
  });

  socket.on("shutdown-server", () => {
    if (socket.data.deviceName || isShuttingDown) {
      console.warn(`Ignored server shutdown request from ${socket.id}`);
      return;
    }

    isShuttingDown = true;
    console.log(`Server shutdown requested by admin ${socket.id}`);
    io.timeout(3000).emit("server-shutting-down", (error) => {
      if (error) {
        console.warn("Some connected pages did not confirm leaving the website");
      }
      io.close(() => {
        console.log("Server shut down");
      });
    });
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

    if (currentGame === "morris") {
      device.morrisSquares = squares;
    } else if (currentGame === "ludo") {
      device.ludoSquares = squares;
    } else {
      device.squares = squares;
    }
    io.to(deviceId).emit("squares-update", getDeviceSquares(device));
    broadcastDeviceNames();
  });

  socket.on("change-game", (game) => {
    if (socket.data.deviceName || !["chess", "checkers", "morris", "ludo"].includes(game)) {
      console.warn(`Ignored invalid game change request from ${socket.id}`);
      return;
    }

    if (game === currentGame) {
      return;
    }

    currentGame = game;
    chess = new Chess();
    checkers = new CheckersGame();
    morris = new MorrisGame();
    ludo = new LudoGame();
    selectedSquare = null;
    resignation = null;
    checkersLastMove = null;
    console.log(`Game changed to ${getCurrentGameName()}; started a new game`);
    broadcastBoardState();
    broadcastDeviceNames();
    for (const device of devices.values()) {
      if (device.socketId) {
        io.to(device.socketId).emit("squares-update", getDeviceSquares(device));
      }
    }
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
    } else if (currentGame === "checkers") {
      if (!checkers.undo()) {
        console.warn(`Ignored undo request with no moves from ${socket.id}`);
        return;
      }
      checkersLastMove = null;
      console.log("International draughts turn undone");
    } else if (currentGame === "morris") {
      if (!morris.undo()) {
        console.warn(`Ignored undo request with no moves from ${socket.id}`);
        return;
      }
      console.log("Nine Men's Morris turn undone");
    } else {
      if (!ludo.undo()) {
        console.warn(`Ignored undo request with no moves from ${socket.id}`);
        return;
      }
      console.log("Ludo move undone");
    }

    selectedSquare = null;
    broadcastBoardState();
  });

  socket.on("set-ludo-dice-device", (deviceId) => {
    if (socket.data.deviceName || currentGame !== "ludo") {
      console.warn(`Ignored Ludo dice-device change request from ${socket.id}`);
      return;
    }

    if (deviceId === null) {
      ludoDiceDeviceName = null;
    } else {
      const device = typeof deviceId === "string" ? getDeviceBySocketId(deviceId) : undefined;
      if (!device || !device.socketId) {
        console.warn(`Ignored Ludo dice-device selection for an unknown device from ${socket.id}`);
        return;
      }
      for (const [name, candidate] of devices) {
        if (candidate === device) {
          ludoDiceDeviceName = name;
          break;
        }
      }
    }
    broadcastDeviceNames();
    broadcastBoardState();
  });

  socket.on("roll-ludo-die", () => {
    const device = socket.data.deviceName
      ? devices.get(socket.data.deviceName)
      : undefined;
    if (
      !socket.data.deviceName ||
      socket.data.deviceName !== ludoDiceDeviceName ||
      !device ||
      device.socketId !== socket.id ||
      currentGame !== "ludo" ||
      isGameOver()
    ) {
      console.warn(`Ignored Ludo die roll request from ${socket.id}`);
      return;
    }

    const result = ludo.roll();
    if (!result) {
      console.warn(`Ignored Ludo die roll while a roll is already active from ${socket.id}`);
      return;
    }
    selectedSquare = null;
    console.log(`${result.color} rolled ${result.value}` +
      (result.skipped ? "; no legal move" : ""));
    broadcastBoardState();
  });

  socket.on("resign", (color) => {
    if (
      currentGame === "ludo" ||
      (color !== "White" && color !== "Black") ||
      isGameOver()
    ) {
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
      !getDeviceSquares(device).includes(square)
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
    } else if (currentGame === "checkers") {
      handleCheckersSquareTap(socket, square);
    } else if (currentGame === "morris") {
      handleMorrisSquareTap(socket, square);
    } else {
      handleLudoSquareTap(socket, square);
    }
  });

  socket.on("disconnect", () => {
    const deviceName = socket.data.deviceName;
    const device = deviceName ? devices.get(deviceName) : undefined;
    if (device && device.socketId === socket.id) {
      if (getDeviceSquares(device).includes(selectedSquare)) {
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
