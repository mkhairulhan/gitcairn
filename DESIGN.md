---
name: OSSVault
description: Sleek Local GitHub Repository Viewer & Manager for Windows 11
colors:
  primary: "#297AA0"
  primary-hover: "#2B7DA3"
  primary-active: "#3994BC"
  accent-muted: "#1E3A47"
  highlight: "#48A0C7"
  selection: "#276782"
  badge: "#307E9F"
  neutral-bg: "#121314"
  neutral-sidebar: "#191A1B"
  neutral-card: "#202122"
  neutral-surface: "#242526"
  border: "#2A2B2C"
  border-subtle: "#333536"
  text: "#bfbfbf"
  text-bright: "#ededed"
  text-muted: "#8C8C8C"
  text-disabled: "#555555"
typography:
  display:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0em"
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "Consolas, 'Fira Code', monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
  micro:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.01em"
rounded:
  sm: "2px"
  md: "4px"
  lg: "6px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-bright}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.text-bright}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  input-field:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.text-bright}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
---

# Design System: OSSVault

## Overview

**Creative North Star: "The Precision Observatory"**

OSSVault embodies a calm, deep charcoal instrument aesthetic focused on scannability, focused code and markdown reading, and zero-distraction desktop utility. Derived from the modern 2026 Dark specification, it trades generic stark blacks or overly vibrant purples for balanced warm-slate and charcoal surfaces elevated by restrained cerulean and cyan accents.

The interface prioritizes dense yet breathable desktop tool layouts. Every component—from the repository list and markdown previewer to the integrated Git sync terminal—exists to deliver instant local feedback without perceptual latency or decorative clutter.

**Key Characteristics:**
- **Restrained Focus:** Primary accents are reserved strictly for intentional actions (pulling, cloning, active tabs) and critical status indications.
- **Tonal Clarity:** Hierarchical depth is established purely through surface value progression (`#121314` -> `#191A1B` -> `#242526`) rather than heavy drop shadows.
- **Monospace Balance:** Code, commit SHAs, file sizes, and terminal logs share crisp monospace styling with readable tabular alignment.

## Colors

A balanced 2026 Dark palette of deep neutral charcoals illuminated by cool ocean-cyan and calm cerulean indicators.

### Primary
- **Observatory Cyan** (`#297AA0` / hover `#2B7DA3`): Primary call-to-action buttons, active operations, and progress indicators.
- **Electric Cyan Highlight** (`#48A0C7`): Interactive links, code peek headers, icons, and prominent status text.

### Neutral
- **Deep Canvas Void** (`#121314`): Editor body, code preview canvas, and main workspace background.
- **Chrome Charcoal** (`#191A1B`): Sidebar, title bar, sub-header bars, and terminal drawer background.
- **Surface Elevation** (`#242526`): Secondary buttons, card wrappers, code blocks, and hover backgrounds.
- **Structural Divider** (`#2A2B2C`): 1px borders between panels, table rules, and row separators.
- **Subtle Outline** (`#333536`): Inactive input strokes and scrollbar thumb idle state.
- **Primary Text** (`#bfbfbf`): Default body text and documentation prose.
- **Bright Headline Text** (`#ededed`): Active selection, headings, and high-emphasis labels.
- **Muted Subtext** (`#8C8C8C`): File sizes, commit relative timestamps, and secondary metadata.

### Named Rules
**The Rarity Rule.** Cyan accent colors appear on less than 5% of any viewport. If everything glows, nothing is actionable.
**The Ghost Border Fallback.** Surfaces never rely on contrast alone for edge definition; every panel boundary is delineated by a crisp 1px `#2A2B2C` border.

## Typography

**Display Font:** System UI (`system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`)
**Body Font:** System UI (`system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`)
**Label/Mono Font:** Consolas (`Consolas, 'Fira Code', monospace`)

**Character:** Clean, legible desktop interface sans-serif paired with classic high-legibility monospace for code, commit hashes, and file pathways.

