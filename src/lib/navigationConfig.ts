import {
  LayoutDashboard,
  Users,
  GraduationCap,
  DollarSign,
  FileText,
  ClipboardCheck,
  ClipboardList,
  Calendar,
  BarChart3,
  Shield,
  Package,
  Building,
  Briefcase,
  Wrench,
  MessageSquare,
  BookOpen,
  UserCircle,
  Settings,
  CreditCard,
  Home,
  History,
  LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  children?: NavItem[];
}

// Admin Navigation (system configuration and support)
export const adminNavItems: NavItem[] = [
  { title: "Dashboard", url: "/admin-dashboard", icon: LayoutDashboard },
  { title: "User Management", url: "/users", icon: Users },
  { title: "Training Modules", url: "/training-modules", icon: BookOpen },
  { title: "Trainee List", url: "/trainees", icon: Users },
  { title: "Trainer Management", url: "/trainers", icon: GraduationCap },
  { title: "Class Management", url: "/classes", icon: GraduationCap },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Role Management", url: "/roles", icon: Shield },
  { title: "Role Activity", url: "/role-activity", icon: BarChart3 },
  { title: "Organization Settings", url: "/organization-settings", icon: Settings },
  { title: "Support Tickets", url: "/support-tickets", icon: MessageSquare },
];

// Organization Admin Navigation (Technical & Administrative Only - No Academic Functions)
export const organizationAdminNavItems: NavItem[] = [
  { title: "Dashboard", url: "/organization-admin-dashboard", icon: LayoutDashboard },
  { title: "Qualifications", url: "/qualifications", icon: GraduationCap },
  { title: "User Management", url: "/users", icon: Users },
  { title: "Role Management", url: "/roles", icon: Shield },
  { title: "Organization Settings", url: "/organization-settings", icon: Settings },
  { title: "Modules", url: "/modules-management", icon: BookOpen },
  { title: "Support Tickets", url: "/support-tickets", icon: MessageSquare },
  { title: "System Logs", url: "/system-logs", icon: FileText },
];

// Head of Training Navigation (All Academic & Training Operations)
export const headOfTrainingNavItems: NavItem[] = [
  { title: "Dashboard", url: "/head-of-training-dashboard", icon: LayoutDashboard },
  { title: "Trade Management", url: "/trade-management", icon: Briefcase },
  { title: "Qualification Approvals", url: "/qualification-approvals", icon: ClipboardCheck },
  { title: "Course Management", url: "/course-management", icon: BookOpen },
  { title: "Training Modules", url: "/training-modules", icon: BookOpen },
  { title: "Trainee List", url: "/trainees", icon: Users },
  { title: "Trainer Management", url: "/trainers", icon: GraduationCap },
  { title: "Class Management", url: "/classes", icon: GraduationCap },
  { title: "Timetable", url: "/timetable", icon: Calendar },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Assessment Results", url: "/assessment-results", icon: ClipboardCheck },
  { title: "Course Enrollment", url: "/enrollments", icon: BookOpen },
];

// Trainer Navigation
export const trainerNavItems: NavItem[] = [
  { title: "Dashboard", url: "/trainer-dashboard", icon: LayoutDashboard },
  { title: "My Classes", url: "/classes", icon: Users },
  { title: "Attendance", url: "/attendance", icon: ClipboardCheck },
  { title: "Timetable", url: "/timetable", icon: Calendar },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Messages", url: "/messages", icon: MessageSquare },
];

// --------------------- Trainee Navigation ---------------------
export const traineeNavItems: NavItem[] = [
  { title: "Dashboard", url: "/trainee-dashboard", icon: LayoutDashboard },
  { title: "My Profile", url: "/profile", icon: UserCircle },
  { title: "Registration", url: "/trainee/registration", icon: ClipboardList },
  { title: "Documents", url: "/trainee/application/documents", icon: FileText },
  { title: "Admission Status", url: "/trainee/application/status", icon: FileText },
  { title: "Hostel", url: "/trainee/hostel", icon: Building },
  { title: "Exam Timetable", url: "/trainee/exams/timetable", icon: BookOpen },
  { title: "Results", url: "/trainee/exams/results", icon: BookOpen },
  { title: "Fee Statement", url: "/trainee/finance", icon: DollarSign },
  { title: "Payments", url: "/trainee/payments", icon: CreditCard },
];

// HOD Navigation
export const hodNavItems: NavItem[] = [
  { title: "Dashboard", url: "/hod-dashboard", icon: LayoutDashboard },
  { title: "Department Overview", url: "/classes", icon: GraduationCap },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Performance", url: "/assessment-results", icon: BarChart3 },
];

// Assessment Coordinator Navigation
export const assessmentCoordinatorNavItems: NavItem[] = [
  { title: "Dashboard", url: "/assessment-coordinator-dashboard", icon: LayoutDashboard },
  { title: "Assessment Results", url: "/assessment-results", icon: FileText },
  { title: "Mark Management", url: "/assessment-results", icon: ClipboardCheck },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Course Enrollment", url: "/enrollments", icon: ClipboardCheck },
];

// Debtor Officer Navigation (Financial Operations Only - Separate Routes)
export const debtorOfficerNavItems: NavItem[] = [
  { title: "Overview", url: "/debtor-officer-dashboard", icon: LayoutDashboard },
  { title: "Application Fees", url: "/debtors/application-fees", icon: FileText },
  { title: "Registration Fees", url: "/debtors/registration-fees", icon: GraduationCap },
  { title: "Cleared Payments", url: "/debtors/cleared-payments", icon: History },
  { title: "Trainee Accounts", url: "/debtors/accounts", icon: DollarSign },
  { title: "Fee Configuration", url: "/debtors/config", icon: Settings },
];

