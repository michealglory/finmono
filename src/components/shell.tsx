import { AppNav } from "@/components/nav";

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="shell">
      <AppNav />
      <main className="content">
        <header className="page-header">
          <h1>{title}</h1>
        </header>
        {children}
      </main>
    </div>
  );
}
