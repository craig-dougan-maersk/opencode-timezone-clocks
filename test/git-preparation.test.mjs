import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import pacote from "pacote";
import Arborist from "@npmcli/arborist";
import prettier from "prettier";

const triggers = [
  "build",
  "prepack",
  "prepare",
  "preinstall",
  "install",
  "postinstall",
];
function assertPreparationFree(manifest) {
  assert.ok(
    !Object.hasOwn(manifest, "workspaces"),
    "workspaces trigger preparation",
  );
  for (const name of triggers) {
    assert.ok(
      !Object.hasOwn(manifest.scripts ?? {}, name),
      `${name} triggers preparation`,
    );
  }
}

test("manifest rejects every preparation trigger, even with scripts disabled", async () => {
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  assertPreparationFree(manifest);
  for (const name of triggers) {
    assert.throws(
      () =>
        assertPreparationFree({
          ...manifest,
          scripts: { ...manifest.scripts, [name]: "exit 1" },
        }),
      new RegExp(`${name} triggers preparation`),
    );
  }
  for (const workspaces of [[], ["packages/*"], {}]) {
    assert.throws(
      () => assertPreparationFree({ ...manifest, workspaces }),
      /workspaces/,
    );
  }
});

test("signed original, synthetic trap and corrected Git packages exercise real extraction", async () => {
  const directory = await mkdtemp(join(tmpdir(), "timezone-clocks-git-"));
  const git = (...args) =>
    execFileSync("git", args, { encoding: "utf8", stdio: "pipe" });
  try {
    const repo = join(directory, "repo");
    git(
      "clone",
      "--quiet",
      resolve("test/fixtures/git-preparation.bundle"),
      repo,
    );
    git("-C", repo, "checkout", "--quiet", "-b", "fixture", "corrected");
    for (const ref of ["baseline", "preparation-trap", "corrected"]) {
      assert.match(git("-C", repo, "cat-file", "commit", ref), /\ngpgsig /);
    }
    const show = (ref, file) => git("-C", repo, "show", `${ref}:${file}`);
    const original = JSON.parse(show("baseline", "package.json"));
    assertPreparationFree(original);
    assert.equal(original.exports["./tui"], "./src/tui.tsx");
    assert.equal(
      createHash("sha256")
        .update(show("baseline", "src/tui.tsx"))
        .digest("hex"),
      "e157cdcff9ecefd3d8b7c780d09f3b5bc834531f90783589d5de648e135abbbb",
      "Original source fingerprint must match upstream acbbdfb",
    );
    // Formatting and removal of precisely two duplicate unsupported props are the
    // only packaging edits. The collapsed-by-default feature is a separate,
    // deliberate source change and is applied here explicitly so this guard still
    // catches every other accidental drift.
    const originalSource = show("baseline", "src/tui.tsx");
    const supported = originalSource
      .replace(
        / onClick=\{\(e: any\) => \{ try \{ e\?\.stopPropagation\?\.\(\) \} catch \{\}; set(?:Calendar)?Open\(!(?:calendarOpen|open)\(\)\) \}\}/g,
        "",
      )
      .replace(
        / {4}const \[open, setOpen\] = createSignal\(true\)\n {4}const \[calendarOpen, setCalendarOpen\] = createSignal\(true\)/,
        `    // Configurable via cli.json/opencode.json plugin options; collapsed unless
    // explicitly expanded with { "collapsedByDefault": false }.
    const collapsedByDefault = context.options?.collapsedByDefault !== false;
    const [open, setOpen] = createSignal(!collapsedByDefault);
    const [calendarOpen, setCalendarOpen] = createSignal(!collapsedByDefault);`,
      );
    assert.equal(
      await prettier.format(supported, { parser: "typescript" }),
      await readFile("src/tui.tsx", "utf8"),
    );
    const corrected = JSON.parse(show("corrected", "package.json"));
    assert.deepEqual(
      corrected,
      JSON.parse(await readFile("package.json", "utf8")),
      "Regenerate signed fixtures after manifest changes",
    );
    assert.equal(
      show("corrected", "dist/tui.js"),
      await readFile("dist/tui.js", "utf8"),
      "Signed fixture must match canonical output",
    );
    const options = (name) => ({
      ignoreScripts: true,
      Arborist,
      cache: join(directory, `${name}-cache`),
      npmBin: join(directory, "unavailable-npm-cli.js"),
    });
    const spec = (ref) =>
      `git+${pathToFileURL(repo).href}#${git("-C", repo, "rev-parse", ref).trim()}`;
    const originalDestination = join(directory, "original");
    await pacote.extract(
      spec("baseline"),
      originalDestination,
      options("original"),
    );
    const extractedOriginal = JSON.parse(
      await readFile(join(originalDestination, "package.json"), "utf8"),
    );
    assert.equal(extractedOriginal.exports["./tui"], "./src/tui.tsx");
    assert.throws(() =>
      assert.equal(extractedOriginal.exports["./tui"], "./dist/tui.js"),
    );
    assert.equal(
      await readFile(join(originalDestination, "src/tui.tsx"), "utf8"),
      originalSource,
    );
    await assert.rejects(
      pacote.extract(
        spec("preparation-trap"),
        join(directory, "red"),
        options("red"),
      ),
      (error) =>
        error.message === "git dep preparation failed" &&
        String(error.stderr).includes("unavailable-npm-cli.js"),
    );
    const destination = join(directory, "green");
    await pacote.extract(spec("corrected"), destination, options("green"));
    const installed = JSON.parse(
      await readFile(join(destination, "package.json"), "utf8"),
    );
    assert.equal(installed.exports["./tui"], "./dist/tui.js");
    assert.equal(
      await readFile(join(destination, "dist/tui.js"), "utf8"),
      await readFile("dist/tui.js", "utf8"),
    );
    execFileSync(
      process.execPath,
      ["--check", join(destination, "dist/tui.js")],
      { stdio: "pipe" },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
