import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, ClipboardCheck, DollarSign, Shield, BarChart3, FileText, Settings, LayoutDashboard, Plus, UserPlus } from "lucide-react";
import { EnrollmentChart, FeeCollectionChart } from "@/components/dashboard/DashboardCharts";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { SidebarGroupLabel, SidebarGroupContent } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUsers, useCreateUser, UserRoleData } from "@/hooks/useUsers";
import { useUsersWithRoles, useBulkAssignRoles } from "@/hooks/useRoleManagement";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminNavItems } from "@/lib/navigationConfig";
import { useUserRole } from "@/hooks/useUserRole";
import { useProfile } from "@/hooks/useProfile";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { organizationId } = useOrganizationContext();
  const { role } = useUserRole();
  const { data: stats, isLoading } = useDashboardStats();
  const { data: profile } = useProfile();
  const { data: users } = useUsers(organizationId);
  const { data: usersWithRoles } = useUsersWithRoles(organizationId);
  const createUser = useCreateUser();
  const bulkAssignRoles = useBulkAssignRoles();
  
  // Use admin nav items for Admin role only
  const navItems = adminNavItems;
  
  const [registerOpen, setRegisterOpen] = useState(false);
  const [roleAssignOpen, setRoleAssignOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("");
  
  const [formData, setFormData] = useState<UserRoleData>({
    email: "",
    password: "",
    firstname: "",
    surname: "",
    role: "trainer",
    phone: "",
  });

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = organizationId 
      ? { ...formData, organization_id: organizationId }
      : formData;
    await createUser.mutateAsync(submitData);
    setRegisterOpen(false);
    setFormData({
      email: "",
      password: "",
      firstname: "",
      surname: "",
      role: "trainer",
      phone: "",
    });
  };

  const handleBulkRoleAssign = async () => {
    if (selectedUsers.length > 0 && selectedRole && organizationId) {
      await bulkAssignRoles.mutateAsync({
        userIds: selectedUsers,
        roleCode: selectedRole,
        organizationId,
      });
      setRoleAssignOpen(false);
      setSelectedUsers([]);
      setSelectedRole("");
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const statsContent = (
    <>
      <SidebarGroupLabel>Quick Stats</SidebarGroupLabel>
      <SidebarGroupContent>
        <div className="space-y-3 px-2 py-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Trainees</span>
            <span className="font-medium text-primary">{isLoading ? "..." : stats?.totalTrainees || 0}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Trainers</span>
            <span className="font-medium text-primary">{isLoading ? "..." : stats?.totalTrainers || 0}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Collection</span>
            <span className="font-medium text-green-600">{isLoading ? "..." : stats?.collectionRate || 0}%</span>
          </div>
        </div>
      </SidebarGroupContent>
    </>
  );

  return (
    <DashboardLayout
      title={`Welcome back, ${profile?.firstname || 'User'}`}
      subtitle="Complete system overview and management"
      navItems={navItems}
      groupLabel="Navigation"
      statsContent={statsContent}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Academic Year</p>
            <p className="text-lg font-semibold text-foreground">2024/2025</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trainees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : stats?.totalTrainees || 0}</div>
              <p className="text-xs text-muted-foreground">Active trainees</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Trainers</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : stats?.totalTrainers || 0}</div>
              <p className="text-xs text-muted-foreground">Active trainers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : `${stats?.collectionRate || 0}%`}</div>
              <p className="text-xs text-muted-foreground">Fee collection rate</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fee Collection</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : `N$${(stats?.totalCollected || 0).toLocaleString()}`}</div>
              <p className="text-xs text-muted-foreground">{isLoading ? "..." : stats?.collectionRate || 0}% collected</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-4 md:grid-cols-2">
          <EnrollmentChart data={[
            { name: "Electrical", value: stats?.totalTrainees ? Math.round(stats.totalTrainees * 0.3) : 45 },
            { name: "Plumbing", value: stats?.totalTrainees ? Math.round(stats.totalTrainees * 0.2) : 32 },
            { name: "Carpentry", value: stats?.totalTrainees ? Math.round(stats.totalTrainees * 0.25) : 28 },
            { name: "Welding", value: stats?.totalTrainees ? Math.round(stats.totalTrainees * 0.25) : 38 },
          ]} />
          <FeeCollectionChart data={[
            { name: "Collected", value: stats?.totalCollected || 0 },
            { name: "Outstanding", value: stats?.totalOutstanding || 0 },
          ]} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Staff Registration
              </CardTitle>
              <CardDescription>Register new staff members to the system</CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Register Staff Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Register New Staff</DialogTitle>
                    <DialogDescription>Add a new staff member with role assignment</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleRegisterSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstname">First Name</Label>
                        <Input
                          id="firstname"
                          value={formData.firstname}
                          onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="surname">Last Name</Label>
                        <Input
                          id="surname"
                          value={formData.surname}
                          onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone (Optional)</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select value={formData.role} onValueChange={(value: any) => setFormData({ ...formData, role: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="trainer">Trainer</SelectItem>
                          <SelectItem value="head_of_training">Head of Training</SelectItem>
                          <SelectItem value="registration_officer">Registration Officer</SelectItem>
                          <SelectItem value="debtor_officer">Debtor Officer</SelectItem>
                          <SelectItem value="hod">Head of Department</SelectItem>
                          <SelectItem value="assessment_coordinator">Assessment Coordinator</SelectItem>
                          <SelectItem value="hostel_coordinator">Hostel Coordinator</SelectItem>
                          <SelectItem value="placement_officer">Placement Officer</SelectItem>
                          <SelectItem value="procurement_officer">Procurement Officer</SelectItem>
                          <SelectItem value="stock_control_officer">Stock Control Officer</SelectItem>
                          <SelectItem value="asset_maintenance_coordinator">Asset Maintenance Coordinator</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setRegisterOpen(false)}>Cancel</Button>
                      <Button type="submit">Register Staff</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  {users?.length || 0} staff members registered
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Role Assignment
              </CardTitle>
              <CardDescription>Assign roles to multiple staff members</CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog open={roleAssignOpen} onOpenChange={setRoleAssignOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <Shield className="h-4 w-4 mr-2" />
                    Bulk Assign Roles
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Bulk Role Assignment</DialogTitle>
                    <DialogDescription>Select users and assign a role to all of them</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Select Role</Label>
                      <Select value={selectedRole} onValueChange={setSelectedRole}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="trainer">Trainer</SelectItem>
                          <SelectItem value="head_of_training">Head of Training</SelectItem>
                          <SelectItem value="registration_officer">Registration Officer</SelectItem>
                          <SelectItem value="debtor_officer">Debtor Officer</SelectItem>
                          <SelectItem value="hod">Head of Department</SelectItem>
                          <SelectItem value="assessment_coordinator">Assessment Coordinator</SelectItem>
                          <SelectItem value="hostel_coordinator">Hostel Coordinator</SelectItem>
                          <SelectItem value="placement_officer">Placement Officer</SelectItem>
                          <SelectItem value="procurement_officer">Procurement Officer</SelectItem>
                          <SelectItem value="stock_control_officer">Stock Control Officer</SelectItem>
                          <SelectItem value="asset_maintenance_coordinator">Asset Maintenance Coordinator</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Select Users ({selectedUsers.length} selected)</Label>
                      <div className="border rounded-lg max-h-64 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12"></TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Current Roles</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {usersWithRoles?.map((user) => (
                              <TableRow key={user.id}>
                                <TableCell>
                                  <input
                                    type="checkbox"
                                    checked={selectedUsers.includes(user.id)}
                                    onChange={() => toggleUserSelection(user.id)}
                                    className="rounded border-border"
                                  />
                                </TableCell>
                                <TableCell className="font-medium">{user.full_name}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>
                                  {user.role && (
                                    <Badge variant="secondary" className="mr-1 text-xs">
                                      {user.role_name || user.role.replace("_", " ")}
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setRoleAssignOpen(false)}>Cancel</Button>
                      <Button 
                        onClick={handleBulkRoleAssign}
                        disabled={selectedUsers.length === 0 || !selectedRole}
                      >
                        Assign Role to {selectedUsers.length} User{selectedUsers.length !== 1 ? 's' : ''}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <div className="mt-4 space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => navigate('/users')}
                >
                  View All Staff
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => navigate('/roles')}
                >
                  Manage Roles & Permissions
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>System Management</CardTitle>
            <CardDescription>Admin-only functions and controls</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div 
              onClick={() => navigate('/users')}
              className="flex items-center gap-3 p-3 border rounded-lg hover:border-primary transition-colors cursor-pointer"
            >
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">User Management</p>
                <p className="text-xs text-muted-foreground">Manage system users & roles</p>
              </div>
            </div>
            <div 
              onClick={() => navigate('/classes')}
              className="flex items-center gap-3 p-3 border rounded-lg hover:border-primary transition-colors cursor-pointer"
            >
              <GraduationCap className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Trade Management</p>
                <p className="text-xs text-muted-foreground">Configure trades & programs</p>
              </div>
            </div>
            <div 
              onClick={() => navigate('/trainers')}
              className="flex items-center gap-3 p-3 border rounded-lg hover:border-primary transition-colors cursor-pointer"
            >
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Trainer Management</p>
                <p className="text-xs text-muted-foreground">Manage trainers & assignments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
