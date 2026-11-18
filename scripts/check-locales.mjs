// Verifica paridade/compilação dos JSON de idioma e varre fontes por texto fixo.
//   node scripts/check-locales.mjs                    -> paridade + compilação
//   node scripts/check-locales.mjs --scan <caminho>... -> varredura de textos fixos
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseCompile } from '@intlify/message-compiler'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out)
    else out[key] = v
  }
  return out
}

function checkLocales() {
  const locales = ['pt-BR', 'en']
  const flat = {}
  let problems = 0
  for (const l of locales) {
    const file = path.join(root, 'src/locales', `${l}.json`)
    try {
      flat[l] = flatten(JSON.parse(fs.readFileSync(file, 'utf8')))
    } catch (e) {
      console.log(`erro ao ler ${file}: ${e.message}`)
      return 1
    }
  }
  for (const key of Object.keys(flat['pt-BR'])) {
    if (!(key in flat.en)) { console.log(`faltando em en: ${key}`); problems++ }
  }
  for (const key of Object.keys(flat.en)) {
    if (!(key in flat['pt-BR'])) { console.log(`faltando em pt-BR: ${key}`); problems++ }
  }
  for (const l of locales) {
    for (const [key, msg] of Object.entries(flat[l])) {
      if (typeof msg !== 'string') {
        console.log(`erro de compilação [${l}] ${key}: valor não é texto`)
        problems++
        continue
      }
      baseCompile(msg, {
        onError: (err) => {
          console.log(`erro de compilação [${l}] ${key}: ${err.message}`)
          problems++
        },
      })
    }
  }
  if (problems) return 1
  console.log(`locales OK (${Object.keys(flat['pt-BR']).length} chaves)`)
  return 0
}

// ---------- varredura ----------

const LETTER = /[A-Za-zÀ-ÿ]/
const ACCENT = /[À-ÿ]/
const TAG = /<(?:[^>"']|"[^"]*"|'[^']*')*>/g
const ATTRS = 'title|label|placeholder|text|hint|subtitle|no-data-text|loading-text|alt|aria-label|prefix|suffix|prepend-text|append-text|confirm-text'
const STATIC_ATTR = new RegExp(`\\s(${ATTRS})\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'g')

const blank = (s) => s.replace(/[^\n]/g, ' ')
const lineOf = (text, idx) => text.slice(0, idx).split('\n').length

function walk(p, out = []) {
  const st = fs.statSync(p)
  if (st.isDirectory()) {
    for (const f of fs.readdirSync(p).sort()) walk(path.join(p, f), out)
  } else if (/\.(vue|js)$/.test(p)) out.push(p)
  return out
}

// Percorre código JS devolvendo literais de string fora de comentários.
function stringLiterals(code) {
  const res = []
  let i = 0
  while (i < code.length) {
    const c = code[i]
    if (c === '/' && code[i + 1] === '/') {
      while (i < code.length && code[i] !== '\n') i++
    } else if (c === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2)
      i = end === -1 ? code.length : end + 2
    } else if (c === "'" || c === '"' || c === '`') {
      const start = i
      i++
      while (i < code.length && code[i] !== c) {
        if (code[i] === '\\') i++
        else if (c !== '`' && code[i] === '\n') break
        i++
      }
      res.push({ text: code.slice(start + 1, i), index: start })
      i++
    } else i++
  }
  return res
}

function scanFile(file) {
  const rel = path.relative(process.cwd(), file) || file
  const src = fs.readFileSync(file, 'utf8')
  const lines = src.split('\n')
  const found = []
  const add = (line, snippet) => {
    if (/i18n-ignore/.test(lines[line - 1] || '')) return
    if (snippet.trim() === 'upITSM') return
    found.push(`${rel}:${line}: ${snippet.trim().replace(/\s+/g, ' ')}`)
  }
  const isI18nPlugin = path.resolve(file) === path.join(root, 'src/plugins/i18n.js')
  const scanScript = (code, offsetLines) => {
    for (const s of stringLiterals(code)) {
      const line = lineOf(code, s.index) + offsetLines
      if (ACCENT.test(s.text)) add(line, s.text)
      else if (!isI18nPlugin && s.text.includes('pt-BR')) add(line, s.text)
      if (ACCENT.test(s.text) && !isI18nPlugin && s.text.includes('pt-BR')) { /* já listado */ }
    }
  }

  if (file.endsWith('.js')) {
    scanScript(src, 0)
  } else {
    // template: bloco raiz (<template> no início da linha até </template> no início da linha)
    const tStart = src.search(/^<template[^>]*>/m)
    const tEndMatch = [...src.matchAll(/^<\/template>/gm)].pop()
    if (tStart !== -1 && tEndMatch) {
      const openEnd = src.indexOf('>', tStart) + 1
      const tpl = src.slice(openEnd, tEndMatch.index)
      const base = lineOf(src, openEnd) - 1
      const clean = tpl
        .replace(/<!--[\s\S]*?-->/g, blank)
        .replace(/\{\{[\s\S]*?\}\}/g, blank)
      let last = 0
      const text = (seg, from) => {
        const m = seg.match(LETTER)
        if (m) add(lineOf(clean, from + m.index) + base, seg)
      }
      for (const m of clean.matchAll(TAG)) {
        text(clean.slice(last, m.index), last)
        for (const a of m[0].matchAll(STATIC_ATTR)) {
          const val = a[2] ?? a[3] ?? ''
          if (LETTER.test(val)) add(lineOf(clean, m.index + a.index + 1) + base, `${a[1]}="${val}"`)
        }
        last = m.index + m[0].length
      }
      text(clean.slice(last), last)
      if (!isI18nPlugin) {
        for (const m of clean.matchAll(/['"]pt-BR['"]/g)) add(lineOf(clean, m.index) + base, m[0])
      }
    }
    for (const m of src.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
      const start = m.index + m[0].indexOf('>') + 1
      scanScript(m[1], lineOf(src, start) - 1)
    }
  }
  return found
}

function scan(targets) {
  if (!targets.length) { console.log('uso: --scan <arquivo|pasta>...'); return 1 }
  const all = []
  for (const t of targets) {
    if (!fs.existsSync(t)) { console.log(`não existe: ${t}`); return 1 }
    for (const f of walk(t)) all.push(...scanFile(f))
  }
  // remove duplicatas (mesma linha/trecho) mantendo ordem
  const uniq = [...new Set(all)]
  uniq.forEach((l) => console.log(l))
  if (uniq.length) return 1
  console.log('scan OK')
  return 0
}

process.exit(args[0] === '--scan' ? scan(args.slice(1)) : checkLocales())
