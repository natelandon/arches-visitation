import type { Mock } from 'vitest'

/**
 * Make a mocked zustand hook behave like the real one: called with a
 * selector it returns `selector(state)`, called bare it returns `state`.
 */
export function mockStore<S extends object>(hook: unknown, state: S): void {
  ;(hook as Mock).mockImplementation((selector?: (s: S) => unknown) =>
    selector ? selector(state) : state
  )
}
