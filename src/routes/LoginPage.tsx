import { useNavigate } from "react-router-dom";

import { useAppFlow } from "../state/appFlow";

export function LoginPage() {
  const navigate = useNavigate();
  const { chooseAuth } = useAppFlow();

  function handleChoice(choice: "login" | "signup"): void {
    chooseAuth(choice);
    navigate("/role");
  }

  return (
    <main className="flow-page">
      <section className="flow-card">
        <p className="section-kicker">Convergence</p>
        <h1>Enter</h1>
        <div className="flow-actions">
          <button type="button" className="flow-primary" onClick={() => handleChoice("login")}>
            Login
          </button>
          <button type="button" className="flow-secondary" onClick={() => handleChoice("signup")}>
            Sign Up
          </button>
        </div>
      </section>
    </main>
  );
}
