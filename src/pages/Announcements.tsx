import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Plus } from "lucide-react";
import { useAnnouncements, useCreateAnnouncement, AnnouncementData } from "@/hooks/useAnnouncements";
import { format } from "date-fns";

const Announcements = () => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<AnnouncementData>({
    title: "",
    content: "",
    priority: "normal",
    target_roles: [],
  });

  const { data: announcements, isLoading } = useAnnouncements();
  const createAnnouncement = useCreateAnnouncement();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createAnnouncement.mutateAsync(formData);
    setOpen(false);
    setFormData({
      title: "",
      content: "",
      priority: "normal",
      target_roles: [],
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "default";
      case "normal": return "secondary";
      case "low": return "outline";
      default: return "secondary";
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Announcements</h1>
            <p className="text-muted-foreground">System-wide announcements and notices</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Announcement</DialogTitle>
                <DialogDescription>Publish a new announcement to the system</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content">Content</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={6}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expires_at">Expires At (Optional)</Label>
                    <Input
                      id="expires_at"
                      type="datetime-local"
                      onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit">Publish</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-8 text-center">Loading announcements...</CardContent>
            </Card>
          ) : announcements?.length ? (
            announcements.map((announcement) => (
              <Card key={announcement.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <Megaphone className="h-5 w-5" />
                        {announcement.title}
                      </CardTitle>
                      <CardDescription>
                        Published {format(new Date(announcement.published_at), "PPP 'at' p")}
                      </CardDescription>
                    </div>
                    <Badge variant={getPriorityColor(announcement.priority)}>
                      {announcement.priority}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground whitespace-pre-wrap">{announcement.content}</p>
                  {announcement.expires_at && (
                    <p className="text-sm text-muted-foreground mt-4">
                      Expires: {format(new Date(announcement.expires_at), "PPP 'at' p")}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No announcements available
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Announcements;
