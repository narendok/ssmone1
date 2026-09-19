import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/projects";

interface Props {
  projects: Project[];
  value: string[];
  onChange: (next: string[]) => void;
}

export function ProjectMultiSelect({ projects, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const selected = projects.filter((p) => value.includes(p.id));

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-auto min-h-9 py-1.5">
          <div className="flex flex-wrap gap-1">
            {selected.length === 0 && <span className="text-muted-foreground">Tag projects…</span>}
            {selected.map((p) => (
              <Badge key={p.id} variant="secondary" style={{ background: `${p.color}22`, color: p.color, borderColor: `${p.color}55` }} className="border">
                {p.code}
              </Badge>
            ))}
          </div>
          <ChevronsUpDown className="h-4 w-4 opacity-50 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Command>
          <CommandInput placeholder="Search projects…" />
          <CommandList>
            <CommandEmpty>No projects.</CommandEmpty>
            <CommandGroup>
              {projects.filter((p) => p.status === "active").map((p) => (
                <CommandItem key={p.id} value={`${p.code} ${p.name}`} onSelect={() => toggle(p.id)}>
                  <Check className={cn("mr-2 h-4 w-4", value.includes(p.id) ? "opacity-100" : "opacity-0")} />
                  <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ background: p.color }} />
                  <span className="font-mono text-xs mr-2">{p.code}</span>
                  <span>{p.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ProjectChips({ projects }: { projects: { id: string; name: string; code: string; color: string }[] }) {
  if (!projects?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {projects.map((p) => (
        <span
          key={p.id}
          title={p.name}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border"
          style={{ background: `${p.color}22`, color: p.color, borderColor: `${p.color}55` }}
        >
          {p.code}
        </span>
      ))}
    </div>
  );
}
