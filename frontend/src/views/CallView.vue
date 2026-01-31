<template>
  <div class="call">
    <header class="header">
      <div class="header-left">
        <div class="room-badge">
          <IconMdi :path="mdiDoorOpen" :size="18" />
          <span>{{ callStore.roomId }}</span>
        </div>
        <span class="status" :class="{ connected: callStore.isConnected }">
          <IconMdi :path="mdiCircle" :size="8" class="status-dot" />
          {{ callStore.isConnected ? "Đã kết nối" : "Đang kết nối..." }}
        </span>
      </div>
    </header>

    <div class="content">
      <div class="member-list-wrap">
        <h2 class="section-title">
          <IconMdi :path="mdiAccountGroup" :size="20" />
          Danh sách trong phòng
        </h2>
        <ul class="member-list">
          <!-- Bản thân (me) - luôn đầu tiên, có border nhận diện -->
          <li class="member-row me" :class="{ speaking: !isMuted }">
            <div class="avatar-wrap">
              <div class="avatar">
                <IconMdi :path="mdiAccount" :size="24" />
              </div>
              <span v-if="!isMuted" class="speaking-dot" aria-hidden="true" />
            </div>
            <span class="member-name">{{ callStore.userName }}</span>
            <span
              class="mic-status"
              :class="{ muted: isMuted }"
              :title="isMuted ? 'Mic tắt' : 'Mic bật'"
            >
              <IconMdi
                :path="isMuted ? mdiMicrophoneOff : mdiMicrophone"
                :size="16"
              />
              <span class="mic-label">{{ isMuted ? "Tắt" : "Bật" }}</span>
            </span>
            <span class="member-badge me-badge">Bạn</span>
          </li>
          <!-- Các peer -->
          <li
            v-for="peer in callStore.peers"
            :key="peer.id"
            class="member-row"
            :class="{ speaking: !!callStore.remoteStreams[peer.id] }"
          >
            <div class="avatar-wrap">
              <div class="avatar">
                <IconMdi :path="mdiAccount" :size="24" />
              </div>
              <span
                v-if="callStore.remoteStreams[peer.id]"
                class="speaking-dot"
                aria-hidden="true"
              />
            </div>
            <span class="member-name">{{ peer.userName || "User" }}</span>
            <span
              class="mic-status"
              :class="{ muted: peerMuteState[peer.id] === true }"
              :title="peerMuteState[peer.id] === true ? 'Mic tắt' : 'Mic bật'"
            >
              <IconMdi
                :path="
                  peerMuteState[peer.id] === true
                    ? mdiMicrophoneOff
                    : mdiMicrophone
                "
                :size="16"
              />
              <span class="mic-label">
                {{ peerMuteState[peer.id] === true ? "Tắt" : "Bật" }}
              </span>
            </span>
            <audio
              v-if="callStore.remoteStreams[peer.id]"
              :ref="(el) => setRemoteAudioRef(peer.id, el)"
              autoplay
              playsinline
            />
          </li>
        </ul>
        <p v-if="!callStore.hasPeers" class="empty-hint">
          Chờ người khác vào phòng. Chia sẻ mã phòng để mời.
        </p>
      </div>

      <!-- Floating reactions (hiển thị khi có người gửi) -->
      <TransitionGroup
        name="reaction-float"
        tag="div"
        class="reactions-overlay"
      >
        <div
          v-for="r in reactions"
          :key="r.id"
          class="reaction-bubble"
          :class="{ self: r.from === 'me' }"
        >
          <span class="reaction-emoji">{{ r.emoji }}</span>
          <span v-if="r.userName" class="reaction-from">{{ r.userName }}</span>
        </div>
      </TransitionGroup>
    </div>

    <!-- Thanh cảm xúc -->
    <div class="reactions-bar">
      <button
        v-for="emoji in reactionEmojis"
        :key="emoji"
        type="button"
        class="reaction-btn"
        :title="`Gửi ${emoji}`"
        @click="sendReaction(emoji)"
      >
        {{ emoji }}
      </button>
    </div>

    <footer class="footer">
      <button
        class="control mute"
        :class="{ active: isMuted }"
        :title="isMuted ? 'Bật mic' : 'Tắt mic'"
        @click="onMuteClick"
      >
        <IconMdi
          :path="isMuted ? mdiMicrophoneOff : mdiMicrophone"
          :size="22"
        />
        <span>{{ isMuted ? "Bật mic" : "Tắt mic" }}</span>
      </button>
      <button
        class="control speaker"
        :class="{ active: isSpeakerMuted }"
        :title="isSpeakerMuted ? 'Bật loa' : 'Tắt loa'"
        @click="toggleSpeaker"
      >
        <IconMdi
          :path="isSpeakerMuted ? mdiVolumeOff : mdiVolumeHigh"
          :size="22"
        />
        <span>{{ isSpeakerMuted ? "Bật loa" : "Tắt loa" }}</span>
      </button>
      <button class="control hangup" title="Kết thúc" @click="hangup">
        <IconMdi :path="mdiPhoneHangup" :size="22" />
        <span>Kết thúc</span>
      </button>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCallStore } from "../stores/callStore";
