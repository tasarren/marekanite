import { createRouter, createWebHistory } from "vue-router"
import { useAdminStore } from "../stores/admin"
import HomeView from "../views/HomeView.vue"
import RegisterView from "../views/RegisterView.vue"
import LoginView from "../views/LoginView.vue"
import PatchView from "../views/PatchView.vue"
import UnlockView from "../views/UnlockView.vue"
import AccountsView from "../views/AccountsView.vue"

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/unlock",
      name: "unlock",
      component: UnlockView,
      meta: { public: true },
    },
    { path: "/", name: "home", component: HomeView },
    { path: "/register", name: "register", component: RegisterView },
    { path: "/login", name: "login", component: LoginView },
    { path: "/accounts", name: "accounts", component: AccountsView },
    { path: "/patch", name: "patch", component: PatchView },
  ],
})

router.beforeEach(async(to) => {
  const admin = useAdminStore()
  if (!admin.ready) await admin.bootstrap()
  if (admin.authMode === "none" || admin.unlocked) {
    if (to.name === "unlock") return { name: "home" }
    return true
  }
  if (to.meta.public) return true
  return { name: "unlock", query: { next: to.fullPath } }
})
