import React, { useState } from "react";
import {
  ArrowRight,
  Boxes,
  BriefcaseBusiness,
  Check,
  Factory,
  Handshake,
  Menu,
  Package,
  Users,
  WalletCards,
  X,
  ShoppingCart,
  ShieldCheck,
  Truck,
  Target,
  Cog,
  Landmark,
  FileCheck2,
  Building2,
  UserCheck,
  ClipboardCheck,
  CircleDollarSign,
  BadgeCheck,
} from "lucide-react";
import Logo from "./logo (1).png";
import "./NewLandingPage.css";

const consulting = {
  Marketing: {
    Icon: Target,
    tagline: "Right Market. Right Strategy. Right Growth.",
    intro:
      "We help businesses understand where the next opportunity lies and how to convert market potential into sustainable revenue.",
    focus: [
      "Market Research & Opportunity Analysis",
      "Customer & Market Segmentation",
      "Brand Positioning",
      "Go-to-Market Strategy",
      "Sales & Distribution Strategy",
      "New Product / Market Development",
      "Customer Acquisition",
      "Marketing Performance & ROI",
    ],
    outcomes: [
      "Stronger Market Presence",
      "Higher Customer Acquisition",
      "Increased Sales",
      "Better Market Penetration",
      "Improved Marketing ROI",
      "Sustainable Business Growth",
    ],
  },
  Materials: {
    Icon: Package,
    tagline: "Right Material. Right Source. Right Cost.",
    intro:
      "We help businesses improve sourcing, procurement and inventory while building stronger and more reliable supply chains.",
    focus: [
      "Strategic Sourcing & Procurement",
      "Vendor Identification & Development",
      "Alternate Source Development",
      "Purchase Cost Optimisation",
      "Raw Material Market Intelligence",
      "Inventory Optimisation",
      "Supplier Performance Management",
      "Import / Export Sourcing",
      "Working Capital Optimisation",
    ],
    outcomes: [
      "Lower Purchase Cost",
      "Reliable & Alternate Sources",
      "Reduced Inventory Investment",
      "Improved Working Capital",
      "Better Supply Continuity",
      "Stronger Supplier Network",
    ],
  },
  Manpower: {
    Icon: Users,
    tagline: "Right People. Right Skills. Right Productivity.",
    intro:
      "We help businesses build accountability, productivity and capability while reducing excessive dependency on individuals.",
    focus: [
      "Organisation Structure",
      "Manpower Planning",
      "Roles & Responsibilities",
      "Recruitment & Talent Identification",
      "Skill Gap Analysis",
      "Training & Capability Development",
      "Performance Management",
      "Productivity Improvement",
      "Employee Retention",
      "Succession Planning",
    ],
    outcomes: [
      "Higher Employee Productivity",
      "Better Accountability",
      "Improved Skill Utilisation",
      "Reduced Individual Dependency",
      "Lower Manpower Cost",
      "Stronger Leadership Pipeline",
    ],
  },
  Machines: {
    Icon: Cog,
    tagline: "Right Technology. Right Capacity. Right Productivity.",
    intro:
      "We help businesses ensure their machines and technology deliver maximum productivity and return on investment.",
    focus: [
      "Capacity Utilisation Analysis",
      "Machine Productivity",
      "OEE Improvement",
      "Bottleneck Identification",
      "Machine Selection & Evaluation",
      "Automation Opportunities",
      "Preventive & Predictive Maintenance",
      "Energy Efficiency",
      "Process Improvement",
      "CAPEX Evaluation & ROI",
    ],
    outcomes: [
      "Higher Machine Utilisation",
      "Increased Production Capacity",
      "Reduced Downtime",
      "Lower Manufacturing Cost",
      "Improved Product Quality",
      "Better Return on Investment",
    ],
  },
  Money: {
    Icon: WalletCards,
    tagline: "Right Capital. Right Control. Right Returns.",
    intro:
      "We help management understand where money is invested, where it is blocked and where profitability can be improved.",
    focus: [
      "Working Capital Management",
      "Cash Flow Management",
      "Cost & Profitability Analysis",
      "Product Profitability",
      "Customer Profitability",
      "Receivables & Payables",
      "Inventory Investment",
      "Budgeting & Financial Planning",
      "Cost Reduction",
      "CAPEX & Investment Evaluation",
      "Management MIS",
      "Decision Support",
    ],
    outcomes: [
      "Improved Cash Flow",
      "Reduced Working Capital",
      "Higher Profitability",
      "Better Cost Control",
      "Faster Receivables",
      "Improved ROI",
      "Better Management Decisions",
    ],
  },
};

