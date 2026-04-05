import type {
  KnowledgeEntity,
  KnowledgeOwnership,
  KnowledgeRevision,
  KnowledgeRevisionSection,
} from "../../types/knowledge.ts";
import {
  buildKnowledgeRevisionLabel,
  getKnowledgeOwnershipDisplayLabel,
} from "../../lib/knowledge.ts";

type KnowledgeCardViewProps = {
  entity: KnowledgeEntity;
  revision: KnowledgeRevision;
  ownership?: KnowledgeOwnership | null;
  mode?: "full" | "preview";
};

function getVisibleSections(
  sections: KnowledgeRevisionSection[],
  mode: "full" | "preview"
): KnowledgeRevisionSection[] {
  if (mode === "full") {
    return sections;
  }

  return sections.slice(0, 3).map((section) => ({
    ...section,
    entries: section.entries.slice(0, 3),
  }));
}

export function KnowledgeCardView({
  entity,
  revision,
  ownership = null,
  mode = "full",
}: KnowledgeCardViewProps) {
  const visibleSections = getVisibleSections(revision.content, mode);
  const displayLabel = ownership
    ? getKnowledgeOwnershipDisplayLabel(ownership, entity, revision)
    : `${entity.displayName} ${buildKnowledgeRevisionLabel(revision)}`;

  return (
    <article className={`knowledge-card-view knowledge-card-view-${mode}`}>
      <header className="knowledge-card-head">
        <div>
          <p className="section-kicker">Knowledge Card</p>
          <h3>{displayLabel}</h3>
        </div>
        <div className="knowledge-card-meta">
          <span>{buildKnowledgeRevisionLabel(revision)}</span>
          <span>{revision.sourceSpellName ?? revision.sourceType}</span>
        </div>
      </header>

      {revision.summary.trim().length > 0 ? (
        <p className="knowledge-card-summary">{revision.summary}</p>
      ) : null}

      <div className="knowledge-card-sections">
        {visibleSections.map((section) => (
          <section key={section.id} className="knowledge-card-section">
            <h4>{section.title}</h4>
            <div className="knowledge-card-section-entries">
              {section.entries.map((entry) => (
                <p key={entry.id}>
                  {entry.label.trim().length > 0 ? <strong>{entry.label}: </strong> : null}
                  <span>{entry.value}</span>
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
