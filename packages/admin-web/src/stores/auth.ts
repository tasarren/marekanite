import { defineStore } from "pinia"
import { ref } from "vue"
import { apiPost } from "../api/client"

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(localStorage.getItem("marekanite_vault_token"))
  const email = ref<string | null>(localStorage.getItem("marekanite_vault_email"))
  const name = ref<string | null>(localStorage.getItem("marekanite_vault_name"))

  function persist() {
    if (token.value) localStorage.setItem("marekanite_vault_token", token.value)
    else localStorage.removeItem("marekanite_vault_token")
    if (email.value) localStorage.setItem("marekanite_vault_email", email.value)
    else localStorage.removeItem("marekanite_vault_email")
    if (name.value) localStorage.setItem("marekanite_vault_name", name.value)
    else localStorage.removeItem("marekanite_vault_name")
  }

  async function register(input: {
    email: string;
    password: string;
    name: string;
  }) {
    const res = await apiPost<{
      token: string;
      email: string;
      name: string;
    }>("/user/signup", input)
    token.value = res.token
    email.value = res.email
    name.value = res.name
    persist()
    return res
  }

  async function login(input: { email: string; password: string }) {
    const res = await apiPost<{
      token: string;
      email: string;
      name: string;
    }>("/user/signin", input)
    token.value = res.token
    email.value = res.email
    name.value = res.name
    persist()
    return res
  }

  function logout() {
    token.value = null
    email.value = null
    name.value = null
    persist()
  }

  return { token, email, name, register, login, logout }
})
