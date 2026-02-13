"use client";

import { FormEvent, useState } from "react";
import { AppShell } from "@/components/shell";

type ImportJob = {
  id: string;
  status: string;
  type: string;
  errorSummary?: string | null;
  uploadedFile?: { rawText?: string | null } | null;
  user?: { aiAudits?: Array<{ id: string; model: string; purpose: string; prompt: string; responseJson: unknown }> };
  extractedRows?: Array<{
    id: string;
    duplicateOfId?: string | null;
    confidence?: string | null;
    transaction?: { id: string; description: string; amountOriginal: string } | null;
  }>;
};

export default function ImportsPage() {
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [message, setMessage] = useState("");

  async function upload(url: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(url, { method: "POST", body: form });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error || "Upload failed");
      return;
    }

    setMessage(`Import started. Job ID: ${payload.jobId}`);
    setJobId(payload.jobId);
  }

  async function onStatementSubmit(event: FormEvent) {
    event.preventDefault();
    if (!statementFile) return;
    await upload("/api/imports/statement", statementFile);
  }

  async function onReceiptSubmit(event: FormEvent) {
    event.preventDefault();
    if (!receiptFile) return;
    await upload("/api/imports/receipt", receiptFile);
  }

  async function refreshJob() {
    if (!jobId) return;
    const response = await fetch(`/api/imports/${jobId}`);
    const payload = await response.json();
    if (response.ok) setJob(payload.job);
  }

  async function finalize(action: "confirm" | "reject") {
    if (!jobId) return;
    await fetch(`/api/imports/${jobId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    await refreshJob();
  }

  return (
    <AppShell title="AI Import Wizard">
      <section className="card">
        <h3>1) Bank statement import (CSV/XLSX/PDF/Text)</h3>
        <form className="inline-form" onSubmit={onStatementSubmit}>
          <input type="file" onChange={(e) => setStatementFile(e.target.files?.[0] || null)} required />
          <button type="submit">Start statement import</button>
        </form>
      </section>

      <section className="card">
        <h3>2) Receipt import (Image/PDF)</h3>
        <form className="inline-form" onSubmit={onReceiptSubmit}>
          <input type="file" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} required />
          <button type="submit">Start receipt import</button>
        </form>
      </section>

      <section className="card">
        <h3>3) Review and confirm</h3>
        <div className="inline-form">
          <input placeholder="Import job ID" value={jobId || ""} onChange={(e) => setJobId(e.target.value)} />
          <button type="button" onClick={refreshJob}>
            Load job
          </button>
          <button type="button" onClick={() => finalize("confirm")}>
            Confirm import
          </button>
          <button type="button" className="danger" onClick={() => finalize("reject")}>
            Reject import
          </button>
        </div>

        <p>{message}</p>

        {job && (
          <div>
            <p>
              Status: <strong>{job.status}</strong> ({job.type})
            </p>
            {job.errorSummary && <p className="error">{job.errorSummary}</p>}
            {job.uploadedFile?.rawText && (
              <details>
                <summary>Raw extracted text preview</summary>
                <pre>{job.uploadedFile.rawText.slice(0, 4000)}</pre>
              </details>
            )}
            {(job.user?.aiAudits || []).map((audit) => (
              <details key={audit.id}>
                <summary>
                  {audit.purpose} via {audit.model}
                </summary>
                <pre>{audit.prompt}</pre>
                <pre>{JSON.stringify(audit.responseJson, null, 2)}</pre>
              </details>
            ))}
            <table>
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Duplicate?</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {(job.extractedRows || []).map((row) => (
                  <tr key={row.id}>
                    <td>{row.transaction?.description || "Pending"}</td>
                    <td>{row.duplicateOfId ? "Yes" : "No"}</td>
                    <td>{row.confidence || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
