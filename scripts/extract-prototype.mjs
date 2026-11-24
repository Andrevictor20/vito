#!/usr/bin/env node
/**
 * extract-prototype.mjs
 * Extrai tokens, regras CSS, @keyframes, árvore SVG completa (ícones e logos)
 * e estrutura DOM (estática + gerada por JS) de Vito-telas-atualizadas.html.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const MOBILE = path.join(ROOT, 'mobile')
const require = createRequire(path.join(MOBILE, 'package.json'))

const postcss = require('postcss')
const parse5 = require('parse5')

const HTML_PATH = path.join(ROOT, 'Vito-telas-atualizadas.html')
const OUT_DIR = path.join(MOBILE, 'src', 'prototype')

function loadPlaywright() {
  const candidates = [
    'playwright',
    '/home/andrevmp/.asdf/installs/nodejs/22.12.0/lib/node_modules/playwright',
  ]
  for (const c of candidates) {
    try {
      return require(c)
    } catch {
      // tenta próximo
    }
  }
  return null
}

function walkHtml(node, visitor) {
  visitor(node)
  if (Array.isArray(node.childNodes)) {
    for (const child of node.childNodes) walkHtml(child, visitor)
  }
}

function getAttr(node, name) {
  return node.attrs?.find((a) => a.name === name)?.value
}

function serializeSvgNode(node) {
  if (node.nodeName === '#text') {
    const t = node.value?.trim()
    return t ? { text: t } : null
  }
  if (!node.tagName) return null
  const attrs = {}
  for (const a of node.attrs ?? []) attrs[a.name] = a.value
  const children = (node.childNodes ?? [])
    .map(serializeSvgNode)
    .filter(Boolean)
  return { tag: node.tagName, attrs, ...(children.length ? { children } : {}) }
}

function parseSvgString(svgStr) {
  const frag = parse5.parseFragment(svgStr)
  const svg = frag.childNodes?.find((n) => n.tagName === 'svg')
  return svg ? serializeSvgNode(svg) : null
}

function extractCss(html) {
  const doc = parse5.parse(html, { sourceCodeLocationInfo: true })
  const tokens = { light: {}, dark: {}, sources: {} }
  const rules = []
  const keyframes = {}

  walkHtml(doc, (node) => {
    if (node.tagName !== 'style') return
    const startLine = node.sourceCodeLocation?.startLine ?? 1
    const cssText = node.childNodes?.map((c) => c.value ?? '').join('') ?? ''
    const root = postcss.parse(cssText)

    root.walk((item) => {
      if (item.type === 'atrule' && item.name === 'keyframes') {
        const line = startLine + (item.source?.start?.line ?? 1) - 1
        const stops = {}
        item.walkRules((r) => {
          const decls = {}
          r.walkDecls((d) => {
            decls[d.prop] = d.value
          })
          stops[r.selector] = decls
        })
        keyframes[item.params] = { line, stops }
        return
      }

      if (item.type === 'rule' && item.parent?.type === 'root') {
        const line = startLine + (item.source?.start?.line ?? 1) - 1
        const sel = item.selector.replace(/\s+/g, ' ').trim()
        const decls = {}
        item.walkDecls((d) => {
          decls[d.prop] = d.value
        })

        if (sel === ':root' || sel === ':root[data-theme="dark"]') {
          const bucket = sel === ':root' ? 'light' : 'dark'
          for (const [k, v] of Object.entries(decls)) {
            if (k.startsWith('--')) {
              tokens[bucket][k] = v
              tokens.sources[`${bucket}:${k}`] = line
            }
          }
        }
        rules.push({ selector: sel, line, decls })
      }
    })
  })

  return { doc, tokens, rules, keyframes }
}

function extractStaticIconsAndScreens(doc) {
  const inlineIcons = []
  const symbols = {}
  const staticScreens = {}

  const serializeDom = (node) => {
    if (node.nodeName === '#text') {
      const v = node.value?.replace(/\s+/g, ' ').trim()
      return v ? { text: v } : null
    }
    if (!node.tagName) return null
    if (node.tagName === 'svg') {
      return { tag: 'svg', attrs: Object.fromEntries((node.attrs ?? []).map((a) => [a.name, a.value])) }
    }
    const attrs = {}
    for (const a of node.attrs ?? []) {
      if (['id', 'class', 'role', 'aria-label', 'placeholder', 'type', 'data-st'].includes(a.name)) {
        attrs[a.name] = a.value
      }
    }
    const children = (node.childNodes ?? []).map(serializeDom).filter(Boolean)
    return { tag: node.tagName, attrs, ...(children.length ? { children } : {}) }
  }

  let idx = 0
  walkHtml(doc, (node) => {
    if (node.tagName === 'symbol') {
      const id = getAttr(node, 'id')
      if (id) {
        symbols[id] = {
          line: node.sourceCodeLocation?.startLine ?? null,
          tree: serializeSvgNode(node),
        }
      }
    }
    if (node.tagName === 'svg' && !node.parentNode?.tagName?.includes('symbol')) {
      idx += 1
      inlineIcons.push({
        index: idx,
        id: getAttr(node, 'id') ?? null,
        parentClass: getAttr(node.parentNode, 'class') ?? null,
        parentId: getAttr(node.parentNode, 'id') ?? null,
        line: node.sourceCodeLocation?.startLine ?? null,
        tree: serializeSvgNode(node),
      })
    }
    if (node.tagName === 'section') {
      const id = getAttr(node, 'id')
      if (id) {
        staticScreens[id] = {
          line: node.sourceCodeLocation?.startLine ?? null,
          ariaLabel: getAttr(node, 'aria-label') ?? null,
          dom: serializeDom(node),
        }
      }
    }
  })

  return { inlineIcons, symbols, staticScreens }
}

/**
 * Extrai variáveis de dados/SVG declaradas dentro das <script> do protótipo
 * e renderiza telas dinâmicas (#vsplash, #vonb, #s-store) via Playwright.
 */
