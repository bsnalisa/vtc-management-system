import { StockCategory } from "@/hooks/useStockCategories";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface StockCategoriesTableProps {
  categories: StockCategory[];
  loading: boolean;
}

export const StockCategoriesTable = ({ categories, loading }: StockCategoriesTableProps) => {
  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading categories...</div>;
  }

  if (!categories.length) {
    return <div className="text-center py-8 text-muted-foreground">No categories found</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Description</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((category) => (
          <TableRow key={category.id}>
            <TableCell className="font-medium">{category.code}</TableCell>
            <TableCell>{category.name}</TableCell>
            <TableCell>{category.description || "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
