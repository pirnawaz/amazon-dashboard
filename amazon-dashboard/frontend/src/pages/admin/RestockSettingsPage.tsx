import { useCallback, useEffect, useState } from "react";
import {
  getRestockSettings,
  getRestockSuppliers,
  createRestockSetting,
  updateRestockSetting,
  deleteRestockSetting,
  type RestockSettingOut,
  type RestockSettingCreate,
  type RestockSettingUpdate,
  type RestockSupplierOut,
} from "../../api";
import Card from "../../components/ui/Card";
import LoadingSkeleton from "../../components/ui/LoadingSkeleton";
import EmptyState from "../../components/ui/EmptyState";
import { useToast } from "../../context/ToastContext";
import { isDemoMode } from "../../utils/preferences";

type Props = {
  token: string;
};

export default function RestockSettingsPage({ token }: Props) {
  const { showToast } = useToast();
  const [list, setList] = useState<RestockSettingOut[]>([]);
  const [suppliers, setSuppliers] = useState<RestockSupplierOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSku, setFilterSku] = useState("");
  const [filterMarketplace, setFilterMarketplace] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const load = useCallback(() => {
    if (isDemoMode()) {
      setList([
        {
          id: 1,
          sku: "DEMO-SKU-001",
          marketplace_code: "US",
          supplier_id: 1,
          lead_time_days_mean: 14,
          lead_time_days_std: 2,
          moq_units: 10,
          pack_size_units: 1,
          reorder_policy: "min_max",
          min_days_of_cover: 0,
          max_days_of_cover: 0,
          service_level: 0.95,
          holding_cost_rate: null,
          stockout_cost_per_unit: null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
      setSuppliers([{ id: 1, name: "Demo Supplier A", contact_email: null, notes: null, created_at: "", updated_at: "" }]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      getRestockSettings(token, { sku: filterSku.trim() || undefined, marketplace_code: filterMarketplace.trim() || undefined }),
      getRestockSuppliers(token),
    ])
      .then(([settings, supp]) => {
        setList(settings);
        setSuppliers(supp);
      })
      .catch(() => {
        setList([]);
        setSuppliers([]);
      })
      .finally(() => setLoading(false));
  }, [token, filterSku, filterMarketplace]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = (body: RestockSettingCreate) => {
    if (isDemoMode()) {
      showToast("Demo: settings are not persisted.", "info");
      setCreateOpen(false);
      return;
    }
    createRestockSetting(token, body)
      .then(() => {
        showToast("Setting created", "success");
        setCreateOpen(false);
        load();
      })
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : "Failed to create setting", "error")
      );
  };

  const handleDelete = (id: number) => {
    if (isDemoMode()) {
      showToast("Demo: settings are not persisted.", "info");
      setDeleteConfirmId(null);
      return;
    }
    deleteRestockSetting(token, id)
      .then(() => {
        showToast("Setting deleted", "success");
        setDeleteConfirmId(null);
        load();
      })
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : "Failed to delete setting", "error")
      );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)", flexWrap: "wrap", gap: "var(--space-4)" }}>
          <h2>SKU Supplier Settings</h2>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Filter SKU"
              value={filterSku}
              onChange={(e) => setFilterSku(e.target.value)}
              style={{ padding: "var(--space-2)", borderRadius: "var(--radius-md)", width: 120 }}
            />
            <input
              type="text"
              placeholder="Filter marketplace"
              value={filterMarketplace}
              onChange={(e) => setFilterMarketplace(e.target.value)}
              style={{ padding: "var(--space-2)", borderRadius: "var(--radius-md)", width: 100 }}
            />
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              style={{
                padding: "var(--space-2) var(--space-4)",
                backgroundColor: "var(--color-primary)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
              }}
            >
              Add setting
            </button>
          </div>
        </div>
        {loading ? (
          <LoadingSkeleton rows={5} />
        ) : list.length === 0 ? (
          <EmptyState
            title="No SKU supplier settings"
            description="Add a setting to link a SKU (and optional marketplace) to a supplier with lead time, MOQ, pack size, and service level."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                  <th style={{ padding: "var(--space-2)" }}>SKU</th>
                  <th style={{ padding: "var(--space-2)" }}>Marketplace</th>
                  <th style={{ padding: "var(--space-2)" }}>Supplier ID</th>
                  <th style={{ padding: "var(--space-2)", textAlign: "right" }}>Lead time (mean)</th>
                  <th style={{ padding: "var(--space-2)", textAlign: "right" }}>Lead time (std)</th>
                  <th style={{ padding: "var(--space-2)", textAlign: "right" }}>MOQ</th>
                  <th style={{ padding: "var(--space-2)", textAlign: "right" }}>Pack size</th>
                  <th style={{ padding: "var(--space-2)", textAlign: "right" }}>Service level</th>
                  <th style={{ padding: "var(--space-2)", width: 80 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "var(--space-2)" }}>{s.sku}</td>
                    <td style={{ padding: "var(--space-2)" }}>{s.marketplace_code ?? "global"}</td>
                    <td style={{ padding: "var(--space-2)" }}>{s.supplier_id}</td>
                    <td style={{ padding: "var(--space-2)", textAlign: "right" }}>{s.lead_time_days_mean}</td>
                    <td style={{ padding: "var(--space-2)", textAlign: "right" }}>{s.lead_time_days_std}</td>
                    <td style={{ padding: "var(--space-2)", textAlign: "right" }}>{s.moq_units}</td>
                    <td style={{ padding: "var(--space-2)", textAlign: "right" }}>{s.pack_size_units}</td>
                    <td style={{ padding: "var(--space-2)", textAlign: "right" }}>{s.service_level}</td>
                    <td style={{ padding: "var(--space-2)" }}>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(s.id)}
                        style={{ padding: "var(--space-1) var(--space-2)", color: "var(--color-error)", cursor: "pointer" }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {createOpen && (
        <CreateSettingModal
          suppliers={suppliers}
          onSave={handleCreate}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {deleteConfirmId != null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <Card style={{ maxWidth: 400 }}>
            <p>Delete this SKU supplier setting?</p>
            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                style={{ padding: "var(--space-2) var(--space-4)", backgroundColor: "var(--color-error)", color: "white", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer" }}
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                style={{ padding: "var(--space-2) var(--space-4)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function CreateSettingModal({
  suppliers,
  onSave,
  onClose,
}: {
  suppliers: RestockSupplierOut[];
  onSave: (body: RestockSettingCreate) => void;
  onClose: () => void;
}) {
  const [sku, setSku] = useState("");
  const [marketplaceCode, setMarketplaceCode] = useState("");
  const [supplierId, setSupplierId] = useState<number>(suppliers[0]?.id ?? 0);
  const [leadTimeMean, setLeadTimeMean] = useState("14");
  const [leadTimeStd, setLeadTimeStd] = useState("2");
  const [moq, setMoq] = useState("0");
  const [packSize, setPackSize] = useState("1");
  const [serviceLevel, setServiceLevel] = useState("0.95");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim()) return;
    if (!supplierId) return;
    onSave({
      sku: sku.trim(),
      marketplace_code: marketplaceCode.trim() || null,
      supplier_id: supplierId,
      lead_time_days_mean: Number(leadTimeMean) || 14,
      lead_time_days_std: Number(leadTimeStd) || 0,
      moq_units: Number(moq) || 0,
      pack_size_units: Number(packSize) || 1,
      service_level: Number(serviceLevel) || 0.95,
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <Card style={{ maxWidth: 420, width: "100%" }}>
        <h3 style={{ marginBottom: "var(--space-4)" }}>New SKU supplier setting</h3>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <label>
            <span style={{ display: "block", marginBottom: "var(--space-1)" }}>SKU *</span>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              required
              style={{ width: "100%", padding: "var(--space-2)", borderRadius: "var(--radius-md)" }}
            />
          </label>
          <label>
            <span style={{ display: "block", marginBottom: "var(--space-1)" }}>Marketplace (optional)</span>
            <input
              type="text"
              value={marketplaceCode}
              onChange={(e) => setMarketplaceCode(e.target.value)}
              placeholder="e.g. US or leave blank for global"
              style={{ width: "100%", padding: "var(--space-2)", borderRadius: "var(--radius-md)" }}
            />
          </label>
          <label>
            <span style={{ display: "block", marginBottom: "var(--space-1)" }}>Supplier *</span>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(Number(e.target.value))}
              style={{ width: "100%", padding: "var(--space-2)", borderRadius: "var(--radius-md)" }}
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <label>
              <span style={{ display: "block", marginBottom: "var(--space-1)" }}>Lead time mean (days)</span>
              <input
                type="number"
                min={1}
                max={365}
                value={leadTimeMean}
                onChange={(e) => setLeadTimeMean(e.target.value)}
                style={{ width: "100%", padding: "var(--space-2)", borderRadius: "var(--radius-md)" }}
              />
            </label>
            <label>
              <span style={{ display: "block", marginBottom: "var(--space-1)" }}>Lead time std (days)</span>
              <input
                type="number"
                min={0}
                max={90}
                value={leadTimeStd}
                onChange={(e) => setLeadTimeStd(e.target.value)}
                style={{ width: "100%", padding: "var(--space-2)", borderRadius: "var(--radius-md)" }}
              />
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <label>
              <span style={{ display: "block", marginBottom: "var(--space-1)" }}>MOQ (units)</span>
              <input
                type="number"
                min={0}
                value={moq}
                onChange={(e) => setMoq(e.target.value)}
                style={{ width: "100%", padding: "var(--space-2)", borderRadius: "var(--radius-md)" }}
              />
            </label>
            <label>
              <span style={{ display: "block", marginBottom: "var(--space-1)" }}>Pack size (units)</span>
              <input
                type="number"
                min={1}
                value={packSize}
                onChange={(e) => setPackSize(e.target.value)}
                style={{ width: "100%", padding: "var(--space-2)", borderRadius: "var(--radius-md)" }}
              />
            </label>
          </div>
          <label>
            <span style={{ display: "block", marginBottom: "var(--space-1)" }}>Service level (0.5–0.99)</span>
            <input
              type="number"
              min={0.5}
              max={0.99}
              step={0.01}
              value={serviceLevel}
              onChange={(e) => setServiceLevel(e.target.value)}
              style={{ width: "100%", padding: "var(--space-2)", borderRadius: "var(--radius-md)" }}
            />
          </label>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button type="submit" style={{ padding: "var(--space-2) var(--space-4)", backgroundColor: "var(--color-primary)", color: "white", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer" }}>
              Create
            </button>
            <button type="button" onClick={onClose} style={{ padding: "var(--space-2) var(--space-4)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
