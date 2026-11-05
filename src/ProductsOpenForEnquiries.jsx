import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  ArrowRight,
  CheckCircle2,
  Eye,
  FileText,
  X,
  Send,
  Info
} from 'lucide-react';
import './ProductsOpenForEnquiries.css';

export default function ProductsOpenForEnquiries({ embedded = false }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSourcing, setSelectedSourcing] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Modal States
  const [activeDetailsProduct, setActiveDetailsProduct] = useState(null);
  const [activeEnquiryProduct, setActiveEnquiryProduct] = useState(null);

  // Enquiry Submission Form State
  const [enquiryForm, setEnquiryForm] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    requiredQuantity: '',
    deliveryLocation: '',
    region: 'Domestic',
    targetDeliveryDate: '',
    comments: ''
  });
  const [submittingEnquiry, setSubmittingEnquiry] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Fetch products from database API
  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      try {
        const res = await fetch('/api/public/products');
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.data)) {
            if (isMounted) {
              setProducts(data.data);
              setLoading(false);
              return;
            }
          }
        }
      } catch (err) {
        // Fallback to local cache
      }

      // Check local storage only for offline edits
      try {
        const local = JSON.parse(localStorage.getItem('s5m_published_products') || '[]');
        if (isMounted) {
          setProducts(Array.isArray(local) ? local : []);
          setLoading(false);
        }
      } catch (e) {
        if (isMounted) {
          setProducts([]);
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  // Extract all categories dynamically
  const categories = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (p.productMaster?.category) set.add(p.productMaster.category);
    });
    return ['All', ...Array.from(set)];
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      const p = item.productMaster || {};
      const opp = item.opportunity || {};

      // Search match (name, grade, SKU, category)
      const matchesSearch =
        !searchTerm.trim() ||
        (p.productName && p.productName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.gradeVariant && p.gradeVariant.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()));

      // Category match
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;

      // Sourcing match
      const sourcingOpts = opp.sourcingOptions || [];
      const matchesSourcing =
        selectedSourcing === 'All' ||
        (selectedSourcing === 'Domestic' && sourcingOpts.includes('Domestic')) ||
        (selectedSourcing === 'Import' && sourcingOpts.includes('Import'));

      // Status match
      const matchesStatus = selectedStatus === 'All' || opp.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesSourcing && matchesStatus;
    });
  }, [products, searchTerm, selectedCategory, selectedSourcing, selectedStatus]);

  // Handle Enquiry Submit
  const handleEnquirySubmit = async (e) => {
    e.preventDefault();
    if (!activeEnquiryProduct) return;

    // Client-side validations
    if (!enquiryForm.companyName || !enquiryForm.companyName.trim()) {
      setToastMessage('Please enter your company or organization name.');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    if (!enquiryForm.contactPerson || !enquiryForm.contactPerson.trim()) {
      setToastMessage('Please enter your contact person name.');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    const cleanEmail = (enquiryForm.email || '').trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!cleanEmail || cleanEmail.includes('..') || !emailRegex.test(cleanEmail)) {
      setToastMessage('Please enter a valid business email address.');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    const phoneTrimmed = (enquiryForm.phone || '').trim();
    const phoneRegex = /^[+]?[\d\s\-().]{7,25}$/;
    const digitsOnly = phoneTrimmed.replace(/\D/g, '');
    const subscriberDigits = digitsOnly.slice(-10);
    const isDummy = subscriberDigits.length >= 7 && /^(\d)\1+$/.test(subscriberDigits);

    if (!phoneRegex.test(phoneTrimmed) || digitsOnly.length < 10 || digitsOnly.length > 15 || isDummy) {
      setToastMessage('Please enter a valid contact phone or mobile number with 10 to 15 digits.');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    const qty = parseFloat(enquiryForm.requiredQuantity);
    if (isNaN(qty) || qty <= 0) {
      setToastMessage('Please enter a valid required quantity greater than 0.');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    const minQty = parseFloat(activeEnquiryProduct.opportunity?.minEnquiryQuantity);
    if (!isNaN(minQty) && minQty > 0 && qty < minQty) {
      setToastMessage(`Minimum enquiry quantity for this product is ${minQty} ${activeEnquiryProduct.productMaster?.uom || 'MT'}.`);
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    if (enquiryForm.targetDeliveryDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(enquiryForm.targetDeliveryDate) < today) {
        setToastMessage('Target delivery date cannot be in the past. Please select today or a future date.');
        setTimeout(() => setToastMessage(null), 4000);
        return;
      }
    }

    setSubmittingEnquiry(true);
    const payload = {
      productId: activeEnquiryProduct.id,
      productName: activeEnquiryProduct.productMaster?.productName,
      uom: activeEnquiryProduct.productMaster?.uom || 'MT',
      ...enquiryForm
    };

    try {
      const response = await fetch('/api/public/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      setSubmittingEnquiry(false);

      if (!response.ok || !data.success) {
        setToastMessage(data.message || 'Failed to submit enquiry. Please verify inputs.');
        setTimeout(() => setToastMessage(null), 5000);
        return;
      }

      setActiveEnquiryProduct(null);
      setEnquiryForm({
        companyName: '',
        contactPerson: '',
        email: '',
        phone: '',
        requiredQuantity: '',
        deliveryLocation: '',
        region: 'Domestic',
        targetDeliveryDate: '',
        comments: ''
      });
      setToastMessage(
        data.message || 'Thank you! Your collective buy enquiry has been received.'
      );
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err) {
      setSubmittingEnquiry(false);
      setToastMessage(err.message || 'Network error submitting enquiry. Please try again.');
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  // Helper to open enquiry modal
  const openEnquiryModal = (product) => {
    setActiveEnquiryProduct(product);
    setEnquiryForm((prev) => ({
      ...prev,
      requiredQuantity: product.opportunity?.minEnquiryQuantity || '',
      region: 'Domestic'
    }));
  };

  return (
    <div id="collective-products-catalog" className={`collective-showcase-wrap ${embedded ? 'collective-embedded-section' : 'collective-standalone-page'}`}>
      <div className="collective-container">
        {/* Section Header */}
        {/* <header className="showcase-header">
          <div className="showcase-kicker">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span>SYNERGY5M · COLLECTIVE BUY</span>
          </div>
          <h2 className="showcase-title">
            Products <span>Open for Enquiries</span>
          </h2>
          <p className="showcase-subtitle">
            Find an industrial raw material, submit your volume requirement, and participate in collective buying rounds to access direct manufacturer bulk pricing.
          </p>
        </header> */}

        {/* Filter Controls Bar */}
        <div className="showcase-controls-bar">
          <div className="showcase-search-box">
            <Search className="showcase-search-icon w-4 h-4" />
            <input
              type="text"
              placeholder="Search products, grades, SKUs or categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="showcase-search-input"
            />
          </div>

          <div className="showcase-filter-selects">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="showcase-select"
              aria-label="Filter by category"
            >
              <option value="All">All Categories ({products.length})</option>
              {categories.filter(c => c !== 'All').map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={selectedSourcing}
              onChange={(e) => setSelectedSourcing(e.target.value)}
              className="showcase-select"
              aria-label="Filter by sourcing"
            >
              <option value="All">All Sourcing</option>
              <option value="Domestic">Domestic 🇮🇳</option>
              <option value="Import">Import 🌐</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="showcase-select"
              aria-label="Filter by round status"
            >
              <option value="All">All Rounds</option>
              <option value="Open for Enquiries">Open for Enquiries</option>
              <option value="Closing Soon">Closing Soon</option>
              <option value="Upcoming">Upcoming</option>
            </select>
          </div>
        </div>

        {/* Category Quick Filter Chips */}
        {/* <div className="showcase-category-chips">
          {categories.map((cat) => {
            const count =
              cat === 'All'
                ? products.length
                : products.filter((p) => p.productMaster?.category === cat).length;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`category-chip-btn ${selectedCategory === cat ? 'active' : ''}`}
              >
                <span>{cat}</span>
                <span className="chip-count">{count}</span>
              </button>
            );
          })}
        </div> */}

        {/* Product Cards Grid */}
        {loading ? (
          <div className="showcase-empty-state">
            <div className="inline-block animate-spin text-teal-600 mb-3 text-2xl">⏳</div>
            <h4>Loading active buying rounds...</h4>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="showcase-empty-state">
            <Info className="w-12 h-12 text-slate-400 mx-auto mb-2" />
            <h4>No products match your search or filter</h4>
            <p className="text-sm text-slate-500 mb-4">
              Try adjusting your search terms or clearing the active category filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('All');
                setSelectedSourcing('All');
                setSelectedStatus('All');
              }}
              className="px-4 py-2 bg-teal-700 text-white rounded-lg text-xs font-bold hover:bg-teal-800 transition"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="products-cards-grid">
            {filteredProducts.map((item) => {
              const p = item.productMaster || {};
              const opp = item.opportunity || {};
              const sourcing = opp.sourcingOptions || ['Domestic'];
              const status = opp.status || 'Open for Enquiries';

              // Calculate days left
              let daysLeft = null;
              if (opp.enquiryClosingDate) {
                const diffTime = new Date(opp.enquiryClosingDate) - new Date();
                daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              }

              return (
                <article key={item.id} className="product-b2b-card">
                  {/* Card Media Container */}
                  <div className="product-card-media">
                    <img
                      src={
                        p.primaryImage?.url ||
                        'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80'
                      }
                      alt={p.productName || 'Industrial Product'}
                      className="product-card-image"
                      loading="lazy"
                    />

                    {/* Top overlay badges */}
                    <div className="card-media-overlay-top">
                      <span className="card-category-badge">{p.category || 'Raw Material'}</span>
                      <div
                        className={`status-pill ${status === 'Open for Enquiries'
                          ? 'status-open'
                          : status === 'Closing Soon'
                            ? 'status-closing'
                            : 'status-upcoming'
                          }`}
                      >
                        <span className="status-pulse-dot" />
                        <span>{status}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="product-card-body">
                    <h3 className="product-card-title">{p.productName}</h3>
                    <div className="product-card-grade">{p.gradeVariant || 'Standard Grade'}</div>

                    {/* <p className="product-card-desc">{p.shortDescription}</p> */}

                    {/* Specification chips row */}
                    {/* {p.specifications && p.specifications.length > 0 && (
                      <div className="product-specs-chips">
                        {p.specifications.slice(0, 3).map((spec, idx) => (
                          <span key={idx} className="spec-chip">
                            {spec.key}: {spec.value}
                          </span>
                        ))}
                      </div>
                    )} */}

                    {/* Meta info box */}
                    <div className="product-card-meta-box">
                      <div className="meta-row">
                        <span className="meta-label">Sourcing:</span>
                        <div className="sourcing-badges-wrap">
                          {sourcing.includes('Domestic') && (
                            <span className="sourcing-tag domestic">
                              <span>🇮🇳</span> Domestic
                            </span>
                          )}
                          {sourcing.includes('Import') && (
                            <span className="sourcing-tag import">
                              <span>🌐</span> Import
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="meta-row">
                        <span className="meta-label">Closes:</span>
                        <span className="meta-value">
                          {opp.enquiryClosingDate
                            ? new Date(opp.enquiryClosingDate).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })
                            : 'Open Round'}
                          {daysLeft !== null && daysLeft > 0 && (
                            <span className="text-teal-700 ml-1 text-[11px] font-semibold">
                              ({daysLeft}d left)
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="meta-row">
                        <span className="meta-label">Min. Enquiry (MOQ):</span>
                        <span className="meta-value">
                          {opp.minEnquiryQuantity || 1} {p.uom || 'MT'}
                        </span>
                      </div>
                    </div>

                    {/* Data Rule Notice */}
                    {/* <div className="demand-rule-note">
                      <span>Demand: live system data</span>
                      <span className="demand-verified-pill">Verified MSME Round</span>
                    </div> */}

                    {/* Card Actions */}
                    <div className="product-card-actions">
                      <button
                        type="button"
                        onClick={() => setActiveDetailsProduct(item)}
                        className="card-btn-details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Details</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEnquiryModal(item)}
                        className="card-btn-enquiry"
                      >
                        <span>Submit Enquiry</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* =====================================================================
          1. View Details Modal
          ===================================================================== */}
      {activeDetailsProduct && (
        <div
          className="showcase-modal-backdrop"
          onClick={() => setActiveDetailsProduct(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="showcase-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="showcase-modal-header">
              <div>
                <span className="text-xs font-bold text-teal-700 tracking-wider uppercase block">
                  {activeDetailsProduct.productMaster?.category}
                </span>
                <h3 className="text-xl font-bold text-[#0F2A47]">
                  {activeDetailsProduct.productMaster?.productName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveDetailsProduct(null)}
                className="showcase-modal-close-btn"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="showcase-modal-body">
              <div className="flex gap-4 items-center mb-4">
                <img
                  src={
                    activeDetailsProduct.productMaster?.primaryImage?.url ||
                    'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80'
                  }
                  alt={activeDetailsProduct.productMaster?.productName}
                  className="w-24 h-24 object-cover rounded-lg border border-slate-200"
                />
                <div>
                  <div className="text-sm font-bold text-[#0F2A47]">
                    Grade: {activeDetailsProduct.productMaster?.gradeVariant}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    SKU: {activeDetailsProduct.productMaster?.sku || 'N/A'} | HSN: {activeDetailsProduct.productMaster?.hsnCode || 'N/A'}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <span className="status-pill status-open">
                      {activeDetailsProduct.opportunity?.status}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                {activeDetailsProduct.productMaster?.shortDescription}
              </p>

              {/* Technical Specifications Table */}
              <h4 className="text-sm font-bold text-[#0F2A47] mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-teal-600" />
                Technical Specifications
              </h4>

              {activeDetailsProduct.productMaster?.specifications?.length > 0 ? (
                <table className="spec-table">
                  <thead>
                    <tr>
                      <th>Parameter / Property</th>
                      <th>Specified Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeDetailsProduct.productMaster.specifications.map((row, i) => (
                      <tr key={i}>
                        <td>{row.key}</td>
                        <td>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-slate-400 italic mb-4">No specific parameters configured.</p>
              )}

              {/* End Use & Packaging */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="font-bold text-slate-700 block mb-1">Recommended Applications:</span>
                  <span className="text-slate-600">
                    {activeDetailsProduct.productMaster?.applicationEndUse || 'Standard commercial processing.'}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-700 block mb-1">Packaging Standard:</span>
                  <span className="text-slate-600">
                    {activeDetailsProduct.productMaster?.packagingType || 'Standard palletized bags.'}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-700 block mb-1">Default Delivery Window:</span>
                  <span className="text-slate-600">
                    {activeDetailsProduct.opportunity?.defaultDeliveryWindow || '7 - 10 business days.'}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-700 block mb-1">Allowed Sourcing:</span>
                  <span className="text-slate-600">
                    {activeDetailsProduct.opportunity?.sourcingOptions?.join(', ')}
                    {activeDetailsProduct.opportunity?.allowedImportOrigins?.length > 0 &&
                      ` (${activeDetailsProduct.opportunity.allowedImportOrigins.join(', ')})`}
                  </span>
                </div>
              </div>

              {/* Action in Modal */}
              <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    const prod = activeDetailsProduct;
                    setActiveDetailsProduct(null);
                    openEnquiryModal(prod);
                  }}
                  className="card-btn-enquiry flex-1 py-3"
                >
                  <span>Submit Requirement Enquiry</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          2. Submit Enquiry Modal
          ===================================================================== */}
      {activeEnquiryProduct && (
        <div
          className="showcase-modal-backdrop"
          onClick={() => setActiveEnquiryProduct(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="showcase-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="showcase-modal-header">
              <div>
                <span className="text-xs font-bold text-teal-700 uppercase tracking-wider block">
                  Collective Buy Enquiry Round
                </span>
                <h3 className="text-lg font-bold text-[#0F2A47]">
                  {activeEnquiryProduct.productMaster?.productName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveEnquiryProduct(null)}
                className="showcase-modal-close-btn"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEnquirySubmit} className="showcase-modal-body">
              <div className="p-3 mb-4 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-teal-700 flex-shrink-0 mt-0.5" />
                <span>
                  Submit your required volume. Synergy5M aggregates demand from MSMEs to negotiate direct ex-plant pricing. MOQ for this product is{' '}
                  <strong>
                    {activeEnquiryProduct.opportunity?.minEnquiryQuantity || 1}{' '}
                    {activeEnquiryProduct.productMaster?.uom || 'MT'}
                  </strong>.
                </span>
              </div>

              <div className="enquiry-form-grid">
                <div className="enquiry-form-group">
                  <label className="enquiry-form-label">Company Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Plastics Pvt Ltd"
                    value={enquiryForm.companyName}
                    onChange={(e) => setEnquiryForm({ ...enquiryForm, companyName: e.target.value })}
                    className="enquiry-form-input"
                  />
                </div>

                <div className="enquiry-form-group">
                  <label className="enquiry-form-label">Contact Person *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rajesh Sharma"
                    value={enquiryForm.contactPerson}
                    onChange={(e) => setEnquiryForm({ ...enquiryForm, contactPerson: e.target.value })}
                    className="enquiry-form-input"
                  />
                </div>
              </div>

              <div className="enquiry-form-grid">
                <div className="enquiry-form-group">
                  <label className="enquiry-form-label">Official Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. procurement@apexplastics.com"
                    value={enquiryForm.email}
                    onChange={(e) => setEnquiryForm({ ...enquiryForm, email: e.target.value })}
                    className="enquiry-form-input"
                  />
                </div>

                <div className="enquiry-form-group">
                  <label className="enquiry-form-label">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +91 98200 12345"
                    value={enquiryForm.phone}
                    onChange={(e) => setEnquiryForm({ ...enquiryForm, phone: e.target.value })}
                    className="enquiry-form-input"
                  />
                </div>
              </div>

              <div className="enquiry-form-grid">
                <div className="enquiry-form-group">
                  <label className="enquiry-form-label">
                    Required Quantity ({activeEnquiryProduct.productMaster?.uom || 'MT'}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min={activeEnquiryProduct.opportunity?.minEnquiryQuantity || 1}
                    required
                    placeholder={`Min ${activeEnquiryProduct.opportunity?.minEnquiryQuantity || 1}`}
                    value={enquiryForm.requiredQuantity}
                    onChange={(e) => setEnquiryForm({ ...enquiryForm, requiredQuantity: e.target.value })}
                    className="enquiry-form-input font-bold"
                  />
                </div>

                <div className="enquiry-form-group">
                  <label className="enquiry-form-label">Delivery Location (City / State) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vapi, Gujarat / Daman"
                    value={enquiryForm.deliveryLocation}
                    onChange={(e) => setEnquiryForm({ ...enquiryForm, deliveryLocation: e.target.value })}
                    className="enquiry-form-input"
                  />
                </div>
              </div>

              <div className="enquiry-form-grid">
                <div className="enquiry-form-group">
                  <label className="enquiry-form-label">Sourcing Region *</label>
                  <select
                    required
                    value={enquiryForm.region || 'Domestic'}
                    onChange={(e) => setEnquiryForm({ ...enquiryForm, region: e.target.value })}
                    className="enquiry-form-input bg-white"
                  >
                    <option value="Domestic">Domestic 🇮🇳</option>
                    <option value="International">International / Import 🌐</option>
                  </select>
                </div>

                <div className="enquiry-form-group">
                  <label className="enquiry-form-label">Target Delivery Month / Date</label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={enquiryForm.targetDeliveryDate}
                    onChange={(e) => setEnquiryForm({ ...enquiryForm, targetDeliveryDate: e.target.value })}
                    className="enquiry-form-input"
                  />
                </div>
              </div>

              <div className="enquiry-form-group">
                <label className="enquiry-form-label">Additional Comments or Specific Sourcing Preference</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Prefer domestic ex-plant delivery; need COA and test report before dispatch."
                  value={enquiryForm.comments}
                  onChange={(e) => setEnquiryForm({ ...enquiryForm, comments: e.target.value })}
                  className="enquiry-form-textarea"
                />
              </div>

              <button
                type="submit"
                disabled={submittingEnquiry}
                className="enquiry-submit-btn mt-2"
              >
                {submittingEnquiry ? (
                  <span>Submitting Enquiry...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Collective Buy Enquiry</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="showcase-toast" role="status">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
