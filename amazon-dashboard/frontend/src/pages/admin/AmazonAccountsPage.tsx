import { useCallback, useEffect, useState } from "react";
import {
  listAmazonAccounts,
  createAmazonAccount,
  updateAmazonAccount,
  deleteAmazonAccount,
  type AmazonAccountResponse,
  type AmazonAccountCreate,
  type AmazonAccountUpdate,
} from "../../api";
import Card from "../../components/ui/Card";
import LoadingSkeleton from "../../components/ui/LoadingSkeleton";
import EmptyState from "../../components/ui/EmptyState";
import { useToast } from "../../context/ToastContext";
import { isDemoMode } from "../../utils/preferences";

type Props = {
  token: string;
};

export default function AmazonAccountsPage({ token }: Props) {
  const { showToast } = useToast();
  const [list, setList] = useState<AmazonAccountResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const load = useCallback(() => {
    if (isDemoMode()) {
      setList([
        {
          id: 1,
          name: "Default",
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
      setLoading(false);
      return;
    }
    setLoading(true);
    listAmazonAccounts(token, { include_inactive: includeInactive })
      .then(setList)
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [token, includeInactive]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = (body: AmazonAccountCreate) => {
    if (isDemoMode()) {
      showToast("Demo: Amazon accounts are not persisted.", "info");
      setCreateOpen(false);
      return;
    }
    createAmazonAccount(token, body)
      .then(() => {
        showToast("Amazon account created", "success");
        setCreateOpen(false);
        load();
      })
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : "Failed to create account", "error")
      );
  };

  const handleUpdate = (id: number, body: AmazonAccountUpdate) => {
    if (isDemoMode()) {
      showToast("Demo: Amazon accounts are not persisted.", "info");
      setEditingId(null);
      return;
    }
    updateAmazonAccount(token, id, body)
      .then(() => {
        showToast("Amazon account updated", "success");
        setEditingId(null);
        load();
      })
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : "Failed to update account", "error")
      );
  };

  const handleDelete = (id: number) => {
    if (isDemoMode()) {
      showToast("Demo: Amazon accounts are not persisted.", "info");
      setDeleteConfirmId(null);
      return;
    }
    deleteAmazonAccount(token, id)
      .then(() => {
        showToast("Amazon account deactivated (soft delete)", "success");
        setDeleteConfirmId(null);
        load();
      })
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : "Failed to deactivate account", "error")
      );
  };

  if (loading) {
    return (
      <div>
        <LoadingSkeleton lines={6} />
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-4)",
          flexWrap: "wrap",
          gap: "var(--space-3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            Include inactive
          </label>
        </div>
        {!isDemoMode() && (
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
              fontSize: "var(--text-sm)",
              cursor: "pointer",
            }}
          >
            Add Amazon account
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState
            title="No Amazon accounts"
            description="Add an Amazon account to organize integrations (SP-API, Ads) by account. Use “Add Amazon account” to create one."
          />
        </Card>
      ) : (
        <Card>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "var(--text-sm)",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                <th style={{ padding: "var(--space-3)" }}>Name</th>
                <th style={{ padding: "var(--space-3)" }}>Status</th>
                <th style={{ padding: "var(--space-3)" }}>Created</th>
                <th style={{ padding: "var(--space-3)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "var(--space-3)" }}>{a.name}</td>
                  <td style={{ padding: "var(--space-3)" }}>
                    <span
                      style={{
                        padding: "var(--space-1) var(--space-2)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "var(--text-xs)",
                        backgroundColor: a.is_active ? "var(--color-success-muted)" : "var(--color-bg-muted)",
                        color: a.is_active ? "var(--color-success)" : "var(--color-text-muted)",
                      }}
                    >
                      {a.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "var(--space-3)", color: "var(--color-text-muted)" }}>
                    {new Date(a.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "var(--space-3)" }}>
                    {editingId === a.id ? (
                      <EditForm
                        account={a}
                        onSave={(body) => handleUpdate(a.id, body)}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <>
                        {!isDemoMode() && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingId(a.id)}
                              style={{
                                marginRight: "var(--space-2)",
                                padding: "var(--space-1) var(--space-2)",
                                fontSize: "var(--text-xs)",
                                cursor: "pointer",
                              }}
                            >
                              Edit
                            </button>
                            {a.is_active && (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(a.id)}
                                style={{
                                  padding: "var(--space-1) var(--space-2)",
                                  fontSize: "var(--text-xs)",
                                  color: "var(--color-error)",
                                  cursor: "pointer",
                                }}
                              >
                                Deactivate
                              </button>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {deleteConfirmId != null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
        >
          <div
            style={{
              backgroundColor: "var(--color-bg-elevated)",
              padding: "var(--space-6)",
              borderRadius: "var(--radius-md)",
              maxWidth: 400,
            }}
          >
            <h3 id="delete-title" style={{ margin: "0 0 var(--space-4)" }}>
              Deactivate account?
            </h3>
            <p style={{ margin: "0 0 var(--space-4)", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
              This sets the account to inactive (soft delete). You can reactivate it later by editing.
            </p>
            <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  backgroundColor: "var(--color-error)",
                  color: "white",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                }}
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <CreateForm
          onSave={handleCreate}
          onCancel={() => setCreateOpen(false)}
        />
      )}
    </div>
  );
}

function CreateForm({
  onSave,
  onCancel,
}: {
  onSave: (body: AmazonAccountCreate) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          backgroundColor: "var(--color-bg-elevated)",
          padding: "var(--space-6)",
          borderRadius: "var(--radius-md)",
          maxWidth: 400,
          width: "100%",
        }}
      >
        <h3 style={{ margin: "0 0 var(--space-4)" }}>Add Amazon account</h3>
        <div style={{ marginBottom: "var(--space-4)" }}>
          <label style={{ display: "block", marginBottom: "var(--space-2)", fontSize: "var(--text-sm)" }}>
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Main US Account"
            style={{
              width: "100%",
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
            }}
          />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span style={{ fontSize: "var(--text-sm)" }}>Active</span>
        </label>
        <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
          <button type="button" onClick={onCancel} style={{ padding: "var(--space-2) var(--space-4)", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({ name: name.trim() || "New account", is_active: isActive })}
            style={{
              padding: "var(--space-2) var(--space-4)",
              backgroundColor: "var(--color-primary)",
              color: "white",
              border: "none",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function EditForm({
  account,
  onSave,
  onCancel,
}: {
  account: AmazonAccountResponse;
  onSave: (body: AmazonAccountUpdate) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(account.name);
  const [isActive, setIsActive] = useState(account.is_active);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{
          padding: "var(--space-1) var(--space-2)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          fontSize: "var(--text-sm)",
          width: 160,
        }}
      />
      <label style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", fontSize: "var(--text-xs)" }}>
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Active
      </label>
      <button
        type="button"
        onClick={() => onSave({ name: name.trim() || account.name, is_active: isActive })}
        style={{ padding: "var(--space-1) var(--space-2)", fontSize: "var(--text-xs)", cursor: "pointer" }}
      >
        Save
      </button>
      <button type="button" onClick={onCancel} style={{ padding: "var(--space-1) var(--space-2)", fontSize: "var(--text-xs)", cursor: "pointer" }}>
        Cancel
      </button>
    </div>
  );
}
