import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchPcbTasks, PCB_STATUSES, PCB_STATUS_LABEL, PCB_STATUS_COLOR, type PcbStatus, type PcbTask } from "@/lib/pcb";
import { fetchProjects } from "@/lib/projects";
import { PcbTaskDialog } from "@/components/pcb/PcbTaskDialog";
import { PcbTaskDetail } from "@/components/pcb/PcbTaskDetail";
import { cn } from "@/lib/utils";
import type { RDMember } from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/pcb")({
  head: () => ({ meta: [{ title: "PCB Repair — SSM One" }, { name: "description", content: "PCB repair task tracking for engineering teams." }, { property: "og:title", content: "PCB Repair — SSM One" }, { property: "og:description", content: "PCB repair task tracking for engineering teams." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: PcbBoardPage,
});

const sb = supabase as any;

function PcbBoardPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: tasks = [], isLoading } = useQuery({ queryKey: ["pcb_tasks"], queryFn: fetchPcbTasks });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const { data: members = [] } = useQuery({
    queryKey: ["rd_members"],
    queryFn: async () => {
      const { data } = await supabase.from("rd_members").select("*").eq("active", true).order("name");
      return (data ?? []) as RDMember[];
    },
  });

  const grouped = useMemo(() => {
    const m: Record<PcbStatus, PcbTask[]> = {
      received: [], in_progress: [], waiting_parts: [], repaired: [], failed: [], scrapped: [], returned: [],
    };
    for (const t of tasks) m[t.status as PcbStatus]?.push(t);
    return m;
  }, [tasks]);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["pcb_tasks"] });
    qc.invalidateQueries({ queryKey: ["pcb_open_count"] });
  }

  const openTask = tasks.find((t) => t.id === openId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Wrench className="h-6 w-6" /> PCB Repair</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track boards through receive → repair → return.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New task</Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {PCB_STATUSES.map((s) => (
            <KanbanColumn key={s} status={s} tasks={grouped[s]} onOpen={setOpenId} />
          ))}
        </div>
      )}

      {creating && (
        <PcbTaskDialog
          open
          onOpenChange={(o) => !o && setCreating(false)}
          projects={projects}
          members={members}
          onSaved={() => { setCreating(false); refresh(); }}
        />
      )}
      {openTask && (
        <PcbTaskDetail
          task={openTask}
          projects={projects}
          members={members}
          onClose={() => setOpenId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function KanbanColumn({ status, tasks, onOpen }: { status: PcbStatus; tasks: PcbTask[]; onOpen: (id: string) => void }) {
  return (
    <div className="bg-muted/40 rounded-lg p-2 min-h-[200px] flex flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className={cn("w-2 h-2 rounded-full", PCB_STATUS_COLOR[status])} />
          {PCB_STATUS_LABEL[status]}
        </div>
        <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
      </div>
      <div className="space-y-2">
        {tasks.map((t) => (
          <button key={t.id} className="text-left w-full" onClick={() => onOpen(t.id)}>
            <Card className="p-2.5 hover:border-primary transition-colors">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-sm leading-tight">{t.board_name}</span>
                <PriorityDot priority={t.priority} />
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.issue}</p>
              <div className="flex items-center justify-between mt-2 gap-1 flex-wrap">
                {t.project && (
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded border"
                    style={{ background: `${t.project.color}22`, color: t.project.color, borderColor: `${t.project.color}55` }}
                  >
                    {t.project.code}
                  </span>
                )}
                {t.assignee && <span className="text-[10px] text-muted-foreground">{t.assignee.name}</span>}
              </div>
            </Card>
          </button>
        ))}
        {tasks.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Empty</p>
        )}
      </div>
    </div>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    low: "bg-slate-400", medium: "bg-blue-500", high: "bg-amber-500", urgent: "bg-rose-500",
  };
  return <span title={priority} className={cn("w-2 h-2 rounded-full flex-shrink-0 mt-1.5", map[priority] ?? "bg-slate-400")} />;
}
