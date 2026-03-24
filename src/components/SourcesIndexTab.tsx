import { useState, useEffect, useMemo, memo, lazy, Suspense } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown, BookOpen, Search, ExternalLink, Loader2,
  TreePine, GitBranch, List, ChevronsUpDown, TableIcon, LayoutGrid,
  Database, Combine, BookMarked, ScrollText, BookText, Library,
} from "lucide-react";

// Lazy load AdvancedIndexTab for אינדקס מתקדם mode
const AdvancedIndexTab = lazy(() => import("@/components/AdvancedIndexTab"));

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
type TagPsakimMap = Record<string, [number, string][]>;
type PsakimIndex = Record<string, { n: string; b: string; q: string }>;
type ViewMode = "tree" | "genealogy" | "list" | "accordion" | "table" | "cards";
type DataSource = "sources" | "advanced" | "both";

interface FlatLeaf {
  id: string;
  text: string;
  branch: string;
  category: string;
  path: string[];
  psakCount: number;
}

// ─── Constants ──────────────────────────────────────────────────────────
const PSAKIM_BASE_URL = "https://www.psakim.org";

function BranchIcon({ name, className = "w-6 h-6" }: { name: string; className?: string }) {
  const cls = `${className} text-amber-500 dark:text-amber-400`;
  switch (name) {
    case "בבלי": return <ScrollText className={cls} />;
    case "ירושלמי": return <BookText className={cls} />;
    case 'רמב"ם': return <BookMarked className={cls} />;
    case "שולחן ערוך": return <Library className={cls} />;
    default: return <BookOpen className={cls} />;
  }
}

const BRANCH_COLORS: Record<string, string> = {
  "בבלי": "border-blue-900 text-blue-900 dark:text-blue-300",
  "ירושלמי": "border-blue-900 text-blue-900 dark:text-blue-300",
  'רמב"ם': "border-blue-900 text-blue-900 dark:text-blue-300",
  "שולחן ערוך": "border-blue-900 text-blue-900 dark:text-blue-300",
};

const BRANCH_BG: Record<string, string> = {
  "בבלי": "bg-blue-900/10 border-blue-900/30",
  "ירושלמי": "bg-blue-900/10 border-blue-900/30",
  'רמב"ם': "bg-blue-900/10 border-blue-900/30",
  "שולחן ערוך": "bg-blue-900/10 border-blue-900/30",
};

const VIEW_OPTIONS: { value: ViewMode; icon: React.ReactNode; label: string }[] = [
  { value: "tree", icon: <TreePine className="w-5 h-5 text-amber-500 dark:text-amber-400" />, label: "עץ" },
  { value: "genealogy", icon: <GitBranch className="w-5 h-5 text-amber-500 dark:text-amber-400" />, label: "עץ ענפים" },
  { value: "list", icon: <List className="w-5 h-5 text-amber-500 dark:text-amber-400" />, label: "רשימה" },
  { value: "accordion", icon: <ChevronsUpDown className="w-5 h-5 text-amber-500 dark:text-amber-400" />, label: "אקורדיון" },
  { value: "table", icon: <TableIcon className="w-5 h-5 text-amber-500 dark:text-amber-400" />, label: "טבלה" },
  { value: "cards", icon: <LayoutGrid className="w-5 h-5 text-amber-500 dark:text-amber-400" />, label: "כרטיסיות" },
];

// ─── Helpers ────────────────────────────────────────────────────────────
function countLeaves(node: SourceNode): number {
  if (!node.children || node.children.length === 0) return 1;
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
}

function flattenLeaves(
  node: SourceNode,
  tagPsakimMap: TagPsakimMap,
  path: string[] = [],
): FlatLeaf[] {
  if (!node.children || node.children.length === 0) {
    return [{
      id: node.id,
      text: node.text,
      branch: path[0] || "",
      category: path[1] || "",
      path: [...path, node.text],
      psakCount: (tagPsakimMap[node.id] || []).length,
    }];
  }
  const results: FlatLeaf[] = [];
  for (const child of node.children) {
    results.push(...flattenLeaves(child, tagPsakimMap, [...path, node.text]));
  }
  return results;
}

function filterNode(node: SourceNode, search: string): boolean {
  if (!search) return true;
  const lower = search.toLowerCase();
  if (node.text.toLowerCase().includes(lower)) return true;
  if (node.children) {
    return node.children.some((c) => filterNode(c, lower));
  }
  return false;
}

