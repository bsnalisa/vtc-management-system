import { UserRole } from "@/hooks/useUserRole";
import { 
  Users, 
  DollarSign, 
  ClipboardList, 
  TrendingUp, 
  Package, 
  Building, 
  GraduationCap,
  FileText,
  BarChart3,
  Briefcase,
  Wrench
} from "lucide-react";

export interface ReportDefinition {
  id: string;
  title: string;
  description: string;
  category: "academic" | "financial" | "administrative" | "operations" | "hr";
  icon: any;
  allowedRoles: UserRole[];
  dataTable: string;
  exportFields?: string[];
}

// Report definitions with role-based access
export const reportDefinitions: ReportDefinition[] = [
  // Academic Reports
  {
    id: "trainee_enrollment",
    title: "Trainee Enrollment Report",
    description: "Detailed report of all trainee enrollments by trade, level, and training mode",
    category: "academic",
    icon: Users,
    allowedRoles: ["admin", "organization_admin", "head_of_training", "registration_officer", "hod", "head_of_trainee_support"],
    dataTable: "trainees",
  },
  {
    id: "attendance_summary",
    title: "Attendance Summary Report",
    description: "Attendance statistics by class, trade, and individual trainees",
    category: "academic",
    icon: ClipboardList,
    allowedRoles: ["admin", "organization_admin", "head_of_training", "trainer", "hod", "assessment_coordinator"],
    dataTable: "attendance_records",
  },
  {
    id: "assessment_results",
    title: "Assessment Results Report",
    description: "Comprehensive assessment and grading report for trainees",
    category: "academic",
    icon: FileText,
    allowedRoles: ["admin", "organization_admin", "head_of_training", "hod", "assessment_coordinator"],
    dataTable: "assessment_results",
  },
  {
    id: "completion_report",
    title: "Completion Status Report",
    description: "Summarizes trainees who have completed, withdrawn, or deferred",
    category: "academic",
    icon: TrendingUp,
    allowedRoles: ["admin", "organization_admin", "head_of_training", "registration_officer", "head_of_trainee_support"],
    dataTable: "trainees",
  },
  {
    id: "class_performance",
    title: "Class Performance Report",
    description: "Performance metrics for each class and cohort",
    category: "academic",
    icon: BarChart3,
    allowedRoles: ["admin", "organization_admin", "head_of_training", "trainer", "hod"],
    dataTable: "classes",
  },
  {
    id: "trainer_workload",
    title: "Trainer Workload Report",
    description: "Trainer assignments, class loads, and schedules",
    category: "academic",
    icon: GraduationCap,
    allowedRoles: ["admin", "organization_admin", "head_of_training", "hod"],
    dataTable: "trainers",
  },

  // Financial Reports
  {
    id: "fee_collection",
    title: "Fee Collection Report",
    description: "Summary of fee payments, outstanding balances, and collection rates",
    category: "financial",
    icon: DollarSign,
    allowedRoles: ["admin", "organization_admin", "debtor_officer", "head_of_trainee_support"],
    dataTable: "fee_records",
  },
  {
    id: "outstanding_fees",
    title: "Outstanding Fees Report",
    description: "List of trainees with outstanding fee balances",
    category: "financial",
    icon: DollarSign,
    allowedRoles: ["admin", "organization_admin", "debtor_officer", "head_of_trainee_support"],
    dataTable: "fee_records",
  },
  {
    id: "hostel_fees",
    title: "Hostel Fees Report",
    description: "Hostel accommodation fee collection and status",
    category: "financial",
    icon: Building,
    allowedRoles: ["admin", "organization_admin", "hostel_coordinator", "debtor_officer"],
    dataTable: "hostel_fees",
  },

  // Operations Reports
  {
    id: "stock_inventory",
    title: "Stock Inventory Report",
    description: "Current stock levels, movements, and valuations",
    category: "operations",
    icon: Package,
    allowedRoles: ["admin", "organization_admin", "stock_control_officer"],
    dataTable: "stock_items",
  },
  {
    id: "stock_movements",
    title: "Stock Movements Report",
    description: "Detailed log of all stock inflows and outflows",
    category: "operations",
    icon: Package,
    allowedRoles: ["admin", "organization_admin", "stock_control_officer"],
    dataTable: "stock_movements",
  },
  {
    id: "asset_register",
    title: "Asset Register Report",
    description: "Complete register of organizational assets and their status",
    category: "operations",
    icon: Package,
    allowedRoles: ["admin", "organization_admin", "asset_maintenance_coordinator"],
    dataTable: "assets",
  },
  {
    id: "asset_depreciation",
    title: "Asset Depreciation Report",
    description: "Asset depreciation schedules and current values",
    category: "operations",
    icon: TrendingUp,
    allowedRoles: ["admin", "organization_admin", "asset_maintenance_coordinator"],
    dataTable: "asset_depreciation",
  },
  {
    id: "maintenance_schedule",
    title: "Maintenance Schedule Report",
    description: "Upcoming and completed maintenance activities",
    category: "operations",
    icon: Wrench,
    allowedRoles: ["admin", "organization_admin", "asset_maintenance_coordinator", "hostel_coordinator"],
    dataTable: "asset_maintenance",
  },
  {
    id: "hostel_occupancy",
    title: "Hostel Occupancy Report",
    description: "Room allocation, occupancy rates, and availability",
    category: "operations",
    icon: Building,
    allowedRoles: ["admin", "organization_admin", "hostel_coordinator"],
    dataTable: "hostel_allocations",
  },

  // Administrative Reports
  {
    id: "applications_status",
    title: "Applications Status Report",
    description: "Trainee application processing status and statistics",
    category: "administrative",
    icon: FileText,
    allowedRoles: ["admin", "organization_admin", "registration_officer", "head_of_trainee_support"],
    dataTable: "trainee_applications",
  },
  {
    id: "gender_distribution",
    title: "Gender Distribution Report",
    description: "Gender breakdown by trade, class, and program",
    category: "administrative",
    icon: Users,
    allowedRoles: ["admin", "organization_admin", "head_of_training", "registration_officer"],
    dataTable: "trainees",
  },

  // HR Reports
  {
    id: "placement_report",
    title: "Placement & Internship Report",
    description: "Trainee placements, internships, and employer partnerships",
    category: "hr",
    icon: Briefcase,
    allowedRoles: ["admin", "organization_admin", "placement_officer"],
    dataTable: "internship_placements",
  },
  {
    id: "alumni_tracking",
    title: "Alumni Tracking Report",
    description: "Alumni employment status and career progression",
    category: "hr",
    icon: Users,
    allowedRoles: ["admin", "organization_admin", "placement_officer"],
    dataTable: "alumni",
  },
];

export const reportCategories = [
  { id: "academic", label: "Academic", description: "Training, assessments, and attendance" },
  { id: "financial", label: "Financial", description: "Fees, payments, and collections" },
  { id: "operations", label: "Operations", description: "Stock, assets, and facilities" },
  { id: "administrative", label: "Administrative", description: "Applications and demographics" },
  { id: "hr", label: "HR & Placement", description: "Employment and alumni" },
];

export const getReportsForRole = (role: UserRole): ReportDefinition[] => {
  if (role === "super_admin") return reportDefinitions;
  return reportDefinitions.filter(report => report.allowedRoles.includes(role));
};

export const getReportsByCategory = (reports: ReportDefinition[]) => {
  const grouped: Record<string, ReportDefinition[]> = {};
  
  reports.forEach(report => {
    if (!grouped[report.category]) {
      grouped[report.category] = [];
    }
    grouped[report.category].push(report);
  });
  
  return grouped;
};
