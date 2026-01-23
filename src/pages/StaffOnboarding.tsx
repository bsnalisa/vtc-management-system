import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  Circle,
  User,
  BookOpen,
  Trophy,
  ArrowRight,
  ArrowLeft,
  Clock,
} from "lucide-react";
import {
  useOnboardingProgress,
  useTrainingModules,
  useModuleCompletions,
  useUpdateOnboardingProgress,
  useCompleteModule,
} from "@/hooks/useOnboarding";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const StaffOnboarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role } = useUserRole();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  
  const { data: progress } = useOnboardingProgress();
  const { data: modules } = useTrainingModules(role || undefined);
  const { data: completions } = useModuleCompletions();
  const updateProgress = useUpdateOnboardingProgress();
  const completeModule = useCompleteModule();

  const [profileData, setProfileData] = useState({
    full_name: "",
    phone: "",
  });

  useEffect(() => {
    if (progress) {
      setCurrentStep(progress.current_step);
    }
  }, [progress]);

  useEffect(() => {
    // Load user profile data
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();
        
        if (profile) {
          setProfileData({
            full_name: profile.full_name || "",
            phone: profile.phone || "",
          });
        }
      }
    };
    loadProfile();
  }, []);

  const totalSteps = 3;
  const progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100;

  const isModuleCompleted = (moduleId: string) => {
    return completions?.some((c) => c.module_id === moduleId) || false;
  };

  const completedModulesCount = modules?.filter((m) => isModuleCompleted(m.id)).length || 0;
  const totalModules = modules?.length || 0;

  const handleProfileSubmit = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profileData.full_name,
          phone: profileData.phone,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      await updateProgress.mutateAsync({
        current_step: 2,
        profile_completed: true,
      });

      setCurrentStep(2);
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleModuleComplete = async (moduleId: string) => {
    await completeModule.mutateAsync({ moduleId });
    setSelectedModule(null);
  };

  const handleFinishOnboarding = async () => {
    await updateProgress.mutateAsync({
      current_step: 3,
      training_completed: true,
      onboarding_completed: true,
      completed_at: new Date().toISOString(),
    });

    toast({
      title: "Congratulations!",
      description: "You've completed the onboarding process",
    });

    navigate("/dashboard");
  };

  const steps = [
    {
      number: 1,
      title: "Profile Setup",
      description: "Complete your profile information",
      icon: User,
    },
    {
      number: 2,
      title: "Training Modules",
      description: "Complete required training",
      icon: BookOpen,
    },
    {
      number: 3,
      title: "All Set!",
      description: "Ready to start working",
      icon: Trophy,
    },
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Complete Your Profile</CardTitle>
              <CardDescription>
                Please provide your basic information to get started
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={profileData.full_name}
                  onChange={(e) =>
                    setProfileData({ ...profileData, full_name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={profileData.phone}
                  onChange={(e) =>
                    setProfileData({ ...profileData, phone: e.target.value })
                  }
                />
              </div>
              <Button
                onClick={handleProfileSubmit}
                disabled={!profileData.full_name}
                className="w-full"
              >
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        );

      case 2:
        if (selectedModule && modules) {
          const module = modules.find((m) => m.id === selectedModule);
          if (!module) return null;

          return (
            <Card>
              <CardHeader>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedModule(null)}
                  className="mb-2 w-fit"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Modules
                </Button>
                <CardTitle>{module.title}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {module.duration_minutes} minutes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="prose max-w-none">
                  <p className="text-sm text-muted-foreground">
                    {module.description}
                  </p>
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{module.content}</p>
                  </div>
                </div>
                <Button
                  onClick={() => handleModuleComplete(module.id)}
                  disabled={isModuleCompleted(module.id)}
                  className="w-full"
                >
                  {isModuleCompleted(module.id) ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Completed
                    </>
                  ) : (
                    <>
                      Mark as Complete
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        }

        return (
          <Card>
            <CardHeader>
              <CardTitle>Training Modules</CardTitle>
              <CardDescription>
                Complete {totalModules} training module{totalModules !== 1 ? "s" : ""}{" "}
                to proceed ({completedModulesCount}/{totalModules} completed)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress
                value={(completedModulesCount / totalModules) * 100}
                className="mb-4"
              />
              <div className="space-y-3">
                {modules?.map((module) => {
                  const completed = isModuleCompleted(module.id);
                  return (
                    <div
                      key={module.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:border-primary transition-colors cursor-pointer"
                      onClick={() => !completed && setSelectedModule(module.id)}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {completed ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">{module.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {module.duration_minutes} minutes
                          </p>
                        </div>
                      </div>
                      {module.is_required && (
                        <Badge variant="outline" className="text-xs">
                          Required
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
              {completedModulesCount === totalModules && (
                <Button
                  onClick={() => {
                    setCurrentStep(3);
                    updateProgress.mutateAsync({
                      current_step: 3,
                      training_completed: true,
                    });
                  }}
                  className="w-full"
                >
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card>
            <CardHeader>
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-primary/10 rounded-full">
                  <Trophy className="h-12 w-12 text-primary" />
                </div>
              </div>
              <CardTitle className="text-center">All Set!</CardTitle>
              <CardDescription className="text-center">
                Congratulations! You've completed the onboarding process
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Profile Completed</span>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Training Completed</span>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Modules Completed: {completedModulesCount}/{totalModules}
                  </span>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <Button onClick={handleFinishOnboarding} className="w-full">
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <DashboardLayout
      title="Staff Onboarding"
      subtitle="Welcome! Let's get you set up"
      navItems={[]}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Progress Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Progress</span>
                <span className="text-sm text-muted-foreground">
                  Step {currentStep} of {totalSteps}
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Steps Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {steps.map((step) => {
            const Icon = step.icon;
            const isActive = step.number === currentStep;
            const isCompleted = step.number < currentStep;

            return (
              <Card
                key={step.number}
                className={`${
                  isActive
                    ? "border-primary shadow-md"
                    : isCompleted
                    ? "border-green-500"
                    : ""
                }`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : isCompleted
                          ? "bg-green-500 text-white"
                          : "bg-muted"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">{step.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                    {isCompleted && (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Step Content */}
        {renderStepContent()}
      </div>
    </DashboardLayout>
  );
};

export default StaffOnboarding;