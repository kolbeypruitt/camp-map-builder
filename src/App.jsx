import React, { useCallback, useMemo, useRef, useState } from 'react'

/* =========================================================================
   Campground Map Builder
   -------------------------------------------------------------------------
   A single-file React artifact for sketching friendly, illustrated
   campground maps. Everything is drawn as inline SVG (no external assets),
   the whole map lives in React state, and layouts persist via JSON
   download / upload. The map can be exported as a clean PNG.
   ========================================================================= */

/* ----------------------------- Configuration --------------------------- */

const CELL = 36 // pixels per grid cell

const GRID_SIZES = {
  small: { cols: 20, rows: 14, label: 'Small (20 × 14)' },
  medium: { cols: 28, rows: 18, label: 'Medium (28 × 18)' },
  large: { cols: 40, rows: 26, label: 'Large (40 × 26)' },
}

const COLORS = {
  background: '#f7f4ec',
  gridLine: '#e6e0d1',
  panel: '#fffdf7',
  panelEdge: '#e7e0cf',
  ink: '#5b513f',
  accent: '#e08a3c',
}

/* Terrain — paintable, fills whole cells. */
const TERRAIN = {
  grass: { name: 'Grass', fill: '#9ec46a', stroke: '#8bb157' },
  road: { name: 'Paved road', fill: '#b6bac0', stroke: '#a3a8af' },
  gravel: { name: 'Gravel', fill: '#dac9a0', stroke: '#cbb88a' },
  dirt: { name: 'Dirt', fill: '#c39a6b', stroke: '#b1885a' },
  water: { name: 'Water / pond', fill: '#86bcdd', stroke: '#6ba9cf' },
}
const TERRAIN_ORDER = ['grass', 'road', 'gravel', 'dirt', 'water']

/* Objects — placed on the grid, may span multiple cells. The default
   footprint is given in grid cells; rotation swaps width and height. */
const OBJECTS = {
  rv_concrete: { name: 'RV pad (concrete)', w: 2, h: 4, rotatable: true },
  rv_gravel: { name: 'RV pad (gravel)', w: 2, h: 4, rotatable: true },
  picnic: { name: 'Picnic table', w: 2, h: 1, rotatable: true },
  firepit: { name: 'Fire pit', w: 1, h: 1, rotatable: false },
  tent: { name: 'Tent pad', w: 2, h: 2, rotatable: true },
  office: { name: 'Office / building', w: 3, h: 2, rotatable: true },
  restroom: { name: 'Restroom', w: 2, h: 2, rotatable: true },
  tree_round: { name: 'Tree (round)', w: 1, h: 1, rotatable: false },
  tree_pine: { name: 'Tree (pine)', w: 1, h: 1, rotatable: false },
  tree_bush: { name: 'Tree (bushy)', w: 2, h: 2, rotatable: false },
  parking: { name: 'Parking', w: 2, h: 1, rotatable: true },
  gate: { name: 'Entrance gate', w: 3, h: 1, rotatable: true },
}

const OBJECT_GROUPS = [
  { title: 'RV pads', items: ['rv_concrete', 'rv_gravel'] },
  { title: 'Sites', items: ['tent', 'picnic', 'firepit'] },
  { title: 'Buildings', items: ['office', 'restroom'] },
  { title: 'Trees', items: ['tree_round', 'tree_pine', 'tree_bush'] },
  { title: 'Access', items: ['parking', 'gate'] },
]

let idCounter = 1
const nextId = () => `o${idCounter++}`

/* --------------------------- Object icon art --------------------------- */
/* Each icon is drawn to fill a box of (pw × ph) pixels. Pure SVG shapes,
   so the same markup renders on screen and in the exported PNG. */

function softShadow(id) {
  return (
    <filter id={id} x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.18" />
    </filter>
  )
}

