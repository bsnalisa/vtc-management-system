import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";
import { useToast } from "./use-toast";
import { format } from "date-fns";

interface ReportOptions {
  reportId: string;
  format: "csv" | "excel";
  dateRange?: {
    from: Date;
    to: Date;
  };
  filters?: Record<string, any>;
}

interface OrganizationBranding {
  name: string;
  logo_url?: string | null;
  address?: string;
  phone?: string;
  email?: string;
}

export const useReportGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const { organizationId, organizationName, settings } = useOrganizationContext();
  const { toast } = useToast();

  const getBranding = async (): Promise<OrganizationBranding> => {
    return {
      name: organizationName || "Organization",
      logo_url: settings?.logo_url,
    };
  };

  const generateCSVWithBranding = (
    data: any[],
    branding: OrganizationBranding,
    reportTitle: string
  ): string => {
    if (!data || data.length === 0) {
      return "";
    }

    const headers = Object.keys(data[0]);
    const generatedDate = format(new Date(), "PPpp");

    // Build CSV with branding header
    const brandingLines = [
      branding.name,
      branding.address || "",
      branding.phone ? `Tel: ${branding.phone}` : "",
      branding.email ? `Email: ${branding.email}` : "",
      "",
      `Report: ${reportTitle}`,
      `Generated: ${generatedDate}`,
      "",
      "",
    ].filter(line => line !== "" || line === "");

    const csvContent = [
      ...brandingLines,
      headers.join(","),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          const cellValue = typeof value === 'object' && value !== null
            ? JSON.stringify(value).replace(/"/g, '""')
            : String(value || '').replace(/"/g, '""');
          return `"${cellValue}"`;
        }).join(",")
      )
    ].join("\n");

    return csvContent;
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const prepareDataForExport = (data: any[]) => {
    return data.map(item => {
      const flatItem: any = {};

      Object.keys(item).forEach(key => {
        const value = item[key];

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          Object.keys(value).forEach(nestedKey => {
            flatItem[`${key}_${nestedKey}`] = value[nestedKey];
          });
        } else if (Array.isArray(value)) {
          flatItem[key] = value.join(", ");
        } else {
          flatItem[key] = value;
        }
      });

      return flatItem;
    });
  };

  const generateReport = async (options: ReportOptions) => {
    setIsGenerating(true);

    try {
      const branding = await getBranding();
      let data: any[] = [];
      let reportTitle = "";

      // Fetch data based on report type
      switch (options.reportId) {
        case "trainee_enrollment": {
          reportTitle = "Trainee Enrollment Report";
          const { data: trainees, error } = await supabase
            .from("trainees")
            .select(`
              trainee_id,
              first_name,
              last_name,
              email,
              phone,
              gender,
              national_id,
              level,
              training_mode,
              status,
              trade:trades(name),
              created_at
            `)
            .eq("organization_id", organizationId);
          if (error) throw error;
          data = trainees || [];
          break;
        }

        case "fee_collection": {
          reportTitle = "Fee Collection Report";
          const { data: fees, error } = await supabase
            .from("fee_records")
            .select(`
              trainee:trainees(trainee_id, first_name, last_name),
              academic_year,
              total_fee,
              amount_paid,
              balance,
              created_at,
              updated_at
            `)
            .eq("organization_id", organizationId);
          if (error) throw error;
          data = fees || [];
          break;
        }

        case "outstanding_fees": {
          reportTitle = "Outstanding Fees Report";
          const { data: fees, error } = await supabase
            .from("fee_records")
            .select(`
              trainee:trainees(trainee_id, first_name, last_name, phone, email),
              academic_year,
              total_fee,
              amount_paid,
              balance
            `)
            .eq("organization_id", organizationId)
            .gt("balance", 0);
          if (error) throw error;
          data = fees || [];
          break;
        }

        case "attendance_summary": {
          reportTitle = "Attendance Summary Report";
          const { data: attendance, error } = await supabase
            .from("attendance_records")
            .select(`
              trainee:trainees(trainee_id, first_name, last_name),
              register:attendance_registers(academic_year, trade:trades(name)),
              attendance_date,
              present,
              remarks
            `);
          if (error) throw error;
          data = attendance || [];
          break;
        }

        case "assessment_results": {
          reportTitle = "Assessment Results Report";
          const { data: results, error } = await supabase
            .from("assessment_results")
            .select(`
              trainee:trainees(trainee_id, first_name, last_name),
              unit_standard:unit_standards(title, code),
              assessment_date,
              marks_obtained,
              competency_status,
              remarks
            `);
          if (error) throw error;
          data = results || [];
          break;
        }

        case "stock_inventory": {
          reportTitle = "Stock Inventory Report";
          const { data: stock, error } = await supabase
            .from("stock_items")
            .select(`
              item_code,
              item_name,
              category:stock_categories(name),
              current_quantity,
              unit_of_measure,
              minimum_quantity,
              unit_cost,
              location
            `)
            .eq("organization_id", organizationId);
          if (error) throw error;
          data = stock || [];
          break;
        }

        case "stock_movements": {
          reportTitle = "Stock Movements Report";
          const { data: movements, error } = await supabase
            .from("stock_movements")
            .select(`
              stock_item:stock_items(item_code, item_name),
              movement_type,
              quantity,
              unit_cost,
              total_cost,
              movement_date,
              reference_number,
              notes
            `)
            .eq("organization_id", organizationId)
            .order("movement_date", { ascending: false });
          if (error) throw error;
          data = movements || [];
          break;
        }

        case "asset_register": {
          reportTitle = "Asset Register Report";
          const { data: assets, error } = await supabase
            .from("assets")
            .select(`
              asset_code,
              asset_name,
              category:asset_categories(name),
              serial_number,
              status,
              condition,
              purchase_cost,
              current_value,
              purchase_date,
              location
            `)
            .eq("organization_id", organizationId);
          if (error) throw error;
          data = assets || [];
          break;
        }

        case "hostel_occupancy": {
          reportTitle = "Hostel Occupancy Report";
          const { data: allocations, error } = await supabase
            .from("hostel_allocations")
            .select(`
              trainee_id,
              building:hostel_buildings(building_name, building_code),
              room:hostel_rooms(room_number, room_type),
              bed:hostel_beds(bed_number),
              check_in_date,
              status,
              monthly_fee
            `)
            .eq("organization_id", organizationId);
          if (error) throw error;
          data = allocations || [];
          break;
        }

        case "hostel_fees": {
          reportTitle = "Hostel Fees Report";
          const { data: fees, error } = await supabase
            .from("hostel_fees")
            .select(`
              trainee_id,
              fee_month,
              fee_amount,
              amount_paid,
              balance,
              payment_status,
              due_date
            `)
            .eq("organization_id", organizationId);
          if (error) throw error;
          data = fees || [];
          break;
        }

        case "applications_status": {
          reportTitle = "Applications Status Report";
          const { data: apps, error } = await supabase
            .from("trainee_applications")
            .select(`
              application_number,
              first_name,
              last_name,
              email,
              phone,
              trade:trades(name),
              registration_status,
              qualification_status,
              created_at
            `)
            .eq("organization_id", organizationId);
          if (error) throw error;
          data = apps || [];
          break;
        }

        case "placement_report": {
          reportTitle = "Placement & Internship Report";
          const { data: placements, error } = await supabase
            .from("internship_placements")
            .select(`
              placement_number,
              trainee_id,
              employer:employers(name),
              start_date,
              end_date,
              status,
              supervisor_name,
              evaluation_score
            `)
            .eq("organization_id", organizationId);
          if (error) throw error;
          data = placements || [];
          break;
        }

        case "alumni_tracking": {
          reportTitle = "Alumni Tracking Report";
          const { data: alumni, error } = await supabase
            .from("alumni")
            .select(`
              trainee_id,
              graduation_year,
              final_level,
              email,
              phone,
              current_address
            `)
            .eq("organization_id", organizationId);
          if (error) throw error;
          data = alumni || [];
          break;
        }

        default: {
          toast({
            title: "Error",
            description: "Unknown report type",
            variant: "destructive",
          });
          return;
        }
      }

      if (data.length === 0) {
        toast({
          title: "No Data",
          description: "No data available for this report",
          variant: "destructive",
        });
        return;
      }

      // Prepare and export data
      const flatData = prepareDataForExport(data);
      const csvContent = generateCSVWithBranding(flatData, branding, reportTitle);
      const timestamp = format(new Date(), "yyyy-MM-dd_HHmm");
      const filename = `${options.reportId}_${timestamp}.${options.format === "excel" ? "xlsx" : "csv"}`;

      downloadFile(csvContent, filename, "text/csv;charset=utf-8;");

      toast({
        title: "Report Generated",
        description: `${reportTitle} has been downloaded`,
      });
    } catch (error: any) {
      console.error("Error generating report:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate report",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateReport,
    isGenerating,
  };
};