import { useWebRTC } from "../composables/useWebRTC";
import IconMdi from "../components/IconMdi.vue";
import {
  mdiDoorOpen,
  mdiCircle,
  mdiAccountGroup,
  mdiAccount,
  mdiMicrophone,
  mdiMicrophoneOff,
  mdiVolumeHigh,
  mdiVolumeOff,
  mdiPhoneHangup,
} from "@mdi/js";

const route = useRoute();
const router = useRouter();
const callStore = useCallStore();
const {
  isMuted,
  startCall,
  handleOffer,
  handleAnswer,
  handleIceCandidate,
  toggleMute,
  cleanup,
  cleanupPeer,
} = useWebRTC();

const remoteAudioRefs = ref({});

/** Trạng thái mic của từng peer: { [peerId]: true (tắt) | false (bật) } */
const peerMuteState = ref({});

/** Tắt loa = không nghe âm thanh từ người khác (chỉ ảnh hưởng phía mình) */
const isSpeakerMuted = ref(false);

const reactionEmojis = ["👍", "❤️", "😂", "👏", "🎉", "🔥", "👋", "💯"];
const reactions = ref([]);
let reactionId = 0;
const REACTION_DURATION = 2500;

function sendReaction(emoji) {
  const socket = callStore.getSocket();
  if (!socket?.connected) return;
  socket.emit("reaction", emoji);
}

function addReaction(payload) {
  const id = ++reactionId;
  reactions.value.push({ id, ...payload });
  setTimeout(() => {
    reactions.value = reactions.value.filter((r) => r.id !== id);
  }, REACTION_DURATION);
}

function setRemoteAudioRef(peerId, el) {
  if (el) {
    remoteAudioRefs.value[peerId] = el;
    const stream = callStore.remoteStreams[peerId];
    if (stream) el.srcObject = stream;
    el.muted = isSpeakerMuted.value;
  } else {
    delete remoteAudioRefs.value[peerId];
  }
}

function attachRemoteStream(peerId, stream) {
  const el = remoteAudioRefs.value[peerId];
  if (el && stream) {
    el.srcObject = stream;
    el.muted = isSpeakerMuted.value;
  }
}

function toggleSpeaker() {
  isSpeakerMuted.value = !isSpeakerMuted.value;
  Object.values(remoteAudioRefs.value).forEach((el) => {
    if (el) el.muted = isSpeakerMuted.value;
  });
}

watch(
  () => callStore.remoteStreams,
  (streams) => {
    Object.entries(streams).forEach(([peerId, stream]) => {
      attachRemoteStream(peerId, stream);
    });
  },
  { deep: true }
);

watch(isSpeakerMuted, (muted) => {
  Object.values(remoteAudioRefs.value).forEach((el) => {
    if (el) el.muted = muted;
  });
});

async function initLocalStream() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    callStore.setLocalStream(stream);
  } catch (e) {
    console.error("Microphone error:", e);
  }
}

function setupSocketListeners() {
  const socket = callStore.getSocket();
  if (!socket) return;

  socket.on("user-joined", ({ id, userName }) => {
    callStore.peers = [...callStore.peers, { id, userName }];
    startCall(id);
    // Gửi trạng thái mic của mình cho người mới vào
    socket.emit("mic-state", isMuted.value);
  });

  socket.on("user-left", ({ id }) => {
    cleanupPeer(id);
    callStore.peers = callStore.peers.filter((p) => p.id !== id);
    delete peerMuteState.value[id];
  });

  socket.on("mic-state", ({ from, userName, muted }) => {
    peerMuteState.value = { ...peerMuteState.value, [from]: muted };
  });

  socket.on("offer", ({ from, offer }) => handleOffer(from, offer));
  socket.on("answer", ({ from, answer }) => handleAnswer(from, answer));
  socket.on("ice-candidate", ({ from, candidate }) =>
    handleIceCandidate(from, candidate)
  );

  socket.on("reaction", ({ from, userName, emoji }) => {
    const isMe = from === socket.id;
    addReaction({
      from: isMe ? "me" : from,
      userName: userName || (isMe ? callStore.userName : "User"),
      emoji,
    });
  });
}

function startCallsToExistingPeers() {
  callStore.peers.forEach((peer) => startCall(peer.id));
}

function onMuteClick() {
  toggleMute();
  callStore.getSocket()?.emit("mic-state", isMuted.value);
}

function hangup() {
  cleanup();
  callStore.leaveRoom();
  router.push({ name: "Home" });
}

onMounted(async () => {
  const rid = route.params.roomId;
  if (!rid || rid !== callStore.roomId) {
    router.replace({ name: "Home" });
    return;
  }
  await initLocalStream();
  setupSocketListeners();
  startCallsToExistingPeers();
  // Gửi trạng thái mic ban đầu cho mọi người trong phòng
  callStore.getSocket()?.emit("mic-state", isMuted.value);
});