async function extractDynamicViaPlaywright(htmlPath) {
  const pw = loadPlaywright()
  if (!pw) {
    console.warn('[extract] Playwright indisponível; pulando extração dinâmica do DOM.')
    return { logos: {}, dynamicScreens: {} }
  }
  const browser = await pw.chromium.launch()
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    // Expõe LOGO/AILOGO/BANK_ICON/MBRAND/SPARK/SPK via captura antes da IIFE se necessário
    await page.goto(`file://${htmlPath}`, { waitUntil: 'load' })
    await page.waitForTimeout(300)

    const dynamicScreens = await page.evaluate(() => {
      const ids = ['vsplash', 'vonb', 's-store', 's-login', 's-chat', 's-agenda', 's-tasks', 's-fin', 's-perfil', 's-int']
      const out = {}
      const snap = (el) => {
        if (!el) return null
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || undefined,
          cls: el.className && typeof el.className === 'string' ? el.className : undefined,
          text: el.childElementCount === 0 ? el.textContent?.trim() || undefined : undefined,
          children: Array.from(el.children).slice(0, 60).map(snap).filter(Boolean),
        }
      }
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el) out[id] = snap(el)
      }
      return out
    })

    return { dynamicScreens }
  } finally {
    await browser.close()
  }
}

/** Extrai dicionários de SVGs declarados no JS (`LOGO`, `AILOGO`, `BANK_ICON`, `MBRAND`, `SPARK`, `SPK`). */
function extractJsSvgMaps(html) {
  const grabObj = (name) => {
    const m = html.match(new RegExp(`(?:var|const)\\s+${name}\\s*=\\s*(\\{[\\s\\S]*?\\});`))
    if (!m) return {}
    try {
      const obj = Function(`"use strict"; return (${m[1]});`)()
      const out = {}
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string' && v.includes('<svg')) {
          out[k] = parseSvgString(v)
        } else if (v && typeof v === 'object') {
          const str = Object.values(v).find((x) => typeof x === 'string' && x.includes('<svg'))
          if (str) out[k] = parseSvgString(str)
        }
      }
      return out
    } catch {
      return {}
    }
  }
  const grabSingle = (name) => {
    const m = html.match(new RegExp(`(?:var|const)\\s+${name}\\s*=\\s*(['"\`])(<svg[\\s\\S]*?</svg>)\\1`))
    return m ? parseSvgString(m[2]) : null
  }
  return {
    LOGO: grabObj('LOGO'),
    AILOGO: grabObj('AILOGO'),
    BANK_ICON: grabObj('BANK_ICON'),
    MBRAND: grabObj('MBRAND'),
    SPARK: grabSingle('SPARK'),
    SPK: grabSingle('SPK'),
  }
}

async function main() {
  const html = fs.readFileSync(HTML_PATH, 'utf8')
  const { doc, tokens, rules, keyframes } = extractCss(html)
  const { inlineIcons, symbols, staticScreens } = extractStaticIconsAndScreens(doc)
  const jsSvgs = extractJsSvgMaps(html)
  const { dynamicScreens } = await extractDynamicViaPlaywright(HTML_PATH)

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const writeJson = (file, data) =>
    fs.writeFileSync(path.join(OUT_DIR, file), `${JSON.stringify(data, null, 2)}\n`, 'utf8')

  writeJson('tokens.json', tokens)
  writeJson('rules.json', rules)
  writeJson('keyframes.json', keyframes)
  writeJson('icons.json', { symbols, inlineIcons, ...jsSvgs })
  writeJson('screens.json', { staticScreens, dynamicScreens })

  console.log(
    JSON.stringify({
      tokensLight: Object.keys(tokens.light).length,
      tokensDark: Object.keys(tokens.dark).length,
      rules: rules.length,
      keyframes: Object.keys(keyframes).length,
      inlineIcons: inlineIcons.length,
      logos: Object.keys(jsSvgs.LOGO).length,
      aiLogos: Object.keys(jsSvgs.AILOGO).length,
      bankIcons: Object.keys(jsSvgs.BANK_ICON).length,
      staticScreens: Object.keys(staticScreens).length,
      dynamicScreens: Object.keys(dynamicScreens).length,
    }),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