const erpModules = [
  {
    title: "Material Management",
    Icon: Package,
    tagline: "Buy Better. Stock Smarter. Control Your Cost.",
    covers: [
      "Purchase Requisition",
      "Enquiry & Quotation Comparison",
      "Purchase Order",
      "Supplier Management",
      "Material Receipt",
      "GRN",
      "Quality Hold / Release",
      "Stores & Inventory",
      "Batch / Lot Tracking",
      "Stock Transfer",
      "Material Issue",
      "Consumption",
      "Reorder / Minimum Stock",
      "Inventory Valuation",
      "Supplier Performance",
    ],
    advantage:
      "Know what you are buying, from whom, at what cost, what is lying in stock and where your money is blocked.",
  },
  {
    title: "Sales & Distribution",
    Icon: ShoppingCart,
    tagline: "From Enquiry to Collection — One Connected Sales Cycle.",
    covers: [
      "Customer Master",
      "Enquiry Management",
      "Quotation",
      "Price Management",
      "Sales Order",
      "Order Status",
      "Availability / Commitment",
      "Dispatch Planning",
      "Delivery",
      "Invoicing",
      "Customer Outstanding",
      "Sales Analysis",
      "Customer Profitability",
      "Sales MIS",
    ],
    advantage:
      "Know not only how much you sold — know what you sold, to whom, at what margin and what is still to be collected.",
  },
  {
    title: "Production Management",
    Icon: Factory,
    tagline: "Plan Better. Produce Better. Waste Less.",
    covers: [
      "Production Planning",
      "Production Orders",
      "BOM / Product Structure",
      "Material Requirement",
      "Work-in-Progress",
      "Material Consumption",
      "Production Output",
      "Process Tracking",
      "Rejection",
      "Rework",
      "Machine / Capacity Planning",
      "Production Costing",
      "Production MIS",
    ],
    advantage:
      "See what should be produced, what is being produced, what material is consumed and where production efficiency is being lost.",
  },
  {
    title: "Quality Management",
    Icon: ShieldCheck,
    tagline: "Quality Built Into the Process — Not Checked Only at the End.",
    covers: [
      "Incoming Material Inspection",
      "In-Process Inspection",
      "Final Inspection",
      "Quality Parameters",
      "Specification Management",
      "Acceptance / Rejection",
      "Non-Conformance",
      "Rework",
      "Rejection Analysis",
      "Supplier Quality",
      "Customer Complaints",
      "Quality MIS",
      "Traceability",
    ],
    advantage:
      "Move from “detecting defects” to understanding why defects happen and where they originate.",
  },
  {
    title: "HR & Manpower Management",
    Icon: Users,
    tagline: "Right People. Right Responsibility. Right Productivity.",
    covers: [
      "Employee Master",
      "Organisation Structure",
      "Department / Designation",
      "Attendance",
      "Leave",
      "Shift Management",
      "Employee Documents",
      "Payroll Inputs",
      "Performance Parameters",
      "Training Records",
      "Skill Matrix",
      "Manpower MIS",
    ],
    advantage:
      "Know who is responsible, what capability exists, where the skill gaps are and where manpower productivity can improve.",
  },
  {
    title: "Accounts & Finance",
    Icon: Landmark,
    tagline: "Don't Just Record Money. Understand Your Money.",
    covers: [
      "Chart of Accounts",
      "General Ledger",
      "Accounts Payable",
      "Accounts Receivable",
      "Customer Outstanding",
      "Supplier Outstanding",
      "Receipts & Payments",
      "Bank / Cash",
      "Costing",
      "Profitability",
      "Tax-related accounting processes",
      "Financial MIS",
      "Management Reports",
    ],
    advantage:
      "Know where your money is earned, where it is blocked, where costs are increasing and where profitability can improve.",
  },
];

const connectSteps = [
  "Register",
  "Post",
  "Verify",
  "Match",
  "Qualify",
  "Confidential Enquiry",
  "Negotiate",
  "Confirm",
  "Connect",
  "PO",
  "Success Fee",
];

const existingClients = [
  {
    id: 1,
    name: "Shripad Polymer",
    logo: "https://shripad-syn8erp.azurewebsites.net/Images/Shripad%20LOGO.png",
  },
  {
    id: 2,
    name: "Vistta",
    logo: "https://synergy5m-visttaerp8-uat.azurewebsites.net/Images/VistaLOGOEdited.JPG",
  },
  {
    id: 3,
    name: "Chemikar",
    logo: "https://synergy5m-chemikarerp8.azurewebsites.net/Images/Logo(1).jpg",
  },
  {
    id: 4,
    name: "Swami Samarth",
    logo: "https://synergy5m-swamisamartherp8.azurewebsites.net/Images/SwamiSamarthLogo.png",
  },
];

const buyerRoles = [
  "Owner / Promoter",
  "Director",
  "Partner",
  "Purchase Head",
  "Procurement Manager",
  "Senior Purchase Executive",
  "Supply Chain Head",
  "Other authorised senior employee",
];

const sellerRoles = [
  "Owner / Promoter",
  "Director",
  "Partner",
  "Sales Head",
  "Business Development Head",
  "Marketing Head",
  "Senior Sales Executive",
  "Export Head",
  "Other authorised senior employee",
];

