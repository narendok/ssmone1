import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { CircuitBoard, ClipboardList, Loader2, ShieldCheck, ShoppingCart, PackageCheck, User, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useServerFn } from "@tanstack/react-start";
import { ensureDemoAccount, type DemoRole } from "@/lib/demo-auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DEMO_OPTIONS: { role: DemoRole; label: string; hint: string; icon: typeof User }[] = [
  { role: "admin", label: "Admin", hint: "Full access", icon: ShieldCheck },
  { role: "project_manager", label: "Project manager", hint: "Tasks & delivery", icon: ClipboardList },
  { role: "lead_engineer", label: "Lead engineer", hint: "Department work", icon: Wrench },
  { role: "purchase", label: "Purchase", hint: "Vendors & POs", icon: ShoppingCart },
  { role: "storekeeper", label: "Storekeeper", hint: "Inwarding", icon: PackageCheck },
  { role: "member", label: "Member", hint: "Browse & assign", icon: User },
];


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
  const [demoRole, setDemoRole] = useState<DemoRole | null>(null);
  const prepareDemo = useServerFn(ensureDemoAccount);

  async function handleDemo(role: DemoRole) {
    setDemoRole(role);
    try {
      const account = await prepareDemo({ data: { role } });
      const { error } = await supabase.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      });
      if (error) throw new Error(error.message);
      toast.success(`Signed in as ${account.name}`);
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the demo session");
    } finally {
      setDemoRole(null);
    }
  }


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

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.auth.signUp({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: String(fd.get("name")) },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. You can sign in now.");
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
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
        <div className="flex items-center gap-2 text-xl font-semibold">
          <CircuitBoard className="h-6 w-6" /> PartsBench
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl font-bold leading-tight">Your electronics lab, organized.</h1>
          <p className="text-primary-foreground/80 max-w-md">
            Track parts across bags, boxes and racks. Assign kits to your R&amp;D team and get notified on return.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">© PartsBench</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden flex items-center gap-2 text-xl font-semibold">
            <CircuitBoard className="h-6 w-6 text-primary" /> PartsBench
          </div>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="space-y-4 pt-4">
              <form onSubmit={handleSignIn} className="space-y-3">
                <div className="space-y-1.5"><Label>Email</Label><Input name="email" type="email" required /></div>
                <div className="space-y-1.5"><Label>Password</Label><Input name="password" type="password" required /></div>
                <Button className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup" className="space-y-4 pt-4">
              <form onSubmit={handleSignUp} className="space-y-3">
                <div className="space-y-1.5"><Label>Name</Label><Input name="name" required /></div>
                <div className="space-y-1.5"><Label>Email</Label><Input name="email" type="email" required /></div>
                <div className="space-y-1.5"><Label>Password</Label><Input name="password" type="password" required minLength={6} /></div>
                <Button className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />} Create account
                </Button>
                <p className="text-xs text-muted-foreground">First account becomes admin. Others join as members.</p>
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
          <div className="rounded-lg border p-4 space-y-3">
            <div>
              <p className="text-sm font-medium">Try the portal instantly</p>
              <p className="text-xs text-muted-foreground">One click signs you in with sample demo access.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_OPTIONS.map(({ role, label, hint, icon: Icon }) => (
                <Button
                  key={role}
                  type="button"
                  variant="secondary"
                  className="h-auto flex-col items-start gap-0.5 py-2"
                  disabled={demoRole !== null || loading}
                  onClick={() => handleDemo(role)}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {demoRole === role ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                    {label}
                  </span>
                  <span className="text-[11px] font-normal text-muted-foreground">{hint}</span>
                </Button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
