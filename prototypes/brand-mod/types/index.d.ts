export type Token = { path: string; type: string; value: string; hex?: string; cssVar: string }
export type Finding = { file: string; line: number; column: number; rule: string; severity: 'error' | 'warning'; message: string; fix: string }
export type BrandSummary = { id: string; name: string; repo?: string; pinned: string | null; latest: string; latestIsMajor?: boolean; stale?: boolean; refused?: string; references?: { name: string; kind: string }[] }
export type Loaded = {
  server: string
  connectNote: string
  active: BrandSummary | null
  brands: BrandSummary[]
  light: Token[]
  dark: Token[]
  logoSvg: string
  findings: Finding[]
  findingsAreFixture: boolean
  checkedAt: string
  error: string | null
}
export type Variant = 'card' | 'health' | 'tokens'
export type StatusStyle = 'minimal' | 'full' | 'alerts'

declare module 'claude-code' {
  interface PluginState {
    'brand-os-proto': { loaded: Loaded | null; variant: Variant; statusStyle: StatusStyle; filter: string; swatch: 'svg' | 'box' }
  }
}
