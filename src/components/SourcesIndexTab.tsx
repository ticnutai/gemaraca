import { useState, useEffect, useMemo, memo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, BookOpen, Search, ExternalLink, Loader2 } from "lucide-react";

// Types for the sources index tree
interface SourceNode {
  id: string;
  text: string;
  children?: SourceNode[];
}

interface PsakResult {
  title: string;
  href: string;
  court?: string;
  serialNumber?: string;
  quote?: string;
  ogenId?: string;
}

// Local index types
type TagPsakimMap = Record<string, [number, string][]>;  // tagId -> [[fileId, ogenID], ...]
type PsakimIndex = Record<string, { n: string; b: string; q: string }>;  // fileId -> {name, betdin, quote}

const PSAKIM_BASE_URL = "https://www.psakim.org";

// Icons for top-level branches
const branchIcons: Record<string, string> = {
  "בבלי": "📜",
  "ירושלמי": "📗",
  'רמב"ם': "📕",
  "שולחן ערוך": "📘",
};

// Count all leaf nodes in a subtree
function countLeaves(node: SourceNode): number {
  if (!node.children || node.children.length === 0) return 1;
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
}

// Recursive tree node component
const TreeNode = memo(function TreeNode({
  node,
  depth,
  searchFilter,
  onSelectTag,
}: {
  node: SourceNode;
  depth: number;
  searchFilter: string;
  onSelectTag: (tagId: string, tagText: string, breadcrumb: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(depth < 1);
  const hasChildren = node.children && node.children.length > 0;
  const leafCount = useMemo(() => countLeaves(node), [node]);
  const icon = depth === 0 ? branchIcons[node.text] || "📖" : "";

  // Filter matching
  const matchesFilter = useMemo(() => {
    if (!searchFilter) return true;
    const lower = searchFilter.toLowerCase();
    if (node.text.toLowerCase().includes(lower)) return true;
    if (node.children) {
      return node.children.some(function checkChild(c: SourceNode): boolean {
        if (c.text.toLowerCase().includes(lower)) return true;
        return c.children ? c.children.some(checkChild) : false;
      });
    }
    return false;
  }, [node, searchFilter]);

  // Auto-expand when searching
  useEffect(() => {
    if (searchFilter && matchesFilter) {
      setIsOpen(true);
    }
  }, [searchFilter, matchesFilter]);

  if (!matchesFilter) return null;

  // Leaf node - clickable
  if (!hasChildren) {
    return (
      <button
        onClick={() => onSelectTag(node.id, node.text, [])}
        className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors text-right group"
      >
        <span className="text-sm">{node.text}</span>
        <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mr-auto" />
      </button>
    );
  }

  // Branch node - collapsible
  const paddingClass = depth === 0 ? "" : "mr-4";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-right">
        {icon && <span className="text-lg">{icon}</span>}
        <span className={`font-${depth < 2 ? "bold" : "medium"} text-${depth === 0 ? "base" : "sm"}`}>
          {node.text}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? "" : "rotate-90"}`} />
        <Badge variant="secondary" className="text-xs mr-auto">
          {node.children!.length}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className={`${paddingClass} space-y-0.5 border-r-2 border-border/30 pr-3`}>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              searchFilter={searchFilter}
              onSelectTag={onSelectTag}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});

// Panel showing psakim for a selected tag (uses local JSON data)
function PsakimPanel({
  tagId,
  tagText,
  tagPsakimMap,
  psakimIndex,
  onClose,
}: {
  tagId: string;
  tagText: string;
  tagPsakimMap: TagPsakimMap;
  psakimIndex: PsakimIndex;
  onClose: () => void;
}) {
  const psakim = useMemo<PsakResult[]>(() => {
    const entries = tagPsakimMap[tagId] || [];
    return entries.map(([fileId, ogenId]) => {
      const info = psakimIndex[String(fileId)];
      const href = `${PSAKIM_BASE_URL}/Psakim/File/${fileId}${ogenId ? "#" + ogenId : ""}`;
      return {
        title: info?.n || "פסק דין",
        href,
        court: info?.b || undefined,
        serialNumber: String(fileId),
        quote: info?.q || undefined,
        ogenId: ogenId || undefined,
      };
    });
  }, [tagId, tagPsakimMap, psakimIndex]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            פסקי דין: {tagText}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>
        <Badge variant="outline">{psakim.length} פסקי דין</Badge>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-380px)]">
          {psakim.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              לא נמצאו פסקי דין עבור מקור זה
            </div>
          )}
          <div className="space-y-3">
            {psakim.map((psak, idx) => (
              <a
                key={idx}
                href={psak.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="font-medium text-sm mb-1">{psak.title}</div>
                {psak.court && (
                  <div className="text-xs text-muted-foreground mb-1">
                    בית דין: {psak.court}
                    {psak.serialNumber && ` | מס׳ ${psak.serialNumber}`}
                  </div>
                )}
                {psak.quote && (
                  <div className="text-xs text-muted-foreground/70 line-clamp-2" dir="rtl">
                    {psak.quote}...
                  </div>
                )}
                <ExternalLink className="w-3 h-3 text-muted-foreground mt-1" />
              </a>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default function SourcesIndexTab() {
  const [sourcesTree, setSourcesTree] = useState<SourceNode | null>(null);
  const [tagPsakimMap, setTagPsakimMap] = useState<TagPsakimMap>({});
  const [psakimIndex, setPsakimIndex] = useState<PsakimIndex>({});
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedTag, setSelectedTag] = useState<{ id: string; text: string } | null>(null);

  // Load all JSON data
  useEffect(() => {
    Promise.all([
      fetch("/psakim_sources_index.json").then((r) => r.json()),
      fetch("/tag_psakim_map.json").then((r) => r.json()),
      fetch("/psakim_index.json").then((r) => r.json()),
    ])
      .then(([tree, tagMap, pIdx]) => {
        setSourcesTree(tree);
        setTagPsakimMap(tagMap);
        setPsakimIndex(pIdx);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const stats = useMemo(() => {
    if (!sourcesTree?.children) return null;
    return sourcesTree.children.map((branch) => ({
      text: branch.text,
      count: branch.children?.length || 0,
      leaves: countLeaves(branch),
    }));
  }, [sourcesTree]);

  const handleSelectTag = (tagId: string, tagText: string) => {
    setSelectedTag({ id: tagId, text: tagText });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="mr-3 text-lg">טוען מפתח המקורות...</span>
      </div>
    );
  }

  if (!sourcesTree) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        לא ניתן לטעון את מפתח המקורות
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6" dir="rtl">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
          <BookOpen className="w-6 h-6" />
          מפתח המקורות
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          אינדקס היררכי של כל מקורות ההלכה מתוך פסקי הדין. לחץ על עלה לצפייה בפסקי הדין הקשורים.
        </p>

        {/* Stats badges */}
        {stats && (
          <div className="flex flex-wrap gap-2 mb-3">
            {stats.map((s) => (
              <Badge key={s.text} variant="outline" className="text-xs">
                {branchIcons[s.text] || "📖"} {s.text}: {s.count} קטגוריות, {s.leaves} מקורות
              </Badge>
            ))}
            <Badge variant="default" className="text-xs">
              סה״כ {Object.keys(psakimIndex).length} פסקי דין ייחודיים
            </Badge>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש מקור (מסכת, הלכה, סימן...)"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pr-10"
          />
        </div>
      </div>

      {/* Main content: Tree + Psakim panel */}
      <div className={`grid gap-4 ${selectedTag ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
        {/* Tree */}
        <Card>
          <CardContent className="p-3">
            <ScrollArea className="h-[calc(100vh-380px)]">
              <div className="space-y-1">
                {sourcesTree.children?.map((branch) => (
                  <TreeNode
                    key={branch.id}
                    node={branch}
                    depth={0}
                    searchFilter={searchFilter}
                    onSelectTag={handleSelectTag}
                  />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Psakim panel */}
        {selectedTag && (
          <PsakimPanel
            tagId={selectedTag.id}
            tagText={selectedTag.text}
            tagPsakimMap={tagPsakimMap}
            psakimIndex={psakimIndex}
            onClose={() => setSelectedTag(null)}
          />
        )}
      </div>
    </div>
  );
}
