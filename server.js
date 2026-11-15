const express = require("express");
const http = require("node:http");
const path = require("node:path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = 3000;
const devices = new Map();

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
  if (!Array.isArray(squares) || squares.length > 64) {
    return false;
  }

  const validSquare = /^[a-h][1-8]$/;
  const uniqueSquares = new Set(squares);

  return uniqueSquares.size === squares.length &&
    squares.every((square) => typeof square === "string" && validSquare.test(square));
}

function broadcastDeviceNames() {
  io.emit("devices-update", getConnectedDevices());
}

app.use(express.static(path.join(__dirname, "public")));

app.get("/admin", (request, response) => {
  response.sendFile(path.join(__dirname, "public", "admin.html"));
});

io.on("connection", (socket) => {
  socket.emit("devices-update", getConnectedDevices());

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

  socket.on("disconnect", () => {
    const deviceName = socket.data.deviceName;
    const device = deviceName ? devices.get(deviceName) : undefined;
    if (device && device.socketId === socket.id) {
      device.socketId = null;
      console.log(`${deviceName} disconnected`);
      broadcastDeviceNames();
    }
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
