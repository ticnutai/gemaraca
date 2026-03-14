import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Network, ZoomIn, ZoomOut, RotateCcw, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface GraphNode {
  id: string;
  label: string;
  type: "sugya" | "psak" | "masechet";
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

const NODE_COLORS: Record<string, string> = {
  sugya: "#3b82f6",
  psak: "#10b981",
  masechet: "#f59e0b",
};

export default function KnowledgeGraphTab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const animRef = useRef<number>();
  const dragRef = useRef<{ node: GraphNode | null; isDragging: boolean; startPan: { x: number; y: number }; startMouse: { x: number; y: number } }>({
    node: null, isDragging: false, startPan: { x: 0, y: 0 }, startMouse: { x: 0, y: 0 },
  });

  // Load data
  useEffect(() => {
    loadGraphData();
  }, []);

  const loadGraphData = async () => {
    setIsLoading(true);
    try {
      // Get sugya-psak links
      const { data: links } = await supabase
        .from("sugya_psak_links")
        .select("sugya_id, psak_din_id, relevance_score, psakei_din:psak_din_id(title, court)")
        .order("relevance_score", { ascending: false })
        .limit(200);

      if (!links || links.length === 0) {
        setIsLoading(false);
        return;
      }

      const nodeMap = new Map<string, GraphNode>();
      const edgeList: GraphEdge[] = [];
      const masechetSet = new Set<string>();

      const w = canvasRef.current?.width || 800;
      const h = canvasRef.current?.height || 600;

      for (const link of links) {
        const sugyaId = link.sugya_id;
        const psakId = link.psak_din_id;
        const psakData = link.psakei_din as any;

        // Extract masechet from sugya_id
        const masechetMatch = sugyaId.match(/^(.+?)_\d+[ab]$/);
        const masechetId = masechetMatch ? masechetMatch[1] : sugyaId;

        if (!masechetSet.has(masechetId)) {
          masechetSet.add(masechetId);
          nodeMap.set(masechetId, {
            id: masechetId,
            label: masechetId.replace(/_/g, " "),
            type: "masechet",
            x: Math.random() * w,
            y: Math.random() * h,
            vx: 0, vy: 0,
            radius: 20,
            color: NODE_COLORS.masechet,
          });
        }

        if (!nodeMap.has(sugyaId)) {
          nodeMap.set(sugyaId, {
            id: sugyaId,
            label: sugyaId.replace(/_/g, " "),
            type: "sugya",
            x: Math.random() * w,
            y: Math.random() * h,
            vx: 0, vy: 0,
            radius: 8,
            color: NODE_COLORS.sugya,
          });
          // Link sugya to masechet
          edgeList.push({ source: masechetId, target: sugyaId, weight: 0.5 });
        }

        if (!nodeMap.has(psakId)) {
          nodeMap.set(psakId, {
            id: psakId,
            label: psakData?.title || psakId.slice(0, 20),
            type: "psak",
            x: Math.random() * w,
            y: Math.random() * h,
            vx: 0, vy: 0,
            radius: 6,
            color: NODE_COLORS.psak,
          });
        }

        edgeList.push({ source: sugyaId, target: psakId, weight: (link.relevance_score || 5) / 10 });
      }

      setNodes(Array.from(nodeMap.values()));
      setEdges(edgeList);
    } catch (err) {
      console.error("Knowledge graph load error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Simple force simulation
  useEffect(() => {
    if (nodes.length === 0) return;

    const simulate = () => {
      const alpha = 0.1;
      const repulsion = 5000;
      const springLen = 100;
      const springK = 0.02;
      const damping = 0.85;

      setNodes((prev) => {
        const next = prev.map((n) => ({ ...n }));
        const byId = new Map(next.map((n) => [n.id, n]));

        // Repulsion (Barnes-Hut simplified)
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const a = next[i], b = next[j];
            const dx = b.x - a.x, dy = b.y - a.y;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
            const force = repulsion / (dist * dist);
            const fx = (dx / dist) * force * alpha;
            const fy = (dy / dist) * force * alpha;
            a.vx -= fx; a.vy -= fy;
            b.vx += fx; b.vy += fy;
          }
        }

        // Springs
        for (const e of edges) {
          const a = byId.get(e.source);
          const b = byId.get(e.target);
          if (!a || !b) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = (dist - springLen) * springK * alpha;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx += fx; a.vy += fy;
          b.vx -= fx; b.vy -= fy;
        }

        // Center gravity
        const cx = (canvasRef.current?.width || 800) / 2;
        const cy = (canvasRef.current?.height || 600) / 2;
        for (const n of next) {
          n.vx += (cx - n.x) * 0.001;
          n.vy += (cy - n.y) * 0.001;
          n.vx *= damping;
          n.vy *= damping;
          if (!dragRef.current.node || dragRef.current.node.id !== n.id) {
            n.x += n.vx;
            n.y += n.vy;
          }
        }

        return next;
      });

      animRef.current = requestAnimationFrame(simulate);
    };

    animRef.current = requestAnimationFrame(simulate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [edges, nodes.length > 0]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    // Edges
    ctx.lineWidth = 0.5;
    for (const e of edges) {
      const a = nodeById.get(e.source);
      const b = nodeById.get(e.target);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(150,150,150,${0.15 + e.weight * 0.4})`;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Nodes
    for (const n of nodes) {
      const isHovered = hoveredNode?.id === n.id;
      const isSelected = selectedNode?.id === n.id;
      const isFiltered = searchQuery && n.label.toLowerCase().includes(searchQuery.toLowerCase());

      ctx.beginPath();
      const r = isHovered || isSelected ? n.radius * 1.5 : n.radius;
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = searchQuery && !isFiltered ? `${n.color}33` : n.color;
      ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Labels for large or hovered nodes
      if (n.radius > 10 || isHovered || isSelected || isFiltered) {
        ctx.fillStyle = isHovered || isSelected ? "#fff" : "#aaa";
        ctx.font = `${isHovered ? "bold " : ""}${n.radius > 10 ? 11 : 9}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(n.label.slice(0, 25), n.x, n.y + r + 12);
      }
    }

    ctx.restore();
  });

  // Mouse handlers
  const getMousePos = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    };
  }, [pan, zoom]);

  const findNodeAt = useCallback((mx: number, my: number) => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = mx - n.x, dy = my - n.y;
      if (dx * dx + dy * dy < n.radius * n.radius * 4) return n;
    }
    return null;
  }, [nodes]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    const node = findNodeAt(pos.x, pos.y);
    if (node) {
      dragRef.current = { node, isDragging: true, startPan: pan, startMouse: { x: e.clientX, y: e.clientY } };
    } else {
      dragRef.current = { node: null, isDragging: true, startPan: pan, startMouse: { x: e.clientX, y: e.clientY } };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    setHoveredNode(findNodeAt(pos.x, pos.y));

    if (dragRef.current.isDragging) {
      if (dragRef.current.node) {
        dragRef.current.node.x = pos.x;
        dragRef.current.node.y = pos.y;
      } else {
        setPan({
          x: dragRef.current.startPan.x + (e.clientX - dragRef.current.startMouse.x),
          y: dragRef.current.startPan.y + (e.clientY - dragRef.current.startMouse.y),
        });
      }
    }
  };

  const handleMouseUp = () => {
    if (dragRef.current.isDragging && dragRef.current.node) {
      setSelectedNode(dragRef.current.node);
    }
    dragRef.current = { node: null, isDragging: false, startPan: pan, startMouse: { x: 0, y: 0 } };
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.2, Math.min(3, z - e.deltaY * 0.001)));
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    const node = findNodeAt(pos.x, pos.y);
    if (node?.type === "sugya") {
      navigate(`/sugya/${node.id}`);
    }
  };

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  return (
    <div className="p-3 md:p-6 space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
          <Network className="h-5 w-5 text-primary" />
          גרף ידע
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute right-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="חפש צומת..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-40 pr-8 h-8 text-xs"
            />
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(3, z + 0.2))}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(0.2, z - 0.2))}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={resetView}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-amber-500 inline-block" /> מסכת</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-blue-500 inline-block" /> סוגיא</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-emerald-500 inline-block" /> פסק דין</span>
        <span className="text-muted-foreground">({nodes.length} צמתים, {edges.length} קשרים)</span>
      </div>

      {/* Canvas */}
      <Card className="overflow-hidden">
        <CardContent className="p-0 relative">
          {isLoading ? (
            <div className="flex items-center justify-center h-[500px]">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground">
              <Network className="h-12 w-12 mb-3 opacity-30" />
              <p>אין נתונים להצגה</p>
              <p className="text-xs">הגרף ייבנה מקישורי סוגיות-פסקים</p>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="w-full h-[500px] cursor-crosshair"
              style={{ background: "hsl(var(--card))" }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              onDoubleClick={handleDoubleClick}
            />
          )}

          {/* Hover tooltip */}
          {hoveredNode && (
            <div className="absolute top-3 left-3 bg-popover border rounded-lg p-2.5 shadow-lg max-w-[200px] pointer-events-none" dir="rtl">
              <div className="font-medium text-sm">{hoveredNode.label}</div>
              <Badge variant="outline" className="text-[10px] mt-1">
                {hoveredNode.type === "sugya" ? "סוגיא" : hoveredNode.type === "psak" ? "פסק דין" : "מסכת"}
              </Badge>
              {hoveredNode.type === "sugya" && (
                <div className="text-[10px] text-muted-foreground mt-1">לחיצה כפולה לנווט</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
