import { defineStore } from "pinia";
import { ref } from "vue";

export const useToastStore = defineStore("toast", () => {
  const toasts = ref([]);
  let nextId = 0;
  const DEFAULT_DURATION = 3500;

  function addToast(message, duration = DEFAULT_DURATION) {
    const id = ++nextId;
    toasts.value = [...toasts.value, { id, message }];
    if (duration > 0) {
      setTimeout(() => {
        toasts.value = toasts.value.filter((t) => t.id !== id);
      }, duration);
    }
    return id;
  }

  function removeToast(id) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return { toasts, addToast, removeToast };
});
