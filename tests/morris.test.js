const test = require("node:test");
const assert = require("node:assert/strict");
const { MorrisGame, points, neighbors } = require("../games/morris");

test("starts with 24 empty points and nine pieces for each player to place", () => {
  const game = new MorrisGame();

  assert.equal(points.length, 24);
  assert.equal(Object.keys(game.board).length, 24);
  assert.ok(Object.values(game.board).every((piece) => piece === null));
  assert.deepEqual(game.placed, { White: 0, Black: 0 });
  assert.equal(game.phase, "placing");
});

test("forming a mill requires a capture and undo restores the entire turn", () => {
  const game = new MorrisGame();
  game.board.a1 = "White-stone";
  game.board.g1 = "White-stone";
  game.board.b2 = "Black-stone";
  game.placed.White = 2;
  game.placed.Black = 1;

  const move = game.place("d1");
  assert.equal(move.captureRequired, true);
  assert.equal(game.turn, "White");
  assert.deepEqual(game.getCapturablePoints(), ["b2"]);
  assert.equal(game.capture("b2").turnComplete, true);
  assert.equal(game.board.b2, null);
  assert.equal(game.turn, "Black");
  assert.equal(game.undo(), true);
  assert.equal(game.board.d1, null);
  assert.equal(game.board.b2, "Black-stone");
  assert.equal(game.placed.White, 2);
  assert.equal(game.turn, "White");
});

test("cannot capture a piece in a mill unless all opponent pieces are in mills", () => {
  const game = new MorrisGame();
  game.turn = "White";
  game.pendingCapture = true;
  game.board.a1 = "Black-stone";
  game.board.d1 = "Black-stone";
  game.board.g1 = "Black-stone";
  game.board.b2 = "Black-stone";
  game.board.c3 = "Black-stone";
  game.board.c4 = "Black-stone";
  assert.deepEqual(game.getCapturablePoints(), ["b2", "c3", "c4"]);

  game.board.b2 = null;
  game.board.c3 = null;
  game.board.c4 = null;
  assert.deepEqual(game.getCapturablePoints(), ["a1", "d1", "g1"]);
});

test("moves along connected points and lets a three-piece player fly", () => {
  const game = new MorrisGame();
  game.phase = "moving";
  game.turn = "White";
  game.board.a1 = "White-stone";
  game.board.g1 = "White-stone";
  game.board.d3 = "White-stone";
  game.board.c5 = "White-stone";
  game.board.b2 = "Black-stone";
  game.board.d2 = "Black-stone";
  game.board.f2 = "Black-stone";
  game.board.a4 = "Black-stone";

  assert.ok(neighbors.get("a1").has("d1"));
  assert.deepEqual(game.getLegalMoves("a1"), ["d1"]);
  assert.equal(game.move("a1", "g7"), null);

  game.board.d3 = null;
  const move = game.move("a1", "j3");
  assert.equal(move, null);
  assert.equal(game.move("a1", "g4").to, "g4");
});

test("an opponent with fewer than three pieces or no legal move loses", () => {
  const game = new MorrisGame();
  game.phase = "moving";
  game.turn = "Black";
  game.board.a1 = "White-stone";
  game.board.d1 = "White-stone";
  game.board.g1 = "White-stone";
  game.board.b2 = "Black-stone";
  game.board.d2 = "Black-stone";
  assert.equal(game.getWinner(), "White");

  game.board.f2 = "Black-stone";
  assert.equal(game.getWinner(), null);
  for (const point of points) {
    if (point !== "b2" && point !== "d2" && point !== "f2") {
      game.board[point] = "White-stone";
    }
  }
  assert.equal(game.getWinner(), "White");
});

test("forming a mill on a move gives the same player a capture before the turn changes", () => {
  const game = new MorrisGame();
  game.phase = "moving";
  game.turn = "White";
  game.board.a1 = "White-stone";
  game.board.g1 = "White-stone";
  game.board.d2 = "White-stone";
  game.board.b2 = "Black-stone";
  game.board.f2 = "Black-stone";
  game.board.a7 = "Black-stone";

  const move = game.move("d2", "d1");
  assert.equal(move.captureRequired, true);
  assert.equal(game.turn, "White");
  assert.equal(game.capture("a7").capturedPoint, "a7");
  assert.equal(game.turn, "Black");
  assert.equal(game.board.a7, null);
});
