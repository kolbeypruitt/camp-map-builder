# Campground Map Builder

A friendly, illustrated single-file React app for sketching campground
layouts. Snap objects and terrain to a grid, label your loops and sites,
then export a clean PNG or save the layout as JSON to re-edit later.

Everything is drawn as inline SVG — there are no external image assets, and
the entire map lives in React state (no `localStorage`).

## Features

- **Snap-to-grid canvas** with small / medium / large grid presets and a
  scrollable workspace for larger maps.
- **Terrain painting** — grass, paved road, gravel, dirt, and water. Click or
  drag to paint cells.
- **Objects** that can span multiple cells — RV pads (concrete & gravel),
  picnic tables, fire pits, tent pads, office/building, restroom, three tree
  variants, parking, and an entrance gate.
- **Select / move / rotate / delete** placed objects. Rotate pads and roads in
  90° steps.
- **Eraser** and a **Clear all** with confirmation.
- **Text labels** with adjustable font size for naming roads, loops, or site
  numbers.
- **Export to PNG** and **Save / Load JSON** for keeping and re-editing maps.

## Keyboard shortcuts

- `R` — rotate the selected object
- `Delete` / `Backspace` — delete the selection
- `Esc` — deselect

## Running locally

```bash
npm install
npm run dev
```

Then open the printed local URL. Build a production bundle with `npm run build`.

## The single-file artifact

All of the app logic and artwork lives in [`src/App.jsx`](src/App.jsx). The
surrounding files are just a minimal Vite shell so the component can run in a
browser.