function ObjectArt({ type, pw, ph }) {
  const pad = Math.min(pw, ph) * 0.12
  const w = pw - pad * 2
  const h = ph - pad * 2
  const g = (children) => <g transform={`translate(${pad},${pad})`}>{children}</g>

  switch (type) {
    case 'rv_concrete':
    case 'rv_gravel': {
      const concrete = type === 'rv_concrete'
      const base = concrete ? '#d9d6cf' : '#cbb88a'
      const edge = concrete ? '#bdb9af' : '#b09a66'
      return g(
        <>
          <rect x="0" y="0" width={w} height={h} rx={Math.min(w, h) * 0.1} fill={base} stroke={edge} strokeWidth="2" />
          {concrete ? (
            <>
              <line x1={w * 0.5} y1="4" x2={w * 0.5} y2={h - 4} stroke={edge} strokeWidth="1.2" strokeDasharray="5 4" />
              <line x1="6" y1={h * 0.5} x2={w - 6} y2={h * 0.5} stroke={edge} strokeWidth="1.2" strokeDasharray="5 4" />
            </>
          ) : (
            Array.from({ length: 18 }).map((_, i) => (
              <circle key={i} cx={6 + ((i * 53) % (w - 12))} cy={6 + ((i * 71) % (h - 12))} r="1.6" fill={edge} opacity="0.6" />
            ))
          )}
          {/* hookup post */}
          <rect x={w - 9} y="6" width="5" height="12" rx="2" fill="#8a8f96" />
        </>,
      )
    }
    case 'picnic': {
      return g(
        <>
          <rect x={w * 0.18} y={h * 0.3} width={w * 0.64} height={h * 0.4} rx="3" fill="#c9883f" stroke="#a76e2e" strokeWidth="1.5" />
          <rect x="2" y={h * 0.16} width={w - 4} height={h * 0.16} rx="3" fill="#dca256" stroke="#a76e2e" strokeWidth="1.5" />
          <rect x="2" y={h * 0.68} width={w - 4} height={h * 0.16} rx="3" fill="#dca256" stroke="#a76e2e" strokeWidth="1.5" />
        </>,
      )
    }
    case 'firepit': {
      const cx = w / 2
      const cy = h / 2
      const r = Math.min(w, h) * 0.42
      return g(
        <>
          <circle cx={cx} cy={cy} r={r} fill="#9a9089" stroke="#7d736b" strokeWidth="2" />
          <circle cx={cx} cy={cy} r={r * 0.62} fill="#5b5048" />
          <path
            d={`M${cx} ${cy + r * 0.4} C ${cx - r * 0.5} ${cy}, ${cx - r * 0.1} ${cy - r * 0.55}, ${cx} ${cy - r * 0.6} C ${cx + r * 0.15} ${cy - r * 0.2}, ${cx + r * 0.5} ${cy - r * 0.1}, ${cx} ${cy + r * 0.4} Z`}
            fill="#f0a23a"
          />
          <path
            d={`M${cx} ${cy + r * 0.3} C ${cx - r * 0.28} ${cy}, ${cx - r * 0.05} ${cy - r * 0.32}, ${cx} ${cy - r * 0.36} C ${cx + r * 0.1} ${cy - r * 0.1}, ${cx + r * 0.3} ${cy - r * 0.05}, ${cx} ${cy + r * 0.3} Z`}
            fill="#f6d34e"
          />
        </>,
      )
    }
    case 'tent': {
      return g(
        <>
          <rect x="0" y="0" width={w} height={h} rx={Math.min(w, h) * 0.12} fill="#cdab7d" stroke="#b1885a" strokeWidth="1.5" opacity="0.5" />
          <path d={`M${w * 0.5} ${h * 0.22} L${w * 0.85} ${h * 0.8} L${w * 0.15} ${h * 0.8} Z`} fill="#5aa06f" stroke="#3f8055" strokeWidth="2" strokeLinejoin="round" />
          <path d={`M${w * 0.5} ${h * 0.22} L${w * 0.5} ${h * 0.8}`} stroke="#3f8055" strokeWidth="1.5" />
          <path d={`M${w * 0.5} ${h * 0.34} L${w * 0.66} ${h * 0.8} L${w * 0.5} ${h * 0.8} Z`} fill="#47885d" />
        </>,
      )
    }
    case 'office': {
      return g(
        <>
          <rect x="2" y={h * 0.34} width={w - 4} height={h * 0.62} rx="3" fill="#e8c98c" stroke="#c79f5c" strokeWidth="2" />
          <path d={`M-1 ${h * 0.36} L${w * 0.5} ${h * 0.08} L${w + 1} ${h * 0.36} Z`} fill="#b5654a" stroke="#984f38" strokeWidth="2" strokeLinejoin="round" />
          <rect x={w * 0.42} y={h * 0.55} width={w * 0.16} height={h * 0.41} rx="1.5" fill="#8a6a3e" />
          <rect x={w * 0.12} y={h * 0.46} width={w * 0.16} height={h * 0.16} rx="1.5" fill="#fff7e6" stroke="#c79f5c" />
          <rect x={w * 0.72} y={h * 0.46} width={w * 0.16} height={h * 0.16} rx="1.5" fill="#fff7e6" stroke="#c79f5c" />
        </>,
      )
    }
    case 'restroom': {
      return g(
        <>
          <rect x="2" y={h * 0.28} width={w - 4} height={h * 0.68} rx="3" fill="#bcd3e0" stroke="#90b6c9" strokeWidth="2" />
          <path d={`M0 ${h * 0.3} L${w * 0.5} ${h * 0.06} L${w} ${h * 0.3} Z`} fill="#6a93a8" stroke="#557a8d" strokeWidth="2" strokeLinejoin="round" />
          {/* simple WC figures */}
          <circle cx={w * 0.34} cy={h * 0.52} r={Math.min(w, h) * 0.06} fill="#4f6f7e" />
          <path d={`M${w * 0.34} ${h * 0.58} l${-w * 0.05} ${h * 0.18} h${w * 0.1} Z`} fill="#4f6f7e" />
          <circle cx={w * 0.64} cy={h * 0.52} r={Math.min(w, h) * 0.06} fill="#4f6f7e" />
          <rect x={w * 0.6} y={h * 0.58} width={w * 0.08} height={h * 0.2} fill="#4f6f7e" />
        </>,
      )
    }
    case 'tree_round': {
      const cx = w / 2
      return g(
        <>
          <rect x={cx - w * 0.06} y={h * 0.55} width={w * 0.12} height={h * 0.4} rx="2" fill="#9a6b3f" />
          <circle cx={cx} cy={h * 0.42} r={Math.min(w, h) * 0.42} fill="#6fb16a" stroke="#4f9a55" strokeWidth="2" />
          <circle cx={cx - w * 0.12} cy={h * 0.34} r={Math.min(w, h) * 0.14} fill="#84c07d" opacity="0.7" />
        </>,
      )
    }
    case 'tree_pine': {
      const cx = w / 2
      return g(
        <>
          <rect x={cx - w * 0.05} y={h * 0.74} width={w * 0.1} height={h * 0.22} rx="2" fill="#9a6b3f" />
          <path d={`M${cx} ${h * 0.08} L${w * 0.82} ${h * 0.46} L${w * 0.18} ${h * 0.46} Z`} fill="#4f9a55" stroke="#3f8046" strokeWidth="1.5" strokeLinejoin="round" />
          <path d={`M${cx} ${h * 0.32} L${w * 0.86} ${h * 0.78} L${w * 0.14} ${h * 0.78} Z`} fill="#5aa761" stroke="#3f8046" strokeWidth="1.5" strokeLinejoin="round" />
        </>,
      )
    }
    case 'tree_bush': {
      return g(
        <>
          <circle cx={w * 0.36} cy={h * 0.56} r={Math.min(w, h) * 0.28} fill="#6aa867" stroke="#4f9a55" strokeWidth="2" />
          <circle cx={w * 0.64} cy={h * 0.5} r={Math.min(w, h) * 0.32} fill="#74b56f" stroke="#4f9a55" strokeWidth="2" />
          <circle cx={w * 0.5} cy={h * 0.66} r={Math.min(w, h) * 0.3} fill="#7fbf78" stroke="#4f9a55" strokeWidth="2" />
        </>,
      )
    }
    case 'parking': {
      return g(
        <>
          <rect x="0" y="0" width={w} height={h} rx={Math.min(w, h) * 0.12} fill="#9aa0a6" stroke="#868c92" strokeWidth="1.5" />
          <text x={w / 2} y={h / 2} fontSize={Math.min(w, h) * 0.6} fontWeight="800" fill="#fff" textAnchor="middle" dominantBaseline="central" fontFamily="system-ui, sans-serif">
            P
          </text>
        </>,
      )
    }
    case 'gate': {
      return g(
        <>
          <rect x={w * 0.06} y={h * 0.2} width={w * 0.08} height={h * 0.7} rx="2" fill="#8a6a3e" />
          <rect x={w * 0.86} y={h * 0.2} width={w * 0.08} height={h * 0.7} rx="2" fill="#8a6a3e" />
          <rect x={w * 0.04} y={h * 0.08} width={w * 0.92} height={h * 0.2} rx="4" fill="#b5654a" stroke="#984f38" strokeWidth="1.5" />
          <text x={w / 2} y={h * 0.18} fontSize={h * 0.13} fontWeight="700" fill="#fff7e6" textAnchor="middle" dominantBaseline="central" fontFamily="system-ui, sans-serif">
            CAMP
          </text>
        </>,
      )
    }
    default:
      return null
  }
}

