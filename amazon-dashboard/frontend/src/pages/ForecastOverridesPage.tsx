import { useCallback, useEffect, useState } from "react";
import {
  getForecastOverrides,
  createForecastOverride,
  updateForecastOverride,
  deleteForecastOverride,
  type ForecastOverrideResponse,
  type ForecastOverrideCreate,
  type ForecastOverrideUpdate,
} from "../api";
import Card from "../components/ui/Card";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getDemoForecastOverrides } from "../data/demoData";
import { isDemoMode } from "../utils/preferences";

function formatDate(iso: string | null): string {
  if (iso == null) return "—";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return String(iso).slice(0, 10);
  }
}

const OVERRIDE_TYPES = ["absolute", "multiplier"] as const;

export default function ForecastOverridesPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [list, setList] = useState<ForecastOverrideResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSku, setFilterSku] = useState("");
  const [filterMarketplace, setFilterMarketplace] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const load = useCallback(() => {
    if (isDemoMode()) {
      setList(
        getDemoForecastOverrides({
          sku: filterSku.trim() || undefined,
          marketplace: filterMarketplace.trim() || undefined,
        })
      );
      setLoading(false);
      return;
    }
    if (!token) return;
    setLoading(true);
    getForecastOverrides(token, {
      sku: filterSku.trim() || undefined,
      marketplace: filterMarketplace.trim() || undefined,
    })
      .then(setList)
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [token, filterSku, filterMarketplace]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = (body: ForecastOverrideCreate) => {
    if (isDemoMode()) {
      showToast("Demo: overrides are not persisted.", "info");
      setCreateOpen(false);
      return;
    }
    if (!token) return;
    const start = body.start_date ? new Date(body.start_date).toISOString().slice(0, 10) : "";
    const end = body.end_date ? new Date(body.end_date).toISOString().slice(0, 10) : "";
    if (start > end) {
      showToast("Start date must be <= end date", "error");
      return;
    }
    if (body.override_type === "multiplier" && body.value <= 0) {
      showToast("Multiplier value must be > 0", "error");
      return;
    }
    if (body.override_type === "absolute" && body.value < 0) {
      showToast("Absolute value must be >= 0", "error");
      return;
    }
    createForecastOverride(token, { ...body, start_date: start, end_date: end })
      .then(() => {
        showToast("Override created", "success");
        setCreateOpen(false);
        load();
      })
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : "Failed to create override", "error")
      );
  };

  const handleUpdate = (id: number, body: ForecastOverrideUpdate) => {
    if (isDemoMode()) {
      showToast("Demo: overrides are not persisted.", "info");
      setEditingId(null);
      return;
    }
    if (!token) return;
    if (body.start_date != null && body.end_date != null && body.start_date > body.end_date) {
      showToast("Start date must be <= end date", "error");
      return;
    }
    if (body.override_type === "multiplier" && body.value != null && body.value <= 0) {
      showToast("Multiplier value must be > 0", "error");
      return;
    }
    updateForecastOverride(token, id, body)
      .then(() => {
        showToast("Override updated", "success");
        setEditingId(null);
        load();
      })
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : "Failed to update override", "error")
      );
  };

  const handleDelete = (id: number) => {
    if (isDemoMode()) {
      showToast("Demo: overrides are not persisted.", "info");
      setDeleteConfirmId(null);
      return;
    }
    if (!token) return;
    deleteForecastOverride(token, id)
      .then(() => {
        showToast("Override deleted", "success");
        setDeleteConfirmId(null);
        load();
      })
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : "Failed to delete override", "error")
      );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <h1 style={{ margin: 0, fontSize: "var(--text-xl)", fontWeight: "var(--font-semibold)" }}>
        Forecast overrides
      </h1>
      <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
        Owner-only. Overrides layer on top of the model output (absolute units/day or multiplier).
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-4)",
          alignItems: "center",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
          SKU
          <input
            type="text"
            value={filterSku}
            onChange={(e) => setFilterSku(e.target.value)}
            placeholder="Filter by SKU"
            style={{
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              width: 140,
            }}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
          Marketplace
          <input
            type="text"
            value={filterMarketplace}
            onChange={(e) => setFilterMarketplace(e.target.value)}
            placeholder="Filter by marketplace"
            style={{
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              width: 120,
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          style={{
            padding: "var(--space-2) var(--space-4)",
            backgroundColor: "var(--color-primary)",
            color: "white",
            border: "none",
            borderRadius: "var(--radius-md)",
            fontWeight: "var(--font-medium)",
            cursor: "pointer",
          }}
        >
          Create override
        </button>
      </div>

      {createOpen && (
        <OverrideForm
          onSave={handleCreate}
          onCancel={() => setCreateOpen(false)}
          title="Create override"
        />
      )}

      {editingId != null && (() => {
        const row = list.find((r) => r.id === editingId);
        if (!row) return null;
        return (
          <OverrideForm
            initial={row}
            onSave={(body) => handleUpdate(row.id, body)}
            onCancel={() => setEditingId(null)}
            title="Edit override"
          />
        );
      })()}

      {loading ? (
        <LoadingSkeleton count={5} />
      ) : (
        <Card>
          <div style={{ padding: "var(--space-4)", overflowX: "auto" }}>
            {list.length === 0 ? (
              <p style={{ margin: 0, color: "var(--color-text-muted)" }}>No overrides match the filters.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                    <th style={{ padding: "var(--space-2) var(--space-3)" }}>SKU</th>
                    <th style={{ padding: "var(--space-2) var(--space-3)" }}>Marketplace</th>
                    <th style={{ padding: "var(--space-2) var(--space-3)" }}>Start</th>
                    <th style={{ padding: "var(--space-2) var(--space-3)" }}>End</th>
                    <th style={{ padding: "var(--space-2) var(--space-3)" }}>Type</th>
                    <th style={{ padding: "var(--space-2) var(--space-3)" }}>Value</th>
                    <th style={{ padding: "var(--space-2) var(--space-3)" }}>Reason</th>
                    <th style={{ padding: "var(--space-2) var(--space-3)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((row) => (
                    <tr key={row.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "var(--space-2) var(--space-3)" }}>{row.sku ?? "—"}</td>
                      <td style={{ padding: "var(--space-2) var(--space-3)" }}>{row.marketplace_code ?? "—"}</td>
                      <td style={{ padding: "var(--space-2) var(--space-3)" }}>{formatDate(row.start_date)}</td>
                      <td style={{ padding: "var(--space-2) var(--space-3)" }}>{formatDate(row.end_date)}</td>
                      <td style={{ padding: "var(--space-2) var(--space-3)" }}>{row.override_type}</td>
                      <td style={{ padding: "var(--space-2) var(--space-3)" }}>{Number(row.value)}</td>
                      <td style={{ padding: "var(--space-2) var(--space-3)", maxWidth: 200 }}>{row.reason ?? "—"}</td>
                      <td style={{ padding: "var(--space-2) var(--space-3)" }}>
                        {deleteConfirmId === row.id ? (
                          <span style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                            <span style={{ fontSize: "var(--text-sm)" }}>Delete?</span>
                            <button
                              type="button"
                              onClick={() => handleDelete(row.id)}
                              style={{
                                padding: "var(--space-1) var(--space-2)",
                                backgroundColor: "var(--color-error)",
                                color: "white",
                                border: "none",
                                borderRadius: "var(--radius-sm)",
                                cursor: "pointer",
                                fontSize: "var(--text-xs)",
                              }}
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              style={{
                                padding: "var(--space-1) var(--space-2)",
                                border: "1px solid var(--color-border)",
                                borderRadius: "var(--radius-sm)",
                                cursor: "pointer",
                                fontSize: "var(--text-xs)",
                              }}
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingId(row.id)}
                              disabled={editingId != null}
                              style={{
                                marginRight: "var(--space-2)",
                                padding: "var(--space-1) var(--space-2)",
                                border: "1px solid var(--color-border)",
                                borderRadius: "var(--radius-sm)",
                                cursor: "pointer",
                                fontSize: "var(--text-xs)",
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(row.id)}
                              style={{
                                padding: "var(--space-1) var(--space-2)",
                                border: "1px solid var(--color-error)",
                                color: "var(--color-error)",
                                borderRadius: "var(--radius-sm)",
                                cursor: "pointer",
                                fontSize: "var(--text-xs)",
                              }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

type OverrideFormProps = {
  initial?: ForecastOverrideResponse;
  onSave: (body: ForecastOverrideCreate | ForecastOverrideUpdate) => void;
  onCancel: () => void;
  title: string;
};

function OverrideForm({ initial, onSave, onCancel, title }: OverrideFormProps) {
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [marketplaceCode, setMarketplaceCode] = useState(initial?.marketplace_code ?? "");
  const [startDate, setStartDate] = useState(
    initial?.start_date ? formatDate(initial.start_date) : ""
  );
  const [endDate, setEndDate] = useState(
    initial?.end_date ? formatDate(initial.end_date) : ""
  );
  const [overrideType, setOverrideType] = useState<"absolute" | "multiplier">(
    (initial?.override_type as "absolute" | "multiplier") ?? "multiplier"
  );
  const [value, setValue] = useState(String(initial?.value ?? "1.25"));
  const [reason, setReason] = useState(initial?.reason ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numVal = parseFloat(value);
    if (overrideType === "multiplier" && numVal <= 0) {
      return;
    }
    if (overrideType === "absolute" && numVal < 0) {
      return;
    }
    if (startDate > endDate) return;
    if (initial) {
      onSave({
        sku: sku.trim() || null,
        marketplace_code: marketplaceCode.trim() || null,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        override_type: overrideType,
        value: numVal,
        reason: reason.trim() || null,
      });
    } else {
      onSave({
        sku: sku.trim() || null,
        marketplace_code: marketplaceCode.trim() || null,
        start_date: startDate,
        end_date: endDate,
        override_type: overrideType,
        value: numVal,
        reason: reason.trim() || null,
      });
    }
  };

  const inputStyle = {
    padding: "var(--space-2) var(--space-3)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    fontSize: "var(--text-sm)",
    width: "100%",
    maxWidth: 280,
  };

  return (
    <Card>
      <div style={{ padding: "var(--space-4)" }}>
        <h3 style={{ margin: "0 0 var(--space-4)", fontSize: "var(--text-lg)" }}>{title}</h3>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", fontSize: "var(--text-sm)" }}>
            SKU (optional; blank = total)
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="e.g. SKU-001"
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", fontSize: "var(--text-sm)" }}>
            Marketplace (optional; blank = all)
            <input
              type="text"
              value={marketplaceCode}
              onChange={(e) => setMarketplaceCode(e.target.value)}
              placeholder="e.g. US"
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", fontSize: "var(--text-sm)" }}>
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", fontSize: "var(--text-sm)" }}>
            End date
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", fontSize: "var(--text-sm)" }}>
            Type
            <select
              value={overrideType}
              onChange={(e) => setOverrideType(e.target.value as "absolute" | "multiplier")}
              style={inputStyle}
            >
              {OVERRIDE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", fontSize: "var(--text-sm)" }}>
            Value {overrideType === "multiplier" ? "(> 0)" : "(≥ 0)"}
            <input
              type="number"
              step={overrideType === "multiplier" ? "0.01" : "1"}
              min={overrideType === "multiplier" ? 0.01 : 0}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", fontSize: "var(--text-sm)" }}>
            Reason (optional)
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Promotion"
              style={inputStyle}
            />
          </label>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <button
              type="submit"
              style={{
                padding: "var(--space-2) var(--space-4)",
                backgroundColor: "var(--color-primary)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-md)",
                fontWeight: "var(--font-medium)",
                cursor: "pointer",
              }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: "var(--space-2) var(--space-4)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </Card>
  );
}
