const FILES = "abcdefghijklmno";
const WIDTH = 15;
const HEIGHT = 15;
const COLORS = ["Red", "Blue", "Yellow", "Green"];
const START_INDEX = { Red: 0, Blue: 13, Yellow: 26, Green: 39 };
const TRACK = [
  "b9", "c9", "d9", "e9", "f9", "g10", "g11", "g12", "g13", "g14", "g15", "h15",
  "i15", "i14", "i13", "i12", "i11", "i10", "j9", "k9", "l9", "m9", "n9", "o9",
  "o8", "o7", "n7", "m7", "l7", "k7", "j7", "i6", "i5", "i4", "i3", "i2", "i1",
  "h1", "g1", "g2", "g3", "g4", "g5", "g6", "f7", "e7", "d7", "c7", "b7", "a7",
  "a8", "a9"
];
const HOME_LANES = {
  Red: ["b8", "c8", "d8", "e8", "f8"],
  Blue: ["h14", "h13", "h12", "h11", "h10"],
  Yellow: ["n8", "m8", "l8", "k8", "j8"],
  Green: ["h2", "h3", "h4", "h5", "h6"]
};
const YARDS = {
  Red: ["c13", "e13", "c11", "e11"],
  Blue: ["k13", "m13", "k11", "m11"],
  Yellow: ["k5", "m5", "k3", "m3"],
  Green: ["c5", "e5", "c3", "e3"]
};
const GOALS = { Red: "g8", Blue: "h9", Yellow: "i8", Green: "h7" };
const SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47].map((index) => TRACK[index]));

function getCoordinates(square) {
  const match = /^([a-o])(1[0-5]|[1-9])$/.exec(square);
  return match
    ? { file: FILES.indexOf(match[1]), rank: Number(match[2]) }
    : null;
}

function getNextTurn(color) {
  return COLORS[(COLORS.indexOf(color) + 1) % COLORS.length];
}

function copyPieces(pieces) {
  return pieces.map((piece) => ({ ...piece }));
}

class LudoGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.turn = COLORS[0];
    this.currentRoll = null;
    this.lastRoll = null;
    this.pieces = COLORS.flatMap((color) =>
      YARDS[color].map((_, index) => ({
        id: `${color}-${index + 1}`,
        color,
        yardIndex: index,
        progress: -1
      }))
    );
    this.history = [];
    this.lastMove = null;
    this.updateBoard();
  }

  getPosition(piece) {
    if (piece.progress < 0) {
      return YARDS[piece.color][piece.yardIndex];
    }
    if (piece.progress < 52) {
      return TRACK[(START_INDEX[piece.color] + piece.progress) % TRACK.length];
    }
    if (piece.progress < 57) {
      return HOME_LANES[piece.color][piece.progress - 52];
    }
    return null;
  }

  getDestination(piece, roll = this.currentRoll) {
    if (roll === null || piece.color !== this.turn || piece.progress === 57) {
      return null;
    }
    if (piece.progress === -1) {
      return roll === 6 ? TRACK[START_INDEX[piece.color]] : null;
    }
    const destinationProgress = piece.progress + roll;
    if (destinationProgress > 57) {
      return null;
    }
    return destinationProgress === 57
      ? GOALS[piece.color]
      : this.getPosition({ ...piece, progress: destinationProgress });
  }

  getLegalMoves(square) {
    if (this.currentRoll === null) {
      return [];
    }
    const destinations = this.pieces
      .filter((piece) => piece.color === this.turn && this.getPosition(piece) === square)
      .map((piece) => this.getDestination(piece))
      .filter(Boolean);
    return [...new Set(destinations)];
  }

  updateBoard() {
    this.board = Object.fromEntries(
      Array.from({ length: HEIGHT }, (_, row) =>
        Array.from({ length: WIDTH }, (_, file) =>
          `${FILES[file]}${HEIGHT - row}`
        )
      ).flat().map((square) => [square, null])
    );
    const stacks = new Map();
    for (const piece of this.pieces) {
      const square = this.getPosition(piece);
      if (!square) {
        continue;
      }
      const stack = stacks.get(square) || [];
      stack.push(piece);
      stacks.set(square, stack);
    }
    for (const [square, stack] of stacks) {
      const colors = [...new Set(stack.map((piece) => piece.color.toLowerCase()))];
      this.board[square] = `${colors.join("-")}-ludo-${stack.length}`;
    }
    for (const color of COLORS) {
      const finished = this.pieces.filter((piece) =>
        piece.color === color && piece.progress === 57
      ).length;
      if (finished > 0) {
        this.board[GOALS[color]] = `${color.toLowerCase()}-ludo-${finished}`;
      }
    }
  }

  getLayout() {
    const layout = {};
    for (const square of Object.keys(this.board)) {
      const { file, rank } = getCoordinates(square);
      const row = HEIGHT - rank;
      const inTop = row < 6;
      const inBottom = row > 8;
      const inLeft = file < 6;
      const inRight = file > 8;
      const yardColor = inTop && inLeft ? "red"
        : inTop && inRight ? "blue"
          : inBottom && inRight ? "yellow"
            : inBottom && inLeft ? "green" : null;
      let type = yardColor ? `yard-${yardColor}` : "empty";
      if (TRACK.includes(square)) {
        type = SAFE_SQUARES.has(square) ? "safe" : "track";
      }
      for (const color of COLORS) {
        if (HOME_LANES[color].includes(square)) {
          type = `lane-${color.toLowerCase()}`;
        }
      }
      if (Object.values(GOALS).includes(square)) {
        type = `goal-${Object.keys(GOALS).find((color) => GOALS[color] === square).toLowerCase()}`;
      }
      if (square === "h8") {
        type = "center";
      }
      layout[square] = type;
    }
    return layout;
  }

  snapshot() {
    return {
      turn: this.turn,
      currentRoll: this.currentRoll,
      lastRoll: this.lastRoll ? { ...this.lastRoll } : null,
      pieces: copyPieces(this.pieces),
      lastMove: this.lastMove ? { ...this.lastMove } : null
    };
  }

  restore(snapshot) {
    this.turn = snapshot.turn;
    this.currentRoll = snapshot.currentRoll;
    this.lastRoll = snapshot.lastRoll ? { ...snapshot.lastRoll } : null;
    this.pieces = copyPieces(snapshot.pieces);
    this.lastMove = snapshot.lastMove ? { ...snapshot.lastMove } : null;
    this.updateBoard();
  }

  roll(random = Math.random) {
    if (this.currentRoll !== null || this.getWinner()) {
      return null;
    }
    const value = Math.floor(random() * 6) + 1;
    const color = this.turn;
    this.currentRoll = value;
    this.lastRoll = { color, value, skipped: false };
    const hasMove = this.pieces.some((piece) =>
      piece.color === color && this.getDestination(piece, value) !== null
    );
    if (!hasMove) {
      this.currentRoll = null;
      this.lastRoll.skipped = true;
      if (value !== 6) {
        this.turn = getNextTurn(this.turn);
      }
    }
    return { ...this.lastRoll };
  }

  move(from, to) {
    if (!this.getLegalMoves(from).includes(to)) {
      return null;
    }
    const piece = this.pieces.find((candidate) =>
      candidate.color === this.turn &&
      this.getPosition(candidate) === from &&
      this.getDestination(candidate) === to
    );
    if (!piece) {
      return null;
    }

    const color = this.turn;
    const roll = this.currentRoll;
    this.history.push(this.snapshot());
    const oldProgress = piece.progress;
    piece.progress = oldProgress === -1 ? 0 : oldProgress + roll;
    const capturedPieces = piece.progress < 52
      ? this.pieces.filter((other) =>
        other.color !== color &&
        other.progress >= 0 &&
        other.progress < 52 &&
        this.getPosition(other) === to &&
        !SAFE_SQUARES.has(to)
      )
      : [];
    for (const captured of capturedPieces) {
      captured.progress = -1;
    }

    this.lastMove = {
      color,
      from,
      to,
      roll,
      capturedCount: capturedPieces.length,
      finished: piece.progress === 57
    };
    this.currentRoll = null;
    if (roll !== 6 || this.getWinner()) {
      this.turn = getNextTurn(this.turn);
    }
    this.updateBoard();
    return { ...this.lastMove };
  }

  undo() {
    const previousPosition = this.history.pop();
    if (!previousPosition) {
      return false;
    }
    this.restore(previousPosition);
    return true;
  }

  getWinner() {
    return COLORS.find((color) =>
      this.pieces.filter((piece) => piece.color === color && piece.progress === 57).length === 4
    ) || null;
  }
}

module.exports = {
  LudoGame,
  COLORS,
  WIDTH,
  HEIGHT,
  FILES,
  TRACK,
  HOME_LANES,
  YARDS,
  GOALS,
  SAFE_SQUARES,
  getCoordinates
};
