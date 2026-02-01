import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { io } from "socket.io-client";

const ROOM_HISTORY_KEY = "voice-call-room-history";
const ROOM_HISTORY_MAX = 10;
const SESSION_ROOM_KEY = "voice-call-current-room";

export const useCallStore = defineStore("call", () => {
  const socket = ref(null);
  const roomId = ref("");
  const userName = ref("");
  const isConnected = ref(false);
  const isReconnecting = ref(false);
  const peers = ref([]);
  const localStream = ref(null);
  const remoteStreams = ref({}); // { peerId: MediaStream }

  /** Lưu options lần join thành công để tự join lại khi reconnect */
  const lastJoinOptions = ref({ type: "public", password: undefined });

  const hasPeers = computed(() => peers.value.length > 0);
  const peerCount = computed(() => peers.value.length);

  function connect(serverUrl) {
    if (socket.value?.connected) return socket.value;
    const envUrl = import.meta.env.VITE_SOCKET_URL;
    const url =
      serverUrl ??
      (envUrl && String(envUrl).trim() ? String(envUrl).trim() : null) ??
      (typeof window !== "undefined" ? window.location.origin : null);
    const opts = {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
    };
    socket.value = url ? io(url, opts) : io(opts);
    socket.value.on("connect", () => {
      isConnected.value = true;
      if (!roomId.value) isReconnecting.value = false;
    });
    socket.value.on("disconnect", () => {
      isConnected.value = false;
      if (roomId.value) isReconnecting.value = true;
    });
    return socket.value;
  }

  function joinRoom(rid, name, options = {}) {
    roomId.value = (rid || "").trim().toLowerCase();
    userName.value = (name || "User").trim() || "User";
    if (!roomId.value)
      return Promise.reject(new Error("Vui lòng nhập mã phòng"));
    connect();
    return new Promise((resolve, reject) => {
      const onError = (err) => {
        reject(new Error(err?.message || "Không thể vào phòng"));
      };
      socket.value.once("join-error", onError);
      socket.value.emit("join-room", roomId.value, userName.value, {
        type: options.type === "private" ? "private" : "public",
        password: options.password
          ? String(options.password).trim()
          : undefined,
      });
      socket.value.once("room-joined", (data) => {
        socket.value.off("join-error", onError);
        peers.value = data.peers || [];
        lastJoinOptions.value = {
          type: options.type === "private" ? "private" : "public",
          password: options.password
            ? String(options.password).trim()
            : undefined,
        };
        addRoomToHistory(roomId.value, lastJoinOptions.value.type);
        saveSessionRoom();
        resolve(data);
      });
      socket.value.once("connect_error", (e) => {
        socket.value.off("join-error", onError);
        reject(e);
      });
    });
  }

  function leaveRoom() {
    if (socket.value) {
      socket.value.emit("leave-room");
    }
    roomId.value = "";
    userName.value = "";
    peers.value = [];
    remoteStreams.value = {};
    isReconnecting.value = false;
    lastJoinOptions.value = { type: "public", password: undefined };
    clearSessionRoom();
    if (localStream.value) {
      localStream.value.getTracks().forEach((t) => t.stop());
      localStream.value = null;
    }
  }

  function saveSessionRoom() {
    if (typeof window === "undefined" || !roomId.value) return;
    try {
      const data = {
        roomId: roomId.value,
        userName: userName.value,
        type: lastJoinOptions.value?.type || "public",
        password: lastJoinOptions.value?.password,
      };
      sessionStorage.setItem(SESSION_ROOM_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function getSessionRoom() {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(SESSION_ROOM_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function clearSessionRoom() {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.removeItem(SESSION_ROOM_KEY);
    } catch (_) {}
  }

  /** Khôi phục từ sessionStorage và join lại phòng (sau reload). */
  function restoreAndRejoin(routeRoomId) {
    const rid = (routeRoomId || "").trim().toLowerCase();
    if (!rid) return Promise.reject(new Error("Không có mã phòng"));
    const saved = getSessionRoom();
    if (!saved || (saved.roomId || "").toLowerCase() !== rid) {
      return Promise.reject(new Error("Không tìm thấy phiên phòng"));
    }
    roomId.value = rid;
    userName.value = saved.userName || "User";
    lastJoinOptions.value = {
      type: saved.type === "private" ? "private" : "public",
      password: saved.password,
    };
    connect();
    return new Promise((resolve, reject) => {
      const onError = (err) => {
        reject(new Error(err?.message || "Không thể vào lại phòng"));
      };
      socket.value.once("join-error", onError);
      socket.value.emit("join-room", roomId.value, userName.value, {
        type: lastJoinOptions.value.type,
        password: lastJoinOptions.value.password,
      });
      socket.value.once("room-joined", (data) => {
        socket.value.off("join-error", onError);
        peers.value = data.peers || [];
        saveSessionRoom();
        resolve(data);
      });
      socket.value.once("connect_error", (e) => {
        socket.value.off("join-error", onError);
        reject(e);
      });
    });
  }

  function addRoomToHistory(rid, type = "public") {
    if (typeof window === "undefined" || !rid) return;
    try {
      let list = JSON.parse(localStorage.getItem(ROOM_HISTORY_KEY) || "[]");
      list = list.filter((r) => r.roomId !== rid);
      list.unshift({ roomId: rid, type });
      list = list.slice(0, ROOM_HISTORY_MAX);
      localStorage.setItem(ROOM_HISTORY_KEY, JSON.stringify(list));
    } catch (_) {}
  }

  function getRoomHistory() {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(ROOM_HISTORY_KEY) || "[]");
    } catch (_) {
      return [];
    }
  }

  function setLocalStream(stream) {
    localStream.value = stream;
  }

  function setRemoteStream(peerId, stream) {
    remoteStreams.value = { ...remoteStreams.value, [peerId]: stream };
  }

  function removeRemoteStream(peerId) {
    const next = { ...remoteStreams.value };
    delete next[peerId];
    remoteStreams.value = next;
  }

  function getSocket() {
    return socket.value;
  }

  return {
    socket,
    roomId,
    userName,
    isConnected,
    isReconnecting,
    peers,
    localStream,
    remoteStreams,
    lastJoinOptions,
    hasPeers,
    peerCount,
    connect,
    joinRoom,
    leaveRoom,
    setLocalStream,
    setRemoteStream,
    removeRemoteStream,
    getSocket,
    addRoomToHistory,
    getRoomHistory,
    getSessionRoom,
    restoreAndRejoin,
  };
});
