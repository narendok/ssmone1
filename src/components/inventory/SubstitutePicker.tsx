import { useEffect, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface SubstituteLink {
  id: string;
  name: string;
  part_number: string;
  manufacturer: string | null;
  note: string | null;
}

interface Props {
  excludeId?: string;
  value: SubstituteLink[];
  onChange: (links: SubstituteLink[]) => void;
}

export function SubstitutePicker({ excludeId, value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SubstituteLink[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("components")
        .select("id, name, part_number, manufacturer")
        .or(`name.ilike.%${q}%,part_number.ilike.%${q}%`)
        .limit(10);
      if (cancelled) return;
      setResults(
        ((data ?? []) as any[])
          .filter((c) => c.id !== excludeId && !value.some((v) => v.id === c.id))
          .map((c) => ({ id: c.id, name: c.name, part_number: c.part_number, manufacturer: c.manufacturer ?? null, note: null }))
      );
      setSearching(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, excludeId, value]);

  function add(link: SubstituteLink) {
    onChange([...value, link]);
    setQuery("");
    setResults([]);
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search inventory by name or part number…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {searching && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
        {results.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-56 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => add(r)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground font-mono">
                  {r.part_number}{r.manufacturer ? ` · ${r.manufacturer}` : ""}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">No substitutes linked yet.</p>
      ) : (
        <ul className="space-y-2">
          {value.map((v, i) => (
            <li key={v.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
              <Badge variant="secondary" className="font-mono text-xs">{v.part_number}</Badge>
              <span className="text-sm font-medium">{v.name}</span>
              <Input
                className="h-8 flex-1 min-w-[140px]"
                placeholder="Note (optional)"
                value={v.note ?? ""}
                onChange={(e) => {
                  const next = [...value];
                  next[i] = { ...v, note: e.target.value };
                  onChange(next);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`Remove ${v.name}`}
                onClick={() => onChange(value.filter((x) => x.id !== v.id))}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
