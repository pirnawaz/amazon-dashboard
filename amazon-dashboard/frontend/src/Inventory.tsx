import { useCallback, useEffect, useState } from "react";
import {
  getInventoryList,
  upsertInventory,
  deleteInventory,
  type InventoryItemResponse,
  type InventoryListResponse,
  type InventoryUpsertRequest,
} from "./api";
import {
  getDemoInventoryList,
  upsertDemoInventory,
  deleteDemoInventory,
} from "./data/demoData";
import Card from "./components/ui/Card";
import EmptyState from "./components/ui/EmptyState";
import LoadingSkeleton from "./components/ui/LoadingSkeleton";
import Table from "./components/ui/Table";
import { isDemoMode } from "./utils/preferences";

const MARKETPLACE_OPTIONS = ["ALL", "US", "UK", "DE", "FR"] as const;

type Props = {
  token: string;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function freshnessLabel(freshnessDays: number): string {
  if (freshnessDays === 0) return "0d";
  if (freshnessDays === 1) return "1d";
  return `${freshnessDays}d`;
}

export default function Inventory({ token }: Props) {
  const [marketplace, setMarketplace] = useState<string>("");
  const [q, setQ] = useState("");
  const [data, setData] = useState<InventoryListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItemResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formSku, setFormSku] = useState("");
  const [formMarketplace, setFormMarketplace] = useState("US");
  const [formOnHand, setFormOnHand] = useState("");
  const [formReserved, setFormReserved] = useState("");
  const [formNote, setFormNote] = useState("");

  const loadList = useCallback(() => {
    setError(null);
    setLoading(true);
    const params = {
      marketplace: marketplace || undefined,
      q: q.trim() || undefined,
      limit: 200,
    };
    if (isDemoMode()) {
      setData(getDemoInventoryList(params));
      setLoading(false);
      return;
    }
    getInventoryList(token, { marketplace: params.marketplace ?? "", q: params.q })
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load inventory")
      )
      .finally(() => setLoading(false));
  }, [token, marketplace, q]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openAdd = () => {
    setEditing(null);
    setFormSku("");
    setFormMarketplace("US");
    setFormOnHand("");
    setFormReserved("0");
    setFormNote("");
    setSaveError(null);
    setModalOpen(true);
  };

  const openEdit = (row: InventoryItemResponse) => {
    setEditing(row);
    setFormSku(row.sku);
    setFormMarketplace(row.marketplace);
    setFormOnHand(String(row.on_hand_units));
    setFormReserved(String(row.reserved_units));
    setFormNote(row.note ?? "");
    setSaveError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setSaveError(null);
  };

  const handleSave = async () => {
    const onHand = parseFloat(formOnHand);
    const reserved = parseFloat(formReserved);
    if (Number.isNaN(onHand) || onHand < 0) {
      setSaveError("On hand units must be a non-negative number.");
      return;
    }
    if (Number.isNaN(reserved) || reserved < 0) {
      setSaveError("Reserved units must be a non-negative number.");
      return;
    }
    if (!formSku.trim()) {
      setSaveError("SKU is required.");
      return;
    }
    if (!formMarketplace.trim()) {
      setSaveError("Marketplace is required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const payload: InventoryUpsertRequest = {
      sku: formSku.trim(),
      marketplace: formMarketplace.trim(),
      on_hand_units: onHand,
      reserved_units: reserved,
      source: "manual",
      note: formNote.trim() || null,
    };
    try {
      if (isDemoMode()) {
        upsertDemoInventory(payload);
      } else {
        await upsertInventory(token, payload);
      }
      closeModal();
      loadList();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: InventoryItemResponse) => {
    if (!window.confirm(`Delete inventory for ${row.sku} (${row.marketplace})?`)) return;
    try {
      if (isDemoMode()) {
        deleteDemoInventory(row.marketplace, row.sku);
      } else {
        await deleteInventory(token, row.marketplace, row.sku);
      }
      loadList();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const items = data?.items ?? [];

  if (error) {
    return (
      <Card>
        <EmptyState
          title="Something went wrong"
          description={error}
          action={
            <button
              type="button"
              onClick={loadList}
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
              Try again
            </button>
          }
        />
      </Card>
    );
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {isDemoMode() && (
        <div
          style={{
            padding: "var(--space-2) var(--space-4)",
            backgroundColor: "var(--color-warning-muted)",
            color: "var(--color-warning)",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--text-sm)",
            fontWeight: "var(--font-medium)",
          }}
        >
          Demo data — sample inventory. Clear in Settings to use real data.
        </div>
      )}

      <div>
        <h1 style={{ margin: 0, fontSize: "var(--text-2xl)", fontWeight: "var(--font-bold)" }}>
          Inventory
        </h1>
        <p style={{ margin: "var(--space-1) 0 0", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
          Stale = not updated in 7+ days.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-4)",
          alignItems: "center",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
          Marketplace
          <select
            value={marketplace}
            onChange={(e) => setMarketplace(e.target.value)}
            style={{
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-bg-elevated)",
              fontSize: "var(--text-sm)",
            }}
          >
            <option value="">All</option>
            {MARKETPLACE_OPTIONS.filter((m) => m !== "ALL").map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
          Search SKU
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Substring..."
            style={{
              padding: "var(--space-2) var(--space-3)",
              width: 160,
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--text-sm)",
            }}
          />
        </label>
        <button
          type="button"
          onClick={openAdd}
          style={{
            padding: "var(--space-2) var(--space-4)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--color-primary)",
            color: "white",
            fontSize: "var(--text-sm)",
            fontWeight: "var(--font-medium)",
            cursor: "pointer",
          }}
        >
          Add / Update
        </button>
      </div>

      <Card>
        {loading ? (
          <div style={{ padding: "var(--space-6)" }}>
            <LoadingSkeleton count={5} />
          </div>
        ) : (
          <Table<InventoryItemResponse>
            getRowKey={(row) => `${row.marketplace}-${row.sku}`}
            data={items}
            emptyTitle="No inventory"
            emptyDescription="Add inventory levels with the Add / Update button."
            columns={[
              { key: "sku", header: "SKU" },
              { key: "marketplace", header: "Marketplace" },
              {
                key: "on_hand_units",
                header: "On hand",
                align: "right",
                render: (row) => (
                  <span title={row.source ? `Source: ${row.source}` : undefined}>
                    {row.on_hand_units.toLocaleString()}
                  </span>
                ),
              },
              {
                key: "reserved_units",
                header: "Reserved",
                align: "right",
                render: (row) => row.reserved_units.toLocaleString(),
              },
              {
                key: "available_units",
                header: "Available",
                align: "right",
                render: (row) => row.available_units.toLocaleString(),
              },
              {
                key: "updated_at",
                header: "Updated",
                render: (row) => formatDate(row.updated_at),
              },
              {
                key: "freshness_days",
                header: "Freshness",
                render: (row) => freshnessLabel(row.freshness_days),
              },
              {
                key: "is_stale",
                header: "Status",
                render: (row) => (
                  <span
                    style={{
                      padding: "var(--space-1) var(--space-2)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "var(--text-xs)",
                      fontWeight: "var(--font-medium)",
                      backgroundColor: row.is_stale ? "var(--color-warning-muted)" : "var(--color-success-muted)",
                      color: row.is_stale ? "var(--color-warning)" : "var(--color-success)",
                    }}
                  >
                    {row.is_stale ? "Stale" : "Fresh"}
                  </span>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                render: (row) => (
                  <div style={{ display: "flex", gap: "var(--space-2)" }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(row);
                      }}
                      style={{
                        padding: "var(--space-1) var(--space-2)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-sm)",
                        backgroundColor: "var(--color-bg-elevated)",
                        fontSize: "var(--text-xs)",
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(row);
                      }}
                      style={{
                        padding: "var(--space-1) var(--space-2)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-sm)",
                        backgroundColor: "var(--color-error-muted)",
                        color: "var(--color-error)",
                        fontSize: "var(--text-xs)",
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="inventory-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div
            style={{
              minWidth: 360,
              maxWidth: "90vw",
            }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <Card>
            <div style={{ padding: "var(--space-4) var(--space-6)", borderBottom: "1px solid var(--color-border)" }}>
              <h2 id="inventory-modal-title" style={{ margin: 0, fontSize: "var(--text-lg)" }}>
                {editing ? "Edit inventory" : "Add / Update inventory"}
              </h2>
            </div>
            <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <label>
                SKU
                <input
                  type="text"
                  value={formSku}
                  onChange={(e) => setFormSku(e.target.value)}
                  disabled={!!editing}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: "var(--space-1)",
                    padding: "var(--space-2) var(--space-3)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--text-sm)",
                  }}
                />
              </label>
              <label>
                Marketplace
                <select
                  value={formMarketplace}
                  onChange={(e) => setFormMarketplace(e.target.value)}
                  disabled={!!editing}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: "var(--space-1)",
                    padding: "var(--space-2) var(--space-3)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  {MARKETPLACE_OPTIONS.filter((m) => m !== "ALL").map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                On hand units
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={formOnHand}
                  onChange={(e) => setFormOnHand(e.target.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: "var(--space-1)",
                    padding: "var(--space-2) var(--space-3)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--text-sm)",
                  }}
                />
              </label>
              <label>
                Reserved units
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={formReserved}
                  onChange={(e) => setFormReserved(e.target.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: "var(--space-1)",
                    padding: "var(--space-2) var(--space-3)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--text-sm)",
                  }}
                />
              </label>
              <label>
                Note (optional)
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: "var(--space-1)",
                    padding: "var(--space-2) var(--space-3)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--text-sm)",
                  }}
                />
              </label>
              {saveError && (
                <p style={{ margin: 0, color: "var(--color-error)", fontSize: "var(--text-sm)" }}>
                  {saveError}
                </p>
              )}
            </div>
            <div
              style={{
                padding: "var(--space-4) var(--space-6)",
                borderTop: "1px solid var(--color-border)",
                display: "flex",
                justifyContent: "flex-end",
                gap: "var(--space-2)",
              }}
            >
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-bg-elevated)",
                  fontSize: "var(--text-sm)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-primary)",
                  color: "white",
                  fontSize: "var(--text-sm)",
                  fontWeight: "var(--font-medium)",
                  cursor: "pointer",
                }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
            </Card>
          </div>
        </div>
      )}
    </section>
  );
}
