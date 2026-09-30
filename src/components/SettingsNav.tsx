import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function SettingsNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/settings/categories", label: "Categories" },
    { to: "/settings/projects", label: "Projects" },
    { to: "/settings/drive", label: "Drive structure" },
  ] as const;
  return (
    <nav className="flex items-center gap-1 border-b mb-4">
      {items.map((it) => (
        <Link
          key={it.to}
          to={it.to}
          className={cn(
            "px-3 py-2 text-sm border-b-2 -mb-px transition-colors",
            pathname === it.to ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
