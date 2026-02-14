"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare, faTrashCan, faRotateLeft, faTrash } from "@fortawesome/free-solid-svg-icons";
import { AppShell } from "@/components/shell";

type Account = { id: string; name: string; currency: string; archivedAt?: string | null };
type Category = { id: string; name: string; level: number; parentId?: string | null };
type Transaction = {
  id: string;
  description: string;
  direction: "INCOME" | "EXPENSE";
  amountOriginal: string;
  originalCurrency: string;
  transactionDate: string;
  deletedAt?: string | null;
  merchantName?: string | null;
  notes?: string | null;
  account: { id: string; name: string };
  category?: { name: string; parent?: { name: string } | null; id: string } | null;
};

type Pagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

type BulkAction = "assign_category" | "clear_category" | "soft_delete" | "restore" | "permanent_delete";
type DatePreset = "today" | "this_week" | "this_month" | "this_year" | "custom";
type ViewMode = "active" | "bin";

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getPresetRange(preset: DatePreset) {
  const now = new Date();
  const end = new Date(now);

  if (preset === "today") {
    return { from: formatDateInput(now), to: formatDateInput(end) };
  }

  if (preset === "this_week") {
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const start = new Date(now);
    start.setDate(now.getDate() - diffToMonday);
    return { from: formatDateInput(start), to: formatDateInput(end) };
  }

  if (preset === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: formatDateInput(start), to: formatDateInput(end) };
  }

  if (preset === "this_year") {
    const start = new Date(now.getFullYear(), 0, 1);
    return { from: formatDateInput(start), to: formatDateInput(end) };
  }

  return { from: "", to: "" };
}

