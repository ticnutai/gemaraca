import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";

const dafim = [
  { daf: "ב", id: "shnayim-ochazin", name: "שנים אוחזין" },
  { daf: "כא", id: "eilu-metziot", name: "אלו מציאות" },
  { daf: "כז", id: "hashavat-aveida", name: "השבת אבידה" },
  { daf: "כח", id: "geneiva-aveida", name: "גניבה מהקדש" },
  { daf: "יח", id: "hamotzei-shtarot", name: "המוצא שטרות" },
  { daf: "כט", id: "hamaafil", name: "המפקיד" }
];

const DafSelector = () => {
  const navigate = useNavigate();

  const handleDafChange = (sugyaId: string) => {
    if (sugyaId === "home") {
      navigate("/");
    } else {
      navigate(`/sugya/${sugyaId}`);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-muted-foreground">מעבר מהיר:</span>
      <Select onValueChange={handleDafChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="בחר דף" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="home">רשימת כל הסוגיות</SelectItem>
          {dafim.map((daf) => (
            <SelectItem key={daf.id} value={daf.id}>
              דף {daf.daf} - {daf.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default DafSelector;
