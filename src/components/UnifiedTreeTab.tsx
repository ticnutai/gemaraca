import { useState, useMemo, memo, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ChevronDown, BookOpen, Search, ExternalLink, Loader2,
  TreePine, List, TableIcon, LayoutGrid,
  BookMarked, ScrollText, BookText, Library, Database, Sparkles,
} from "lucide-react";
import { useAllReferencesGrouped } from "@/hooks/useTalmudReferences";
import type { TalmudRefWithPsak } from "@/components/talmud-index/types";
import { toHebrewDaf } from "@/components/talmud-index/types";

/* ─── Types ──────────────────────────────────────── */
interface SourceNode {
  id: string;
  text: string;
  children?: SourceNode[];
}

type TagPsakimMap = Record<string, [number, string][]>;
type PsakimIndex = Record<string, { n: string; b: string; q: string }>;
type ViewMode = "tree" | "list" | "table" | "cards";

interface UnifiedPsak {
  key: string;
  title: string;
  court?: string;
  href?: string;
  quote?: string;
  origin: "sources" | "advanced" | "both";
  rawReference?: string;
  confidence?: number;
}

interface LeafData {
  psakim: UnifiedPsak[];
  origin: "sources" | "advanced" | "both";
}

interface FlatLeaf {
  nodeId: string;
  text: string;
  path: string[];
  branch: string;
  psakCount: number;
  origin: "sources" | "advanced" | "both";
}

interface Props {
  sourcesTree: SourceNode;
  tagPsakimMap: TagPsakimMap;
  psakimIndex: PsakimIndex;
}

const PSAKIM_BASE = "https://www.psakim.org";

const VIEW_OPTIONS: { value: ViewMode; icon: React.ReactNode; label: string }[] = [
  { value: "tree", icon: <TreePine className="w-5 h-5 text-accent" />, label: "עץ" },
  { value: "list", icon: <List className="w-5 h-5 text-accent" />, label: "רשימה" },
  { value: "table", icon: <TableIcon className="w-5 h-5 text-accent" />, label: "טבלה" },
  { value: "cards", icon: <LayoutGrid className="w-5 h-5 text-accent" />, label: "כרטיסיות" },
];

/* ─── Helpers ────────────────────────────────────── */
function BranchIcon({ name, className = "w-6 h-6" }: { name: string; className?: string }) {
  const cls = `${className} text-accent`;
  switch (name) {
    case "בבלי": return <ScrollText className={cls} />;
    case "ירושלמי": return <BookText className={cls} />;
    case 'רמב"ם': return <BookMarked className={cls} />;
    case "שולחן ערוך": return <Library className={cls} />;
    default: return <BookOpen className={cls} />;
  }
}

function OriginBadge({ origin }: { origin: "sources" | "advanced" | "both" }) {
  switch (origin) {
    case "both":
      return <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-700 border-green-500/30"><Sparkles className="w-3 h-3 mr-0.5" />שניהם</Badge>;
    case "advanced":
      return <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-700 border-purple-500/30"><Database className="w-3 h-3 mr-0.5" />מתקדם</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 border-blue-500/30"><BookMarked className="w-3 h-3 mr-0.5" />מקורות</Badge>;
  }
}

