const { points, mills, edges, pointSet } = require("../public/morris-layout");

const neighbors = new Map(points.map((point) => [point, new Set()]));
for (const [first, second] of edges) {
  neighbors.get(first).add(second);
  neighbors.get(second).add(first);
}

function copyBoard(board) {
  return { ...board };
}

class MorrisGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = Object.fromEntries(points.map((point) => [point, null]));
    this.turn = "White";
    this.phase = "placing";
    this.placed = { White: 0, Black: 0 };
    this.pendingCapture = false;
    this.history = [];
    this.lastMove = null;
  }

  snapshot() {
    return {
      board: copyBoard(this.board),
      turn: this.turn,
      phase: this.phase,
      placed: { ...this.placed },
      pendingCapture: this.pendingCapture,
      lastMove: this.lastMove ? { ...this.lastMove } : null
    };
  }

  startTurn() {
    this.history.push(this.snapshot());
  }

  isMill(point, color, board = this.board) {
    return mills.some((mill) =>
      mill.includes(point) &&
      mill.every((member) => board[member] === `${color}-stone`)
    );
  }

  formedMill(point, color, previousBoard) {
    return mills.some((mill) =>
      mill.includes(point) &&
      mill.every((member) => this.board[member] === `${color}-stone`) &&
      !mill.every((member) => previousBoard[member] === `${color}-stone`)
    );
  }

  getCapturablePoints() {
    const opponent = this.turn === "White" ? "Black" : "White";
    const opponentPoints = points.filter((point) => this.board[point] === `${opponent}-stone`);
    const outsideMills = opponentPoints.filter((point) => !this.isMill(point, opponent));
    return outsideMills.length > 0 ? outsideMills : opponentPoints;
  }

  getLegalMoves(point) {
    if (this.phase !== "moving" || this.pendingCapture) {
      return [];
    }

    const color = this.turn;
    const stones = points.filter((candidate) => this.board[candidate] === `${color}-stone`);
    if (this.board[point] !== `${color}-stone`) {
      return [];
    }

    const emptyPoints = points.filter((candidate) => this.board[candidate] === null);
    if (stones.length === 3) {
      return emptyPoints;
    }

    return [...neighbors.get(point)].filter((candidate) => this.board[candidate] === null);
  }

  place(point) {
    if (
      this.phase !== "placing" ||
      this.pendingCapture ||
      !pointSet.has(point) ||
      this.board[point] !== null ||
      this.placed[this.turn] >= 9
    ) {
      return null;
    }

    const color = this.turn;
    const previousBoard = copyBoard(this.board);
    this.startTurn();
    this.board[point] = `${color}-stone`;
    this.placed[color]++;
    this.lastMove = { color, from: null, to: point, action: "placed" };

    if (this.formedMill(point, color, previousBoard) && this.getCapturablePoints().length > 0) {
      this.pendingCapture = true;
      return { ...this.lastMove, captureRequired: true, turnComplete: false };
    }

    this.completeTurn();
    return { ...this.lastMove, captureRequired: false, turnComplete: true };
  }

  move(from, to) {
    const legalMoves = this.getLegalMoves(from);
    if (!pointSet.has(to) || !legalMoves.includes(to)) {
      return null;
    }

    const color = this.turn;
    const previousBoard = copyBoard(this.board);
    this.startTurn();
    this.board[from] = null;
    this.board[to] = `${color}-stone`;
    this.lastMove = { color, from, to, action: "moved" };

    if (this.formedMill(to, color, previousBoard) && this.getCapturablePoints().length > 0) {
      this.pendingCapture = true;
      return { ...this.lastMove, captureRequired: true, turnComplete: false };
    }

    this.completeTurn();
    return { ...this.lastMove, captureRequired: false, turnComplete: true };
  }

  capture(point) {
    if (!this.pendingCapture || !this.getCapturablePoints().includes(point)) {
      return null;
    }

    const opponent = this.turn === "White" ? "Black" : "White";
    this.board[point] = null;
    this.lastMove = { ...this.lastMove, capturedPoint: point, capturedColor: opponent };
    this.pendingCapture = false;
    this.completeTurn();
    return { ...this.lastMove, turnComplete: true };
  }

  completeTurn() {
    if (this.placed.White === 9 && this.placed.Black === 9) {
      this.phase = "moving";
    }
    this.pendingCapture = false;
    this.turn = this.turn === "White" ? "Black" : "White";
  }

  undo() {
    const previousPosition = this.history.pop();
    if (!previousPosition) {
      return false;
    }

    this.board = previousPosition.board;
    this.turn = previousPosition.turn;
    this.phase = previousPosition.phase;
    this.placed = previousPosition.placed;
    this.pendingCapture = previousPosition.pendingCapture;
    this.lastMove = previousPosition.lastMove;
    return true;
  }

  getWinner() {
    if (this.phase !== "moving" || this.pendingCapture) {
      return null;
    }

    const opponent = this.turn;
    const opponentStones = points.filter((point) => this.board[point] === `${opponent}-stone`);
    if (opponentStones.length < 3) {
      return this.turn === "White" ? "Black" : "White";
    }

    const hasLegalMove = opponentStones.some((point) => this.getLegalMoves(point).length > 0);
    return hasLegalMove ? null : (this.turn === "White" ? "Black" : "White");
  }
}

module.exports = { MorrisGame, points, mills, edges, neighbors };
