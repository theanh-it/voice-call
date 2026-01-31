import { ref, onUnmounted } from "vue";
import { useCallStore } from "../stores/callStore";

const servers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function useWebRTC() {
  const callStore = useCallStore();
  const peerConnections = ref({});
  const isMuted = ref(false);
  const error = ref(null);

  function createPeerConnection(peerId) {
    if (peerConnections.value[peerId]) return peerConnections.value[peerId];
    const pc = new RTCPeerConnection(servers);
    peerConnections.value[peerId] = pc;

    if (callStore.localStream) {
      callStore.localStream
        .getTracks()
        .forEach((track) => pc.addTrack(track, callStore.localStream));
    }

    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (stream) callStore.setRemoteStream(peerId, stream);
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        callStore
          .getSocket()
          ?.emit("ice-candidate", { to: peerId, candidate: e.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected"
      ) {
        cleanupPeer(peerId);
      }
      if (pc.connectionState === "closed") {
        delete peerConnections.value[peerId];
      }
    };

    return pc;
  }

  function cleanupPeer(peerId) {
    const pc = peerConnections.value[peerId];
    if (pc) {
      pc.close();
      delete peerConnections.value[peerId];
    }
    callStore.removeRemoteStream(peerId);
  }

  async function startCall(peerId) {
    const pc = createPeerConnection(peerId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      callStore.getSocket()?.emit("offer", { to: peerId, offer });
    } catch (err) {
      error.value = err.message;
    }
  }

  async function handleOffer(from, offer) {
    const pc = createPeerConnection(from);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      callStore.getSocket()?.emit("answer", { to: from, answer });
    } catch (err) {
      error.value = err.message;
    }
  }

  async function handleAnswer(from, answer) {
    const pc = peerConnections.value[from];
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      error.value = err.message;
    }
  }

  function handleIceCandidate(from, candidate) {
    const pc = peerConnections.value[from] || createPeerConnection(from);
    pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
  }

  function toggleMute() {
    if (!callStore.localStream) return;
    const audioTrack = callStore.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      isMuted.value = !audioTrack.enabled;
    }
  }

  function cleanup() {
    Object.keys(peerConnections.value).forEach(cleanupPeer);
    peerConnections.value = {};
  }

  onUnmounted(cleanup);

  return {
    peerConnections,
    isMuted,
    error,
    startCall,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    toggleMute,
    cleanupPeer,
    cleanup,
  };
}
