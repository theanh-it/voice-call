import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { io } from "socket.io-client";

export const useCallStore = defineStore("call", () => {
  const socket = ref(null);
  const roomId = ref("");
  const userName = ref("");
  const isConnected = ref(false);
  const peers = ref([]);
  const localStream = ref(null);
  const remoteStreams = ref({}); // { peerId: MediaStream }

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
    });
    socket.value.on("disconnect", () => {
      isConnected.value = false;
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
    if (localStream.value) {
      localStream.value.getTracks().forEach((t) => t.stop());
      localStream.value = null;
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
    peers,
    localStream,
    remoteStreams,
    hasPeers,
    peerCount,
    connect,
    joinRoom,
    leaveRoom,
    setLocalStream,
    setRemoteStream,
    removeRemoteStream,
    getSocket,
  };
});
