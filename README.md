# OpenCode timezone clocks

A Solid/OpenTUI plugin providing clocks, a calendar and durable timezone selection.
The `./tui` export is committed JavaScript in `dist/tui.js`. Solid JSX is compiled
with Babel's universal transform targeting `@opentui/solid`; host runtime imports
remain external. React is not needed or bundled.

## Clocks

Each clock is rendered in three fixed-width columns — label, timezone code and
`HH:MM:SS` — so every time lines up vertically. Long labels are truncated with an
ellipsis rather than wrapping the sidebar.

Each clock's time takes a different colour from the host theme's categorical
palette (`context.theme.categorical`), cycling through it and adapting its shade
to the active theme mode. The label and code stay in the theme's base and muted
text colours.

## Customising clocks

Run `/clocks` (alias `/tz`), or pick **Configure timezone clocks** from the
command palette. The dialog loops until you press Esc and offers:

- toggling any preset clock on or off;
- adding a custom IANA timezone, e.g. `Europe/Amsterdam`, validated before it is
  accepted;
- adding a UTC-offset zone, e.g. `7`, `+5:30`, `-3` or `UTC+07:00`, for sites
  that are not a named IANA zone;
- renaming any clock, so a city label can become a team or site name;
- resetting the list to this machine's local timezone.

Selection and labels are stored in a hand-editable file:

```jsonc title="~/.config/opencode/timezone-clocks.json"
{
  "version": 1,
  "zones": [
    { "id": "Europe/London", "label": "London" },
    { "id": "Asia/Kolkata", "label": "Bangalore" },
    { "id": "UTC+05:30", "offset": 330, "label": "Offshore ops" },
  ],
}
```

`id` is an IANA zone name, or `UTC±HH:MM` when `offset` (minutes east of UTC) is
set. `label` is optional and defaults to the preset city name. A malformed or
missing file falls back to the local timezone; the previous plugin-storage
selection is migrated into the file on first run.

## Collapsed by default

The clocks section and its calendar start collapsed, so the sidebar stays quiet
until you open them. Click the section header to expand or collapse it.

Set `collapsedByDefault` to `false` in the plugin options to start expanded
instead:

```jsonc title="cli.json"
{
  "plugins": [
    {
      "package": "craig-dougan-maersk/opencode-timezone-clocks",
      "options": { "collapsedByDefault": true },
    },
  ],
}
```

Absent or `true` keeps the collapsed default.

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
fails extraction. The corrected fixture carries the canonical manifest, source
and compiled output, and is matched exactly by the suite. CI reads signed fixture
objects; no signing key is needed there.

Two unsupported duplicate `onClick` header props are removed in the shipped
source while retaining `onMouseDown`. The aligned columns, categorical colours,
timezone/label configuration and config-file read/write are covered only by
structural assertions on the compiled output: these packaging checks do not
certify live rendering, clock updates, calendar rollover, mouse toggles, reload
persistence, dialog flows or host runtime security. No plugin setup is executed
by tests.

API reference: https://opencode.ai/v2/docs/build/plugins/cli
