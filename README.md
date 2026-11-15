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

2. Install the project dependencies:

   ```powershell
   npm.cmd install
   ```

3. Start the server:

   ```powershell
   npm.cmd start
   ```

4. Open `http://localhost:3000` in a browser. Leave PowerShell open while the server is running; press `Ctrl+C` there to stop it.

## How the server works

- `server.js` creates an Express app and listens on port `3000`.
- Express serves the browser page from `public/index.html`.
- `package.json` lists the dependencies and defines `npm start` as a shortcut for `node server.js`.

## Detect a connected phone

Socket.IO lets the webpage keep a real-time connection to the server. It is installed in this project already. To install it yourself in a fresh copy, run:

```powershell
npm.cmd install socket.io
```

Then start the server with `npm.cmd start`. Open the page on your laptop or phone. On your phone, use the laptop's local network address (for example, `http://192.168.1.20:3000`), not `localhost`.

When a browser connects, the PowerShell window should show:

```text
Server running on port 3000
BLUE-FOX-27 connected
```

The `http` server serves the page and is also passed to Socket.IO. The browser loads Socket.IO's client script and calls `io()` to connect.

## Give each browser a friendly name

The page looks for a name in the browser's `localStorage` using the key `modular-chess-device-name`. If it does not find one, it picks a color, an animal, and a two-digit number, then saves that name. On every Socket.IO connection, the browser sends the saved name with the `register-device` event. The server checks its format and prints it.

`localStorage` is a small key-and-value store kept by the browser for this website. It survives refreshes and browser restarts, so the phone reuses its name. It is local to that browser on that phone; another phone gets its own name. Clearing the browser's site data (or using private browsing) can remove it and cause a new name to be generated.

The Socket.IO `socket.id` is a separate, temporary connection ID. It can change after a reconnect, so the page uses the saved friendly name when it needs an identity that lasts across refreshes. The name is only a label, not a password or proof of identity, and two random names could match by chance.

## View connected devices on the admin page

Start the server and open `http://localhost:3000/admin` on the laptop. The page shows the friendly names of registered board devices and changes without a refresh when one connects or disconnects.

The server keeps a `Map` from each Socket.IO connection ID to its friendly device name. When a device registers or disconnects, the server sends the current names to every connected browser with `io.emit("devices-update", names)`. When the admin page first connects, the server sends it the current list with `socket.emit`, so it does not have to wait for the next change.

This list is kept in server memory, so it starts empty after the server restarts. Connected phones reconnect and register again automatically.

## Identify one board device

Each device row on `/admin` has an **Identify** button. Clicking it sends that device's Socket.IO connection ID to the server. The server uses `io.to(deviceId).emit("identify")` to send the event only to that phone. Its page shows the friendly name in large letters and flashes its background for five seconds.

This is different from `io.emit(...)`, which broadcasts an event to every connected browser. The admin list includes connection IDs so the server can target one connection even if two devices happen to have the same friendly name.

## Assign chessboard squares

Each connected device has an 8-by-8 square picker on `/admin`. Select squares such as A1 and A2, then click **Save**. The server validates and keeps the selected square names in memory. It sends `squares-update` only to that device, and the phone draws a rectangle for each assigned square. The phone keeps the squares in their correct relative chessboard positions, centers them, and sizes them to fit its available screen space. A device assigned only squares on ranks 7 and 8 sees those squares flipped to face the black side; other assignments keep the white-side orientation. Pieces use solid black or white silhouettes with contrasting outlines. The layout adjusts when the screen is resized or rotated.

The square configuration stays in server memory if a phone disconnects and reconnects with the same friendly name. It is lost when the server restarts; there is no database yet.

## Keep a phone screen awake

The phone page requests a browser screen wake lock automatically and requests it again when you return to the page. Use **Allow screen to sleep** to release it, or **Keep screen awake** to request it again. The lock only applies while the page is visible.

Screen wake locks require browser support and a secure context. When opening the page from another device on the local network, that means serving it over HTTPS; plain HTTP and older browsers may not support the feature. The page reports when it cannot request a lock. For reliable use over HTTP:

- On Android, open **Settings > Display > Screen timeout** (the menu name can vary) and select the longest available timeout. To keep it awake only while plugged in, enable **Developer options > Stay awake**.
- On iPadOS 17, open **Settings > Display & Brightness > Auto-Lock** and select **Never**. If **Never** is unavailable, check whether Low Power Mode or a device-management restriction is enabled.

Browser and iOS support varies by device and version, so a website cannot override these settings on every device.

## Move the first piece between phones

The server starts with the standard chess position across all 64 squares. To try a cross-phone move, assign E2 to one connected phone and E4 to another in `/admin`, then tap the pawn on E2 and tap E4 on the other phone.

The server asks `chess.js` whether a move is legal before changing its authoritative game state. `chess.js` also enforces whose turn it is and removes a captured piece from the board. The phones and `/admin` show whose turn is next and describe the last move, including a capture.

The **Revert last move** button on `/admin` uses `chess.js` to undo one move. It restores captured pieces and gives the turn back to the player who made the undone move. The button is disabled when there are no moves to undo.

When `chess.js` detects checkmate, `/admin` and all connected phone/tablet pages show a large winner message. Reverting the checkmating move removes that message.

To try a capture, assign E2 and E4 to one phone, and D7 and D5 to another. Move E2 to E4, D7 to D5, then E4 to D5. The black pawn should disappear, and the pages should report that White captured it. Socket.IO carries the messages, the server manages device assignments and displays, and `chess.js` supplies the chess rules. Board state and square assignments are in memory and reset when the server restarts.
