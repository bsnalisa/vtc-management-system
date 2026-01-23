import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Supplier } from "@/hooks/useProcurement";

interface SuppliersTableProps {
  suppliers: Supplier[];
  isLoading: boolean;
  onEdit: (supplier: Supplier) => void;
}

const SuppliersTable = ({ suppliers, isLoading, onEdit }: SuppliersTableProps) => {
  if (isLoading) {
    return <div className="text-center py-4">Loading suppliers...</div>;
  }

  if (!suppliers.length) {
    return <div className="text-center py-4 text-muted-foreground">No suppliers found</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Contact Person</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Tax Number</TableHead>
          <TableHead>Payment Terms</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {suppliers.map((supplier) => (
          <TableRow key={supplier.id}>
            <TableCell className="font-medium">{supplier.name}</TableCell>
            <TableCell>{supplier.contact_person || "-"}</TableCell>
            <TableCell>{supplier.contact_email || "-"}</TableCell>
            <TableCell>{supplier.contact_phone || "-"}</TableCell>
            <TableCell>{supplier.tax_number || "-"}</TableCell>
            <TableCell>{supplier.payment_terms || "-"}</TableCell>
            <TableCell>
              <Badge variant={supplier.active ? "default" : "secondary"}>
                {supplier.active ? "Active" : "Inactive"}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(supplier)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default SuppliersTable;
