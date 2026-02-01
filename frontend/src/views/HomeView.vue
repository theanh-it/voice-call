<template>
  <div class="home">
    <div class="card">
      <div class="card-header">
        <div class="logo">
          <IconMdi :path="mdiPhoneInTalk" :size="40" />
        </div>
        <h1 class="title">Voice Call</h1>
        <p class="subtitle">Nhập mã phòng và tên để tham gia cuộc gọi thoại</p>
      </div>

      <form class="form" @submit.prevent="onSubmit">
        <div class="field">
          <label for="roomId">
            <IconMdi :path="mdiKey" :size="18" class="label-icon" />
            Mã phòng
          </label>
          <input
            id="roomId"
            v-model="roomId"
            type="text"
            placeholder="vd: abc123"
            required
            autocomplete="off"
          />
          <div v-if="recentRooms.length > 0" class="recent-rooms">
            <span class="recent-label">Phòng gần đây:</span>
            <div class="recent-list">
              <button
                v-for="r in recentRooms"
                :key="r.roomId"
                type="button"
                class="recent-item"
                :title="
                  r.type === 'private' ? 'Phòng riêng tư' : 'Phòng công khai'
                "
                @click="pickRecentRoom(r)"
              >
                <IconMdi
                  :path="r.type === 'private' ? mdiLock : mdiDoorOpen"
                  :size="14"
                />
                {{ r.roomId }}
              </button>
            </div>
          </div>
        </div>
        <div class="field">
          <label for="userName">
            <IconMdi :path="mdiAccount" :size="18" class="label-icon" />
            Tên của bạn
          </label>
          <input
            id="userName"
            v-model="userName"
            type="text"
            placeholder="Tên hiển thị"
            required
          />
        </div>
        <div class="field">
          <label>
            <IconMdi :path="mdiLock" :size="18" class="label-icon" />
            Loại phòng
          </label>
          <div class="room-type">
            <label class="radio-label">
              <input
                v-model="roomType"
                type="radio"
                value="public"
                name="roomType"
              />
              <span>Công khai</span>
            </label>
            <label class="radio-label">
              <input
                v-model="roomType"
                type="radio"
                value="private"
                name="roomType"
              />
              <span>Riêng tư</span>
            </label>
          </div>
        </div>
        <div v-if="roomType === 'private'" class="field">
          <label for="roomPassword">
            <IconMdi :path="mdiKeyOutline" :size="18" class="label-icon" />
            Mật khẩu phòng
          </label>
          <div class="input-with-toggle">
            <input
              id="roomPassword"
              v-model="roomPassword"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Mật khẩu phòng (bắt buộc nếu riêng tư)"
              :required="roomType === 'private'"
              autocomplete="off"
            />
            <button
              type="button"
              class="toggle-password"
              :title="showPassword ? 'Ẩn' : 'Hiện'"
              tabindex="-1"
              @click="showPassword = !showPassword"
            >
              <IconMdi :path="showPassword ? mdiEyeOff : mdiEye" :size="18" />
            </button>
          </div>
        </div>
        <p v-if="error" class="error">
          <IconMdi :path="mdiAlertCircle" :size="18" class="error-icon" />
          {{ error }}
        </p>
        <button type="submit" class="btn btn-primary" :disabled="loading">
          <IconMdi
            v-if="loading"
            :path="mdiLoading"
            :size="20"
            class="btn-icon spin"
          />
          <IconMdi v-else :path="mdiLogin" :size="20" class="btn-icon" />
          {{ loading ? "Đang vào phòng..." : "Vào phòng" }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import { useCallStore } from "../stores/callStore";
import IconMdi from "../components/IconMdi.vue";
import { ref, computed } from "vue";
import {
  mdiPhoneInTalk,
  mdiKey,
  mdiAccount,
  mdiLogin,
  mdiAlertCircle,
  mdiLoading,
  mdiLock,
  mdiKeyOutline,
  mdiEye,
  mdiEyeOff,
  mdiDoorOpen,
} from "@mdi/js";

const router = useRouter();
const callStore = useCallStore();

const roomId = ref("");
const userName = ref("");
const roomType = ref("public");
const roomPassword = ref("");
const showPassword = ref(false);
const loading = ref(false);
const error = ref("");

const recentRooms = computed(() => callStore.getRoomHistory());

function pickRecentRoom(r) {
  roomId.value = r.roomId;
  roomType.value = r.type || "public";
}

async function onSubmit() {
  error.value = "";
  loading.value = true;
  try {
    await callStore.joinRoom(roomId.value, userName.value, {
      type: roomType.value,
      password: roomPassword.value || undefined,
    });
    router.push({ name: "Call", params: { roomId: callStore.roomId } });
  } catch (e) {
    error.value =
      e?.message || "Không thể kết nối. Kiểm tra server và thử lại.";
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.home {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: radial-gradient(
    ellipse 80% 50% at 50% -20%,
    rgba(99, 102, 241, 0.15),
    transparent
  );
}

.card {
  width: 100%;
  max-width: 420px;
  background: var(--surface);
  border-radius: 20px;
  padding: 2.25rem;
  box-shadow: var(--shadow);
  border: 1px solid var(--border);
}

.card-header {
  text-align: center;
  margin-bottom: 2rem;
}

.logo {
  width: 72px;
  height: 72px;
  margin: 0 auto 1.25rem;
  border-radius: 18px;
  background: linear-gradient(135deg, var(--accent) 0%, #818cf8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35);
}

.title {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: var(--text);
  letter-spacing: -0.02em;
}

.subtitle {
  color: var(--text-muted);
  font-size: 0.95rem;
  line-height: 1.5;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1.35rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-muted);
}

.label-icon {
  color: var(--accent);
  opacity: 0.9;
}

.field input {
  padding: 0.875rem 1rem 0.875rem 1rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  color: var(--text);
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.field input::placeholder {
  color: var(--text-muted);
  opacity: 0.7;
}

.field input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
}

.room-type {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.radio-label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  color: var(--text);
  cursor: pointer;
}

.radio-label input {
  width: 1rem;
  height: 1rem;
  accent-color: var(--accent);
}

.input-with-toggle {
  position: relative;
  display: flex;
}

.input-with-toggle input {
  padding-right: 2.75rem;
}

.toggle-password {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 6px;
  transition: color 0.2s, background 0.2s;
}

.toggle-password:hover {
  color: var(--text);
  background: var(--surface-hover);
}

.recent-rooms {
  margin-top: 0.5rem;
}

.recent-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  display: block;
  margin-bottom: 0.35rem;
}

.recent-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.recent-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.6rem;
  font-size: 0.8rem;
  color: var(--text-muted);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: color 0.2s, background 0.2s, border-color 0.2s;
}

.recent-item:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: rgba(99, 102, 241, 0.08);
}

.recent-item .icon-mdi {
  flex-shrink: 0;
  opacity: 0.8;
}

.error {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--danger);
  font-size: 0.875rem;
  padding: 0.75rem 1rem;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 10px;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.error-icon {
  flex-shrink: 0;
  color: var(--danger);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.95rem 1.5rem;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
}

.btn:disabled {
  opacity: 0.8;
  cursor: not-allowed;
}

.btn-icon {
  flex-shrink: 0;
}

.btn-icon.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.btn-primary {
  background: linear-gradient(135deg, var(--accent) 0%, #818cf8 100%);
  color: white;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
}

.btn-primary:hover:not(:disabled) {
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
}

.btn-primary:active:not(:disabled) {
  transform: scale(0.98);
}
</style>
