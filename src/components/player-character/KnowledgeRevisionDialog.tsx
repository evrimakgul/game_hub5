import type {
  KnowledgeEntity,
  KnowledgeOwnership,
  KnowledgeRevision,
} from "../../types/knowledge.ts";
import { KnowledgeCardView } from "./KnowledgeCardView.tsx";

type KnowledgeRevisionDialogProps = {
  entity: KnowledgeEntity | null;
  revision: KnowledgeRevision | null;
  ownership?: KnowledgeOwnership | null;
  onClose: () => void;
};

export function KnowledgeRevisionDialog({
  entity,
  revision,
  ownership = null,
  onClose,
}: KnowledgeRevisionDialogProps) {
  if (!entity || !revision) {
    return null;
  }

  return (
    <div
      className="knowledge-dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="knowledge-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="knowledge-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="knowledge-dialog-head">
          <h2 id="knowledge-dialog-title">Knowledge Revision</h2>
          <button type="button" className="knowledge-plain-button" onClick={onClose}>
            Close
          </button>
        </div>
        <KnowledgeCardView entity={entity} revision={revision} ownership={ownership} />
      </div>
    </div>
  );
}
