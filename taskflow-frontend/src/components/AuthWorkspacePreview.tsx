type AuthWorkspacePreviewProps = { compact?: boolean };

const sampleTasks = [
  { title: "Map the onboarding flow", status: "In progress", owner: "AL", tone: "progress" },
  { title: "Review launch checklist", status: "To do", owner: "MK", tone: "todo" },
  { title: "Share project brief", status: "Done", owner: "JR", tone: "done" },
];

export default function AuthWorkspacePreview({ compact = false }: AuthWorkspacePreviewProps) {
  return (
    <section className={`auth-preview${compact ? " auth-preview--compact" : ""}`} aria-label="Illustrative TaskFlow workspace preview">
      <div className="auth-preview__topline">
        <span className="auth-preview__label">Illustrative workspace</span>
        <span className="auth-preview__project-state">PROJECT</span>
      </div>
      <div className="auth-preview__project-head">
        <div>
          <p className="auth-preview__overline">Workspace · Product launch</p>
          <h3>Launch planning</h3>
        </div>
        <div className="auth-preview__avatars" aria-label="Illustrative team members">
          <span>AL</span><span>MK</span><span>JR</span>
        </div>
      </div>
      <div className="auth-preview__progress" aria-label="Illustrative project progress">
        <div className="auth-preview__progress-label"><span>Project progress</span><span>In motion</span></div>
        <div className="auth-preview__progress-track"><span /></div>
      </div>
      <div className="auth-preview__tasks">
        {sampleTasks.map((task) => (
          <div className="auth-preview__task" key={task.title}>
            <span className={`auth-preview__status auth-preview__status--${task.tone}`} aria-hidden="true" />
            <span className="auth-preview__task-title">{task.title}</span>
            <span className={`auth-preview__badge auth-preview__badge--${task.tone}`}>{task.status}</span>
            <span className="auth-preview__owner" aria-label={`Illustrative owner ${task.owner}`}>{task.owner}</span>
          </div>
        ))}
      </div>
      {compact && <p className="auth-preview__compact-note">Projects, tasks, owners, and updates in one place.</p>}
    </section>
  );
}
