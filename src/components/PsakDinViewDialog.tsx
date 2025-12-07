import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, Building2, FileText, ExternalLink, Download, Eye, FileIcon, 
  Maximize2, Minimize2, AlignRight, AlignCenter, AlignLeft, AlignJustify,
  Type, Bold, Italic, Highlighter, AArrowUp, AArrowDown, Palette, Edit, Save, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const VIEWER_TEXT_SETTINGS_KEY = 'psak-din-viewer-text-settings';

const FONTS = [
  { value: 'font-sans', label: 'אריאל' },
  { value: 'font-serif', label: 'טיימס' },
  { value: 'font-david', label: 'דוד' },
  { value: 'font-frank', label: 'פרנק רוהל' },
  { value: 'font-heebo', label: 'חיבו' },
  { value: 'font-rubik', label: 'רוביק' },
  { value: 'font-noto-serif', label: 'נוטו סריף' },
];

const TEXT_COLORS = [
  { value: 'text-foreground', label: 'ברירת מחדל', color: 'currentColor' },
  { value: 'text-blue-700', label: 'כחול', color: '#1d4ed8' },
  { value: 'text-red-700', label: 'אדום', color: '#b91c1c' },
  { value: 'text-green-700', label: 'ירוק', color: '#15803d' },
  { value: 'text-purple-700', label: 'סגול', color: '#7e22ce' },
  { value: 'text-amber-700', label: 'כתום', color: '#b45309' },
];

const BG_COLORS = [
  { value: 'bg-transparent', label: 'ללא', color: 'transparent' },
  { value: 'bg-yellow-100', label: 'צהוב', color: '#fef9c3' },
  { value: 'bg-green-100', label: 'ירוק', color: '#dcfce7' },
  { value: 'bg-blue-100', label: 'כחול', color: '#dbeafe' },
  { value: 'bg-pink-100', label: 'ורוד', color: '#fce7f3' },
  { value: 'bg-orange-100', label: 'כתום', color: '#ffedd5' },
];

interface TextSettings {
  fontSize: number;
  fontFamily: string;
  textAlign: 'right' | 'center' | 'left' | 'justify';
  isBold: boolean;
  isItalic: boolean;
  textColor: string;
  bgColor: string;
}

const defaultTextSettings: TextSettings = {
  fontSize: 16,
  fontFamily: 'font-serif',
  textAlign: 'right',
  isBold: false,
  isItalic: false,
  textColor: 'text-foreground',
  bgColor: 'bg-transparent',
};

