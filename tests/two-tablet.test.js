const test = require("node:test");
const assert = require("node:assert/strict");
const { CheckersGame } = require("../games/checkers");

test("checker selections can be continued on a different tablet", () => {
  const game = new CheckersGame();
  game.board = Object.fromEntries(
    Object.keys(game.board).map((square) => [square, null])
  );
  game.board.a5 = "White-man";
  game.board.j10 = "Black-man";
  const bottomTabletSquares = new Set(
    Object.keys(game.board).filter((square) => Number(square.slice(1)) <= 5)
  );
  const topTabletSquares = new Set(
    Object.keys(game.board).filter((square) => Number(square.slice(1)) > 5)
  );

  assert.ok(bottomTabletSquares.has("a5"));
  assert.ok(topTabletSquares.has("b6"));
  assert.equal(bottomTabletSquares.has("b6"), false);
  assert.equal(topTabletSquares.has("a5"), false);

  let selectedSquare = "a5";
  assert.ok(bottomTabletSquares.has(selectedSquare));
  assert.ok(topTabletSquares.has("b6"));

  const move = game.move(selectedSquare, "b6");
  assert.ok(move);
  assert.equal(game.board.a5, null);
  assert.equal(game.board.b6, "White-man");
  assert.equal(game.turn, "Black");
  selectedSquare = null;
  assert.equal(selectedSquare, null);
});

test("a multi-jump can continue on a different tablet without ending the turn", () => {
  const game = new CheckersGame();
  game.board = Object.fromEntries(
    Object.keys(game.board).map((square) => [square, null])
  );
  game.board.a3 = "White-man";
  game.board.b4 = "Black-man";
  game.board.d6 = "Black-man";

  const bottomTabletSquares = new Set(
    Object.keys(game.board).filter((square) => Number(square.slice(1)) <= 5)
  );
  const topTabletSquares = new Set(
    Object.keys(game.board).filter((square) => Number(square.slice(1)) > 5)
  );
  const firstStep = game.move("a3", "c5");

  assert.ok(bottomTabletSquares.has(firstStep.from));
  assert.ok(bottomTabletSquares.has(firstStep.to));
  assert.equal(firstStep.turnComplete, false);
  assert.equal(game.move("c5", "e7").turnComplete, true);
  assert.ok(topTabletSquares.has("e7"));
  assert.equal(game.turn, "Black");
});
