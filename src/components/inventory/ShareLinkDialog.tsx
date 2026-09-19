import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Link2, Ban } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createSharedBom, fetchSharedBoms, revokeSharedBom } from "@/lib/shared-boms";
import type { ShareRow } from "@/lib/bom-share";

export function ShareLinkDialog({
  rows,
  defaultTitle,
  onOpenChange,
}: {
  rows: ShareRow[];
  defaultTitle: string;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(defaultTitle);
  const [expiry, setExpiry] = useState("30");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: existing = [] } = useQuery({ queryKey: ["shared_boms"], queryFn: fetchSharedBoms });

  async function create() {
    setBusy(true);
    try {
      const days = expiry === "never" ? null : Number(expiry);
      const share = await createSharedBom(title.trim() || defaultTitle, rows, days);
      const link = `${window.location.origin}/share/${share.token}`;
      setUrl(link);
      await navigator.clipboard.writeText(link).catch(() => {});
      qc.invalidateQueries({ queryKey: ["shared_boms"] });
      toast.success("Share link created and copied");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not create share link");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    try {
      await revokeSharedBom(id);
      qc.invalidateQueries({ queryKey: ["shared_boms"] });
      toast.success("Link revoked");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not revoke link");
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Share a read-only list</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Title</div>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Expires</div>
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">In 7 days</SelectItem>
                  <SelectItem value="30">In 30 days</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={create} disabled={busy || rows.length === 0}>
              <Link2 className="h-4 w-4" /> Create link
            </Button>
            <span className="text-xs text-muted-foreground pb-2">{rows.length} component(s)</span>
          </div>

          {url && (
            <div className="flex gap-2">
              <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
              <Button
                variant="outline"
                onClick={() => { navigator.clipboard.writeText(url); toast.success("Copied"); }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}

          {existing.length > 0 && (
            <div className="pt-2">
              <div className="text-sm font-medium mb-1">Shared lists</div>
              <ul className="max-h-56 overflow-y-auto divide-y text-sm">
                {existing.map((s) => {
                  const dead = !!s.revoked_at || (s.expires_at ? new Date(s.expires_at) < new Date() : false);
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <div className="truncate">{s.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(s.created_at).toLocaleDateString()} ·{" "}
                          {s.revoked_at ? "revoked" : s.expires_at ? `expires ${new Date(s.expires_at).toLocaleDateString()}` : "no expiry"}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/share/${s.token}`);
                            toast.success("Copied");
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        {!dead && (
                          <Button variant="ghost" size="sm" onClick={() => revoke(s.id)}>
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
