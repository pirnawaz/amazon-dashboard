import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

type Props = {
  children: ReactNode;
};

/**
 * Renders children only when the current user has role "owner".
 * Otherwise renders a friendly "Owner access required" page with a link back to Dashboard.
 */
export default function RequireOwner({ children }: Props) {
  const { user } = useAuth();

  if (user?.role !== "owner") {
    return (
      <section
        style={{
          maxWidth: 420,
          margin: "var(--space-8) auto",
          padding: "var(--space-6)",
          fontFamily: "var(--font-sans)",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            margin: "0 0 var(--space-4)",
            fontSize: "var(--text-xl)",
            fontWeight: "var(--font-semibold)",
            color: "var(--color-text)",
          }}
        >
          Owner access required
        </h2>
        <p
          style={{
            margin: "0 0 var(--space-6)",
            fontSize: "var(--text-sm)",
            color: "var(--color-text-muted)",
            lineHeight: 1.5,
          }}
        >
          This section can only be changed by the account owner.
        </p>
        <Link
          to="/dashboard"
          style={{
            display: "inline-block",
            padding: "var(--space-2) var(--space-4)",
            backgroundColor: "var(--color-primary)",
            color: "white",
            border: "none",
            borderRadius: "var(--radius-md)",
            fontWeight: "var(--font-medium)",
            fontSize: "var(--text-sm)",
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          Back to Dashboard
        </Link>
      </section>
    );
  }

  return <>{children}</>;
}
