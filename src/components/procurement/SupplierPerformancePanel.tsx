import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Star, Package } from "lucide-react";
import { useSupplierPerformances } from "@/hooks/useSupplierPerformance";
import { Supplier } from "@/hooks/useProcurement";

interface SupplierPerformancePanelProps {
  suppliers: Supplier[];
}

export const SupplierPerformancePanel = ({ suppliers }: SupplierPerformancePanelProps) => {
  const { data: performanceData = [], isLoading } = useSupplierPerformances();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Supplier Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get latest performance for each supplier
  const supplierLatestPerformance = suppliers.map((supplier) => {
    const performances = performanceData.filter((p) => p.supplier_id === supplier.id);
    const latest = performances[0]; // Already sorted by date desc
    const avgRating = performances.length > 0 
      ? performances.reduce((sum, p) => sum + p.overall_rating, 0) / performances.length 
      : null;
    return {
      ...supplier,
      latestPerformance: latest,
      avgRating,
      evaluationCount: performances.length,
    };
  });

  const getRatingBadge = (rating: number | null) => {
    if (!rating) return <Badge variant="secondary">No rating</Badge>;
    if (rating >= 8) return <Badge className="bg-green-500">Excellent</Badge>;
    if (rating >= 6) return <Badge className="bg-blue-500">Good</Badge>;
    if (rating >= 4) return <Badge className="bg-yellow-500">Average</Badge>;
    return <Badge variant="destructive">Poor</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500" />
          Supplier Performance
        </CardTitle>
        <CardDescription>
          Performance ratings for active suppliers
        </CardDescription>
      </CardHeader>
      <CardContent>
        {supplierLatestPerformance.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No supplier data available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {supplierLatestPerformance.slice(0, 10).map((supplier) => (
              <div
                key={supplier.id}
                className="p-4 rounded-lg border bg-card"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium">{supplier.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {supplier.evaluationCount} evaluation{supplier.evaluationCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {getRatingBadge(supplier.avgRating)}
                </div>

                {supplier.latestPerformance ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Delivery</span>
                          <span>{supplier.latestPerformance.delivery_rating}/10</span>
                        </div>
                        <Progress value={supplier.latestPerformance.delivery_rating * 10} className="h-2" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Quality</span>
                          <span>{supplier.latestPerformance.quality_rating}/10</span>
                        </div>
                        <Progress value={supplier.latestPerformance.quality_rating * 10} className="h-2" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Price</span>
                          <span>{supplier.latestPerformance.price_rating}/10</span>
                        </div>
                        <Progress value={supplier.latestPerformance.price_rating * 10} className="h-2" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Communication</span>
                          <span>{supplier.latestPerformance.communication_rating}/10</span>
                        </div>
                        <Progress value={supplier.latestPerformance.communication_rating * 10} className="h-2" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No performance data yet</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
