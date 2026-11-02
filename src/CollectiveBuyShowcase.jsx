import React, { useState, useRef, useEffect } from "react";
import {
  Scale,
  DollarSign,
  Globe,
  Search,
  BarChart3,
  Building2,
  Compass,
  ShieldCheck,
  Calendar,
  CheckCircle2,
  Layers,
  Package,
  FileText,
  Users,
  TrendingUp,
  Handshake,
  Truck,
  ArrowDown
} from "lucide-react";
import SummarySection from "./SummarySection";
import "./CollectiveBuyShowcase.css";

// ============================================================================
// 1. DATA: 10 Major Advantages for Buyers (Strictly Preserved)
// ============================================================================
export const BUYER_ADVANTAGES = [
  {
    num: "01",
    title: "Better Negotiating Power",
    desc: "Combine compatible purchasing requirements with other businesses to negotiate more competitive prices and commercial terms.",
    icon: Scale
  },
  {
    num: "02",
    title: "Access to Volume-Based Pricing",
    desc: "Benefit from supplier quotations based on aggregated demand and quantity slabs, where available.",
    icon: DollarSign
  },
  {
    num: "03",
    title: "Wider Supplier Discovery",
    desc: "Explore domestic and international sourcing opportunities beyond your existing supplier network.",
    icon: Globe
  },
  {
    num: "04",
    title: "Reduced Sourcing Effort",
    desc: "Access consolidated opportunities and comparable offers without independently approaching every potential supplier.",
    icon: Search
  },
  {
    num: "05",
    title: "Improved Cost Visibility",
    desc: "Compare quotations, freight, delivery terms and other relevant costs to evaluate the overall procurement value.",
    icon: BarChart3
  },
  {
    num: "06",
    title: "MSME-Friendly Procurement",
    desc: "Help small and medium businesses participate in sourcing opportunities that may otherwise be difficult to negotiate individually.",
    icon: Building2
  },
  {
    num: "07",
    title: "Domestic and Import Options",
    desc: "Evaluate local and overseas supply alternatives according to quality, landed cost, lead time and compliance requirements.",
    icon: Compass
  },
  {
    num: "08",
    title: "Greater Supply Resilience",
    desc: "Identify alternative suppliers and reduce dependence on a single sourcing channel, subject to qualification.",
    icon: ShieldCheck
  },
  {
    num: "09",
    title: "Better Purchase Planning",
    desc: "Consolidate demand forecasts to support quantity planning, procurement schedules and supplier discussions.",
    icon: Calendar
  },
  {
    num: "10",
    title: "Independent Purchasing Control",
    desc: "Each buyer retains control over its supplier selection, purchase order, payment and agreed delivery arrangements.",
    icon: CheckCircle2
  }
];

// ============================================================================
// 2. DATA: 10 Major Advantages for Sellers & Manufacturers (Strictly Preserved)
// ============================================================================
export const SELLER_ADVANTAGES = [
  {
    num: "01",
    title: "Access to Aggregated Demand",
    desc: "View compatible buying requirements from multiple businesses through one consolidated opportunity.",
    icon: Layers
  },
  {
    num: "02",
    title: "Potential for Larger Order Volumes",
    desc: "Quote against combined demand instead of pursuing only isolated, small-volume enquiries.",
    icon: Package
  },
  {
    num: "03",
    title: "Qualified Business Opportunities",
    desc: "Review product specifications, requested quantities, delivery locations and buying timelines before submitting an offer.",
    icon: FileText
  },
  {
    num: "04",
    title: "Reach New Industrial Buyers",
    desc: "Connect with businesses outside existing distribution and sales networks, including MSMEs.",
    icon: Users
  },
  {
    num: "05",
    title: "Better Production Planning",
    desc: "Use consolidated demand signals to assess production batches, inventory allocation and capacity utilisation.",
    icon: Calendar
  },
  {
    num: "06",
    title: "Potential Logistics Efficiencies",
    desc: "Explore opportunities to optimise dispatches, freight and delivery planning when locations and schedules align.",
    icon: Truck
  },
  {
    num: "07",
    title: "More Efficient Sales Effort",
    desc: "Evaluate multiple compatible requirements through a consolidated sourcing opportunity, reducing repetitive prospecting effort.",
    icon: TrendingUp
  },
  {
    num: "08",
    title: "Improved Market Visibility",
    desc: "Understand aggregated demand patterns, product specifications and emerging opportunities from participating buyers.",
    icon: BarChart3
  },
  {
    num: "09",
    title: "Repeat-Business Potential",
    desc: "Build ongoing relationships with buyers whose requirements recur, subject to successful supply and commercial terms.",
    icon: Handshake
  },
  {
    num: "10",
    title: "Transparent Quotation Process",
    desc: "Submit structured offers with price breaks, minimum order quantities, delivery terms and validity, making proposals easier to evaluate.",
    icon: CheckCircle2
  }
];

