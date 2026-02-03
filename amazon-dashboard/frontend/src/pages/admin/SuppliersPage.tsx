import { useCallback, useEffect, useState } from "react";
import {
  getRestockSuppliers,
  createRestockSupplier,
  updateRestockSupplier,
  deleteRestockSupplier,
  type RestockSupplierOut,
  type RestockSupplierCreate,
  type RestockSupplierUpdate,
} from "../api";
import Card from "../components/ui/Card";
import LoadingSkeleton from "../components/ui/LoadingSkeleton";
import EmptyState from "../components/ui/EmptyState";
import { useToast } from "../context/ToastContext";
import { isDemoMode } from "../utils/preferences";

type Props = {
  token: string;
};

export default function SuppliersPage({ token }: Props) {
  const { showToast } = useToast();
  const [list, setList] = useState<RestockSupplierOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const load = useCallback(() => {
    if (isDemoMode()) {
      setList([
        { id: 1, name: "Demo Supplier A", contact_email: "demo@example.com", notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getRestockSuppliers(token)
      .then(setList)
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = (body: RestockSupplierCreate) => {
    if (isDemoMode()) {
      showToast("Demo: suppliers are not persisted.", "info");
      setCreateOpen(false);
      return;
    }
    createRestockSupplier(token, body)
      .then(() => {
        showToast("Supplier created", "success");
        setCreateOpen(false);
        load();
      })
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : "Failed to create supplier", "error")
      );
  };

  const handleUpdate = (id: number, body: RestockSupplierUpdate) => {
    if (isDemoMode()) {
      showToast("Demo: suppliers are not persisted.", "info");
      setEditingId(null);
      return;
    }
    updateRestockSupplier(token, id, body)
      .then(() => {
        showToast("Supplier updated", "success");
        setEditingId(null);
        load();
      })
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : "Failed to update supplier", "error")
      );
  };

  const handleDelete = (id: number) => {
    if (isDemoMode()) {
      showToast("Demo: suppliers are not persisted.", "info");
      setDeleteConfirmId(null);
      return;
    }
    deleteRestockSupplier(token, id)
      .then(() => {
        showToast("Supplier deleted", "success");
        setDeleteConfirmId(null);
        load();
      })
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : "Failed to delete supplier", "error")
      );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
          <h2>Suppliers</h2>
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
            Add supplier
          </button>
        </div>
        {loading ? (
          <LoadingSkeleton rows={5} />
        ) : list.length === 0 ? (
          <EmptyState
            title="No suppliers"
            description="Add a supplier to use in SKU supplier settings and restock recommendations."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                  <th style={{ padding: "var(--space-2)" }}>Name</th>
                  <th style={{ padding: "var(--space-2)" }}>Contact email</th>
                  <th style={{ padding: "var(--space-2)" }}>Notes</th>
                  <th style={{ padding: "var(--space-2)", width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "var(--space-2)" }}>{s.name}</td>
                    <td style={{ padding: "var(--space-2)" }}>{s.contact_email ?? "—"}</td>
                    <td style={{ padding: "var(--space-2)" }}>{s.notes ?? "—"}</td>
                    <td style={{ padding: "var(--space-2)" }}>
                      {editingId === s.id ? (
                        <InlineEditSupplier
                          supplier={s}
                          onSave={(body) => handleUpdate(s.id, body)}
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditingId(s.id)}
                            style={{ marginRight: "var(--space-2)", padding: "var(--space-1) var(--space-2)", cursor: "pointer" }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(s.id)}
                            style={{ padding: "var(--space-1) var(--space-2)", color: "var(--color-error)", cursor: "pointer" }}
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
          </div>
        )}
      </Card>

      {createOpen && (
        <CreateSupplierModal
          onSave={handleCreate}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {deleteConfirmId != null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <Card style={{ maxWidth: 400 }}>
            <p>Delete this supplier? SKU settings linked to it may be affected.</p>
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

function CreateSupplierModal({
  onSave,
  onClose,
}: {
  onSave: (body: RestockSupplierCreate) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), contact_email: contactEmail.trim() || null, notes: notes.trim() || null });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <Card style={{ maxWidth: 400, width: "100%" }}>
        <h3 style={{ marginBottom: "var(--space-4)" }}>New supplier</h3>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <label>
            <span style={{ display: "block", marginBottom: "var(--space-1)" }}>Name *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ width: "100%", padding: "var(--space-2)", borderRadius: "var(--radius-md)" }}
            />
          </label>
          <label>
            <span style={{ display: "block", marginBottom: "var(--space-1)" }}>Contact email</span>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              style={{ width: "100%", padding: "var(--space-2)", borderRadius: "var(--radius-md)" }}
            />
          </label>
          <label>
            <span style={{ display: "block", marginBottom: "var(--space-1)" }}>Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
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

function InlineEditSupplier({
  supplier,
  onSave,
  onCancel,
}: {
  supplier: RestockSupplierOut;
  onSave: (body: RestockSupplierUpdate) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(supplier.name);
  const [contactEmail, setContactEmail] = useState(supplier.contact_email ?? "");
  const [notes, setNotes] = useState(supplier.notes ?? "");

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        style={{ width: 120, padding: "var(--space-1) var(--space-2)", borderRadius: "var(--radius-sm)" }}
      />
      <input
        type="email"
        value={contactEmail}
        onChange={(e) => setContactEmail(e.target.value)}
        placeholder="Email"
        style={{ width: 140, padding: "var(--space-1) var(--space-2)", borderRadius: "var(--radius-sm)" }}
      />
      <button type="button" onClick={() => onSave({ name: name.trim() || undefined, contact_email: contactEmail.trim() || null, notes: notes.trim() || null })} style={{ padding: "var(--space-1) var(--space-2)", cursor: "pointer" }}>
        Save
      </button>
      <button type="button" onClick={onCancel} style={{ padding: "var(--space-1) var(--space-2)", cursor: "pointer" }}>
        Cancel
      </button>
    </div>
  );
}