onUnmounted(() => {
  const socket = callStore.getSocket();
  if (socket) {
    socket.off("user-joined");
    socket.off("user-left");
    socket.off("offer");
    socket.off("answer");
    socket.off("ice-candidate");
    socket.off("reaction");
    socket.off("mic-state");
  }
});
</script>

<style scoped>
.call {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 0;
  background: radial-gradient(
    ellipse 70% 40% at 50% 0%,
    rgba(99, 102, 241, 0.08),
    transparent
  );
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.room-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  background: var(--bg);
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-muted);
}

.room-badge .icon-mdi {
  color: var(--accent);
  opacity: 0.9;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.status-dot {
  color: var(--text-muted);
  opacity: 0.8;
}

.status.connected .status-dot {
  color: var(--success);
  opacity: 1;
}

.status.connected {
  color: var(--success);
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.25rem 1.25rem;
  overflow: auto;
}

.member-list-wrap {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
}

.section-title {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 1rem;
}

.section-title .icon-mdi {
  color: var(--accent);
}

.member-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.75rem 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.member-row.me {
  border-width: 2px;
  border-color: var(--accent);
  background: rgba(99, 102, 241, 0.06);
}

.member-row.me .avatar {
  background: linear-gradient(135deg, var(--accent) 0%, #818cf8 100%);
  color: white;
}

.member-row:not(.me):hover {
  border-color: rgba(99, 102, 241, 0.3);
}

/* Đang nói: nhấp nháy */
.member-row.speaking {
  box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.25);
}

.member-row.speaking .speaking-dot {
  animation: speak-blink 1s ease-in-out infinite;
}

@keyframes speak-blink {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.85);
  }
}

.avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--surface-hover);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.speaking-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--success);
  border: 2px solid var(--surface);
  box-sizing: border-box;
}

.member-name {
  flex: 1;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text);
  min-width: 0;
}

.member-badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-weight: 500;
}

.me-badge {
  background: rgba(99, 102, 241, 0.2);
  color: var(--accent);
}

.empty-hint {
  margin-top: 1rem;
  font-size: 0.875rem;
  color: var(--text-muted);
  text-align: center;
}

/* Trạng thái mic trong danh sách */
.mic-status {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: var(--success);
  flex-shrink: 0;
}

.mic-status .icon-mdi {
  color: var(--success);
}

.mic-status.muted {
  color: var(--text-muted);
}

.mic-status.muted .icon-mdi {
  color: var(--text-muted);
}

.mic-label {
  font-weight: 500;
}

/* Thanh cảm xúc */
.reactions-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--surface);
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
}

.reaction-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.15s, background 0.2s, border-color 0.2s;
}

.reaction-btn:hover {
  background: var(--surface-hover);
  border-color: var(--accent);
  transform: scale(1.1);
}

.reaction-btn:active {
  transform: scale(0.95);
}

/* Floating reactions overlay */
.reactions-overlay {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 180px;
  pointer-events: none;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-end;
  gap: 0.5rem;
  padding: 0 1rem;
  z-index: 10;
}

.reaction-bubble {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
  animation: reaction-pop 0.35s ease-out;
}

.reaction-bubble.self {
  border-color: var(--accent);
  background: rgba(99, 102, 241, 0.12);
}

.reaction-emoji {
  font-size: 2rem;
  line-height: 1;
}

.reaction-from {
  font-size: 0.7rem;
  color: var(--text-muted);
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes reaction-pop {
  0% {
    opacity: 0;
    transform: scale(0.5);
  }
  70% {
    transform: scale(1.08);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

/* Transition cho reaction vào/ra */
.reaction-float-enter-active {
  animation: reaction-pop 0.35s ease-out;
}

.reaction-float-leave-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.reaction-float-leave-to {
  opacity: 0;
  transform: scale(0.8) translateY(10px);
}

.reaction-float-move {
  transition: transform 0.3s ease;
}

.footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid var(--border);
  background: var(--surface);
}

.control {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  border-radius: 14px;
  font-size: 0.9rem;
  font-weight: 500;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}

.control:hover {
  background: var(--surface-hover);
}

.control.mute.active {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.4);
  color: var(--danger-hover);
}

.control.mute.active .icon-mdi {
  color: var(--danger-hover);
}

.control.speaker.active {
  background: rgba(139, 139, 154, 0.2);
  border-color: var(--text-muted);
  color: var(--text-muted);
}

.control.speaker.active .icon-mdi {
  color: var(--text-muted);
}

.control.hangup {
  background: var(--danger);
  color: white;
  border-color: var(--danger);
}

.control.hangup:hover {
  background: var(--danger-hover);
  border-color: var(--danger-hover);
}

.control.hangup .icon-mdi {
  color: white;
}
</style>
