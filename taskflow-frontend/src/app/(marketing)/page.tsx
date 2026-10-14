"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { ProductShowcase } from "@/components/MarketingProductShowcase";
import { MarketingWorkspaceShowcase } from "@/components/MarketingWorkspaceShowcase";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function MarketingPage() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".marketing");
    if (!root) return;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileQuery = window.matchMedia("(max-width: 760px)");
    // Pinned-stage scroll-jacking is desktop-only (the max-width:760px rules
    // in marketing.css collapse stages to normal stacked sections) — below
    // that breakpoint, skip the p1-p4 scroll math entirely rather than let
    // it hit a degenerate "stage height == viewport height" edge case.
    const reduced = reducedMotionQuery.matches || mobileQuery.matches;

    const cleanups: Array<() => void> = [];

    // ── reveal observer ──────────────────────────────────────────
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    root.querySelectorAll(".split, [data-rev]").forEach((el) => io.observe(el));
    cleanups.push(() => io.disconnect());

    const heroHeadline = document.getElementById("heroHeadline");
    const heroTimeout = window.setTimeout(() => {
      if (heroHeadline) {
        heroHeadline.classList.add("is-in");
        io.unobserve(heroHeadline);
      }
      root.querySelectorAll(".stage--hero [data-rev]").forEach((el) => {
        el.classList.add("is-in");
        io.unobserve(el);
      });
    }, 120);
    cleanups.push(() => window.clearTimeout(heroTimeout));

    // ── scroll-driven custom properties ───────────────────────────
    const docEl = document.documentElement;
    const stageIds = ["stage1", "how-it-works"];
    const stages = stageIds.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    let ticking = false;

    function progress(el: HTMLElement): number {
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      if (total <= 0) return rect.top <= 0 ? 1 : 0;
      const scrolled = -rect.top;
      if (scrolled < 0) return 0;
      if (scrolled > total) return 1;
      return scrolled / total;
    }

    function onScroll() {
      if (reduced) return;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (stages.length === 2) {
            const values = stages.map(progress);
            const p1 = values[0] ?? 0;
            const p2 = values[1] ?? 0;
            docEl.style.setProperty("--p1", p1.toFixed(4));
            docEl.style.setProperty("--p2", p2.toFixed(4));
          }
          ticking = false;
        });
        ticking = true;
      }
    }
    if (!reduced) {
      window.addEventListener("scroll", onScroll, { passive: true });
      cleanups.push(() => window.removeEventListener("scroll", onScroll));
      onScroll();
    }

    // ── phyllotaxis star field ─────────────────────────────────────
    const canvas = document.getElementById("stars") as HTMLCanvasElement | null;
    if (canvas && !reduced) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const COUNT = 220;
        const stars = Array.from({ length: COUNT }, (_, i) => ({
          angle: i * 2.399963,
          radius: Math.sqrt(i / COUNT),
          phase: Math.random() * Math.PI * 2,
          speed: 0.6 + Math.random() * 0.9,
          coral: i % 23 === 0,
        }));
        let rotation = 0;
        let running = false;
        let rafId: number | null = null;
        let lastT: number | null = null;

        function resize() {
          const size = canvas!.clientWidth * (window.devicePixelRatio || 1);
          canvas!.width = size;
          canvas!.height = size;
        }
        resize();
        window.addEventListener("resize", resize);
        cleanups.push(() => window.removeEventListener("resize", resize));

        function draw(t: number) {
          if (lastT === null) lastT = t;
          const dt = (t - lastT) / 1000;
          lastT = t;
          rotation += 0.035 * dt;

          const w = canvas!.width;
          const h = canvas!.height;
          const cx = w / 2;
          const cy = h / 2;
          const R = Math.min(w, h) * 0.46;

          ctx!.clearRect(0, 0, w, h);
          ctx!.strokeStyle = "rgba(240,229,212,0.08)";
          ctx!.lineWidth = 1;
          [0.5, 0.82].forEach((f) => {
            ctx!.beginPath();
            ctx!.arc(cx, cy, R * f, 0, Math.PI * 2);
            ctx!.stroke();
          });

          stars.forEach((s) => {
            const a = s.angle + rotation;
            const r = s.radius * R;
            const x = cx + Math.cos(a) * r;
            const y = cy + Math.sin(a) * r;
            const tw = 0.35 + 0.65 * Math.abs(Math.sin((t / 1000) * s.speed + s.phase));
            const size = s.coral ? 2.4 : 1.5;
            ctx!.beginPath();
            ctx!.arc(x, y, size, 0, Math.PI * 2);
            ctx!.fillStyle = s.coral ? `rgba(226,112,90,${tw.toFixed(3)})` : `rgba(245,237,226,${(tw * 0.9).toFixed(3)})`;
            ctx!.fill();
          });

          if (running) rafId = window.requestAnimationFrame(draw);
        }

        const fieldObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting && !running) {
                running = true;
                lastT = null;
                rafId = window.requestAnimationFrame(draw);
              } else if (!entry.isIntersecting && running) {
                running = false;
                if (rafId !== null) window.cancelAnimationFrame(rafId);
              }
            });
          },
          { threshold: 0.05 },
        );
        fieldObserver.observe(canvas);
        cleanups.push(() => {
          running = false;
          if (rafId !== null) window.cancelAnimationFrame(rafId);
          fieldObserver.disconnect();
        });
      }
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  function scrollToAnchor(event: React.MouseEvent<HTMLAnchorElement>, targetId: string) {
    event.preventDefault();
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="marketing">
      <div className="grain" aria-hidden="true" />

      <nav className="nav">
        <a className="nav__mark" href="#stage1" aria-label="Back to top">
          taskflow<em>.</em>
        </a>
        <div className="nav__links mono">
          <a href="#product-showcase" onClick={(event) => scrollToAnchor(event, "product-showcase")}>
            Product
          </a>
          <a href="#how-it-works" onClick={(event) => scrollToAnchor(event, "how-it-works")}>
            How it works
          </a>
          <a href="#stack" onClick={(event) => scrollToAnchor(event, "stack")}>
            Platform
          </a>
          <a href="#faq">FAQ</a>
          <Link href="/login">Log in</Link>
        </div>
        <Link className="nav__cta mono" href="/register">
          Get started
        </Link>
        <details className="nav__mobile">
          <summary aria-label="Open navigation">Menu</summary>
          <div className="nav__mobile-panel">
            <a href="#product-showcase" onClick={(event) => { scrollToAnchor(event, "product-showcase"); event.currentTarget.closest("details")?.removeAttribute("open"); }}>Product</a>
            <a href="#how-it-works" onClick={(event) => { scrollToAnchor(event, "how-it-works"); event.currentTarget.closest("details")?.removeAttribute("open"); }}>How it works</a>
            <a href="#stack" onClick={(event) => { scrollToAnchor(event, "stack"); event.currentTarget.closest("details")?.removeAttribute("open"); }}>Platform</a>
            <a href="#faq" onClick={(event) => { scrollToAnchor(event, "faq"); event.currentTarget.closest("details")?.removeAttribute("open"); }}>FAQ</a>
            <Link href="/login">Log in</Link>
          </div>
        </details>
      </nav>

      {/* ══════════════════════ HERO ══════════════════════ */}
      <section className="stage stage--hero" id="stage1">
        <div className="stage__inner">
          <div className="hero__art" aria-hidden="true" />
          <div className="hero__veil" />
          <div className="hero__content">
            <div className="hero__layout">
              <div className="hero__copy">
                <p className="hero__strap strap" data-rev>
                  THE TEAM WORKSPACE FOR CLEAR OWNERSHIP
                </p>
                <h1 className="hero__headline split" id="heroHeadline">
                  {['Make', 'every', 'next', 'step', 'clear.'].map((word, index) => (
                    <span className="word" style={{ "--i": index } as React.CSSProperties} key={word + index}>
                      {word}
                    </span>
                  )).flatMap((el, i) => (i === 0 ? [el] : [" ", el]))}{" "}
                </h1>
                <p className="hero__lede" data-rev style={{ "--d": "60ms" } as React.CSSProperties}>
                  Plan projects, assign tasks, and keep your team aligned with a workspace that makes ownership and progress easy to see.
                </p>
                <div className="hero__cta" data-rev style={{ "--d": "140ms" } as React.CSSProperties}>
                  <Link className="btn" href="/register">
                    Get started
                  </Link>
                  <Link className="btn btn--ghost" href="#how-it-works">
                    Explore the product
                  </Link>
                </div>
                <div className="hero__foot mono">
                  <span data-rev style={{ "--d": "200ms" } as React.CSSProperties}>
                    Clear ownership
                  </span>
                  <span data-rev style={{ "--d": "240ms" } as React.CSSProperties}>
                    Project-wide visibility
                  </span>
                  <span data-rev style={{ "--d": "280ms" } as React.CSSProperties}>
                    Context that stays with the work
                  </span>
                </div>
              </div>

              {/* Clearly labelled illustrative UI preview in the workspace's visual language. */}
              <div className="hero__preview" data-rev style={{ "--d": "180ms" } as React.CSSProperties}>
                <div className="hero__float hero__float--progress" aria-label="Illustrative project progress">
                  <span>PROJECT PROGRESS</span><strong>Launch planning</strong><i><b /></i>
                </div>
                <div className="hero__float hero__float--owner" aria-label="Illustrative task ownership">
                  <span className="hero__float-avatar">MP</span><span><small>TASK OWNER</small><strong>Review dashboard</strong></span>
                </div>
                <div className="hero__float hero__float--notice" aria-label="Illustrative task notification">
                  <span className="hero__float-mark">↗</span><span><small>WORKSPACE UPDATE</small><strong>Task status changed</strong></span>
                </div>
                <div className="hero__preview-card">
                  <div className="hpc__head">
                    <span className="hpc__dot" />
                    <span className="hpc__dot" />
                    <span className="hpc__dot" />
                    <span className="hpc__title">Illustrative workspace</span>
                    <span className="hpc__count mono">SAMPLE TASKS</span>
                  </div>
                  <div className="hpc__rows">
                    <div className="hpc__row">
                      <span className="hpc__status hpc__status--progress" aria-hidden="true" />
                      <span className="hpc__task">Map onboarding flow</span>
                      <span className="hpc__assignee mono">LC</span>
                      <span className="hpc__badge hpc__badge--high">High</span>
                    </div>
                    <div className="hpc__row">
                      <span className="hpc__status hpc__status--review" aria-hidden="true" />
                      <span className="hpc__task">Review dashboard layout</span>
                      <span className="hpc__assignee mono">MP</span>
                      <span className="hpc__badge hpc__badge--medium">Medium</span>
                    </div>
                    <div className="hpc__row">
                      <span className="hpc__status hpc__status--todo" aria-hidden="true" />
                      <span className="hpc__task">Invite launch team</span>
                      <span className="hpc__assignee mono">—</span>
                      <span className="hpc__badge hpc__badge--low">Low</span>
                    </div>
                    <div className="hpc__row hpc__row--done">
                      <span className="hpc__status hpc__status--done" aria-hidden="true" />
                      <span className="hpc__task">Create project brief</span>
                      <span className="hpc__assignee mono">RK</span>
                      <span className="hpc__badge hpc__badge--done">Done</span>
                    </div>
                  </div>
                  <div className="hpc__foot mono">
                    <span className="hpc__foot-dot" />
                    Example interface · task updates stay in context
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════ FRAME — the board ══════════════════════ */}
      <section className="stage stage--frame workflow-story" id="how-it-works">
        <div className="stage__inner">
          <div className="frame__caption">
            <p className="eyebrow" data-rev>How it works</p>
            <h2 className="frame__headline" data-rev>
              From a new workspace to <em>work in motion.</em>
            </h2>
            <p className="frame__lede" data-rev>
              A straightforward home for your organization, projects, tasks, and the updates that help your team stay aligned.
            </p>
          </div>
          <div className="workflow__layout">
            <ol className="workflow__steps">
              <li data-rev><span className="workflow__number">01</span><span><strong>Create a workspace</strong><small>Start an organization and invite your team.</small></span></li>
              <li data-rev><span className="workflow__number">02</span><span><strong>Organize a project</strong><small>Give related work one shared home.</small></span></li>
              <li data-rev><span className="workflow__number">03</span><span><strong>Assign and track tasks</strong><small>Keep owners, status, priority, and due dates visible.</small></span></li>
              <li data-rev><span className="workflow__number">04</span><span><strong>Follow updates</strong><small>See task discussion and notifications in context.</small></span></li>
            </ol>
            <div className="workflow__preview" aria-label="Illustrative project workspace preview">
              <div className="workflow__preview-head"><span>Illustrative project</span><span className="workflow__project-badge">PRODUCT LAUNCH</span></div>
              <div className="workflow__project-title"><strong>Launch planning</strong><span className="workflow__avatars" aria-label="Illustrative teammates"><i>AL</i><i>MK</i><i>JR</i></span></div>
              <div className="workflow__progress-label"><span>Project progress</span><span>Tasks grouped by status</span></div>
              <div className="workflow__progress"><span /></div>
              <div className="workflow__board">
                <div><small>TO DO</small><p>Review launch checklist <b>MK</b></p></div>
                <div><small>IN PROGRESS</small><p>Map onboarding flow <b>AL</b></p></div>
                <div><small>DONE</small><p>Share project brief <b>JR</b></p></div>
              </div>
              <p className="workflow__preview-note">Example interface · statuses and names are illustrative</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════ PROJECT INTELLIGENCE ══════════════════════ */}
      <section className="band band--explainer band--intelligence">
        <div className="intelligence__head">
          <p className="mono-label mono" data-rev>
            One connected workspace
          </p>
          <h2 data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
            Keep the team, the work, and the context <em>together.</em>
          </h2>
          <p data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
            Bring organization membership, project plans, task ownership, and team updates into one shared workflow.
          </p>
        </div>
        <div className="col">
          <p className="mono-label mono" data-rev>
            Organization
          </p>
          <h3 data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
            Clear team roles
          </h3>
          <p data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
            Invite teammates as members or organization admins.
          </p>
        </div>
        <div className="col">
          <p className="mono-label mono" data-rev>
            Projects & tasks
          </p>
          <h3 data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
            Ownership you can see
          </h3>
          <p data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
            Track status, priority, due dates, and assignees in context.
          </p>
        </div>
        <div className="col">
          <p className="mono-label mono" data-rev>
            Team context
          </p>
          <h3 data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
            Keep updates with the work
          </h3>
          <p data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
            Discuss tasks, follow notifications, and retain a deletion notice when a comment is removed.
          </p>
        </div>
        <p className="intelligence__note" data-rev>
          One source of context for the day-to-day work your team is already managing.
        </p>
      </section>

      <MarketingWorkspaceShowcase />

      {/* ══════════════════════ KEY FEATURES ══════════════════════ */}
      <section className="band band--explainer" id="product">
        <div className="col">
          <p className="mono-label mono" data-rev>
            Ownership
          </p>
          <h3 data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
            Know who&apos;s doing what
          </h3>
          <p data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
            Assign owners, set priorities and due dates, and keep every task tied to the project it belongs to.
          </p>
        </div>
        <div className="col">
          <p className="mono-label mono" data-rev>
            Visibility
          </p>
          <h3 data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
            See what&apos;s falling behind
          </h3>
          <p data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
            Track project progress, overdue work, assignments, and status without manually piecing together updates.
          </p>
        </div>
        <div className="col">
          <p className="mono-label mono" data-rev>
            Reliability
          </p>
          <h3 data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
            Keep work moving
          </h3>
          <p data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
            Background notifications, automatic retries, and tracked failures help important events stay visible.
          </p>
        </div>
      </section>

      <ProductShowcase />

      {/* ══════════════════════ ARCHITECTURE ══════════════════════ */}
      <section className="band band--stack" id="stack">
        <div className="band__head">
          <p className="strap mono" data-rev style={{ color: "var(--coral-soft)" }}>
            Under the hood
          </p>
          <h2 data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
            Simple on the surface. <em>Deliberate underneath.</em>
          </h2>
        </div>
        <p className="band__lede" data-rev style={{ "--d": "60ms" } as React.CSSProperties}>
          TaskFlow keeps the everyday workflow simple while using a production-oriented backend for authentication, data
          isolation, background jobs, retries, and reliable task events.
        </p>
        <div className="stack__table">
          <div className="stack__row">
            <span className="label" data-rev>
              Runtime
            </span>
            <span className="value mono" data-rev>
              Node.js 22+ · Node 24 CI/container
            </span>
          </div>
          <div className="stack__row">
            <span className="label" data-rev style={{ "--d": "20ms" } as React.CSSProperties}>
              Frontend
            </span>
            <span className="value mono" data-rev style={{ "--d": "20ms" } as React.CSSProperties}>
              Next.js 16 · React 19 · TypeScript 5.9
            </span>
          </div>
          <div className="stack__row">
            <span className="label" data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
              API
            </span>
            <span className="value mono" data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
              Express 5 · TypeScript 5.9 · Zod · Helmet · rate limiting · Pino
            </span>
          </div>
          <div className="stack__row">
            <span className="label" data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
              Database
            </span>
            <span className="value mono" data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
              PostgreSQL 17 · Prisma 6
            </span>
          </div>
          <div className="stack__row">
            <span className="label" data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
              Queue
            </span>
            <span className="value mono" data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
              Redis 8 · BullMQ · ioredis
            </span>
          </div>
          <div className="stack__row">
            <span className="label" data-rev style={{ "--d": "120ms" } as React.CSSProperties}>
              UI &amp; state
            </span>
            <span className="value mono" data-rev style={{ "--d": "120ms" } as React.CSSProperties}>
              Tailwind CSS 4 · TanStack Query 5 · Radix UI · dnd-kit
            </span>
          </div>
          <div className="stack__row">
            <span className="label" data-rev style={{ "--d": "120ms" } as React.CSSProperties}>
              Identity &amp; sessions
            </span>
            <span className="value mono" data-rev style={{ "--d": "120ms" } as React.CSSProperties}>
              Firebase Auth/Admin · JWT access + rotating refresh · bcrypt · email OTP
            </span>
          </div>
          <div className="stack__row">
            <span className="label" data-rev style={{ "--d": "160ms" } as React.CSSProperties}>
              Email jobs
            </span>
            <span className="value mono" data-rev style={{ "--d": "160ms" } as React.CSSProperties}>
              Resend or console · up to 3 attempts · exponential backoff + DLQ
            </span>
          </div>
          <div className="stack__row">
            <span className="label" data-rev style={{ "--d": "180ms" } as React.CSSProperties}>
              Quality
            </span>
            <span className="value mono" data-rev style={{ "--d": "180ms" } as React.CSSProperties}>
              Vitest · Supertest · Playwright · ESLint · GitHub Actions (push + PR)
            </span>
          </div>
          <div className="stack__row">
            <span className="label" data-rev style={{ "--d": "190ms" } as React.CSSProperties}>
              Hosting
            </span>
            <span className="value mono" data-rev style={{ "--d": "190ms" } as React.CSSProperties}>
              Vercel frontend · Render backend · Supabase PostgreSQL
            </span>
          </div>
          <div className="stack__row">
            <span className="label" data-rev style={{ "--d": "200ms" } as React.CSSProperties}>
              Local infrastructure
            </span>
            <span className="value mono" data-rev style={{ "--d": "200ms" } as React.CSSProperties}>
              Docker Compose · PostgreSQL 17 · Redis 8.10
            </span>
          </div>
        </div>
      </section>

      {/* ══════════════════════ FAQ ══════════════════════ */}
      <section className="band band--faq" id="faq">
        <h2 data-rev>Questions</h2>
        <div className="faq__item">
          <h4 data-rev>What is TaskFlow?</h4>
          <p data-rev>
            A project and task management workspace for teams that need clear ownership: projects and tasks belong to an
            organization, and supported email jobs are retried with failures kept available for inspection.
          </p>
        </div>
        <div className="faq__item">
          <h4 data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
            Who is TaskFlow for?
          </h4>
          <p data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
            TaskFlow is for teams that need a lightweight way to organize projects, assign ownership, track progress, and
            keep shared work visible.
          </p>
        </div>
        <div className="faq__item">
          <h4 data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
            How does TaskFlow keep work organized?
          </h4>
          <p data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
            Projects keep related tasks together, while statuses, priorities, due dates, assignees, filters, and project
            dashboards make it easier to see what needs attention.
          </p>
        </div>
        <div className="faq__item">
          <h4 data-rev style={{ "--d": "120ms" } as React.CSSProperties}>
            What happens when a notification fails?
          </h4>
          <p data-rev style={{ "--d": "120ms" } as React.CSSProperties}>
            Notification jobs run in the background and retry automatically with exponential backoff. If all attempts
            fail, the job is tracked in a dead-letter queue instead of disappearing. On the hosted demo, jobs may stay
            queued because a worker is not running continuously; the full local Docker Compose stack processes them.
          </p>
        </div>
        <div className="faq__item">
          <h4 data-rev style={{ "--d": "160ms" } as React.CSSProperties}>
            How does organization isolation work?
          </h4>
          <p data-rev style={{ "--d": "160ms" } as React.CSSProperties}>
            Every project and task is scoped to an organization at the database query level. Access tokens carry the
            organization and role, and cross-organization requests are rejected by the backend.
          </p>
        </div>
        <div className="faq__item">
          <h4 data-rev style={{ "--d": "180ms" } as React.CSSProperties}>
            How do organization invitations work?
          </h4>
          <p data-rev style={{ "--d": "180ms" } as React.CSSProperties}>
            Organization admins invite an email address with a selected role. Invitees sign in, verify their email, and
            accept or reject the invitation; invitations expire after seven days.
          </p>
        </div>
        <div className="faq__item">
          <h4 data-rev style={{ "--d": "200ms" } as React.CSSProperties}>
            Can teammates discuss work in context?
          </h4>
          <p data-rev style={{ "--d": "200ms" } as React.CSSProperties}>
            Tasks have comments. Authors can edit their own comments, members can remove their own, and admins can
            moderate comments by members. Removed messages leave a named deletion notice in the thread.
          </p>
        </div>
        <div className="faq__item">
          <h4 data-rev style={{ "--d": "220ms" } as React.CSSProperties}>
            Can I reset my password?
          </h4>
          <p data-rev style={{ "--d": "220ms" } as React.CSSProperties}>
            Request a reset link from the sign-in flow. Completing a reset changes the password and signs out existing
            sessions, so you can sign in again with the new password.
          </p>
        </div>
        <div className="faq__item">
          <h4 data-rev style={{ "--d": "240ms" } as React.CSSProperties}>
            Can TaskFlow integrate with other applications?
          </h4>
          <p data-rev style={{ "--d": "240ms" } as React.CSSProperties}>
            TaskFlow exposes a documented REST API with OpenAPI/Swagger documentation, so applications can make
            authenticated HTTP requests to work with projects, tasks, assignments, and job status.
          </p>
        </div>
        <div className="faq__item">
          <h4 data-rev style={{ "--d": "280ms" } as React.CSSProperties}>
            Is the source code available?
          </h4>
          <p data-rev style={{ "--d": "280ms" } as React.CSSProperties}>
            Yes — the backend and frontend are both open on GitHub.
          </p>
        </div>
      </section>

      {/* ══════════════════════ FINAL CTA ══════════════════════ */}
      <section className="band band--cta">
        <h2 data-rev>
          Keep the work <em>moving.</em>
        </h2>
        <p data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
          Plan the work, give it an owner, and keep the whole team aligned.
        </p>
        <div className="btn-row" data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
          <Link className="btn" href="/register">
            Create workspace
          </Link>
          <Link className="btn btn--ghost" href="/login">
            Log in
          </Link>
        </div>
      </section>

      <footer className="footer mono">
        <div className="footer__brand">
          <strong>taskflow.</strong>
          <span className="footer__note">Project and task management, built for reliability.</span>
          <span className="footer__note">Built by Prateek Saxena</span>
        </div>
        <div className="footer__row">
          <span className="footer__note">
            <a href="#stack">See the architecture</a>
          </span>
          <div className="footer__links">
            <a href="https://github.com/maxsilver9890/taskflow">GitHub</a>
            <a href="#stage1">Back to top</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
