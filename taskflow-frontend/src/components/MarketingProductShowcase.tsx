import { Bell, Check, Circle, FolderKanban, Users } from "lucide-react";

export function ProductShowcase() {
  return (
    <section className="product-showcase" id="product-showcase" aria-labelledby="showcase-title">
      <header className="product-showcase__heading">
        <p className="mono-label mono">A clearer view of the work</p>
        <h2 id="showcase-title">The details teams need, <em>in one place.</em></h2>
        <p>Explore the building blocks of a TaskFlow workspace. The interface fragments below are illustrative examples, not live customer data.</p>
      </header>

      <div className="showcase-grid">
        <article className="showcase-card showcase-card--project">
          <div className="showcase-card__label"><FolderKanban aria-hidden="true" /><span>Projects</span><span className="showcase-card__tag">Workspace preview</span></div>
          <div className="showcase-project">
            <div className="showcase-project__title"><div><small>PROJECT</small><h3>Product launch</h3></div><span className="showcase-status">In progress</span></div>
            <div className="showcase-progress-label"><span>Progress</span><span>Tasks grouped by project</span></div>
            <div className="showcase-progress" aria-hidden="true"><span /></div>
            <div className="showcase-project__foot"><span>Tasks, owners, and due dates</span><span className="showcase-avatar-stack" aria-label="Illustrative teammates"><i>A</i><i>J</i><i>M</i></span></div>
          </div>
        </article>

        <article className="showcase-card showcase-card--tasks">
          <div className="showcase-card__label"><Check aria-hidden="true" /><span>Task workflow</span><span className="showcase-card__tag">Sample tasks</span></div>
          <div className="showcase-task-list">
            <div><span className="showcase-task-state showcase-task-state--done"><Check /></span><span><b>Confirm project scope</b><small>Done · assigned</small></span><span className="showcase-priority">High</span></div>
            <div><span className="showcase-task-state showcase-task-state--active"><Circle /></span><span><b>Review the launch plan</b><small>In progress · due date</small></span><span className="showcase-priority">Medium</span></div>
            <div><span className="showcase-task-state"><Circle /></span><span><b>Share next steps</b><small>To do · unassigned</small></span><span className="showcase-priority">Low</span></div>
          </div>
        </article>

        <article className="showcase-card showcase-card--team">
          <div className="showcase-card__label"><Users aria-hidden="true" /><span>Team coordination</span><span className="showcase-card__tag">Role-based access</span></div>
          <div className="showcase-team-list">
            <div><span className="showcase-person">AR</span><span><b>Workspace owner</b><small>Organization admin</small></span><span className="showcase-role">Admin</span></div>
            <div><span className="showcase-person showcase-person--alt">JM</span><span><b>Project teammate</b><small>Organization member</small></span><span className="showcase-role">Member</span></div>
            <div className="showcase-invite"><span>Invite teammates by email and choose their organization role.</span><span>Invite member ↗</span></div>
          </div>
        </article>

        <article className="showcase-card showcase-card--notifications">
          <div className="showcase-card__label"><Bell aria-hidden="true" /><span>Notifications</span><span className="showcase-card__tag">In-app updates</span></div>
          <div className="showcase-notice"><span className="showcase-notice__icon"><Check /></span><span><b>Task assigned</b><small>Open the update to return to its work.</small></span><span className="showcase-notice__dot" /></div>
          <div className="showcase-notice showcase-notice--muted"><span className="showcase-notice__icon"><Bell /></span><span><b>Project activity</b><small>Relevant updates stay in your notification list.</small></span></div>
        </article>
      </div>
    </section>
  );
}
