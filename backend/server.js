import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

const PORT = Number(process.env.PORT) || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";
const SOCKET_PING_TIMEOUT = Number(process.env.SOCKET_PING_TIMEOUT) || 60000;
const SOCKET_PING_INTERVAL = Number(process.env.SOCKET_PING_INTERVAL) || 25000;

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));

// Phục vụ frontend build (backend/public)
app.use(express.static(path.join(__dirname, "public")));
// SPA fallback: route không phải file → index.html (bỏ qua /socket.io)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/socket.io")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN },
  pingTimeout: SOCKET_PING_TIMEOUT,
  pingInterval: SOCKET_PING_INTERVAL,
});

// Lưu room: { roomId: { type: 'public'|'private', passwordHash: string|null, socketIds: Set } }
const rooms = new Map();

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join-room", (roomId, userName, options = {}) => {
    if (!roomId?.trim()) return;
    const rid = roomId.trim().toLowerCase();
    const type = options.type === "private" ? "private" : "public";
    const password = options.password ? String(options.password).trim() : "";

    let room = rooms.get(rid);

    if (!room) {
      if (type === "private" && !password) {
        socket.emit("join-error", {
          code: "password-required",
          message: "Phòng riêng tư cần đặt mật khẩu.",
        });
        return;
      }
      const passwordHash =
        type === "private" && password ? hashPassword(password) : null;
      room = {
        type,
        passwordHash,
        socketIds: new Set(),
      };
      rooms.set(rid, room);
    } else {
      if (room.type === "private") {
        if (!password) {
          socket.emit("join-error", {
            code: "password-required",
            message: "Phòng riêng tư. Vui lòng nhập mật khẩu.",
          });
          return;
        }
        const inputHash = hashPassword(password);
        if (inputHash !== room.passwordHash) {
          socket.emit("join-error", {
            code: "wrong-password",
            message: "Sai mật khẩu phòng.",
          });
          return;
        }
      }
    }

    socket.join(rid);
    socket.roomId = rid;
    socket.userName = userName || "User";
    room.socketIds.add(socket.id);

    const peers = Array.from(io.sockets.adapter.rooms.get(rid) || [])
      .filter((id) => id !== socket.id)
      .map((id) => {
        const s = io.sockets.sockets.get(id);
        return { id, userName: s?.userName || "User" };
      });

    socket.emit("room-joined", { roomId: rid, peers });
    socket
      .to(rid)
      .emit("user-joined", { id: socket.id, userName: socket.userName });
  });

  socket.on("offer", ({ to, offer }) => {
    io.to(to).emit("offer", {
      from: socket.id,
      userName: socket.userName,
      offer,
    });
  });

  socket.on("answer", ({ to, answer }) => {
    io.to(to).emit("answer", { from: socket.id, answer });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("ice-candidate", { from: socket.id, candidate });
  });

  socket.on("leave-room", () => {
    const rid = socket.roomId;
    if (rid) {
      socket.to(rid).emit("user-left", { id: socket.id });
      const room = rooms.get(rid);
      if (room) {
        room.socketIds.delete(socket.id);
        if (room.socketIds.size === 0) rooms.delete(rid);
      }
      socket.leave(rid);
      socket.roomId = null;
    }
  });

  socket.on("reaction", (emoji) => {
    const rid = socket.roomId;
    if (!rid || typeof emoji !== "string") return;
    io.to(rid).emit("reaction", {
      from: socket.id,
      userName: socket.userName || "User",
      emoji: emoji.trim().slice(0, 8),
    });
  });

  socket.on("mic-state", (muted) => {
    const rid = socket.roomId;
    if (!rid) return;
    io.to(rid).emit("mic-state", {
      from: socket.id,
      userName: socket.userName || "User",
      muted: !!muted,
    });
  });

  socket.on("disconnect", () => {
    const rid = socket.roomId;
    if (rid) {
      socket.to(rid).emit("user-left", { id: socket.id });
      const room = rooms.get(rid);
      if (room) {
        room.socketIds.delete(socket.id);
        if (room.socketIds.size === 0) rooms.delete(rid);
      }
    }
    console.log("Client disconnected:", socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Signaling server running at http://localhost:${PORT}`);
});
