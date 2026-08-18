export type ApiClient = {
  base: string;
  post: <T = unknown>(path: string, body: unknown) => Promise<T>;
}

export function createApiClient(base: string): ApiClient {
  const root = base.replace(/\/$/, "")
  return {
    base: root,
    async post<T>(path: string, body: unknown): Promise<T> {
      const res = await fetch(`${root}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as Record<string, unknown>
      if ("error" in json) {
        throw new Error(String(json.error))
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      return json as T
    },
  }
}
