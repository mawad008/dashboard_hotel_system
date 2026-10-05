import { describe, expect, it } from 'vitest'
import { iconName } from '../app/utils/iconName'
import css from '../app/assets/keenicons/outline/style.css?raw'

// Every literal <KtIcon name="…"> must resolve to a glyph that exists in the
// vendored Keenicons outline set — an unknown name renders an empty <i>, so
// an icon-only button (e.g. Roles "edit") looks invisible until hovered.
const glyphs = new Set([...css.matchAll(/\.ki-([a-z0-9-]+)\.ki-outline:before/g)].map(m => m[1]!))

const sources = import.meta.glob<string>('../app/**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
})

describe('KtIcon glyphs', () => {
  it('every literal icon name resolves to a bundled glyph', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20)
    const missing: string[] = []
    for (const [file, src] of Object.entries(sources)) {
      for (const m of src.matchAll(/<KtIcon[^>]*?\sname="([a-z0-9-]+)"/g)) {
        if (!glyphs.has(iconName(m[1]!))) missing.push(`${file}: ${m[1]}`)
      }
    }
    expect(missing).toEqual([])
  })
})
