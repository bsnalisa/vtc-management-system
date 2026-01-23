import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ArrowRight, Building, Package, Briefcase, Users, GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  completed: boolean;
}

interface OnboardingWizardProps {
  type: "hostel" | "stock" | "assets" | "general";
  completedSteps?: string[];
}

const hostelSteps: Omit<OnboardingStep, "completed">[] = [
  {
    id: "buildings",
    title: "Add Hostel Buildings",
    description: "Create buildings to organize your hostel accommodation",
    icon: Building,
    path: "/hostel-management",
  },
  {
    id: "rooms",
    title: "Configure Rooms",
    description: "Set up rooms with capacity and fee information",
    icon: Package,
    path: "/hostel-management",
  },
  {
    id: "allocations",
    title: "Allocate Trainees",
    description: "Assign trainees to available rooms and beds",
    icon: Users,
    path: "/hostel-management",
  },
];

const stockSteps: Omit<OnboardingStep, "completed">[] = [
  {
    id: "categories",
    title: "Create Stock Categories",
    description: "Organize your inventory with categories",
    icon: Package,
    path: "/stock-management",
  },
  {
    id: "items",
    title: "Add Stock Items",
    description: "Add items to your inventory with quantities",
    icon: Briefcase,
    path: "/stock-management",
  },
  {
    id: "alerts",
    title: "Set Up Alerts",
    description: "Configure low stock alerts for important items",
    icon: Building,
    path: "/stock-management",
  },
];

const assetSteps: Omit<OnboardingStep, "completed">[] = [
  {
    id: "categories",
    title: "Define Asset Categories",
    description: "Create categories like Equipment, Furniture, Vehicles",
    icon: Package,
    path: "/asset-management",
  },
  {
    id: "assets",
    title: "Register Assets",
    description: "Add assets with purchase info and location",
    icon: Briefcase,
    path: "/asset-management",
  },
  {
    id: "maintenance",
    title: "Schedule Maintenance",
    description: "Set up maintenance schedules for assets",
    icon: Building,
    path: "/asset-management",
  },
];

const generalSteps: Omit<OnboardingStep, "completed">[] = [
  {
    id: "trades",
    title: "Set Up Trades",
    description: "Configure the training programs you offer",
    icon: GraduationCap,
    path: "/training-modules",
  },
  {
    id: "classes",
    title: "Create Classes",
    description: "Set up classes for each trade and level",
    icon: Users,
    path: "/classes",
  },
  {
    id: "trainers",
    title: "Add Trainers",
    description: "Register trainers and assign them to classes",
    icon: Users,
    path: "/trainers",
  },
  {
    id: "trainees",
    title: "Enroll Trainees",
    description: "Register and enroll trainees in classes",
    icon: Users,
    path: "/trainees",
  },
];

const stepsByType = {
  hostel: hostelSteps,
  stock: stockSteps,
  assets: assetSteps,
  general: generalSteps,
};

const titlesByType = {
  hostel: "Hostel Management Setup",
  stock: "Stock Management Setup",
  assets: "Asset Management Setup",
  general: "Getting Started",
};

export const OnboardingWizard = ({ type, completedSteps = [] }: OnboardingWizardProps) => {
  const navigate = useNavigate();
  const baseSteps = stepsByType[type];
  
  const steps: OnboardingStep[] = baseSteps.map(step => ({
    ...step,
    completed: completedSteps.includes(step.id),
  }));

  const completedCount = steps.filter(s => s.completed).length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <Card className="border-dashed border-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{titlesByType[type]}</CardTitle>
            <CardDescription>Complete these steps to get started</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">{completedCount}/{steps.length}</p>
            <p className="text-xs text-muted-foreground">steps completed</p>
          </div>
        </div>
        <div className="w-full bg-muted rounded-full h-2 mt-4">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-500" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const StatusIcon = step.completed ? CheckCircle2 : Circle;
            
            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-4 p-3 rounded-lg border transition-all",
                  step.completed 
                    ? "bg-primary/5 border-primary/20" 
                    : "hover:border-primary/50 cursor-pointer"
                )}
                onClick={() => !step.completed && navigate(step.path)}
              >
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full",
                  step.completed ? "bg-primary/10" : "bg-muted"
                )}>
                  <Icon className={cn(
                    "h-5 w-5",
                    step.completed ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
                <div className="flex-1">
                  <p className={cn(
                    "font-medium",
                    step.completed && "line-through text-muted-foreground"
                  )}>
                    {step.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
                <StatusIcon className={cn(
                  "h-5 w-5",
                  step.completed ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
            );
          })}
        </div>
        
        {completedCount < steps.length && (
          <Button 
            className="w-full mt-4" 
            onClick={() => {
              const nextStep = steps.find(s => !s.completed);
              if (nextStep) navigate(nextStep.path);
            }}
          >
            Continue Setup
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export const EmptyStateWithOnboarding = ({ 
  type, 
  title, 
  description 
}: { 
  type: "hostel" | "stock" | "assets" | "general";
  title: string;
  description: string;
}) => (
  <div className="flex flex-col items-center justify-center py-12 px-4">
    <div className="text-center mb-8">
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md">{description}</p>
    </div>
    <div className="w-full max-w-lg">
      <OnboardingWizard type={type} />
    </div>
  </div>
);
