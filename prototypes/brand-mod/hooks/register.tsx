// PROTOTYPE, throwaway (wayfinder ticket #22): three brand-pane variants and three status-line styles,
// reading a stub Brand OS MCP server shipped in this plugin.
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'
import type { Loaded, Variant, StatusStyle, Token, Finding } from '../types'

const P = 'brand-os-proto'
const PANE = 'brand-os-pane'
const loaded = atom({ plugin: 'brand-os-proto', key: 'loaded' } as const, null)
const variant = atom({ plugin: 'brand-os-proto', key: 'variant' } as const, 'card')
const statusStyle = atom({ plugin: 'brand-os-proto', key: 'statusStyle' } as const, 'full')
const filter = atom({ plugin: 'brand-os-proto', key: 'filter' } as const, '')
const swatch = atom({ plugin: 'brand-os-proto', key: 'swatch' } as const, 'svg')

const parse = (r: { content?: { type: string; text?: string }[] }) => JSON.parse(r.content?.find(c => c.type === 'text')?.text ?? 'null')

function statusText(l: Loaded | null, style: StatusStyle): string | undefined {
  if (!l) return '◆ Brand OS: loading'
  if (l.error) return `◆ Brand OS: ${l.error}`
  if (!l.active) return '◆ No Active Brand: /brand-os:use-brand'
  const a = l.active
  const errors = l.findings.filter(f => f.severity === 'error').length
  const update_ = a.latest !== a.pinned ? `${a.latest}${a.latestIsMajor ? ' (major)' : ''} available` : ''
  if (style === 'minimal') return `◆ ${a.name}`
  if (style === 'alerts') {
    const parts = [errors ? `${errors} off-brand` : '', update_].filter(Boolean)
    return parts.length ? `◆ ${a.name}: ${parts.join(' · ')}` : undefined
  }
  return [`◆ ${a.name} ${a.pinned}`, `${l.findings.length} findings`, update_, a.stale ? 'offline, may be stale' : ''].filter(Boolean).join(' · ')
}

let step = 'start'
async function load($: any) {
  step = 'mcp.connect'
  const conn = await $.mcp.connect('brand-os')
  if (!conn.isConnected) {
    await update($, loaded, () => ({ server: '', connectNote: `${conn.reason}: ${conn.message ?? ''}`, active: null, brands: [], light: [], dark: [], logoSvg: '', findings: [], findingsAreFixture: false, checkedAt: '', error: 'MCP server not connected' }))
    return
  }
  const s = conn.server
  try { await $.mcp.call(s, 'list_brands', {}) } catch (err: any) {
    // Auto mode's classifier refuses the mod's own MCP calls: draw from a snapshot of the
    // same stub results so the pane can still be judged, and say so in the footer.
    step = 'fixture.json'
    const f = JSON.parse(await $.fs.read(`${$.plugin.root}/server/fixture.json`))
    await update($, loaded, () => ({
      server: s, connectNote: `MCP refused, showing server/fixture.json (${String(err?.message ?? err).slice(0, 120)})`,
      active: f.list_brands.active, brands: f.list_brands.brands, light: f.light.tokens, dark: f.dark.tokens, logoSvg: f.logo.svg,
      findings: f.check_brand.findings, findingsAreFixture: true, checkedAt: 'snapshot', error: null,
    }))
    return
  }
  const brands = (step = 'list_brands', parse)(await $.mcp.call(s, 'list_brands', {}))
  const light = (step = 'get_tokens', parse)(await $.mcp.call(s, 'get_tokens', { mode: 'light' }))
  const dark = (step = 'get_tokens', parse)(await $.mcp.call(s, 'get_tokens', { mode: 'dark' }))
  const logo = (step = 'get_asset', parse)(await $.mcp.call(s, 'get_asset', { id: 'logo', variant: 'primary' }))
  step = 'session.cwd'
  const cwd = await $.session.cwd()
  const check = (step = 'check_brand', parse)(await $.mcp.call(s, 'check_brand', { paths: [cwd] }))
  step = 'store'
  await update($, loaded, () => ({
    server: s, connectNote: 'connected', active: brands.active, brands: brands.brands,
    light: light.tokens, dark: dark.tokens, logoSvg: logo.svg,
    findings: check.findings, findingsAreFixture: check.fixture, checkedAt: new Date().toISOString().slice(11, 19), error: null,
  }))
}

async function refreshStatus($: any) {
  const l = await read($, loaded)
  const st = await read($, statusStyle)
  $.ui.status(statusText(l, st))
}

