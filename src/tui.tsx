import { Plugin, usePlugin } from "@opencode/plugin/tui";
import { createSignal, For, Show } from "solid-js";
import { TextAttributes } from "@opentui/core";

type Zone = { id: string; label?: string; offset?: number };
type Config = { version: number; zones: Zone[] };

const ZONES = [
  { id: "UTC", city: "UTC", code: "UTC" },
  { id: "America/New_York", city: "New York", code: "ET" },
  { id: "America/Chicago", city: "Chicago", code: "CT" },
  { id: "America/Denver", city: "Denver", code: "MT" },
  { id: "America/Los_Angeles", city: "Los Angeles", code: "PT" },
  { id: "Europe/London", city: "London", code: "GMT" },
  { id: "Europe/Paris", city: "Paris", code: "CET" },
  { id: "Europe/Berlin", city: "Berlin", code: "CET" },
  { id: "Asia/Kolkata", city: "Kolkata", code: "IST" },
  { id: "Asia/Tokyo", city: "Tokyo", code: "JST" },
  { id: "Asia/Shanghai", city: "Shanghai", code: "CST" },
  { id: "Australia/Sydney", city: "Sydney", code: "AEST" },
  { id: "Pacific/Auckland", city: "Auckland", code: "NZST" },
];

const CONFIG_FILE = "timezone-clocks.json";
// Sidebar columns stay fixed width so every clock's time lines up vertically.
const LABEL_MIN = 5;
const LABEL_MAX = 14;
const CODE_MIN = 2;
const CODE_MAX = 8;

function currentTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function preset(id: string) {
  return ZONES.find((z) => z.id === id);
}

function defaultLabel(id: string) {
  const known = preset(id);
  if (known) return known.city;
  const tail = id.split("/").pop() || id;
  return tail.replace(/_/g, " ");
}

function zoneLabel(zone: Zone) {
  const custom = typeof zone.label === "string" ? zone.label.trim() : "";
  return custom || defaultLabel(zone.id);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// Pads (or truncates with an ellipsis) to an exact width so columns align.
function pad(value: string, width: number) {
  if (width <= 0) return "";
  if (value.length > width) {
    return width === 1 ? "…" : value.slice(0, width - 1) + "…";
  }
  return value + " ".repeat(width - value.length);
}

function validIana(id: string) {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: id });
    return true;
  } catch {
    return false;
  }
}

// Accepts 7, +7, -3, 5:30, +05:30, UTC+07:00; returns minutes east of UTC.
function parseOffset(input: string): number | null {
  const cleaned = input.trim().replace(/^(?:UTC|GMT)\s*/i, "");
  if (!cleaned) return null;
  const match = /^([+-])?\s*(\d{1,2})(?::?(\d{2}))?$/.exec(cleaned);
  if (!match) return null;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  if (hours > 14 || minutes > 59) return null;
  const total = (match[1] === "-" ? -1 : 1) * (hours * 60 + minutes);
  return total < -720 || total > 840 ? null : total;
}

function offsetId(offset: number) {
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

function offsetLabelText(offset: number) {
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  const hh = Math.floor(abs / 60);
  const mm = abs % 60;
  return mm
    ? `UTC${sign}${hh}:${String(mm).padStart(2, "0")}`
    : `UTC${sign}${hh}`;
}

function formatTime(tz: string, now: number) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now);
  } catch {
    return "--:--:--";
  }
}

function formatOffsetTime(offset: number, now: number) {
  const shifted = new Date(now + offset * 60000);
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  const ss = String(shifted.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function zoneTime(zone: Zone, now: number) {
  return typeof zone.offset === "number"
    ? formatOffsetTime(zone.offset, now)
    : formatTime(zone.id, now);
}

function tzCode(tz: string, now: number) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(now);
    return parts.find((p) => p.type === "timeZoneName")?.value || tz;
  } catch {
    return tz;
  }
}

