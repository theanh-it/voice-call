import { createRouter, createWebHistory } from "vue-router";

const routes = [
  {
    path: "/",
    name: "Home",
    component: () => import("../views/HomeView.vue"),
    meta: { title: "Voice Call - Tham gia phòng" },
  },
  {
    path: "/call/:roomId",
    name: "Call",
    component: () => import("../views/CallView.vue"),
    meta: { title: "Đang gọi..." },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  document.title = to.meta?.title || "Voice Call";
  next();
});

export default router;
