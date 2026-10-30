import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Handshake,
  BadgePercent,
  Globe,
  SearchCheck,
  Scale,
  Building2,
  ShieldCheck,
  SlidersHorizontal,
  Boxes,
  TrendingUp,
  ClipboardCheck,
  Users,
  Factory,
  Truck,
  Eye,
  FileText
} from "lucide-react";
import "./SummarySection.css";

const BUYER_PILLARS = [
  {
    icon: Handshake,
    title: "Better Negotiating Power",
    desc: "Combine compatible purchasing requirements with other businesses to negotiate more competitive prices and commercial terms."
  },
  {
    icon: BadgePercent,
    title: "Access to Volume-Based Pricing",
    desc: "Benefit from supplier quotations based on aggregated demand and quantity slabs, where available."
  },
  {
    icon: Globe,
    title: "Wider Supplier Discovery",
    desc: "Explore domestic and international sourcing opportunities beyond your existing supplier network."
  },
  {
    icon: SearchCheck,
    title: "Reduced Sourcing Effort",
    desc: "Access consolidated opportunities and comparable offers without independently approaching every potential supplier."
  },
  {
    icon: Scale,
    title: "Improved Cost Visibility",
    desc: "Compare quotations, freight, delivery terms and other relevant costs to evaluate the overall procurement value."
  },
  {
    icon: Building2,
    title: "MSME-Friendly Procurement",
    desc: "Help small and medium businesses participate in sourcing opportunities that may otherwise be difficult to negotiate individually."
  },
  {
    icon: ShieldCheck,
    title: "Greater Supply Resilience",
    desc: "Identify alternative suppliers and reduce dependence on a single sourcing channel, subject to qualification."
  },
  {
    icon: SlidersHorizontal,
    title: "Independent Purchasing Control",
    desc: "Each buyer retains control over its supplier selection, purchase order, payment and agreed delivery arrangements."
  }
];

const SELLER_PILLARS = [
  {
    icon: Boxes,
    title: "Access to Aggregated Demand",
    desc: "View compatible buying requirements from multiple businesses through one consolidated opportunity."
  },
  {
    icon: TrendingUp,
    title: "Potential for Larger Order Volumes",
    desc: "Quote against combined demand instead of pursuing only isolated, small-volume enquiries."
  },
  {
    icon: ClipboardCheck,
    title: "Qualified Business Opportunities",
    desc: "Review product specifications, requested quantities, delivery locations and buying timelines before submitting an offer."
  },
  {
    icon: Users,
    title: "Reach New Industrial Buyers",
    desc: "Connect with businesses outside existing distribution and sales networks, including MSMEs."
  },
  {
    icon: Factory,
    title: "Better Production Planning",
    desc: "Use consolidated demand signals to assess production batches, inventory allocation and capacity utilisation."
  },
  {
    icon: Truck,
    title: "Potential Logistics Efficiencies",
    desc: "Explore opportunities to optimise dispatches, freight and delivery planning when locations and schedules align."
  },
  {
    icon: Eye,
    title: "Improved Market Visibility",
    desc: "Understand aggregated demand patterns, product specifications and emerging opportunities from participating buyers."
  },
  {
    icon: FileText,
    title: "Transparent Quotation Process",
    desc: "Submit structured offers with price breaks, minimum order quantities, delivery terms and validity, making proposals easier to evaluate."
  }
];

const renderCards = (list, kind) => (
  <div className="cb-summary-cards-grid">
    {list.map((item, index) => {
      const IconComponent = item.icon;
      return (
        <div key={index} className={`cb-summary-card cb-summary-card-${kind}`}>
          <div className={`cb-summary-icon-box cb-summary-icon-box-${kind}`}>
            <IconComponent size={18} />
          </div>
          <h4 className={`cb-summary-card-title cb-summary-card-title-${kind}`}>
            {item.title}
          </h4>
          <p className={`cb-summary-card-desc cb-summary-card-desc-${kind}`}>
            {item.desc}
          </p>
        </div>
      );
    })}
  </div>
);

export default function SummarySection() {
  const [pos, setPos] = useState(50);
  const containerRef = useRef(null);
  const isDraggingRef = useRef(false);
  const animFrameIdRef = useRef(null);

  const cancelIntroAnimation = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    let startTime = null;
    const duration = 1400;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const swing = Math.sin(progress * Math.PI * 2.5) * (1 - progress) * 18;
      setPos(50 + swing);

      if (progress < 1) {
        animFrameIdRef.current = requestAnimationFrame(animate);
      } else {
        setPos(50);
        animFrameIdRef.current = null;
      }
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, []);

  const updatePosFromPointer = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const offsetX = clientX - rect.left;
    const clampedPos = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
    setPos(clampedPos);
  }, []);

  const handlePointerDown = (e) => {
    cancelIntroAnimation();
    isDraggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}
    updatePosFromPointer(e.clientX);
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    updatePosFromPointer(e.clientX);
  };

  const handlePointerUp = (e) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch (err) {}
    }
  };

  const handlePointerCancel = (e) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch (err) {}
    }
  };

  const handleKeyDown = (e) => {
    cancelIntroAnimation();
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setPos((prev) => Math.max(0, prev - 5));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setPos((prev) => Math.min(100, prev + 5));
    }
  };

  return (
    <section className="cb-summary-wrapper">
      <div
        ref={containerRef}
        className="cb-summary-container"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div className="cb-summary-layer cb-summary-layer-supplier">
          <div className="cb-summary-tag cb-summary-tag-supplier">
            <Truck size={16} />
            <span>Why Suppliers Join CollectiveBuy</span>
          </div>
          {renderCards(SELLER_PILLARS, "seller")}
        </div>

        <div
          className="cb-summary-layer cb-summary-layer-buyer"
          style={{
            clipPath: `inset(0 ${100 - pos}% 0 0)`,
            WebkitClipPath: `inset(0 ${100 - pos}% 0 0)`
          }}
        >
          <div className="cb-summary-tag cb-summary-tag-buyer">
            <Users size={16} />
            <span>Why Buyers Choose CollectiveBuy</span>
          </div>
          {renderCards(BUYER_PILLARS, "buyer")}
        </div>

        <div
          className="cb-summary-divider"
          style={{ left: `${pos}%` }}
        >
          <div
            className="cb-summary-grip"
            role="slider"
            tabIndex={0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pos)}
            aria-label="Drag to compare buyer and supplier advantages"
            onKeyDown={handleKeyDown}
          >
            <span className="cb-summary-grip-symbol" aria-hidden="true">
              ⇄
            </span>
          </div>
        </div>
      </div>

      <div className="cb-summary-hint">
        Drag the handle to compare buyer and supplier advantages
      </div>
    </section>
  );
}

export { BUYER_PILLARS, SELLER_PILLARS, SummarySection };

