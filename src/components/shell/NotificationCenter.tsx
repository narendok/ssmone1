import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Notice = { id: string; title: string; body: string | null; target_url: string | null; is_read: boolean; created_at: string };

export function NotificationCenter() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      setUnread(0);
      return;
    }

    const [{ data: notifications }, { data: inboxState }] = await Promise.all([
      supabase.from("notifications").select("id, title, body, target_url, is_read, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8),
      supabase.rpc("get_notification_inbox_state"),
    ]);
    setItems(notifications ?? []);
    setUnread(Number((inboxState as { unread_count?: number } | null)?.unread_count ?? 0));
  }, [user]);
  useEffect(() => { void load(); }, [load]);
  const markAllRead = async () => {
    if (!user || !unread) return;
    await supabase.rpc("mark_all_notifications_read");
    await load();
  };
  const markRead = async (item: Notice) => {
    if (item.is_read) return;
    await supabase.rpc("mark_notification_read", { _notification_id: item.id });
    await load();
  };
  return <Popover><PopoverTrigger asChild><Button size="icon" variant="ghost" title="Notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative"><Bell className="h-4 w-4" />{unread > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-destructive px-1 text-[10px] leading-4 text-destructive-foreground">{unread}</span>}</Button></PopoverTrigger><PopoverContent align="end" className="w-80 p-0"><div className="flex items-center justify-between border-b px-3 py-2"><p className="text-sm font-semibold">Notifications</p><Button variant="ghost" size="sm" disabled={!unread} onClick={markAllRead}><CheckCheck /> Mark all read</Button></div><div className="max-h-96 overflow-auto">{items.length ? items.map((item) => { const content = <><p className="font-medium">{item.title}</p>{item.body && <p className="mt-1 text-xs text-muted-foreground">{item.body}</p>}<p className="mt-2 text-[11px] text-muted-foreground">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}</p></>; return item.target_url ? <Link key={item.id} to={item.target_url} onClick={() => void markRead(item)} className={`block border-b px-3 py-3 text-sm hover:bg-accent ${item.is_read ? "" : "bg-primary/5"}`}>{content}</Link> : <button key={item.id} type="button" onClick={() => void markRead(item)} className={`block w-full border-b px-3 py-3 text-left text-sm hover:bg-accent ${item.is_read ? "" : "bg-primary/5"}`}>{content}</button>; }) : <p className="px-3 py-8 text-center text-sm text-muted-foreground">You’re all caught up.</p>}</div></PopoverContent></Popover>;
}