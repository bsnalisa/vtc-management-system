import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shield, Check, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type RoleType = "super_admin" | "organization_admin" | "admin" | "head_of_training" | "trainer" | "registration_officer" | "debtor_officer" | "hod" | "assessment_coordinator" | "stock_control_officer" | "asset_maintenance_coordinator" | "procurement_officer" | "placement_officer" | "hostel_coordinator" | "trainee";

interface ModulePermission {
  module: string;
  description: string;
  route: string;
  allowedRoles: RoleType[];
}

export default function PermissionsMatrix() {
  const roles: { id: RoleType; name: string; color: string }[] = [
    { id: "super_admin", name: "Super Admin", color: "bg-purple-500" },
    { id: "organization_admin", name: "Organization Admin (IT/Admin)", color: "bg-blue-500" },
    { id: "admin", name: "Admin", color: "bg-indigo-500" },
    { id: "head_of_training", name: "Head of Training (Academic)", color: "bg-violet-500" },
    { id: "hod", name: "Head of Department", color: "bg-cyan-500" },
    { id: "trainer", name: "Trainer", color: "bg-green-500" },
    { id: "registration_officer", name: "Registration Officer", color: "bg-yellow-500" },
    { id: "debtor_officer", name: "Debtor Officer", color: "bg-orange-500" },
    { id: "assessment_coordinator", name: "Assessment Coordinator", color: "bg-pink-500" },
    { id: "stock_control_officer", name: "Stock Control Officer", color: "bg-teal-500" },
    { id: "asset_maintenance_coordinator", name: "Asset Maintenance Coordinator", color: "bg-lime-500" },
    { id: "procurement_officer", name: "Procurement Officer", color: "bg-amber-500" },
    { id: "placement_officer", name: "Placement Officer", color: "bg-rose-500" },
    { id: "hostel_coordinator", name: "Hostel Coordinator", color: "bg-sky-500" },
    { id: "trainee", name: "Trainee", color: "bg-gray-500" },
  ];

  const dashboardPermissions: ModulePermission[] = [
    {
      module: "Organization Admin Dashboard",
      description: "IT & Administrative dashboard (No Academic Access)",
      route: "/organization-admin-dashboard",
      allowedRoles: ["organization_admin"],
    },
    {
      module: "Admin Dashboard",
      description: "Full system administrative dashboard",
      route: "/admin-dashboard",
      allowedRoles: ["admin"],
    },
    {
      module: "Head of Training Dashboard",
      description: "Academic operations & training management",
      route: "/head-of-training-dashboard",
      allowedRoles: ["head_of_training"],
    },
    {
      module: "Trainer Dashboard",
      description: "Trainer-specific dashboard",
      route: "/trainer-dashboard",
      allowedRoles: ["trainer"],
    },
    {
      module: "Registration Officer Dashboard",
      description: "Trainee registration dashboard",
      route: "/registration-officer-dashboard",
      allowedRoles: ["registration_officer"],
    },
    {
      module: "Debtor Officer Dashboard",
      description: "Fee management dashboard",
      route: "/debtor-officer-dashboard",
      allowedRoles: ["debtor_officer"],
    },
    {
      module: "HOD Dashboard",
      description: "Head of department dashboard",
      route: "/hod-dashboard",
      allowedRoles: ["hod"],
    },
    {
      module: "Assessment Coordinator Dashboard",
      description: "Assessment management dashboard",
      route: "/assessment-coordinator-dashboard",
      allowedRoles: ["assessment_coordinator"],
    },
    {
      module: "Stock Control Officer Dashboard",
      description: "Stock management dashboard",
      route: "/stock-control-officer-dashboard",
      allowedRoles: ["stock_control_officer"],
    },
    {
      module: "Asset Maintenance Coordinator Dashboard",
      description: "Asset management dashboard",
      route: "/asset-maintenance-coordinator-dashboard",
      allowedRoles: ["asset_maintenance_coordinator"],
    },
    {
      module: "Procurement Officer Dashboard",
      description: "Procurement management dashboard",
      route: "/procurement-officer-dashboard",
      allowedRoles: ["procurement_officer"],
    },
    {
      module: "Placement Officer Dashboard",
      description: "Alumni & placement management",
      route: "/placement-officer-dashboard",
      allowedRoles: ["placement_officer"],
    },
    {
      module: "Hostel Coordinator Dashboard",
      description: "Hostel management dashboard",
      route: "/hostel-coordinator-dashboard",
      allowedRoles: ["hostel_coordinator"],
    },
    {
      module: "Trainee Dashboard",
      description: "Trainee portal",
      route: "/trainee-dashboard",
      allowedRoles: ["trainee"],
    },
  ];

  const functionalPermissions: ModulePermission[] = [
    {
      module: "User Management",
      description: "Manage system users (Admin function)",
      route: "/users",
      allowedRoles: ["admin", "organization_admin"],
    },
    {
      module: "Role Management",
      description: "Manage roles and permissions (Admin function)",
      route: "/roles",
      allowedRoles: ["admin", "organization_admin"],
    },
    {
      module: "Organization Settings",
      description: "Configure organization (Admin function)",
      route: "/organization-settings",
      allowedRoles: ["admin", "organization_admin"],
    },
    {
      module: "Support Tickets",
      description: "View and manage support tickets (Admin function)",
      route: "/support-tickets",
      allowedRoles: ["admin", "organization_admin"],
    },
    {
      module: "Training Modules",
      description: "Manage training curriculum (Academic function)",
      route: "/training-modules",
      allowedRoles: ["admin", "head_of_training"],
    },
    {
      module: "Trainee Registration",
      description: "Register new trainees (Academic function)",
      route: "/trainees/register",
      allowedRoles: ["registration_officer", "admin", "head_of_training"],
    },
    {
      module: "Trainee List",
      description: "View and manage trainees (Academic function)",
      route: "/trainees",
      allowedRoles: ["admin", "head_of_training", "registration_officer", "debtor_officer"],
    },
    {
      module: "Trainer Management",
      description: "Manage trainers (Academic function)",
      route: "/trainers",
      allowedRoles: ["admin", "head_of_training", "hod"],
    },
    {
      module: "Class Management",
      description: "Manage classes (Academic function)",
      route: "/classes",
      allowedRoles: ["admin", "head_of_training", "hod"],
    },
    {
      module: "Timetable Management",
      description: "Manage class timetables (Academic function)",
      route: "/timetable",
      allowedRoles: ["admin", "head_of_training", "hod"],
    },
    {
      module: "Assessment Results",
      description: "View and manage assessments (Academic function)",
      route: "/assessment-results",
      allowedRoles: ["admin", "head_of_training", "assessment_coordinator"],
    },
    {
      module: "Analytics",
      description: "View analytics and insights (Academic function)",
      route: "/analytics",
      allowedRoles: ["admin", "head_of_training", "hod"],
    },
    {
      module: "Fee Management",
      description: "Manage trainee fees (Financial function)",
      route: "/fees",
      allowedRoles: ["debtor_officer", "admin"],
    },
    {
      module: "Asset Management",
      description: "Manage organizational assets",
      route: "/assets",
      allowedRoles: ["asset_maintenance_coordinator", "admin"],
    },
    {
      module: "Stock Management",
      description: "Manage inventory and stock",
      route: "/stock",
      allowedRoles: ["stock_control_officer", "admin"],
    },
    {
      module: "Supplier Management",
      description: "Manage suppliers",
      route: "/suppliers",
      allowedRoles: ["procurement_officer"],
    },
    {
      module: "Purchase Requisitions",
      description: "Create and approve purchase requisitions",
      route: "/purchase-requisitions",
      allowedRoles: ["procurement_officer"],
    },
    {
      module: "Purchase Orders",
      description: "Create and manage purchase orders",
      route: "/purchase-orders",
      allowedRoles: ["procurement_officer"],
    },
    {
      module: "Receiving Reports",
      description: "Track received goods",
      route: "/receiving-reports",
      allowedRoles: ["procurement_officer"],
    },
    {
      module: "Hostel Management",
      description: "Manage hostel operations",
      route: "/hostel",
      allowedRoles: ["hostel_coordinator", "admin"],
    },
    {
      module: "Alumni Management",
      description: "Manage alumni and placements",
      route: "/alumni",
      allowedRoles: ["placement_officer", "admin"],
    },
  ];

  const superAdminPermissions: ModulePermission[] = [
    {
      module: "Super Admin Dashboard",
      description: "Platform-wide administration",
      route: "/super-admin",
      allowedRoles: ["super_admin"],
    },
    {
      module: "Organization Management",
      description: "Manage organizations",
      route: "/super-admin/organizations",
      allowedRoles: ["super_admin"],
    },
    {
      module: "Package Assignment",
      description: "Assign packages to organizations",
      route: "/super-admin/packages",
      allowedRoles: ["super_admin"],
    },
    {
      module: "Super Admin User Management",
      description: "Manage all platform users",
      route: "/super-admin/users",
      allowedRoles: ["super_admin"],
    },
    {
      module: "Package Management",
      description: "Create and manage packages",
      route: "/packages",
      allowedRoles: ["super_admin", "organization_admin"],
    },
  ];

  const hasAccess = (permission: ModulePermission, roleId: RoleType) => {
    return permission.allowedRoles.includes(roleId);
  };

  const PermissionsTable = ({ permissions, title }: { permissions: ModulePermission[]; title: string }) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          View which roles have access to specific {title.toLowerCase()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Module</TableHead>
                <TableHead className="w-[300px]">Description</TableHead>
                {roles.map((role) => (
                  <TableHead key={role.id} className="text-center min-w-[120px]">
                    <div className="flex flex-col items-center gap-1">
                      <Badge className={`${role.color} text-white text-xs`}>
                        {role.name}
                      </Badge>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((permission) => (
                <TableRow key={permission.route}>
                  <TableCell className="font-medium">{permission.module}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {permission.description}
                  </TableCell>
                  {roles.map((role) => (
                    <TableCell key={role.id} className="text-center">
                      {hasAccess(permission, role.id) ? (
                        <div className="flex justify-center">
                          <Check className="h-5 w-5 text-green-600" />
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <X className="h-5 w-5 text-muted-foreground/30" />
                        </div>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Permissions Matrix</h1>
          <p className="text-muted-foreground mt-1">
            View and understand role-based access control across all modules
          </p>
        </div>
      </div>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role Hierarchy Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <Badge key={role.id} className={`${role.color} text-white px-3 py-1`}>
                {role.name}
              </Badge>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            The permissions matrix below shows which roles have access to specific modules and features.
            A green checkmark (✓) indicates access is granted, while a gray X indicates no access.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="dashboards" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboards">Dashboards</TabsTrigger>
          <TabsTrigger value="functional">Functional Modules</TabsTrigger>
          <TabsTrigger value="super-admin">Super Admin</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboards" className="space-y-4">
          <PermissionsTable permissions={dashboardPermissions} title="Dashboard Permissions" />
        </TabsContent>

        <TabsContent value="functional" className="space-y-4">
          <PermissionsTable permissions={functionalPermissions} title="Functional Module Permissions" />
        </TabsContent>

        <TabsContent value="super-admin" className="space-y-4">
          <PermissionsTable permissions={superAdminPermissions} title="Super Admin Permissions" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
