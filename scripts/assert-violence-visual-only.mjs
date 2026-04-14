/**
 * Build guard: violence mode is presentation-only and must not be imported from gameplay code
 * (timing, damage, hitboxes, and balance live under src/gameplay).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const gameplayDir = join(root, 'src', 'gameplay')

/** Matches `from '../presentation'`, `from '../../presentation/violenceMode'`, etc. */
const importFromPresentation =
  /from\s+['"]((?:\.\.\/)+|\.\/)presentation(?:\/violenceMode)?['"]/g

function walkTsFiles(dir, out = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name)
    if (name.isDirectory()) walkTsFiles(p, out)
    else if (name.isFile() && name.name.endsWith('.ts')) out.push(p)
  }
  return out
}

let failed = false
for (const file of walkTsFiles(gameplayDir)) {
  const text = readFileSync(file, 'utf8')
  importFromPresentation.lastIndex = 0
  if (importFromPresentation.test(text)) {
    console.error(
      `[violence contract] ${file} imports from presentation/ — Violence mode must stay visual-only; do not use from gameplay.`,
    )
    failed = true
  }
}

if (failed) process.exit(1)
