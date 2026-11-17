const FILES = "abcdefghij";
const SIZE = 10;

function getCoordinates(square) {
  const match = /^([a-j])(10|[1-9])$/.exec(square);
  if (!match) {
    return null;
  }

  return {
    file: FILES.indexOf(match[1]),
    rank: Number(match[2])
  };
}

function getSquare(file, rank) {
  return `${FILES[file]}${rank}`;
}

function isPlayableSquare(file, rank) {
  return (file + rank) % 2 === 1;
}

function copyBoard(board) {
  return { ...board };
}

function getColor(piece) {
  return piece ? piece.split("-")[0] : null;
}

function isKing(piece) {
  return piece && piece.endsWith("-king");
}

function getDirections(piece) {
  if (isKing(piece)) {
    return [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  }

  const forward = getColor(piece) === "White" ? 1 : -1;
  return [[-1, forward], [1, forward], [-1, -forward], [1, -forward]];
}

function applyStep(board, step, piece) {
  const nextBoard = copyBoard(board);
  nextBoard[step.from] = null;
  nextBoard[step.to] = piece;
  return nextBoard;
}

function getCaptureSteps(board, square, piece, capturedSquares) {
  const position = getCoordinates(square);
  const captures = [];

  for (const [fileDirection, rankDirection] of getDirections(piece)) {
    let file = position.file + fileDirection;
    let rank = position.rank + rankDirection;

    if (!isKing(piece)) {
      if (file < 0 || file >= SIZE || rank < 1 || rank > SIZE) {
        continue;
      }

      const jumpedSquare = getSquare(file, rank);
      const landingFile = file + fileDirection;
      const landingRank = rank + rankDirection;
      const landingSquare = getSquare(landingFile, landingRank);
      if (
        getColor(board[jumpedSquare]) &&
        getColor(board[jumpedSquare]) !== getColor(piece) &&
        !capturedSquares.has(jumpedSquare) &&
        landingFile >= 0 &&
        landingFile < SIZE &&
        landingRank >= 1 &&
        landingRank <= SIZE &&
        !board[landingSquare]
      ) {
        captures.push({ from: square, to: landingSquare, capturedSquare: jumpedSquare });
      }
      continue;
    }

    while (file >= 0 && file < SIZE && rank >= 1 && rank <= SIZE) {
      const currentSquare = getSquare(file, rank);
      if (board[currentSquare]) {
        if (capturedSquares.has(currentSquare)) {
          break;
        }
        if (getColor(board[currentSquare]) === getColor(piece)) {
          break;
        }

        const capturedSquare = currentSquare;
        file += fileDirection;
        rank += rankDirection;
        while (file >= 0 && file < SIZE && rank >= 1 && rank <= SIZE) {
          const landingSquare = getSquare(file, rank);
          if (board[landingSquare]) {
            break;
          }
          captures.push({ from: square, to: landingSquare, capturedSquare });
          file += fileDirection;
          rank += rankDirection;
        }
        break;
      }
      file += fileDirection;
      rank += rankDirection;
    }
  }

  return captures;
}

function getCaptureSequences(board, square, piece, path = [], capturedSquares = new Set()) {
  const steps = getCaptureSteps(board, square, piece, capturedSquares);
  if (steps.length === 0) {
    return path.length > 0 ? [path] : [];
  }

  const sequences = [];
  for (const step of steps) {
    const nextPath = [...path, step];
    const nextBoard = applyStep(board, step, piece);
    const nextCapturedSquares = new Set(capturedSquares);
    nextCapturedSquares.add(step.capturedSquare);
    const destination = getCoordinates(step.to);
    const reachesKingRow =
      !isKing(piece) &&
      ((getColor(piece) === "White" && destination.rank === SIZE) ||
        (getColor(piece) === "Black" && destination.rank === 1));

    if (reachesKingRow) {
      sequences.push(nextPath);
    } else {
      sequences.push(...getCaptureSequences(nextBoard, step.to, piece, nextPath, nextCapturedSquares));
    }
  }

  return sequences;
}

function getQuietSteps(board, square, piece) {
  const position = getCoordinates(square);
  const steps = [];

  if (isKing(piece)) {
    for (const [fileDirection, rankDirection] of getDirections(piece)) {
      let file = position.file + fileDirection;
      let rank = position.rank + rankDirection;
      while (file >= 0 && file < SIZE && rank >= 1 && rank <= SIZE) {
        const destination = getSquare(file, rank);
        if (board[destination]) {
          break;
        }
        steps.push({ from: square, to: destination, capturedSquare: null });
        file += fileDirection;
        rank += rankDirection;
      }
    }
    return steps;
  }

  for (const [fileDirection, rankDirection] of getDirections(piece).slice(0, 2)) {
    const file = position.file + fileDirection;
    const rank = position.rank + rankDirection;
    if (file >= 0 && file < SIZE && rank >= 1 && rank <= SIZE) {
      const destination = getSquare(file, rank);
      if (!board[destination]) {
        steps.push({ from: square, to: destination, capturedSquare: null });
      }
    }
  }

  return steps;
}

function uniqueSteps(steps) {
  const found = new Set();
  return steps.filter((step) => {
    const key = `${step.from}:${step.to}:${step.capturedSquare}`;
    if (found.has(key)) {
      return false;
    }
    found.add(key);
    return true;
  });
}

class CheckersGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = {};
    for (let rank = 1; rank <= SIZE; rank++) {
      for (let file = 0; file < SIZE; file++) {
        const square = getSquare(file, rank);
        this.board[square] = null;
        if (!isPlayableSquare(file, rank)) {
          continue;
        }
        if (rank <= 4) {
          this.board[square] = "White-man";
        } else if (rank >= 7) {
          this.board[square] = "Black-man";
        }
      }
    }
    this.turn = "White";
    this.history = [];
    this.captureOptions = null;
    this.capturedSquares = [];
  }

  getLegalSteps() {
    if (this.captureOptions) {
      return uniqueSteps(this.captureOptions.map((sequence) => sequence[0]));
    }

    const captures = [];
    for (const [square, piece] of Object.entries(this.board)) {
      if (getColor(piece) === this.turn) {
        captures.push(...getCaptureSequences(this.board, square, piece));
      }
    }

    if (captures.length > 0) {
      const longestCapture = Math.max(...captures.map((sequence) => sequence.length));
      return uniqueSteps(
        captures
          .filter((sequence) => sequence.length === longestCapture)
          .map((sequence) => sequence[0])
      );
    }

    const quietSteps = [];
    for (const [square, piece] of Object.entries(this.board)) {
      if (getColor(piece) === this.turn) {
        quietSteps.push(...getQuietSteps(this.board, square, piece));
      }
    }
    return quietSteps;
  }

  move(from, to) {
    const step = this.getLegalSteps().find((move) => move.from === from && move.to === to);
    if (!step) {
      return null;
    }

    const startsTurn = this.captureOptions === null;
    let matchingSequences = [];
    if (step.capturedSquare) {
      matchingSequences = this.captureOptions || getCaptureSequences(this.board, from, this.board[from]);
      const longestCapture = Math.max(...matchingSequences.map((sequence) => sequence.length));
      matchingSequences = matchingSequences
        .filter((sequence) => sequence.length === longestCapture)
        .filter((sequence) => sequence[0].from === from && sequence[0].to === to);
    }

    if (startsTurn) {
      this.history.push({
        board: copyBoard(this.board),
        turn: this.turn
      });
    }

    const piece = this.board[from];
    const capturedPiece = step.capturedSquare ? this.board[step.capturedSquare] : null;
    this.board[from] = null;

    const destination = getCoordinates(to);
    const promotes =
      !isKing(piece) &&
      ((getColor(piece) === "White" && destination.rank === SIZE) ||
        (getColor(piece) === "Black" && destination.rank === 1));
    this.board[to] = promotes ? `${getColor(piece)}-king` : piece;
    if (step.capturedSquare) {
      this.capturedSquares.push(step.capturedSquare);
    }

    if (step.capturedSquare && !promotes) {
      const remainingSequences = matchingSequences
        .map((sequence) => sequence.slice(1))
        .filter((sequence) => sequence.length > 0);
      this.captureOptions = remainingSequences.length > 0 ? remainingSequences : null;
    } else {
      this.captureOptions = null;
    }

    const turnComplete = this.captureOptions === null;
    if (turnComplete) {
      this.capturedSquares.forEach((capturedSquare) => {
        this.board[capturedSquare] = null;
      });
      this.capturedSquares = [];
      this.turn = this.turn === "White" ? "Black" : "White";
    }

    return {
      ...step,
      piece,
      capturedPiece,
      promoted: promotes,
      turnComplete
    };
  }

  undo() {
    const previousPosition = this.history.pop();
    if (!previousPosition) {
      return false;
    }

    this.board = previousPosition.board;
    this.turn = previousPosition.turn;
    this.captureOptions = null;
    this.capturedSquares = [];
    return true;
  }

  getWinner() {
    const opponent = this.turn;
    const opponentHasPieces = Object.values(this.board)
      .some((piece) => getColor(piece) === opponent);
    if (!opponentHasPieces || this.getLegalSteps().length === 0) {
      return opponent === "White" ? "Black" : "White";
    }
    return null;
  }
}

module.exports = { CheckersGame, SIZE, FILES, getCoordinates, isPlayableSquare };
