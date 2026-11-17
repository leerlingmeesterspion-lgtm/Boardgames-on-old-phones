const test = require("node:test");
const assert = require("node:assert/strict");
const { CheckersGame, SIZE, getCoordinates } = require("../games/checkers");

test("starts with 20 men per side on a 10 by 10 board", () => {
  const game = new CheckersGame();
  const pieces = Object.values(game.board);

  assert.equal(Object.keys(game.board).length, SIZE * SIZE);
  assert.equal(pieces.filter((piece) => piece === "White-man").length, 20);
  assert.equal(pieces.filter((piece) => piece === "Black-man").length, 20);
  assert.equal(game.getLegalSteps().length, 9);
});

test("moves a man forward and undoes the completed move", () => {
  const game = new CheckersGame();

  assert.equal(game.move("b4", "a5").turnComplete, true);
  assert.equal(game.board.b4, null);
  assert.equal(game.board.a5, "White-man");
  assert.equal(game.turn, "Black");
  assert.equal(game.undo(), true);
  assert.equal(game.board.b4, "White-man");
  assert.equal(game.turn, "White");
});

test("requires a capture and completes a multi-jump as one turn", () => {
  const game = new CheckersGame();
  game.board = Object.fromEntries(
    Object.keys(game.board).map((square) => [square, null])
  );
  game.board.a3 = "White-man";
  game.board.b4 = "Black-man";
  game.board.d6 = "Black-man";
  game.board.j10 = "Black-man";

  assert.deepEqual(game.getLegalSteps().map((step) => [step.from, step.to]), [["a3", "c5"]]);
  assert.equal(game.move("g3", "f4"), null);
  assert.equal(game.move("a3", "c5").turnComplete, false);
  assert.equal(game.board.b4, "Black-man");
  assert.equal(game.turn, "White");
  assert.deepEqual(game.getLegalSteps().map((step) => [step.from, step.to]), [["c5", "e7"]]);
  assert.equal(game.move("c5", "e7").turnComplete, true);
  assert.equal(game.turn, "Black");
  assert.equal(game.board.b4, null);
  assert.equal(game.board.d6, null);
  assert.equal(game.undo(), true);
  assert.equal(game.board.a3, "White-man");
  assert.equal(game.board.b4, "Black-man");
  assert.equal(game.board.d6, "Black-man");
  assert.equal(game.turn, "White");
});

test("returns the longest available capture sequence and promotes at the far edge", () => {
  const game = new CheckersGame();
  game.board = Object.fromEntries(
    Object.keys(game.board).map((square) => [square, null])
  );
  game.board.a3 = "White-man";
  game.board.b4 = "Black-man";
  game.board.d6 = "Black-man";
  game.board.g3 = "White-man";
  game.board.h4 = "Black-man";

  assert.deepEqual(game.getLegalSteps().map((step) => [step.from, step.to]), [["a3", "c5"]]);
  assert.equal(game.move("a3", "c5").turnComplete, false);
  assert.equal(game.move("c5", "e7").turnComplete, true);
  assert.equal(game.turn, "Black");

  game.reset();
  game.board = Object.fromEntries(
    Object.keys(game.board).map((square) => [square, null])
  );
  game.board.h8 = "White-man";
  game.board.i9 = "Black-man";
  assert.equal(game.move("h8", "j10").promoted, true);
  assert.equal(game.board.j10, "White-king");
  assert.equal(game.turn, "Black");
  assert.equal(getCoordinates("j10").rank, 10);
});

test("a flying king can capture a piece and land on any empty square beyond it", () => {
  const game = new CheckersGame();
  game.board = Object.fromEntries(
    Object.keys(game.board).map((square) => [square, null])
  );
  game.board.a1 = "White-king";
  game.board.d4 = "Black-man";

  assert.deepEqual(
    game.getLegalSteps().map((step) => [step.from, step.to, step.capturedSquare]),
    [
      ["a1", "e5", "d4"],
      ["a1", "f6", "d4"],
      ["a1", "g7", "d4"],
      ["a1", "h8", "d4"],
      ["a1", "i9", "d4"],
      ["a1", "j10", "d4"]
    ]
  );
});

test("wins when the other player has no pieces or legal moves", () => {
  const game = new CheckersGame();
  game.board = Object.fromEntries(
    Object.keys(game.board).map((square) => [square, null])
  );
  game.turn = "Black";
  game.board.a3 = "White-man";
  assert.equal(game.getWinner(), "White");

  game.board.a1 = "Black-man";
  assert.equal(game.getWinner(), "White");
});
