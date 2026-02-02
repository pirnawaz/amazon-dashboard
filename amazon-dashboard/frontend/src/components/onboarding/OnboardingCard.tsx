import { Link } from "react-router-dom";
import Card from "../ui/Card";
import { setOnboarded } from "../../utils/preferences";
import { useDemo } from "../../context/DemoContext";

const buttonPrimary = {
  padding: "var(--space-2) var(--space-4)",
  backgroundColor: "var(--color-primary)",
  color: "white",
  border: "none",
  borderRadius: "var(--radius-md)",
  fontWeight: "var(--font-medium)" as const,
  cursor: "pointer" as const,
  fontSize: "var(--text-sm)",
};

const buttonSecondary = {
  padding: "var(--space-2) var(--space-4)",
  backgroundColor: "var(--color-bg-elevated)",
  color: "var(--color-text)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  fontWeight: "var(--font-medium)" as const,
  cursor: "pointer" as const,
  fontSize: "var(--text-sm)",
};

type Props = {
  onLoadSampleData?: () => void;
  onDismiss?: () => void;
};

export default function OnboardingCard({ onLoadSampleData, onDismiss }: Props) {
  const { isDemoMode: alreadyDemo, setDemoMode } = useDemo();

  const handleLoadSample = () => {
    setDemoMode();
    setOnboarded();
    onLoadSampleData?.();
  };

  const handleDismiss = () => {
    setOnboarded();
    onDismiss?.();
  };

  return (
    <Card>
      <div style={{ padding: "var(--space-6)" }}>
        <h2
          style={{
            margin: "0 0 var(--space-2)",
            fontSize: "var(--text-xl)",
            fontWeight: "var(--font-semibold)",
            color: "var(--color-text)",
          }}
        >
          Welcome to Seller Hub
        </h2>
        <p style={{ margin: "0 0 var(--space-4)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
          This app helps you forecast demand, plan restocks, and monitor trends for your Amazon selling account.
        </p>

        <p style={{ margin: "0 0 var(--space-2)", fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)", color: "var(--color-text)" }}>
          What you can do:
        </p>
        <ul style={{ margin: "0 0 var(--space-4)", paddingLeft: "var(--space-6)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
          <li>Forecast demand — see predicted units and forecast quality</li>
          <li>Plan restocks — get reorder recommendations by risk level</li>
          <li>Monitor trends — revenue, units, and top products over time</li>
        </ul>

        <p style={{ margin: "0 0 var(--space-2)", fontSize: "var(--text-sm)", fontWeight: "var(--font-medium)", color: "var(--color-text)" }}>
          Next steps:
        </p>
        <ul style={{ margin: "0 0 var(--space-4)", paddingLeft: "var(--space-6)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
          <li>Connect your Amazon account (Settings → Amazon Connections) — coming soon</li>
          <li>Import sample data to explore the app with demo metrics and charts</li>
          <li>Go to Forecasts to see demand forecasts and model accuracy</li>
        </ul>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "center" }}>
          {!alreadyDemo && (
            <button type="button" onClick={handleLoadSample} style={buttonPrimary}>
              Load sample data
            </button>
          )}
          <Link to="/forecasts" style={{ textDecoration: "none" }}>
            <button type="button" style={buttonSecondary}>
              Go to Forecasts
            </button>
          </Link>
          <Link to="/settings" style={{ textDecoration: "none" }}>
            <button type="button" style={buttonSecondary}>
              Settings
            </button>
          </Link>
          <button type="button" onClick={handleDismiss} style={buttonSecondary}>
            Dismiss
          </button>
        </div>
      </div>
    </Card>
  );
}
