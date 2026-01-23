import { useState, useEffect } from "react";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, User, UserCheck, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GlobalSearch = ({ open, onOpenChange }: GlobalSearchProps) => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const navigate = useNavigate();

  const { data: results, isLoading } = useGlobalSearch(debouncedQuery, open);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const getIcon = (type: string) => {
    switch (type) {
      case "trainee":
        return <User className="w-4 h-4" />;
      case "trainer":
        return <UserCheck className="w-4 h-4" />;
      case "course":
        return <BookOpen className="w-4 h-4" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  const handleResultClick = (result: any) => {
    // Navigate based on result type
    switch (result.result_type) {
      case "trainee":
        navigate("/trainees");
        break;
      case "trainer":
        navigate("/trainers");
        break;
      case "course":
        navigate("/enrollments");
        break;
    }
    onOpenChange(false);
    setQuery("");
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "trainee":
        return "Trainee";
      case "trainer":
        return "Trainer";
      case "course":
        return "Course";
      default:
        return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Global Search</DialogTitle>
        </DialogHeader>
        
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search trainees, trainers, courses..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 mt-4">
          {isLoading && (
            <p className="text-center text-muted-foreground py-8">Searching...</p>
          )}

          {!isLoading && query.length < 2 && (
            <p className="text-center text-muted-foreground py-8">
              Type at least 2 characters to search
            </p>
          )}

          {!isLoading && query.length >= 2 && results && results.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No results found</p>
          )}

          {!isLoading && results && results.length > 0 && (
            <>
              {results.map((result: any, index: number) => (
                <Card
                  key={index}
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => handleResultClick(result)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{getIcon(result.result_type)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground uppercase">
                            {getTypeLabel(result.result_type)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Relevance: {(result.relevance * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="font-semibold mt-1">
                          {result.result_data.name || result.result_data.trainee_id}
                        </p>
                        <div className="text-sm text-muted-foreground mt-1">
                          {result.result_data.email && (
                            <p>{result.result_data.email}</p>
                          )}
                          {result.result_data.phone && (
                            <p>{result.result_data.phone}</p>
                          )}
                          {result.result_data.trade && (
                            <p>Trade: {result.result_data.trade}</p>
                          )}
                          {result.result_data.code && (
                            <p>Code: {result.result_data.code}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
