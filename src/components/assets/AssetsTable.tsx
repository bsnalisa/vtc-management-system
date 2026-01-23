import { Asset } from "@/hooks/useAssets";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AssetsTableProps {
  assets: Asset[];
  loading: boolean;
}

export const AssetsTable = ({ assets, loading }: AssetsTableProps) => {
  const navigate = useNavigate();

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading assets...</div>;
  }

  if (!assets.length) {
    return <div className="text-center py-8 text-muted-foreground">No assets found</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "default";
      case "under_repair": return "destructive";
      case "disposed": return "secondary";
      case "in_storage": return "outline";
      default: return "default";
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case "excellent": return "default";
      case "good": return "default";
      case "fair": return "secondary";
      case "poor": return "destructive";
      case "needs_repair": return "destructive";
      default: return "default";
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Asset Code</TableHead>
          <TableHead>Asset Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Serial Number</TableHead>
          <TableHead>Purchase Date</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Condition</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((asset) => (
          <TableRow key={asset.id}>
            <TableCell className="font-medium">{asset.asset_code}</TableCell>
            <TableCell>
              <div>
                <div className="font-medium">{asset.asset_name}</div>
                {asset.manufacturer && (
                  <div className="text-sm text-muted-foreground">{asset.manufacturer}</div>
                )}
              </div>
            </TableCell>
            <TableCell>{asset.asset_categories?.name}</TableCell>
            <TableCell>{asset.serial_number || "-"}</TableCell>
            <TableCell>
              {asset.purchase_date ? format(new Date(asset.purchase_date), "dd MMM yyyy") : "-"}
            </TableCell>
            <TableCell>R {(asset.current_value || asset.purchase_cost).toFixed(2)}</TableCell>
            <TableCell>
              <Badge variant={getConditionColor(asset.condition)}>
                {asset.condition.replace("_", " ")}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={getStatusColor(asset.status)}>
                {asset.status.replace("_", " ")}
              </Badge>
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/assets/${asset.id}`)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