function countPsakimInSubtree(node: SourceNode, tagPsakimMap: TagPsakimMap): number {
  if (!node.children || node.children.length === 0) {
    return (tagPsakimMap[node.id] || []).length;
  }
  return node.children.reduce((sum, c) => sum + countPsakimInSubtree(c, tagPsakimMap), 0);
}

// ─── Tree View (Recursive) ──────────────────────────────────────────
const TreeNode = memo(function TreeNode({
  node,
  depth,
  searchFilter,
  tagPsakimMap,
  onSelectTag,
}: {
  node: SourceNode;
  depth: number;
  searchFilter: string;
  tagPsakimMap: TagPsakimMap;
  onSelectTag: (tagId: string, tagText: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(depth < 1);
  const hasChildren = node.children && node.children.length > 0;
  const showBranchIcon = depth === 0;
  const psakCount = useMemo(
    () => hasChildren ? 0 : (tagPsakimMap[node.id] || []).length,
    [node.id, hasChildren, tagPsakimMap],
  );

  const matchesFilter = useMemo(() => filterNode(node, searchFilter), [node, searchFilter]);

  useEffect(() => {
    if (searchFilter && matchesFilter) setIsOpen(true);
  }, [searchFilter, matchesFilter]);

  if (!matchesFilter) return null;

  // Leaf node
  if (!hasChildren) {
    return (
      <button
        onClick={() => onSelectTag(node.id, node.text)}
        className="flex items-center gap-2 w-full px-4 py-2 rounded-lg hover:bg-blue-900/10 transition-colors text-right group"
      >
        <span className="text-base flex-1 text-blue-900 dark:text-blue-300">{node.text}</span>
        {psakCount > 0 && (
          <Badge variant="secondary" className="text-xs h-5 px-1.5 bg-blue-900/10 text-blue-900 dark:text-blue-300">{psakCount}</Badge>
        )}
        <ExternalLink className="w-4 h-4 text-blue-900/50 dark:text-blue-300/50 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  // Branch node
  const borderColor = depth === 0 ? BRANCH_COLORS[node.text]?.split(" ")[0] || "border-border/30" : "border-border/30";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg hover:bg-blue-900/10 transition-colors text-right">
        {showBranchIcon && <BranchIcon name={node.text} className="w-5 h-5" />}
        <span className={`${depth < 2 ? "font-bold" : "font-medium"} text-blue-900 dark:text-blue-300`} style={{ fontSize: depth === 0 ? "1.125rem" : "1rem" }}>
          {node.text}
        </span>
        <ChevronDown className={`w-5 h-5 shrink-0 transition-transform text-blue-900 dark:text-blue-300 ${isOpen ? "" : "-rotate-90"}`} />
        <Badge variant="secondary" className="text-sm mr-auto bg-blue-900/10 text-blue-900 dark:text-blue-300">{node.children!.length}</Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className={`${depth > 0 ? "mr-4" : ""} space-y-0.5 border-r-2 ${borderColor} pr-3`}>
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} searchFilter={searchFilter} tagPsakimMap={tagPsakimMap} onSelectTag={onSelectTag} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});

// ─── Genealogy / Branch View ────────────────────────────────────────
function GenealogyView({
  tree,
  tagPsakimMap,
  searchFilter,
  onSelectTag,
}: {
  tree: SourceNode;
  tagPsakimMap: TagPsakimMap;
  searchFilter: string;
  onSelectTag: (tagId: string, tagText: string) => void;
}) {
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedSubCat, setExpandedSubCat] = useState<string | null>(null);

  const branches = useMemo(() => {
    if (!tree.children) return [];
    if (!searchFilter) return tree.children;
    return tree.children.filter((b) => filterNode(b, searchFilter));
  }, [tree, searchFilter]);

  const selectedBranch = branches.find((b) => b.id === expandedBranch);
  const selectedCategory = selectedBranch?.children?.find((c) => c.id === expandedCategory);
  const selectedSubCat = selectedCategory?.children?.find((s) => s.id === expandedSubCat);

  return (
    <div className="space-y-4">
      {/* Root node */}
      <div className="flex justify-center">
        <div className="bg-blue-900/10 border-2 border-blue-900 dark:border-blue-300 rounded-xl px-6 py-3 text-center">
          <BookOpen className="w-6 h-6 mx-auto mb-1 text-amber-500 dark:text-amber-400" />
          <div className="font-bold text-lg text-blue-900 dark:text-blue-300">מפתח המקורות</div>
          <div className="text-sm text-blue-900/70 dark:text-blue-300/70">{countLeaves(tree)} מקורות</div>
        </div>
      </div>

      {/* Vertical connector */}
      <div className="flex justify-center"><div className="w-0.5 h-6 bg-border" /></div>

      {/* Horizontal connector line */}
      <div className="flex justify-center">
        <div className="h-0.5 bg-border" style={{ width: `${Math.min(branches.length * 180, 720)}px` }} />
      </div>

      {/* Branches */}
      <div className="flex flex-wrap justify-center gap-3">
        {branches.map((branch) => {
          const isExpanded = expandedBranch === branch.id;
          const bg = BRANCH_BG[branch.text] || "bg-muted";
          const leaves = countLeaves(branch);
          return (
            <button
              key={branch.id}
              onClick={() => {
                setExpandedBranch(isExpanded ? null : branch.id);
                setExpandedCategory(null);
                setExpandedSubCat(null);
              }}
              className={`${bg} border-2 border-blue-900/30 dark:border-blue-300/30 rounded-xl px-5 py-3 text-center transition-all hover:scale-105 ${isExpanded ? "ring-2 ring-blue-900 dark:ring-blue-300" : ""}`}
            >
              <div className="block mb-1 flex justify-center"><BranchIcon name={branch.text} className="w-8 h-8" /></div>
              <div className="font-bold text-base text-blue-900 dark:text-blue-300">{branch.text}</div>
              <div className="text-sm text-blue-900/70 dark:text-blue-300/70">{branch.children?.length} קטגוריות • {leaves} מקורות</div>
            </button>
          );
        })}
      </div>

      {/* Expanded branch → categories */}
      {selectedBranch && selectedBranch.children && (
        <>
          <div className="flex justify-center"><div className="w-0.5 h-4 bg-border" /></div>
          <Card className={`border-2 ${BRANCH_BG[selectedBranch.text]?.split(" ")[1] || ""}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-blue-900 dark:text-blue-300">
                <BranchIcon name={selectedBranch.text} className="w-5 h-5" /> {selectedBranch.text} — קטגוריות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {selectedBranch.children
                  .filter((c) => filterNode(c, searchFilter))
                  .map((cat) => {
                    const isSelected = expandedCategory === cat.id;
                    const catLeaves = countLeaves(cat);
                    const catPsakim = countPsakimInSubtree(cat, tagPsakimMap);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setExpandedCategory(isSelected ? null : cat.id);
                          setExpandedSubCat(null);
                        }}
                        className={`border border-blue-900/20 rounded-lg px-4 py-2.5 text-base transition-all hover:bg-blue-900/10 ${isSelected ? "bg-blue-900/10 border-blue-900 ring-1 ring-blue-900 dark:border-blue-300 dark:ring-blue-300" : ""}`}
                      >
                        <div className="font-medium text-blue-900 dark:text-blue-300">{cat.text}</div>
                        <div className="text-xs text-blue-900/60 dark:text-blue-300/60">{catLeaves} מקורות • {catPsakim} פסקים</div>
                      </button>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Expanded category → sub-categories or leaves */}
      {selectedCategory && selectedCategory.children && (
        <>
          <div className="flex justify-center"><div className="w-0.5 h-4 bg-border" /></div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-blue-900 dark:text-blue-300">{selectedBranch?.text} › {selectedCategory.text}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {selectedCategory.children
                  .filter((c) => filterNode(c, searchFilter))
                  .map((item) => {
                    const isLeaf = !item.children || item.children.length === 0;
                    if (isLeaf) {
                      const pCount = (tagPsakimMap[item.id] || []).length;
                      return (
                        <button
                          key={item.id}
                          onClick={() => onSelectTag(item.id, item.text)}
                          className="border border-blue-900/20 rounded-lg px-4 py-2.5 text-base hover:bg-blue-900/10 transition-all group"
                        >
                          <span className="text-blue-900 dark:text-blue-300">{item.text}</span>
                          {pCount > 0 && <Badge variant="secondary" className="text-xs mr-1 bg-blue-900/10 text-blue-900 dark:text-blue-300">{pCount}</Badge>}
                        </button>
                      );
                    }
                    const isSelected = expandedSubCat === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setExpandedSubCat(isSelected ? null : item.id)}
                        className={`border border-blue-900/20 rounded-lg px-4 py-2.5 text-base transition-all hover:bg-blue-900/10 ${isSelected ? "bg-blue-900/10 border-blue-900 dark:border-blue-300" : ""}`}
                      >
                        <div className="font-medium text-blue-900 dark:text-blue-300">{item.text}</div>
                        <div className="text-xs text-blue-900/60 dark:text-blue-300/60">{countLeaves(item)} מקורות</div>
                      </button>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Expanded sub-category → leaves */}
      {selectedSubCat && selectedSubCat.children && (
        <>
          <div className="flex justify-center"><div className="w-0.5 h-4 bg-border" /></div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-blue-900 dark:text-blue-300">
                {selectedBranch?.text} › {selectedCategory?.text} › {selectedSubCat.text}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {selectedSubCat.children
                  .filter((c) => filterNode(c, searchFilter))
                  .map((leaf) => {
                    const isLeaf = !leaf.children || leaf.children.length === 0;
                    const pCount = isLeaf ? (tagPsakimMap[leaf.id] || []).length : countPsakimInSubtree(leaf, tagPsakimMap);
                    return (
                      <button
                        key={leaf.id}
                        onClick={() => isLeaf ? onSelectTag(leaf.id, leaf.text) : null}
                        className="border border-blue-900/20 rounded-lg px-4 py-2 text-base hover:bg-blue-900/10 transition-all"
                      >
                        <span className="text-blue-900 dark:text-blue-300">{leaf.text}</span>
                        {pCount > 0 && <Badge variant="secondary" className="text-xs mr-1 bg-blue-900/10 text-blue-900 dark:text-blue-300">{pCount}</Badge>}
                      </button>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── List View ──────────────────────────────────────────────────────
function SourcesListView({
  leaves,
  onSelectTag,
}: {
  leaves: FlatLeaf[];
  onSelectTag: (tagId: string, tagText: string) => void;
}) {
  return (
    <ScrollArea className="h-[calc(100vh-500px)]">
      <div className="space-y-1">
        {leaves.map((leaf) => (
          <button
            key={leaf.id}
            onClick={() => onSelectTag(leaf.id, leaf.text)}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg hover:bg-blue-900/10 transition-colors text-right group"
          >
            <BranchIcon name={leaf.branch} className="w-5 h-5" />
            <span className="text-sm text-blue-900/60 dark:text-blue-300/60 truncate max-w-[250px]">
              {leaf.path.slice(0, -1).join(" › ")}
            </span>
            <span className="text-base font-medium flex-1 text-blue-900 dark:text-blue-300">{leaf.text}</span>
            {leaf.psakCount > 0 && (
              <Badge variant="secondary" className="text-xs bg-blue-900/10 text-blue-900 dark:text-blue-300">{leaf.psakCount} פסקים</Badge>
            )}
            <ExternalLink className="w-4 h-4 text-blue-900/40 dark:text-blue-300/40 opacity-0 group-hover:opacity-100" />
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}

// ─── Accordion View ─────────────────────────────────────────────────
function SourcesAccordionView({
  tree,
  tagPsakimMap,
  searchFilter,
  onSelectTag,
}: {
  tree: SourceNode;
  tagPsakimMap: TagPsakimMap;
  searchFilter: string;
  onSelectTag: (tagId: string, tagText: string) => void;
}) {
  const branches = useMemo(() => {
    if (!tree.children) return [];
    if (!searchFilter) return tree.children;
    return tree.children.filter((b) => filterNode(b, searchFilter));
  }, [tree, searchFilter]);

  return (
    <ScrollArea className="h-[calc(100vh-500px)]">
      <Accordion type="multiple" className="space-y-1">
        {branches.map((branch) => (
          <AccordionItem key={branch.id} value={branch.id} className={`border-r-4 border-blue-900 dark:border-blue-300 rounded-lg border px-0`}>
            <AccordionTrigger className="px-4 py-3 text-right hover:no-underline">
              <div className="flex items-center gap-2 w-full">
                <BranchIcon name={branch.text} className="w-5 h-5" />
                <span className="font-bold flex-1 text-lg text-blue-900 dark:text-blue-300">{branch.text}</span>
                <Badge variant="secondary" className="text-sm bg-blue-900/10 text-blue-900 dark:text-blue-300">{branch.children?.length} קטגוריות</Badge>
                <Badge variant="outline" className="text-sm border-blue-900/30 text-blue-900 dark:text-blue-300">{countLeaves(branch)} מקורות</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-2">
              <Accordion type="multiple" className="space-y-0.5">
                {branch.children?.filter((c) => filterNode(c, searchFilter)).map((category) => (
                  <AccordionItem key={category.id} value={category.id} className="border rounded-lg px-0">
                    <AccordionTrigger className="px-4 py-2.5 text-right text-base hover:no-underline">
                      <div className="flex items-center gap-2 w-full">
                        <span className="font-medium flex-1 text-blue-900 dark:text-blue-300">{category.text}</span>
                        <Badge variant="secondary" className="text-xs bg-blue-900/10 text-blue-900 dark:text-blue-300">{countLeaves(category)}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3">
                      {category.children ? (
                        <div className="space-y-0.5">
                          {category.children.filter((c) => filterNode(c, searchFilter)).map((item) => {
                            const isLeaf = !item.children || item.children.length === 0;
                            if (isLeaf) {
                              const pCount = (tagPsakimMap[item.id] || []).length;
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => onSelectTag(item.id, item.text)}
                                  className="flex items-center gap-2 w-full px-4 py-2 rounded hover:bg-blue-900/10 text-right text-base"
                                >
                                  <span className="flex-1 text-blue-900 dark:text-blue-300">{item.text}</span>
                                  {pCount > 0 && <Badge variant="secondary" className="text-xs bg-blue-900/10 text-blue-900 dark:text-blue-300">{pCount}</Badge>}
                                </button>
                              );
                            }
                            return (
                              <Accordion key={item.id} type="multiple">
                                <AccordionItem value={item.id} className="border-0">
                                  <AccordionTrigger className="px-4 py-2 text-right text-base hover:no-underline">
                                    <div className="flex items-center gap-2 w-full">
                                      <span className="flex-1 text-blue-900 dark:text-blue-300">{item.text}</span>
                                      <Badge variant="secondary" className="text-xs bg-blue-900/10 text-blue-900 dark:text-blue-300">{countLeaves(item)}</Badge>
                                    </div>
                                  </AccordionTrigger>
                                  <AccordionContent className="px-4">
                                    <div className="space-y-0.5">
                                      {item.children?.filter((c) => filterNode(c, searchFilter)).map((leaf) => {
                                        const pCount = (tagPsakimMap[leaf.id] || []).length;
                                        return (
                                          <button
                                            key={leaf.id}
                                            onClick={() => onSelectTag(leaf.id, leaf.text)}
                                            className="flex items-center gap-2 w-full px-4 py-1.5 rounded hover:bg-blue-900/10 text-right text-sm"
                                          >
                                            <span className="flex-1 text-blue-900 dark:text-blue-300">{leaf.text}</span>
                                            {pCount > 0 && <Badge variant="secondary" className="text-xs bg-blue-900/10 text-blue-900 dark:text-blue-300">{pCount}</Badge>}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              </Accordion>
                            );
                          })}
                        </div>
                      ) : null}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </ScrollArea>
  );
}

// ─── Table View ─────────────────────────────────────────────────────
function SourcesTableView({
  leaves,
  onSelectTag,
}: {
  leaves: FlatLeaf[];
  onSelectTag: (tagId: string, tagText: string) => void;
}) {
  return (
    <ScrollArea className="h-[calc(100vh-500px)]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right text-base text-blue-900 dark:text-blue-300">ענף</TableHead>
            <TableHead className="text-right text-base text-blue-900 dark:text-blue-300">קטגוריה</TableHead>
            <TableHead className="text-right text-base text-blue-900 dark:text-blue-300">מקור</TableHead>
            <TableHead className="text-right text-base text-blue-900 dark:text-blue-300">נתיב מלא</TableHead>
            <TableHead className="text-right text-base text-blue-900 dark:text-blue-300">פסקי דין</TableHead>
            <TableHead className="text-right w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {leaves.map((leaf) => (
            <TableRow
              key={leaf.id}
              className="cursor-pointer hover:bg-blue-900/5"
              onClick={() => onSelectTag(leaf.id, leaf.text)}
            >
              <TableCell>
                <span className="flex items-center gap-1 text-base text-blue-900 dark:text-blue-300">
                  <BranchIcon name={leaf.branch} className="w-4 h-4" /> {leaf.branch}
                </span>
              </TableCell>
              <TableCell className="text-base text-blue-900 dark:text-blue-300">{leaf.category}</TableCell>
              <TableCell className="font-medium text-base text-blue-900 dark:text-blue-300">{leaf.text}</TableCell>
              <TableCell className="text-sm text-blue-900/60 dark:text-blue-300/60 truncate max-w-[250px]">
                {leaf.path.join(" › ")}
              </TableCell>
              <TableCell>
                {leaf.psakCount > 0 ? (
                  <Badge variant="secondary" className="text-xs bg-blue-900/10 text-blue-900 dark:text-blue-300">{leaf.psakCount}</Badge>
                ) : (
                  <span className="text-sm text-blue-900/40 dark:text-blue-300/40">—</span>
                )}
              </TableCell>
              <TableCell>
                <ExternalLink className="w-4 h-4 text-blue-900/40 dark:text-blue-300/40" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

// ─── Cards View ─────────────────────────────────────────────────────
function SourcesCardsView({
  tree,
  tagPsakimMap,
  searchFilter,
  onSelectTag,
}: {
  tree: SourceNode;
  tagPsakimMap: TagPsakimMap;
  searchFilter: string;
  onSelectTag: (tagId: string, tagText: string) => void;
}) {
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);

  const branches = useMemo(() => {
    if (!tree.children) return [];
    if (!searchFilter) return tree.children;
    return tree.children.filter((b) => filterNode(b, searchFilter));
  }, [tree, searchFilter]);

  const activeBranch = branches.find((b) => b.id === selectedBranch) || branches[0];

  return (
    <div className="space-y-4">
      {/* Branch tabs */}
      <div className="flex gap-2 flex-wrap">
        {branches.map((branch) => (
          <Button
            key={branch.id}
            variant={(activeBranch?.id === branch.id) ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedBranch(branch.id)}
            className="gap-1"
          >
            <BranchIcon name={branch.text} className="w-5 h-5" />
            {branch.text}
            <Badge variant="secondary" className="text-xs h-5 px-1.5 bg-blue-900/10 text-blue-900 dark:text-blue-300">{countLeaves(branch)}</Badge>
          </Button>
        ))}
      </div>

      {/* Cards grid for selected branch */}
      {activeBranch && (
        <ScrollArea className="h-[calc(100vh-550px)]">
          <div className="space-y-6">
            {activeBranch.children?.filter((c) => filterNode(c, searchFilter)).map((category) => (
              <div key={category.id}>
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2 border-b pb-2 text-blue-900 dark:text-blue-300">
                  {category.text}
                  <Badge variant="outline" className="border-blue-900/30 text-blue-900 dark:text-blue-300">{countLeaves(category)} מקורות</Badge>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {flattenLeaves(category, tagPsakimMap, [activeBranch.text, category.text]).map((leaf) => (
                    <button
                      key={leaf.id}
                      onClick={() => onSelectTag(leaf.id, leaf.text)}
                      className="border border-blue-900/20 rounded-lg p-4 text-right hover:bg-blue-900/5 hover:border-blue-900/30 transition-all group"
                    >
                      <div className="font-medium text-base mb-1 text-blue-900 dark:text-blue-300">{leaf.text}</div>
                      {leaf.path.length > 3 && (
                        <div className="text-xs text-blue-900/50 dark:text-blue-300/50 mb-1 truncate">
                          {leaf.path.slice(2, -1).join(" › ")}
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        {leaf.psakCount > 0 ? (
                          <Badge variant="secondary" className="text-xs bg-blue-900/10 text-blue-900 dark:text-blue-300">{leaf.psakCount} פסקים</Badge>
                        ) : (
                          <span className="text-xs text-blue-900/40 dark:text-blue-300/40">ללא פסקים</span>
                        )}
                        <ExternalLink className="w-4 h-4 text-blue-900/40 dark:text-blue-300/40 opacity-0 group-hover:opacity-100" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

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
          <CardTitle className="text-xl flex items-center gap-2 text-blue-900 dark:text-blue-300">
            <BookOpen className="w-6 h-6 text-amber-500 dark:text-amber-400" />
            פסקי דין: {tagText}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>
        <Badge variant="outline" className="text-sm border-blue-900/30 text-blue-900 dark:text-blue-300">{psakim.length} פסקי דין</Badge>
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
                className="block p-4 rounded-lg border border-blue-900/20 hover:bg-blue-900/5 transition-colors"
              >
                <div className="font-medium text-base mb-1 text-blue-900 dark:text-blue-300">{psak.title}</div>
                {psak.court && (
                  <div className="text-sm text-blue-900/60 dark:text-blue-300/60 mb-1">
                    בית דין: {psak.court}
                    {psak.serialNumber && ` | מס׳ ${psak.serialNumber}`}
                  </div>
                )}
                {psak.quote && (
                  <div className="text-sm text-blue-900/50 dark:text-blue-300/50 line-clamp-2" dir="rtl">
                    {psak.quote}...
                  </div>
                )}
                <ExternalLink className="w-4 h-4 text-blue-900/40 dark:text-blue-300/40 mt-1" />
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
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [dataSource, setDataSource] = useState<DataSource>("sources");

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
      psakim: countPsakimInSubtree(branch, tagPsakimMap),
    }));
  }, [sourcesTree, tagPsakimMap]);

  const totalLeaves = useMemo(() => sourcesTree ? countLeaves(sourcesTree) : 0, [sourcesTree]);

  // Flat leaves for list/table views
  const flatLeaves = useMemo(() => {
    if (!sourcesTree) return [];
    const all = flattenLeaves(sourcesTree, tagPsakimMap);
    if (!searchFilter) return all;
    const lower = searchFilter.toLowerCase();
    return all.filter((l) =>
      l.text.toLowerCase().includes(lower) ||
      l.category.toLowerCase().includes(lower) ||
      l.branch.toLowerCase().includes(lower) ||
      l.path.some((p) => p.toLowerCase().includes(lower)),
    );
  }, [sourcesTree, tagPsakimMap, searchFilter]);

  const handleSelectTag = (tagId: string, tagText: string) => {
    setSelectedTag({ id: tagId, text: tagText });
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4 md:p-6" dir="rtl" data-testid="sources-index-container">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 animate-pulse text-amber-500 dark:text-amber-400" />
          <span className="text-blue-900/70 dark:text-blue-300/70 font-medium text-base">טוען מפתח המקורות...</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!sourcesTree) {
    return (
      <div className="text-center py-12 text-muted-foreground" dir="rtl" data-testid="sources-index-container">
        לא ניתן לטעון את מפתח המקורות
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6" dir="rtl" data-testid="sources-index-container">
      {/* ───── Header ───── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-300 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-amber-500 dark:text-amber-400" />
            מפתח המקורות
          </h2>
          <p className="text-blue-900/60 dark:text-blue-300/60 text-base mt-1">
            אינדקס היררכי של כל מקורות ההלכה מתוך פסקי הדין • חיפוש וניווט
          </p>
        </div>
      </div>

      {/* ───── Data Source Toggle ───── */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-base text-blue-900/70 dark:text-blue-300/70 font-medium">מקור נתונים:</span>
        <ToggleGroup
          type="single"
          value={dataSource}
          onValueChange={(v) => v && setDataSource(v as DataSource)}
          className="bg-muted rounded-lg p-0.5"
        >
          <ToggleGroupItem value="sources" className="gap-1.5 text-sm px-4 py-2 data-[state=on]:bg-blue-900 data-[state=on]:text-white data-[state=on]:shadow-sm text-blue-900 dark:text-blue-300">
            <BookMarked className="w-5 h-5" />
            מפתח המקורות
          </ToggleGroupItem>
          <ToggleGroupItem value="advanced" className="gap-1.5 text-sm px-4 py-2 data-[state=on]:bg-blue-900 data-[state=on]:text-white data-[state=on]:shadow-sm text-blue-900 dark:text-blue-300">
            <Database className="w-5 h-5" />
            אינדקס מתקדם
          </ToggleGroupItem>
          <ToggleGroupItem value="both" className="gap-1.5 text-sm px-4 py-2 data-[state=on]:bg-blue-900 data-[state=on]:text-white data-[state=on]:shadow-sm text-blue-900 dark:text-blue-300">
            <Combine className="w-5 h-5" />
            שניהם יחד
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* ───── Advanced Index Only ───── */}
      {dataSource === "advanced" && (
        <Suspense fallback={
          <div className="flex items-center gap-3 py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-900 dark:text-blue-300" />
            <span className="text-blue-900/70 dark:text-blue-300/70 text-base">טוען אינדקס מתקדם...</span>
          </div>
        }>
          <AdvancedIndexTab />
        </Suspense>
      )}

      {/* ───── Sources Index ───── */}
      {(dataSource === "sources" || dataSource === "both") && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {stats?.map((s) => (
              <Card key={s.text} className={BRANCH_BG[s.text] || "bg-muted"}>
                <CardContent className="p-4 text-center">
                  <div className="mb-1 flex justify-center"><BranchIcon name={s.text} className="w-8 h-8" /></div>
                  <div className="font-bold text-base text-blue-900 dark:text-blue-300">{s.text}</div>
                  <div className="text-sm text-blue-900/60 dark:text-blue-300/60">{s.count} קטגוריות</div>
                  <div className="text-sm text-blue-900/60 dark:text-blue-300/60">{s.leaves} מקורות</div>
                </CardContent>
              </Card>
            ))}
            <Card className="bg-blue-900/5 border-blue-900/20">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-blue-900 dark:text-blue-300">{Object.keys(psakimIndex).length}</div>
                <div className="text-sm text-blue-900/60 dark:text-blue-300/60">פסקי דין ייחודיים</div>
                <div className="text-sm text-blue-900/60 dark:text-blue-300/60">{totalLeaves} מקורות</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters Row */}
          <div className="flex gap-3 items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-900/40 dark:text-blue-300/40" />
              <Input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="חיפוש מקור (מסכת, הלכה, סימן...)"
                className="pr-10 text-base"
              />
            </div>
          </div>

          {/* View Mode Toggle + Info */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2 text-base text-blue-900/70 dark:text-blue-300/70">
              <span>{flatLeaves.length} מקורות</span>
              <span>•</span>
              <span>{stats?.length || 0} ענפים</span>
              {selectedTag && (
                <>
                  <span>•</span>
                  <span className="text-blue-900 dark:text-blue-300 font-medium">{selectedTag.text}</span>
                </>
              )}
            </div>
            <div className="flex gap-1 bg-muted rounded-lg p-0.5">
              {VIEW_OPTIONS.map((opt) => (
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

          {/* ───── Content Grid ───── */}
          <div className={`grid gap-4 ${selectedTag ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
            {/* Main View */}
            <Card>
              <CardContent className="p-3" dir="rtl">
                {viewMode === "tree" && (
                  <ScrollArea className="h-[calc(100vh-500px)]" dir="rtl">
                    <div className="space-y-1 w-full text-right" dir="rtl">
                      {sourcesTree.children?.map((branch) => (
                        <TreeNode
                          key={branch.id}
                          node={branch}
                          depth={0}
                          searchFilter={searchFilter}
                          tagPsakimMap={tagPsakimMap}
                          onSelectTag={handleSelectTag}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
                {viewMode === "genealogy" && (
                  <ScrollArea className="h-[calc(100vh-500px)]">
                    <GenealogyView
                      tree={sourcesTree}
                      tagPsakimMap={tagPsakimMap}
                      searchFilter={searchFilter}
                      onSelectTag={handleSelectTag}
                    />
                  </ScrollArea>
                )}
                {viewMode === "list" && (
                  <SourcesListView leaves={flatLeaves} onSelectTag={handleSelectTag} />
                )}
                {viewMode === "accordion" && (
                  <SourcesAccordionView
                    tree={sourcesTree}
                    tagPsakimMap={tagPsakimMap}
                    searchFilter={searchFilter}
                    onSelectTag={handleSelectTag}
                  />
                )}
                {viewMode === "table" && (
                  <SourcesTableView leaves={flatLeaves} onSelectTag={handleSelectTag} />
                )}
                {viewMode === "cards" && (
                  <SourcesCardsView
                    tree={sourcesTree}
                    tagPsakimMap={tagPsakimMap}
                    searchFilter={searchFilter}
                    onSelectTag={handleSelectTag}
                  />
                )}
              </CardContent>
            </Card>

            {/* Psakim Panel */}
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
        </>
      )}

      {/* ───── Both: Advanced Index below sources ───── */}
      {dataSource === "both" && (
        <div className="border-t pt-4 mt-2">
          <h3 className="text-xl font-bold flex items-center gap-2 mb-3 text-blue-900 dark:text-blue-300">
            <Database className="w-6 h-6 text-amber-500 dark:text-amber-400" />
            אינדקס מתקדם — הפניות תלמודיות מפסקי דין
          </h3>
          <Suspense fallback={
            <div className="flex items-center gap-3 py-8">
<Loader2 className="w-6 h-6 animate-spin text-blue-900 dark:text-blue-300" />
            <span className="text-blue-900/70 dark:text-blue-300/70 text-base">טוען אינדקס מתקדם...</span>
            </div>
          }>
            <AdvancedIndexTab />
          </Suspense>
        </div>
      )}
    </div>
  );
}
