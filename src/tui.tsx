import { Plugin, usePlugin } from "@opencode/plugin/tui"
import { createSignal, createResource, For, Show } from "solid-js"
import { TextAttributes } from "@opentui/core"

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
]

function zoneInfo(id: string) {
  return ZONES.find((z) => z.id === id) || { id, city: id, code: id }
}

function formatTime(tz: string, now: number) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now)
  } catch {
    return "--:--:--"
  }
}

function tzCode(tz: string, now: number) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(now)
    return parts.find((p) => p.type === "timeZoneName")?.value || tz
  } catch {
    return tz
  }
}

function calendarData(now: number) {
  const d = new Date(now)
  const year = d.getFullYear()
  const month = d.getMonth()
  const date = d.getDate()
  const monthName = d.toLocaleString("en-US", { month: "long" })
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const dow = d.toLocaleString("en-US", { weekday: "long" })

  const rows: (number | null)[][] = []
  let row: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) row.push(null)
  for (let day = 1; day <= daysInMonth; day++) {
    row.push(day)
    if (row.length === 7) {
      rows.push(row)
      row = []
    }
  }
  if (row.length) {
    while (row.length < 7) row.push(null)
    rows.push(row)
  }
  return { year, month, date, monthName, dow, rows }
}

export default Plugin.define({
  id: "timezone.clocks",
  setup(context: any) {
    const currentTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    const [now, setNow] = createSignal(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)

    const [settings, updateSettings] = context.storage.store("settings", {
      initial: { zones: [currentTz] },
    })

    const zones = () => (settings?.zones && settings.zones.length ? settings.zones : [currentTz])

    const [open, setOpen] = createSignal(true)
    const [calendarOpen, setCalendarOpen] = createSignal(true)

    async function configure() {
      for (;;) {
        const selected = new Set(zones())
        const opts = ZONES.map((z) => ({
          title: `${selected.has(z.id) ? "✓ " : "  "}${z.city} (${z.code})`,
          value: z.id,
        }))
        if (!ZONES.find((z) => z.id === currentTz)) {
          opts.unshift({ title: `${selected.has(currentTz) ? "✓ " : "  "}${currentTz} (local)`, value: currentTz })
        }
        const choice = await context.ui.dialog.select({
          title: "Toggle timezone (Esc to finish)",
          options: opts,
        })
        if (!choice) return
        const next = new Set(selected)
        if (next.has(choice)) next.delete(choice)
        else next.add(choice)
        if (next.size === 0) next.add(currentTz)
        await updateSettings((draft: any) => {
          draft.zones = Array.from(next)
        })
      }
    }

    context.ui.slot({
      prepend: "sidebar.content",
      render: () => {
        const ctx = usePlugin()
        const nowVal = now()
        return (
          <box flexDirection="column" marginTop={1}>
            <box onClick={(e: any) => { try { e?.stopPropagation?.() } catch {}; setOpen(!open()) }} onMouseDown={(e: any) => { try { e?.stopPropagation?.() } catch {}; setOpen(!open()) }}>
              <text fg={ctx.theme.text.base} attributes={TextAttributes.BOLD}>{(open() ? "▼ " : "▶ ") + "Clocks"}</text>
            </box>
            <Show when={open()}>
              <box flexDirection="column" paddingLeft={1}>
                <For each={zones()}>
                  {(tz: string) => {
                    const info = zoneInfo(tz)
                    const code = tzCode(tz, nowVal)
                    return (
                      <text fg={ctx.theme.text.base}>
                        {`${info.city} (${code}): ${formatTime(tz, nowVal)}`}
                      </text>
                    )
                  }}
                </For>
              </box>
            </Show>

            <box marginTop={1} onClick={(e: any) => { try { e?.stopPropagation?.() } catch {}; setCalendarOpen(!calendarOpen()) }} onMouseDown={(e: any) => { try { e?.stopPropagation?.() } catch {}; setCalendarOpen(!calendarOpen()) }}>
              <text fg={ctx.theme.text.base} attributes={TextAttributes.BOLD}>{(calendarOpen() ? "▼ " : "▶ ") + "Calendar"}</text>
            </box>
            <Show when={calendarOpen()}>
              <box flexDirection="column" paddingLeft={1}>
                {(() => {
                  const cal = calendarData(nowVal)
                  return (
                    <box flexDirection="column">
                      <text fg={ctx.theme.text.base}>{`${cal.monthName} ${cal.year}`}</text>
                      <text fg={ctx.theme.text.muted}>{"Su Mo Tu We Th Fr Sa"}</text>
                      <For each={cal.rows}>
                        {(week: (number | null)[]) => (
                          <box flexDirection="row">
                            <For each={week}>
                              {(day: number | null) => (
                                <text
                                  width={3}
                                  fg={day === cal.date ? ctx.theme.text.success : ctx.theme.text.muted}
                                  attributes={day === cal.date ? TextAttributes.BOLD : 0}
                                >
                                  {day ? String(day).padStart(2, " ") + " " : "   "}
                                </text>
                              )}
                            </For>
                          </box>
                        )}
                      </For>
                      <text fg={ctx.theme.text.muted}>{`${cal.dow}, ${cal.monthName} ${cal.date}, ${cal.year}`}</text>
                    </box>
                  )
                })()}
              </box>
            </Show>
          </box>
        )
      },
    })

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
            await configure()
          },
        },
      ],
    }))

    return () => clearInterval(timer)
  },
})