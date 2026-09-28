import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ScanLine, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";

const targets = [
  { name: "My day", hint: "Today and later tasks", to: "/command-center", permission: "my_work.view" },
  { name: "Department workspace", hint: "Lead priorities and approvals", to: "/dashboards", permission: "my_work.view" },
  { name: "PartsBench inventory", hint: "Engineering", to: "/", permission: "engineering.view" },
  { name: "Projects", hint: "Work", to: "/projects", permission: "projects.view" },
  { name: "Unified records search", hint: "Clients, projects, audits & documents", to: "/records", permission: "documents.view" },
  { name: "Task board", hint: "Work", to: "/tasks", permission: "my_work.view" },
  { name: "HR overview", hint: "HR", to: "/hr", permission: "hr.view" },
  { name: "Recruitment", hint: "HR", to: "/hr/recruitment", permission: "recruitment.manage" },
  { name: "Leave desk", hint: "HR", to: "/hr/leave", permission: "hr.view" },
  { name: "Purchase orders", hint: "Operations", to: "/procurement/orders", permission: "procurement.view" },
  { name: "Administration", hint: "System", to: "/admin", permission: "admin.view" },
];

export function GlobalSearch({ mobile = false, canScan = false }: { mobile?: boolean; canScan?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { role, permissions, employeeStatus } = useAuth();
  const results = useMemo(() => targets.filter((target) => employeeStatus !== "SUSPENDED" && employeeStatus !== "EXITED" && (role === "admin" || permissions.includes(target.permission)) && target.name.toLowerCase().includes(query.toLowerCase())), [employeeStatus, permissions, query, role]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen(true); }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return <>
    <Button variant={mobile ? "ghost" : "outline"} className={mobile ? "h-full flex-col gap-1 rounded-none px-1 text-xs" : "hidden h-8 w-full max-w-md justify-between text-muted-foreground md:flex"} onClick={() => setOpen(true)}>
      {mobile ? <><span className="relative"><Search className="size-5" />{canScan && <ScanLine className="absolute -right-2 -bottom-1 size-3 text-primary" />}</span><span>Search</span></> : <><span className="flex items-center gap-2"><Search /> Search workspace</span><kbd className="text-[10px]">Ctrl K</kbd></>}
    </Button>
    {open && <div className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/20 p-4 pt-[15vh]" onMouseDown={() => setOpen(false)}>
      <div className="w-full max-w-xl rounded-lg border bg-popover p-3 shadow-elevated" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-2 border-b pb-3"><Search className="size-4 text-muted-foreground" /><Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search accessible workspace areas" className="border-0 shadow-none focus-visible:ring-0" /></div>
        <div className="max-h-72 overflow-auto py-2">
          {results.map((result) => <Link key={result.name} to={result.to} onClick={() => setOpen(false)} className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent"><span>{result.name}</span><span className="text-xs text-muted-foreground">{result.hint}</span></Link>)}
          {!results.length && <p className="px-3 py-5 text-sm text-muted-foreground">No accessible results found.</p>}
        </div>
      </div>
    </div>}
  </>;
}
