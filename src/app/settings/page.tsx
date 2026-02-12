"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell";

export default function SettingsPage() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  async function deleteData() {
    const confirmed = window.confirm("Delete all data permanently?");
    if (!confirmed) return;

    await fetch("/api/settings/delete-data", { method: "POST" });
    router.push("/register");
  }

  return (
    <AppShell title="Settings & Privacy">
      <section className="card">
        <h3>Session</h3>
        <button onClick={logout}>Logout</button>
      </section>

      <section className="card">
        <h3>Delete My Data</h3>
        <p>This permanently removes accounts, transactions, imports, and uploaded files for your user.</p>
        <button className="danger" onClick={deleteData}>
          Delete my data
        </button>
      </section>
    </AppShell>
  );
}
