import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Convergence</p>
        <h1>Route Not Found</h1>
        <p className="hero-copy">
          This route is not part of the current vertical slice. Return to the preview shell to
          continue.
        </p>
        <nav className="route-nav">
          <Link to="/">Back To Home</Link>
        </nav>
      </section>
    </main>
  );
}
