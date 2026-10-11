"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

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
    const stageIds = ["stage1", "how-it-works", "stage4"];
    const stages = stageIds.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    let ticking = false;
    let lastLogIdx = -1;

    function progress(el: HTMLElement): number {
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      if (total <= 0) return rect.top <= 0 ? 1 : 0;
      const scrolled = -rect.top;
      if (scrolled < 0) return 0;
      if (scrolled > total) return 1;
      return scrolled / total;
    }

    function updateLogRows(p4: number) {
      const idx = Math.min(4, Math.floor(p4 * 5));
      if (idx === lastLogIdx) return;
      lastLogIdx = idx;
      root!.querySelectorAll(".log__row, .log__node").forEach((row) => {
        const n = parseInt(row.getAttribute("data-row") ?? "0", 10);
        row.classList.toggle("is-lit", n <= idx);
      });
    }

    function onScroll() {
      if (reduced) return;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (stages.length === 3) {
            const values = stages.map(progress);
            const p1 = values[0] ?? 0;
            const p2 = values[1] ?? 0;
            const p4 = values[2] ?? 0;
            docEl.style.setProperty("--p1", p1.toFixed(4));
            docEl.style.setProperty("--p2", p2.toFixed(4));
            docEl.style.setProperty("--p4", p4.toFixed(4));
            updateLogRows(p4);
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
    } else {
      root.querySelectorAll(".log__row, .log__node").forEach((r) => r.classList.add("is-lit"));
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
          <a href="#product" onClick={(event) => scrollToAnchor(event, "product")}>
            Product
          </a>
          <a href="#how-it-works" onClick={(event) => scrollToAnchor(event, "how-it-works")}>
            How it works
          </a>
          <a href="#faq">FAQ</a>
          <Link href="/login">Sign in</Link>
        </div>
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
                  Lightweight project and task management
                </p>
                <h1 className="hero__headline split" id="heroHeadline">
                  {['Know', 'what', 'needs', 'attention.', 'Keep', 'work', 'moving.'].map((word, index) => (
                    <span className="word" style={{ "--i": index } as React.CSSProperties} key={word + index}>
                      {word}
                    </span>
                  )).flatMap((el, i) => (i === 0 ? [el] : [" ", el]))}{" "}
                </h1>
                <p className="hero__lede" data-rev style={{ "--d": "60ms" } as React.CSSProperties}>
                  TaskFlow gives teams one place to plan projects, assign work, track progress, and keep important work
                  from slipping through the cracks.
                </p>
                <div className="hero__cta" data-rev style={{ "--d": "140ms" } as React.CSSProperties}>
                  <Link className="btn" href="#product">
                    Get started free
                  </Link>
                  <Link className="btn btn--ghost" href="#how-it-works">
                    See how it works
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
                    Reliable notifications
                  </span>
                </div>
              </div>

              {/* Real product preview — same status/priority system as the
                  authenticated app's TaskTable, not a decorative mockup. */}
              <div className="hero__preview" data-rev style={{ "--d": "180ms" } as React.CSSProperties}>
                <div className="hero__preview-card">
                  <div className="hpc__head">
                    <span className="hpc__dot" />
                    <span className="hpc__dot" />
                    <span className="hpc__dot" />
                    <span className="hpc__title">Customer portal refresh</span>
                    <span className="hpc__count mono">6 open</span>
                  </div>
                  <div className="hpc__rows">
                    <div className="hpc__row">
                      <span className="hpc__status hpc__status--progress" aria-hidden="true" />
                      <span className="hpc__task">Refresh-token rotation</span>
                      <span className="hpc__assignee mono">LC</span>
                      <span className="hpc__badge hpc__badge--high">High</span>
                    </div>
                    <div className="hpc__row">
                      <span className="hpc__status hpc__status--review" aria-hidden="true" />
                      <span className="hpc__task">Assignment email copy</span>
                      <span className="hpc__assignee mono">MP</span>
                      <span className="hpc__badge hpc__badge--medium">Medium</span>
                    </div>
                    <div className="hpc__row">
                      <span className="hpc__status hpc__status--todo" aria-hidden="true" />
                      <span className="hpc__task">Audit legacy endpoints</span>
                      <span className="hpc__assignee mono">—</span>
                      <span className="hpc__badge hpc__badge--low">Low</span>
                    </div>
                    <div className="hpc__row hpc__row--done">
                      <span className="hpc__status hpc__status--done" aria-hidden="true" />
                      <span className="hpc__task">Org-scoped auth</span>
                      <span className="hpc__assignee mono">RK</span>
                      <span className="hpc__badge hpc__badge--done">Done</span>
                    </div>
                  </div>
                  <div className="hpc__foot mono">
                    <span className="hpc__foot-dot" />
                    task_assigned queued · worker picked up in 40ms
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════ FRAME — the board ══════════════════════ */}
      <section className="stage stage--frame" id="how-it-works">
        <div className="stage__inner">
          <div className="frame__photo architecture__visual" aria-hidden="true">
            <svg className="architecture__connectors" viewBox="0 0 1200 360" preserveAspectRatio="none">
              <path className="architecture__line" d="M110 120 H960 V270 H760" />
              <path className="architecture__line" d="M960 120 V270 H1040" />
              <path className="architecture__signal" pathLength="1" d="M110 120 H960" />
              <path className="architecture__signal" pathLength="1" d="M960 120 V270 H760" />
              <path className="architecture__signal" pathLength="1" d="M960 120 V270 H1040" />
            </svg>
            <div className="architecture__nodes">
              <div className="architecture__node">
                <span className="architecture__label mono">Input</span>
                <strong>Team</strong>
                <span>Create or update work</span>
              </div>
              <div className="architecture__node">
                <span className="architecture__label mono">Core</span>
                <strong>TaskFlow API</strong>
                <span>Auth + business rules</span>
              </div>
              <div className="architecture__node">
                <span className="architecture__label mono">Data</span>
                <strong>PostgreSQL</strong>
                <span>Project data</span>
              </div>
              <div className="architecture__node">
                <span className="architecture__label mono">Event</span>
                <strong>Task event</strong>
                <span>Assignment or status change</span>
              </div>
              <div className="architecture__node">
                <span className="architecture__label mono">Worker</span>
                <strong>BullMQ</strong>
                <span>Background processing</span>
              </div>
              <div className="architecture__node architecture__node--branch">
                <span className="architecture__label mono">Delivery</span>
                <strong>Notification</strong>
                <span>Reliable delivery</span>
              </div>
              <div className="architecture__node architecture__node--branch">
                <span className="architecture__label mono">State</span>
                <strong>Project state</strong>
                <span>Progress, blockers, activity</span>
              </div>
            </div>
          </div>
          <div className="frame__caption">
            <div className="frame__scrim" />
            <p className="eyebrow" data-rev>
              How it works
            </p>
            <h2 className="frame__headline split">
              <span data-text>
                Work moves. TaskFlow <em>keeps up.</em>
              </span>
            </h2>
            <p className="frame__lede" data-rev>
              From an assignment to the resulting notification, TaskFlow connects everyday actions to the systems that
              keep work moving.
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════ PROJECT INTELLIGENCE ══════════════════════ */}
      <section className="band band--explainer band--intelligence">
        <div className="intelligence__head">
          <p className="mono-label mono" data-rev>
            Project intelligence
          </p>
          <h2 data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
            Don&apos;t just track work. <em>Understand it.</em>
          </h2>
          <p data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
            TaskFlow is being built to surface the work that needs attention — from overdue tasks and blocked dependencies
            to project risks and overloaded owners.
          </p>
        </div>
        <div className="col">
          <p className="mono-label mono" data-rev>
            Overdue
          </p>
          <h3 data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
            Payment API integration
          </h3>
          <p data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
            3 days overdue
          </p>
        </div>
        <div className="col">
          <p className="mono-label mono" data-rev>
            Blocked
          </p>
          <h3 data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
            Production deployment
          </h3>
          <p data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
            Waiting on 2 upstream tasks
          </p>
        </div>
        <div className="col">
          <p className="mono-label mono" data-rev>
            Workload
          </p>
          <h3 data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
            Team capacity
          </h3>
          <p data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
            One member has significantly more active work than the team average
          </p>
        </div>
        <p className="intelligence__note" data-rev>
          Built from the state of your actual work — not another manually maintained status report.
        </p>
      </section>

      {/* ══════════════════════ LOG — reliable execution ══════════════════════ */}
      <section className="stage stage--log" id="stage4">
        <div className="stage__inner">
          <div className="log__inner">
            <div className="log__col">
              <p className="log__eyebrow strap" data-rev>
                Reliable notifications
              </p>
              <h2 className="log__headline split">
                <span data-text>
                  Important work shouldn&apos;t depend on a notification <em>succeeding.</em>
                </span>
              </h2>
              <p data-rev style={{ color: "var(--muted-dark)", fontSize: "13.5px", maxWidth: "36ch", margin: "-16px 0 28px" }}>
                When work is assigned, TaskFlow handles the notification in the background. Failed deliveries are retried
                automatically and tracked when they can&apos;t be delivered.
              </p>
              <div className="log__rows" id="logRows">
                <div className="log__row" data-row="0">
                  <span className="mono">00:00:01</span>
                  <strong>task_assigned enqueued</strong>
                  <em>Redis / BullMQ picks it up instantly</em>
                </div>
                <div className="log__row" data-row="1">
                  <span className="mono">00:00:02</span>
                  <strong>attempt 1 / 3</strong>
                  <em>Email dispatch begins</em>
                </div>
                <div className="log__row" data-row="2">
                  <span className="mono">00:00:04</span>
                  <strong>retry · backoff 2s</strong>
                  <em>Transient failure, retried automatically</em>
                </div>
                <div className="log__row" data-row="3">
                  <span className="mono">00:00:08</span>
                  <strong>retry · backoff 4s</strong>
                  <em>Third attempt, exponential backoff</em>
                </div>
                <div className="log__row" data-row="4">
                  <span className="mono">00:00:12</span>
                  <strong>moved to dead-letter queue</strong>
                  <em>Exhausted retries land here, not lost</em>
                </div>
              </div>
            </div>
            <div className="log__field">
              <div className="log__diagram" aria-label="Notification delivery flow">
                <svg viewBox="0 0 640 280" role="img">
                  <path className="log__path" d="M52 140 H588" pathLength="1" />
                  <g className="log__node" data-row="0">
                    <circle cx="52" cy="140" r="13" />
                    <text x="52" y="102">Enqueued</text>
                  </g>
                  <g className="log__node" data-row="1">
                    <circle cx="186" cy="140" r="13" />
                    <text x="186" y="102">Attempt 1</text>
                  </g>
                  <g className="log__node" data-row="2">
                    <circle cx="320" cy="140" r="13" />
                    <text x="320" y="102">Retry (2s)</text>
                  </g>
                  <g className="log__node" data-row="3">
                    <circle cx="454" cy="140" r="13" />
                    <text x="454" y="102">Retry (4s)</text>
                  </g>
                  <g className="log__node log__node--final" data-row="4">
                    <circle cx="588" cy="140" r="13" />
                    <text x="588" y="102">Delivered</text>
                    <text className="log__dead-letter" x="588" y="194">Dead-letter</text>
                  </g>
                  <circle className="log__dot" cx="0" cy="0" r="7" />
                </svg>
              </div>
              <canvas id="stars" width="800" height="800" aria-hidden="true" />
            </div>
          </div>
        </div>
      </section>

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
              Node.js 24 · TypeScript · Express 5
            </span>
          </div>
          <div className="stack__row">
            <span className="label" data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
              Database
            </span>
            <span className="value mono" data-rev style={{ "--d": "40ms" } as React.CSSProperties}>
              PostgreSQL 17 via Prisma
            </span>
          </div>
          <div className="stack__row">
            <span className="label" data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
              Queue
            </span>
            <span className="value mono" data-rev style={{ "--d": "80ms" } as React.CSSProperties}>
              Redis + BullMQ · 3 attempts · 1s / 2s / 4s
            </span>
          </div>
          <div className="stack__row">
            <span className="label" data-rev style={{ "--d": "120ms" } as React.CSSProperties}>
              Auth
            </span>
            <span className="value mono" data-rev style={{ "--d": "120ms" } as React.CSSProperties}>
              JWT access + rotating refresh tokens
            </span>
          </div>
          <div className="stack__row">
            <span className="label" data-rev style={{ "--d": "160ms" } as React.CSSProperties}>
              Testing
            </span>
            <span className="value mono" data-rev style={{ "--d": "160ms" } as React.CSSProperties}>
              Vitest · Supertest · CI on every push
            </span>
          </div>
          <div className="stack__row">
            <span className="label" data-rev style={{ "--d": "200ms" } as React.CSSProperties}>
              Deploy
            </span>
            <span className="value mono" data-rev style={{ "--d": "200ms" } as React.CSSProperties}>
              Docker Compose · Render · GitHub Actions
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
            A project and task management platform built for teams that need real accountability: every project and
            task belongs to an organization, every assignment is tracked, and background notifications are delivered
            reliably instead of silently failing.
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
          <h4 data-rev style={{ "--d": "200ms" } as React.CSSProperties}>
            Can TaskFlow integrate with other applications?
          </h4>
          <p data-rev style={{ "--d": "200ms" } as React.CSSProperties}>
            TaskFlow exposes a documented REST API with OpenAPI/Swagger documentation, so applications can make
            authenticated HTTP requests to work with projects, tasks, assignments, and job status.
          </p>
        </div>
        <div className="faq__item">
          <h4 data-rev style={{ "--d": "240ms" } as React.CSSProperties}>
            Is the source code available?
          </h4>
          <p data-rev style={{ "--d": "240ms" } as React.CSSProperties}>
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
            Get started free
          </Link>
          <Link className="btn btn--ghost" href="/login">
            Sign in
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
            <a href="https://github.com/maxsilver9890/taskflow-backend">GitHub</a>
            <a href="https://taskflow-backend-api-7iwy.onrender.com/api-docs">API docs</a>
            <a href="#stage1">Back to top</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