function hebrewToNum(heb: string): number {
  const v: Record<string, number> = {
    'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,
    'י':10,'כ':20,'ך':20,'ל':30,'מ':40,'ם':40,'נ':50,'ן':50,
    'ס':60,'ע':70,'פ':80,'ף':80,'צ':90,'ץ':90,
    'ק':100,'ר':200,'ש':300,'ת':400,
  };
  const clean = heb.replace(/[״׳"']/g, "").trim();
  let total = 0;
  for (const ch of clean) { if (v[ch]) total += v[ch]; }
  return total;
}

function parseDafNum(text: string): string | null {
  const m = text.match(/דף\s+(.+)/);
  if (!m) return null;
  const n = hebrewToNum(m[1].trim());
  return n > 0 ? String(n) : null;
}

function amudKey(text: string): string | null {
  if (text.includes("עמוד א")) return "a";
  if (text.includes("עמוד ב")) return "b";
  return null;
}

function normTitle(s: string): string {
  return s.trim().replace(/\s+/g, " ").replace(/[.,:;!?'"״׳\-–—]/g, "").toLowerCase();
}

function filterNode(node: SourceNode, q: string): boolean {
  if (!q) return true;
  if (node.text.includes(q)) return true;
  return !!node.children?.some(c => filterNode(c, q));
}

function countNodePsakim(node: SourceNode, leafMap: Map<string, LeafData>): number {
  if (!node.children?.length) return leafMap.get(node.id)?.psakim.length || 0;
  return node.children.reduce((s, c) => s + countNodePsakim(c, leafMap), 0);
}

function countLeaves(node: SourceNode): number {
  if (!node.children?.length) return 1;
  return node.children.reduce((s, c) => s + countLeaves(c), 0);
}

/* ─── Merge Logic ────────────────────────────────── */
type LookupMap = Map<string, Map<string, Map<string, TalmudRefWithPsak[]>>>;

function buildLookup(refs: TalmudRefWithPsak[]): LookupMap {
  const m: LookupMap = new Map();
  for (const r of refs) {
    if (!m.has(r.tractate)) m.set(r.tractate, new Map());
    const t = m.get(r.tractate)!;
    if (!t.has(r.daf)) t.set(r.daf, new Map());
    const d = t.get(r.daf)!;
    const a = r.amud || "_none";
    if (!d.has(a)) d.set(a, []);
    d.get(a)!.push(r);
  }
  return m;
}

function refToPsak(r: TalmudRefWithPsak): UnifiedPsak {
  return {
    key: `adv-${r.id}`,
    title: r.psakei_din?.title || r.raw_reference,
    court: r.psakei_din?.court || undefined,
    origin: "advanced",
    rawReference: r.raw_reference,
    confidence: r.confidence_score ?? undefined,
  };
}

function mergeTree(
  src: SourceNode,
  tagMap: TagPsakimMap,
  pIdx: PsakimIndex,
  advRefs: TalmudRefWithPsak[],
): { tree: SourceNode; leafMap: Map<string, LeafData> } {
  const lookup = buildLookup(advRefs);
  const matched = new Set<string>();
  const leafMap = new Map<string, LeafData>();

  function annotate(node: SourceNode, path: string[]) {
    if (!node.children?.length) {
      // Leaf — get source psakim
      const pairs = tagMap[node.id] || [];
      const srcPsakim: UnifiedPsak[] = pairs.map(([fid, oid]) => {
        const info = pIdx[String(fid)];
        return {
          key: `src-${fid}-${oid}`,
          title: info?.n || "פסק דין",
          court: info?.b || undefined,
          href: `${PSAKIM_BASE}/Psakim/File/${fid}${oid ? "#" + oid : ""}`,
          quote: info?.q || undefined,
          origin: "sources" as const,
        };
      });

      // Try to match advanced refs by tractate+daf+amud
      const advPsakim: UnifiedPsak[] = [];
      const branch = path[0];
      if (branch === "בבלי" || branch === "ירושלמי") {
        const tractate = path[1];
        const tmap = lookup.get(tractate);
        if (tmap) {
          const a = amudKey(node.text);
          if (a && path.length >= 3) {
            // Leaf is at amud level; parent path entry is the daf
            const dafStr = parseDafNum(path[path.length - 1]);
            if (dafStr) {
              const refs = tmap.get(dafStr)?.get(a) || [];
              refs.forEach(r => { matched.add(r.id); advPsakim.push(refToPsak(r)); });
            }
          } else {
            // Leaf might be a daf-level node (no amud children)
            const dafStr = parseDafNum(node.text);
            if (dafStr) {
              const dmap = tmap.get(dafStr);
              if (dmap) {
                for (const [, refs] of dmap) {
                  refs.forEach(r => { matched.add(r.id); advPsakim.push(refToPsak(r)); });
                }
              }
            }
          }
        }
      }

      // Deduplicate: merge matching psakim into single entry with origin="both"
      const srcByTitle = new Map<string, UnifiedPsak>();
      for (const p of srcPsakim) srcByTitle.set(normTitle(p.title), p);

      const mergedAdvPsakim: UnifiedPsak[] = [];
      for (const ap of advPsakim) {
        const nt = normTitle(ap.title);
        const existing = srcByTitle.get(nt);
        if (existing) {
          // Same psak — mark the source entry as "both" and enrich it
          existing.origin = "both";
          if (!existing.rawReference && ap.rawReference) existing.rawReference = ap.rawReference;
          if (ap.confidence != null && existing.confidence == null) existing.confidence = ap.confidence;
        } else {
          mergedAdvPsakim.push(ap);
        }
      }

      const allPsakim = [...srcPsakim, ...mergedAdvPsakim];
      const hasSrc = srcPsakim.length > 0;
      const hasAdv = mergedAdvPsakim.length > 0 || srcPsakim.some(p => p.origin === "both");
      const origin: LeafData["origin"] = hasSrc && hasAdv ? "both" : hasAdv ? "advanced" : "sources";

      leafMap.set(node.id, { psakim: allPsakim, origin });
      return;
    }

    for (const c of node.children) annotate(c, [...path, node.text]);
  }

  function clone(n: SourceNode): SourceNode {
    return { id: n.id, text: n.text, children: n.children?.map(clone) };
  }

  const tree = clone(src);
  tree.children?.forEach(b => annotate(b, []));

  // --- Add unmatched advanced refs as new nodes ---
  const unmatched = advRefs.filter(r => !matched.has(r.id));
  if (unmatched.length > 0 && tree.children) {
    const byTractate = new Map<string, TalmudRefWithPsak[]>();
    for (const r of unmatched) {
      if (!byTractate.has(r.tractate)) byTractate.set(r.tractate, []);
      byTractate.get(r.tractate)!.push(r);
    }

    let bavli = tree.children.find(b => b.text === "בבלי");
    if (!bavli) {
      bavli = { id: "u-bavli", text: "בבלי", children: [] };
      tree.children.unshift(bavli);
    }
    if (!bavli.children) bavli.children = [];

    const existingNames = new Set(bavli.children.map(c => c.text));

    function addRefsToLeaf(nodeId: string, psakim: UnifiedPsak[]) {
      const existing = leafMap.get(nodeId);
      if (existing) {
        const titleMap = new Map<string, UnifiedPsak>();
        for (const p of existing.psakim) titleMap.set(normTitle(p.title), p);
        for (const np of psakim) {
          const nt = normTitle(np.title);
          const ep = titleMap.get(nt);
          if (ep) {
            // Merge: mark as both
            ep.origin = "both";
            if (!ep.rawReference && np.rawReference) ep.rawReference = np.rawReference;
            if (np.confidence != null && ep.confidence == null) ep.confidence = np.confidence;
          } else {
            existing.psakim.push(np);
          }
        }
        if (existing.origin === "sources" && psakim.length > 0) existing.origin = "both";
      } else {
        leafMap.set(nodeId, { psakim, origin: "advanced" });
      }
    }

    for (const [tractate, refs] of byTractate) {
      // Group by daf → amud
      const byDaf = new Map<string, Map<string, TalmudRefWithPsak[]>>();
      for (const r of refs) {
        if (!byDaf.has(r.daf)) byDaf.set(r.daf, new Map());
        const dm = byDaf.get(r.daf)!;
        const ak = r.amud || "_none";
        if (!dm.has(ak)) dm.set(ak, []);
        dm.get(ak)!.push(r);
      }

      let tNode: SourceNode;
      if (existingNames.has(tractate)) {
        tNode = bavli.children.find(c => c.text === tractate)!;
      } else {
        tNode = { id: `u-${tractate}`, text: tractate, children: [] };
        bavli.children.push(tNode);
      }
      if (!tNode.children) tNode.children = [];

      const existDafs = new Set<string>();
      for (const c of tNode.children) {
        const d = parseDafNum(c.text);
        if (d) existDafs.add(d);
      }

      for (const [daf, amudMap] of byDaf) {
        if (existDafs.has(daf)) {
          const dafNode = tNode.children.find(c => parseDafNum(c.text) === daf);
          if (dafNode) {
            for (const [a, aRefs] of amudMap) {
              const psakim = aRefs.map(refToPsak);
              if (a === "_none") {
                if (!dafNode.children?.length) {
                  addRefsToLeaf(dafNode.id, psakim);
                } else {
                  // Daf has amud children — create a "כללי" node
                  let gen = dafNode.children.find(c => c.text === "כללי");
                  if (!gen) {
                    gen = { id: `u-${tractate}-${daf}-gen`, text: "כללי" };
                    dafNode.children.push(gen);
                  }
                  addRefsToLeaf(gen.id, psakim);
                }
              } else {
                const aText = a === "a" ? "עמוד א" : "עמוד ב";
                if (!dafNode.children) dafNode.children = [];
                let aNode = dafNode.children.find(c => c.text === aText);
                if (!aNode) {
                  aNode = { id: `u-${tractate}-${daf}-${a}`, text: aText };
                  dafNode.children.push(aNode);
                }
                addRefsToLeaf(aNode.id, psakim);
              }
            }
          }
          continue;
        }

        // New daf node
        const hDaf = toHebrewDaf(parseInt(daf));
        const dafNode: SourceNode = { id: `u-${tractate}-${daf}`, text: `דף ${hDaf}`, children: [] };

        for (const [a, aRefs] of amudMap) {
          const psakim = aRefs.map(refToPsak);
          if (a === "_none") {
            leafMap.set(dafNode.id, { psakim, origin: "advanced" });
          } else {
            const aText = a === "a" ? "עמוד א" : "עמוד ב";
            const aNode: SourceNode = { id: `u-${tractate}-${daf}-${a}`, text: aText };
            dafNode.children!.push(aNode);
            leafMap.set(aNode.id, { psakim, origin: "advanced" });
          }
        }

        if (!dafNode.children!.length) delete dafNode.children;
        tNode.children.push(dafNode);
      }

      // Sort daf children by number
      tNode.children.sort((a, b) => {
        const an = parseDafNum(a.text);
        const bn = parseDafNum(b.text);
        return (an ? parseInt(an) : 999) - (bn ? parseInt(bn) : 999);
      });
    }
  }

  return { tree, leafMap };
}

/* ─── Flatten for list / table views ─────────────── */
function flattenTree(node: SourceNode, leafMap: Map<string, LeafData>, path: string[] = []): FlatLeaf[] {
  if (!node.children?.length) {
    const data = leafMap.get(node.id);
    if (!data || data.psakim.length === 0) return [];
    return [{
      nodeId: node.id,
      text: node.text,
      path: [...path, node.text],
      branch: path[0] || "",
      psakCount: data.psakim.length,
      origin: data.origin,
    }];
  }
  const res: FlatLeaf[] = [];
  for (const c of node.children) res.push(...flattenTree(c, leafMap, [...path, node.text]));
  return res;
}

/* ─── Unified Tree Node (recursive) ──────────────── */
const UnifiedTreeNode = memo(function UnifiedTreeNode({
  node, depth, search, leafMap, onSelect,
}: {
  node: SourceNode;
  depth: number;
  search: string;
  leafMap: Map<string, LeafData>;
  onSelect: (id: string, text: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const isLeaf = !node.children?.length;
  const leafData = leafMap.get(node.id);
  const psakCount = useMemo(() => countNodePsakim(node, leafMap), [node, leafMap]);
  const matches = useMemo(() => filterNode(node, search), [node, search]);

  useEffect(() => {
    if (search && matches) setOpen(true);
  }, [search, matches]);

  if (!matches) return null;

  if (isLeaf) {
    return (
      <button
        onClick={() => onSelect(node.id, node.text)}
        className="flex items-center gap-2 w-full px-4 py-2 rounded-lg hover:bg-primary/10 transition-colors text-right group"
      >
        <span className="text-base flex-1 text-foreground">{node.text}</span>
        {leafData && leafData.psakim.length > 0 && (
          <Badge variant="secondary" className="text-xs h-5 px-1.5 bg-primary/10 text-foreground">
            {leafData.psakim.length}
          </Badge>
        )}
        {leafData && <OriginBadge origin={leafData.origin} />}
        <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  const borderColor = depth === 0 ? "border-accent/40" : "border-border/30";

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg hover:bg-primary/10 transition-colors text-right">
        {depth === 0 && <BranchIcon name={node.text} className="w-5 h-5" />}
        <span
          className={`${depth < 2 ? "font-bold" : "font-medium"} text-foreground`}
          style={{ fontSize: depth === 0 ? "1.125rem" : "1rem" }}
        >
          {node.text}
        </span>
        <ChevronDown className={`w-5 h-5 shrink-0 transition-transform text-foreground ${open ? "" : "-rotate-90"}`} />
        {psakCount > 0 && (
          <Badge variant="secondary" className="text-sm mr-auto bg-primary/10 text-foreground">{psakCount}</Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className={`${depth > 0 ? "mr-4" : ""} space-y-0.5 border-r-2 ${borderColor} pr-3`}>
          {node.children!.map(c => (
            <UnifiedTreeNode key={c.id} node={c} depth={depth + 1} search={search} leafMap={leafMap} onSelect={onSelect} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});

/* ─── Psakim Detail Panel ────────────────────────── */
function UnifiedPsakimPanel({
  nodeId, nodeText, leafMap, onClose,
}: {
  nodeId: string;
  nodeText: string;
  leafMap: Map<string, LeafData>;
  onClose: () => void;
}) {
  const data = leafMap.get(nodeId);
  const psakim = data?.psakim || [];
  const srcCount = psakim.filter(p => p.origin === "sources").length;
  const advCount = psakim.filter(p => p.origin === "advanced").length;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2 text-foreground">
            <Sparkles className="w-6 h-6 text-accent" />
            פסקי דין: {nodeText}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="text-sm border-accent/50 text-foreground">{psakim.length} פסקי דין</Badge>
          {srcCount > 0 && (
            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 border-blue-500/30">
              {srcCount} ממפתח המקורות
            </Badge>
          )}
          {advCount > 0 && (
            <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-700 border-purple-500/30">
              {advCount} מאינדקס מתקדם
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-380px)]">
          {psakim.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">לא נמצאו פסקי דין עבור מקור זה</div>
          )}
          <div className="space-y-3">
            {psakim.map((p, i) => (
              <div
                key={p.key || i}
                className="p-4 rounded-lg border border-accent/40 hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium text-base text-foreground flex-1">{p.title}</div>
                  <Badge
                    variant="outline"
                    className={`text-[9px] mr-2 ${
                      p.origin === "both"
                        ? "bg-green-500/10 text-green-700 border-green-500/30"
                        : p.origin === "advanced"
                          ? "bg-purple-500/10 text-purple-700 border-purple-500/30"
                          : "bg-blue-500/10 text-blue-700 border-blue-500/30"
                    }`}
                  >
                    {p.origin === "both" ? <><BookMarked className="w-3 h-3 inline mr-0.5" /><Database className="w-3 h-3 inline mr-0.5" />שניהם</> : p.origin === "advanced" ? "מתקדם" : "מקורות"}
                  </Badge>
                </div>
                {p.court && (
                  <div className="text-sm text-muted-foreground mb-1">בית דין: {p.court}</div>
                )}
                {p.quote && (
                  <div className="text-sm text-muted-foreground line-clamp-2">{p.quote}...</div>
                )}
                {p.rawReference && (
                  <div className="text-xs text-muted-foreground mt-1">הפניה: {p.rawReference}</div>
                )}
                {p.confidence != null && (
                  <div className="text-xs text-muted-foreground">ביטחון: {Math.round(p.confidence * 100)}%</div>
                )}
                {p.href && (
                  <a
                    href={p.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-accent hover:underline mt-1"
                  >
                    <ExternalLink className="w-3 h-3" />צפה בפסק
                  </a>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

/* ─── Main Component ─────────────────────────────── */
export default function UnifiedTreeTab({ sourcesTree, tagPsakimMap, psakimIndex }: Props) {
  const { data: advancedRefs, isLoading: advLoading } = useAllReferencesGrouped();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [selected, setSelected] = useState<{ id: string; text: string } | null>(null);

  const { tree, leafMap } = useMemo(
    () => mergeTree(sourcesTree, tagPsakimMap, psakimIndex, advancedRefs || []),
    [sourcesTree, tagPsakimMap, psakimIndex, advancedRefs],
  );

  const stats = useMemo(() => {
    let totalPsakim = 0, srcOnly = 0, advOnly = 0, both = 0;
    for (const [, d] of leafMap) {
      totalPsakim += d.psakim.length;
      if (d.origin === "sources") srcOnly++;
      else if (d.origin === "advanced") advOnly++;
      else both++;
    }
    return { totalPsakim, srcOnly, advOnly, both, leafCount: leafMap.size };
  }, [leafMap]);

  const flatLeaves = useMemo(() => {
    const all = flattenTree(tree, leafMap);
    if (!search) return all;
    return all.filter(l =>
      l.text.includes(search) || l.branch.includes(search) || l.path.some(p => p.includes(search)),
    );
  }, [tree, leafMap, search]);

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold flex items-center gap-2 text-foreground">
          <Sparkles className="w-6 h-6 text-accent" />
          עץ מאוחד — מפתח מקורות + אינדקס מתקדם
        </h3>
        <p className="text-muted-foreground text-sm mt-1">
          כל המקורות משני המאגרים בעץ אחד ללא כפילויות
          {advLoading && (
            <span className="mr-2">
              <Loader2 className="w-4 h-4 inline animate-spin" /> טוען נתוני אינדקס מתקדם...
            </span>
          )}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-primary/5 border-accent/40">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.totalPsakim}</div>
            <div className="text-xs text-muted-foreground">סה"כ פסקים (מאוחד)</div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-accent/40">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.leafCount}</div>
            <div className="text-xs text-muted-foreground">מקורות (עלים)</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-600 flex items-center justify-center gap-1">
              <BookMarked className="w-4 h-4" />{stats.srcOnly}
            </div>
            <div className="text-xs text-muted-foreground">ממפתח בלבד</div>
          </CardContent>
        </Card>
        <Card className="bg-purple-500/10 border-purple-500/20">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-purple-600 flex items-center justify-center gap-1">
              <Database className="w-4 h-4" />{stats.advOnly}
            </div>
            <div className="text-xs text-muted-foreground">ממתקדם בלבד</div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1">
              <Sparkles className="w-4 h-4" />{stats.both}
            </div>
            <div className="text-xs text-muted-foreground">משני המאגרים</div>
          </CardContent>
        </Card>
      </div>

      {/* Search + View Toggle */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש מקור (מסכת, הלכה, סימן...)"
            className="pr-10 text-base"
          />
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          {VIEW_OPTIONS.map(opt => (
            <Button
              key={opt.value}
              size="sm"
              variant={viewMode === opt.value ? "default" : "ghost"}
              className="h-8 px-3 gap-1.5 text-sm"
              onClick={() => setViewMode(opt.value)}
              title={opt.label}
            >
              {opt.icon}
              <span className="hidden sm:inline">{opt.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className={`grid gap-4 ${selected ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
        <Card>
          <CardContent className="p-3" dir="rtl">
            {viewMode === "tree" && (
              <ScrollArea className="h-[calc(100vh-500px)]" dir="rtl">
                <div className="space-y-1 w-full text-right">
                  {tree.children?.map(b => (
                    <UnifiedTreeNode
                      key={b.id}
                      node={b}
                      depth={0}
                      search={search}
                      leafMap={leafMap}
                      onSelect={(id, text) => setSelected({ id, text })}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}

            {viewMode === "list" && (
              <ScrollArea className="h-[calc(100vh-500px)]" dir="rtl">
                <div className="space-y-1">
                  {flatLeaves.map(l => (
                    <button
                      key={l.nodeId}
                      onClick={() => setSelected({ id: l.nodeId, text: l.text })}
                      className="flex items-center gap-2 w-full px-4 py-2 rounded-lg hover:bg-primary/10 transition-colors text-right group"
                    >
                      <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {l.path.slice(0, -1).join(" › ")}
                      </span>
                      <span className="text-base flex-1 text-foreground font-medium">{l.text}</span>
                      <Badge variant="secondary" className="text-xs bg-primary/10 text-foreground">{l.psakCount}</Badge>
                      <OriginBadge origin={l.origin} />
                    </button>
                  ))}
                  {flatLeaves.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">לא נמצאו תוצאות</div>
                  )}
                </div>
              </ScrollArea>
            )}

            {viewMode === "table" && (
              <ScrollArea className="h-[calc(100vh-500px)]" dir="rtl">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">ענף</TableHead>
                      <TableHead className="text-right">נתיב</TableHead>
                      <TableHead className="text-right">מקור</TableHead>
                      <TableHead className="text-center">פסקים</TableHead>
                      <TableHead className="text-center">מקור נתונים</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flatLeaves.map(l => (
                      <TableRow
                        key={l.nodeId}
                        className="cursor-pointer hover:bg-primary/5"
                        onClick={() => setSelected({ id: l.nodeId, text: l.text })}
                      >
                        <TableCell className="font-medium">{l.branch}</TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[250px]">
                          {l.path.slice(1, -1).join(" › ")}
                        </TableCell>
                        <TableCell className="font-medium">{l.text}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="bg-primary/10 text-foreground">{l.psakCount}</Badge>
                        </TableCell>
                        <TableCell className="text-center"><OriginBadge origin={l.origin} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {flatLeaves.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">לא נמצאו תוצאות</div>
                )}
              </ScrollArea>
            )}

            {viewMode === "cards" && (
              <ScrollArea className="h-[calc(100vh-500px)]" dir="rtl">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tree.children?.map(branch => {
                    const pCount = countNodePsakim(branch, leafMap);
                    const leaves = countLeaves(branch);
                    return (
                      <Card
                        key={branch.id}
                        className="bg-primary/5 border-accent/40 hover:border-accent/60 transition-colors"
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <BranchIcon name={branch.text} />
                            <span className="text-lg font-bold text-foreground">{branch.text}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">{branch.children?.length || 0} קטגוריות</div>
                          <div className="text-sm text-muted-foreground">{leaves} מקורות</div>
                          <div className="text-sm text-muted-foreground">{pCount} פסקי דין</div>
                          {branch.children && (
                            <div className="mt-3 flex flex-wrap gap-1">
                              {branch.children.slice(0, 8).map(c => (
                                <Badge key={c.id} variant="outline" className="text-xs">{c.text}</Badge>
                              ))}
                              {branch.children.length > 8 && (
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  +{branch.children.length - 8}
                                </Badge>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Detail Panel */}
        {selected && (
          <UnifiedPsakimPanel
            nodeId={selected.id}
            nodeText={selected.text}
            leafMap={leafMap}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  );
}
