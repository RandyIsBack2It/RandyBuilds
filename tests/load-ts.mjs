// Loads dependency-free TypeScript modules in Node, transpiled with the
// project's own `typescript` dev dependency (this Node has no type stripping).
// loadTs: one self-contained file. loadTsTree: a file and its relative imports.
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const transpile = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;

export async function loadTs(file) {
  return import(`data:text/javascript;base64,${Buffer.from(transpile(readFileSync(file, 'utf8'))).toString('base64')}`);
}

// Shared across calls, so a module imported twice is the same instance
// (classes stay identical for instanceof).
let out;
const done = new Map();

export async function loadTsTree(entry) {
  out ??= mkdtempSync(path.join(tmpdir(), 'rbt-ts-'));
  const compile = (file) => {
    if (done.has(file)) return done.get(file);
    const target = path.join(out, `${done.size}-${path.basename(file, '.ts')}.mjs`);
    done.set(file, target);
    let js = transpile(readFileSync(file, 'utf8'));
    js = js.replace(/(from\s+|import\s*\(\s*)(['"])(\.{1,2}\/[^'"]+)\2/g, (m, pre, q, spec) => {
      const base = path.resolve(path.dirname(file), spec);
      const src = [`${base}.ts`, base, path.join(base, 'index.ts')].find((f) => existsSync(f) && f.endsWith('.ts'));
      return src ? `${pre}${q}${pathToFileURL(compile(src)).href}${q}` : m;
    });
    writeFileSync(target, js);
    return target;
  };
  return import(pathToFileURL(compile(path.resolve(entry))).href);
}
