import type { PreparedCastRequest } from "../../types/combatEncounterView";

type EncounterCastConfirmationDialogProps = {
  pendingCastConfirmation: {
    request: PreparedCastRequest;
    warnings: string[];
  } | null;
  pendingCastError: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function EncounterCastConfirmationDialog({
  pendingCastConfirmation,
  pendingCastError,
  onClose,
  onConfirm,
}: EncounterCastConfirmationDialogProps) {
  if (!pendingCastConfirmation) {
    return null;
  }

  return (
    <div
      className="dm-confirm-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="dm-confirm-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dm-confirm-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="section-kicker">Warning</p>
        <h2 id="dm-confirm-title">Replace Existing Effect?</h2>
        <div className="dm-confirm-copy">
          {pendingCastConfirmation.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          <p>Proceed and replace the existing effect?</p>
        </div>
        {pendingCastError ? <p className="dm-error">{pendingCastError}</p> : null}
        <div className="dm-confirm-actions">
          <button type="button" className="flow-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="flow-primary" onClick={onConfirm}>
            Confirm Cast
          </button>
        </div>
      </div>
    </div>
  );
}
