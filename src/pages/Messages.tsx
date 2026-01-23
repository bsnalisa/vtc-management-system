import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMessages, useSendMessage, useMarkMessageRead, MessageData } from "@/hooks/useMessages";
import { useUsers } from "@/hooks/useUsers";
import { Mail, Send, Inbox, User } from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Messages() {
  const { navItems, groupLabel } = useRoleNavigation();
  const [open, setOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [formData, setFormData] = useState<MessageData>({
    receiver_id: "",
    subject: "",
    message: "",
  });

  const { data: inboxMessages, isLoading: inboxLoading } = useMessages("inbox");
  const { data: sentMessages, isLoading: sentLoading } = useMessages("sent");
  const { data: users } = useUsers();
  const sendMessage = useSendMessage();
  const markRead = useMarkMessageRead();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage.mutateAsync(formData);
    setFormData({ receiver_id: "", subject: "", message: "" });
    setOpen(false);
  };

  const handleMessageClick = (message: any) => {
    setSelectedMessage(message);
    if (!message.read && message.receiver_id) {
      markRead.mutate(message.id);
    }
  };

  const MessageList = ({ messages, type }: { messages: any[]; type: "inbox" | "sent" }) => (
    <div className="space-y-2">
      {messages?.map((msg: any) => (
        <Card 
          key={msg.id} 
          className={`cursor-pointer hover:bg-accent transition-colors ${!msg.read && type === "inbox" ? "border-primary" : ""}`}
          onClick={() => handleMessageClick(msg)}
        >
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <p className="font-semibold">
                    {type === "inbox" 
                      ? msg.sender?.profiles?.full_name || msg.sender?.email
                      : msg.receiver?.profiles?.full_name || msg.receiver?.email}
                  </p>
                  {!msg.read && type === "inbox" && (
                    <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded">New</span>
                  )}
                </div>
                <p className="font-medium mt-1">{msg.subject}</p>
                <p className="text-sm text-muted-foreground truncate mt-1">{msg.message}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                {format(new Date(msg.created_at), "MMM d, yyyy HH:mm")}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
      {messages?.length === 0 && (
        <p className="text-center text-muted-foreground py-8">No messages</p>
      )}
    </div>
  );

  return (
    <DashboardLayout
      title="Messages"
      subtitle="Communicate with trainers, trainees, and admins"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6">
        <div className="flex justify-end items-center">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Send className="w-4 h-4 mr-2" />
                New Message
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send New Message</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="receiver">Recipient</Label>
                  <Select
                    value={formData.receiver_id}
                    onValueChange={(value) => setFormData({ ...formData, receiver_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select recipient" />
                    </SelectTrigger>
                    <SelectContent>
                      {users?.map((user: any) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.profiles?.full_name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={6}
                    required
                  />
                </div>
                <Button type="submit" disabled={sendMessage.isPending}>
                  {sendMessage.isPending ? "Sending..." : "Send Message"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="inbox" className="w-full">
          <TabsList>
            <TabsTrigger value="inbox">
              <Inbox className="w-4 h-4 mr-2" />
              Inbox
            </TabsTrigger>
            <TabsTrigger value="sent">
              <Mail className="w-4 h-4 mr-2" />
              Sent
            </TabsTrigger>
          </TabsList>
          <TabsContent value="inbox">
            {inboxLoading ? <p>Loading...</p> : <MessageList messages={inboxMessages || []} type="inbox" />}
          </TabsContent>
          <TabsContent value="sent">
            {sentLoading ? <p>Loading...</p> : <MessageList messages={sentMessages || []} type="sent" />}
          </TabsContent>
        </Tabs>

        {selectedMessage && (
          <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{selectedMessage.subject}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span>
                    From: {selectedMessage.sender?.profiles?.full_name || selectedMessage.sender?.email}
                  </span>
                  <span className="ml-auto">
                    {format(new Date(selectedMessage.created_at), "MMM d, yyyy HH:mm")}
                  </span>
                </div>
                <div className="prose max-w-none">
                  <p className="whitespace-pre-wrap">{selectedMessage.message}</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
}
