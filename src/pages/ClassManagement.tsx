import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Building2, DoorOpen } from "lucide-react";
import ClassesTab from "@/components/classes/ClassesTab";
import BuildingsTab from "@/components/classes/BuildingsTab";
import RoomsTab from "@/components/classes/RoomsTab";
import { FacilityApprovalAlert } from "@/components/classes/FacilityApprovalAlert";

const ClassManagement = () => {
  const { navItems, role } = useRoleNavigation();
  const isTrainer = role === "trainer";
  // The Centre Manager oversees classes; creating and changing them belongs to the Head of Training
  const isCentreManager = role === "centre_manager";
  const [activeTab, setActiveTab] = useState("classes");

  return (
    <DashboardLayout
      title={isTrainer ? "My Classes" : role === "centre_manager" ? "Classes" : "Class Management"}
      subtitle={isTrainer ? "View classes allocated to you" : role === "centre_manager" ? "Classes, buildings and rooms made by the Head of Training, for your approval" : "Manage classes, buildings/workshops, and rooms"}
      navItems={navItems}
      groupLabel="Training Management"
    >
      {isTrainer ? (
        <ClassesTab readOnly />
      ) : (
        <>
        {(isCentreManager || role === "head_of_training") && <div className="mb-4"><FacilityApprovalAlert role={isCentreManager ? "centre_manager" : "head_of_training"} /></div>}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="classes" className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Classes
            </TabsTrigger>
            <TabsTrigger value="buildings" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Buildings / Workshops
            </TabsTrigger>
            <TabsTrigger value="rooms" className="flex items-center gap-2">
              <DoorOpen className="h-4 w-4" /> Rooms
            </TabsTrigger>
          </TabsList>

          <TabsContent value="classes" className="mt-4">
            <ClassesTab readOnly={isCentreManager} canApprove={isCentreManager} />
          </TabsContent>
          <TabsContent value="buildings" className="mt-4">
            <BuildingsTab readOnly={isCentreManager} canApprove={isCentreManager} />
          </TabsContent>
          <TabsContent value="rooms" className="mt-4">
            <RoomsTab readOnly={isCentreManager} canApprove={isCentreManager} />
          </TabsContent>
        </Tabs>
        </>
      )}
    </DashboardLayout>
  );
};

export default ClassManagement;
