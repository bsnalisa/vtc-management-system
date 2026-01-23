import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Package } from "lucide-react";
import { useStockAlerts, useAcknowledgeAlert } from "@/hooks/useStockAlerts";
import { format } from "date-fns";

export const StockAlertsPanel = () => {
  const { data: alerts = [], isLoading } = useStockAlerts();
  const acknowledgeAlert = useAcknowledgeAlert();

  const handleAcknowledge = async (alertId: string) => {
    await acknowledgeAlert.mutateAsync(alertId);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Stock Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Stock Alerts
        </CardTitle>
        <CardDescription>
          Items that need attention
        </CardDescription>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
            <p className="font-medium">All stock levels are healthy</p>
            <p className="text-sm">No alerts at this time</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border ${
                  alert.alert_type === "out_of_stock"
                    ? "border-red-200 bg-red-50 dark:bg-red-950/20"
                    : "border-orange-200 bg-orange-50 dark:bg-orange-950/20"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Package className={`h-5 w-5 mt-0.5 ${
                      alert.alert_type === "out_of_stock" ? "text-red-500" : "text-orange-500"
                    }`} />
                    <div>
                      <p className="font-medium">
                        {alert.stock_items?.item_name || "Unknown Item"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Code: {alert.stock_items?.item_code}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={alert.alert_type === "out_of_stock" ? "destructive" : "secondary"}>
                          {alert.alert_type === "out_of_stock" ? "Out of Stock" : "Low Stock"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Current: {alert.current_quantity} / Reorder at: {alert.threshold_quantity}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Alert created: {format(new Date(alert.created_at), "dd MMM yyyy HH:mm")}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAcknowledge(alert.id)}
                    disabled={acknowledgeAlert.isPending}
                  >
                    Acknowledge
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
