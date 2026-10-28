# OpenCode timezone clocks

A Solid/OpenTUI plugin providing clocks, a calendar and durable timezone selection.
The `./tui` export is committed JavaScript in `dist/tui.js`. Solid JSX is compiled
with Babel's universal transform targeting `@opentui/solid`; host runtime imports
remain external. React is not needed or bundled.

## Development

Use Node 26 and npm 11 (matching verification), then:

```sh
npm ci --ignore-scripts
npm audit
npm run typecheck
npm run compile
npm run build:check
npm run test:coverage
```

Commit regenerated `dist/tui.js` with source changes. `compile` is deliberately
explicit: never add exact `build`, `prepare`, `prepack`, installation hooks or
`workspaces`. npm Git dependency preparation can invoke npm even with scripts
disabled. Consumers need neither Babel nor a preparation step. Packages include
only the manifest, README and compiled distribution.

## Security boundary

The root Seroval 1.6.8 override protects this repository's maintainer/development
and CI install only. npm ignores overrides in dependency packages. This package
does **not** patch downstream installs or externally supplied OpenCode/OpenTUI
host runtimes. Consumer and host owners need their own reviewed root resolution
or a compatible patched host/OpenTUI release. Existing host dependency and peer
declarations are unchanged.

## Verification scope

Tests validate JavaScript syntax, external runtime imports, compiler freshness,
scripts-disabled archives, and actual Git extraction with an unavailable npm
sentinel. The signed original fixture extracts successfully but fails the
compiled-export contract; a separate synthetic preparation-trigger fixture
fails extraction. The corrected fixture matches this exact manifest/output and
extracts without invoking npm. CI reads signed fixture objects; no signing key
is needed there.

Storage, timezone selection and timer cleanup remain unchanged apart from
formatting. Two unsupported duplicate `onClick` header props are removed while
retaining `onMouseDown`. These packaging checks do not certify live rendering,
clock updates, calendar rollover, mouse toggles, reload persistence or host
runtime security. No plugin setup is executed by tests.

API reference: https://opencode.ai/v2/docs/build/plugins/cli
