export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const csrf = options.method && options.method !== 'GET'
    ? await fetch('/api/csrf', { signal: options.signal }).then(response => response.json()) as { token: string }
    : null
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (csrf) headers.set('X-CSRF-TOKEN', csrf.token)
  const response = await fetch(path, { ...options, credentials: 'same-origin', headers })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.errors
      ? Object.values(body.errors).flat().join(' ')
      : body.message || `Request failed (${response.status}).`)
  }
  return body as T
}