export default function CollectiveBuyShowcase({ onOpenModal, onScrollToCatalog }) {
  // Parallax mouse effect on hero mesh
  const heroRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      setMousePos({ x, y });
    };

    const node = heroRef.current;
    if (node) {
      node.addEventListener("mousemove", handleMouseMove);
    }
    return () => {
      if (node) node.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const handleScrollToProducts = () => {
    if (onScrollToCatalog) {
      onScrollToCatalog();
      return;
    }
    const el =
      document.getElementById("collective-products-catalog") ||
      document.querySelector(".collective-showcase-wrap");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="cb-showcase-wrapper">
      {/* =========================================================================
          01. HERO & BRAND SECTION: Starts Cleanly from Top with 3 Messages & Jump Button
          ========================================================================= */}
      <section className="cb-hero-section" ref={heroRef}>
        {/* Animated Background Mesh & Arcs */}
        <div
          className="cb-hero-bg-network"
          aria-hidden="true"
          style={{
            transform: `translate3d(${mousePos.x * 14}px, ${mousePos.y * 14}px, 0)`
          }}
        >
          <svg className="cb-network-svg" viewBox="0 0 1200 600" preserveAspectRatio="none">
            <defs>
              <linearGradient id="cbGradCyan" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#087F82" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#BDECE4" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="cbGradOrange" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F47738" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#F47738" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Connecting Trade Arcs */}
            <path d="M 120,380 Q 360,120 620,240 T 1080,180" fill="none" stroke="url(#cbGradCyan)" strokeWidth="1.5" strokeDasharray="6 6" />
            <path d="M 80,220 Q 420,380 780,160 T 1140,320" fill="none" stroke="url(#cbGradCyan)" strokeWidth="1.2" strokeDasharray="4 4" />
            <path d="M 300,450 Q 550,220 900,380" fill="none" stroke="url(#cbGradOrange)" strokeWidth="1.2" />

            {/* Pulsing Trade Nodes */}
            <circle cx="120" cy="380" r="5" fill="#087F82" className="cb-pulse-node" />
            <circle cx="620" cy="240" r="6" fill="#F47738" className="cb-pulse-node delay-1" />
            <circle cx="1080" cy="180" r="5" fill="#BDECE4" className="cb-pulse-node delay-2" />
            <circle cx="420" cy="380" r="4" fill="#087F82" className="cb-pulse-node delay-3" />
            <circle cx="780" cy="160" r="5" fill="#F47738" className="cb-pulse-node delay-1" />
          </svg>
        </div>

        <div className="cb-hero-content-wrap">
          {/* Title Starts Cleanly from the Top */}
          {/* <div className="cb-hero-row">
            <h2 className="cb-hero-title">
              Synergy5M <span>CollectiveBuy</span>
            </h2>
            <button
              type="button"
              className="cb-btn-explore-active"
              onClick={handleScrollToProducts}
            >
              <span>Active Products for Aggregation</span>
              <ArrowDown size={17} className="cb-btn-arrow-bounce" />
            </button>
          </div> */}
          <div className="cb-hero-tagline">
            {/* Together We Buy Better. Together We Grow. */}
            <div className="cb-hero-title-group">
              <div className="section-kicker teal">04</div>
              <h2 className="cb-hero-title">
                Synergy5M <span>CollectiveBuy</span>
              </h2>
            </div>

            <div className="cb-hero-bottom-action">
              <button
                type="button"
                className="cb-btn-explore-active"
                onClick={handleScrollToProducts}
              >
                <span>Explore Active Products for Aggregation</span>
                <ArrowDown size={13} className="cb-btn-arrow-bounce" />
              </button>
            </div>
          </div>

          <p className="cb-hero-description">
            A smarter way for industrial buyers to combine demand and for suppliers to discover consolidated business opportunities.
          </p>

          {/* product for Aggregation */}

        </div>

        {/* Three Messages Made Prominent (3D Glass Cards inside Hero) */}
        <div className="cb-messages-grid">
          <div className="cb-message-card buyer">
            <div className="cb-message-card-top">
              <div className="cb-message-icon-box buyer">
                <Users size={18} />
              </div>
              <span className="cb-message-card-label buyer">For buyers</span>
            </div>
            <div className="cb-message-card-quote">
              "Your individual requirement. Our collective buying power."
            </div>
          </div>

          <div className="cb-message-card seller">
            <div className="cb-message-card-top">
              <div className="cb-message-icon-box seller">
                <TrendingUp size={18} />
              </div>
              <span className="cb-message-card-label seller">For sellers</span>
            </div>
            <div className="cb-message-card-quote">
              "See the demand. Quote the volume. Grow your market."
            </div>
          </div>

          <div className="cb-message-card everyone">
            <div className="cb-message-card-top">
              <div className="cb-message-icon-box everyone">
                <Globe size={18} />
              </div>
              <span className="cb-message-card-label everyone">For everyone</span>
            </div>
            <div className="cb-message-card-quote">
              "More connections. Better opportunities. Sustainable business growth."
            </div>
          </div>
        </div>

        {/* Small space & One Button at last to Explore Active Products for Aggregation */}

      </section>

      {/* =========================================================================
          02. FRONT-PAGE WEBSITE CONTENT: Why Buyers Choose & Why Suppliers Join
          ========================================================================= */}
      <SummarySection />


      {/* =========================================================================
          03. TEN MAJOR ADVANTAGES FOR BUYERS & SELLERS
          ========================================================================= */}
      {/* <section className="cb-advantages-section">
        <div className="cb-advantages-header">
          <div className="cb-advantages-title-wrap">
            <span className="cb-subheading-kicker">Professional Procurement Benchmarks</span>
            <h2 className="cb-advantages-title">Major Strategic Advantages</h2>
            <p className="cb-advantages-subtitle">
              Comprehensive advantages engineered for industrial procurement scale and commercial efficiency.
            </p>
          </div>

          <div className="cb-tabs-nav" role="tablist">
            <button
              type="button"
              className={`cb-tab-btn ${advantagesTab === "buyers" ? "active buyer" : ""}`}
              onClick={() => setAdvantagesTab("buyers")}
              role="tab"
              aria-selected={advantagesTab === "buyers"}
            >
              <Users size={15} />
              <span>Ten Major Advantages for Buyers</span>
              <span className="cb-tab-badge">10</span>
            </button>
            <button
              type="button"
              className={`cb-tab-btn ${advantagesTab === "sellers" ? "active seller" : ""}`}
              onClick={() => setAdvantagesTab("sellers")}
              role="tab"
              aria-selected={advantagesTab === "sellers"}
            >
              <Truck size={15} />
              <span>Ten Major Advantages for Sellers & Manufacturers</span>
              <span className="cb-tab-badge">10</span>
            </button>
          </div>
        </div>

        <div className="cb-advantages-grid">
          {advantagesTab === "buyers"
            ? BUYER_ADVANTAGES.map((adv) => {
              const IconComponent = adv.icon;
              return (
                <div key={adv.num} className="cb-adv-card buyer-theme">
                  <div className="cb-adv-top">
                    <span className="cb-adv-number">{adv.num}</span>
                    <div className="cb-adv-icon-wrap">
                      <IconComponent size={18} />
                    </div>
                  </div>
                  <div className="cb-adv-content">
                    <h4 className="cb-adv-title">{adv.title}</h4>
                    <p className="cb-adv-desc">{adv.desc}</p>
                  </div>
                </div>
              );
            })
            : SELLER_ADVANTAGES.map((adv) => {
              const IconComponent = adv.icon;
              return (
                <div key={adv.num} className="cb-adv-card seller-theme">
                  <div className="cb-adv-top">
                    <span className="cb-adv-number">{adv.num}</span>
                    <div className="cb-adv-icon-wrap">
                      <IconComponent size={18} />
                    </div>
                  </div>
                  <div className="cb-adv-content">
                    <h4 className="cb-adv-title">{adv.title}</h4>
                    <p className="cb-adv-desc">{adv.desc}</p>
                  </div>
                </div>
              );
            })}
        </div>
      </section> */}

      {/* =========================================================================
          04. SIMPLE. TRANSPARENT. BUSINESS-FOCUSED & GROUNDED CREDIBILITY NOTICE
          ========================================================================= */}
      {/* <section className="cb-transparency-card">
        <div className="cb-transparency-header">
          <ShieldCheck size={22} color="#087f82" />
          <h3 className="cb-transparency-title">Simple. Transparent. Business-focused.</h3>
        </div>
        <p className="cb-transparency-text">
          Buyers register and submit requirements without a registration fee. Suppliers submit offers against compatible demand.
          Each buyer places its own order and pays its supplier directly. Supplier success fees apply as agreed.
        </p>

       
        <div className="cb-integrity-notice">
          <ShieldAlert size={20} color="#087f82" className="cb-integrity-icon" />
          <div className="cb-integrity-text">
            <strong>Commercial Transparency & Credibility Notice: </strong>
            We avoid promising guaranteed savings, assured orders or guaranteed logistics reductions.
            Procurement advantages are presented as commercial opportunities that depend on aggregated quantities,
            compatible technical specifications, supplier offers, and actual buyer purchase commitments.
            This ensures grounded credibility and long-term trust for established industrial businesses as well as MSMEs.
          </div>
        </div>
      </section> */}
    </div>
  );
}
