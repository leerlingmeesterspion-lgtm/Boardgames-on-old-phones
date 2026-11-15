const express = require("express");
const http = require("node:http");
const path = require("node:path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = 3000;
const devices = new Map();

function getDevices() {
  return Array.from(devices, ([id, name]) => ({ id, name }));
}

function broadcastDeviceNames() {
  io.emit("devices-update", getDevices());
}

app.use(express.static(path.join(__dirname, "public")));

app.get("/admin", (request, response) => {
  response.sendFile(path.join(__dirname, "public", "admin.html"));
});

io.on("connection", (socket) => {
  socket.emit("devices-update", getDevices());

  socket.on("register-device", (deviceName) => {
    if (typeof deviceName !== "string" || !/^[A-Z]{2,10}-[A-Z]{2,10}-\d{2}$/.test(deviceName)) {
      console.warn(`Ignored invalid device name from ${socket.id}`);
      return;
    }

    devices.set(socket.id, deviceName);
    console.log(`${deviceName} connected`);
    broadcastDeviceNames();
  });

  socket.on("identify-device", (deviceId) => {
    if (typeof deviceId !== "string" || !devices.has(deviceId)) {
      console.warn(`Ignored identify request for unknown device from ${socket.id}`);
      return;
    }

    io.to(deviceId).emit("identify");
  });

  socket.on("disconnect", () => {
    const deviceName = devices.get(socket.id);
    if (devices.delete(socket.id)) {
      console.log(`${deviceName} disconnected`);
      broadcastDeviceNames();
    }
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
