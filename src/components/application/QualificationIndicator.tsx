import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, AlertCircle, Calculator } from "lucide-react";
import { QualificationResult } from "@/types/application";

interface QualificationIndicatorProps {
  result?: QualificationResult | null;
  calculatedPoints?: number;
  isLoading?: boolean;
}

export const QualificationIndicator = ({ 
  result, 
  calculatedPoints = 0,
  isLoading = false 
}: QualificationIndicatorProps) => {
  if (isLoading) {
    return (
      <Card className="border-muted">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4 animate-pulse" />
            Calculating Qualification...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card className="border-muted bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            Qualification Status
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-sm text-muted-foreground">
            Complete the educational history section to see qualification status.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline">Points: {calculatedPoints}</Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isQualified = result.qualified;

  return (
    <Card className={isQualified ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-red-500 bg-red-50 dark:bg-red-950/20"}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {isQualified ? (
            <>
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-green-700 dark:text-green-400">QUALIFIED</span>
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5 text-red-600" />
              <span className="text-red-700 dark:text-red-400">NOT QUALIFIED</span>
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant={isQualified ? "default" : "secondary"}>
            Points: {result.calculated_points}
          </Badge>
          <Badge variant="outline">Age: {result.age_years} years</Badge>
          {result.is_mature_age && (
            <Badge className="bg-blue-500">Mature Age Entry</Badge>
          )}
        </div>
        {result.reasons && result.reasons.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              {isQualified ? "Notes:" : "Reasons for disqualification:"}
            </p>
            <ul className="text-sm space-y-1">
              {result.reasons.map((reason, index) => (
                <li key={index} className={`flex items-start gap-2 ${isQualified ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                  <span className="mt-1">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
