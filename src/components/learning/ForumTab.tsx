import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ArrowLeft, Lock, LockOpen, MessageSquarePlus, Trash2 } from "lucide-react";
import {
  ForumTopic, useAuthUserId, useDeletePost, useDeleteTopic, useForumPosts, useForumTopics, useReply, useSetTopicLocked, useStartTopic,
} from "@/hooks/useLearningSpace";

const replyCount = (t: ForumTopic) => t.forum_posts?.[0]?.count ?? 0;

function TopicView({ topic, canManage, userId, onBack }: { topic: ForumTopic; canManage: boolean; userId: string | null | undefined; onBack: () => void }) {
  const { data: posts = [] } = useForumPosts(topic.id);
  const reply = useReply();
  const lock = useSetTopicLocked();
  const delTopic = useDeleteTopic();
  const delPost = useDeletePost();
  const [text, setText] = useState("");
  const [confirm, setConfirm] = useState<"topic" | null>(null);

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="space-y-2">
        <Button variant="ghost" size="sm" className="w-fit -ml-2" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />All topics</Button>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>{topic.title} {topic.locked && <Badge variant="secondary" className="ml-1"><Lock className="h-3 w-3 mr-1" />Locked</Badge>}</CardTitle>
            <CardDescription>{topic.author_name ?? "Member"} · {new Date(topic.created_at).toLocaleString()}</CardDescription>
          </div>
          <div className="flex gap-1">
            {canManage && (
              <Button variant="outline" size="sm" disabled={lock.isPending} onClick={() => lock.mutate({ id: topic.id, locked: !topic.locked }, { onSuccess: () => onBack() })}>
                {topic.locked ? <><LockOpen className="h-4 w-4 mr-1" />Unlock</> : <><Lock className="h-4 w-4 mr-1" />Lock</>}
              </Button>
            )}
            {(canManage || topic.author_id === userId) && (
              <Button variant="outline" size="sm" onClick={() => setConfirm("topic")}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {topic.body && <p className="whitespace-pre-wrap border rounded-md p-3 bg-muted/40">{topic.body}</p>}
        {posts.map((p) => (
          <div key={p.id} className="border rounded-md p-3">
            <div className="flex items-center justify-between gap-2 text-muted-foreground">
              <span>{p.author_name ?? "Member"} · {new Date(p.created_at).toLocaleString()}</span>
              {(canManage || p.author_id === userId) && (
                <Button variant="ghost" size="icon" aria-label="Delete post" disabled={delPost.isPending} onClick={() => delPost.mutate(p.id)}><Trash2 className="h-4 w-4" /></Button>
              )}
            </div>
            <p className="whitespace-pre-wrap mt-1">{p.body}</p>
          </div>
        ))}
        {!posts.length && <p className="text-muted-foreground">No replies yet.</p>}
        {topic.locked ? (
          <p className="flex items-center gap-2 text-muted-foreground border rounded-md p-3"><Lock className="h-4 w-4" />This topic is locked. No new replies can be added.</p>
        ) : (
          <div className="space-y-2">
            <Label>Your reply</Label>
            <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
            <Button size="sm" disabled={!text.trim() || reply.isPending} onClick={() => reply.mutate({ topic_id: topic.id, body: text.trim() }, { onSuccess: () => setText("") })}>Reply</Button>
          </div>
        )}
      </CardContent>
      <ConfirmDialog open={confirm === "topic"} onOpenChange={(o) => !o && setConfirm(null)} title="Delete this topic?"
        description="The topic and all its replies are deleted." confirmText="Delete" variant="destructive"
        onConfirm={() => { delTopic.mutate(topic.id, { onSuccess: onBack }); setConfirm(null); }} />
    </Card>
  );
}

export function ForumTab({ classId, canManage }: { classId: string; canManage: boolean }) {
  const { data: topics = [], isLoading } = useForumTopics(classId);
  const { data: userId } = useAuthUserId();
  const start = useStartTopic();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const open = topics.find((t) => t.id === openId);
  if (open) return <TopicView topic={open} canManage={canManage} userId={userId} onBack={() => setOpenId(null)} />;

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div><CardTitle>Class forum</CardTitle><CardDescription>Ask questions and discuss with your class.</CardDescription></div>
        <Button size="sm" onClick={() => setCreating(true)}><MessageSquarePlus className="h-4 w-4 mr-2" />New topic</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Topic</TableHead><TableHead>Author</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Replies</TableHead></TableRow></TableHeader>
          <TableBody>
            {topics.map((t) => (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => setOpenId(t.id)}>
                <TableCell className="font-medium">
                  <button type="button" className="text-left underline-offset-2 hover:underline" onClick={(e) => { e.stopPropagation(); setOpenId(t.id); }}>{t.title}</button>
                  {t.locked && <Lock className="inline h-3 w-3 ml-2 text-muted-foreground" aria-label="Locked" />}
                </TableCell>
                <TableCell>{t.author_name ?? "Member"}</TableCell>
                <TableCell>{new Date(t.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">{replyCount(t)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!isLoading && !topics.length && <p className="text-sm text-muted-foreground text-center py-8">No topics yet. Start the first one.</p>}
      </CardContent>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Start a topic</DialogTitle><DialogDescription>Everyone in this class can read and reply.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-1"><Label>Message</Label><Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button disabled={!title.trim() || start.isPending}
              onClick={() => start.mutate({ class_id: classId, title: title.trim(), body: body.trim() || null }, { onSuccess: () => { setCreating(false); setTitle(""); setBody(""); } })}>Post</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
