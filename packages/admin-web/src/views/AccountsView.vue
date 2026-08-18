<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { adminFetch } from "../api/client"
import OButton from "../components/ui/OButton.vue"
import OCallout from "../components/ui/OCallout.vue"
import OCard from "../components/ui/OCard.vue"
import OInput from "../components/ui/OInput.vue"

type Person = {
  id: number;
  email: string;
  name: string;
  createdAt: number;
  vaults: number;
  disabled: boolean;
}

const people = ref<Person[]>([])
const loadError = ref("")
const formError = ref("")
const busy = ref(false)
const editingId = ref<number | null>(null)
const name = ref("")
const email = ref("")
const password = ref("")

const editing = computed(() =>
  editingId.value == null
    ? null
    : people.value.find((p) => p.id === editingId.value) ?? null,
)

async function load() {
  loadError.value = ""
  try {
    const res = await adminFetch("/admin/users")
    const json = (await res.json()) as { users?: Person[]; error?: string }
    if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
    people.value = json.users ?? []
  } catch(e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

function startAdd() {
  editingId.value = null
  name.value = ""
  email.value = ""
  password.value = ""
  formError.value = ""
}

function startEdit(p: Person) {
  editingId.value = p.id
  name.value = p.name
  email.value = p.email
  password.value = ""
  formError.value = ""
}

async function saveForm() {
  formError.value = ""
  busy.value = true
  try {
    if (editingId.value == null) {
      const res = await adminFetch("/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.value.trim(),
          email: email.value.trim(),
          password: password.value,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
      startAdd()
    } else {
      const res = await adminFetch(`/admin/users/${editingId.value}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.value.trim(),
          email: email.value.trim(),
          password: password.value || undefined,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
      startAdd()
    }
    await load()
  } catch(e) {
    formError.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

async function setDisabled(p: Person, disabled: boolean) {
  loadError.value = ""
  try {
    const res = await adminFetch(`/admin/users/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabled }),
    })
    const json = (await res.json()) as { error?: string }
    if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
    await load()
  } catch(e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

async function removePerson(p: Person) {
  const ok = window.confirm(
    p.vaults
      ? `Remove ${p.name}? This also deletes their ${p.vaults} vault${p.vaults === 1 ? "" : "s"}.`
      : `Remove ${p.name}?`,
  )
  if (!ok) return
  loadError.value = ""
  try {
    const res = await adminFetch(`/admin/users/${p.id}`, { method: "DELETE" })
    const json = (await res.json()) as { error?: string }
    if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
    if (editingId.value === p.id) startAdd()
    await load()
  } catch(e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  }
}

function fmtDate(ms: number) {
  try {
    return new Date(ms).toLocaleDateString()
  } catch {
    return ""
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-normal">People on this server</h1>
      <p class="mt-1 text-sm text-muted">
        Obsidian only has Sign in. Add people here, then they log in from the
        patched app.
      </p>
    </div>

    <OCallout v-if="loadError" kind="error">{{ loadError }}</OCallout>

    <div class="grid gap-6 lg:grid-cols-4">
      <OCard class="overflow-hidden p-0 lg:col-span-3">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-border text-xs text-muted">
              <tr>
                <th class="px-4 py-2.5 font-medium">Name</th>
                <th class="px-4 py-2.5 font-medium">Email</th>
                <th class="px-4 py-2.5 font-medium">Vaults</th>
                <th class="px-4 py-2.5 font-medium">Added</th>
                <th class="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              <tr v-if="!people.length">
                <td colspan="5" class="px-4 py-10 text-center text-muted">
                  Nobody yet. Add the first person on the right.
                </td>
              </tr>
              <tr
                v-for="p in people"
                :key="p.id"
                class="border-t border-border/70"
                :class="p.disabled ? 'opacity-60' : ''"
              >
                <td class="px-4 py-2.5 text-normal">
                  {{ p.name }}
                  <span v-if="p.disabled" class="ml-1 text-xs text-muted">off</span>
                </td>
                <td class="px-4 py-2.5 text-muted">{{ p.email }}</td>
                <td class="px-4 py-2.5 text-muted">{{ p.vaults }}</td>
                <td class="px-4 py-2.5 text-muted">{{ fmtDate(p.createdAt) }}</td>
                <td class="px-4 py-2.5">
                  <div class="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      class="text-xs text-accent hover:underline"
                      @click="startEdit(p)"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      class="text-xs text-muted hover:text-normal hover:underline"
                      @click="setDisabled(p, !p.disabled)"
                    >
                      {{ p.disabled ? "Turn on" : "Turn off" }}
                    </button>
                    <button
                      type="button"
                      class="text-xs text-error hover:underline"
                      @click="removePerson(p)"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </OCard>

      <div class="space-y-3 lg:col-span-1">
        <h2 class="text-lg font-medium text-normal">
          {{ editing ? `Edit ${editing.name}` : "Add someone" }}
        </h2>
        <OCard class="p-4">
          <form class="space-y-4" @submit.prevent="saveForm">
            <label class="block space-y-1.5 text-sm">
              <span class="text-muted">Name</span>
              <OInput v-model="name" autocomplete="name" />
            </label>
            <label class="block space-y-1.5 text-sm">
              <span class="text-muted">Email</span>
              <OInput v-model="email" type="email" required autocomplete="email" />
            </label>
            <label class="block space-y-1.5 text-sm">
              <span class="text-muted">{{
                editing ? "New password (optional)" : "Password"
              }}</span>
              <OInput
                v-model="password"
                type="password"
                :required="!editing"
                autocomplete="new-password"
              />
            </label>
            <OCallout v-if="formError" kind="error">{{ formError }}</OCallout>
            <div class="flex flex-wrap gap-2">
              <OButton type="submit" variant="cta" :disabled="busy">
                {{ busy ? "Saving…" : editing ? "Save" : "Add" }}
              </OButton>
              <OButton
                v-if="editing"
                type="button"
                variant="ghost"
                @click="startAdd"
              >
                Cancel
              </OButton>
            </div>
          </form>
        </OCard>
      </div>
    </div>
  </div>
</template>
