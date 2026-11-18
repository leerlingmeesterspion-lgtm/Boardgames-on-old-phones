(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MorrisLayout = factory();
  }
}(typeof globalThis === "undefined" ? this : globalThis, function () {
  const points = [
    "a1", "d1", "g1", "b2", "d2", "f2", "c3", "d3", "e3",
    "a4", "b4", "c4", "e4", "f4", "g4", "c5", "d5", "e5",
    "b6", "d6", "f6", "a7", "d7", "g7"
  ];

  const mills = [
    ["a1", "d1", "g1"], ["b2", "d2", "f2"], ["c3", "d3", "e3"],
    ["a4", "b4", "c4"], ["e4", "f4", "g4"], ["c5", "d5", "e5"],
    ["b6", "d6", "f6"], ["a7", "d7", "g7"],
    ["a1", "a4", "a7"], ["b2", "b4", "b6"], ["c3", "c4", "c5"],
    ["d1", "d2", "d3"], ["d5", "d6", "d7"], ["e3", "e4", "e5"],
    ["f2", "f4", "f6"], ["g1", "g4", "g7"]
  ];

  const edges = [];
  for (const mill of mills) {
    edges.push([mill[0], mill[1]], [mill[1], mill[2]]);
  }

  return {
    points,
    mills,
    edges,
    pointSet: new Set(points)
  };
}));