function zoneCode(zone: Zone, now: number) {
  if (typeof zone.offset === "number") return offsetLabelText(zone.offset);
  const known = preset(zone.id);
  if (known) return known.code;
  return tzCode(zone.id, now);
}

// A distinct theme colour per clock; the palette is guaranteed non-empty.
function zoneColour(index: number, theme: any, mode: string) {
  const fallback = theme?.text?.base;
  const palette = theme?.categorical;
  if (!Array.isArray(palette) || !palette.length) return fallback;
  const scale = palette[index % palette.length];
  const step = mode === "dark" ? 400 : 600;
  return scale?.[step] ?? scale?.[500] ?? fallback;
}

function normaliseZones(raw: unknown): Zone[] | null {
  if (!Array.isArray(raw)) return null;
  const zones: Zone[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      if (validIana(entry)) zones.push({ id: entry });
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const label = typeof record.label === "string" ? record.label : undefined;
    if (typeof record.offset === "number" && Number.isFinite(record.offset)) {
      const offset = Math.round(record.offset);
      zones.push({ id: id || offsetId(offset), offset, label });
      continue;
    }
    if (id && validIana(id)) zones.push({ id, label });
  }
  return zones.length ? zones : null;
}

function calendarData(now: number) {
  const d = new Date(now);
  const year = d.getFullYear();
  const month = d.getMonth();
  const date = d.getDate();
  const monthName = d.toLocaleString("en-US", { month: "long" });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dow = d.toLocaleString("en-US", { weekday: "long" });

  const rows: (number | null)[][] = [];
  let row: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) row.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    row.push(day);
    if (row.length === 7) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length) {
    while (row.length < 7) row.push(null);
    rows.push(row);
  }
  return { year, month, date, monthName, dow, rows };
}