function IconButton({
  label,
  tone,
  onClick,
  disabled,
  children
}: {
  label: string;
  tone?: "danger";
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`icon-button${tone === "danger" ? " icon-danger" : ""}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export default function TransactionsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 25, totalCount: 0, totalPages: 1 });
  const [viewMode, setViewMode] = useState<ViewMode>("active");

  const [filterAccountId, setFilterAccountId] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterDirection, setFilterDirection] = useState<"" | "INCOME" | "EXPENSE">("");
  const [filterQuery, setFilterQuery] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("this_month");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectAllFiltered, setSelectAllFiltered] = useState(false);
  const [bulkAction, setBulkAction] = useState<BulkAction>("soft_delete");
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");

  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [description, setDescription] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState("0");
  const [currency, setCurrency] = useState("NGN");
  const [transactionDate, setTransactionDate] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPayload, setEditPayload] = useState<{
    accountId: string;
    categoryId: string;
    direction: "INCOME" | "EXPENSE";
    description: string;
    merchantName: string;
    notes: string;
    amountOriginal: string;
    originalCurrency: string;
    transactionDate: string;
  } | null>(null);

  const visibleIds = useMemo(() => transactions.map((tx) => tx.id), [transactions]);
  const hasSelection = selectAllFiltered || selectedIds.length > 0;
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const sparseState = transactions.length < 3;

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (viewMode === "bin") params.set("deletedOnly", "1");
    if (filterAccountId) params.set("accountId", filterAccountId);
    if (filterCategoryId) params.set("categoryId", filterCategoryId);
    if (filterDirection) params.set("direction", filterDirection);
    if (filterQuery.trim()) params.set("q", filterQuery.trim());
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    params.set("page", String(pagination.page));
    params.set("pageSize", String(pagination.pageSize));
    return params;
  }, [filterAccountId, filterCategoryId, filterDirection, filterFrom, filterQuery, filterTo, pagination.page, pagination.pageSize, viewMode]);

  const loadAll = useCallback(async () => {
    const [a, c, t] = await Promise.all([
      fetch("/api/accounts"),
      fetch("/api/categories"),
      fetch(`/api/transactions?${buildParams().toString()}`)
    ]);

    const accountsPayload = await a.json();
    const categoriesPayload = await c.json();
    const transactionsPayload = await t.json();

    setAccounts(accountsPayload.accounts || []);
    setCategories(categoriesPayload.categories || []);
    setTransactions(transactionsPayload.transactions || []);
    setPagination((current) => ({ ...current, ...(transactionsPayload.pagination || {}) }));

    if (!accountId && accountsPayload.accounts?.[0]?.id) {
      setAccountId(accountsPayload.accounts[0].id);
    }
  }, [accountId, buildParams]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const today = formatDateInput(new Date());
    const range = getPresetRange("this_month");
    setTransactionDate(today);
    setFilterFrom(range.from);
    setFilterTo(range.to);
  }, []);

  useEffect(() => {
    setSelectedIds([]);
    setSelectAllFiltered(false);
    setBulkMessage("");
  }, [filterAccountId, filterCategoryId, filterDirection, filterFrom, filterQuery, filterTo, pagination.page, pagination.pageSize, viewMode]);

  useEffect(() => {
    setPagination((current) => ({ ...current, page: 1 }));
  }, [filterAccountId, filterCategoryId, filterDirection, filterQuery, filterFrom, filterTo, pagination.pageSize, viewMode]);

  useEffect(() => {
    setBulkAction(viewMode === "bin" ? "restore" : "soft_delete");
    cancelEdit();
  }, [viewMode]);

  async function addTransaction(event: FormEvent) {
    event.preventDefault();
    await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        categoryId: categoryId || null,
        direction: type,
        description,
        merchantName,
        notes,
        amountOriginal: Number(amount),
        originalCurrency: currency,
        transactionDate
      })
    });

    setDescription("");
    setMerchantName("");
    setNotes("");
    setAmount("0");
    await loadAll();
  }

  async function saveEdit() {
    if (!editingId || !editPayload) return;

    await fetch(`/api/transactions/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: editPayload.accountId,
        categoryId: editPayload.categoryId || null,
        direction: editPayload.direction,
        description: editPayload.description,
        merchantName: editPayload.merchantName || null,
        notes: editPayload.notes || null,
        amountOriginal: Number(editPayload.amountOriginal),
        originalCurrency: editPayload.originalCurrency,
        transactionDate: editPayload.transactionDate
      })
    });

    setEditingId(null);
    setEditPayload(null);
    await loadAll();
  }

  async function deleteTransaction(transactionId: string) {
    await fetch(`/api/transactions/${transactionId}`, { method: "DELETE" });
    await loadAll();
  }

  async function restoreTransactionRow(transactionId: string) {
    await fetch(`/api/transactions/${transactionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: true })
    });
    await loadAll();
  }

  async function permanentDeleteTransaction(transactionId: string) {
    const confirmed = window.confirm("Permanently delete this transaction? This cannot be undone.");
    if (!confirmed) return;

    await fetch(`/api/transactions/${transactionId}/permanent`, { method: "DELETE" });
    await loadAll();
  }

  async function emptyDeletedTransactions() {
    const confirmed = window.confirm("Permanently delete all deleted transactions? This cannot be undone.");
    if (!confirmed) return;

    await fetch("/api/transactions/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "all_deleted" })
    });
    await loadAll();
  }

  function beginEdit(tx: Transaction) {
    setEditingId(tx.id);
    setEditPayload({
      accountId: tx.account.id,
      categoryId: tx.category?.id || "",
      direction: tx.direction,
      description: tx.description,
      merchantName: tx.merchantName || "",
      notes: tx.notes || "",
      amountOriginal: String(tx.amountOriginal),
      originalCurrency: tx.originalCurrency,
      transactionDate: tx.transactionDate.slice(0, 10)
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditPayload(null);
  }

  function toggleVisibleSelection(checked: boolean) {
    setSelectAllFiltered(false);
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, ...visibleIds])));
      return;
    }
    setSelectedIds((current) => current.filter((id) => !visibleIds.includes(id)));
  }

  function applyDatePreset(next: DatePreset) {
    setDatePreset(next);
    if (next === "custom") return;
    const range = getPresetRange(next);
    setFilterFrom(range.from);
    setFilterTo(range.to);
  }

  async function applyBulkAction() {
    setBulkMessage("");

    if (!hasSelection) {
      setBulkMessage("Select rows first or choose all filtered records.");
      return;
    }

    if (bulkAction === "permanent_delete") {
      const confirmed = window.confirm("Permanently delete selected deleted transactions? This cannot be undone.");
      if (!confirmed) return;
    }

    const payload: {
      action: BulkAction;
      selection:
        | { mode: "explicit_ids"; ids: string[] }
        | {
            mode: "all_filtered";
            filters: {
              includeDeleted?: boolean;
              accountId?: string;
              categoryId?: string;
              direction?: "INCOME" | "EXPENSE";
              q?: string;
              from?: string;
              to?: string;
            };
          };
      data?: { categoryId?: string };
    } = {
      action: bulkAction,
      selection: selectAllFiltered
        ? {
            mode: "all_filtered",
            filters: {
              ...(viewMode === "bin" ? { includeDeleted: true } : {}),
              ...(filterAccountId ? { accountId: filterAccountId } : {}),
              ...(filterCategoryId ? { categoryId: filterCategoryId } : {}),
              ...(filterDirection ? { direction: filterDirection } : {}),
              ...(filterQuery.trim() ? { q: filterQuery.trim() } : {}),
              ...(filterFrom ? { from: filterFrom } : {}),
              ...(filterTo ? { to: filterTo } : {})
            }
          }
        : { mode: "explicit_ids", ids: selectedIds }
    };

    if (bulkAction === "assign_category") {
      if (!bulkCategoryId) {
        setBulkMessage("Choose a category before assigning.");
        return;
      }
      payload.data = { categoryId: bulkCategoryId };
    }

    const response = await fetch("/api/transactions/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok) {
      setBulkMessage(result.error || "Bulk action failed");
      return;
    }

    setBulkMessage(`Updated ${result.updatedCount} of ${result.matchedCount} (skipped ${result.skippedCount}).`);
    setSelectedIds([]);
    setSelectAllFiltered(false);
    await loadAll();
  }

  return (
    <AppShell title="Transactions">
      <section
        className={`card ${showAddForm ? "" : "card-inline card-collapsed"} ${!showAddForm && sparseState ? "card-ultra-collapsed" : ""}`}
      >
        <div className="inline-form section-head" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h3>Add new transaction</h3>
          <button type="button" onClick={() => setShowAddForm((value) => !value)}>
            {showAddForm ? "Hide form" : "Add transaction"}
          </button>
        </div>

        {showAddForm && (
          <form className="grid-form" onSubmit={addTransaction}>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>

          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {"-".repeat(Math.max(0, category.level - 1))} {category.name}
              </option>
            ))}
          </select>

          <select value={type} onChange={(e) => setType(e.target.value as "INCOME" | "EXPENSE")}>
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </select>

          <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} required />
          <input placeholder="Merchant" value={merchantName} onChange={(e) => setMerchantName(e.target.value)} />
          <input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="NGN">NGN</option>
            <option value="USD">USD</option>
          </select>
          <input type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} required />
          <button type="submit">Add transaction</button>
          <button type="button" onClick={() => setShowAddForm(false)}>
            Dismiss
          </button>
          </form>
        )}
      </section>

      <section className="card">
        <div className="inline-form section-head" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="inline-form">
            <button type="button" onClick={() => setViewMode("active")} className={viewMode === "active" ? "" : "secondary"}>
              Transactions
            </button>
            <button type="button" onClick={() => setViewMode("bin")} className={viewMode === "bin" ? "" : "secondary"}>
              Bin
            </button>
          </div>
          <div className="inline-form">
            <button type="button" onClick={() => setShowFilters((value) => !value)}>
              {showFilters ? "Hide filters" : "Show filters"}
            </button>
            {viewMode === "bin" && (
              <button type="button" className="danger" onClick={emptyDeletedTransactions}>
                Empty bin
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <>
            <div className="grid-form">
          <label>
            Search
            <input value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} placeholder="Description or merchant" />
          </label>

          <label>
            Account
            <select value={filterAccountId} onChange={(e) => setFilterAccountId(e.target.value)}>
              <option value="">All</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Category
            <select value={filterCategoryId} onChange={(e) => setFilterCategoryId(e.target.value)}>
              <option value="">All</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {"-".repeat(Math.max(0, category.level - 1))} {category.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Type
            <select value={filterDirection} onChange={(e) => setFilterDirection(e.target.value as "" | "INCOME" | "EXPENSE")}>
              <option value="">All</option>
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </select>
          </label>

          <label>
            Date
            <select value={datePreset} onChange={(e) => applyDatePreset(e.target.value as DatePreset)}>
              <option value="today">Today</option>
              <option value="this_week">This week</option>
              <option value="this_month">This month</option>
              <option value="this_year">This year</option>
              <option value="custom">Custom range</option>
            </select>
          </label>

            </div>

            {datePreset === "custom" && (
              <div className="grid-form" style={{ marginTop: 12 }}>
                <label>
                  From
                  <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
                </label>
                <label>
                  To
                  <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
                </label>
              </div>
            )}
          </>
        )}

        <div className="inline-form" style={{ marginTop: 12, justifyContent: "space-between" }}>
          <span className="muted-text desktop-help">Header checkbox selects visible rows only.</span>
          <span className="muted-text mobile-help">Tap row checkboxes to select visible cards.</span>
          <div className="inline-form">
            <button type="button" onClick={() => setSelectAllFiltered(true)}>
              Select all filtered (across all pages)
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedIds([]);
                setSelectAllFiltered(false);
              }}
            >
              Clear selection
            </button>
          </div>
        </div>

        {hasSelection && (
          <div className="bulk-bar" style={{ marginTop: 12 }}>
            <strong>{selectAllFiltered ? "All filtered records selected" : `${selectedIds.length} selected`}</strong>
            <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value as BulkAction)}>
              {viewMode === "active" ? (
                <>
                  <option value="soft_delete">Delete</option>
                  <option value="assign_category">Assign category</option>
                  <option value="clear_category">Clear category</option>
                </>
              ) : (
                <>
                  <option value="restore">Restore</option>
                  <option value="permanent_delete">Delete permanently</option>
                </>
              )}
            </select>
            {viewMode === "active" && bulkAction === "assign_category" && (
              <select value={bulkCategoryId} onChange={(e) => setBulkCategoryId(e.target.value)}>
                <option value="">Choose category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {"-".repeat(Math.max(0, category.level - 1))} {category.name}
                  </option>
                ))}
              </select>
            )}
            <button type="button" onClick={applyBulkAction}>
              Apply
            </button>
            {bulkMessage && <span className="muted-text">{bulkMessage}</span>}
          </div>
        )}

        <div className="table-wrap desktop-transactions" style={{ marginTop: 12 }}>
          <table className="transactions-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectAllFiltered || allVisibleSelected}
                    onChange={(e) => toggleVisibleSelection(e.target.checked)}
                  />
                </th>
                <th>Date</th>
                <th>Account</th>
                <th>Category</th>
                <th>Description</th>
                <th>Type</th>
                <th className="amount-col">Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectAllFiltered || selectedIds.includes(tx.id)}
                      onChange={(e) => {
                        setSelectAllFiltered(false);
                        if (e.target.checked) {
                          setSelectedIds((current) => Array.from(new Set([...current, tx.id])));
                          return;
                        }
                        setSelectedIds((current) => current.filter((id) => id !== tx.id));
                      }}
                    />
                  </td>
                  <td>
                    {editingId === tx.id ? (
                      <input
                        type="date"
                        value={editPayload?.transactionDate || tx.transactionDate.slice(0, 10)}
                        onChange={(e) =>
                          setEditPayload((current) => (current ? { ...current, transactionDate: e.target.value } : null))
                        }
                      />
                    ) : (
                      tx.transactionDate.slice(0, 10)
                    )}
                  </td>
                  <td>
                    {editingId === tx.id ? (
                      <select
                        value={editPayload?.accountId || tx.account.id}
                        onChange={(e) => setEditPayload((current) => (current ? { ...current, accountId: e.target.value } : null))}
                      >
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      tx.account.name
                    )}
                  </td>
                  <td>
                    {editingId === tx.id ? (
                      <select
                        value={editPayload?.categoryId || ""}
                        onChange={(e) => setEditPayload((current) => (current ? { ...current, categoryId: e.target.value } : null))}
                      >
                        <option value="">No category</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {"-".repeat(Math.max(0, category.level - 1))} {category.name}
                          </option>
                        ))}
                      </select>
                    ) : tx.category?.parent?.name ? (
                      `${tx.category.parent.name} / ${tx.category.name}`
                    ) : (
                      tx.category?.name || "-"
                    )}
                  </td>
                  <td>
                    {editingId === tx.id ? (
                      <div className="grid-form">
                        <input
                          value={editPayload?.description || ""}
                          onChange={(e) => setEditPayload((current) => (current ? { ...current, description: e.target.value } : null))}
                        />
                        <input
                          value={editPayload?.merchantName || ""}
                          onChange={(e) => setEditPayload((current) => (current ? { ...current, merchantName: e.target.value } : null))}
                          placeholder="Merchant"
                        />
                        <input
                          value={editPayload?.notes || ""}
                          onChange={(e) => setEditPayload((current) => (current ? { ...current, notes: e.target.value } : null))}
                          placeholder="Notes"
                        />
                      </div>
                    ) : (
                      tx.description
                    )}
                  </td>
                  <td>
                    {editingId === tx.id ? (
                      <select
                        value={editPayload?.direction || tx.direction}
                        onChange={(e) =>
                          setEditPayload((current) =>
                            current ? { ...current, direction: e.target.value as "INCOME" | "EXPENSE" } : null
                          )
                        }
                      >
                        <option value="EXPENSE">Expense</option>
                        <option value="INCOME">Income</option>
                      </select>
                    ) : (
                      <span className={`badge ${tx.direction === "INCOME" ? "success" : "warning"}`}>
                        {tx.direction === "INCOME" ? "Income" : "Expense"}
                      </span>
                    )}
                  </td>
                  <td className="amount-col">
                    {editingId === tx.id ? (
                      <div className="inline-form">
                        <input
                          type="number"
                          step="0.01"
                          value={editPayload?.amountOriginal || tx.amountOriginal}
                          onChange={(e) =>
                            setEditPayload((current) => (current ? { ...current, amountOriginal: e.target.value } : null))
                          }
                        />
                        <select
                          value={editPayload?.originalCurrency || tx.originalCurrency}
                          onChange={(e) =>
                            setEditPayload((current) => (current ? { ...current, originalCurrency: e.target.value } : null))
                          }
                        >
                          <option value="NGN">NGN</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                    ) : (
                      `${tx.originalCurrency} ${tx.amountOriginal}`
                    )}
                  </td>
                  <td>
                    <span className={`badge ${tx.deletedAt ? "neutral" : "active"}`}>{tx.deletedAt ? "Deleted" : "Active"}</span>
                  </td>
                  <td>
                    <div className="icon-actions">
                      {editingId === tx.id ? (
                        <button type="button" onClick={saveEdit}>
                          Save
                        </button>
                      ) : tx.deletedAt ? (
                        <>
                          <IconButton label="Restore transaction" onClick={() => restoreTransactionRow(tx.id)}>
                            <FontAwesomeIcon icon={faRotateLeft} />
                          </IconButton>
                          <IconButton label="Permanently delete transaction" tone="danger" onClick={() => permanentDeleteTransaction(tx.id)}>
                            <FontAwesomeIcon icon={faTrash} />
                          </IconButton>
                        </>
                      ) : (
                        <>
                          <IconButton
                            label="Edit transaction"
                            onClick={() => beginEdit(tx)}
                          >
                            <FontAwesomeIcon icon={faPenToSquare} />
                          </IconButton>
                          <IconButton label="Delete transaction" tone="danger" onClick={() => deleteTransaction(tx.id)}>
                            <FontAwesomeIcon icon={faTrashCan} />
                          </IconButton>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <span className="muted-text">
                      {viewMode === "bin" ? "Bin is empty for current filters." : "No transactions for current filters."}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mobile-transactions" style={{ marginTop: 12 }}>
          {transactions.map((tx) => (
            <article key={tx.id} className="mobile-tx-card">
              <div className="mobile-tx-row-1">
                <label className="mobile-tx-select">
                  <input
                    type="checkbox"
                    checked={selectAllFiltered || selectedIds.includes(tx.id)}
                    onChange={(e) => {
                      setSelectAllFiltered(false);
                      if (e.target.checked) {
                        setSelectedIds((current) => Array.from(new Set([...current, tx.id])));
                        return;
                      }
                      setSelectedIds((current) => current.filter((id) => id !== tx.id));
                    }}
                  />
                </label>
                <div className="mobile-tx-desc">{tx.description}</div>
                <div className="mobile-tx-amount">
                  {tx.originalCurrency} {tx.amountOriginal}
                </div>
              </div>
              <div className="mobile-tx-row-2">
                <div className="mobile-tx-meta">
                  {tx.transactionDate.slice(0, 10)} • {tx.account.name} •{" "}
                  {tx.category?.parent?.name ? `${tx.category.parent.name}/${tx.category.name}` : tx.category?.name || "-"}
                </div>
                <div className="mobile-tx-right">
                  <span className={`badge ${tx.direction === "INCOME" ? "success" : "warning"}`}>
                    {tx.direction === "INCOME" ? "Income" : "Expense"}
                  </span>
                  <span className={`badge ${tx.deletedAt ? "neutral" : "active"}`}>{tx.deletedAt ? "Deleted" : "Active"}</span>
                  {tx.deletedAt ? (
                    <>
                      <IconButton label="Restore transaction" onClick={() => restoreTransactionRow(tx.id)}>
                        <FontAwesomeIcon icon={faRotateLeft} />
                      </IconButton>
                      <IconButton label="Permanently delete transaction" tone="danger" onClick={() => permanentDeleteTransaction(tx.id)}>
                        <FontAwesomeIcon icon={faTrash} />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      <IconButton label="Edit transaction" onClick={() => beginEdit(tx)}>
                        <FontAwesomeIcon icon={faPenToSquare} />
                      </IconButton>
                      <IconButton label="Delete transaction" tone="danger" onClick={() => deleteTransaction(tx.id)}>
                        <FontAwesomeIcon icon={faTrashCan} />
                      </IconButton>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
          {transactions.length === 0 && (
            <p className="muted-text">{viewMode === "bin" ? "Bin is empty for current filters." : "No transactions for current filters."}</p>
          )}
        </div>

        <div className="inline-form" style={{ marginTop: 12, justifyContent: "space-between" }}>
          <span className="muted-text">
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} total)
          </span>
          <div className="inline-form">
            <select
              value={String(pagination.pageSize)}
              onChange={(e) => setPagination((current) => ({ ...current, pageSize: Number(e.target.value), page: 1 }))}
            >
              <option value="25">25 / page</option>
              <option value="50">50 / page</option>
              <option value="100">100 / page</option>
            </select>
            <button
              type="button"
              onClick={() => setPagination((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
              disabled={pagination.page <= 1}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPagination((current) => ({ ...current, page: Math.min(current.totalPages, current.page + 1) }))}
              disabled={pagination.page >= pagination.totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {editingId && editPayload && (
        <div className="mobile-edit-modal-backdrop" onClick={cancelEdit}>
          <section className="mobile-edit-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Edit transaction</h4>
            <div className="grid-form">
              <input
                value={editPayload.description}
                onChange={(e) => setEditPayload((current) => (current ? { ...current, description: e.target.value } : null))}
                placeholder="Description"
              />
              <input
                value={editPayload.merchantName}
                onChange={(e) => setEditPayload((current) => (current ? { ...current, merchantName: e.target.value } : null))}
                placeholder="Merchant"
              />
              <select
                value={editPayload.accountId}
                onChange={(e) => setEditPayload((current) => (current ? { ...current, accountId: e.target.value } : null))}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
              <select
                value={editPayload.categoryId}
                onChange={(e) => setEditPayload((current) => (current ? { ...current, categoryId: e.target.value } : null))}
              >
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {"-".repeat(Math.max(0, category.level - 1))} {category.name}
                  </option>
                ))}
              </select>
              <select
                value={editPayload.direction}
                onChange={(e) =>
                  setEditPayload((current) => (current ? { ...current, direction: e.target.value as "INCOME" | "EXPENSE" } : null))
                }
              >
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
              </select>
              <input
                type="date"
                value={editPayload.transactionDate}
                onChange={(e) => setEditPayload((current) => (current ? { ...current, transactionDate: e.target.value } : null))}
              />
              <input
                type="number"
                step="0.01"
                value={editPayload.amountOriginal}
                onChange={(e) => setEditPayload((current) => (current ? { ...current, amountOriginal: e.target.value } : null))}
              />
              <select
                value={editPayload.originalCurrency}
                onChange={(e) => setEditPayload((current) => (current ? { ...current, originalCurrency: e.target.value } : null))}
              >
                <option value="NGN">NGN</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div className="inline-form" style={{ marginTop: 8 }}>
              <button type="button" onClick={saveEdit}>
                Save
              </button>
              <button type="button" onClick={cancelEdit}>
                Cancel
              </button>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
