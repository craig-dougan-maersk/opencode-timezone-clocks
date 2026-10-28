import { memo as _$memo } from "@opentui/solid";
import { createTextNode as _$createTextNode } from "@opentui/solid";
import { effect as _$effect } from "@opentui/solid";
import { createComponent as _$createComponent } from "@opentui/solid";
import { insertNode as _$insertNode } from "@opentui/solid";
import { insert as _$insert } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";
import { Plugin, usePlugin } from "@opencode/plugin/tui";
import { createSignal, For, Show } from "solid-js";
import { TextAttributes } from "@opentui/core";
const ZONES = [{
  id: "UTC",
  city: "UTC",
  code: "UTC"
}, {
  id: "America/New_York",
  city: "New York",
  code: "ET"
}, {
  id: "America/Chicago",
  city: "Chicago",
  code: "CT"
}, {
  id: "America/Denver",
  city: "Denver",
  code: "MT"
}, {
  id: "America/Los_Angeles",
  city: "Los Angeles",
  code: "PT"
}, {
  id: "Europe/London",
  city: "London",
  code: "GMT"
}, {
  id: "Europe/Paris",
  city: "Paris",
  code: "CET"
}, {
  id: "Europe/Berlin",
  city: "Berlin",
  code: "CET"
}, {
  id: "Asia/Kolkata",
  city: "Kolkata",
  code: "IST"
}, {
  id: "Asia/Tokyo",
  city: "Tokyo",
  code: "JST"
}, {
  id: "Asia/Shanghai",
  city: "Shanghai",
  code: "CST"
}, {
  id: "Australia/Sydney",
  city: "Sydney",
  code: "AEST"
}, {
  id: "Pacific/Auckland",
  city: "Auckland",
  code: "NZST"
}];
function zoneInfo(id) {
  return ZONES.find(z => z.id === id) || {
    id,
    city: id,
    code: id
  };
}
function formatTime(tz, now) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(now);
  } catch {
    return "--:--:--";
  }
}
function tzCode(tz, now) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short"
    }).formatToParts(now);
    return parts.find(p => p.type === "timeZoneName")?.value || tz;
  } catch {
    return tz;
  }
}
function calendarData(now) {
  const d = new Date(now);
  const year = d.getFullYear();
  const month = d.getMonth();
  const date = d.getDate();
  const monthName = d.toLocaleString("en-US", {
    month: "long"
  });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dow = d.toLocaleString("en-US", {
    weekday: "long"
  });
  const rows = [];
  let row = [];
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
  return {
    year,
    month,
    date,
    monthName,
    dow,
    rows
  };
}
export default Plugin.define({
  id: "timezone.clocks",
  setup(context) {
    const currentTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const [now, setNow] = createSignal(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const [settings, updateSettings] = context.storage.store("settings", {
      initial: {
        zones: [currentTz]
      }
    });
    const zones = () => settings?.zones && settings.zones.length ? settings.zones : [currentTz];

    // Configurable via cli.json/opencode.json plugin options; collapsed unless
    // explicitly expanded with { "collapsedByDefault": false }.
    const collapsedByDefault = context.options?.collapsedByDefault !== false;
    const [open, setOpen] = createSignal(!collapsedByDefault);
    const [calendarOpen, setCalendarOpen] = createSignal(!collapsedByDefault);
    async function configure() {
      for (;;) {
        const selected = new Set(zones());
        const opts = ZONES.map(z => ({
          title: `${selected.has(z.id) ? "✓ " : "  "}${z.city} (${z.code})`,
          value: z.id
        }));
        if (!ZONES.find(z => z.id === currentTz)) {
          opts.unshift({
            title: `${selected.has(currentTz) ? "✓ " : "  "}${currentTz} (local)`,
            value: currentTz
          });
        }
        const choice = await context.ui.dialog.select({
          title: "Toggle timezone (Esc to finish)",
          options: opts
        });
        if (!choice) return;
        const next = new Set(selected);
        if (next.has(choice)) next.delete(choice);else next.add(choice);
        if (next.size === 0) next.add(currentTz);
        await updateSettings(draft => {
          draft.zones = Array.from(next);
        });
      }
    }
    context.ui.slot({
      prepend: "sidebar.content",
      render: () => {
        const ctx = usePlugin();
        const nowVal = now();
        return (() => {
          var _el$ = _$createElement("box"),
            _el$2 = _$createElement("box"),
            _el$3 = _$createElement("text"),
            _el$5 = _$createElement("box"),
            _el$6 = _$createElement("text");
          _$insertNode(_el$, _el$2);
          _$insertNode(_el$, _el$5);
          _$setProp(_el$, "flexDirection", "column");
          _$setProp(_el$, "marginTop", 1);
          _$insertNode(_el$2, _el$3);
          _$setProp(_el$2, "onMouseDown", e => {
            try {
              e?.stopPropagation?.();
            } catch {}
            setOpen(!open());
          });
          _$insert(_el$3, () => (open() ? "▼ " : "▶ ") + "Clocks");
          _$insert(_el$, _$createComponent(Show, {
            get when() {
              return open();
            },
            get children() {
              var _el$4 = _$createElement("box");
              _$setProp(_el$4, "flexDirection", "column");
              _$setProp(_el$4, "paddingLeft", 1);
              _$insert(_el$4, _$createComponent(For, {
                get each() {
                  return zones();
                },
                children: tz => {
                  const info = zoneInfo(tz);
                  const code = tzCode(tz, nowVal);
                  return (() => {
                    var _el$8 = _$createElement("text");
                    _$insert(_el$8, () => `${info.city} (${code}): ${formatTime(tz, nowVal)}`);
                    _$effect(_$p => _$setProp(_el$8, "fg", ctx.theme.text.base, _$p));
                    return _el$8;
                  })();
                }
              }));
              return _el$4;
            }
          }), _el$5);
          _$insertNode(_el$5, _el$6);
          _$setProp(_el$5, "marginTop", 1);
          _$setProp(_el$5, "onMouseDown", e => {
            try {
              e?.stopPropagation?.();
            } catch {}
            setCalendarOpen(!calendarOpen());
          });
          _$insert(_el$6, () => (calendarOpen() ? "▼ " : "▶ ") + "Calendar");
          _$insert(_el$, _$createComponent(Show, {
            get when() {
              return calendarOpen();
            },
            get children() {
              var _el$7 = _$createElement("box");
              _$setProp(_el$7, "flexDirection", "column");
              _$setProp(_el$7, "paddingLeft", 1);
              _$insert(_el$7, () => {
                const cal = calendarData(nowVal);
                return (() => {
                  var _el$9 = _$createElement("box"),
                    _el$0 = _$createElement("text"),
                    _el$1 = _$createElement("text"),
                    _el$11 = _$createElement("text");
                  _$insertNode(_el$9, _el$0);
                  _$insertNode(_el$9, _el$1);
                  _$insertNode(_el$9, _el$11);
                  _$setProp(_el$9, "flexDirection", "column");
                  _$insert(_el$0, () => `${cal.monthName} ${cal.year}`);
                  _$insertNode(_el$1, _$createTextNode(`Su Mo Tu We Th Fr Sa`));
                  _$insert(_el$9, _$createComponent(For, {
                    get each() {
                      return cal.rows;
                    },
                    children: week => (() => {
                      var _el$12 = _$createElement("box");
                      _$setProp(_el$12, "flexDirection", "row");
                      _$insert(_el$12, _$createComponent(For, {
                        each: week,
                        children: day => (() => {
                          var _el$13 = _$createElement("text");
                          _$setProp(_el$13, "width", 3);
                          _$insert(_el$13, () => day ? String(day).padStart(2, " ") + " " : "   ");
                          _$effect(_p$ => {
                            var _v$8 = day === cal.date ? ctx.theme.text.success : ctx.theme.text.muted,
                              _v$9 = day === cal.date ? TextAttributes.BOLD : 0;
                            _v$8 !== _p$.e && (_p$.e = _$setProp(_el$13, "fg", _v$8, _p$.e));
                            _v$9 !== _p$.t && (_p$.t = _$setProp(_el$13, "attributes", _v$9, _p$.t));
                            return _p$;
                          }, {
                            e: undefined,
                            t: undefined
                          });
                          return _el$13;
                        })()
                      }));
                      return _el$12;
                    })()
                  }), _el$11);
                  _$insert(_el$11, () => `${cal.dow}, ${cal.monthName} ${cal.date}, ${cal.year}`);
                  _$effect(_p$ => {
                    var _v$5 = ctx.theme.text.base,
                      _v$6 = ctx.theme.text.muted,
                      _v$7 = ctx.theme.text.muted;
                    _v$5 !== _p$.e && (_p$.e = _$setProp(_el$0, "fg", _v$5, _p$.e));
                    _v$6 !== _p$.t && (_p$.t = _$setProp(_el$1, "fg", _v$6, _p$.t));
                    _v$7 !== _p$.a && (_p$.a = _$setProp(_el$11, "fg", _v$7, _p$.a));
                    return _p$;
                  }, {
                    e: undefined,
                    t: undefined,
                    a: undefined
                  });
                  return _el$9;
                })();
              });
              return _el$7;
            }
          }), null);
          _$effect(_p$ => {
            var _v$ = ctx.theme.text.base,
              _v$2 = TextAttributes.BOLD,
              _v$3 = ctx.theme.text.base,
              _v$4 = TextAttributes.BOLD;
            _v$ !== _p$.e && (_p$.e = _$setProp(_el$3, "fg", _v$, _p$.e));
            _v$2 !== _p$.t && (_p$.t = _$setProp(_el$3, "attributes", _v$2, _p$.t));
            _v$3 !== _p$.a && (_p$.a = _$setProp(_el$6, "fg", _v$3, _p$.a));
            _v$4 !== _p$.o && (_p$.o = _$setProp(_el$6, "attributes", _v$4, _p$.o));
            return _p$;
          }, {
            e: undefined,
            t: undefined,
            a: undefined,
            o: undefined
          });
          return _el$;
        })();
      }
    });
    context.keymap.layer(() => ({
      mode: "global",
      commands: [{
        id: "timezone.clocks.configure",
        title: "Configure timezone clocks",
        group: "Clocks",
        palette: true,
        slash: {
          name: "clocks",
          aliases: ["tz"]
        },
        run: async () => {
          await configure();
        }
      }]
    }));
    return () => clearInterval(timer);
  }
});
