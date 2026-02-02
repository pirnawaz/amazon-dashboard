import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  getDataHealthSummary,
  getTopUnmappedSkus,
  getUnmappedTrend,
  type DataHealthSummary as DataHealthSummaryType,
  type TopUnmappedSkuRow,
  type UnmappedTrendRow,
} from "../../api";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import LoadingSkeleton from "../../components/ui/LoadingSkeleton";
import { useAuth } from "../../context/AuthContext";

function formatDate(iso: string | null): string {
  if (iso == null) return "—";
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

export default function DataHealthPage() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const marketplaceParam = searchParams.get("marketplace") ?? "";
  const [summary, setSummary] = useState<DataHealthSummaryType | null>(null);
  const [topUnmapped, setTopUnmapped] = useState<TopUnmappedSkuRow[]>([]);
  const [trend, setTrend] = useState<UnmappedTrendRow[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTop, setLoadingTop] = useState(true);
  const [loadingTrend, setLoadingTrend] = useState(true);

  const marketplaceFilter = marketplaceParam || "";

  const loadSummary = useCallback(() => {
    if (!token) return;
    setLoadingSummary(true);
    getDataHealthSummary(token, {
      marketplace_code: marketplaceFilter || undefined,
    })
      .then(setSummary)
      .finally(() => setLoadingSummary(false));
  }, [token, marketplaceFilter]);

  const loadTopUnmapped = useCallback(() => {
    if (!token) return;
    setLoadingTop(true);
    getTopUnmappedSkus(token, {
      marketplace_code: marketplaceFilter || undefined,
      limit: 20,
    })
      .then((res) => setTopUnmapped(res.items))
      .finally(() => setLoadingTop(false));
  }, [token, marketplaceFilter]);

  const loadTrend = useCallback(() => {
    if (!token) return;
    setLoadingTrend(true);
    getUnmappedTrend(token, { marketplace_code: marketplaceFilter || undefined })
      .then((res) => setTrend(res.items))
      .finally(() => setLoadingTrend(false));
  }, [token, marketplaceFilter]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);
  useEffect(() => {
    loadTopUnmapped();
  }, [loadTopUnmapped]);
  useEffect(() => {
    loadTrend();
  }, [loadTrend]);

  const setMarketplace = (value: string) => {
    if (value) {
      setSearchParams({ marketplace: value });
    } else {
      setSearchParams({});
    }
  };

  const catalogMappingLink =
    marketplaceFilter ? `/admin/catalog-mapping?marketplace=${encodeURIComponent(marketplaceFilter)}` : "/admin/catalog-mapping";

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
        Data Health
      </h2>
      <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
        Unmapped and excluded units from order data. Use Catalog Mapping to resolve SKUs.
      </p>

      <div style={{ marginBottom: "var(--space-2)" }}>
        <label style={{ marginRight: "var(--space-2)", fontSize: "var(--text-sm)" }}>Marketplace</label>
        <select
          value={marketplaceFilter}
          onChange={(e) => setMarketplace(e.target.value)}
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
      </div>

      {/* Summary cards */}
      <Card>
        <h3
          style={{
            margin: 0,
            marginBottom: "var(--space-4)",
            fontSize: "var(--text-lg)",
            fontWeight: "var(--font-medium)",
          }}
        >
          Summary (last 30 days)
        </h3>
        {loadingSummary ? (
          <div style={{ padding: "var(--space-6)" }}>
            <LoadingSkeleton />
          </div>
        ) : summary ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: "var(--space-4)",
            }}
          >
            <div
              style={{
                padding: "var(--space-4)",
                backgroundColor: "var(--color-bg-muted)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginBottom: 2 }}>
                Unmapped SKUs
              </div>
              <div style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-semibold)" }}>
                {summary.unmapped_skus_total}
              </div>
            </div>
            <div
              style={{
                padding: "var(--space-4)",
                backgroundColor: "var(--color-bg-muted)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginBottom: 2 }}>
                Unmapped units (30d)
              </div>
              <div style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-semibold)" }}>
                {summary.unmapped_units_30d}
              </div>
            </div>
            <div
              style={{
                padding: "var(--space-4)",
                backgroundColor: "var(--color-bg-muted)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginBottom: 2 }}>
                % unmapped (30d)
              </div>
              <div style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-semibold)" }}>
                {(summary.unmapped_share_30d * 100).toFixed(1)}%
              </div>
            </div>
            <div
              style={{
                padding: "var(--space-4)",
                backgroundColor: "var(--color-bg-muted)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginBottom: 2 }}>
                Ignored units (30d)
              </div>
              <div style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-semibold)" }}>
                {summary.ignored_units_30d}
              </div>
            </div>
            <div
              style={{
                padding: "var(--space-4)",
                backgroundColor: "var(--color-bg-muted)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginBottom: 2 }}>
                Discontinued units (30d)
              </div>
              <div style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-semibold)" }}>
                {summary.discontinued_units_30d}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState title="No data" description="Could not load data health summary." />
        )}
        {summary && (
          <p style={{ marginTop: "var(--space-3)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
            Window: {summary.window_start} to {summary.window_end}. Total units in window: {summary.total_units_30d}.
          </p>
        )}
      </Card>

      {/* Phase 12.4: Unmapped trend (last 12 weeks) */}
      <Card>
        <h3
          style={{
            margin: 0,
            marginBottom: "var(--space-4)",
            fontSize: "var(--text-lg)",
            fontWeight: "var(--font-medium)",
          }}
        >
          Unmapped trend (last 12 weeks)
        </h3>
        {loadingTrend ? (
          <div style={{ padding: "var(--space-6)" }}>
            <LoadingSkeleton />
          </div>
        ) : trend.length === 0 ? (
          <EmptyState
            title="No trend data"
            description="No order data in the last 12 weeks for the selected marketplace."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 400,
                fontSize: "var(--text-sm)",
              }}
              aria-label="Unmapped trend"
            >
              <thead>
                <tr style={{ borderBottom: "2px solid var(--color-border-strong)", backgroundColor: "var(--color-bg-muted)" }}>
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Week start</th>
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Total units</th>
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Unmapped units</th>
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>% unmapped</th>
                </tr>
              </thead>
              <tbody>
                {trend.map((row) => (
                  <tr key={row.week_start} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "var(--space-3) var(--space-4)" }}>{formatDate(row.week_start)}</td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>{row.total_units}</td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>{row.unmapped_units}</td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>
                      {(row.unmapped_share * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Top unmapped table */}
      <Card>
        <h3
          style={{
            margin: 0,
            marginBottom: "var(--space-4)",
            fontSize: "var(--text-lg)",
            fontWeight: "var(--font-medium)",
          }}
        >
          Top Unmapped SKUs (30d)
        </h3>
        {loadingTop ? (
          <div style={{ padding: "var(--space-6)" }}>
            <LoadingSkeleton />
          </div>
        ) : topUnmapped.length === 0 ? (
          <EmptyState
            title="No unmapped SKUs"
            description="All order SKUs in the last 30 days are mapped (confirmed/ignored/discontinued), or there is no order data."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 500,
                fontSize: "var(--text-sm)",
              }}
              aria-label="Top unmapped SKUs"
            >
              <thead>
                <tr style={{ borderBottom: "2px solid var(--color-border-strong)", backgroundColor: "var(--color-bg-muted)" }}>
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Marketplace</th>
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>SKU</th>
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>Units (30d)</th>
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Last seen</th>
                  <th style={{ padding: "var(--space-3) var(--space-4)", textAlign: "left" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {topUnmapped.map((row) => (
                  <tr key={`${row.marketplace_code}-${row.sku}`} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "var(--space-3) var(--space-4)" }}>{row.marketplace_code}</td>
                    <td style={{ padding: "var(--space-3) var(--space-4)" }}>{row.sku}</td>
                    <td style={{ padding: "var(--space-3) var(--space-4)", textAlign: "right" }}>{row.units_30d}</td>
                    <td style={{ padding: "var(--space-3) var(--space-4)" }}>{formatDate(row.last_seen_date)}</td>
                    <td style={{ padding: "var(--space-3) var(--space-4)" }}>
                      <Link
                        to={catalogMappingLink}
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--color-primary)",
                          textDecoration: "none",
                        }}
                      >
                        Map in Catalog Mapping
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}