interface PsakDinViewDialogProps {
  psak: {
    id?: string;
    title: string;
    court?: string;
    year?: number;
    case_number?: string;
    caseNumber?: string;
    summary: string;
    full_text?: string;
    fullText?: string;
    source_url?: string;
    sourceUrl?: string;
    tags?: string[];
    source?: string;
    connection?: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

const PsakDinViewDialog = ({ psak, open, onOpenChange, onSave }: PsakDinViewDialogProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState("preview");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [textSettings, setTextSettings] = useState<TextSettings>(() => {
    const saved = localStorage.getItem(VIEWER_TEXT_SETTINGS_KEY);
    return saved ? JSON.parse(saved) : defaultTextSettings;
  });

  // Editable fields
  const [editTitle, setEditTitle] = useState("");
  const [editCourt, setEditCourt] = useState("");
  const [editYear, setEditYear] = useState<number | "">("");
  const [editCaseNumber, setEditCaseNumber] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editFullText, setEditFullText] = useState("");
  const [editTags, setEditTags] = useState("");

  useEffect(() => {
    localStorage.setItem(VIEWER_TEXT_SETTINGS_KEY, JSON.stringify(textSettings));
  }, [textSettings]);

  // Reset to preview tab and load edit values when dialog opens
  useEffect(() => {
    if (open && psak) {
      const sourceUrl = psak.source_url || psak.sourceUrl;
      setActiveTab(sourceUrl ? "preview" : "info");
      setIsEditing(false);
      // Initialize edit fields
      setEditTitle(psak.title || "");
      setEditCourt(psak.court || "");
      setEditYear(psak.year || "");
      setEditCaseNumber(psak.case_number || psak.caseNumber || "");
      setEditSummary(psak.summary || "");
      setEditFullText(psak.full_text || psak.fullText || "");
      setEditTags((psak.tags || []).join(", "));
    }
  }, [open, psak]);

  if (!psak) return null;

  const fullText = psak.full_text || psak.fullText;
  const sourceUrl = psak.source_url || psak.sourceUrl;
  const caseNumber = psak.case_number || psak.caseNumber;

  const handleSave = async () => {
    if (!psak.id) {
      toast.error("לא ניתן לשמור - חסר מזהה");
      return;
    }

    setIsSaving(true);
    try {
      const tagsArray = editTags
        .split(",")
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const { error } = await supabase
        .from("psakei_din")
        .update({
          title: editTitle.trim(),
          court: editCourt.trim(),
          year: editYear || null,
          case_number: editCaseNumber.trim() || null,
          summary: editSummary.trim(),
          full_text: editFullText.trim() || null,
          tags: tagsArray,
        })
        .eq("id", psak.id);

      if (error) throw error;

      toast.success("פסק הדין עודכן בהצלחה");
      setIsEditing(false);
      onSave?.();
    } catch (error: any) {
      console.error("Error saving psak din:", error);
      toast.error("שגיאה בשמירת פסק הדין");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Reset to original values
    setEditTitle(psak.title || "");
    setEditCourt(psak.court || "");
    setEditYear(psak.year || "");
    setEditCaseNumber(psak.case_number || psak.caseNumber || "");
    setEditSummary(psak.summary || "");
    setEditFullText(psak.full_text || psak.fullText || "");
    setEditTags((psak.tags || []).join(", "));
  };

  // Determine file type from URL
  const getFileType = (url: string | undefined): string => {
    if (!url) return 'unknown';
    const lower = url.toLowerCase();
    if (lower.includes('.pdf')) return 'pdf';
    if (lower.includes('.doc') || lower.includes('.docx')) return 'doc';
    if (lower.includes('.txt')) return 'txt';
    if (lower.includes('.rtf')) return 'rtf';
    return 'unknown';
  };

  const fileType = getFileType(sourceUrl);

  // For Google Docs Viewer for Word files
  const getPreviewUrl = (url: string, type: string): string => {
    if (type === 'pdf') {
      return url;
    }
    if (type === 'doc') {
      return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
    }
    return url;
  };

  const updateTextSetting = <K extends keyof TextSettings>(key: K, value: TextSettings[K]) => {
    setTextSettings(prev => ({ ...prev, [key]: value }));
  };

  const getTextAlignClass = () => {
    switch (textSettings.textAlign) {
      case 'center': return 'text-center';
      case 'left': return 'text-left';
      case 'justify': return 'text-justify';
      default: return 'text-right';
    }
  };

  const textClasses = `${textSettings.fontFamily} ${getTextAlignClass()} ${textSettings.isBold ? 'font-bold' : ''} ${textSettings.isItalic ? 'italic' : ''} ${textSettings.textColor} ${textSettings.bgColor}`;

  const renderTextToolbar = () => (
    <div className="flex items-center gap-1 flex-wrap p-2 bg-muted/50 rounded-lg border mb-2">
      {/* Font Size Controls */}
      <div className="flex items-center gap-1 border-l pl-2 ml-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => updateTextSetting('fontSize', Math.max(10, textSettings.fontSize - 1))}
          title="הקטן גופן"
        >
          <AArrowDown className="h-3 w-3" />
        </Button>
        <span className="text-xs text-muted-foreground w-6 text-center">{textSettings.fontSize}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => updateTextSetting('fontSize', Math.min(32, textSettings.fontSize + 1))}
          title="הגדל גופן"
        >
          <AArrowUp className="h-3 w-3" />
        </Button>
      </div>

      {/* Font Family */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="סוג גופן">
            <Type className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-popover z-50">
          {FONTS.map(font => (
            <DropdownMenuItem
              key={font.value}
              onClick={() => updateTextSetting('fontFamily', font.value)}
              className={`flex items-center gap-2 ${font.value}`}
            >
              <span>{font.label}</span>
              {textSettings.fontFamily === font.value && <span className="text-primary">✓</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Text Alignment */}
      <div className="flex items-center gap-0.5 border-x px-2 mx-1">
        <Button
          variant={textSettings.textAlign === 'right' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-7 w-7"
          onClick={() => updateTextSetting('textAlign', 'right')}
          title="יישור לימין"
        >
          <AlignRight className="h-3 w-3" />
        </Button>
        <Button
          variant={textSettings.textAlign === 'center' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-7 w-7"
          onClick={() => updateTextSetting('textAlign', 'center')}
          title="יישור למרכז"
        >
          <AlignCenter className="h-3 w-3" />
        </Button>
        <Button
          variant={textSettings.textAlign === 'left' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-7 w-7"
          onClick={() => updateTextSetting('textAlign', 'left')}
          title="יישור לשמאל"
        >
          <AlignLeft className="h-3 w-3" />
        </Button>
        <Button
          variant={textSettings.textAlign === 'justify' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-7 w-7"
          onClick={() => updateTextSetting('textAlign', 'justify')}
          title="יישור משני הצדדים"
        >
          <AlignJustify className="h-3 w-3" />
        </Button>
      </div>

      {/* Bold */}
      <Button
        variant={textSettings.isBold ? 'secondary' : 'ghost'}
        size="icon"
        className="h-7 w-7"
        onClick={() => updateTextSetting('isBold', !textSettings.isBold)}
        title="הדגשה"
      >
        <Bold className="h-3 w-3" />
      </Button>

      {/* Italic */}
      <Button
        variant={textSettings.isItalic ? 'secondary' : 'ghost'}
        size="icon"
        className="h-7 w-7"
        onClick={() => updateTextSetting('isItalic', !textSettings.isItalic)}
        title="נטוי"
      >
        <Italic className="h-3 w-3" />
      </Button>

      {/* Text Color */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="צבע טקסט">
            <Palette className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-36 p-2 bg-popover z-50" align="start">
          <div className="grid grid-cols-3 gap-1">
            {TEXT_COLORS.map(color => (
              <button
                key={color.value}
                onClick={() => updateTextSetting('textColor', color.value)}
                className={`h-7 rounded border flex items-center justify-center ${textSettings.textColor === color.value ? 'ring-2 ring-primary' : ''}`}
                style={{ color: color.color }}
                title={color.label}
              >
                A
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Background Color */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="צבע רקע">
            <Highlighter className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-36 p-2 bg-popover z-50" align="start">
          <div className="grid grid-cols-3 gap-1">
            {BG_COLORS.map(color => (
              <button
                key={color.value}
                onClick={() => updateTextSetting('bgColor', color.value)}
                className={`h-7 rounded border ${textSettings.bgColor === color.value ? 'ring-2 ring-primary' : ''}`}
                style={{ backgroundColor: color.color }}
                title={color.label}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );

  console.log('[PsakDinViewDialog] Rendering, open:', open, 'psak:', psak?.title);

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      console.log('[PsakDinViewDialog] onOpenChange called with:', newOpen);
      onOpenChange(newOpen);
    }}>
      <DialogContent 
        className={`flex flex-col bg-card border-border ${
          isFullscreen 
            ? 'max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh]' 
            : 'max-w-4xl max-h-[90vh]'
        }`}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <DialogTitle className="text-xl font-bold text-foreground text-right flex-1">
              {psak.title}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="mr-2"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mt-2">
            {psak.court && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-3 h-3 text-primary" />
                </div>
                {psak.court}
              </div>
            )}
            {psak.year && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-3 h-3 text-primary" />
                </div>
                {psak.year}
              </div>
            )}
            {caseNumber && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="w-3 h-3 text-primary" />
                </div>
                {caseNumber}
              </div>
            )}
            {psak.source && (
              <Badge variant="outline" className="text-xs">
                {psak.source}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
            <TabsTrigger value="preview" className="gap-2" disabled={!sourceUrl}>
              <Eye className="w-4 h-4" />
              צפייה בקובץ
            </TabsTrigger>
            <TabsTrigger value="info" className="gap-2">
              <FileText className="w-4 h-4" />
              מידע
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="flex-1 min-h-0 mt-4">
            <div className="flex items-center justify-between mb-2">
              {!isEditing ? renderTextToolbar() : <div />}
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="gap-1"
                    >
                      <X className="w-4 h-4" />
                      ביטול
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={isSaving}
                      className="gap-1"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving ? "שומר..." : "שמור"}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="gap-1"
                    disabled={!psak.id}
                  >
                    <Edit className="w-4 h-4" />
                    עריכה
                  </Button>
                )}
              </div>
            </div>
            <ScrollArea className="h-full border border-border rounded-lg">
              <div 
                className={`p-4 space-y-4 ${isEditing ? '' : textClasses}`} 
                dir="rtl"
                style={{ fontSize: isEditing ? undefined : `${textSettings.fontSize}px` }}
              >
                {isEditing ? (
                  <>
                    {/* Edit Mode */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>כותרת</Label>
                          <Input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="כותרת פסק הדין"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>בית דין</Label>
                          <Input
                            value={editCourt}
                            onChange={(e) => setEditCourt(e.target.value)}
                            placeholder="שם בית הדין"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>שנה</Label>
                          <Input
                            type="number"
                            value={editYear}
                            onChange={(e) => setEditYear(e.target.value ? parseInt(e.target.value) : "")}
                            placeholder="שנת פסק הדין"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>מספר תיק</Label>
                          <Input
                            value={editCaseNumber}
                            onChange={(e) => setEditCaseNumber(e.target.value)}
                            placeholder="מספר התיק"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>תקציר</Label>
                        <Textarea
                          value={editSummary}
                          onChange={(e) => setEditSummary(e.target.value)}
                          placeholder="תקציר פסק הדין"
                          rows={4}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>טקסט מלא</Label>
                        <Textarea
                          value={editFullText}
                          onChange={(e) => setEditFullText(e.target.value)}
                          placeholder="טקסט מלא של פסק הדין"
                          rows={12}
                          className="font-serif"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>תגיות (מופרדות בפסיק)</Label>
                        <Input
                          value={editTags}
                          onChange={(e) => setEditTags(e.target.value)}
                          placeholder="תגית1, תגית2, תגית3"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* View Mode */}
                    <div>
                      <h3 className="font-semibold mb-2">תקציר</h3>
                      <p className="leading-relaxed">{psak.summary}</p>
                    </div>

                    {psak.connection && (
                      <div className="p-3 rounded-lg border">
                        <h3 className="font-semibold mb-2">קשר לסוגיה</h3>
                        <p className="opacity-80">{psak.connection}</p>
                      </div>
                    )}

                    {fullText && (
                      <div>
                        <h3 className="font-semibold mb-2">טקסט מלא</h3>
                        <div className="p-4 rounded-lg border whitespace-pre-wrap leading-relaxed">
                          {fullText}
                        </div>
                      </div>
                    )}

                    {psak.tags && psak.tags.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">תגיות</h3>
                        <div className="flex flex-wrap gap-2">
                          {psak.tags.map((tag: string, idx: number) => (
                            <Badge key={idx} variant="secondary" className="bg-muted text-muted-foreground">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="preview" className="flex-1 min-h-0 mt-4">
            {sourceUrl ? (
              <div className="h-full flex flex-col">
                {renderTextToolbar()}
                <div className="flex-1 border border-border rounded-lg overflow-hidden bg-muted/20">
                  {fileType === 'pdf' ? (
                    <iframe
                      src={`${sourceUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                      className="w-full h-full min-h-[500px]"
                      title="צפייה בפסק דין"
                    />
                  ) : fileType === 'doc' ? (
                    <iframe
                      src={getPreviewUrl(sourceUrl, fileType)}
                      className="w-full h-full min-h-[500px]"
                      title="צפייה בפסק דין"
                    />
                  ) : fileType === 'txt' ? (
                    <TxtViewer url={sourceUrl} textSettings={textSettings} textClasses={textClasses} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                      <FileIcon className="w-16 h-16 text-muted-foreground mb-4" />
                      <p className="text-foreground font-medium mb-2">
                        לא ניתן להציג תצוגה מקדימה של קובץ זה
                      </p>
                      <p className="text-sm text-muted-foreground mb-4">
                        ניתן להוריד את הקובץ לצפייה
                      </p>
                      <Button asChild className="gap-2">
                        <a href={sourceUrl} download target="_blank" rel="noopener noreferrer">
                          <Download className="w-4 h-4" />
                          הורד קובץ
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <FileIcon className="w-16 h-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">אין קובץ מצורף</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex-shrink-0 pt-4 border-t border-border flex gap-2 justify-end">
          {sourceUrl && (
            <>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="gap-2"
              >
                <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                  פתח בחלון חדש
                </a>
              </Button>
              <Button
                variant="default"
                size="sm"
                asChild
                className="gap-2"
              >
                <a href={sourceUrl} download>
                  <Download className="w-4 h-4" />
                  הורד קובץ
                </a>
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Component for viewing TXT files with text settings
interface TxtViewerProps {
  url: string;
  textSettings: TextSettings;
  textClasses: string;
}

const TxtViewer = ({ url, textSettings, textClasses }: TxtViewerProps) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load file');
        return res.text();
      })
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <p className="text-destructive mb-2">שגיאה בטעינת הקובץ</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <pre 
        className={`p-4 whitespace-pre-wrap ${textClasses}`} 
        dir="rtl"
        style={{ fontSize: `${textSettings.fontSize}px` }}
      >
        {content}
      </pre>
    </ScrollArea>
  );
};

export default PsakDinViewDialog;