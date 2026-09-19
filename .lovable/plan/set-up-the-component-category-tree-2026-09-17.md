# Set up the component category tree

Your category list is currently empty (0 categories, 0 components). This adds your full two-level taxonomy so parts can be filed correctly from day one.

## What you get

12 top-level groups, each with its subcategories, in the order you listed:

1. Resistor/Pot — Automotive SMD, Industrial SMD, TH 1/5%, Potentiometer
2. Capacitor — Ceramic, Electrolytic, Tantalum, Film
3. Inductor/FB — Inductor, Ferrite Bead, Choke (Inductor), RF Filter (Inductor), Crystal
4. Transistor/Diode — MOSFET, BJT, Diode, LED
5. IC/MCU/Reg — Logic, MCU, Communication, Battery IC, Power, Memory IC
6. Connector/Switch — Battery Connector, USB, Holder, Heat sink, Header, Relay, Switch
7. Module/Boards — Power Supply, RF/Wireless, Sensor Module, Display, EVK Board
8. PCB/Harness — Bare PCB, Ready PCB, Harness
9. Tools/Wires — Electronics, Adapters, Mechanical, Wiring, Shrink Sleeve
10. Fuse/ESD/Filter — Fuse, Choke (Filter), RF Filter (ESD), ESD
11. Motor/Sensor/RF — Thermistor, Antenna, Sensor, Motor, Buzzer

Plus a required "Uncategorized" group that the app uses as a safe fallback (for example when a category is deleted or an import can't decide) — it can't be removed.

These appear immediately in the sidebar, in the Add/Edit component picker, in the AI auto-categorisation during part lookup and invoice import, and on Settings > Categories where you can still rename, reorder or add more.

## Technical details

- One migration inserting into `public.categories` with the exact slugs you gave, `parent_id` linking children to their group, and `sort_order` following your listed order (1..n within each level).
- Parents get a Lucide `icon` name each (e.g. Zap, Battery, Cpu, CircuitBoard, Plug, Wrench, ShieldAlert, Gauge); subcategories get none, matching the existing top-level-only icon convention.
- `Uncategorized` is inserted as a top-level row with slug `uncategorized`, sort_order last, protected by the existing `prevent_uncategorized_category_delete` trigger.
- Idempotent: `ON CONFLICT`-safe inserts keyed by slug, so re-running does not duplicate rows.
- No schema changes, no application code changes.
