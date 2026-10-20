# Foundry Combat Focus v2.0.0

Release date: 2026-10-20

## Breaking change

**Requires Foundry VTT v14.** For older Foundry versions, keep the published v1.4.2 release.

## Changes

- Restores the combat/chat split after Foundry's sidebar and chat API changes.
- Displays Foundry's existing native chat log, editor, controls and combat tracker. Message rendering, system chat cards, commands and rolls stay native.
- Uses a compact, single-line-height input without the formatting toolbar in combat split view.
- Joins the input, visibility controls and optional Dice Tray into a flush panel with reduced spacing.
- Adds a compact divider using the active theme's accent color. Drag to resize, use Arrow Up/Down (Shift for larger steps), or press Home to reset.
- Preserves client settings and saved height. Resizing adapts to UI scale and smaller viewports and saves once when a drag ends.
- Handles tab switches, sidebar collapse/expand, rerenders and native chat popouts. Normal chat and popouts retain their standard appearance.

## Validation

- Eight automated regression tests pass.
- Tested live on Foundry 14.369 with PF2e 8.6.1, including native text and roll submission, Dice Tray, visibility controls, drafts, settings, popouts, resizing and reload persistence.
- Other game systems and sidebar replacement modules have not been verified.
