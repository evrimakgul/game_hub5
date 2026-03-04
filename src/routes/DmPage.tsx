import { Navigate, useNavigate } from "react-router-dom";

import { useAppFlow } from "../state/appFlow";

export function DmPage() {
  const navigate = useNavigate();
  const { roleChoice } = useAppFlow();

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  return (
    <main className="flow-page">
      <section className="flow-card">
        <p className="section-kicker">Dungeon Master</p>
        <h1>DM Branch Later</h1>
        <div className="flow-actions">
          <button type="button" className="flow-primary" onClick={() => navigate("/role")}>
            Back
          </button>
        </div>
      </section>
    </main>
  );
}
