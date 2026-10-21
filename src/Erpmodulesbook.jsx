import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, ChevronLeft, ChevronRight, X } from "lucide-react";


const PAGE_W = 440;

/* ---------- small helpers ---------- */
const pad = (n) => String(n).padStart(2, "0");
const covers = (m) => m.covers || [];
const describe = (m) =>
  m.description ||
  `Manage ${m.title.toLowerCase()} in one place: ${covers(m).slice(0, 3).join(", ")} and more.`;

function Logo({ logo }) {
  return logo ? (
    <img className="eb-logo" src={logo} alt="Synergy5M - Integrating Businesses" />
  ) : (
    <span className="eb-wordmark">
      Synergy<b>5M</b>
    </span>
  );
}

/* Shows your image, or a placeholder until you add one.
   Hover = full image zooms out of the thumbnail. Click = pin it (click again / Esc to close). */
function Img({ src, n, Icon, alt }) {
  const ref = useRef(null);
  const [zoom, setZoom] = useState(null); // { dx, dy, pinned }

  useEffect(() => {
    if (!zoom?.pinned) return undefined;
    const onKey = (e) => e.key === "Escape" && setZoom(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoom?.pinned]);

  if (!src) {
    return (
      <div className="eb-img eb-ph" role="img" aria-label={`Placeholder image ${n}`}>
        {Icon && <Icon size={30} />}
        <small>Image {n}</small>
      </div>
    );
  }

  const open = (pinned) => {
    const r = ref.current.getBoundingClientRect();
    setZoom({
      dx: r.left + r.width / 2 - window.innerWidth / 2,
      dy: r.top + r.height / 2 - window.innerHeight / 2,
      pinned,
    });
  };

  return (
    <>
      <img
        ref={ref}
        className="eb-img eb-zoomable"
        src={src}
        alt={alt}
        loading="lazy"
        onMouseEnter={() => !zoom?.pinned && open(false)}
        onMouseLeave={() => setZoom((z) => (z?.pinned ? z : null))}
        onClick={() => (zoom?.pinned ? setZoom(null) : open(true))}
      />
      {zoom &&
        createPortal(
          <div
            className={`eb-zoom${zoom.pinned ? " is-pinned" : ""}`}
            style={{ "--dx": `${zoom.dx}px`, "--dy": `${zoom.dy}px` }}
            onClick={() => setZoom(null)}
          >
            <figure>
              <img src={src} alt={alt} />
              <figcaption>{alt}</figcaption>
            </figure>
          </div>,
          document.body
        )}
    </>
  );
}
export { Img as ZoomImage }; // use inside your own Modal too

/* ---------- the two page types ---------- */
function LeftPage({ m, i }) {
  const Icon = m.Icon;
  const imgs = m.images || [];
  return (
    <div className="eb-pg">
      <div className="eb-head">
        <span className="eb-ico">{Icon && <Icon size={26} />}</span>
        <div>
          <small>Module {pad(i + 1)}</small>
          <h3>{m.title}</h3>
        </div>
      </div>
      <div className="eb-gal">
        {[0, 1, 2].map((k) => (
          <Img key={k} src={imgs[k]} n={k + 1} Icon={Icon} alt={`${m.title} image ${k + 1}`} />
        ))}
      </div>
    </div>
  );
}

function RightPage({ m, onView }) {
  const list = covers(m);
  return (
    <div className="eb-pg">
      <small className="eb-tag">About this module</small>
      <p className="eb-desc">{describe(m)}</p>
      <h4>What it covers</h4>
      <ul className="eb-list">
        {list.slice(0, 5).map((c) => (
          <li key={c}>{c}</li>
        ))}
        {list.length > 2 && <li className="eb-plus">+{list.length - 2}</li>}
      </ul>
      {list.length > 5 && <small className="eb-more">+ {list.length - 5} more</small>}
      <button type="button" className="eb-view" onClick={() => onView(m)}>
        View details <ArrowRight size={15} />
      </button>
    </div>
  );
}

/* ---------- detail page (opens after "View details") ---------- */
export function ERPDetailPage({ module: m, onClose, logo, onRequestDemo }) {
  const closeRef = useRef(null);
  const cb = useRef(onClose);
  cb.current = onClose;
  const Icon = m.Icon;
  const imgs = m.images || [];

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && cb.current();
    const prev = document.body.style.overflow;
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="ed-overlay" onClick={onClose}>
      <div
        className="ed-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${m.title} module details`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ed-top">
          <Logo logo={logo} />
          <span className="ed-crumb">ERP Modules / <b>{m.title}</b></span>
          <button ref={closeRef} type="button" className="ed-close" onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        </header>

        <div className="ed-body">
          <section className="ed-hero">
            <div>
              <span className="ed-badge">{Icon && <Icon size={30} />}</span>
              <h2>{m.title}</h2>
              <p>{describe(m)}</p>
              <div className="ed-act">
                <button type="button" className="eb-view" onClick={() => onRequestDemo?.(m)}>
                  Request a demo <ArrowRight size={15} />
                </button>
                <button type="button" className="ed-ghost" onClick={onClose}>Back to book</button>
              </div>
            </div>
            <div className="ed-gal">
              {[0, 1, 2].map((k) => (
                <Img key={k} src={imgs[k]} n={k + 1} Icon={Icon} alt={`${m.title} image ${k + 1}`} />
              ))}
            </div>
          </section>

          <h3 className="ed-h">What this module covers</h3>
          <div className="ed-covers">
            {covers(m).map((c) => (
              <div key={c} className="ed-cv">
                <Check size={16} /> {c}
              </div>
            ))}
          </div>
        </div>
        <footer className="ed-foot">Synergy5M · Integrating Businesses</footer>
      </div>
    </div>
  );
}

