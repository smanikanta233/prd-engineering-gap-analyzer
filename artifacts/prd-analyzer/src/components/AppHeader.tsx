import { Link, useLocation } from "wouter";
import { Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AppHeader() {
  const [location] = useLocation();

  const navLinks = [
    { href: "/", label: "Analyzer" },
    { href: "/history", label: "History" },
    { href: "/admin", label: "Admin" },
  ];

  return (
    <header className="border-b border-border bg-card sticky top-0 z-50">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-mono font-bold text-sm text-foreground hover:text-primary transition-colors">
          <div className="w-7 h-7 bg-primary rounded-sm flex items-center justify-center">
            <Cpu className="w-4 h-4 text-primary-foreground" />
          </div>
          PRD Gap Analyzer
        </Link>

        <nav className="flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive =
              link.href === "/"
                ? location === "/"
                : location.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors font-mono",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
