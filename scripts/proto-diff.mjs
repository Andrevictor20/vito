#!/usr/bin/env node
/**
 * proto-diff.mjs
 * Harness Playwright de paridade visual (390x844) entre Vito-telas-atualizadas.html
 * e o app web do Expo (`http://localhost:8081` ou export estático).
 *
 * Uso:
 *   node scripts/proto-diff.mjs --url http://localhost:8081 --screen s-login --theme light --max-diff 0.02
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const MOBILE = path.join(ROOT, 'mobile')
const require = createRequire(path.join(MOBILE, 'package.json'))

const pmMod = require('pixelmatch')
const pixelmatch = pmMod.default || pmMod
const { PNG } = require('pngjs')
const pw = require('/home/andrevmp/.asdf/installs/nodejs/22.12.0/lib/node_modules/playwright')

function parseArgs() {
  const args = process.argv.slice(2)
  const out = {
    url: 'http://localhost:8081',
    screen: 's-login',
    theme: 'light',
    maxDiff: 0.02,
    outDir: path.join(ROOT, '.agents', 'runtime', 'proto-diff'),
  }
  for (let i = 0; i < args.length; i += 2) {
    const k = args[i]
    const v = args[i + 1]
    if (k === '--url') out.url = v
    else if (k === '--screen') out.screen = v
    else if (k === '--theme') out.theme = v
    else if (k === '--max-diff') out.maxDiff = parseFloat(v)
    else if (k === '--out-dir') out.outDir = v
  }
  return out
}

async function capture(page, url, outPath, setupFn) {
  await page.goto(url, { waitUntil: 'networkidle' })
  if (setupFn) await setupFn(page)
  await page.waitForTimeout(300)
  await page.screenshot({ path: outPath })
}

async function main() {
  const opts = parseArgs()
  fs.mkdirSync(opts.outDir, { recursive: true })
  const protoPng = path.join(opts.outDir, `${opts.screen}.${opts.theme}.proto.png`)
  const appPng = path.join(opts.outDir, `${opts.screen}.${opts.theme}.app.png`)
  const diffPng = path.join(opts.outDir, `${opts.screen}.${opts.theme}.diff.png`)

  const browser = await pw.chromium.launch()
  try {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
      colorScheme: opts.theme === 'dark' ? 'dark' : 'light',
    })
    const page = await ctx.newPage()

    const protoUrl = `file://${path.join(ROOT, 'docs', 'prototypes', 'Vito-telas-atualizadas.html')}#${opts.screen.replace(/^s-/, '')}`
    await capture(page, protoUrl, protoPng, async (p) => {
      await p.evaluate((theme) => {
        document.documentElement.setAttribute('data-theme', theme)
      }, opts.theme)
    })

    await capture(page, opts.url, appPng)
  } finally {
    await browser.close()
  }

  const img1 = PNG.sync.read(fs.readFileSync(protoPng))
  const img2 = PNG.sync.read(fs.readFileSync(appPng))
  const { width, height } = img1
  const diff = new PNG({ width, height })
  const numDiff = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 })
  fs.writeFileSync(diffPng, PNG.sync.write(diff))

  const ratio = numDiff / (width * height)
  console.log(JSON.stringify({ screen: opts.screen, theme: opts.theme, diffRatio: ratio, maxDiff: opts.maxDiff, diffPng }))
  if (ratio > opts.maxDiff) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