/* ---------- the booklet ---------- */
export default function ERPModulesBook({ modules, logo, height = 400, onViewDetails, onRequestDemo }) {
  const n = modules.length;
  const N = n + 2; // cover leaf + contents leaf + one leaf per module
  const [idx, setIdx] = useState(0);
  const [turning, setTurning] = useState(-1);
  const [active, setActive] = useState(null);
  const [scale, setScale] = useState(1);
  const wrap = useRef(null);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / (PAGE_W * 2 + 24)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const go = (d) => {
    const next = Math.max(0, Math.min(N, idx + d));
    if (next === idx) return;
    setTurning(d > 0 ? idx : next);
    setTimeout(() => setTurning(-1), 1100);
    setIdx(next);
  };
  const jump = (to) => {
    setTurning(-1);
    setIdx(to);
  };
  const view = (m) => (onViewDetails ? onViewDetails(m) : setActive(m));
  // close the detail page first, then let your app open its own Modal
  const demo = (m) => {
    setActive(null);
    onRequestDemo?.(m);
  };

  const cover = (
    <div className="eb-cover">
      <div className="eb-plate"><Logo logo={logo} /></div>
      <small>Synergy5M</small>
      <h2>ERP Modules Book</h2>
      <p>Powerful Modules. Complete Coverage.</p>
      <span className="eb-count">{n} modules inside</span>
      <button type="button" className="eb-view" onClick={() => go(1)}>
        Open the book <ArrowRight size={15} />
      </button>
    </div>
  );

  const intro = (
    <div className="eb-pg eb-center">
      <Logo logo={logo} />
      <h3>Welcome</h3>
      <p>Turn the pages to explore every module. Each spread shows the module on the left and what it does on the right.</p>
      <p className="eb-hint"><i /> Click a page corner or use the arrows</p>
    </div>
  );

  const contents = (
    <div className="eb-pg">
      <small className="eb-tag">Contents</small>
      <h3>All modules</h3>
      <ol className="eb-toc">
        {modules.map((m, i) => (
          <li key={m.title}>
            <button type="button" onClick={() => jump(i + 2)}>
              <span>{pad(i + 1)}</span> {m.title}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );

  const closing = (
    <div className="eb-pg eb-center">
      <Logo logo={logo} />
      <h3>Ready to connect your business?</h3>
      <p>Let us show you these modules working together.</p>
       <p>Synergy5M LLP <br/>
501, Fortuna Business Centre, Opp. McDonald's, Pimple Saudagar,<br/> Pune, Maharashtra, India. PIN - 411027 <br/>
9423579446<br/>
info@synergy5m.com

</p>
    </div>
  );

  const front = (k) =>
    k === 0 ? cover : k === 1 ? contents : <RightPage m={modules[k - 2]} onView={view} />;
  const back = (k) =>
    k === 0 ? intro : k <= n ? <LeftPage m={modules[k - 1]} i={k - 1} /> : closing;

  const shiftX = idx === 0 ? -PAGE_W / 2 : idx === N ? PAGE_W / 2 : 0;
  const label = idx === 0 ? "Cover" : idx === N ? "Back cover" : idx === 1 ? "Contents" : modules[idx - 2]?.title;

  return (
    <div className="eb" style={{ "--eb-h": `${height}px` }}>
      {/* desktop and tablet: the real booklet */}
      <div className={`eb-desk${height < 300 ? " eb-compact" : ""}`}>
        <div ref={wrap} className="eb-wrap" style={{ height: height * scale + 32 }}>
          <div className="eb-scale" style={{ transform: `scale(${scale})` }}>
            <div className="eb-shift" style={{ transform: `translateX(${shiftX}px)` }}>
              <div className="eb-rings" aria-hidden="true">
                {Array.from({ length: Math.max(4, Math.round(height / 46)) }, (_, i) => <i key={i} />)}
              </div>
              <div className="eb-book">
                {Array.from({ length: N }, (_, k) => (
                  <div
                    key={k}
                    className={`eb-leaf${k < idx ? " is-flipped" : ""}${turning === k ? " is-turning" : ""}`}
                    style={{ zIndex: k < idx ? k : N - k }}
                  >
                    <div className={`eb-face eb-r${k === 0 ? " is-cover" : ""}`}>
                      {front(k)}
                      <button type="button" className="eb-corner nx" aria-label="Next page" onClick={() => go(1)} />
                    </div>
                    <div className="eb-face eb-l">
                      {back(k)}
                      <button type="button" className="eb-corner pv" aria-label="Previous page" onClick={() => go(-1)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="eb-ctl">
          <button type="button" onClick={() => go(-1)} disabled={idx === 0} aria-label="Previous">
            <ChevronLeft size={20} />
          </button>
          <span>{label}</span>
          <button type="button" onClick={() => go(1)} disabled={idx === N} aria-label="Next">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* phones: each module as a stacked two-page card */}
      <div className="eb-mobile">
        {modules.map((m, i) => (
          <article key={m.title} className="eb-m">
            <LeftPage m={m} i={i} />
            <RightPage m={m} onView={view} />
          </article>
        ))}
      </div>

      {active && (
        <ERPDetailPage module={active} logo={logo} onClose={() => setActive(null)} onRequestDemo={demo} />
      )}
    </div>
  );
}
