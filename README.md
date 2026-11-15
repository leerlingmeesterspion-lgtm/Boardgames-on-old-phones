# Modular Chess

A chess game where old Android phones are used as individual parts of a physical chessboard.

## Idea

- Windows 11 laptop = master

- Android phones = chessboard displays

- Node.js web server

- Socket.IO communication

- Web browser clients

## First goal

Display a message from a small Express server in a web browser.

## Run the server on Windows

1. Install the current LTS version of Node.js from [nodejs.org](https://nodejs.org/). Then open a new PowerShell window and go to this project folder:

   ```powershell
   cd "C:\Users\Sander Theeuwes\Documents\Chess op telefoon\Chess"
   ```

2. Install Express, the web-server library used by this project:

   ```powershell
   npm install
   ```

3. Start the server:

   ```powershell
   npm start
   ```

4. Open `http://localhost:3000` in a browser. The page should say `Modular Chess Server is running!`. Leave PowerShell open while the server is running; press `Ctrl+C` there to stop it.

## How the server works

- `server.js` creates an Express app and listens on port `3000`.
- `app.get("/")` tells Express what to send when the browser visits the home page (`/`).
- `response.send(...)` sends the message to the browser.
- `package.json` lists Express as a dependency and defines `npm start` as a shortcut for `node server.js`.
