#!/usr/bin/env node

import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveWithProjectAlias(request, parent, isMain, options) {
  if (typeof request === "string" && request.startsWith("@/")) {
    return originalResolveFilename.call(
      this,
      path.join(rootDir, request.slice(2)),
      parent,
      isMain,
      options,
    );
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

Module._extensions[".ts"] = function compileTypeScriptForTests(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    fileName: filename,
    reportDiagnostics: true,
    compilerOptions: {
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      isolatedModules: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      resolveJsonModule: true,
      target: ts.ScriptTarget.ES2022,
    },
  });

  const diagnostics = (output.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );

  if (diagnostics.length > 0) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => rootDir,
        getNewLine: () => "\n",
      }),
    );
  }

  module._compile(output.outputText, filename);
};

function collectTestFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectTestFiles(entryPath));
    } else if (/\.(test|spec)\.ts$/.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

const explicitFiles = process.argv.slice(2).map((filePath) => path.resolve(rootDir, filePath));
const testFiles = explicitFiles.length > 0
  ? explicitFiles
  : collectTestFiles(path.join(rootDir, "tests"));

if (testFiles.length === 0) {
  console.error("No unit test files found.");
  process.exitCode = 1;
} else {
  for (const filePath of testFiles) {
    require(filePath);
  }
}