/* Footprint of an object accounting for rotation (0/90/180/270). */
function footprint(obj) {
  const def = OBJECTS[obj.type]
  const rotated = obj.rot === 90 || obj.rot === 270
  return {
    w: rotated ? def.h : def.w,
    h: rotated ? def.w : def.h,
  }
}

/* ------------------------------ Main app ------------------------------- */

export default function App() {
  const [gridKey, setGridKey] = useState('medium')
  const grid = GRID_SIZES[gridKey]
  const [terrain, setTerrain] = useState({}) // "x,y" -> terrain key
  const [objects, setObjects] = useState([]) // {id, type, x, y, rot}
  const [labels, setLabels] = useState([]) // {id, x, y, text, size}
  const [tool, setTool] = useState('grass') // terrain key | object key | 'select' | 'eraser' | 'label'
  const [selectedId, setSelectedId] = useState(null)
  const [showLegend, setShowLegend] = useState(true)

  const svgRef = useRef(null)
  const drag = useRef(null) // transient drag state, not React state

  const width = grid.cols * CELL
  const height = grid.rows * CELL

  const selectedObj = objects.find((o) => o.id === selectedId) || null
  const selectedLabel = labels.find((l) => l.id === selectedId) || null

  /* --- coordinate helpers --- */
  const cellFromEvent = useCallback(
    (e) => {
      const rect = svgRef.current.getBoundingClientRect()
      const sx = (e.clientX - rect.left) * (width / rect.width)
      const sy = (e.clientY - rect.top) * (height / rect.height)
      return {
        x: Math.floor(sx / CELL),
        y: Math.floor(sy / CELL),
        px: sx,
        py: sy,
      }
    },
    [width, height],
  )

  const inBounds = (x, y) => x >= 0 && y >= 0 && x < grid.cols && y < grid.rows

  /* --- terrain painting --- */
  const paintTerrain = useCallback((x, y, key) => {
    if (!inBounds(x, y)) return
    setTerrain((t) => {
      const k = `${x},${y}`
      if (key === null) {
        if (!(k in t)) return t
        const next = { ...t }
        delete next[k]
        return next
      }
      if (t[k] === key) return t
      return { ...t, [k]: key }
    })
  }, [grid.cols, grid.rows])

  /* --- object hit testing (topmost first) --- */
  const objectAt = useCallback(
    (x, y) => {
      for (let i = objects.length - 1; i >= 0; i--) {
        const o = objects[i]
        const fp = footprint(o)
        if (x >= o.x && x < o.x + fp.w && y >= o.y && y < o.y + fp.h) return o
      }
      return null
    },
    [objects],
  )

  const labelAt = useCallback(
    (px, py) => {
      for (let i = labels.length - 1; i >= 0; i--) {
        const l = labels[i]
        const w = l.text.length * l.size * 0.55 + 8
        const h = l.size * 1.3
        if (px >= l.x - 4 && px <= l.x + w && py >= l.y - h && py <= l.y + 6) return l
      }
      return null
    },
    [labels],
  )

  /* --- placing an object --- */
  const placeObject = useCallback(
    (type, x, y) => {
      const def = OBJECTS[type]
      // keep footprint on the board
      const cx = Math.max(0, Math.min(x, grid.cols - def.w))
      const cy = Math.max(0, Math.min(y, grid.rows - def.h))
      const obj = { id: nextId(), type, x: cx, y: cy, rot: 0 }
      setObjects((o) => [...o, obj])
      setSelectedId(obj.id)
    },
    [grid.cols, grid.rows],
  )

  /* --- erase at a cell: remove objects/labels there, else clear terrain --- */
  const eraseAt = useCallback(
    (x, y, px, py) => {
      const hitLabel = labelAt(px, py)
      if (hitLabel) {
        setLabels((ls) => ls.filter((l) => l.id !== hitLabel.id))
        return
      }
      const hit = objectAt(x, y)
      if (hit) {
        setObjects((os) => os.filter((o) => o.id !== hit.id))
        return
      }
      paintTerrain(x, y, null)
    },
    [labelAt, objectAt, paintTerrain],
  )

  /* ------------------------- pointer interaction ------------------------ */
  const onPointerDown = useCallback(
    (e) => {
      e.preventDefault()
      const { x, y, px, py } = cellFromEvent(e)

      if (TERRAIN[tool]) {
        drag.current = { mode: 'paint', key: tool }
        paintTerrain(x, y, tool)
        return
      }

      if (tool === 'eraser') {
        drag.current = { mode: 'erase' }
        eraseAt(x, y, px, py)
        return
      }

      if (OBJECTS[tool]) {
        placeObject(tool, x, y)
        return
      }

      if (tool === 'label') {
        const id = nextId()
        setLabels((ls) => [...ls, { id, x: px, y: py, text: 'Label', size: 18 }])
        setSelectedId(id)
        setTool('select')
        return
      }

      if (tool === 'select') {
        const hitLabel = labelAt(px, py)
        if (hitLabel) {
          setSelectedId(hitLabel.id)
          drag.current = { mode: 'move-label', id: hitLabel.id, offX: px - hitLabel.x, offY: py - hitLabel.y }
          return
        }
        const hit = objectAt(x, y)
        if (hit) {
          setSelectedId(hit.id)
          drag.current = { mode: 'move-obj', id: hit.id, offX: x - hit.x, offY: y - hit.y }
          return
        }
        setSelectedId(null)
      }
    },
    [tool, cellFromEvent, paintTerrain, eraseAt, placeObject, objectAt, labelAt],
  )

  const onPointerMove = useCallback(
    (e) => {
      const d = drag.current
      if (!d) return
      const { x, y, px, py } = cellFromEvent(e)
      if (d.mode === 'paint') paintTerrain(x, y, d.key)
      else if (d.mode === 'erase') eraseAt(x, y, px, py)
      else if (d.mode === 'move-obj') {
        setObjects((os) =>
          os.map((o) => {
            if (o.id !== d.id) return o
            const fp = footprint(o)
            const nx = Math.max(0, Math.min(x - d.offX, grid.cols - fp.w))
            const ny = Math.max(0, Math.min(y - d.offY, grid.rows - fp.h))
            return { ...o, x: nx, y: ny }
          }),
        )
      } else if (d.mode === 'move-label') {
        setLabels((ls) =>
          ls.map((l) =>
            l.id === d.id
              ? { ...l, x: Math.max(0, Math.min(px - d.offX, width)), y: Math.max(10, Math.min(py - d.offY, height)) }
              : l,
          ),
        )
      }
    },
    [cellFromEvent, paintTerrain, eraseAt, grid.cols, grid.rows, width, height],
  )

  const endDrag = useCallback(() => {
    drag.current = null
  }, [])

  /* ------------------------------- actions ------------------------------ */
  const rotateSelected = useCallback(() => {
    if (!selectedObj) return
    setObjects((os) =>
      os.map((o) => {
        if (o.id !== selectedObj.id) return o
        const rot = (o.rot + 90) % 360
        const tmp = { ...o, rot }
        const fp = footprint(tmp)
        return {
          ...tmp,
          x: Math.max(0, Math.min(o.x, grid.cols - fp.w)),
          y: Math.max(0, Math.min(o.y, grid.rows - fp.h)),
        }
      }),
    )
  }, [selectedObj, grid.cols, grid.rows])

  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    setObjects((os) => os.filter((o) => o.id !== selectedId))
    setLabels((ls) => ls.filter((l) => l.id !== selectedId))
    setSelectedId(null)
  }, [selectedId])

  const clearAll = useCallback(() => {
    if (!window.confirm('Clear the entire map? This cannot be undone.')) return
    setTerrain({})
    setObjects([])
    setLabels([])
    setSelectedId(null)
  }, [])

  const onKeyDown = useCallback(
    (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteSelected()
      } else if (e.key === 'r' || e.key === 'R') {
        rotateSelected()
      } else if (e.key === 'Escape') {
        setSelectedId(null)
      }
    },
    [deleteSelected, rotateSelected],
  )

  /* ------------------------ change grid size ---------------------------- */
  const changeGrid = (key) => {
    const g = GRID_SIZES[key]
    setGridKey(key)
    // clamp anything that now falls off the board
    setTerrain((t) => {
      const next = {}
      for (const k in t) {
        const [x, y] = k.split(',').map(Number)
        if (x < g.cols && y < g.rows) next[k] = t[k]
      }
      return next
    })
    setObjects((os) =>
      os.map((o) => {
        const fp = footprint(o)
        return {
          ...o,
          x: Math.max(0, Math.min(o.x, g.cols - fp.w)),
          y: Math.max(0, Math.min(o.y, g.rows - fp.h)),
        }
      }),
    )
  }

  /* ----------------------------- persistence ---------------------------- */
  const saveJSON = () => {
    const data = { version: 1, gridKey, terrain, objects, labels }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    triggerDownload(blob, 'campground-map.json')
  }

  const loadJSON = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        if (data.gridKey && GRID_SIZES[data.gridKey]) setGridKey(data.gridKey)
        setTerrain(data.terrain || {})
        const objs = data.objects || []
        setObjects(objs)
        setLabels(data.labels || [])
        setSelectedId(null)
        // keep id counter ahead of loaded ids
        objs.forEach((o) => {
          const n = parseInt(String(o.id).replace(/\D/g, ''), 10)
          if (!Number.isNaN(n) && n >= idCounter) idCounter = n + 1
        })
      } catch (err) {
        window.alert('Sorry, that file could not be read as a map layout.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  /* ------------------------------ PNG export ---------------------------- */
  const exportPNG = () => {
    const svg = svgRef.current
    const clone = svg.cloneNode(true)
    // strip editing-only overlays from the export
    clone.querySelectorAll('.editor-only').forEach((n) => n.remove())
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const xml = new XMLSerializer().serializeToString(clone)
    const svg64 = btoa(unescape(encodeURIComponent(xml)))
    const img = new Image()
    img.onload = () => {
      const scale = 2 // crisp export
      const canvas = document.createElement('canvas')
      canvas.width = width * scale
      canvas.height = height * scale
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = COLORS.background
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => triggerDownload(blob, 'campground-map.png'))
    }
    img.src = `data:image/svg+xml;base64,${svg64}`
  }

  /* ------------------------------ rendering ----------------------------- */
  const gridLines = useMemo(() => {
    const lines = []
    for (let x = 0; x <= grid.cols; x++) {
      lines.push(<line key={`v${x}`} x1={x * CELL} y1={0} x2={x * CELL} y2={height} stroke={COLORS.gridLine} strokeWidth="1" />)
    }
    for (let y = 0; y <= grid.rows; y++) {
      lines.push(<line key={`h${y}`} x1={0} y1={y * CELL} x2={width} y2={y * CELL} stroke={COLORS.gridLine} strokeWidth="1" />)
    }
    return lines
  }, [grid.cols, grid.rows, width, height])

  return (
    <div style={S.app} tabIndex={0} onKeyDown={onKeyDown}>
      {/* --------------------------- Toolbar --------------------------- */}
      <header style={S.toolbar}>
        <div style={S.brand}>
          <span style={S.brandMark}>⛺</span>
          <span>Campground Map Builder</span>
        </div>
        <div style={S.toolbarSpacer} />

        <label style={S.field}>
          <span style={S.fieldLabel}>Grid</span>
          <select value={gridKey} onChange={(e) => changeGrid(e.target.value)} style={S.select}>
            {Object.entries(GRID_SIZES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>

        <div style={S.toolbarDivider} />

        <ToolButton active={tool === 'select'} onClick={() => setTool('select')} title="Select / move (V)">
          <CursorIcon /> Select
        </ToolButton>
        <ToolButton active={tool === 'label'} onClick={() => setTool('label')} title="Drop a text label">
          <span style={{ fontWeight: 800 }}>T</span> Label
        </ToolButton>
        <ToolButton active={tool === 'eraser'} onClick={() => setTool('eraser')} title="Eraser">
          <EraserIcon /> Eraser
        </ToolButton>

        <div style={S.toolbarDivider} />

        <button style={{ ...S.action }} onClick={rotateSelected} disabled={!selectedObj} title="Rotate selected 90° (R)">
          ⟳ Rotate
        </button>
        <button style={S.action} onClick={deleteSelected} disabled={!selectedId} title="Delete selected (Del)">
          ✕ Delete
        </button>

        <div style={S.toolbarDivider} />

        <button style={S.action} onClick={exportPNG}>⬇ PNG</button>
        <button style={S.action} onClick={saveJSON}>⬇ Save</button>
        <label style={{ ...S.action, cursor: 'pointer' }}>
          ⬆ Load
          <input type="file" accept="application/json,.json" onChange={loadJSON} style={{ display: 'none' }} />
        </label>
        <button style={{ ...S.action, ...S.danger }} onClick={clearAll}>Clear all</button>
      </header>

      <div style={S.body}>
        {/* --------------------------- Palette --------------------------- */}
        <aside style={S.palette}>
          <Section title="Terrain" hint="click or drag to paint">
            <div style={S.swatchGrid}>
              {TERRAIN_ORDER.map((k) => (
                <button
                  key={k}
                  style={{ ...S.swatch, ...(tool === k ? S.swatchActive : null) }}
                  onClick={() => setTool(k)}
                  title={TERRAIN[k].name}
                >
                  <span style={{ ...S.swatchChip, background: TERRAIN[k].fill, borderColor: TERRAIN[k].stroke }} />
                  <span style={S.swatchName}>{TERRAIN[k].name}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Objects" hint="click to place; drag to move">
            {OBJECT_GROUPS.map((group) => (
              <div key={group.title} style={{ marginBottom: 10 }}>
                <div style={S.groupTitle}>{group.title}</div>
                <div style={S.objGrid}>
                  {group.items.map((k) => (
                    <button
                      key={k}
                      style={{ ...S.objBtn, ...(tool === k ? S.objBtnActive : null) }}
                      onClick={() => setTool(k)}
                      title={OBJECTS[k].name}
                    >
                      <svg width="42" height="42" viewBox="0 0 42 42">
                        <ObjectArt type={k} pw={42} ph={42} />
                      </svg>
                      <span style={S.objName}>{OBJECTS[k].name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </Section>

          {selectedLabel && (
            <Section title="Edit label">
              <input
                style={S.input}
                value={selectedLabel.text}
                onChange={(e) =>
                  setLabels((ls) => ls.map((l) => (l.id === selectedLabel.id ? { ...l, text: e.target.value } : l)))
                }
              />
              <label style={S.rangeRow}>
                <span>Font size: {selectedLabel.size}px</span>
                <input
                  type="range"
                  min="10"
                  max="48"
                  value={selectedLabel.size}
                  onChange={(e) =>
                    setLabels((ls) =>
                      ls.map((l) => (l.id === selectedLabel.id ? { ...l, size: Number(e.target.value) } : l)),
                    )
                  }
                />
              </label>
            </Section>
          )}
        </aside>

        {/* ---------------------------- Canvas --------------------------- */}
        <main style={S.canvasWrap}>
          <div style={S.canvasScroll}>
            <svg
              ref={svgRef}
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              style={{ ...S.canvas, cursor: canvasCursor(tool) }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerLeave={endDrag}
            >
              <defs>{softShadow('obj-shadow')}</defs>

              {/* background */}
              <rect x="0" y="0" width={width} height={height} fill={COLORS.background} />

              {/* terrain */}
              {Object.entries(terrain).map(([k, key]) => {
                const [x, y] = k.split(',').map(Number)
                const t = TERRAIN[key]
                return (
                  <rect
                    key={k}
                    x={x * CELL}
                    y={y * CELL}
                    width={CELL}
                    height={CELL}
                    fill={t.fill}
                    stroke={t.stroke}
                    strokeWidth="0.5"
                  />
                )
              })}

              {/* grid */}
              <g className="editor-only">{gridLines}</g>

              {/* objects */}
              {objects.map((o) => {
                const def = OBJECTS[o.type]
                const baseW = def.w * CELL
                const baseH = def.h * CELL
                const fp = footprint(o)
                const cx = (o.x + fp.w / 2) * CELL
                const cy = (o.y + fp.h / 2) * CELL
                return (
                  <g key={o.id} filter="url(#obj-shadow)" transform={`translate(${cx},${cy}) rotate(${o.rot})`}>
                    <g transform={`translate(${-baseW / 2},${-baseH / 2})`}>
                      <ObjectArt type={o.type} pw={baseW} ph={baseH} />
                    </g>
                  </g>
                )
              })}

              {/* selection highlight (editor only) */}
              {selectedObj &&
                (() => {
                  const fp = footprint(selectedObj)
                  return (
                    <rect
                      className="editor-only"
                      x={selectedObj.x * CELL - 2}
                      y={selectedObj.y * CELL - 2}
                      width={fp.w * CELL + 4}
                      height={fp.h * CELL + 4}
                      fill="none"
                      stroke={COLORS.accent}
                      strokeWidth="2.5"
                      strokeDasharray="6 4"
                      rx="6"
                    />
                  )
                })()}

              {/* labels */}
              {labels.map((l) => (
                <g key={l.id}>
                  {selectedId === l.id && (
                    <rect
                      className="editor-only"
                      x={l.x - 5}
                      y={l.y - l.size}
                      width={l.text.length * l.size * 0.55 + 10}
                      height={l.size * 1.3}
                      fill="none"
                      stroke={COLORS.accent}
                      strokeWidth="2"
                      strokeDasharray="5 3"
                      rx="4"
                    />
                  )}
                  <text
                    x={l.x}
                    y={l.y}
                    fontSize={l.size}
                    fontWeight="700"
                    fill={COLORS.ink}
                    fontFamily="system-ui, sans-serif"
                    style={{ paintOrder: 'stroke' }}
                    stroke="#fffdf7"
                    strokeWidth={l.size * 0.16}
                  >
                    {l.text}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          {/* ---------------------------- Legend --------------------------- */}
          {showLegend && (
            <div style={S.legend}>
              <div style={S.legendHead}>
                <strong>Legend</strong>
                <button style={S.legendToggle} onClick={() => setShowLegend(false)} title="Hide legend">×</button>
              </div>
              <div style={S.legendBody}>
                {TERRAIN_ORDER.map((k) => (
                  <div key={k} style={S.legendItem}>
                    <span style={{ ...S.legendChip, background: TERRAIN[k].fill, borderColor: TERRAIN[k].stroke }} />
                    {TERRAIN[k].name}
                  </div>
                ))}
                {['tent', 'firepit', 'office', 'restroom', 'tree_pine', 'parking', 'gate'].map((k) => (
                  <div key={k} style={S.legendItem}>
                    <svg width="22" height="22" viewBox="0 0 28 28">
                      <ObjectArt type={k} pw={28} ph={28} />
                    </svg>
                    {OBJECTS[k].name}
                  </div>
                ))}
              </div>
            </div>
          )}
          {!showLegend && (
            <button style={S.legendShow} onClick={() => setShowLegend(true)}>Legend</button>
          )}
        </main>
      </div>
    </div>
  )
}

/* ----------------------------- Small parts ----------------------------- */

function ToolButton({ active, onClick, title, children }) {
  return (
    <button onClick={onClick} title={title} style={{ ...S.tool, ...(active ? S.toolActive : null) }}>
      {children}
    </button>
  )
}

function Section({ title, hint, children }) {
  return (
    <section style={S.section}>
      <div style={S.sectionHead}>
        <h3 style={S.sectionTitle}>{title}</h3>
        {hint && <span style={S.sectionHint}>{hint}</span>}
      </div>
      {children}
    </section>
  )
}

function CursorIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 2l16 7-7 2-2 7z" />
    </svg>
  )
}
function EraserIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M5 14l6-6 8 8-4 4H9z" />
      <path d="M5 14l4 4" />
    </svg>
  )
}

function canvasCursor(tool) {
  if (tool === 'select') return 'default'
  if (tool === 'eraser') return 'cell'
  return 'crosshair'
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* -------------------------------- Styles ------------------------------- */

const S = {
  app: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    color: COLORS.ink,
    background: '#efe9db',
    outline: 'none',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    background: COLORS.panel,
    borderBottom: `1px solid ${COLORS.panelEdge}`,
    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
    flexWrap: 'wrap',
  },
  brand: { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 16 },
  brandMark: { fontSize: 20 },
  toolbarSpacer: { flex: '0 0 6px' },
  toolbarDivider: { width: 1, height: 26, background: COLORS.panelEdge, margin: '0 4px' },
  field: { display: 'flex', alignItems: 'center', gap: 6 },
  fieldLabel: { fontSize: 12, color: '#8a8169', fontWeight: 600 },
  select: {
    padding: '6px 8px',
    borderRadius: 8,
    border: `1px solid ${COLORS.panelEdge}`,
    background: '#fff',
    color: COLORS.ink,
    fontSize: 13,
  },
  tool: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 11px',
    borderRadius: 9,
    border: `1px solid ${COLORS.panelEdge}`,
    background: '#fff',
    color: COLORS.ink,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  toolActive: {
    background: COLORS.accent,
    borderColor: COLORS.accent,
    color: '#fff',
    boxShadow: '0 2px 6px rgba(224,138,60,0.4)',
  },
  action: {
    padding: '7px 11px',
    borderRadius: 9,
    border: `1px solid ${COLORS.panelEdge}`,
    background: '#fff',
    color: COLORS.ink,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  danger: { color: '#b4452f', borderColor: '#e6c3b8' },
  body: { flex: 1, display: 'flex', minHeight: 0 },
  palette: {
    width: 250,
    flex: '0 0 250px',
    background: COLORS.panel,
    borderRight: `1px solid ${COLORS.panelEdge}`,
    overflowY: 'auto',
    padding: 12,
  },
  section: { marginBottom: 16 },
  sectionHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { margin: 0, fontSize: 14, fontWeight: 800 },
  sectionHint: { fontSize: 10.5, color: '#a39a82' },
  groupTitle: { fontSize: 11, fontWeight: 700, color: '#a39a82', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 },
  swatchGrid: { display: 'flex', flexDirection: 'column', gap: 6 },
  swatch: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    padding: '6px 8px',
    borderRadius: 9,
    border: `1px solid ${COLORS.panelEdge}`,
    background: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
  },
  swatchActive: { borderColor: COLORS.accent, boxShadow: '0 0 0 2px rgba(224,138,60,0.25)' },
  swatchChip: { width: 22, height: 22, borderRadius: 6, border: '2px solid', flex: '0 0 auto' },
  swatchName: { fontSize: 13, fontWeight: 600, color: COLORS.ink },
  objGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 },
  objBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    padding: '7px 4px',
    borderRadius: 10,
    border: `1px solid ${COLORS.panelEdge}`,
    background: '#fff',
    cursor: 'pointer',
  },
  objBtnActive: { borderColor: COLORS.accent, boxShadow: '0 0 0 2px rgba(224,138,60,0.25)' },
  objName: { fontSize: 10, fontWeight: 600, color: '#6f6651', textAlign: 'center', lineHeight: 1.15 },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    borderRadius: 8,
    border: `1px solid ${COLORS.panelEdge}`,
    fontSize: 13,
    marginBottom: 10,
  },
  rangeRow: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#6f6651' },
  canvasWrap: { flex: 1, position: 'relative', minWidth: 0, background: '#e7e0d0' },
  canvasScroll: { position: 'absolute', inset: 0, overflow: 'auto', padding: 20 },
  canvas: {
    display: 'block',
    borderRadius: 12,
    boxShadow: '0 6px 22px rgba(0,0,0,0.14)',
    background: COLORS.background,
    touchAction: 'none',
  },
  legend: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 180,
    background: 'rgba(255,253,247,0.96)',
    border: `1px solid ${COLORS.panelEdge}`,
    borderRadius: 12,
    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
    overflow: 'hidden',
  },
  legendHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    borderBottom: `1px solid ${COLORS.panelEdge}`,
    fontSize: 13,
  },
  legendToggle: { border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: '#a39a82', lineHeight: 1 },
  legendBody: { padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 260, overflowY: 'auto' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: '#6f6651' },
  legendChip: { width: 18, height: 18, borderRadius: 5, border: '2px solid', flex: '0 0 auto' },
  legendShow: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    padding: '8px 12px',
    borderRadius: 10,
    border: `1px solid ${COLORS.panelEdge}`,
    background: 'rgba(255,253,247,0.96)',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 13,
    color: COLORS.ink,
  },
}
