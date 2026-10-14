import { Bell, Check, Circle, FolderKanban, LayoutDashboard, ListTodo, Users } from "lucide-react";

const lanes = [
  {
    label: "To do",
    tone: "todo",
    tasks: [{ title: "Review launch checklist", owner: "MK", meta: "Priority · Medium" }],
  },
  {
    label: "In progress",
    tone: "active",
    tasks: [{ title: "Map onboarding flow", owner: "AL", meta: "Priority · High" }],
  },
  {
    label: "In review",
    tone: "review",
    tasks: [{ title: "Polish workspace screens", owner: "JR", meta: "Priority · Medium" }],
  },
  {
    label: "Done",
    tone: "done",
    tasks: [{ title: "Share project brief", owner: "AL", meta: "Completed" }],
  },
];

export function MarketingWorkspaceShowcase() {
  return (
    <section className="workspace-showcase" id="stage4" aria-labelledby="workspace-showcase-title">
      <div className="workspace-showcase__inner">
        <header className="workspace-showcase__heading" data-rev>
          <p className="mono-label mono">A project, at a glance</p>
          <h2 id="workspace-showcase-title">See the work.<br /><em>Know the next move.</em></h2>
          <p>Projects, task owners, and status updates come together in one shared workspace.</p>
        </header>

        <div className="workspace-preview-wrap" data-rev>
          <div className="workspace-callout workspace-callout--progress"><span className="workspace-callout__icon">↗</span><span><small>PROJECT VIEW</small><strong>Progress by task status</strong></span></div>
          <div className="workspace-callout workspace-callout--ownership"><span className="workspace-callout__avatar">MK</span><span><small>VISIBLE OWNERSHIP</small><strong>Every task has context</strong></span></div>

          <div className="workspace-preview" aria-label="Illustrative TaskFlow project workspace with sample tasks">
            <header className="workspace-preview__topbar">
              <span className="workspace-preview__brand"><i>T</i> taskflow<span>.</span></span>
              <span className="workspace-preview__workspace">Workspace <b>Northstar team</b></span>
              <span className="workspace-preview__top-actions"><Bell aria-label="Notifications" /><span className="workspace-preview__user">PS</span></span>
            </header>
            <div className="workspace-preview__body">
              <nav className="workspace-preview__sidebar" aria-label="Illustrative workspace navigation">
                <span className="workspace-preview__side-label">WORKSPACE</span>
                <span><LayoutDashboard />Overview</span>
                <span className="is-selected"><FolderKanban />Projects</span>
                <span><ListTodo />All tasks</span>
                <span><Users />Team</span>
                <div className="workspace-preview__side-project"><i />Product launch</div>
              </nav>

              <div className="workspace-preview__main">
                <div className="workspace-preview__crumb">Projects <span>/</span> Product launch</div>
                <div className="workspace-preview__project-head">
                  <div><p className="workspace-preview__overline">ILLUSTRATIVE PROJECT</p><h3>Product launch</h3><p>Plan the work, share ownership, and keep every next step visible.</p></div>
                  <div className="workspace-preview__members" aria-label="Illustrative project members"><span>AL</span><span>MK</span><span>JR</span><b>TEAM</b></div>
                </div>
                <div className="workspace-preview__summary">
                  <div><small>PROJECT PROGRESS</small><strong>Tasks moving across the board</strong><i><b /></i></div>
                  <span className="workspace-preview__summary-tag">PROJECT OVERVIEW</span>
                </div>
                <div className="workspace-preview__board">
                  {lanes.map((lane) => (
                    <section className={`workspace-lane workspace-lane--${lane.tone}`} key={lane.label} aria-label={`${lane.label} sample tasks`}>
                      <header><span className={`workspace-lane__dot workspace-lane__dot--${lane.tone}`} />{lane.label}<b>{lane.tasks.length}</b></header>
                      {lane.tasks.map((task) => (
                        <article className="workspace-task" key={task.title}>
                          <div className="workspace-task__title"><span>{lane.tone === "done" ? <Check /> : <Circle />}</span><strong>{task.title}</strong></div>
                          <small>{task.meta}</small>
                          <footer><span>Product launch</span><i aria-label={`Illustrative owner ${task.owner}`}>{task.owner}</i></footer>
                        </article>
                      ))}
                    </section>
                  ))}
                </div>
                <p className="workspace-preview__disclaimer">Illustrative workspace · project, task, and teammate details are examples</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
