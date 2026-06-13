# ADR 0026: UI Primitive Adoption and Customization Rules

**Status:** Accepted  
**Date:** 2026-06-13  

## Context

Following the migration of raw `<button>` elements to the `<Button>` primitive (as outlined in ADR 0025), two main issues were identified in code reviews:
1. **Primitive Abuse on Domain Elements:** The `<Button>` primitive was applied to highly custom, clickable domain elements (such as bracket team selectors, slot rows, tab triggers, and small red inline text actions). This forced heavy stylistic overrides on the `<Button>` element to erase its default button visuals.
2. **Stylistic ClassName Pollution:** Custom styles (like border radius `rounded-xl` / `rounded-full`, custom height overrides `!h-9`, padding adjustments `!py-1 !px-4`, and custom hover colors) were being passed directly via `className` to the `<Button>` component instead of being parameterized.

We need clear rules to maintain the integrity of UI primitives and prevent regression into hand-rolled styles via `className` overrides.

## Decision

1. **Distinction Between UI Primitives and Clickable Domain Elements:**
   - **UI Primitives** (e.g., `<Button>` in `src/components/ui/button.tsx`) are reserved for standard, reusable actions (e.g., "Save", "Submit", "Cancel", "Delete", "Add Bet", "Theme Switcher", "Locale Switcher").
   - **Clickable Domain Elements** (e.g., tournament brackets, team rows, selectable slots, custom tab/segment control triggers, inline table links) are NOT standard buttons. They have complex nested contents and custom styling, and must remain as raw `<button>` elements.

2. **Strict Customization Rules for Primitives:**
   - Overriding standard styles of UI Primitives (like background color, border radius, custom padding, shadows, hover colors, etc.) using `className` is **strictly prohibited**.
   - **Layout/Sizing Exception:** Layout classes (such as `w-full`, margins, `gap`, or `whitespace-nowrap`) are permitted in `className`.
   - **Variants and Sizes:** Any stylistic variation of a primitive (such as `rounded-xl`, `rounded-full`, or compact height/padding configurations like `sm-compact`) must be declared as a **variant** or **size** inside the component's CVA definition (e.g., `src/components/ui/button.tsx`) rather than applied as ad-hoc classes.

## Consequences

- Primitives remain clean, predictable, and fully aligned with `DESIGN.md` design tokens.
- We avoid style leaks and hard-to-maintain `!important` classes.
- Complex interactive domain controls do not fight the default visual constraints of general-purpose buttons.
