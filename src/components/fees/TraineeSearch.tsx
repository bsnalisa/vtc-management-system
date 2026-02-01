import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface Trainee {
  id: string;
  name: string;
}

interface TraineeSearchProps {
  onSelectTrainee: (trainee: Trainee | null) => void;
  placeholder?: string;
}

export const TraineeSearch = ({ onSelectTrainee, placeholder = "Search trainee..." }: TraineeSearchProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    
    // TODO: Implement actual trainee search with API
    // For now, simulate a search result
    if (value.length >= 3) {
      // Mock result - replace with actual API call
      onSelectTrainee({
        id: "TRN-" + value.toUpperCase(),
        name: "Sample Trainee",
      });
    } else {
      onSelectTrainee(null);
    }
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => handleSearch(e.target.value)}
        className="pl-9"
      />
    </div>
  );
};