const swatchSvg = (hex: string, size = 22) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect x="0.5" y="0.5" width="${size - 1}" height="${size - 1}" rx="4" fill="${hex}" stroke="#8888" /></svg>`
const pairSvg = (l: string, d: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="22"><rect x="0.5" y="0.5" width="21" height="21" rx="4" fill="${l}" stroke="#8888"/><rect x="22.5" y="0.5" width="21" height="21" rx="4" fill="${d}" stroke="#8888"/></svg>`
const short = (f: Finding, cwd = '') => `${f.file.replace(cwd + '/', '')}:${f.line}`

async function safeLoad($: any) {
  try { await load($) } catch (err: any) {
    const why = `at ${step}: ${err?.message ?? String(err)}`
    await update($, loaded, () => ({ server: '', connectNote: why, active: null, brands: [], light: [], dark: [], logoSvg: '', findings: [], findingsAreFixture: false, checkedAt: '', error: 'load failed' }))
    $.ui.toast(`Brand OS load failed ${why}`)
  }
  await refreshStatus($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'brand', description: 'PROTOTYPE: open the Brand OS brand pane' })
    $.ui.status('◆ Brand OS: loading')
    $.clock.after(0, () => { safeLoad($) })
    return next(e)
  })

  on('command.run', { command: 'brand' }, async $ => {
    const r = await $.ui.open({ id: PANE, title: 'Brand' })
    return { text: `Brand pane ${r.isPlaced ? 'opened' : 'requested (not placed: ' + JSON.stringify(r) + ')'}.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const T = $.ui.resolve(e) as any
    const { Box, Text, Button, Input } = T
    const Svg = T.Svg
    const l = await read($, loaded)
    const v = await read($, variant)
    const st = await read($, statusStyle)
    const sw = await read($, swatch)
    const q = await read($, filter)
    const cwd = (await $.session.cwd()) as string

    const Swatch = ({ hex, alt }: { hex: string; alt: string }) =>
      sw === 'svg' && Svg ? <Svg source={swatchSvg(hex)} alt={alt} width={22} height={22} /> : <Text backgroundColor={hex}>{'    '}</Text>

    const tabs = (
      <Box flexDirection="column" gap="xs">
        <Box flexDirection="row" gap="sm" flexWrap="wrap">
          {(['card', 'health', 'tokens'] as Variant[]).map(k => (
            <Button key={'v-' + k} label={k === 'card' ? 'A Brand card' : k === 'health' ? 'B Health first' : 'C Token inspector'} variant={v === k ? 'primary' : 'secondary'} onPress={() => update($, variant, () => k)} />
          ))}
        </Box>
        <Box flexDirection="row" gap="sm" flexWrap="wrap">
          <Text dimColor size="caption">Status line:</Text>
          {(['minimal', 'full', 'alerts'] as StatusStyle[]).map(k => (
            <Button key={'s-' + k} label={k} variant={st === k ? 'primary' : 'secondary'} onPress={async () => { await update($, statusStyle, () => k); await refreshStatus($) }} />
          ))}
          <Text dimColor size="caption">Swatch:</Text>
          {(['svg', 'box'] as const).map(k => (
            <Button key={'w-' + k} label={k} variant={sw === k ? 'primary' : 'secondary'} onPress={() => update($, swatch, () => k)} />
          ))}
        </Box>
      </Box>
    )

    if (!l) return <Box flexDirection="column" gap="sm">{tabs}<Text dimColor>Loading the Active Brand…</Text></Box>
    if (l.error || !l.active) return <Box flexDirection="column" gap="sm">{tabs}<Text color="error">{l.error ?? 'No Active Brand'}</Text><Text size="footnote">{l.connectNote}</Text><Button label="Retry" onPress={() => safeLoad($)} /></Box>
    const a = l.active
    const colours = l.light.filter(t => t.type === 'color')
    const darkOf = (p: string) => l.dark.find(t => t.path === p)?.hex ?? '#000'
    const errors = l.findings.filter(f => f.severity === 'error')
    const updateNote = a.latest !== a.pinned
      ? <Text color={a.latestIsMajor ? 'warning' : 'suggestion'}>{a.latest} available{a.latestIsMajor ? ' (major: breaking changes)' : ''}. Run /brand-os:use-brand to bump.</Text>
      : null
    const footer = <Text dimColor size="caption">MCP server name: {l.server} · checked {l.checkedAt}{l.findingsAreFixture ? ' · findings are fixture data' : ''}{l.connectNote !== 'connected' ? ` · ${l.connectNote}` : ''}</Text>

    let body
    if (v === 'card') {
      body = (
        <Box flexDirection="column" gap="md">
          <Box flexDirection="row" gap="md" alignItems="center">
            {Svg ? <Svg source={l.logoSvg} alt={`${a.name} logo`} width={120} height={32} /> : null}
            <Box flexDirection="column">
              <Text size="heading" weight="bold">{a.name}</Text>
              <Text dimColor size="caption">{a.id} {a.pinned} · {a.repo}</Text>
            </Box>
          </Box>
          {updateNote}
          <Text weight="semibold">Colours (light | dark)</Text>
          <Box flexDirection="column" gap="xs">
            {colours.map(t => (
              <Box key={t.path} flexDirection="row" gap="sm" alignItems="center">
                {sw === 'svg' && Svg ? <Svg source={pairSvg(t.hex!, darkOf(t.path))} alt={`${t.path} light ${t.hex} dark ${darkOf(t.path)}`} width={44} height={22} /> : <Box flexDirection="row"><Text backgroundColor={t.hex!}>{'   '}</Text><Text backgroundColor={darkOf(t.path)}>{'   '}</Text></Box>}
                <Text mono size="footnote">{t.path.replace('color.', '')}</Text>
              </Box>
            ))}
          </Box>
          <Text weight="semibold">Type</Text>
          {l.light.filter(t => t.type === 'typography').map(t => <Text key={t.path} size="footnote"><Text mono>{t.path.replace('type.', '')}</Text>  <Text dimColor>{t.value}</Text></Text>)}
          <Text weight="semibold">References</Text>
          <Box flexDirection="row" gap="sm" flexWrap="wrap">
            {(a.references ?? []).map(r => <Text key={r.name} size="footnote">{r.name} <Text dimColor>({r.kind})</Text></Text>)}
          </Box>
          <Text size="footnote" color={errors.length ? 'error' : 'success'}>{l.findings.length} Brand Check findings{errors.length ? `, ${errors.length} off-brand` : ''}. See B.</Text>
        </Box>
      )
    } else if (v === 'health') {
      body = (
        <Box flexDirection="column" gap="md">
          <Box flexDirection="column" gap="xs">
            <Text size="heading" weight="bold">{errors.length ? `${errors.length} off-brand` : l.findings.length ? 'On brand, with warnings' : 'On brand'}</Text>
            <Text size="footnote">Active Brand: <Text weight="semibold">{a.name}</Text> {a.pinned}</Text>
            {updateNote}
            {a.stale ? <Text color="warning" size="footnote">Offline: serving the cached version, it may be stale.</Text> : null}
          </Box>
          <Box flexDirection="row" gap="sm">
            <Button key="recheck" label="Re-check" onPress={async () => { await load($); await refreshStatus($) }} />
          </Box>
          <Box flexDirection="column" gap="sm">
            {l.findings.slice(0, 40).map((f, i) => (
              <Box key={'f' + i} flexDirection="column">
                <Text size="footnote" color={f.severity === 'error' ? 'error' : 'warning'}>{f.severity === 'error' ? '●' : '○'} <Text mono>{short(f, cwd)}</Text>  {f.message}</Text>
                <Text size="caption" dimColor>fix: <Text mono>{f.fix}</Text>  ({f.rule})</Text>
              </Box>
            ))}
            {l.findings.length > 40 ? <Text dimColor size="caption">and {l.findings.length - 40} more</Text> : null}
          </Box>
          <Text weight="semibold" size="footnote">Other brands</Text>
          {l.brands.filter(b => b.id !== a.id).map(b => <Text key={b.id} size="caption" dimColor={!b.refused} color={b.refused ? 'error' : undefined}>{b.name}{b.refused ? `: refused, ${b.refused}` : ` ${b.latest}`}</Text>)}
        </Box>
      )
    } else {
      const rows = l.light.filter(t => !q || t.path.includes(q) || t.cssVar.includes(q) || (t.hex ?? '').includes(q))
      body = (
        <Box flexDirection="column" gap="sm">
          <Input key="filter" placeholder="Filter tokens (path, var, hex)" value={q} onInput={(val: string) => update($, filter, () => val)} onSubmit={(val: string) => update($, filter, () => val)} />
          <Text dimColor size="caption">{rows.length} of {l.light.length} tokens · light mode · {a.name} {a.pinned}</Text>
          {rows.map(t => (
            <Box key={t.path} flexDirection="row" gap="sm" alignItems="center">
              {t.hex ? <Swatch hex={t.hex} alt={t.hex} /> : <Text dimColor>{'  ·  '}</Text>}
              <Box flexDirection="column">
                <Text mono size="footnote">{t.cssVar}</Text>
                <Text dimColor size="caption">{t.path} = {t.value}{t.hex ? `  · dark ${darkOf(t.path)}` : ''}</Text>
              </Box>
            </Box>
          ))}
        </Box>
      )
    }
    return <Box flexDirection="column" gap="md">{tabs}{body}{footer}</Box>
  })
}
