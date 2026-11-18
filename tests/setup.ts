/// <reference lib="dom" />

/**
 * Node 26 exposes `localStorage` as a global that is undefined without
 * `--localstorage-file`. Vitest's jsdom environment inherits that shadow, so browser tests
 * lose `window.localStorage` even though jsdom provides one. Give them an in-memory Storage.
 */
const storage = (): Storage => {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => {
      values.clear()
    },
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()].at(index) ?? null,
    removeItem: (key) => {
      values.delete(key)
    },
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

const browserWindow = Reflect.get(globalThis, 'window') as Window | undefined
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- window is absent under the node test environment
if (browserWindow !== undefined && Reflect.get(browserWindow, 'localStorage') === undefined) {
  Object.defineProperty(browserWindow, 'localStorage', { configurable: true, value: storage() })
}
