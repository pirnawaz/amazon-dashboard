import { useCallback, useEffect, useRef, useState } from "react";
import {
  createOrUpdateSkuMapping,
  exportSkuMappingsCsv,
  getSkuMappings,
  getUnmappedSkus,
  getUnmappedSuggestions,
  importSkuMappingsCsv,
  patchSkuMapping,
  searchProducts,
  type ProductSearchHit,
  type SkuMappingOut,
  type SkuMappingImportResponse,
  type UnmappedSkuRow,
  type UnmappedSkuWithSuggestion,
} from "../../api";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import LoadingSkeleton from "../../components/ui/LoadingSkeleton";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const STATUS_OPTIONS = ["pending", "confirmed", "ignored", "discontinued"] as const;
const DEFAULT_LIMIT = 100;
const PRODUCT_SEARCH_LIMIT = 30;

function formatDate(iso: string | null): string {
  if (iso == null) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 16);
  }
}

type EditingUnmapped = {
  sku: string;
  marketplace_code: string;
  product_id: number | null;
  productSearch: string;
  productHits: ProductSearchHit[];
  productSearching: boolean;
  asin: string;
  fnsku: string;
  status: string;
  saving: boolean;
};

export default function CatalogMappingPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [unmapped, setUnmapped] = useState<UnmappedSkuRow[]>([]);
  const [unmappedTotal, setUnmappedTotal] = useState(0);
  const [mappings, setMappings] = useState<SkuMappingOut[]>([]);
  const [mappingsTotal, setMappingsTotal] = useState(0);
  const [loadingUnmapped, setLoadingUnmapped] = useState(true);
  const [loadingMappings, setLoadingMappings] = useState(true);
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>("");
  const [mappingStatusFilter, setMappingStatusFilter] = useState<string>("");
  const [editing, setEditing] = useState<EditingUnmapped | null>(null);
  const [editingMappingId, setEditingMappingId] = useState<number | null>(null);
  const [mappingPatch, setMappingPatch] = useState<Partial<SkuMappingOut>>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [unmappedWithSuggestions, setUnmappedWithSuggestions] = useState<UnmappedSkuWithSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [applyingSuggestion, setApplyingSuggestion] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDryRun, setImportDryRun] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<SkuMappingImportResponse | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadUnmapped = useCallback(() => {
    if (!token) return;
    setLoadingUnmapped(true);
    getUnmappedSkus(token, {
      marketplace_code: marketplaceFilter || undefined,
      limit: DEFAULT_LIMIT,
      offset: 0,
    })
      .then((res) => {
        setUnmapped(res.items);
        setUnmappedTotal(res.total);
      })
      .catch(() => showToast("Failed to load unmapped SKUs", "error"))
      .finally(() => setLoadingUnmapped(false));
  }, [token, marketplaceFilter, showToast]);

  const loadMappings = useCallback(() => {
    if (!token) return;
    setLoadingMappings(true);
    getSkuMappings(token, {
      marketplace_code: marketplaceFilter || undefined,
      status: mappingStatusFilter || undefined,
      limit: DEFAULT_LIMIT,
      offset: 0,
    })
      .then((res) => {
        setMappings(res.items);
        setMappingsTotal(res.total);
      })
      .catch(() => showToast("Failed to load mappings", "error"))
      .finally(() => setLoadingMappings(false));
  }, [token, marketplaceFilter, mappingStatusFilter, showToast]);

  const loadUnmappedSuggestions = useCallback(() => {
    if (!token) return;
    setLoadingSuggestions(true);
    getUnmappedSuggestions(token, {
      marketplace_code: marketplaceFilter || undefined,
      limit: DEFAULT_LIMIT,
      offset: 0,
    })
      .then((res) => setUnmappedWithSuggestions(res.items))
      .catch(() => showToast("Failed to load suggestions", "error"))
      .finally(() => setLoadingSuggestions(false));
  }, [token, marketplaceFilter, showToast]);

  useEffect(() => {
    loadUnmapped();
  }, [loadUnmapped]);
  useEffect(() => {
    if (showSuggestions) loadUnmappedSuggestions();
    else setUnmappedWithSuggestions([]);
  }, [showSuggestions, loadUnmappedSuggestions]);

  const handleExportCsv = () => {
    if (!token) return;
    setExporting(true);
    exportSkuMappingsCsv(token, {
      marketplace_code: marketplaceFilter || undefined,
      status: mappingStatusFilter || undefined,
      include_headers: true,
    })
      .then(() => showToast("CSV downloaded", "success"))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Export failed";
        const isTooMany = /too many rows|filter by marketplace/i.test(msg);
        showToast(isTooMany ? "Too many rows to export. Filter by marketplace/status and try again." : msg, "error");
      })
      .finally(() => setExporting(false));
  };

  const handleImportCsv = () => {
    if (!token || !importFile) {
      showToast("Select a CSV file", "error");
      return;
    }
    setImporting(true);
    setImportResult(null);
    importSkuMappingsCsv(token, importFile, importDryRun)
      .then((res) => {
        setImportResult(res);
        if (!importDryRun && (res.created > 0 || res.updated > 0)) {
          loadUnmapped();
          loadMappings();
          window.dispatchEvent(new CustomEvent("catalog-mapping-updated"));
          showToast(`Imported: ${res.created} created, ${res.updated} updated`, "success");
        } else if (importDryRun) {
          showToast(`Dry run: ${res.created} would create, ${res.updated} would update, ${res.errors.length} errors`, "success");
        }
      })
      .catch((err) => showToast(err instanceof Error ? err.message : "Import failed", "error"))
      .finally(() => setImporting(false));
  };

  const applySuggestion = (row: UnmappedSkuWithSuggestion) => {
    if (!token || !row.suggested_product) return;
    const key = `${row.sku}-${row.marketplace_code}`;
    setApplyingSuggestion(key);
    createOrUpdateSkuMapping(token, {
      sku: row.sku,
      marketplace_code: row.marketplace_code,
      product_id: row.suggested_product.id,
      status: "confirmed",
    })
      .then(() => {
        showToast("Mapping applied", "success");
        loadUnmapped();
        loadUnmappedSuggestions();
        loadMappings();
        window.dispatchEvent(new CustomEvent("catalog-mapping-updated"));
      })
      .catch((err) => showToast(err instanceof Error ? err.message : "Apply failed", "error"))
      .finally(() => setApplyingSuggestion(null));
  };

  useEffect(() => {
    loadUnmapped();
  }, [loadUnmapped]);
  useEffect(() => {
    loadMappings();
  }, [loadMappings]);

  const startEditing = (row: UnmappedSkuRow) => {
    setEditing({
      sku: row.sku,
      marketplace_code: row.marketplace_code,
      product_id: null,
      productSearch: "",
      productHits: [],
      productSearching: false,
      asin: row.suggested_asin ?? "",
      fnsku: "",
      status: "confirmed",
      saving: false,
    });
  };

  const productSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onProductSearchChange = useCallback(
    (q: string) => {
      if (productSearchTimeoutRef.current) clearTimeout(productSearchTimeoutRef.current);
      setEditing((e) => (e ? { ...e, productSearch: q, productSearching: !!q.trim() } : null));
      if (!q.trim()) {
        setEditing((e) => (e ? { ...e, productHits: [], productSearching: false } : null));
        return;
      }
      productSearchTimeoutRef.current = setTimeout(() => {
        searchProducts(token!, q, PRODUCT_SEARCH_LIMIT)
          .then((res) => {
            setEditing((e) => (e ? { ...e, productHits: res.items, productSearching: false } : null));
          })
          .catch(() => {
            setEditing((e) => (e ? { ...e, productHits: [], productSearching: false } : null));
          });
      }, 300);
    },
    [token]
  );

  const saveUnmappedMapping = () => {
    if (!token || !editing) return;
    setEditing((e) => (e ? { ...e, saving: true } : null));
    createOrUpdateSkuMapping(token, {
      sku: editing.sku,
      marketplace_code: editing.marketplace_code,
      asin: editing.asin || null,
      fnsku: editing.fnsku || null,
      product_id: editing.product_id,
      status: editing.status,
    })
      .then(() => {
        showToast("Mapping saved", "success");
        setEditing(null);
        loadUnmapped();
        loadMappings();
        window.dispatchEvent(new CustomEvent("catalog-mapping-updated"));
      })
      .catch((err) => showToast(err instanceof Error ? err.message : "Save failed", "error"))
      .finally(() => setEditing((e) => (e ? { ...e, saving: false } : null)));
  };

  const saveMappingPatch = () => {
    if (!token || editingMappingId == null) return;
    patchSkuMapping(token, editingMappingId, mappingPatch)
      .then(() => {
        showToast("Mapping updated", "success");
        setEditingMappingId(null);
        setMappingPatch({});
        loadMappings();
        loadUnmapped();
        window.dispatchEvent(new CustomEvent("catalog-mapping-updated"));
      })
      .catch((err) => showToast(err instanceof Error ? err.message : "Update failed", "error"));
  };

  if (!token) return null;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <h2
        style={{
          margin: 0,
          fontSize: "var(--text-2xl)",
          fontWeight: "var(--font-semibold)",
          color: "var(--color-text)",
        }}
      >
        Catalog Mapping
      </h2>
      <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
        Map SKUs from orders and inventory to internal products. Unmapped SKUs are those without a confirmed, ignored, or discontinued mapping.
      </p>

      {/* Phase 12.4: CSV Export / Import */}
      <Card>
        <h3 style={{ margin: "0 0 var(--space-4)", fontSize: "var(--text-lg)", fontWeight: "var(--font-medium)" }}>
          Bulk CSV
        </h3>
        <p style={{ margin: "0 0 var(--space-3)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
          Blank cells do not overwrite existing values. Use <code style={{ fontFamily: "monospace", fontSize: "var(--text-xs)" }}>__NULL__</code> to clear a value.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", alignItems: "flex-end", marginBottom: "var(--space-3)" }}>
          <div>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!token || exporting}
              style={{
                padding: "var(--space-2) var(--space-4)",
                fontSize: "var(--text-sm)",
                backgroundColor: "var(--color-primary)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-md)",
                cursor: token && !exporting ? "pointer" : "not-allowed",
              }}
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
            <span style={{ marginLeft: "var(--space-2)", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
              Uses current marketplace/status filters
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                setImportFile(e.target.files?.[0] ?? null);
                setImportResult(null);
              }}
              style={{ fontSize: "var(--text-sm)" }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", fontSize: "var(--text-sm)" }}>
              <input
                type="checkbox"
                checked={importDryRun}
                onChange={(e) => setImportDryRun(e.target.checked)}
              />
              Dry run
            </label>
            <button
              type="button"
              onClick={handleImportCsv}
              disabled={!token || !importFile || importing}
              style={{
                padding: "var(--space-2) var(--space-4)",
                fontSize: "var(--text-sm)",
                backgroundColor: "var(--color-bg-muted)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                cursor: token && importFile && !importing ? "pointer" : "not-allowed",
              }}
            >
              {importing ? "Importing…" : "Import"}
            </button>
          </div>
        </div>
        {importResult && (
          <div style={{ marginTop: "var(--space-3)", padding: "var(--space-3)", backgroundColor: "var(--color-bg-muted)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)" }}>
            <p style={{ margin: "0 0 var(--space-2)" }}>
              Total rows: {importResult.total_rows} · Created: {importResult.created} · Updated: {importResult.updated}
              {importResult.dry_run && " (dry run)"}
            </p>
            {importResult.errors.length > 0 && (
              <ul style={{ margin: "var(--space-2) 0 0", paddingLeft: "var(--space-6)" }}>
                {importResult.errors.slice(0, 20).map((err, i) => (
                  <li key={i}>
                    Row {err.row_number}: {err.error}
                    {err.sku != null && ` (sku=${err.sku})`}
                  </li>
                ))}
                {importResult.errors.length > 20 && (
                  <li>… and {importResult.errors.length - 20} more</li>
                )}
              </ul>
            )}
          </div>
        )}
      </Card>

      {/* Section A: Unmapped SKUs */}
      <Card>
        <h3
          style={{
            margin: 0,
            marginBottom: "var(--space-4)",
            fontSize: "var(--text-lg)",
            fontWeight: "var(--font-medium)",
          }}
        >
          Unmapped SKUs
        </h3>
        <div style={{ marginBottom: "var(--space-3)", display: "flex", flexWrap: "wrap", gap: "var(--space-4)", alignItems: "center" }}>
          <label style={{ marginRight: "var(--space-2)", fontSize: "var(--text-sm)" }}>Marketplace</label>
          <select
            value={marketplaceFilter}
            onChange={(e) => setMarketplaceFilter(e.target.value)}
            style={{
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--text-sm)",
            }}
          >
            <option value="">All</option>
            <option value="US">US</option>
            <option value="UK">UK</option>
            <option value="DE">DE</option>
            <option value="ATVPDKIKX0DER">ATVPDKIKX0DER</option>
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", marginLeft: "var(--space-4)" }}>
            <input
              type="checkbox"
              checked={showSuggestions}
              onChange={(e) => setShowSuggestions(e.target.checked)}
            />
            Show suggestions
          </label>
          {showSuggestions && loadingSuggestions && (
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>Loading suggestions…</span>
          )}
        </div>
        {(showSuggestions ? loadingSuggestions : loadingUnmapped) ? (
          <div style={{ padding: "var(--space-6)" }}>
            <LoadingSkeleton />
          </div>
        ) : (showSuggestions ? unmappedWithSuggestions : unmapped).length === 0 ? (
          <EmptyState
            title="No unmapped SKUs"
            description={showSuggestions ? "No suggestions to show, or enable suggestions after loading." : "All SKUs from orders and inventory are mapped, or there is no data yet."}
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 800,
                fontSize: "var(--text-sm)",
              }}
              aria-label="Unmapped SKUs"
            >
              <thead>
                <tr style={{ borderBottom: "2px solid var(--color-border-strong)", backgroundColor: "var(--color-bg-muted)" }}>
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Marketplace</th>
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>SKU</th>
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Orders</th>
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Inventory</th>
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Orders count</th>
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Inv count</th>
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Last seen</th>
                  {showSuggestions && (
                    <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Suggested product</th>
                  )}
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(showSuggestions ? unmappedWithSuggestions : unmapped).map((row) => {
                  const isEditing = editing?.sku === row.sku && editing?.marketplace_code === row.marketplace_code;
                  const rowWithSuggestion = showSuggestions ? (row as UnmappedSkuWithSuggestion) : null;
                  return (
                    <tr key={`${row.sku}-${row.marketplace_code}`} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "var(--space-3) var(--space-4)" }}>{row.marketplace_code}</td>
                      <td style={{ padding: "var(--space-3) var(--space-4)" }}>{row.sku}</td>
                      <td style={{ padding: "var(--space-3) var(--space-4)" }}>{row.seen_in_orders ? "Y" : "N"}</td>
                      <td style={{ padding: "var(--space-3) var(--space-4)" }}>{row.seen_in_inventory ? "Y" : "N"}</td>
                      <td style={{ padding: "var(--space-3) var(--space-4)" }}>{row.order_item_count}</td>
                      <td style={{ padding: "var(--space-3) var(--space-4)" }}>{row.inventory_row_count}</td>
                      <td style={{ padding: "var(--space-3) var(--space-4)" }}>{formatDate(row.last_seen_date)}</td>
                      {showSuggestions && (
                        <td style={{ padding: "var(--space-3) var(--space-4)" }}>
                          {rowWithSuggestion?.suggested_product ? (
                            <span style={{ fontSize: "var(--text-xs)" }}>
                              {rowWithSuggestion.suggested_product.title?.slice(0, 40)}
                              {rowWithSuggestion.suggestion_reason && (
                                <span style={{ color: "var(--color-text-muted)", marginLeft: 4 }}>
                                  ({rowWithSuggestion.suggestion_reason})
                                </span>
                              )}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      )}
                      <td style={{ padding: "var(--space-3) var(--space-4)" }}>
                        {rowWithSuggestion?.suggested_product && (
                          <button
                            type="button"
                            onClick={() => applySuggestion(rowWithSuggestion)}
                            disabled={applyingSuggestion === `${row.sku}-${row.marketplace_code}`}
                            style={{
                              padding: "var(--space-1) var(--space-3)",
                              fontSize: "var(--text-xs)",
                              marginRight: "var(--space-2)",
                              backgroundColor: "var(--color-primary)",
                              color: "white",
                              border: "none",
                              borderRadius: "var(--radius-sm)",
                              cursor: applyingSuggestion === `${row.sku}-${row.marketplace_code}` ? "not-allowed" : "pointer",
                            }}
                          >
                            {applyingSuggestion === `${row.sku}-${row.marketplace_code}` ? "Applying…" : "Apply suggestion"}
                          </button>
                        )}
                        {!isEditing ? (
                          <button
                            type="button"
                            onClick={() => startEditing(row)}
                            style={{
                              padding: "var(--space-1) var(--space-3)",
                              fontSize: "var(--text-xs)",
                              backgroundColor: "var(--color-primary)",
                              color: "white",
                              border: "none",
                              borderRadius: "var(--radius-sm)",
                              cursor: "pointer",
                            }}
                          >
                            Map
                          </button>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", minWidth: 280 }}>
                            <div>
                              <label style={{ fontSize: "var(--text-xs)", display: "block", marginBottom: 2 }}>Product</label>
                              <input
                                type="text"
                                value={editing.productSearch}
                                onChange={(e) => onProductSearchChange(e.target.value)}
                                placeholder="Search by title or SKU"
                                style={{
                                  width: "100%",
                                  padding: "var(--space-2)",
                                  border: "1px solid var(--color-border)",
                                  borderRadius: "var(--radius-sm)",
                                  fontSize: "var(--text-sm)",
                                }}
                              />
                              {editing.productSearching && <span style={{ fontSize: "var(--text-xs)" }}>Searching…</span>}
                              {editing.productHits.length > 0 && (
                                <ul
                                  style={{
                                    margin: "var(--space-1) 0 0",
                                    padding: "var(--space-2)",
                                    listStyle: "none",
                                    border: "1px solid var(--color-border)",
                                    borderRadius: "var(--radius-sm)",
                                    maxHeight: 120,
                                    overflowY: "auto",
                                    backgroundColor: "var(--color-bg-elevated)",
                                  }}
                                >
                                  {editing.productHits.map((p) => (
                                    <li key={p.id}>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEditing((e) =>
                                            e ? { ...e, product_id: p.id, productSearch: p.title, productHits: [] } : null
                                          )
                                        }
                                        style={{
                                          display: "block",
                                          width: "100%",
                                          textAlign: "left",
                                          padding: "var(--space-1) 0",
                                          fontSize: "var(--text-sm)",
                                          background: "none",
                                          border: "none",
                                          cursor: "pointer",
                                          color: "var(--color-text)",
                                        }}
                                      >
                                        {p.title} {p.sku ? `(${p.sku})` : ""}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div>
                              <label style={{ fontSize: "var(--text-xs)", display: "block", marginBottom: 2 }}>ASIN</label>
                              <input
                                type="text"
                                value={editing.asin}
                                onChange={(e) => setEditing((x) => (x ? { ...x, asin: e.target.value } : null))}
                                style={{
                                  width: "100%",
                                  padding: "var(--space-2)",
                                  border: "1px solid var(--color-border)",
                                  borderRadius: "var(--radius-sm)",
                                  fontSize: "var(--text-sm)",
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: "var(--text-xs)", display: "block", marginBottom: 2 }}>FNSKU</label>
                              <input
                                type="text"
                                value={editing.fnsku}
                                onChange={(e) => setEditing((x) => (x ? { ...x, fnsku: e.target.value } : null))}
                                style={{
                                  width: "100%",
                                  padding: "var(--space-2)",
                                  border: "1px solid var(--color-border)",
                                  borderRadius: "var(--radius-sm)",
                                  fontSize: "var(--text-sm)",
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: "var(--text-xs)", display: "block", marginBottom: 2 }}>Status</label>
                              <select
                                value={editing.status}
                                onChange={(e) => setEditing((x) => (x ? { ...x, status: e.target.value } : null))}
                                style={{
                                  width: "100%",
                                  padding: "var(--space-2)",
                                  border: "1px solid var(--color-border)",
                                  borderRadius: "var(--radius-sm)",
                                  fontSize: "var(--text-sm)",
                                }}
                              >
                                {STATUS_OPTIONS.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div style={{ display: "flex", gap: "var(--space-2)" }}>
                              <button
                                type="button"
                                onClick={saveUnmappedMapping}
                                disabled={editing.saving}
                                style={{
                                  padding: "var(--space-2) var(--space-4)",
                                  fontSize: "var(--text-sm)",
                                  backgroundColor: "var(--color-primary)",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "var(--radius-md)",
                                  cursor: editing.saving ? "not-allowed" : "pointer",
                                }}
                              >
                                {editing.saving ? "Saving…" : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditing(null)}
                                style={{
                                  padding: "var(--space-2) var(--space-4)",
                                  fontSize: "var(--text-sm)",
                                  backgroundColor: "var(--color-bg-muted)",
                                  border: "1px solid var(--color-border)",
                                  borderRadius: "var(--radius-md)",
                                  cursor: "pointer",
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {unmappedTotal > 0 && (
          <p style={{ marginTop: "var(--space-3)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
            Total unmapped: {unmappedTotal}
          </p>
        )}
      </Card>

      {/* Section B: Existing Mappings */}
      <Card>
        <h3
          style={{
            margin: 0,
            marginBottom: "var(--space-4)",
            fontSize: "var(--text-lg)",
            fontWeight: "var(--font-medium)",
          }}
        >
          Existing Mappings
        </h3>
        <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-3)", flexWrap: "wrap" }}>
          <div>
            <label style={{ marginRight: "var(--space-2)", fontSize: "var(--text-sm)" }}>Marketplace</label>
            <select
              value={marketplaceFilter}
              onChange={(e) => setMarketplaceFilter(e.target.value)}
              style={{
                padding: "var(--space-2) var(--space-3)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-sm)",
              }}
            >
              <option value="">All</option>
              <option value="US">US</option>
              <option value="UK">UK</option>
              <option value="DE">DE</option>
            </select>
          </div>
          <div>
            <label style={{ marginRight: "var(--space-2)", fontSize: "var(--text-sm)" }}>Status</label>
            <select
              value={mappingStatusFilter}
              onChange={(e) => setMappingStatusFilter(e.target.value)}
              style={{
                padding: "var(--space-2) var(--space-3)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-sm)",
              }}
            >
              <option value="">All</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        {loadingMappings ? (
          <div style={{ padding: "var(--space-6)" }}>
            <LoadingSkeleton />
          </div>
        ) : mappings.length === 0 ? (
          <EmptyState
            title="No mappings"
            description="Create mappings from the Unmapped SKUs table above."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 700,
                fontSize: "var(--text-sm)",
              }}
              aria-label="SKU mappings"
            >
              <thead>
                <tr style={{ borderBottom: "2px solid var(--color-border-strong)", backgroundColor: "var(--color-bg-muted)" }}>
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>SKU</th>
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Marketplace</th>
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Status</th>
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Product ID</th>
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>ASIN</th>
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Updated</th>
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => {
                  const isEditing = editingMappingId === m.id;
                  return (
                    <tr key={m.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "var(--space-3) var(--space-4)" }}>{m.sku}</td>
                      <td style={{ padding: "var(--space-3) var(--space-4)" }}>{m.marketplace_code}</td>
                      <td style={{ padding: "var(--space-3) var(--space-4)" }}>
                        {isEditing ? (
                          <select
                            value={mappingPatch.status ?? m.status}
                            onChange={(e) => setMappingPatch((p) => ({ ...p, status: e.target.value }))}
                            style={{ padding: "var(--space-1)", fontSize: "var(--text-sm)" }}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        ) : (
                          m.status
                        )}
                      </td>
                      <td style={{ padding: "var(--space-3) var(--space-4)" }}>{m.product_id ?? "—"}</td>
                      <td style={{ padding: "var(--space-3) var(--space-4)" }}>{m.asin ?? "—"}</td>
                      <td style={{ padding: "var(--space-3) var(--space-4)" }}>{formatDate(m.updated_at)}</td>
                      <td style={{ padding: "var(--space-3) var(--space-4)" }}>
                        {!isEditing ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMappingId(m.id);
                              setMappingPatch({});
                            }}
                            style={{
                              padding: "var(--space-1) var(--space-3)",
                              fontSize: "var(--text-xs)",
                              backgroundColor: "var(--color-bg-muted)",
                              border: "1px solid var(--color-border)",
                              borderRadius: "var(--radius-sm)",
                              cursor: "pointer",
                            }}
                          >
                            Edit
                          </button>
                        ) : (
                          <div style={{ display: "flex", gap: "var(--space-2)" }}>
                            <button
                              type="button"
                              onClick={saveMappingPatch}
                              style={{
                                padding: "var(--space-1) var(--space-3)",
                                fontSize: "var(--text-xs)",
                                backgroundColor: "var(--color-primary)",
                                color: "white",
                                border: "none",
                                borderRadius: "var(--radius-sm)",
                                cursor: "pointer",
                              }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMappingId(null);
                                setMappingPatch({});
                              }}
                              style={{
                                padding: "var(--space-1) var(--space-3)",
                                fontSize: "var(--text-xs)",
                                backgroundColor: "var(--color-bg-muted)",
                                border: "1px solid var(--color-border)",
                                borderRadius: "var(--radius-sm)",
                                cursor: "pointer",
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {mappingsTotal > 0 && (
          <p style={{ marginTop: "var(--space-3)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
            Total mappings: {mappingsTotal}
          </p>
        )}
      </Card>
    </section>
  );
}
