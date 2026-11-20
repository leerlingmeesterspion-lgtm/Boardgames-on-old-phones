const test = require("node:test");
const assert = require("node:assert/strict");
const {
  LudoGame,
  COLORS,
  WIDTH,
  HEIGHT,
  TRACK,
  HOME_LANES,
  SAFE_SQUARES
} = require("../games/ludo");

test("starts with four tokens for each player on a 15 by 15 board", () => {
  const game = new LudoGame();

  assert.equal(WIDTH, 15);
  assert.equal(HEIGHT, 15);
  assert.equal(Object.keys(game.board).length, WIDTH * HEIGHT);
  assert.deepEqual(COLORS.map((color) =>
    game.pieces.filter((piece) => piece.color === color).length
  ), [4, 4, 4, 4]);
  assert.equal(game.turn, "Red");
});

test("uses only the selected player colors and cycles through those players", () => {
  const game = new LudoGame(["Red", "Yellow"]);

  assert.deepEqual(game.activeColors, ["Red", "Yellow"]);
  assert.deepEqual([...new Set(game.pieces.map((piece) => piece.color))], ["Red", "Yellow"]);
  assert.equal(game.pieces.length, 8);
  assert.equal(game.roll(() => 0).skipped, true);
  assert.equal(game.turn, "Yellow");
});

test("requires two to four unique valid player colors", () => {
  assert.throws(() => new LudoGame(["Red"]), RangeError);
  assert.throws(() => new LudoGame(["Red", "Red"]), RangeError);
  assert.throws(() => new LudoGame(["Red", "Blue", "Yellow", "Green", "Red"]), RangeError);
  assert.throws(() => new LudoGame(["Red", "Purple"]), RangeError);
});

test("a six brings a token out and gives the player another turn", () => {
  const game = new LudoGame();

  assert.equal(game.roll(() => 0).value, 1);
  assert.equal(game.lastRoll.skipped, true);
  assert.equal(game.turn, "Blue");

  game.reset();
  assert.equal(game.roll(() => 5 / 6).value, 6);
  assert.deepEqual(game.getLegalMoves("c13"), ["b9"]);
  const move = game.move("c13", "b9");

  assert.equal(move.roll, 6);
  assert.equal(game.turn, "Red");
  assert.equal(game.pieces[0].progress, 0);
});

test("movement requires an exact roll to finish and undo restores the move", () => {
  const game = new LudoGame();
  const redPieces = game.pieces.filter((piece) => piece.color === "Red");
  game.pieces = [redPieces[0], ...game.pieces.filter((piece) => piece.color !== "Red")];
  redPieces[0].progress = 56;
  game.currentRoll = 2;
  assert.deepEqual(game.getLegalMoves(HOME_LANES.Red[4]), []);

  game.currentRoll = 1;
  assert.deepEqual(game.getLegalMoves(HOME_LANES.Red[4]), ["g8"]);
  game.move(HOME_LANES.Red[4], "g8");
  assert.equal(game.pieces[0].progress, 57);
  assert.equal(game.undo(), true);
  assert.equal(game.pieces[0].progress, 56);
});

test("captures opposing tokens on the track but not on safe squares", () => {
  const game = new LudoGame();
  let red = game.pieces.find((piece) => piece.color === "Red");
  let blue = game.pieces.find((piece) => piece.color === "Blue");
  const targetIndex = 1;
  red.progress = 0;
  blue.progress = (targetIndex - 13 + TRACK.length) % TRACK.length;
  game.pieces = [red, blue];
  game.turn = "Red";
  game.currentRoll = 1;

  assert.equal(game.move(TRACK[0], TRACK[targetIndex]).capturedCount, 1);
  assert.equal(blue.progress, -1);
  assert.equal(game.undo(), true);
  red = game.pieces.find((piece) => piece.color === "Red");
  blue = game.pieces.find((piece) => piece.color === "Blue");
  assert.equal(blue.progress, (targetIndex - 13 + TRACK.length) % TRACK.length);

  const safeIndex = 8;
  red.progress = safeIndex - 1;
  blue.progress = (safeIndex - 13 + TRACK.length) % TRACK.length;
  game.currentRoll = 1;
  assert.equal(SAFE_SQUARES.has(TRACK[safeIndex]), true);
  assert.equal(game.move(TRACK[safeIndex - 1], TRACK[safeIndex]).capturedCount, 0);
  assert.equal(blue.progress, (safeIndex - 13 + TRACK.length) % TRACK.length);
  assert.equal(game.board[TRACK[safeIndex]], "red-blue-ludo-2");
});

test("rolling six when there is no legal move lets the same player roll again", () => {
  const game = new LudoGame();
  for (const piece of game.pieces.filter((candidate) => candidate.color === "Red")) {
    piece.progress = 56;
  }
  game.turn = "Red";

  const result = game.roll(() => 5 / 6);

  assert.deepEqual(result, { color: "Red", value: 6, skipped: true });
  assert.equal(game.turn, "Red");
  assert.equal(game.currentRoll, null);
});

test("wins when all four tokens reach their exact finish", () => {
  const game = new LudoGame();
  for (const piece of game.pieces.filter((candidate) => candidate.color === "Red")) {
    piece.progress = 57;
  }
  game.updateBoard();

  assert.equal(game.getWinner(), "Red");
  assert.equal(game.board.g8, "red-ludo-4");
});
