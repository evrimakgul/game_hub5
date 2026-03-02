import {
  calculateInitiative,
  calculateMaxHP,
  calculateOccultManaBonus,
  calculateRangedBonusDice,
} from "./config/stats";

const demoState = {
  name: "Mira",
  rank: "E",
  cr: 1,
  currentHp: 12,
  currentMana: 8,
  inspiration: 2,
  dex: 4,
  wits: 3,
  stam: 5,
  per: 4,
  occultism: 3,
  xpUsed: 66,
};

const derivedPreview = {
  maxHp: calculateMaxHP(demoState.stam),
  initiative: calculateInitiative(demoState.dex, demoState.wits),
  rangedBonus: calculateRangedBonusDice(demoState.per),
  manaBonus: calculateOccultManaBonus(demoState.occultism, demoState.xpUsed),
};

export default function App() {
  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Convergence</p>
        <h1>Game Hub Foundations</h1>
        <p className="hero-copy">
          The React shell is live. Rules, types, tests, and action economy are now wired into a
          frontend-ready project structure.
        </p>
      </section>

      <section className="preview-grid" aria-label="UI preview">
        <article className="panel player-preview">
          <header className="panel-header">
            <div>
              <p className="panel-label">Mobile Player Sheet</p>
              <h2>{demoState.name}</h2>
            </div>
            <div className="badge-stack">
              <span>Rank {demoState.rank}</span>
              <span>CR {demoState.cr}</span>
            </div>
          </header>

          <div className="resource-row">
            <div>
              <span>HP</span>
              <strong>
                {demoState.currentHp} / {derivedPreview.maxHp}
              </strong>
            </div>
            <div>
              <span>Mana</span>
              <strong>{demoState.currentMana}</strong>
            </div>
            <div>
              <span>Inspiration</span>
              <strong>{demoState.inspiration}</strong>
            </div>
          </div>

          <div className="stats-grid">
            <div>
              <span>Init</span>
              <strong>{derivedPreview.initiative}</strong>
            </div>
            <div>
              <span>Ranged Bonus</span>
              <strong>{derivedPreview.rangedBonus}</strong>
            </div>
            <div>
              <span>Occult Mana Bonus</span>
              <strong>{derivedPreview.manaBonus}</strong>
            </div>
          </div>

          <div className="actions-row">
            <button type="button">Attack</button>
            <button type="button">Power</button>
            <button type="button">Move</button>
            <button type="button">Reaction</button>
          </div>
        </article>

        <article className="panel dm-preview">
          <header className="panel-header">
            <div>
              <p className="panel-label">Desktop DM Dashboard</p>
              <h2>Encounter Preview</h2>
            </div>
            <span className="round-pill">Round 1</span>
          </header>

          <ol className="initiative-list">
            <li>
              <span>Mira</span>
              <span>Ready</span>
            </li>
            <li>
              <span>Ghar</span>
              <span>Move Used</span>
            </li>
            <li>
              <span>Shade</span>
              <span>Reaction Ready</span>
            </li>
          </ol>

          <div className="log-block">
            <p>[12:31] Mira attacks Shade and deals 3 damage.</p>
            <p>[12:32] Shade prepares a reaction.</p>
            <p>[12:33] Turn advances to Ghar.</p>
          </div>
        </article>
      </section>
    </main>
  );
}
