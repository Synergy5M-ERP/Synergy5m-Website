import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { getAuthHeaders } from './AdminAuthGuard';
import {
  Package,
  Layers,
  CheckCircle2,
  Calendar,
  MapPin,
  ArrowLeft,
  Send,
  X,
  User,
  Building2,
  RefreshCw,
  AlertCircle,
  Plus,
  Search,
  Clock,

  Menu,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Warehouse,
  Database,
  Inbox,
  FileCheck
} from 'lucide-react';
import './AdminAddProduct.css';

export default function OpportunityView() {
  const navigate = useNavigate();
  const { id } = useParams();

  // Sidebar States
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Core Data States
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(null);
  const [oppData, setOppData] = useState(null);
  const [buyerEnquiries, setBuyerEnquiries] = useState([]);
  const [selectedOppId, setSelectedOppId] = useState(id || '');

  // Table Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Offer Submission Modal State
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [toast, setToast] = useState(null);

  // Supplier Offer Form State
  const [offerForm, setOfferForm] = useState({
    unitPrice: '',
    currency: 'INR',
    availableQuantity: '',
    moq: '',
    freightBasis: 'FOR Destination (Freight Paid)',
    leadTime: '5-7 business days',
    paymentTerms: '100% LC at sight or 30 days PDC',
    offerValidity: '14 Days from submission',
    sourcingOrigin: 'Domestic Manufacturer Ex-Plant',
    commercialRemarks: ''
  });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch opportunity details and buyer enquiries
  const fetchOpportunityData = useCallback(async (targetId) => {
    setLoading(true);
    setDbError(null);

    try {
      const oppIdentifier = targetId !== undefined && targetId !== '' ? targetId : id;
      const url = oppIdentifier && oppIdentifier !== 'default' && oppIdentifier !== 'CB-2026-0001'
        ? `/api/collective-buying/opportunity-data/${encodeURIComponent(oppIdentifier)}`
        : `/api/collective-buying/opportunity-data`;

      const res = await fetch(url);
      const json = await res.json();

      if (!res.ok || !json.success || !json.opportunity) {
        setOppData(null);
        setBuyerEnquiries([]);
        if (json.notFound) {
          setDbError(null);
        } else {
          setDbError(json.message || 'No opportunity record found');
        }
        return;
      }

      setOppData(json);
      const activeId = json.opportunity.id;
      if (activeId) {
        setSelectedOppId(activeId);
      }

      // Pre-fill offer quantity if available
      if (json.demandSummary?.committedQuantity) {
        setOfferForm((prev) => ({
          ...prev,
          availableQuantity: String(json.demandSummary.committedQuantity),
          moq: String(Math.min(20, json.demandSummary.committedQuantity))
        }));
      }

      // Fetch buyer enquiries with actual Company Name, Contact Person, Delivery Date
      try {
        const enqRes = await fetch('/api/admin/collective-enquiries', { headers: getAuthHeaders() });
        if (enqRes.ok) {
          const enqJson = await enqRes.json();
          if (enqJson.success && Array.isArray(enqJson.data)) {
            const currentProdName = (json.opportunity.productName || '').toLowerCase();
            const matched = enqJson.data.filter((e) => {
              const pidMatch = e.productId && String(e.productId) === String(activeId);
              const nameMatch = e.productName && e.productName.toLowerCase().includes(currentProdName);
              return pidMatch || nameMatch;
            });

            if (matched.length > 0) {
              setBuyerEnquiries(matched);
              return;
            }
          }
        }
      } catch (err) {
        // Handled via fallback
      }

      // Fallback to enquiries in opportunity-data payload
      if (Array.isArray(json.buyerEnquiries)) {
        setBuyerEnquiries(json.buyerEnquiries);
      }
    } catch (err) {
      // Handled via UI error state
      setOppData(null);
      setBuyerEnquiries([]);
      setDbError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOpportunityData(id || '');
  }, [id, fetchOpportunityData]);

  // Derived values for Opportunity Header & Demand Summary
  const opp = oppData?.opportunity || {
    id: selectedOppId || id || '',
    productName: 'Loading Product...',
    grade: '-',
    category: 'General',
    sourcing: 'Domestic + Import',
    status: 'Open for Enquiries',
    publicationDate: '-',
    closingDate: '-',
    closingTime: '17:00 IST',
    uom: 'MT'
  };

  const demand = oppData?.demandSummary || {
    buyerEnquiriesCount: buyerEnquiries.length,
    totalPotentialQuantity: 0,
    committedQuantity: 0,
    orderedQuantity: 0,
    targetQuantity: 100,
    quantityNeeded: 100,
    demandProgressPercent: 0
  };

  const availableOpps = oppData?.availableOpportunities || [];

  // Filtered Buyer Enquiries
  const filteredBuyers = useMemo(() => {
    return buyerEnquiries.filter((b) => {
      const q = searchQuery.toLowerCase().trim();
      const compName = (b.CompanyName || b.companyName || '').toLowerCase();
      const contact = (b.ContactPerson || b.contactPerson || '').toLowerCase();
      const loc = (b.DeliveryLocation || b.deliveryLocation || b.region || '').toLowerCase();
      const ref = (b.ref || `BUY-${b.id || b.Id || ''}`).toLowerCase();

      const matchesQuery = !q || compName.includes(q) || contact.includes(q) || loc.includes(q) || ref.includes(q);
      const st = (b.Status || b.status || 'Submitted').toLowerCase();
      const matchesStatus = statusFilter === 'All' || st === statusFilter.toLowerCase();

      return matchesQuery && matchesStatus;
    });
  }, [buyerEnquiries, searchQuery, statusFilter]);

  // Handle Offer Submission
  const handleOfferSubmit = async (e) => {
    e.preventDefault();
    const price = parseFloat(offerForm.unitPrice);
    if (isNaN(price) || price <= 0) {
      showToast('Please enter a valid offered unit price greater than 0.', 'error');
      return;
    }

    const availQty = parseFloat(offerForm.availableQuantity);
    if (isNaN(availQty) || availQty <= 0) {
      showToast('Please enter a valid available quantity greater than 0.', 'error');
      return;
    }

    setSubmittingOffer(true);
    try {
      const payload = {
        opportunityId: opp.id,
        productName: opp.productName,
        unitPrice: offerForm.unitPrice,
        currency: offerForm.currency,
        availableQuantity: offerForm.availableQuantity,
        moq: offerForm.moq,
        freightBasis: offerForm.freightBasis,
        leadTime: offerForm.leadTime,
        paymentTerms: offerForm.paymentTerms,
        offerValidity: offerForm.offerValidity,
        origin: offerForm.sourcingOrigin,
        remarks: offerForm.commercialRemarks
      };

      const res = await fetch('/api/collective-buying/supplier-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (res.ok && json.success) {
        showToast(`Quotation submitted successfully! Ref: ${json.offerReference || 'OFFER-CONFIRMED'}`);
        setOfferModalOpen(false);
        fetchOpportunityData(opp.id);
      } else {
        throw new Error(json.message || 'Failed to submit offer');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingOffer(false);
    }
  };

  return (
    <div className="b2b-dashboard-page flex flex-col min-h-screen">
      {/* Toast Alert */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-lg shadow-lg border text-sm font-medium ${toast.type === 'error'
            ? 'bg-rose-50 text-rose-900 border-rose-200'
            : 'bg-emerald-50 text-emerald-900 border-emerald-200'
            }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Layout: Sidebar + Workspace */}
      <div className="flex flex-1">
        {/* Left Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 bg-[#0F2A47] text-slate-200 transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            } ${sidebarCollapsed ? 'w-64 lg:w-[68px]' : 'w-64'}`}
        >
          {/* Sidebar Header */}
          <div
            className={`h-16 flex items-center border-b border-slate-700/60 bg-[#0A1E33] transition-all duration-300 ${sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'
              }`}
          >
            {!sidebarCollapsed ? (
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#0E7C86] flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                  S5
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-sm tracking-tight text-white block truncate">Synergy5M</span>
                  <span className="text-[10px] text-teal-300 tracking-wider uppercase font-semibold block truncate">
                    Collective Buy
                  </span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                className="w-9 h-9 rounded-lg bg-[#0E7C86] hover:bg-[#0A626A] flex items-center justify-center text-white font-bold text-sm shadow-sm transition-colors"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                S5
              </button>
            )}

            {/* Minimize toggle button on desktop */}
            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                className="hidden lg:flex text-slate-400 hover:text-white hover:bg-slate-800/80 p-1.5 rounded-md transition-colors"
                title="Minimize sidebar"
                aria-label="Minimize sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}

            {/* Mobile close button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white p-1 rounded"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sidebar Navigation */}
          <nav className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto b2b-custom-scrollbar text-sm font-medium">
            {/* 1. Dashboard */}
            <Link
              to="/admin/dashboard"
              className={`flex items-center rounded-md text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
                }`}
              title="Dashboard"
            >
              <LayoutDashboard className="w-4 h-4 text-teal-100 flex-shrink-0" />
              {!sidebarCollapsed && <span>Dashboard</span>}
            </Link>

            {/* 2. Add Product */}
            <Link
              to="/admin/products/add"
              className={`flex items-center rounded-md text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
                }`}
              title="Add Product"
            >
              <Warehouse className="w-4 h-4 text-teal-100 flex-shrink-0" />
              {!sidebarCollapsed && <span>Add Product</span>}
            </Link>

            {/* 3. View Products */}
            <Link
              to="/admin/products"
              className={`flex items-center rounded-md text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
                }`}
              title="View Products"
            >
              <Database className="w-4 h-4 text-teal-100 flex-shrink-0" />
              {!sidebarCollapsed && <span>View Products</span>}
            </Link>

            {/* 4. Aggregate Enquiries */}
            <Link
              to="/admin/collective-enquiries"
              className={`flex items-center rounded-md text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
                }`}
              title="Aggregate Enquiries"
            >
              <Inbox className="w-4 h-4 text-teal-300 flex-shrink-0" />
              {!sidebarCollapsed && <span>Aggregate Enquiries</span>}
            </Link>

            {/* 5. Demand Aggregation */}
            <Link
              to="/aggregatedEnquiry"
              className={`flex items-center rounded-md text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
                }`}
              title="Demand Aggregation"
            >
              <Layers className="w-4 h-4 text-slate-400 flex-shrink-0" />
              {!sidebarCollapsed && <span>Demand Aggregation</span>}
            </Link>

            {/* 6. Opportunity View (Active) */}
            <Link
              to="/admin/opportunity-view"
              className={`flex items-center rounded-md bg-[#0E7C86] text-white shadow-sm font-semibold transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                }`}
              title="Opportunity View"
            >
              <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                <FileCheck className="w-4 h-4 text-teal-100 flex-shrink-0" />
                {!sidebarCollapsed && <span>Opportunity View</span>}
              </div>
              {!sidebarCollapsed && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-900/60 text-teal-200 font-bold uppercase tracking-wider">
                  Active
                </span>
              )}
            </Link>

            {/* Public Portal Link */}
            {/* <div className="pt-4 border-t border-slate-700/60 mt-4">
              <a
                href="/products-open-for-enquiries"
                target="_blank"
                rel="noreferrer"
                className={`flex items-center rounded-md text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
                  }`}
                title="Public Showcase"
              >
                <ExternalLink className="w-4 h-4 text-teal-300 flex-shrink-0" />
                {!sidebarCollapsed && <span>Public Showcase</span>}
              </a>
            </div> */}
          </nav>
        </aside>

        {/* Mobile Sidebar Backdrop */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          />
        )}

        {/* Main Workspace Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header Bar */}
          <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Mobile Sidebar Toggle Button */}
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md focus:outline-none"
                aria-label="Open sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Desktop Sidebar Toggle Button */}
              <button
                type="button"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden lg:flex items-center justify-center p-2 text-slate-600 hover:text-[#0E7C86] hover:bg-slate-100 rounded-md transition-colors"
                title={sidebarCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
              >
                {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
              </button>

              {/* Breadcrumb Navigation */}
              <div className="hidden sm:block">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Collective Procurement
                </span>
                <h1 className="text-sm sm:text-base font-bold text-[#0F2A47]">
                  Opportunity View
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Opportunity Pool Switcher */}
              {availableOpps.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500 font-medium hidden md:inline">Select Pool:</span>
                  <select
                    value={selectedOppId || opp.id}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setSelectedOppId(newId);
                      navigate(`/admin/opportunity/${newId}`);
                      fetchOpportunityData(newId);
                    }}
                    className="b2b-input !min-h-[36px] !py-1 text-xs font-semibold max-w-[210px]"
                  >
                    {availableOpps.map((p) => {
                      const pId = p.Id || p.id;
                      const pName = p.ProductName || p.productMaster?.productName || p.productName || pId;
                      return (
                        <option key={pId} value={pId}>
                          {pName} ({pId})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={() => fetchOpportunityData(selectedOppId)}
                className="p-2 text-slate-500 hover:text-[#0E7C86] hover:bg-slate-100 rounded-md transition"
                title="Refresh Opportunity Data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#0E7C86]' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin/products')}
                className="b2b-btn-secondary text-xs !min-h-[36px] !py-1.5 !px-3 hidden sm:flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Products</span>
              </button>

              <button
                type="button"
                onClick={() => navigate(`/admin/opportunity/${opp.id || id}/send-to-vendors`)}
                disabled={!oppData || opp.status === 'Closed'}
                className="b2b-btn-primary text-xs !min-h-[36px] !py-1.5 !px-4 flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Offer Now</span>
              </button>
            </div>
          </header>

          {/* Main Workspace Body */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
            {/* Loading Spinner */}
            {loading && !oppData && (
              <div className="b2b-card p-12 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-[#0E7C86] animate-spin mx-auto" />
                <p className="text-sm font-bold text-[#0F2A47]">Loading Opportunity Details...</p>
                <p className="text-xs text-slate-400">Fetching live product demand and buyer commitments.</p>
              </div>
            )}

            {/* Database Error Banner */}
            {dbError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span><strong>Error:</strong> {dbError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => fetchOpportunityData(selectedOppId)}
                  className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded font-bold"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Data Not Found State */}
            {!loading && !oppData && (
              <div className="b2b-card p-12 text-center space-y-4 max-w-xl mx-auto my-8 border border-dashed border-slate-300 bg-white">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <Package className="w-7 h-7 text-[#0E7C86]" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-[#0F2A47]">No Opportunities Available</h3>
                  <p className="text-xs text-slate-500">
                    There are currently no active collective buying products published in the system.
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-center gap-3">
                  <Link
                    to="/admin/products?tab=form"
                    className="b2b-btn-primary text-xs !py-2 !px-4 flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Product</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOppId('');
                      fetchOpportunityData('');
                    }}
                    className="b2b-btn-secondary text-xs !py-2 !px-4 flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
            )}

            {/* Live Opportunity Details */}
            {oppData && (
              <>
                {/* 1. PRODUCT INFORMATION */}
                <section className="b2b-card p-6 border-l-4 border-l-[#0E7C86] bg-white">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">


                    <div className="space-y-3 flex-grow">

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                          ID: {opp.id}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full font-semibold ${opp.status === 'Open for Enquiries'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                          {opp.status}
                        </span>
                        <span className="px-2.5 py-0.5 font-semibold rounded bg-teal-50 text-[#0E7C86] border border-teal-100">
                          {opp.category}
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="text-slate-600">Grade: <strong className="text-slate-800">{opp.grade || 'Standard'}</strong></span>
                        <span className="text-slate-300">&bull;</span>
                        <span className="text-slate-600">Sourcing: <strong className="text-slate-800">{opp.sourcing || 'Domestic'}</strong></span>
                        <span className="text-slate-300">&bull;</span>
                        <span className="text-slate-600">Unit: <strong className="font-mono text-[#0F2A47]">{opp.uom}</strong></span>
                      </div>


                      <h2 className="text-xl font-bold text-[#0F2A47] tracking-tight">
                        {opp.productName}
                      </h2>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Published: <strong className="text-slate-700">{opp.publicationDate || '-'}</strong></span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Offer Deadline: <strong className="text-slate-700">{opp.closingDate || '-'}</strong></span>
                        </span>
                      </div>

                    </div>


                    <div className="flex items-center gap-2.5 flex-shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/opportunity/${opp.id || id}/send-to-vendors`)}
                        disabled={opp.status === 'Closed'}
                        className="b2b-btn-primary text-xs !py-2.5 !px-5 flex items-center gap-2 shadow-sm font-semibold disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                        <span>Submit Offer Now</span>
                      </button>
                    </div>

                  </div>
                </section>

                {/* 2. CONSOLIDATED DEMAND SUMMARY */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-[#0F2A47] flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[#0E7C86]" />
                        <span>Consolidated Demand Summary</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Aggregated volume requirements committed by verified industrial buyers.
                      </p>
                    </div>
                  </div>

                  {/* 4 Metric Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="b2b-card p-4">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Buyer Enquiries
                      </span>
                      <p className="text-2xl font-bold text-[#0F2A47] mt-1">
                        {demand.buyerEnquiriesCount}
                      </p>
                      <p className="text-[11px] text-teal-700 font-medium mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Active submissions</span>
                      </p>
                    </div>

                    <div className="b2b-card p-4">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Total Potential Demand
                      </span>
                      <p className="text-2xl font-bold text-[#0F2A47] mt-1">
                        {demand.totalPotentialQuantity} <span className="text-sm font-normal text-slate-500">{opp.uom}</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">Total volume requested</p>
                    </div>

                    <div className="b2b-card p-4 border-l-2 border-l-emerald-600">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Committed Quantity
                      </span>
                      <p className="text-2xl font-bold text-emerald-700 mt-1">
                        {demand.committedQuantity} <span className="text-sm font-normal text-slate-500">{opp.uom}</span>
                      </p>
                      <p className="text-[11px] text-emerald-700 font-medium mt-1">Confirmed buyer volume</p>
                    </div>

                    <div className="b2b-card p-4 border-l-2 border-l-blue-600">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Ordered Quantity
                      </span>
                      <p className="text-2xl font-bold text-blue-700 mt-1">
                        {demand.orderedQuantity} <span className="text-sm font-normal text-slate-500">{opp.uom}</span>
                      </p>
                      <p className="text-[11px] text-blue-600 font-medium mt-1">Covered by purchase orders</p>
                    </div>
                  </div>

                  {/* Demand Progress Bar Card */}
                  <div className="b2b-card p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Committed Volume vs Target Pool
                        </h4>
                        <p className="text-lg font-bold text-[#0F2A47] mt-0.5">
                          {demand.committedQuantity} / {demand.targetQuantity} {opp.uom}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-600 bg-slate-100 px-3 py-1 rounded border border-slate-200">
                          <strong>{demand.quantityNeeded} {opp.uom}</strong> balance needed
                        </span>
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                          {demand.demandProgressPercent}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-full bg-[#0E7C86] rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(0, Math.min(100, Number(demand.demandProgressPercent) || 0))}%` }}
                      ></div>
                    </div>
                  </div>
                </section>

                {/* 3. BUYER ENQUIRY BREAKDOWN */}
                <section className="b2b-card overflow-hidden">
                  <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-[#0F2A47] flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[#0E7C86]" />
                        <span>Buyer Enquiry Breakdown</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Individual buyer requirements with contact details and delivery timelines.
                      </p>
                    </div>

                    {/* Filter and Search Bar */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search company, person, location..."
                          className="b2b-input !min-h-[36px] !pl-8 text-xs !w-64"
                        />
                      </div>

                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="b2b-input !min-h-[36px] !py-1 text-xs !w-36"
                      >
                        <option value="All">All Statuses</option>
                        <option value="Submitted">Submitted</option>
                        <option value="Committed">Committed</option>
                        <option value="Ordered">Ordered</option>
                        <option value="In Review">In Review</option>
                      </select>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto b2b-custom-scrollbar">
                    <table className="db-table w-full">
                      <thead>
                        <tr>
                          <th>Ref</th>
                          <th>Company Name</th>
                          <th>Contact Person</th>
                          <th>Target Delivery Date</th>
                          <th>Quantity</th>
                          <th>Delivery Location</th>
                          <th>Status</th>
                          <th>Submitted Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBuyers.length > 0 ? (
                          filteredBuyers.map((b, idx) => {
                            const ref = b.ref || `BUY-${String(idx + 1).padStart(3, '0')}`;
                            const company = b.CompanyName || b.companyName || '—';
                            const contact = b.ContactPerson || b.contactPerson || '—';
                            const targetDate = b.TargetDeliveryDate || b.targetDeliveryDate;
                            const qty = b.RequiredQuantity || b.requiredQuantity || b.quantity || '—';
                            const uom = b.Uom || b.uom || opp.uom;
                            const location = b.DeliveryLocation || b.deliveryLocation || b.region || '—';
                            const status = b.Status || b.status || 'Submitted';
                            const dateStr = b.CreatedAt || b.createdAt || b.date;

                            return (
                              <tr key={b.Id || b.id || idx}>
                                <td>
                                  <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                    {ref}
                                  </span>
                                </td>
                                <td>
                                  <strong className="text-xs text-[#0F2A47] block">{company}</strong>
                                </td>
                                <td>
                                  <span className="text-xs text-slate-700 flex items-center gap-1.5">
                                    <User className="w-3 h-3 text-slate-400" />
                                    <span>{contact}</span>
                                  </span>
                                </td>
                                <td>
                                  <span className="text-xs text-slate-700 flex items-center gap-1.5">
                                    <Calendar className="w-3 h-3 text-slate-400" />
                                    <span>
                                      {targetDate
                                        ? new Date(targetDate).toLocaleDateString('en-IN', {
                                          day: 'numeric',
                                          month: 'short',
                                          year: 'numeric'
                                        })
                                        : 'Immediate / Open'}
                                    </span>
                                  </span>
                                </td>
                                <td>
                                  <strong className="text-xs text-slate-900 font-mono">
                                    {qty} {uom}
                                  </strong>
                                </td>
                                <td>
                                  <span className="text-xs text-slate-600 flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                    <span className="truncate max-w-[160px]">{location}</span>
                                  </span>
                                </td>
                                <td>
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${status === 'Ordered'
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : status === 'Committed' || status === 'Allocated to Pool'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : status === 'In Review'
                                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                                      }`}
                                  >
                                    {status}
                                  </span>
                                </td>
                                <td>
                                  <span className="text-xs text-slate-400 font-mono">
                                    {dateStr
                                      ? new Date(dateStr).toLocaleDateString('en-IN', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric'
                                      })
                                      : '-'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan="8" className="text-center py-8 text-slate-400 text-xs italic">
                              No buyer enquiries found matching the selected filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer */}
                  <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Showing {filteredBuyers.length} of {buyerEnquiries.length} verified buyer records
                    </span>
                  </div>
                </section>
              </>
            )}
          </main>
        </div>
      </div>

      {/* 4. SUBMIT OFFER NOW MODAL */}
      {offerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0E7C86] block">
                  Supplier Quotation Submission
                </span>
                <h3 className="text-base font-bold text-[#0F2A47]">
                  Submit Offer for {opp.productName} ({opp.id})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOfferModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form id="supplierOfferForm" onSubmit={handleOfferSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 b2b-custom-scrollbar text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Offered Unit Price <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={offerForm.unitPrice}
                      onChange={(e) => setOfferForm({ ...offerForm, unitPrice: e.target.value })}
                      placeholder="e.g. 78500"
                      className="b2b-input pr-14 font-bold"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400 font-medium">/ {opp.uom}</span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Currency</label>
                  <select
                    value={offerForm.currency}
                    onChange={(e) => setOfferForm({ ...offerForm, currency: e.target.value })}
                    className="b2b-input"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Available Supply Quantity ({opp.uom}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={offerForm.availableQuantity}
                    onChange={(e) => setOfferForm({ ...offerForm, availableQuantity: e.target.value })}
                    className="b2b-input font-bold"
                    placeholder="e.g. 50"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Minimum Order Qty (MOQ)</label>
                  <input
                    type="number"
                    value={offerForm.moq}
                    onChange={(e) => setOfferForm({ ...offerForm, moq: e.target.value })}
                    className="b2b-input"
                    placeholder="e.g. 10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Freight & Delivery Terms</label>
                  <select
                    value={offerForm.freightBasis}
                    onChange={(e) => setOfferForm({ ...offerForm, freightBasis: e.target.value })}
                    className="b2b-input"
                  >
                    <option value="FOR Destination (Freight Paid)">FOR Destination (Freight Paid to Buyer Dock)</option>
                    <option value="Ex-Works / Ex-Plant">Ex-Works / Ex-Plant (Buyer Arranges Transport)</option>
                    <option value="CIF Nhava Sheva (JNPT)">CIF Nhava Sheva / JNPT Port (Imports)</option>
                    <option value="CIF Mundra Port">CIF Mundra Port (Imports)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lead Time / Dispatch</label>
                  <input
                    type="text"
                    value={offerForm.leadTime}
                    onChange={(e) => setOfferForm({ ...offerForm, leadTime: e.target.value })}
                    className="b2b-input"
                    placeholder="e.g. 5-7 business days from PO"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Terms</label>
                  <input
                    type="text"
                    value={offerForm.paymentTerms}
                    onChange={(e) => setOfferForm({ ...offerForm, paymentTerms: e.target.value })}
                    className="b2b-input"
                    placeholder="e.g. 100% LC at sight or 30 days PDC"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Offer Validity Period</label>
                  <input
                    type="text"
                    value={offerForm.offerValidity}
                    onChange={(e) => setOfferForm({ ...offerForm, offerValidity: e.target.value })}
                    className="b2b-input"
                    placeholder="e.g. 14 Days from submission"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sourcing Origin & Manufacturer</label>
                <input
                  type="text"
                  value={offerForm.sourcingOrigin}
                  onChange={(e) => setOfferForm({ ...offerForm, sourcingOrigin: e.target.value })}
                  className="b2b-input"
                  placeholder="e.g. Domestic Manufacturer Ex-Plant / Imported Grade"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Commercial Remarks & Special Notes</label>
                <textarea
                  rows={2}
                  value={offerForm.commercialRemarks}
                  onChange={(e) => setOfferForm({ ...offerForm, commercialRemarks: e.target.value })}
                  className="b2b-input resize-none"
                  placeholder="Additional commercial notes, test certificates, packaging options..."
                />
              </div>
            </form>

            {/* Modal Actions */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOfferModalOpen(false)}
                className="b2b-btn-secondary text-xs !py-1.5 !px-3"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="supplierOfferForm"
                disabled={submittingOffer}
                className="b2b-btn-primary text-xs !py-1.5 !px-4 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submittingOffer ? 'Saving Offer...' : 'Submit Offer'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
