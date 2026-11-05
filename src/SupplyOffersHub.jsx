import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Send,
  FileText,
  CheckCircle2,
  Clock,
  ExternalLink,
  Search,
  RefreshCw,
  Building,
  Mail,
  MapPin,
  Calendar,
  ArrowUpRight,
  Info,
  ShieldCheck,
  X,
  Menu,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Warehouse,
  Database,
  Inbox,
  FileCheck,
  VenusAndMarsIcon
} from 'lucide-react';
import './AdminAddProduct.css';
import './SupplyOffersHub.css';

export default function SupplyOffersHub({ defaultTab = 'sent' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Active tab state: 'sent' | 'submitted'
  const initialTab = searchParams.get('tab') || defaultTab;
  const [activeTab, setActiveTab] = useState(initialTab === 'submitted' ? 'submitted' : 'sent');

  // Sidebar toggle states
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Data states
  const [sentOffers, setSentOffers] = useState([]);
  const [submittedOffers, setSubmittedOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Selected quotation for modal preview
  const [selectedQuote, setSelectedQuote] = useState(null);

  // Fetch both sent and submitted records
  const fetchHubData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sentRes, subRes] = await Promise.all([
        fetch('/api/supply-offers/sent').then(r => r.json()).catch(() => ({ success: false, data: [] })),
        fetch('/api/supply-offers/submitted').then(r => r.json()).catch(() => ({ success: false, data: [] }))
      ]);

      if (sentRes.success && Array.isArray(sentRes.data)) {
        setSentOffers(sentRes.data);
      } else {
        setSentOffers([]);
      }

      if (subRes.success && Array.isArray(subRes.data)) {
        setSubmittedOffers(subRes.data);
      } else {
        setSubmittedOffers([]);
      }
    } catch (err) {
      console.error('Error fetching hub data:', err);
      setError('Could not load supply offer records. Please check the network connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHubData();
  }, [fetchHubData]);

  // Sync tab with URL parameter if passed
  useEffect(() => {
    if (defaultTab && (defaultTab === 'sent' || defaultTab === 'submitted')) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  // Open Submit Offer page
  const handleOpenSubmitOffer = (url, fallbackRfq = '') => {
    if (url) {
      if (url.startsWith('http')) {
        const parsed = new URL(url);
        navigate(`${parsed.pathname}${parsed.search}`);
      } else {
        navigate(url);
      }
    } else {
      navigate(`/supply-offer?rfq=${encodeURIComponent(fallbackRfq)}`);
    }
  };

  // Filter Dispatched Offers
  const filteredSentOffers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return sentOffers.filter(item => {
      const matchesSearch =
        !q ||
        (item.RfqReference && item.RfqReference.toLowerCase().includes(q)) ||
        (item.VendorName && item.VendorName.toLowerCase().includes(q)) ||
        (item.VendorEmail && item.VendorEmail.toLowerCase().includes(q)) ||
        (item.ProductName && item.ProductName.toLowerCase().includes(q)) ||
        (item.Destination && item.Destination.toLowerCase().includes(q)) ||
        (item.Category && item.Category.toLowerCase().includes(q));

      return matchesSearch;
    });
  }, [sentOffers, searchQuery]);

  // Filter Submitted Offers
  const filteredSubmittedOffers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return submittedOffers.filter(item => {
      if (!q) return true;
      return (
        (item.OfferReference && item.OfferReference.toLowerCase().includes(q)) ||
        (item.RfqReference && item.RfqReference.toLowerCase().includes(q)) ||
        (item.VendorName && item.VendorName.toLowerCase().includes(q)) ||
        (item.VendorEmail && item.VendorEmail.toLowerCase().includes(q)) ||
        (item.ContactPerson && item.ContactPerson.toLowerCase().includes(q)) ||
        (item.ProductName && item.ProductName.toLowerCase().includes(q)) ||
        (item.VendorQuotationNo && item.VendorQuotationNo.toLowerCase().includes(q)) ||
        (item.Destination && item.Destination.toLowerCase().includes(q))
      );
    });
  }, [submittedOffers, searchQuery]);

  return (
    <div className="b2b-dashboard-page flex flex-col min-h-screen">
      <div className="flex flex-1 min-h-screen">
        {/* Left Sidebar (Collapsible on Mobile and Desktop) */}
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
                className="w-9 h-9 rounded-lg bg-[#0E7C86] hover:bg-[#0A626A] flex items-center justify-center text-white font-bold text-sm shadow-sm transition-colors group relative"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                S5
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                    Expand Sidebar
                  </div>
                </div>
              </button>
            )}

            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                className="hidden lg:flex text-slate-400 hover:text-white hover:bg-slate-800/80 p-1.5 rounded-md transition-colors"
                title="Minimize sidebar (show icons only)"
                aria-label="Minimize sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white p-1 rounded"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto b2b-custom-scrollbar text-sm font-medium">
            {/* 1. Dashboard */}
            <div className="relative group">
              <Link
                to="/admin/dashboard"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center rounded-md text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  }`}
                title="Dashboard"
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <LayoutDashboard className="w-4 h-4 text-teal-100 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Dashboard</span>}
                </div>
              </Link>
              {sidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                    Dashboard
                  </div>
                </div>
              )}
            </div>

            {/* 2. Add Product */}
            <div className="relative group">
              <Link
                to="/admin/products/add"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center rounded-md text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  }`}
                title="Add Product"
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <Warehouse className="w-4 h-4 text-teal-100 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Add Product</span>}
                </div>
              </Link>
              {sidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                    Add Product
                  </div>
                </div>
              )}
            </div>

            {/* 3. View Products */}
            <div className="relative group">
              <Link
                to="/admin/products"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center rounded-md text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  }`}
                title="View Products"
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <Database className="w-4 h-4 text-teal-100 flex-shrink-0" />
                  {!sidebarCollapsed && <span>View Products</span>}
                </div>
              </Link>
              {sidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                    View Products
                  </div>
                </div>
              )}
            </div>

            {/* 4. Aggregate Enquiries */}
            <div className="relative group">
              <Link
                to="/admin/collective-enquiries"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center rounded-md text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  }`}
                title="Aggregate Enquiries"
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <Inbox className="w-4 h-4 text-teal-300 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Aggregate Enquiries</span>}
                </div>
              </Link>
              {sidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                    Aggregate Enquiries
                  </div>
                </div>
              )}
            </div>

            {/* 5. Opportunity View */}
            <div className="relative group">
              <Link
                to="/admin/opportunity-view"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center rounded-md text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  }`}
                title="Opportunity View (SG-5)"
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <FileCheck className="w-4 h-4 text-teal-300 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Opportunity View</span>}
                </div>
                {!sidebarCollapsed && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-900/60 text-teal-200 font-bold uppercase tracking-wider">
                    SG-5
                  </span>
                )}
              </Link>
              {sidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                    Opportunity View
                  </div>
                </div>
              )}
            </div>

            {/* Section Divider: Procurement & Offers */}
            <div className="pt-3 pb-1 border-t border-slate-700/60 mt-3">
              {!sidebarCollapsed && (
                <div className="px-3 text-[10.5px] font-bold uppercase tracking-wider text-teal-400/80 mb-1">
                  Procurement & Offers
                </div>
              )}
            </div>

            {/* 6. Dispatch RFQ */}
            <div className="relative group">
              <Link
                to="/supply-offers"
                onClick={() => {
                  setActiveTab('sent');
                  setSidebarOpen(false);
                }}
                className={`flex items-center rounded-md transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  } ${activeTab === 'sent'
                    ? 'bg-[#0E7C86] text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                title="Dispatch RFQ"
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <Send className={`w-4 h-4 flex-shrink-0 ${activeTab === 'sent' ? 'text-teal-100' : 'text-orange-400'}`} />
                  {!sidebarCollapsed && <span>Dispatch RFQ</span>}
                </div>
                {!sidebarCollapsed && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${activeTab === 'sent' ? 'bg-teal-900/60 text-teal-100' : 'bg-orange-500/20 text-orange-300'
                    }`}>
                    Sent
                  </span>
                )}
              </Link>
              {sidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                    Dispatch RFQ
                  </div>
                </div>
              )}
            </div>


            {/* 7. Admin Panel */}
            <div className="relative group">
              <a
                href="/admin"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/admin');
                  setSidebarOpen(false);
                }}
                className={`flex items-center rounded-md text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  }`}
                title="Admin Panel"
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <VenusAndMarsIcon className="w-4 h-4 text-orange-400 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Admin Panel</span>}
                </div>
                {!sidebarCollapsed && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-bold uppercase tracking-wider">
                    Admin
                  </span>
                )}
              </a>
              {sidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                    Admin Panel
                  </div>
                </div>
              )}
            </div>

            {/* 8. Submitted Offer */}
            <div className="relative group">
              <Link
                to="/submittedoffer"
                onClick={() => {
                  setActiveTab('submitted');
                  setSidebarOpen(false);
                }}
                className={`flex items-center rounded-md transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  } ${activeTab === 'submitted'
                    ? 'bg-[#0E7C86] text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                title="Submitted Offer"
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <FileText className={`w-4 h-4 flex-shrink-0 ${activeTab === 'submitted' ? 'text-teal-100' : 'text-emerald-400'}`} />
                  {!sidebarCollapsed && <span>Submitted Offer</span>}
                </div>
                {!sidebarCollapsed && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${activeTab === 'submitted' ? 'bg-teal-900/60 text-teal-100' : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                    Quotes
                  </span>
                )}
              </Link>
              {sidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                    Submitted Offer
                  </div>
                </div>
              )}
            </div>
          </nav>
        </aside>

        {/* Backdrop for mobile sidebar */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          />
        )}

        {/* Main Content Workspace */}
        <div className="flex-1 flex flex-col min-w-0 soh-container" style={{ paddingBottom: '60px' }}>
          {/* Top Navigation Bar */}
          {/* Top Navigation Bar with Tabs & Search Bar */}
          <header className="soh-navbar">
            <div className="soh-nav-inner flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Mobile menu trigger */}
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-md focus:outline-none"
                  aria-label="Open sidebar"
                >
                  <Menu className="w-5 h-5" />
                </button>

                {/* Desktop sidebar toggle button */}
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="hidden lg:flex items-center justify-center p-2 text-slate-400 hover:text-teal-300 hover:bg-slate-800/80 rounded-md transition-colors"
                  title={sidebarCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
                  aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
                >
                  {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </button>
              </div>

              {/* Tabs Switcher and Search Bar directly in the header */}
              <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 min-w-0">
                <div className="soh-tab-switch">
                  <button
                    type="button"
                    className={`soh-tab-btn ${activeTab === 'sent' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab('sent');
                      window.history.replaceState(null, '', '/supply-offers');
                    }}
                  >
                    <Send size={15} />
                    <span>Submit Supply Offer (Sent Emails)</span>
                    <span className="soh-tab-badge">{sentOffers.length}</span>
                  </button>

                  <button
                    type="button"
                    className={`soh-tab-btn ${activeTab === 'submitted' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab('submitted');
                      window.history.replaceState(null, '', '/submittedoffer');
                    }}
                  >
                    <FileText size={15} />
                    <span>Submitted Offers</span>
                    <span className="soh-tab-badge">{submittedOffers.length}</span>
                  </button>
                </div>

                {/* Search bar displayed right in the tabs row */}
                <div className="soh-search-box w-full sm:w-64 md:w-80">
                  <Search size={15} className="soh-search-icon" />
                  <input
                    type="text"
                    placeholder={
                      activeTab === 'sent'
                        ? 'Search RFQ Ref, Vendor, Product...'
                        : 'Search Offer Ref, Quotation, Vendor...'
                    }
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="soh-search-input"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="soh-clear-btn"
                      onClick={() => setSearchQuery('')}
                      title="Clear search"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </header>

          <div className="soh-content">
            {/* Error Banner */}
            {error && (
              <div className="soh-error-banner">
                <Info size={18} />
                <span>{error}</span>
              </div>
            )}
              <div className="soh-error-banner">
                <Info size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 1: DISPATCHED RFQ EMAILS */}
            {/* ========================================================================= */}
            {activeTab === 'sent' && (
              <div className="soh-card">
                <div className="soh-card-header">
                  <div>
                    <h2 className="soh-card-title">All Sent Supply Offer Emails</h2>
                    <p className="soh-card-subtitle">
                      List of all sent RFQ emails. Click "Open Submit Offer Page" to open the pre-filled quotation submission form.
                    </p>
                  </div>
                  <div className="soh-table-count">
                    Showing <b>{filteredSentOffers.length}</b> of {sentOffers.length} sent emails
                  </div>
                </div>

                {loading ? (
                  <div className="soh-loading">
                    <RefreshCw size={28} className="soh-spin" />
                    <p>Loading dispatched RFQ offers...</p>
                  </div>
                ) : filteredSentOffers.length === 0 ? (
                  <div className="soh-empty">

                    <h3>No Dispatched RFQ Offers Found</h3>
                    <p>
                      {searchQuery
                        ? 'No sent offers match your search criteria. Try clearing the filter.'
                        : 'No vendor RFQ emails have been dispatched yet from the Admin Opportunities page.'}
                    </p>
                    <button
                      type="button"
                      className="soh-btn-primary"
                      onClick={() => navigate('/admin/opportunity-view')}
                    >
                      Go to Opportunities to Dispatch RFQ
                    </button>
                  </div>
                ) : (
                  <div className="soh-table-responsive">
                    <table className="soh-table">
                      <thead>
                        <tr>
                          <th style={{ width: '16%' }}>RFQ Reference</th>
                          <th style={{ width: '22%' }}>To Whom Sent (Vendor)</th>
                          <th style={{ width: '24%' }}>For Which Product & Demand</th>
                          <th style={{ width: '16%' }}>Offers Submitted</th>
                          <th style={{ width: '22%', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSentOffers.map((item) => {
                          const count = Number(item.SubmittedOffersCount) || 0;
                          const hasSubmitted = count > 0;
                          const submitUrl = item.SubmitOfferUrl || `/supply-offer?rfq=${encodeURIComponent(item.RfqReference)}`;

                          return (
                            <tr key={item.Id || item.RfqReference} className="soh-row">
                              {/* 1. RFQ Reference & Sent Date */}
                              <td>
                                <div className="soh-ref-badge">{item.RfqReference}</div>
                                <div className="soh-timestamp">
                                  <Calendar size={12} />
                                  <span>
                                    {item.SentAt
                                      ? new Date(item.SentAt).toLocaleDateString('en-IN', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric'
                                      })
                                      : 'Recently Sent'}
                                  </span>
                                </div>
                              </td>

                              {/* 2. To Whom The Offer Is Sent */}
                              <td>
                                <div className="soh-vendor-name">
                                  <Building size={14} className="soh-inline-icon" />
                                  <strong>{item.VendorName || 'Registered Vendor'}</strong>
                                </div>
                                <div className="soh-vendor-email">
                                  <Mail size={13} className="soh-inline-icon" />
                                  <span>{item.VendorEmail}</span>
                                </div>
                              </td>

                              {/* 3. For Which Product */}
                              <td>
                                <div className="soh-product-title">
                                  <strong>{item.ProductName}</strong>
                                  {item.Category && (
                                    <span className="soh-cat-pill">{item.Category}</span>
                                  )}
                                </div>
                                <div className="soh-product-specs">
                                  <span className="soh-demand-metric">
                                    Total Demand: <b>{item.TotalDemand} {item.Uom || 'MT'}</b>
                                  </span>
                                  {item.Grade && <span className="soh-grade"> • {item.Grade}</span>}
                                </div>
                                {item.Destination && (
                                  <div className="soh-dest-text">
                                    <MapPin size={12} />
                                    <span>{item.Destination}</span>
                                  </div>
                                )}
                              </td>

                              {/* 4. How Many Users Submitted Offer */}
                              <td>
                                {hasSubmitted ? (
                                  <div className="soh-count-badge success">
                                    <CheckCircle2 size={14} />
                                    <span>
                                      <b>{count}</b> {count === 1 ? 'Offer Submitted' : 'Offers Submitted'}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="soh-count-badge pending">
                                    <Clock size={14} />
                                    <span>0 Submitted (Pending)</span>
                                  </div>
                                )}

                                {hasSubmitted && item.LatestTotalValue && (
                                  <div className="soh-value-sub">
                                    Latest: ₹{Number(item.LatestTotalValue).toLocaleString('en-IN')}
                                  </div>
                                )}
                              </td>

                              {/* 5. Actions */}
                              <td style={{ textAlign: 'right' }}>
                                <div className="soh-actions-cell">
                                  <button
                                    type="button"
                                    className="soh-btn-submit-action"
                                    title="Open the exact pre-filled Supply Offer quotation form sent in email"
                                    onClick={() => handleOpenSubmitOffer(submitUrl, item.RfqReference)}
                                  >
                                    <span>Open Submit Offer Page</span>
                                    <ExternalLink size={13} />
                                  </button>


                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: SUBMITTED VENDOR QUOTATIONS */}
            {/* ========================================================================= */}
            {activeTab === 'submitted' && (
              <div className="soh-card">
                <div className="soh-card-header">
                  <div>
                    <h2 className="soh-card-title">Submitted Vendor Quotations</h2>
                    <p className="soh-card-subtitle">
                      Formal supply offers and pricing details submitted by vendors against aggregated RFQs.
                    </p>
                  </div>
                  <div className="soh-table-count">
                    Showing <b>{filteredSubmittedOffers.length}</b> of {submittedOffers.length} quotations
                  </div>
                </div>

                {loading ? (
                  <div className="soh-loading">
                    <RefreshCw size={28} className="soh-spin" />
                    <p>Loading submitted quotations...</p>
                  </div>
                ) : filteredSubmittedOffers.length === 0 ? (
                  <div className="soh-empty">

                    <h3>No Submitted Offers Found</h3>
                    <p>
                      {searchQuery
                        ? 'No quotations match your search criteria. Try a different term.'
                        : 'No vendors have submitted formal supply offers yet.'}
                    </p>
                    <button
                      type="button"
                      className="soh-btn-primary"
                      onClick={() => navigate('/supply-offer')}
                    >
                      Open Supply Offer Form
                    </button>
                  </div>
                ) : (
                  <div className="soh-table-responsive">
                    <table className="soh-table">
                      <thead>
                        <tr>
                          <th style={{ width: '15%' }}>Offer & Quotation No</th>
                          <th style={{ width: '13%' }}>RFQ Reference</th>
                          <th style={{ width: '18%' }}>Vendor Company</th>
                          <th style={{ width: '18%' }}>Product & Quantity</th>
                          <th style={{ width: '16%' }}>Offered Price & Total</th>
                          <th style={{ width: '20%', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSubmittedOffers.map((quote) => {
                          const rfqLink = `/supply-offer?rfq=${encodeURIComponent(quote.RfqReference)}&prodId=${encodeURIComponent(quote.OpportunityId || '')}&vendor=${encodeURIComponent(quote.VendorName)}&email=${encodeURIComponent(quote.VendorEmail)}&product=${encodeURIComponent(quote.ProductName)}&demand=${encodeURIComponent(quote.TotalRequiredDemand || quote.OfferedQuantity || 0)}&uom=${encodeURIComponent(quote.Uom || 'MT')}&dest=${encodeURIComponent(quote.Destination || '')}`;

                          return (
                            <tr key={quote.Id || quote.OfferReference} className="soh-row">
                              {/* 1. Offer Ref & Date */}
                              <td>
                                <div className="soh-ref-badge">{quote.OfferReference || `OFF-${quote.Id}`}</div>
                                <div className="soh-quotation-no">
                                  Quote #{quote.VendorQuotationNo || 'N/A'}
                                </div>
                                <div className="soh-timestamp">
                                  <Calendar size={12} />
                                  <span>
                                    {quote.CreatedAt
                                      ? new Date(quote.CreatedAt).toLocaleDateString('en-IN', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric'
                                      })
                                      : 'Recently'}
                                  </span>
                                </div>
                              </td>

                              {/* 2. RFQ Reference */}
                              <td>
                                <span className="soh-rfq-pill">{quote.RfqReference}</span>
                                <div className="soh-status-tag">
                                  <CheckCircle2 size={12} />
                                  <span>{quote.Status || 'Active'}</span>
                                </div>
                              </td>

                              {/* 3. Vendor Details */}
                              <td>
                                <div className="soh-vendor-name">
                                  <strong>{quote.VendorName}</strong>
                                </div>
                                <div className="soh-vendor-contact">{quote.ContactPerson}</div>
                                <div className="soh-vendor-email">{quote.VendorEmail}</div>
                              </td>

                              {/* 4. Product & Quantity */}
                              <td>
                                <div className="soh-product-title">
                                  <strong>{quote.ProductName}</strong>
                                </div>
                                <div className="soh-offered-qty">
                                  Offered: <b>{quote.OfferedQuantity} {quote.Uom || 'MT'}</b>
                                  {quote.CanSupplyFull ? (
                                    <span className="soh-full-badge">Full</span>
                                  ) : (
                                    <span className="soh-partial-badge">Partial</span>
                                  )}
                                </div>
                                <div className="soh-dest-text">
                                  <MapPin size={12} />
                                  <span>{quote.Destination || 'As per RFQ'}</span>
                                </div>
                              </td>

                              {/* 5. Commercial Breakdown */}
                              <td>
                                <div className="soh-unit-price">
                                  ₹{Number(quote.OfferedUnitPrice || 0).toLocaleString('en-IN')}/{quote.Uom || 'MT'}
                                </div>
                                <div className="soh-gst-info">
                                  + GST {quote.GstRate || '18%'}
                                  {quote.FreightIncluded ? ' • Freight Inc.' : ''}
                                </div>
                                <div className="soh-grand-total">
                                  Total: <b>₹{Number(quote.EstimatedTotalValue || 0).toLocaleString('en-IN')}</b>
                                </div>
                              </td>

                              {/* 6. Actions */}
                              <td style={{ textAlign: 'right' }}>
                                <div className="soh-actions-cell">
                                  <button
                                    type="button"
                                    className="soh-btn-submit-action"
                                    title="Open the submit offer page preloaded for this RFQ"
                                    onClick={() => handleOpenSubmitOffer(rfqLink, quote.RfqReference)}
                                  >
                                    <span>Open Submit Offer Page</span>
                                    <ExternalLink size={13} />
                                  </button>

                                  <button
                                    type="button"
                                    className="soh-btn-view-details"
                                    title="Open official quotation document & printable PDF"
                                    onClick={() => navigate(`/supply-offer/view?offerRef=${encodeURIComponent(quote.OfferReference)}`)}
                                  >
                                    📄 View PDF
                                  </button>

                                  <button
                                    type="button"
                                    className="soh-btn-secondary"
                                    style={{ padding: '6px 10px', fontSize: '11.5px' }}
                                    title="Quick inspection drawer"
                                    onClick={() => setSelectedQuote(quote)}
                                  >
                                    Details
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* QUOTATION DETAILS MODAL */}
          {/* ========================================================================= */}
          {selectedQuote && (
            <div className="soh-modal-overlay" onClick={() => setSelectedQuote(null)}>
              <div className="soh-modal-card" onClick={e => e.stopPropagation()}>
                <div className="soh-modal-header">
                  <div className="soh-modal-title-group">
                    <span className="soh-modal-badge">{selectedQuote.OfferReference || 'Quotation'}</span>
                    <h2>Quotation Details: {selectedQuote.VendorQuotationNo}</h2>
                  </div>
                  <button
                    type="button"
                    className="soh-modal-close"
                    onClick={() => setSelectedQuote(null)}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="soh-modal-body">
                  {/* Top Summary Bar */}
                  <div className="soh-modal-summary-bar">
                    <div className="soh-sum-item">
                      <span className="soh-sum-label">Vendor Company</span>
                      <strong className="soh-sum-value">{selectedQuote.VendorName}</strong>
                    </div>
                    <div className="soh-sum-item">
                      <span className="soh-sum-label">RFQ Reference</span>
                      <strong className="soh-sum-value">{selectedQuote.RfqReference}</strong>
                    </div>
                    <div className="soh-sum-item">
                      <span className="soh-sum-label">Quotation Date</span>
                      <strong className="soh-sum-value">{selectedQuote.QuotationDate || 'N/A'}</strong>
                    </div>
                    <div className="soh-sum-item">
                      <span className="soh-sum-label">Valid Until</span>
                      <strong className="soh-sum-value">{selectedQuote.QuotationValidUntil || '15 Days'}</strong>
                    </div>
                  </div>

                  {/* Product & Scope */}
                  <div className="soh-section-box">
                    <h4 className="soh-section-title">Product & Supply Parameters</h4>
                    <div className="soh-grid-3">
                      <div>
                        <span className="soh-detail-label">Product Name</span>
                        <p className="soh-detail-val">{selectedQuote.ProductName}</p>
                      </div>
                      <div>
                        <span className="soh-detail-label">Category / Grade</span>
                        <p className="soh-detail-val">{selectedQuote.Category || 'Industrial'} / {selectedQuote.Grade || 'Standard'}</p>
                      </div>
                      <div>
                        <span className="soh-detail-label">Supply Capability</span>
                        <p className="soh-detail-val">
                          {selectedQuote.CanSupplyFull ? 'Full Aggregated Demand' : 'Partial Supply Only'}
                        </p>
                      </div>
                      <div>
                        <span className="soh-detail-label">Offered Quantity</span>
                        <p className="soh-detail-val">{selectedQuote.OfferedQuantity} {selectedQuote.Uom}</p>
                      </div>
                      <div>
                        <span className="soh-detail-label">MOQ</span>
                        <p className="soh-detail-val">{selectedQuote.Moq || '1'} {selectedQuote.Uom}</p>
                      </div>
                      <div>
                        <span className="soh-detail-label">Packaging Type</span>
                        <p className="soh-detail-val">{selectedQuote.PackagingType || 'Standard'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Commercial Pricing Breakdown */}
                  <div className="soh-section-box highlight">
                    <h4 className="soh-section-title">Commercials & Valuation</h4>
                    <div className="soh-grid-4">
                      <div>
                        <span className="soh-detail-label">Offered Unit Price</span>
                        <p className="soh-detail-val price">
                          ₹{Number(selectedQuote.OfferedUnitPrice || 0).toLocaleString('en-IN')}/{selectedQuote.Uom}
                        </p>
                      </div>
                      <div>
                        <span className="soh-detail-label">GST Rate / Amount</span>
                        <p className="soh-detail-val">
                          {selectedQuote.GstRate || '18%'} (₹{Number(selectedQuote.GstAmount || 0).toLocaleString('en-IN')})
                        </p>
                      </div>
                      <div>
                        <span className="soh-detail-label">Freight Charges</span>
                        <p className="soh-detail-val">
                          {selectedQuote.FreightIncluded ? 'Included in Unit Price' : `₹${Number(selectedQuote.FreightCharges || 0).toLocaleString('en-IN')}`}
                        </p>
                      </div>
                      <div>
                        <span className="soh-detail-label">Estimated Grand Total</span>
                        <p className="soh-detail-val total">
                          ₹{Number(selectedQuote.EstimatedTotalValue || 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Logistics & Payment Terms */}
                  <div className="soh-section-box">
                    <h4 className="soh-section-title">Logistics & Commercial Terms</h4>
                    <div className="soh-grid-3">
                      <div>
                        <span className="soh-detail-label">Delivery Lead Time</span>
                        <p className="soh-detail-val">{selectedQuote.DeliveryLeadTimeDays || '7-14'} Days</p>
                      </div>
                      <div>
                        <span className="soh-detail-label">Payment Terms</span>
                        <p className="soh-detail-val">{selectedQuote.PaymentTerms || '30 Days Net'}</p>
                      </div>
                      <div>
                        <span className="soh-detail-label">Transportation</span>
                        <p className="soh-detail-val">{selectedQuote.TransportationResponsibility || 'Supplier Scope'}</p>
                      </div>
                    </div>
                    {selectedQuote.CommercialRemarks && (
                      <div style={{ marginTop: '12px' }}>
                        <span className="soh-detail-label">Supplier Remarks / Notes</span>
                        <p className="soh-detail-val remarks">{selectedQuote.CommercialRemarks}</p>
                      </div>
                    )}
                  </div>

                  {/* Platform Declaration Note */}
                  <div className="soh-disclaimer-note">
                    <ShieldCheck size={16} />
                    <span>
                      Synergy5M operates exclusively as a B2B aggregation, demand pooling, and facilitation platform.
                      Commercial execution, warranties, and billing are concluded directly between matched buyers and suppliers.
                    </span>
                  </div>
                </div>

                <div className="soh-modal-footer">
                  <button
                    type="button"
                    className="soh-btn-secondary"
                    onClick={() => setSelectedQuote(null)}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="soh-btn-secondary"
                    style={{ background: '#fff7ed', borderColor: '#fed7aa', color: '#c2410c', fontWeight: '700' }}
                    onClick={() => {
                      const ref = selectedQuote.OfferReference;
                      setSelectedQuote(null);
                      navigate(`/supply-offer/view?offerRef=${encodeURIComponent(ref)}`);
                    }}
                  >
                    📄 View Official Document (PDF)
                  </button>
                  <button
                    type="button"
                    className="soh-btn-primary"
                    onClick={() => {
                      setSelectedQuote(null);
                      handleOpenSubmitOffer(
                        `/supply-offer?rfq=${encodeURIComponent(selectedQuote.RfqReference)}&prodId=${encodeURIComponent(selectedQuote.OpportunityId || '')}&vendor=${encodeURIComponent(selectedQuote.VendorName)}&email=${encodeURIComponent(selectedQuote.VendorEmail)}&product=${encodeURIComponent(selectedQuote.ProductName)}&demand=${encodeURIComponent(selectedQuote.TotalRequiredDemand || selectedQuote.OfferedQuantity || 0)}&uom=${encodeURIComponent(selectedQuote.Uom || 'MT')}&dest=${encodeURIComponent(selectedQuote.Destination || '')}`,
                        selectedQuote.RfqReference
                      );
                    }}
                  >
                    <span>Open in Supply Offer Form</span>
                    <ArrowUpRight size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

