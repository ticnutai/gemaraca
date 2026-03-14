import { useState, useRef, useCallback, useEffect } from "react";

export interface PanelGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

const STORAGE_PREFIX = "dev-panel-geometry-";

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function loadGeometry(id: string, defaults: PanelGeometry): PanelGeometry {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + id);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        x: clamp(parsed.x ?? defaults.x, 0, window.innerWidth - 100),
        y: clamp(parsed.y ?? defaults.y, 0, window.innerHeight - 100),
        width: clamp(parsed.width ?? defaults.width, 280, window.innerWidth),
        height: clamp(parsed.height ?? defaults.height, 200, window.innerHeight),
      };
    }
  } catch {}
  return defaults;
}

function saveGeometry(id: string, geo: PanelGeometry) {
  try { localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(geo)); } catch {}
}

export function useFloatingPanel(id: string, defaults: PanelGeometry) {
  const [geo, setGeo] = useState<PanelGeometry>(() => loadGeometry(id, defaults));
  const isDragging = useRef(false);
  const isResizing = useRef<string | null>(null);
  const startMouse = useRef({ x: 0, y: 0 });
  const startGeo = useRef<PanelGeometry>(geo);

  const persist = useCallback((g: PanelGeometry) => saveGeometry(id, g), [id]);

  // Drag
  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    isDragging.current = true;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    startMouse.current = { x: clientX, y: clientY };
    startGeo.current = { ...geo };
    e.preventDefault();
  }, [geo]);

  // Resize
  const onResizeStart = useCallback((direction: string, e: React.MouseEvent | React.TouchEvent) => {
    isResizing.current = direction;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    startMouse.current = { x: clientX, y: clientY };
    startGeo.current = { ...geo };
    e.preventDefault();
    e.stopPropagation();
  }, [geo]);

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const dx = clientX - startMouse.current.x;
      const dy = clientY - startMouse.current.y;

      if (isDragging.current) {
        setGeo({
          ...startGeo.current,
          x: clamp(startGeo.current.x + dx, 0, window.innerWidth - 100),
          y: clamp(startGeo.current.y + dy, 0, window.innerHeight - 60),
        });
      } else if (isResizing.current) {
        const dir = isResizing.current;
        const sg = startGeo.current;
        let { x, y, width, height } = sg;

        if (dir.includes("e")) width = clamp(sg.width + dx, 280, window.innerWidth - sg.x);
        if (dir.includes("w")) { width = clamp(sg.width - dx, 280, sg.x + sg.width); x = sg.x + sg.width - width; }
        if (dir.includes("s")) height = clamp(sg.height + dy, 200, window.innerHeight - sg.y);
        if (dir.includes("n")) { height = clamp(sg.height - dy, 200, sg.y + sg.height); y = sg.y + sg.height - height; }

        setGeo({ x, y, width, height });
      }
    };

    const handleUp = () => {
      if (isDragging.current || isResizing.current) {
        isDragging.current = false;
        isResizing.current = null;
        setGeo(prev => { persist(prev); return prev; });
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [persist]);

  return { geo, setGeo, onDragStart, onResizeStart, isDragging, isResizing };
}

/** Resize handle UI for edges & corners */
export function ResizeHandles({ onResizeStart }: { onResizeStart: (dir: string, e: React.MouseEvent | React.TouchEvent) => void }) {
  const base = "absolute z-10";
  return (
    <>
      {/* Edges */}
      <div className={`${base} top-0 left-2 right-2 h-1 cursor-n-resize`} onMouseDown={e => onResizeStart("n", e)} onTouchStart={e => onResizeStart("n", e)} />
      <div className={`${base} bottom-0 left-2 right-2 h-1 cursor-s-resize`} onMouseDown={e => onResizeStart("s", e)} onTouchStart={e => onResizeStart("s", e)} />
      <div className={`${base} left-0 top-2 bottom-2 w-1 cursor-w-resize`} onMouseDown={e => onResizeStart("w", e)} onTouchStart={e => onResizeStart("w", e)} />
      <div className={`${base} right-0 top-2 bottom-2 w-1 cursor-e-resize`} onMouseDown={e => onResizeStart("e", e)} onTouchStart={e => onResizeStart("e", e)} />
      {/* Corners */}
      <div className={`${base} top-0 left-0 w-3 h-3 cursor-nw-resize`} onMouseDown={e => onResizeStart("nw", e)} onTouchStart={e => onResizeStart("nw", e)} />
      <div className={`${base} top-0 right-0 w-3 h-3 cursor-ne-resize`} onMouseDown={e => onResizeStart("ne", e)} onTouchStart={e => onResizeStart("ne", e)} />
      <div className={`${base} bottom-0 left-0 w-3 h-3 cursor-sw-resize`} onMouseDown={e => onResizeStart("sw", e)} onTouchStart={e => onResizeStart("sw", e)} />
      <div className={`${base} bottom-0 right-0 w-3 h-3 cursor-se-resize`} onMouseDown={e => onResizeStart("se", e)} onTouchStart={e => onResizeStart("se", e)} />
    </>
  );
}
