import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSync } from "@babel/core";
import test from "node:test";

function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
    else if (value && typeof value === "object") walk(value, visit);
  }
}

function validateJavaScript(code) {
  const ast = parseSync(code, { babelrc: false, configFile: false });
  const imports = new Set();
  walk(ast, (node) => {
    assert.ok(!node.type?.startsWith("JSX") && !node.type?.startsWith("TS"));
    if (node.type === "ImportDeclaration") imports.add(node.source.value);
    if (node.type === "StringLiteral")
      assert.ok(!/^react(?:-dom)?(?:\/|$)/.test(node.value));
    if (node.type === "Identifier") assert.notEqual(node.name, "React");
  });
  for (const name of [
    "@opencode/plugin/tui",
    "solid-js",
    "@opentui/core",
    "@opentui/solid",
  ]) {
    assert.ok(imports.has(name), `Missing external host runtime: ${name}`);
  }
}

test("package exports canonical compiled JavaScript", async () => {
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(manifest.exports["./tui"], "./dist/tui.js");
  validateJavaScript(await readFile("dist/tui.js", "utf8"));
  execFileSync(process.execPath, ["scripts/build.mjs", "--check"], {
    stdio: "pipe",
  });
});

test("output validator rejects React, JSX and TypeScript", () => {
  for (const code of [
    'import React from "react";',
    'import { jsx } from "react/jsx-runtime";',
    "const panel = <box />;",
    "const count: number = 0;",
  ]) {
    assert.throws(() => validateJavaScript(code));
  }
});

test("root-only override resolves one patched Seroval installation", async () => {
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
  const installed = JSON.parse(
    await readFile("node_modules/seroval/package.json", "utf8"),
  );
  assert.equal(manifest.overrides.seroval, "1.6.8");
  const resolutions = Object.entries(lock.packages).filter(([path]) =>
    path.endsWith("node_modules/seroval"),
  );
  assert.equal(resolutions.length, 1);
  assert.equal(resolutions[0][1].version, "1.6.8");
  assert.equal(installed.version, "1.6.8");
});

test("compiler handles fresh, stale, missing, empty and invalid input", async () => {
  const directory = await mkdtemp(join(tmpdir(), "timezone-clocks-build-"));
  const script = fileURLToPath(
    new URL("../scripts/build.mjs", import.meta.url),
  );
  const run = (...args) =>
    execFileSync(process.execPath, [script, ...args], {
      cwd: directory,
      stdio: "pipe",
    });
  try {
    assert.throws(() => run());
    await mkdir(join(directory, "src"));
    await writeFile(
      join(directory, "src/tui.tsx"),
      await readFile("src/tui.tsx"),
    );
    run();
    validateJavaScript(await readFile(join(directory, "dist/tui.js"), "utf8"));
    run("--check");
    await writeFile(join(directory, "dist/tui.js"), "// stale\n");
    assert.throws(() => run("--check"), /stale; run npm run compile/);
    assert.equal(
      await readFile(join(directory, "dist/tui.js"), "utf8"),
      "// stale\n",
    );
    await rm(join(directory, "dist/tui.js"));
    assert.throws(() => run("--check"));
    await writeFile(join(directory, "src/tui.tsx"), "const invalid = <");
    assert.throws(() => run());
    await writeFile(join(directory, "src/tui.tsx"), "");
    assert.throws(() => run(), /Babel produced no output/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("two supported mouse-down handlers remain", async () => {
  const ast = parseSync(await readFile("src/tui.tsx", "utf8"), {
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ["typescript", "jsx"] },
  });
  const attributes = [];
  walk(ast, (node) => {
    if (node.type === "JSXAttribute") attributes.push(node.name.name);
  });
  assert.equal(attributes.filter((name) => name === "onMouseDown").length, 2);
  assert.ok(!attributes.includes("onClick"));
});

test("clocks and calendar start collapsed unless the option opts out", async () => {
  const compiled = await readFile("dist/tui.js", "utf8");
  assert.match(
    compiled,
    /context\.options\?\.collapsedByDefault\s*!==\s*false/,
    "the collapsed default must be driven by the plugin option",
  );
  // Neither signal may keep the old hard-coded expanded default.
  assert.doesNotMatch(
    compiled,
    /createSignal\(true\)/,
    "clocks and calendar must not default to expanded",
  );
});

test("scripts-disabled archive contains only compiled package files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "timezone-clocks-package-"));
  try {
    const packed = JSON.parse(
      execFileSync(
        "npm",
        ["pack", "--ignore-scripts", "--json", "--pack-destination", directory],
        { encoding: "utf8", stdio: "pipe" },
      ),
    )[0];
    assert.deepEqual(packed.files.map((file) => file.path).sort(), [
      "README.md",
      "dist/tui.js",
      "package.json",
    ]);
    const extract = (path) =>
      execFileSync(
        "tar",
        ["-xOf", join(directory, packed.filename), `package/${path}`],
        { encoding: "utf8" },
      );
    assert.equal(
      JSON.parse(extract("package.json")).exports["./tui"],
      "./dist/tui.js",
    );
    const code = extract("dist/tui.js");
    assert.equal(code, await readFile("dist/tui.js", "utf8"));
    validateJavaScript(code);
    await writeFile(join(directory, "tui.mjs"), code);
    execFileSync(process.execPath, ["--check", join(directory, "tui.mjs")], {
      stdio: "pipe",
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