function Field({ label, children, required = false, hint, className = "" }) {
  return (
    <label className={`form-field ${className}`.trim()}>
      <span>
        {label}
        {required && <em> *</em>}
      </span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function CompanyVerificationFields() {
  return (
    <>
      <div className="form-section-title">
        <Building2 size={18} /> Company & Verification
      </div>
      <div className="form-grid three">
        <Field label="Company Name" required>
          <input
            required
            name="companyName"
            placeholder="Registered company name"
          />
        </Field>
        <Field
          label="GSTIN"
          required
          hint="Required for registration eligibility"
        >
          <input
            required
            name="gstin"
            pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]"
            title="Enter a valid 15-character GSTIN"
            placeholder="15-character GSTIN"
          />
        </Field>
        <Field label="CIN / LLPIN">
          <input
            name="cin"
            pattern="[A-Za-z0-9-]{6,30}"
            title="Enter your CIN or LLPIN"
            placeholder="CIN or LLPIN"
          />
        </Field>
        <Field label="Registered Address" required>
          <input required name="address" placeholder="Registered address" />
        </Field>
        <Field label="Company Website">
          <input name="website" type="url" placeholder="https://" />
        </Field>
        <Field label="Company Email" required>
          <input
            required
            name="companyEmail"
            type="email"
            placeholder="official@company.com"
          />
        </Field>
        <Field label="Official Mobile Number" required>
          <input
            required
            name="mobile"
            type="tel"
            pattern="[0-9+() -]{10,16}"
            placeholder="Official business number"
          />
        </Field>
        <Field label="Industry" required>
          <input required name="industry" placeholder="Industry / sector" />
        </Field>
        <Field label="Company Type" required>
          <select required name="companyType" defaultValue="">
            <option value="" disabled>
              Select company type
            </option>
            <option>Private Limited</option>
            <option>Public Limited</option>
            <option>LLP</option>
            <option>Partnership</option>
            <option>Proprietorship</option>
            <option>Other registered business</option>
          </select>
        </Field>
        <Field label="Years in Business">
          <input name="years" type="number" min="0" placeholder="Years" />
        </Field>
      </div>
      <div className="verification-note">
        <FileCheck2 size={18} />
        <div>
          <b>Business verification</b>
          <span>
            Registration is intended for eligible registered businesses. GSTIN
            and CIN / LLPIN are mandatory fields; final verification should be
            completed by Synergy5M before a lead is activated.
          </span>
        </div>
      </div>
    </>
  );
}

function RegistrationBlock({ type }) {
  const roles = type === "buyer" ? buyerRoles : sellerRoles;
  return (
    <>
      <CompanyVerificationFields />
      <div className="form-section-title">
        <UserCheck size={18} /> Authorised Representative
      </div>
      <div className="form-grid three">
        <Field label="Full Name" required>
          <input
            required
            name="representativeName"
            placeholder="Authorised person's name"
          />
        </Field>
        <Field label="Designation / Business Role" required>
          <select required name="role" defaultValue="">
            <option value="" disabled>
              Select your role
            </option>
            {roles.map((role) => (
              <option key={role}>{role}</option>
            ))}
          </select>
        </Field>
        <Field label="Representative Email" required>
          <input
            required
            name="representativeEmail"
            type="email"
            placeholder="Work email"
          />
        </Field>
        <Field label="Representative Mobile" required>
          <input
            required
            name="representativeMobile"
            type="tel"
            placeholder="Work mobile"
          />
        </Field>
      </div>
      <label className="authority-check">
        <input required type="checkbox" name="authority" />
        <span>
          I confirm that I am authorised by the organisation to submit business
          requirements / offers through Synergy5M Business Connect.
        </span>
      </label>
    </>
  );
}

function CommissionBlock() {
  return (
    <div className="commission-box">
      <div className="form-section-title">
        <CircleDollarSign size={18} /> Business Commission / Success Fee
      </div>
      <p>
        What commercial commission can your company offer Synergy5M if this
        business is successfully concluded through our introduction?
      </p>
      <div className="form-grid three">
        <Field label="Commission Type">
          <select name="commissionType" defaultValue="">
            <option value="" disabled>
              Select
            </option>
            <option>Percentage of Purchase Order Value</option>
            <option>Fixed Amount</option>
            <option>Per Unit</option>
            <option>Other</option>
          </select>
        </Field>
        <Field label="Proposed Commission">
          <input name="proposedCommission" placeholder="% / ₹ amount" />
        </Field>
        <Field label="Commission Applicable On">
          <select name="commissionApplicableOn" defaultValue="">
            <option value="" disabled>
              Select
            </option>
            <option>First Purchase Order</option>
            <option>Every Purchase Order for agreed period</option>
            <option>Entire business relationship for agreed period</option>
            <option>Other agreed arrangement</option>
          </select>
        </Field>
      </div>
      <small>
        The final commercial terms will be mutually agreed and documented before
        disclosure of the parties' identities / commercial contact details.
      </small>
    </div>
  );
}

function BuyerForm() {
  return (
    <>
      <RegistrationBlock type="buyer" />
      <div className="form-section-title">
        <ClipboardCheck size={18} /> Post a Buying Requirement
      </div>
      <div className="form-grid three">
        <Field label="Product Category" required>
          <input name="productCategory" required placeholder="Category" />
        </Field>
        <Field label="Product Name" required>
          <input name="productName" required placeholder="Product name" />
        </Field>
        <Field label="Application / End Use" required>
          <input
            name="application"
            required
            placeholder="Application / end use"
          />
        </Field>
        <Field label="Grade / Model">
          <input name="gradeModel" placeholder="Grade or model" />
        </Field>
        <Field label="Brand Preference">
          <input name="brandPreference" placeholder="Preferred brand, if any" />
        </Field>
        <Field label="HSN Code">
          <input name="hsnCode" placeholder="HSN code" />
        </Field>
        <Field label="Required Certification / Standard">
          <input
            name="requiredCertification"
            placeholder="Certification / standard"
          />
        </Field>
        <Field label="Required Quantity" required>
          <input name="requiredQuantity" required placeholder="Quantity" />
        </Field>
        <Field label="Unit" required>
          <input name="unit" required placeholder="MT / Nos / Kg / etc." />
        </Field>
        <Field label="Requirement Frequency">
          <select name="requirementFrequency" defaultValue="">
            <option value="" disabled>
              Select
            </option>
            <option>One-Time</option>
            <option>Recurring</option>
            <option>Monthly</option>
            <option>Quarterly</option>
            <option>Annual</option>
          </select>
        </Field>
        <Field label="Expected Price Range">
          <input name="expectedPriceRange" placeholder="Price range" />
        </Field>
        <Field label="Target Price">
          <input name="targetPrice" placeholder="Target price" />
        </Field>
        <Field label="Currency">
          <input name="currency" placeholder="INR / USD / etc." />
        </Field>
        <Field label="Payment Terms Expected">
          <input name="paymentTermsExpected" placeholder="Payment terms" />
        </Field>
        <Field label="Credit Period">
          <input name="creditPeriod" placeholder="Credit period" />
        </Field>
        <Field label="Delivery Location" required>
          <input
            name="deliveryLocation"
            required
            placeholder="City / State / Country"
          />
        </Field>
        <Field label="Required Delivery Date" required>
          <input name="requiredDeliveryDate" required type="date" />
        </Field>
        <Field label="Preferred Incoterm">
          <input name="preferredIncoterm" placeholder="If applicable" />
        </Field>
        <Field label="Domestic / Import Requirement">
          <select name="domesticOrImport" defaultValue="">
            <option value="" disabled>
              Select
            </option>
            <option>Domestic</option>
            <option>Import</option>
            <option>Either</option>
          </select>
        </Field>
        <Field label="Supplier Preference">
          <select name="supplierPreference" defaultValue="">
            <option value="" disabled>
              Select
            </option>
            <option>Manufacturer</option>
            <option>Authorised Distributor</option>
            <option>Exporter</option>
            <option>Trader</option>
            <option>OEM</option>
            <option>Any suitable supplier</option>
          </select>
        </Field>
        <Field label="Preferred Origin / Country">
          <input name="preferredOrigin" placeholder="Preferred origin" />
        </Field>
        <Field label="Certifications Required">
          <input
            name="certificationsRequired"
            placeholder="Required supplier certifications"
          />
        </Field>
        <Field label="Minimum Supplier Experience">
          <input
            name="minSupplierExperience"
            placeholder="Years / experience"
          />
        </Field>
        <Field label="Specification / RFQ / Drawing / BOQ">
          <input name="attachment" type="file" />
        </Field>

        <div className="textarea-row">
          <Field label="Technical Specification" required>
            <textarea
              name="technicalSpecification"
              required
              rows="3"
              placeholder="Technical specification"
            />
          </Field>
          <Field label="Additional Information">
            <textarea
              name="additionalInfo"
              rows="3"
              placeholder="Additional remarks"
            />
          </Field>
        </div>
      </div>
      <CommissionBlock />
    </>
  );
}

function SellerForm() {
  return (
    <>
      <RegistrationBlock type="seller" />
      <div className="form-section-title">
        <Factory size={18} /> List Your Product / Selling Opportunity
      </div>
      <div className="form-grid three">
        <Field label="Product Name" required>
          <input name="productName" required placeholder="Product name" />
        </Field>
        <Field label="Product Category" required>
          <input name="productCategory" required placeholder="Category" />
        </Field>
        <Field label="Manufacturer / Supplier" required>
          <input
            name="manufacturerSupplier"
            required
            placeholder="Manufacturer / supplier"
          />
        </Field>
        <Field label="Grade / Model" required>
          <input name="gradeModel" required placeholder="Grade / model" />
        </Field>
        <Field label="Application">
          <input name="application" placeholder="Application" />
        </Field>
        <Field label="HSN Code">
          <input name="hsnCode" placeholder="HSN code" />
        </Field>

        <div className="textarea-row">
          <Field label="Product Description" required>
            <textarea
              name="productDescription"
              required
              rows="3"
              placeholder="Product description"
            />
          </Field>
          <Field label="Technical Specification" required>
            <textarea
              name="technicalSpecification"
              required
              rows="3"
              placeholder="Technical specification"
            />
          </Field>
        </div>

        <Field label="Capacity">
          <input name="capacity" placeholder="Capacity" />
        </Field>
        <Field label="Production Capacity">
          <input name="productionCapacity" placeholder="Production capacity" />
        </Field>
        <Field label="Available Capacity">
          <input name="availableCapacity" placeholder="Available capacity" />
        </Field>
        <Field label="MOQ">
          <input name="moq" placeholder="Minimum order quantity" />
        </Field>
        <Field label="Monthly Capacity">
          <input name="monthlyCapacity" placeholder="Monthly capacity" />
        </Field>
        <Field label="Lead Time">
          <input name="leadTime" placeholder="Lead time" />
        </Field>
        <Field label="Indicative Price / Price Range">
          <input name="indicativePrice" placeholder="Price / range" />
        </Field>
        <Field label="Currency">
          <input name="currency" placeholder="INR / USD / etc." />
        </Field>
        <Field label="Payment Terms">
          <input name="paymentTerms" placeholder="Payment terms" />
        </Field>
        <Field label="Credit Terms">
          <input name="creditTerms" placeholder="Credit terms" />
        </Field>
        <Field label="Domestic / Export">
          <select name="domesticOrExport" defaultValue="">
            <option value="" disabled>
              Select
            </option>
            <option>Domestic</option>
            <option>Export</option>
            <option>Both</option>
          </select>
        </Field>
        <Field label="Geography">
          <input name="geography" placeholder="Target geography" />
        </Field>
        <Field label="Supply Locations">
          <input name="supplyLocations" placeholder="Supply locations" />
        </Field>
        <Field label="Countries Served">
          <input name="countriesServed" placeholder="Countries served" />
        </Field>
        <Field label="Preferred Buyer Location">
          <input
            name="preferredBuyerLocation"
            placeholder="Preferred buyer location"
          />
        </Field>
        <Field label="Years in Business">
          <input name="sellerYearsInBusiness" placeholder="Years" />
        </Field>
        <Field label="Certifications">
          <input name="certifications" placeholder="Certifications" />
        </Field>
        <Field label="Major Industries Served">
          <input name="majorIndustriesServed" placeholder="Industries served" />
        </Field>
        <Field label="OEM Capability">
          <select name="oemCapability" defaultValue="">
            <option value="" disabled>
              Select
            </option>
            <option>Yes</option>
            <option>No</option>
          </select>
        </Field>
        <Field label="Private Label Capability">
          <select name="privateLabelCapability" defaultValue="">
            <option value="" disabled>
              Select
            </option>
            <option>Yes</option>
            <option>No</option>
          </select>
        </Field>
        <Field label="Upload TDS / Catalogue / Images / Certifications / Company Profile">
          <input name="documents" type="file" multiple />
        </Field>
      </div>
      <CommissionBlock />
    </>
  );
}

function Modal({ close, children, title, subtitle, wide = false }) {
  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className={`modal ${wide ? "modal-wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={close} type="button">
          <X />
        </button>
        <span className="section-kicker orange">SYNERGY5M LLP</span>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

function NewLandingPage() {
  const [activeConsulting, setActiveConsulting] = useState("Marketing");
  const [activeERP, setActiveERP] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modal, setModal] = useState(null);

  const scrollTo = (id) => {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileOpen(false);
  };

  const closeModal = () => setModal(null);

const submitForm = async (e, formType) => {
    e.preventDefault();
    const formElement = e.target;
    const formData = new FormData(formElement);

    let endpoint = "/api/inquiries";
    let isMultipart = false;

    if (formType === "buyer" || formType === "seller") {
      endpoint = "/api/business-connect";
      isMultipart = true;
      formData.append("category", formType === "buyer" ? "Buyer" : "Seller");
    } else if (formType === "demo") {
      endpoint = "/api/demo-request";
    } else if (formType === "trial") {
      endpoint = "/api/trial-request";
    }

    try {
      let response;
      if (isMultipart) {
        response = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });
      } else {
        const jsonObject = Object.fromEntries(formData.entries());
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(jsonObject),
        });
      }

      const result = await response.json();
      if (response.ok && result.success) {
        window.alert(
          result.message ||
            "Thank you. Your request has been submitted for review by Synergy5M.",
        );
        closeModal();
      } else {
        window.alert(
          "Submission error: " + (result.message || "Failed to submit."),
        );
      }
    } catch (err) {
      console.error("Submission failed:", err);
      window.alert(
        "Server error. Please ensure the backend server is reachable.",
      );
    }
  };

  const [trialStartDate, setTrialStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [trialPlan, setTrialPlan] = useState("7 Days Trial");

  const getTrialEndDate = (startDate, plan) => {
    if (!startDate) return "";
    const start = new Date(startDate);
    let days = 7;
    if (plan === "15 Days Trial") days = 15;
    if (plan === "Paid Plan") days = 365;
    start.setDate(start.getDate() + days);
    return start.toISOString().split("T")[0];
  };
  const openERP = (module) => setActiveERP(module);

  return (
    <div className="synergy-site">
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => scrollTo("home")}
            aria-label="Synergy5M home"
          >
            <img src={Logo} alt="Synergy5M" />
          </button>

          <button
            className="mobile-menu"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X /> : <Menu />}
          </button>

          <nav className={mobileOpen ? "main-nav open" : "main-nav"}>
            <button onClick={() => scrollTo("home")}>HOME</button>

            <button onClick={() => scrollTo("consulting")}>
              MANAGEMENT CONSULTING
            </button>

            {/* ERP Software & Registered User Link */}
            <div className="nav-item-dropdown">
              <button onClick={() => scrollTo("erp")}>ERP SOFTWARE</button>
              <a
                href="https://synergy5m-shripaderp8-bvgth5fuf2a4drgq.centralindia-01.azurewebsites.net/Login/Login"
                target="_blank"
                rel="noopener noreferrer"
                className="registered-user-btn"
              >
                Registered User
              </a>
            </div>

            {/* Buying & Selling & Registered User Link */}
            <div className="nav-item-dropdown">
              <button onClick={() => scrollTo("connect")}>BUYING & SELLING</button>
              <a
                href="https://synergy5m-business-4-profit-platform.azurewebsites.net/Login/Login"
                target="_blank"
                rel="noopener noreferrer"
                className="registered-user-btn"
              >
                Registered User
              </a>
            </div>

            <button onClick={() => scrollTo("about")}>ABOUT US</button>
            <button onClick={() => scrollTo("contact")}>CONTACT US</button>

            <button className="expert-btn" onClick={() => setModal("expert")}>
              Talk to an Expert <ArrowRight size={15} />
            </button>
          </nav>
        </div>
      </header>

      <main>
        <section id="home" className="hero section-wrap">
          <div className="hero-copy">
            <div className="eyebrow">SYNERGY5M LLP BUSINESS SOLUTIONS</div>
            <h1>One Partner.</h1>
            <h3 className="text-danger">Three Powerful Solutions.</h3>
            <h2>Unlimited Possibilities.</h2>
            <p>
              Empowering businesses with <b>Consulting Excellence</b>,{" "}
              <b>Intelligent ERP</b> and <b>Strong Industry Connections.</b>
            </p>
            <div className="hero-points">
              <div>
                <span>
                  <BriefcaseBusiness />
                </span>
                <b>Industry Experience</b>
                <small>Deep understanding across sectors</small>
              </div>
              <div>
                <span>
                  <ShieldCheck />
                </span>
                <b>Proven Expertise</b>
                <small>Solutions that deliver measurable results</small>
              </div>
              <div>
                <span>
                  <Target />
                </span>
                <b>Growth Focused</b>
                <small>Helping businesses grow sustainably</small>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <img
              src="/hero-business.png"
              alt="Business, technology and connections"
            />
          </div>
        </section>

        <section
          id="consulting"
          className="consulting section-wrap dark-anchor"
        >
          <div className="section-kicker orange">01</div>
          <div className="consulting-heading">
            <div>
              <h2> MANAGEMENT CONSULTING</h2>
              <h3>The 5M Framework for Business Excellence</h3>
              <p>
                We help businesses optimise every critical element of their
                operations through our proven 5M approach — for stronger
                performance, higher productivity and sustainable growth.
              </p>
              {/* <button
                className="white-btn"
                onClick={() => setModal("consulting")}
              >
                Explore Consulting <ArrowRight size={17} />
              </button> */}
            </div>
            <img src="/consulting-dart.png" alt="Business target" />
          </div>
          <div className="consulting-tabs">
            {Object.entries(consulting).map(([name, item]) => {
              const TabIcon = item.Icon;
              return (
                <button
                  key={name}
                  className={activeConsulting === name ? "active" : ""}
                  onClick={() => setActiveConsulting(name)}
                >
                  <span>
                    <TabIcon size={20} />
                  </span>
                  <b>{name}</b>
                </button>
              );
            })}
          </div>
          <div className="consulting-content">
            <div>
              <p className="mini-label">{activeConsulting.toUpperCase()}</p>
              <h3>{consulting[activeConsulting].tagline}</h3>
              <p className="consulting-intro">
                {consulting[activeConsulting].intro}
              </p>
              <ul>
                {consulting[activeConsulting].focus.slice(0, 6).map((x) => (
                  <li key={x}>
                    <Check size={16} />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <aside>
              <h4>Key Outcomes</h4>
              {consulting[activeConsulting].outcomes.slice(0, 5).map((x) => (
                <p key={x}>
                  <Check size={15} />
                  {x}
                </p>
              ))}
            </aside>
          </div>
        </section>

        <section id="erp" className="erp section-wrap dark-anchor">
          <div className="section-kicker blue">02</div>
          <div className="erp-intro">
            <div>
              <h2> ERP SOFTWARE</h2>
              <h3>Your Business. Your ERP. Your Brand.</h3>
              <p>
                A powerful, integrated ERP software designed for MSMEs to
                automate operations, improve control and drive growth.
              </p>
              <button className="expert-btn" onClick={() => setModal("demo")}>
                Book a Demo <ArrowRight size={15} />
              </button>
            </div>
            <img src="/erp-dashboard.png" alt="SYN ERP 10 dashboard" />
          </div>
          <div className="erp-highlights">
            <div>
              <ShieldCheck />
              <b>White Label ERP</b>
              <small>Your brand, your logo, your identity</small>
            </div>
            <div>
              <Users />
              <b>Unlimited Users</b>
              <small>No per-user restrictions</small>
            </div>
            <div>
              <Boxes />
              <b>Cloud Based</b>
              <small>Secure, reliable access</small>

              
            </div>
          </div>
          <div className="erp-module-box">
            <div>
              <h3>Powerful Modules. Complete Coverage.</h3>
              <div className="erp-grid">
                {erpModules.map((module) => {
                  const ModuleIcon = module.Icon;
                  return (
                    <button
                      className="erp-module-card"
                      key={module.title}
                      onClick={() => openERP(module)}
                    >
                      <span>
                        <ModuleIcon size={24} />
                      </span>
                      <b>{module.title}</b>
                      <small className="fw-600">
                        {module.covers.slice(0, 4).join(" • ")}
                      </small>
                      <span className="view-details">
                        View details <ArrowRight size={12} />
                      </span>
                      
                    </button>
                  );
                })}
              </div>
            </div>
            <aside>
              <h4>SYN ERP 10 Highlights</h4>
              {[
                "Master Driven & Easy to Use",
                "Real-time MIS & Dashboards",
                "Mobile Friendly Access",
                "Advanced Security",
                "Scalable & Flexible",
                "Cost Effective Solution",
              ].map((x) => (
                <p key={x}>
                  <Check size={14} />
                  {x}
                </p>
              ))}
              <button className="blue-btn" onClick={() => setModal("TRail")}>
                Request a Trail
              </button>
            </aside>
          </div>
        </section>

        <section id="connect" className="connect section-wrap dark-anchor">
          <div className="section-kicker teal">03</div>
          <div className="connect-heading">
            <div>
              <h2>
                Buyer & Sellers
                <br />
                BUYERS TO POTENTIAL SELLERS
              </h2>
              <h3>
                Bridging Requirements. Building Relationships. Creating Value.
              </h3>
              <p>
                We leverage our industry experience and strong connections to
                help buyers find the right suppliers and help sellers connect
                with the right buyers.
              </p>
              <button className="white-btn" onClick={() => setModal("connect")}>
                Connect with Us <ArrowRight size={17} />
              </button>
            </div>
            <img src="/connect-network.png" alt="Business connections" />
          </div>
          <div className="connect-cards">
            <article>
              <ShoppingCart />
              <h3>For Buyers</h3>
              <p>
                Access verified suppliers and competitive offers while keeping
                your requirement confidential during the initial stages.
              </p>
              <ul>
                <li>Access to Pre-verified Suppliers</li>
                <li>Competitive Offers & Best Pricing</li>
                <li>Quality & Timely Delivery Assurance</li>
                <li>Reduced Sourcing Time & Effort</li>
                <li>End-to-End Support</li>
              </ul>
              <button onClick={() => setModal("buyer")}>
                Post Your Requirement
              </button>
            </article>
            <article>
              <Truck />
              <h3>For Sellers</h3>
              <p>
                Connect with genuine buyers and expand your business
                opportunities through qualified requirements.
              </p>
              <ul>
                <li>Connect with Genuine Buyers</li>
                <li>Increase Business Opportunities</li>
                <li>Broaden Market Reach</li>
                <li>Build Long-term Relationships</li>
                <li>Growth With Expert Support</li>
              </ul>
              <button onClick={() => setModal("seller")}>
                List Your Products
              </button>
            </article>
            <article>
              <Handshake />
              <h3>Our Advantage</h3>
              <p>
                Not just a directory — industry experience plus technology to
                qualify and facilitate business.
              </p>
              <ul>
                <li>Deep Industry Experience</li>
                <li>Strong Network & Connections</li>
                <li>Market Intelligence & Insights</li>
                <li>Trusted & Transparent Process</li>
                <li>Win-Win Partnerships</li>
              </ul>
              <button onClick={() => setModal("expert")}>
                Know Our Expertise
              </button>
            </article>
            <aside>
              <b>1000+</b>
              <span>Trusted Suppliers</span>
              <b>5000+</b>
              <span>Buyer Connections</span>
              <b>25+</b>
              <span>Industries Served</span>
              <b>15+</b>
              <span>Years of Experience</span>
            </aside>
          </div>
        </section>

        <section id="about" className="advantage section-wrap">
          <div>
            <span className="section-kicker blue">WHY SYNERGY5M</span>
            <h2>
              Not Just a Marketplace.
              <br />
              <span>An Industry-Experienced Business Connector.</span>
            </h2>
            <p>
              We don't look at your business in isolation. A new order affects
              Marketing. The order requires Materials. Materials require
              Manpower. Production depends on Machines. And the entire cycle
              ultimately impacts Money.
            </p>
          </div>
          <div className="advantage-grid">
            {[
              [
                "Industry Experience",
                "We understand products, specifications, applications and commercial realities.",
              ],
              [
                "Established Industry Connections",
                "Relationships developed through years of professional interaction.",
              ],
              [
                "Confidentiality",
                "Buyer and seller identities remain protected during initial stages.",
              ],
              [
                "Verified Businesses",
                "Controlled registration and business verification.",
              ],
              [
                "Qualified Leads",
                "We focus on genuine commercial requirements rather than simply generating enquiries.",
              ],
              [
                "Human Expertise + Technology",
                "Technology identifies opportunities while industry experience helps qualify them.",
              ],
            ].map(([t, d]) => (
              <article key={t}>
                <Check />
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
          <div className="statement">
            <strong>We Don't Sell Your Contact Details.</strong>
            <span>We Create Business Opportunities.</span>
            <small>
              Your requirement remains confidential until there is genuine
              commercial intent.
            </small>
          </div>
        </section>

        <section className="process section-wrap">
          <div className="process-head">
            <div>
              <span className="section-kicker teal">BUSINESS CONNECT</span>
              <h2>How Synergy5M Business Connect Works</h2>
            </div>
            <p>
              Verified companies. Qualified connections. Confidential business
              leads.
            </p>
          </div>
          <div className="process-track">
            {connectSteps.map((step, i) => (
              <div key={step}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <b>{step}</b>
                {i < connectSteps.length - 1 && <ArrowRight size={15} />}
              </div>
            ))}
          </div>
        </section>

        <section
          className="clients-section section-wrap"
          aria-label="Our Clients"
        >
          <div className="clients-head">
            <div>
              <span className="section-kicker orange">OUR CLIENTS</span>
              <h2>Trusted by Businesses.</h2>
            </div>
            <p>
              Our existing client list, now carried forward into the new
              Synergy5M experience.
            </p>
          </div>
          <div className="clients-marquee">
            <div className="clients-track">
              {[...existingClients, ...existingClients].map((client, index) => (
                <div
                  className="client-logo-card"
                  key={`${client.id}-${index}`}
                  title={client.name}
                >
                  <img src={client.logo} alt={client.name} loading="lazy" />
                  <span>{client.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <section className="cta-bar">
        <div>
          <h2>Let's Build Success Together.</h2>
          <p>Technology. Expertise. Connections.</p>
        </div>
        <button onClick={() => setModal("meeting")}>
          Schedule a Meeting <ArrowRight size={17} />
        </button>
      </section>

      <footer id="contact" className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <img src={Logo} alt="Synergy5M" />
            <p>
              Technology, consulting expertise and industry connections to help
              businesses grow faster and connect smarter.
            </p>
          </div>
          <div>
            <h4>SOLUTIONS</h4>
            <button onClick={() => scrollTo("consulting")}>
              Business Consulting
            </button>
            <button onClick={() => scrollTo("erp")}>SYN ERP 10 Software</button>
            <button onClick={() => scrollTo("connect")}>
              Indenting & Connect
            </button>
          </div>
          <div>
            <h4>BUSINESS CONSULTING</h4>
            {Object.keys(consulting).map((x) => (
              <button
                key={x}
                onClick={() => {
                  setActiveConsulting(x);
                  scrollTo("consulting");
                }}
              >
                {x}
              </button>
            ))}
          </div>
          <div>
            <h4>SYN ERP 10</h4>
            {erpModules.map((x) => (
              <button key={x.title} onClick={() => openERP(x)}>
                {x.title}
              </button>
            ))}
          </div>
          <div>
            <h4>INDENTING & CONNECT</h4>
            <button onClick={() => setModal("buyer")}>For Buyers</button>
            <button onClick={() => setModal("seller")}>For Sellers</button>
            <button onClick={() => setModal("expert")}>Our Expertise</button>
          </div>
          <div>
            <h4>COMPANY</h4>
            <button onClick={() => scrollTo("about")}>About Us</button>
            <button onClick={() => setModal("expert")}>Our Team</button>
            <button onClick={() => setModal("meeting")}>Contact Us</button>
          </div>
        </div>
        <div className="footer-bottom">
          © {new Date().getFullYear()} Synergy5M LLP. All Rights Reserved.
          <span>Privacy Policy &nbsp; | &nbsp; Terms of Use</span>
        </div>
      </footer>

      {activeERP && (
        <Modal
          close={() => setActiveERP(null)}
          title={activeERP.title}
          subtitle={activeERP.tagline}
          wide
        >
          <div className="erp-detail">
            <div className="erp-detail-top">
              <span className="erp-detail-icon">
                {React.createElement(activeERP.Icon, { size: 30 })}
              </span>
              <div>
                <b>What SYN ERP 10 covers</b>
                <p>
                  Integrated process-driven functionality designed around
                  business processes, not software limitations.
                </p>
              </div>
            </div>
            <div className="detail-list">
              {activeERP.covers.map((item) => (
                <div key={item}>
                  <Check size={15} />
                  {item}
                </div>
              ))}
            </div>
            <div className="management-advantage">
              <BadgeCheck size={22} />
              <div>
                <b>Management Advantage</b>
                <span>{activeERP.advantage}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {modal === "buyer" && (
        <Modal
          close={closeModal}
          title="Register & Post a Buying Requirement"
          subtitle="Verified company registration + authorised buyer + complete buying enquiry."
          wide
        >
          <form onSubmit={(e) => submitForm(e, "buyer")}>
            <BuyerForm />
            <div className="form-actions">
              <button className="blue-btn" type="submit">
                Submit for Verification <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "seller" && (
        <Modal
          close={closeModal}
          title="Register & List Your Products"
          subtitle="Verified company registration + authorised seller + complete selling opportunity."
          wide
        >
          <form onSubmit={(e) => submitForm(e, "seller")}>
            <SellerForm />
            <div className="form-actions">
              <button className="blue-btn" type="submit">
                Submit for Verification <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
{modal === "TRail" && (
  <Modal
    close={closeModal}
    title="Request SYN ERP 10 Trial"
    subtitle="Fill in your company details to start your trial access."
    wide
  >
    <form onSubmit={(e) => submitForm(e, "trial")}>
      <div className="trial-form-grid-four">
        {/* Row 1: 4 fields in a single line */}
        <Field label="Company Name" required>
          <input name="companyName" required placeholder="Company Name" />
        </Field>

        <Field label="Contact Person" required>
          <input
            name="contactPerson"
            required
            placeholder="Contact Person Name"
          />
        </Field>

        <Field label="Mobile No." required>
          <input
            name="mobileNo"
            required
            type="tel"
            placeholder="Mobile Number"
          />
        </Field>

        <Field label="Email" required>
          <input
            name="email"
            required
            type="email"
            placeholder="Official Email"
          />
        </Field>

        {/* Row 2: 4 fields in a single line */}
        <Field label="GST No.">
          <input name="gstNo" placeholder="GSTIN (Optional)" />
        </Field>

        <Field label="Number of Users">
          <input
            name="numberOfUsers"
            type="number"
            min="1"
            placeholder="No. of Users"
          />
        </Field>

        <Field label="Subscription Plan" required>
          <select
            name="subscriptionPlan"
            required
            value={trialPlan}
            onChange={(e) => setTrialPlan(e.target.value)}
          >
            <option value="7 Days Trial">7 Days Trial</option>
            <option value="15 Days Trial">15 Days Trial</option>
            <option value="Paid Plan">Paid Plan</option>
          </select>
        </Field>

        <Field label="Trial Status">
          <select name="trialStatus" defaultValue="Active">
            <option value="Active">Active</option>
            <option value="Expired">Expired</option>
            <option value="Converted">Converted</option>
          </select>
        </Field>

        {/* Row 3: 2 date fields side-by-side occupying 2 columns each (1 full line) */}
        <div className="span-two">
          <Field label="Trial Start Date" required>
            <input
              type="date"
              name="trialStartDate"
              required
              value={trialStartDate}
              onChange={(e) => setTrialStartDate(e.target.value)}
            />
          </Field>
        </div>

        <div className="span-two">
          <Field label="Trial End Date (Auto Calculate)">
            <input
              type="date"
              name="trialEndDate"
              readOnly
              value={getTrialEndDate(trialStartDate, trialPlan)}
              className="readonly-input"
            />
          </Field>
        </div>

        {/* Row 4: Registered Address & Remarks textareas (equal size, 2 columns each on 1 line) */}
        <div className="span-two">
          <Field label="Registered Address">
            <textarea
              name="address"
              rows="3"
              placeholder="Registered business address"
            />
          </Field>
        </div>

        <div className="span-two">
          <Field label="Remarks">
            <textarea
              name="remarks"
              rows="3"
              placeholder="Any specific comments or requirements"
            />
          </Field>
        </div>
      </div>

      <div className="form-actions">
        <button className="blue-btn" type="submit">
          Submit Trial Request <ArrowRight size={16} />
        </button>
      </div>
    </form>
  </Modal>
)}

      {modal &&
        ["expert", "consulting", "connect", "demo", "meeting"].includes(
          modal,
        ) && (
          <Modal
            close={closeModal}
            title={
              modal === "demo"
                ? "Request a SYN ERP 10 Demo"
                : modal === "consulting"
                  ? "Explore Business Consulting"
                  : modal === "connect"
                    ? "Become a Business Connect Partner"
                    : modal === "meeting"
                      ? "Schedule a Meeting"
                      : "Talk to an Expert"
            }
            subtitle={
              modal === "demo"
                ? "Pick your preferred date, time, and meeting platform for a live demonstration."
                : "Share your business details and our team will get in touch with you."
            }
          >
            <form
              key={modal}
              onSubmit={(e) => submitForm(e, modal === "demo" ? "demo" : "inquiry")}
            >
              <div className="form-grid two">
                <Field label="Your Name" required>
                  <input name="fullName" required placeholder="Your name" />
                </Field>

                <Field label="Business Email" required>
                  <input
                    name="businessEmail"
                    required
                    type="email"
                    placeholder="Business email"
                  />
                </Field>

                <Field label="Company Name" required>
                  <input
                    name="companyName"
                    required
                    placeholder="Company name"
                  />
                </Field>

                <Field label="Official Mobile" required>
                  <input
                    name="officialMobile"
                    required
                    type="tel"
                    placeholder="Business mobile"
                  />
                </Field>

                {modal === "demo" ? (
                  <>
                    <Field label="Preferred Date" required>
                      <input
                        name="preferredDate"
                        required
                        type="date"
                        min={new Date().toISOString().split("T")[0]}
                      />
                    </Field>

                    <Field label="Time Slot" required>
                      <select name="timeSlot" required defaultValue="">
                        <option value="" disabled>
                          Select time slot
                        </option>
                        <option value="10:00 AM - 11:00 AM">
                          10:00 AM - 11:00 AM
                        </option>
                        <option value="11:30 AM - 12:30 PM">
                          11:30 AM - 12:30 PM
                        </option>
                        <option value="02:00 PM - 03:00 PM">
                          02:00 PM - 03:00 PM
                        </option>
                        <option value="03:30 PM - 04:30 PM">
                          03:30 PM - 04:30 PM
                        </option>
                        <option value="05:00 PM - 06:00 PM">
                          05:00 PM - 06:00 PM
                        </option>
                      </select>
                    </Field>

                    <Field label="Meeting Platform" required>
                      <select name="meetingPlatform" required defaultValue="">
                        <option value="" disabled>
                          Select platform
                        </option>
                        <option value="Google Meet">Google Meet</option>
                        <option value="Microsoft Teams">Microsoft Teams</option>
                        <option value="Zoom">Zoom</option>
                      </select>
                    </Field>
                  </>
                ) : (
                  <Field label="Interested In" required>
                    <select
                      name="interestedIn"
                      required
                      defaultValue={
                        modal === "consulting"
                          ? "Business Consulting"
                          : modal === "connect"
                            ? "Business Connect"
                            : "Business Consulting"
                      }
                    >
                      <option value="" disabled>
                        Select
                      </option>
                      <option value="Business Consulting">
                        Business Consulting
                      </option>
                      <option value="SYN ERP 10">SYN ERP 10</option>
                      <option value="Business Connect">Business Connect</option>
                    </select>
                  </Field>
                )}

                <Field
                  label={modal === "demo" ? "Specific Requirements / Focus Areas" : "Requirement"}
                  className="full-span"
                >
                  <textarea
                    name="requirement"
                    rows="3"
                    placeholder={
                      modal === "demo"
                        ? "Tell us about specific modules or processes you would like to see in the demo (optional)"
                        : "Tell us about your requirement"
                    }
                  />
                </Field>
              </div>

              <div className="form-actions">
                <button className="blue-btn" type="submit">
                  {modal === "demo" ? "Schedule Live Demo" : "Submit Enquiry"} <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </Modal>
        )}
    </div>
  );
}

export default NewLandingPage;