### Hierarchy
- **Display** (Bold 700, 20px / 1.25rem, line-height 1.2): Repository names and main view headers.
- **Headline** (Semi-bold 600, 18px / 1.125rem, line-height 1.3): Section headers within README previews and dialogs.
- **Title** (Semi-bold 600, 14px / 0.875rem, line-height 1.4): Panel headings and repository item titles.
- **Body** (Regular 400, 12px / 0.75rem, line-height 1.5): Main application copy, list descriptions, and tooltips.
- **Label** (Medium 500, 11px / 0.6875rem, letter-spacing 0.02em): Badges, commit timestamps, tags, and status tags.

### Named Rules
**The Strict Monospace Boundary.** Monospace fonts are reserved exclusively for file paths, commit hashes, code blocks, and terminal streams. General UI chrome and button labels always use system sans.

## Layout

A modular three-pane desktop workspace built for high information density:
- **Left Sidebar:** Fixed 320px (`w-80`) panel containing quick filter, search, tags, and scrollable repository list.
- **Main Content:** Flexible canvas hosting markdown documentation, repository file trees, or Git activity timelines.
- **Collapsible Drawer:** 224px (`h-56`) bottom drawer for background Git pull/check operations and terminal logs.
- **Density:** Compact desktop spacing with 8px (`sm`) and 12px (`md`) row paddings for high data throughput without cramming.

## Elevation & Depth

OSSVault operates on a **Pure Tonal Layering** system. Traditional drop shadows and blurs are discarded in favor of architectural surface values.

- **Background Level 0 (`#121314`):** Base canvas and code peek workspace.
- **Surface Level 1 (`#191A1B`):** Side navigation, toolbars, and persistent chrome.
- **Surface Level 2 (`#202122` - `#242526`):** Floating controls, active filters, code blocks, and inputs.
- **Active Selection Overlay (`#276782` with 40% opacity):** Indicates active row selection paired with `#3994BC` border highlight.

### Named Rules
**The Zero Shadow Rule.** No drop shadows (`box-shadow`) are used on static interface elements. Depth is communicated strictly through background tone progression and 1px border lines.

## Shapes

- **Corner Radius:** Subtly rounded corners (`rounded` 4px for buttons, inputs, and cards; `rounded-full` 9999px for pill badges and status dots).
- **Dividers:** Crisp 1px solid dividers (`#2A2B2C`), never dashed or gradient lines.
- **Input Strokes:** Explicit 1px border (`#2A2B2C`) shifting to `#3994BC` on keyboard focus.

## Components

### Buttons
- **Shape:** Rounded 4px (`rounded-md`).
- **Primary:** Background `#297AA0`, hover `#2B7DA3`, text `#ededed`, padding 6px 12px (`px-3 py-1.5`).
- **Secondary / Ghost:** Background `#242526`, border 1px `#2A2B2C`, hover `#333536`, text `#ededed`.
- **Destructive:** Background `rgba(127, 29, 29, 0.5)`, border 1px `rgba(153, 27, 27, 0.6)`, text `#fca5a5`.

### Chips & Badges
- **Style:** Compact pill (`rounded-full`) or subtle box (`rounded` 4px), padding 2px 6px.
- **Accent Badge:** Background `#1E3A47`, border 1px `rgba(57, 148, 188, 0.6)`, text `#48A0C7`.
- **Status Pills:** Color-coded (Emerald for updated, Blue for updates available, Amber for archived).

### Inputs / Fields
- **Style:** Background `#121314`, border 1px `#2A2B2C`, text `#ededed`, placeholder `#555555`.
- **Focus:** 1px stroke shift to `#3994BC`, zero blur ring.

### Navigation & Tabs
- **Style:** Compact segmented switchers (`bg-[#121314] p-0.5 rounded border border-[#2A2B2C]`).
- **Active State:** Background `#297AA0` with bright white text.

## Do's and Don'ts

### Do:
- **Do** maintain the 1px `#2A2B2C` border line between panels and list items.
- **Do** use `#48A0C7` for interactive links, icons, and primary highlights.
- **Do** format commit hashes and file sizes in monospace with uppercase/tabular numerals.
- **Do** keep button and input heights consistent (32px standard desktop control height).

### Don't:
- **Don't** introduce purple, indigo, or saturated neon accents into the interface.
- **Don't** apply diffuse fuzzy drop shadows (`box-shadow: 0 10px 25px ...`).
- **Don't** use pure black (`#000000`) or pure white (`#ffffff`) for backgrounds or body copy.
- **Don't** use emojis as replacements for standard SVG developer icons.
