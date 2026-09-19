import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Link2, Ban } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createShareLink, fetchShareLinks, revokeShareLink, type DriveNode } from "@/lib/drive";

export function ShareNodeDialog({
  node,
  onOpenChange,
}: {
  node: DriveNode | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [permission, setPermission] = useState<"VIEW" | "DOWNLOAD">("DOWNLOAD");
  const [expiry, setExpiry] = useState("30");

  const { data: links = [], refetch } = useQuery({
    queryKey: ["drive_share_links", node?.id],
    queryFn: () => fetchShareLinks(node!.id),
    enabled: !!node,
  });

  const urlFor = (token: string) => `${window.location.origin}/file/${token}`;

  async function handleCreate() {
    if (!node) return;
    try {
      const link = await createShareLink(node.id, permission, expiry === "never" ? null : Number(expiry));
      await navigator.clipboard.writeText(urlFor(link.share_token)).catch(() => {});
      toast.success("Share link created and copied");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the link");
    }
  }

  return (
    <Dialog open={!!node} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="truncate">Share — {node?.name}</DialogTitle>
          <DialogDescription>Anyone with the link can open this file until it expires.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Permission</Label>
            <Select value={permission} onValueChange={(v) => setPermission(v as "VIEW" | "DOWNLOAD")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="VIEW">View only</SelectItem>
                <SelectItem value="DOWNLOAD">View & download</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Expires</Label>
            <Select value={expiry} onValueChange={setExpiry}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">In 7 days</SelectItem>
                <SelectItem value="30">In 30 days</SelectItem>
                <SelectItem value="90">In 90 days</SelectItem>
                <SelectItem value="never">Never</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleCreate}>
          <Link2 className="h-4 w-4 mr-1" /> Create link
        </Button>

        <div className="space-y-1">
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground">No links yet.</p>
          ) : (
            links.map((l) => {
              const expired = l.expires_at && new Date(l.expires_at) < new Date();
              const dead = !!l.revoked_at || expired;
              return (
                <div key={l.id} className="flex items-center gap-2 rounded border px-2 py-1.5 text-xs">
                  <span className={dead ? "flex-1 line-through text-muted-foreground" : "flex-1 truncate font-mono"}>
                    /file/{l.share_token.slice(0, 10)}…
                  </span>
                  <span className="text-muted-foreground">{l.permission_level === "VIEW" ? "view" : "download"}</span>
                  {!dead && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => {
                          navigator.clipboard.writeText(urlFor(l.share_token));
                          toast.success("Copied");
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={async () => {
                          await revokeShareLink(l.id);
                          refetch();
                        }}
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {dead && <span className="text-muted-foreground">{l.revoked_at ? "revoked" : "expired"}</span>}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
