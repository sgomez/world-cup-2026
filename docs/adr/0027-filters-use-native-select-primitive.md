# ADR 0027: Filters Use a Native `<select>` Primitive, Not a Custom Listbox

**Status:** Accepted  
**Date:** 2026-06-14

The filter controls (calendar team/phase filters, admin score/import pickers) are
backed by a `Select` UI primitive that wraps a real native `<select>` element. It
exposes an optional `icon` slot (defaulting to a `ChevronDown` adornment) and accepts
`<option>` children. It is deliberately distinct from the existing `dropdown-menu`
primitive, which is a Radix *action menu* (a list of commands), not a value picker.

## Considered Options

**Native `<select>` wrapper (chosen).** A thin styled wrapper over the browser's own
`<select>`. Accessibility, keyboard handling, typeahead, and the native mobile picker
come for free; bundle cost is ~zero. The cost: option contents cannot be styled —
browsers render `<option>` as plain text, so no flags or `TeamBadge` inside the list.
Accepted because every current filter is plain text and matches the mockups.

**Radix `@radix-ui/react-select`.** A custom listbox rendered into a popover; `SelectItem`
can hold arbitrary JSX (flags, badges). Rejected for now because it adds a popover + dep
for item styling we do not currently need, and loses the native mobile picker.

**React Aria / HeroUI-style select.** Same rich-item capability as Radix, and keeps a
visually-hidden native `<select>` for form semantics and a mobile fallback. Rejected for
the same reason — it solves a problem (styled items) the filters do not have yet.

## Consequences

- One `Select` primitive serves all four consumers (calendar ×2, admin import, admin
  score editor). `icon` covers the "with/without icon" filter variants; omitting it
  renders a default `ChevronDown`.
- Filter option lists are plain text only. A flag-in-dropdown design is **not** possible
  on this primitive.
- If rich-item pickers are ever required, add a **separate `Combobox`** primitive on
  Radix Select (or React Aria) rather than overloading `Select`. The two coexist; `Select`
  stays native.
- The naming split is intentional: `Select` = pick a value; `dropdown-menu` = pick an
  action. A future rename of `dropdown-menu` → `menu` is noted but out of scope here.