// Registration Officer Navigation
export const registrationOfficerNavItems: NavItem[] = [
  { title: "Dashboard", url: "/registration-officer-dashboard", icon: LayoutDashboard },
  { title: "Applications Inbox", url: "/applications-inbox", icon: FileText },
  { title: "Admission Results", url: "/applications", icon: ClipboardCheck },
  { title: "Register Trainee", url: "/trainees/register", icon: Users },
  { title: "Trainee List", url: "/trainees", icon: Users },
  { title: "Historical Trainees", url: "/historical-trainees", icon: Users },
  { title: "Entry Requirements", url: "/entry-requirements", icon: ClipboardList },
  { title: "Grading Scale", url: "/grading-scale", icon: BarChart3 },
  { title: "Reports", url: "/reports", icon: FileText },
];

// Stock Control Officer Navigation
export const stockControlNavItems: NavItem[] = [
  { title: "Dashboard", url: "/stock-control-officer-dashboard", icon: LayoutDashboard },
  { title: "Stock Management", url: "/stock", icon: Package },
  { title: "Stock Movements", url: "/stock", icon: Package },
  { title: "Categories", url: "/stock", icon: Package },
  { title: "Reports", url: "/reports", icon: FileText },
];

// Asset Maintenance Coordinator Navigation
export const assetMaintenanceNavItems: NavItem[] = [
  { title: "Dashboard", url: "/asset-maintenance-coordinator-dashboard", icon: LayoutDashboard },
  { title: "Asset Management", url: "/assets", icon: Package },
  { title: "Maintenance", url: "/assets", icon: Wrench },
  { title: "Depreciation", url: "/assets", icon: BarChart3 },
  { title: "Reports", url: "/reports", icon: FileText },
];

// Procurement Officer Navigation
export const procurementNavItems: NavItem[] = [
  { title: "Dashboard", url: "/procurement-officer-dashboard", icon: LayoutDashboard },
  { title: "Purchase Requisitions", url: "/purchase-requisitions", icon: FileText },
  { title: "Purchase Orders", url: "/purchase-orders", icon: FileText },
  { title: "Receiving Reports", url: "/receiving-reports", icon: FileText },
  { title: "Suppliers", url: "/suppliers", icon: Users },
];

// Placement Officer Navigation
export const placementOfficerNavItems: NavItem[] = [
  { title: "Dashboard", url: "/placement-officer-dashboard", icon: LayoutDashboard },
  { title: "Alumni Management", url: "/alumni", icon: Users },
];

// Hostel Coordinator Navigation
export const hostelCoordinatorNavItems: NavItem[] = [
  { title: "Dashboard", url: "/hostel-coordinator-dashboard", icon: LayoutDashboard },
  { title: "Hostel Management", url: "/hostel", icon: Building },
  { title: "Allocations", url: "/hostel", icon: Users },
  { title: "Fees", url: "/hostel", icon: DollarSign },
  { title: "Maintenance", url: "/hostel", icon: Wrench },
];

// Projects Coordinator Navigation
export const projectsCoordinatorNavItems: NavItem[] = [
  { title: "Dashboard", url: "/projects-coordinator-dashboard", icon: LayoutDashboard },
  { title: "Projects", url: "/projects", icon: Briefcase },
  { title: "Milestones", url: "/projects", icon: ClipboardCheck },
  { title: "Reports", url: "/reports", icon: FileText },
];

// HR Officer Navigation
export const hrOfficerNavItems: NavItem[] = [
  { title: "Dashboard", url: "/hr-officer-dashboard", icon: LayoutDashboard },
  { title: "Employees", url: "/hr/employees", icon: Users },
  { title: "Leave Management", url: "/hr/leave", icon: Calendar },
  { title: "Recruitment", url: "/hr/recruitment", icon: Briefcase },
  { title: "Performance", url: "/hr/performance", icon: BarChart3 },
  { title: "Reports", url: "/reports", icon: FileText },
];

// Head of Trainee Support Navigation
export const headOfTraineeSupportNavItems: NavItem[] = [
  { title: "Dashboard", url: "/trainee-support-dashboard", icon: LayoutDashboard },
  { title: "Pending Approvals", url: "/trainee-support/pending-approvals", icon: ClipboardCheck },
  { title: "Trainee List", url: "/trainees", icon: Users },
  { title: "Officer Activity", url: "/trainee-support/officer-activity", icon: BarChart3 },
  { title: "Reports", url: "/reports", icon: FileText },
];

// BDL (Blended Distance Learning) Coordinator Navigation
export const bdlCoordinatorNavItems: NavItem[] = [
  { title: "Dashboard", url: "/bdl-coordinator-dashboard", icon: LayoutDashboard },
  { title: "Blended Courses", url: "/bdl/courses", icon: BookOpen },
  { title: "Learning Materials", url: "/bdl/materials", icon: FileText },
  { title: "Virtual Sessions", url: "/bdl/sessions", icon: Calendar },
  { title: "Student Progress", url: "/bdl/progress", icon: BarChart3 },
  { title: "Reports", url: "/reports", icon: FileText },
];

// RPL (Recognition of Prior Learning) Coordinator Navigation
export const rplCoordinatorNavItems: NavItem[] = [
  { title: "Dashboard", url: "/rpl-coordinator-dashboard", icon: LayoutDashboard },
  { title: "Applications", url: "/rpl/applications", icon: FileText },
  { title: "Portfolio Assessment", url: "/rpl/portfolio", icon: ClipboardCheck },
  { title: "Assessment Schedule", url: "/rpl/schedule", icon: Calendar },
  { title: "Credit Mapping", url: "/rpl/credits", icon: BarChart3 },
  { title: "Reports", url: "/reports", icon: FileText },
];
