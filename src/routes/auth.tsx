import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { CircuitBoard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate({ to: "/" });
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      setLoading(false);
      toast.error(result.error.message);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
       <div className="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground">
        <div className="flex items-center gap-2 text-xl font-semibold">
           <CircuitBoard className="h-6 w-6" /> SSM One
        </div>
        <div className="space-y-3">
           <h1 className="text-4xl font-bold leading-tight">One workspace for every operating team.</h1>
          <p className="text-primary-foreground/80 max-w-md">
             Six Sense Mobility teams coordinate engineering, procurement, quality, and company operations from a unified workspace.
          </p>
        </div>
         <p className="text-xs text-primary-foreground/60">HEXENSE LABS PRIVATE LIMITED · SIX SENSE MOBILITY</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden flex items-center gap-2 text-xl font-semibold">
             <CircuitBoard className="h-6 w-6 text-primary" /> SSM One
          </div>
           <Tabs defaultValue="signin">
             <TabsList className="grid w-full grid-cols-1">
               <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsContent value="signin" className="space-y-4 pt-4">
              <form onSubmit={handleSignIn} className="space-y-3">
                <div className="space-y-1.5"><Label>Email</Label><Input name="email" type="email" required /></div>
                <div className="space-y-1.5"><Label>Password</Label><Input name="password" type="password" required /></div>
                <Button className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground">or</span></div>
          </div>
          <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
            Continue with Google
          </Button>
           <p className="text-center text-xs text-muted-foreground">Access is provided by invitation. Contact your system administrator for help.</p>

        </div>
      </div>
    </div>
  );
}