export default Plugin.define({
  id: "timezone.clocks",
  async setup(context: any) {
    const local = currentTimeZone();

    // Retained only to migrate the previous string[] selection into the JSON file.
    const [legacy] = context.storage.store("settings", {
      initial: { zones: [local] },
    });

    const fs: any = await import("node:fs");
    const os: any = await import("node:os");
    const dir = `${os.homedir()}/.config/opencode`;
    const file = `${dir}/${CONFIG_FILE}`;

    function readConfig(): Config | null {
      try {
        const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
        const zones = normaliseZones(parsed?.zones);
        return zones ? { version: 1, zones } : null;
      } catch {
        return null;
      }
    }

    function writeConfig(config: Config) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
      } catch {}
    }

    let initial = readConfig();
    if (!initial) {
      const migrated = normaliseZones(legacy?.zones);
      initial = { version: 1, zones: migrated ?? [{ id: local }] };
      writeConfig(initial);
    }

    const [config, setConfig] = createSignal<Config>(initial);
    const [now, setNow] = createSignal(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);

    async function persist(zones: Zone[]) {
      const next = { version: 1, zones };
      setConfig(next);
      writeConfig(next);
    }

    // Configurable via cli.json/opencode.json plugin options; collapsed unless
    // explicitly expanded with { "collapsedByDefault": false }.
    const collapsedByDefault = context.options?.collapsedByDefault !== false;
    const [open, setOpen] = createSignal(!collapsedByDefault);
    const [calendarOpen, setCalendarOpen] = createSignal(!collapsedByDefault);

    // Returns null when the prompt was cancelled, otherwise the trimmed text
    // (empty means "keep the default label").
    async function askLabel(
      defaultText: string,
      currentText?: string,
    ): Promise<string | null> {
      const label = await context.ui.dialog.prompt({
        title: "Label",
        description: `Shown in the sidebar (blank keeps "${defaultText}")`,
        value: currentText ?? "",
        placeholder: defaultText,
      });
      return label === undefined ? null : label.trim();
    }

    async function addIana() {
      const id = await context.ui.dialog.prompt({
        title: "IANA timezone",
        description: "e.g. Europe/Amsterdam, America/Sao_Paulo",
        placeholder: "Continent/City",
      });
      if (id === undefined) return;
      const trimmed = id.trim();
      if (!trimmed) return;
      if (!validIana(trimmed)) {
        await context.ui.dialog.alert({
          title: "Unrecognised timezone",
          message: `"${trimmed}" is not a valid IANA timezone name.`,
        });
        return;
      }
      if (config().zones.some((z) => z.id === trimmed)) {
        await context.ui.dialog.alert({
          title: "Already configured",
          message: `${trimmed} is already in the clocks list.`,
        });
        return;
      }
      const label = await askLabel(defaultLabel(trimmed));
      if (label === null) return;
      await persist([
        ...config().zones,
        { id: trimmed, label: label || undefined },
      ]);
    }

    async function addOffset() {
      const raw = await context.ui.dialog.prompt({
        title: "UTC offset",
        description: "e.g. 7, +5:30, -3, UTC+07:00",
        placeholder: "+5:30",
      });
      if (raw === undefined) return;
      const offset = parseOffset(raw);
      if (offset === null) {
        await context.ui.dialog.alert({
          title: "Unrecognised offset",
          message: `"${raw.trim()}" is not a UTC offset between -12:00 and +14:00.`,
        });
        return;
      }
      const label = await askLabel(offsetLabelText(offset));
      if (label === null) return;
      await persist([
        ...config().zones,
        { id: offsetId(offset), offset, label: label || undefined },
      ]);
    }

    async function rename() {
      const zones = config().zones;
      const choice = await context.ui.dialog.select({
        title: "Rename which clock?",
        options: zones.map((zone, index) => ({
          title: `${zoneLabel(zone)} · ${zoneCode(zone, Date.now())}`,
          value: String(index),
        })),
      });
      if (choice === undefined) return;
      const index = Number(choice);
      const zone = zones[index];
      if (!zone) return;
      const label = await askLabel(defaultLabel(zone.id), zone.label);
      if (label === null) return;
      await persist(
        zones.map((z, idx) =>
          idx === index ? { ...z, label: label || undefined } : z,
        ),
      );
    }

    async function reset() {
      const confirmed = await context.ui.dialog.confirm({
        title: "Reset clocks",
        message: "Replace the clock list with this machine's local timezone?",
        label: { confirm: "Reset", cancel: "Cancel" },
      });
      if (!confirmed) return;
      await persist([{ id: local }]);
    }

    async function configure() {
      for (;;) {
        const zones = config().zones;
        const active = new Set(zones.map((z) => z.id));
        const options = [
          ...zones.map((zone, index) => ({
            title: `✓ ${zoneLabel(zone)} · ${zoneCode(zone, Date.now())}`,
            value: `off:${index}`,
          })),
          ...ZONES.filter((p) => !active.has(p.id)).map((p) => ({
            title: `  ${p.city} · ${p.code}`,
            value: `on:${p.id}`,
          })),
          { title: "＋ Add IANA timezone…", value: "add-iana" },
          { title: "＋ Add UTC-offset zone…", value: "add-offset" },
          { title: "✎ Rename a clock…", value: "rename" },
          { title: "↺ Reset to local time", value: "reset" },
        ];
        const choice = await context.ui.dialog.select({
          title: "Timezone clocks (Esc to finish)",
          options,
        });
        if (choice === undefined) return;
        if (choice === "add-iana") {
          await addIana();
          continue;
        }
        if (choice === "add-offset") {
          await addOffset();
          continue;
        }
        if (choice === "rename") {
          await rename();
          continue;
        }
        if (choice === "reset") {
          await reset();
          continue;
        }
        if (choice.startsWith("on:")) {
          await persist([...config().zones, { id: choice.slice(3) }]);
          continue;
        }
        if (choice.startsWith("off:")) {
          const current = config().zones;
          if (current.length <= 1) {
            await context.ui.dialog.alert({
              title: "At least one clock",
              message: "Add another clock before removing the last one.",
            });
            continue;
          }
          const index = Number(choice.slice(4));
          await persist(current.filter((_, idx) => idx !== index));
          continue;
        }
      }
    }

    context.ui.slot({
      prepend: "sidebar.content",
      render: () => {
        const ctx = usePlugin();
        const nowVal = now();
        return (
          <box flexDirection="column" marginTop={1}>
            <box
              onMouseDown={(e: any) => {
                try {
                  e?.stopPropagation?.();
                } catch {}
                setOpen(!open());
              }}
            >
              <text fg={ctx.theme.text.base} attributes={TextAttributes.BOLD}>
                {(open() ? "▼ " : "▶ ") + "Clocks"}
              </text>
            </box>
            <Show when={open()}>
              <box flexDirection="column" paddingLeft={1}>
                {(() => {
                  const rows = config().zones.map((zone) => ({
                    zone,
                    label: zoneLabel(zone),
                    code: zoneCode(zone, nowVal),
                  }));
                  const labelWidth = clamp(
                    rows.reduce(
                      (max, row) => Math.max(max, row.label.length),
                      0,
                    ),
                    LABEL_MIN,
                    LABEL_MAX,
                  );
                  const codeWidth = clamp(
                    rows.reduce(
                      (max, row) => Math.max(max, row.code.length),
                      0,
                    ),
                    CODE_MIN,
                    CODE_MAX,
                  );
                  return (
                    <For each={rows}>
                      {(row, index) => (
                        <box flexDirection="row">
                          <text width={labelWidth + 1} fg={ctx.theme.text.base}>
                            {pad(row.label, labelWidth) + " "}
                          </text>
                          <text width={codeWidth + 1} fg={ctx.theme.text.muted}>
                            {pad(row.code, codeWidth) + " "}
                          </text>
                          <text
                            fg={zoneColour(index(), ctx.theme, ctx.themeMode)}
                          >
                            {zoneTime(row.zone, nowVal)}
                          </text>
                        </box>
                      )}
                    </For>
                  );
                })()}
              </box>
            </Show>

            <box
              marginTop={1}
              onMouseDown={(e: any) => {
                try {
                  e?.stopPropagation?.();
                } catch {}
                setCalendarOpen(!calendarOpen());
              }}
            >
              <text fg={ctx.theme.text.base} attributes={TextAttributes.BOLD}>
                {(calendarOpen() ? "▼ " : "▶ ") + "Calendar"}
              </text>
            </box>
            <Show when={calendarOpen()}>
              <box flexDirection="column" paddingLeft={1}>
                {(() => {
                  const cal = calendarData(nowVal);
                  return (
                    <box flexDirection="column">
                      <text
                        fg={ctx.theme.text.base}
                      >{`${cal.monthName} ${cal.year}`}</text>
                      <text fg={ctx.theme.text.muted}>
                        {"Su Mo Tu We Th Fr Sa"}
                      </text>
                      <For each={cal.rows}>
                        {(week: (number | null)[]) => (
                          <box flexDirection="row">
                            <For each={week}>
                              {(day: number | null) => (
                                <text
                                  width={3}
                                  fg={
                                    day === cal.date
                                      ? ctx.theme.text.success
                                      : ctx.theme.text.muted
                                  }
                                  attributes={
                                    day === cal.date ? TextAttributes.BOLD : 0
                                  }
                                >
                                  {day
                                    ? String(day).padStart(2, " ") + " "
                                    : "   "}
                                </text>
                              )}
                            </For>
                          </box>
                        )}
                      </For>
                      <text
                        fg={ctx.theme.text.muted}
                      >{`${cal.dow}, ${cal.monthName} ${cal.date}, ${cal.year}`}</text>
                    </box>
                  );
                })()}
              </box>
            </Show>
          </box>
        );
      },
    });

    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "timezone.clocks.configure",
          title: "Configure timezone clocks",
          group: "Clocks",
          palette: true,
          slash: { name: "clocks", aliases: ["tz"] },
          run: async () => {
            await configure();
          },
        },
      ],
    }));

    return () => clearInterval(timer);
  },
});
