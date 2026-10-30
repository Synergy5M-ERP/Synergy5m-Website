import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { getAuthHeaders, handleAuthError } from './AdminAuthGuard';

const FONT = "'Inter', -apple-system, 'Segoe UI', sans-serif";

const css = `
.sev-page{min-height:100vh;background:#eef1f0;font-family:${FONT};color:#1b2a28;padding-bottom:110px}
.sev-wrap{max-width:1440px;margin:0 auto;padding:0 24px}
.sev-top{background:#14524A;color:#fff}
.sev-top-in{max-width:1440px;margin:0 auto;padding:14px 24px;display:flex;justify-content:space-between;align-items:center}
.sev-brand{display:flex;align-items:center;gap:12px}
.sev-mark{width:36px;height:36px;border-radius:9px;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}
.sev-brand b{display:block;font-size:15px}
.sev-brand span{font-size:12px;color:rgba(255,255,255,.7)}
.sev-ghost{display:flex;align-items:center;gap:7px;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.35);padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;font-family:inherit;transition:background .15s}
.sev-ghost:hover{background:rgba(255,255,255,.12)}
.sev-bar{background:#fff;border:1px solid #dde4e2;border-radius:16px;margin:16px 0 20px;padding:18px 24px;display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between;box-shadow:0 1px 3px rgba(20,82,74,.06)}
.sev-bar-left h2{margin:0 0 4px;font-size:20px;font-weight:700;letter-spacing:-.4px;color:#0f2f2b}
.sev-bar-left p{margin:0;font-size:13.5px;color:#5f716e}
.sev-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:#e8f4f1;border:1px solid #bce1da;color:#14524A;border-radius:6px;font-size:12px;font-weight:700;margin-left:8px}
.sev-filter{display:flex;gap:8px;align-items:center;flex-shrink:0}
.sev-select,.sev-cat-search{padding:9px 12px;border-radius:10px;border:1px solid #cbd6d3;font:13.5px ${FONT};background:#fff;color:#27403c}
.sev-select{min-width:180px}
.sev-clear{background:#e6efed;border:0;padding:9px 12px;border-radius:9px;font:600 13px ${FONT};color:#14524A;cursor:pointer;white-space:nowrap}
.sev-clear:hover{background:#d6e5e2}
.sev-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}
@media(max-width:1100px){.sev-grid{grid-template-columns:1fr}}
.sev-card{background:#fff;border:1px solid #dde4e2;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(20,82,74,.06)}
.sev-card-h{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #e8eeec;gap:12px;flex-wrap:nowrap}
.sev-card-h-left{display:flex;align-items:center;gap:8px;flex-shrink:0}
.sev-card-h h3{margin:0;font-size:16px;font-weight:700;color:#0f2f2b}
.sev-count{font-weight:600;font-size:12px;color:#6b7c79;background:#eef1f0;padding:3px 9px;border-radius:20px}
.sev-search-input{flex:1;min-width:0;width:100%;padding:7px 11px;border-radius:8px;border:1px solid #cbd6d3;font:13px ${FONT};background:#fff;color:#27403c}
.sev-sel{font-size:12px;font-weight:600;padding:4px 10px;border-radius:20px;background:#eef1f0;color:#6b7c79;white-space:nowrap;flex-shrink:0;transition:all .15s}
.sev-sel.has{background:#14524A;color:#fff}
.sev-scroll{max-height:520px;overflow:auto}
.sev-table{width:100%;border-collapse:separate;border-spacing:0;font-size:13.5px;text-align:left}
.sev-table th{position:sticky;top:0;z-index:2;background:#f5f8f7;color:#5f716e;font-weight:600;font-size:12px;padding:12px 16px;border-bottom:1px solid #dde4e2;white-space:nowrap}
.sev-table td{padding:13px 16px;border-bottom:1px solid #eef2f1;vertical-align:middle}
.sev-table tbody tr{cursor:pointer;transition:background .12s}
.sev-table tbody tr:hover{background:#f4f9f8}
.sev-table tbody tr.on{background:#e8f4f1}
.sev-table tbody tr.on td:first-child{box-shadow:inset 3px 0 0 #14524A}
.sev-table tbody tr:last-child td{border-bottom:0}
.sev-chk{width:17px;height:17px;accent-color:#14524A;cursor:pointer}
.sev-code{font-weight:700;color:#14524A;white-space:nowrap}
.sev-tag{display:inline-block;background:#e9f0ee;color:#3d5753;padding:3px 9px;border-radius:6px;font-size:12px;font-weight:500}
.sev-price{font-weight:700;color:#087f82;white-space:nowrap}
.sev-mail{color:#0b7a8c;font-size:13px}
.sev-mail.none{color:#a2b0ad;font-style:italic}
.sev-email-btn{display:inline-flex;align-items:center;gap:7px;background:#f0f7f5;border:1px solid #bce1da;color:#14524A;padding:6px 12px;border-radius:8px;font-size:12.5px;font-family:inherit;font-weight:600;cursor:pointer;transition:all .15s;text-align:left}
.sev-email-btn:hover:not(:disabled){background:#d6ece7;border-color:#087f82;transform:translateY(-1px);box-shadow:0 2px 6px rgba(20,82,74,.12)}
.sev-email-btn:disabled{opacity:.7;cursor:wait}
.sev-email-btn.sent{background:#e8f8f0;border-color:#a3e6be;color:#166534}
.sev-email-icon{font-size:13px}
.sev-email-text{text-decoration:underline;text-underline-offset:2px;word-break:break-all}
.sev-email-badge{font-size:11px;padding:2px 7px;border-radius:5px;font-weight:700;white-space:nowrap}
.sev-email-badge.action{background:#14524A;color:#fff}
.sev-email-btn:hover .sev-email-badge.action{background:#087f82}
.sev-email-badge.sending{background:#fef3c7;color:#92400e}
.sev-email-badge.sent{background:#166534;color:#fff}
.sev-empty{text-align:center;color:#8a9a97;padding:56px 16px!important}
.sev-dock{position:fixed;left:0;right:0;bottom:0;z-index:50;background:rgba(255,255,255,.94);backdrop-filter:blur(8px);border-top:1px solid #dde4e2;box-shadow:0 -6px 20px rgba(20,82,74,.08)}
.sev-dock-in{max-width:1440px;margin:0 auto;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
.sev-sum{font-size:14px;color:#4a5f5b}
.sev-sum b{color:#14524A}
.sev-send{padding:13px 30px;font:600 15px ${FONT};background:#14524A;color:#fff;border:0;border-radius:11px;cursor:pointer;box-shadow:0 4px 12px rgba(20,82,74,.3);transition:transform .15s,background .15s;display:flex;align-items:center;gap:8px}
.sev-send:hover:not(:disabled){background:#0f433c;transform:translateY(-1px)}
.sev-send:disabled{background:#b9c7c4;box-shadow:none;cursor:not-allowed}
.sev-toast{position:fixed;top:24px;right:24px;z-index:9999;padding:14px 20px;border-radius:12px;font-weight:600;font-size:14px;border:1px solid;box-shadow:0 12px 24px -6px rgba(0,0,0,.15);display:flex;align-items:center;gap:10px;max-width:420px}
.sev-toast.success{background:#e3f6ee;color:#0b5a3e;border-color:#79d0aa}
.sev-toast.error{background:#fdeaea;color:#8f1d1d;border-color:#f0a0a0}
.sev-toast.info{background:#e4f2f8;color:#0a5670;border-color:#8cc9de}
`;

export default function SendEnquiryToVendors() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [oppData, setOppData] = useState(null);
    const [enquiries, setEnquiries] = useState([]);
    const [vendorList, setVendorList] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');

    const [selectedEnqIds, setSelectedEnqIds] = useState([]);
    const [selectedVendorIds, setSelectedVendorIds] = useState([]);
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);

    // Single-vendor manual email sending state
    const [sendingEmailId, setSendingEmailId] = useState(null);
    const [sentEmailIds, setSentEmailIds] = useState([]);

    const [enqSearch, setEnqSearch] = useState('');
    const [vendorSearch, setVendorSearch] = useState('');
    const [categorySearch, setCategorySearch] = useState('');

    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
    };

    // 1. Fetch available categories
    useEffect(() => {
        axios.get('/api/enquiry-categories')
            .then(res => setCategories(res.data || []))
            .catch(() => {});
    }, []);

    // 2. Fetch specific product opportunity details & enquiries
    useEffect(() => {
        if (!id) return;
        setLoading(true);
        axios.get(`/api/collective-buying/opportunity-data/${id}`)
            .then(res => {
                const data = res.data;
                setOppData(data.opportunity);
                if (data.opportunity?.category) {
                    setSelectedCategory(data.opportunity.category);
                }

                // If specific buyer enquiries returned for this product
                if (Array.isArray(data.buyerEnquiries) && data.buyerEnquiries.length > 0) {
                    const normalized = data.buyerEnquiries.map(e => ({
                        Id: e.id,
                        ProductName: data.opportunity.productName,
                        Category: data.opportunity.category,
                        RequiredQuantity: e.quantity,
                        Uom: e.uom || data.opportunity.uom || 'MT',
                        DeliveryLocation: e.region,
                        CompanyName: e.companyName || e.ref,
                        ContactPerson: e.contactPerson,
                        TargetDeliveryDate: e.targetDeliveryDate,
                        CreatedAt: e.date
                    }));
                    setEnquiries(normalized);
                    setSelectedEnqIds(normalized.map(e => e.Id));
                } else {
                    // Fallback to fetch category-wide collective enquiries
                    axios.get(`/api/collective-enquiries-for-vendors?category=${encodeURIComponent(data.opportunity?.category || '')}`, { headers: getAuthHeaders() })
                        .then(enqRes => {
                            const list = enqRes.data || [];
                            setEnquiries(list);
                            setSelectedEnqIds(list.map(e => e.Id));
                        })
                        .catch(() => {});
                }
            })
            .catch(err => {
                // Handled via user toast
                showToast('Could not load opportunity details', 'error');
            })
            .finally(() => setLoading(false));
    }, [id]);

    // 3. Fetch Vendors matching selected category (NO automatic selection)
    useEffect(() => {
        axios.get(`/api/potential-vendors${selectedCategory ? `?category=${encodeURIComponent(selectedCategory)}` : ''}`, { headers: getAuthHeaders() })
            .then(res => {
                const vendors = res.data || [];
                setVendorList(vendors);
                // Intentionally do NOT auto-select vendors: user sends manually
                setSelectedVendorIds([]);
            })
            .catch(err => {
                if (err.response?.status === 401 || err.response?.status === 403) {
                    handleAuthError(err.response.status, navigate);
                }
                // Handled via user toast
            });
    }, [selectedCategory, navigate]);

    const toggle = (setter, itemId) =>
        setter(prev => prev.includes(itemId) ? prev.filter(x => x !== itemId) : [...prev, itemId]);

    // Filter enquiries by search query
    const filteredEnquiries = useMemo(() => {
        const q = enqSearch.toLowerCase().trim();
        if (!q) return enquiries;
        return enquiries.filter(item => {
            const name = (item.ProductName || item.ProdName || '').toLowerCase();
            const comp = (item.CompanyName || '').toLowerCase();
            const ref = String(item.Id || '');
            return name.includes(q) || comp.includes(q) || ref.includes(q);
        });
    }, [enquiries, enqSearch]);

    // Filter vendors by search query
    const filteredVendors = useMemo(() => {
        const q = vendorSearch.toLowerCase().trim();
        if (!q) return vendorList;
        return vendorList.filter(v => {
            const comp = (v.Company_Name || '').toLowerCase();
            const cat = (v.Category || '').toLowerCase();
            const email = (v.Email || '').toLowerCase();
            return comp.includes(q) || cat.includes(q) || email.includes(q);
        });
    }, [vendorList, vendorSearch]);

    const filteredCategories = useMemo(() => {
        const q = categorySearch.toLowerCase().trim();
        if (!q) return categories;
        return categories.filter(c => (c || '').toLowerCase().includes(q));
    }, [categories, categorySearch]);

    const allEnquiriesChecked = filteredEnquiries.length > 0 && filteredEnquiries.every(e => selectedEnqIds.includes(e.Id));
    const allVendorsChecked = filteredVendors.length > 0 && filteredVendors.every(v => selectedVendorIds.includes(v.Id));
    const canSend = selectedEnqIds.length > 0 && selectedVendorIds.length > 0 && !sending;

    // Helper: Get active enquiries payload (combining all enquiries for this product)
    const getActiveEnquiries = () => {
        if (selectedEnqIds.length > 0) {
            return enquiries.filter(e => selectedEnqIds.includes(e.Id));
        }
        if (enquiries.length > 0) {
            return enquiries; // Combines all buyer enquiries into one email
        }
        return [{
            Id: oppData?.id || 1,
            ProductName: oppData?.productName || 'Industrial Product',
            Category: oppData?.category || selectedCategory || 'Industrial',
            RequiredQuantity: oppData?.demandSummary?.committedQuantity || 10,
            Uom: oppData?.uom || 'MT',
            DeliveryLocation: 'As per buyer network',
            TargetDeliveryDate: null,
            Comments: 'Consolidated Buyer Enquiry'
        }];
    };

    // MANUAL SEND: Triggered directly when clicking on a vendor's email address
    const handleSendToVendorEmail = async (vendor) => {
        if (!vendor || !vendor.Email) {
            showToast('No valid email address registered for this vendor.', 'error');
            return;
        }

        const enqsToSend = getActiveEnquiries();
        setSendingEmailId(vendor.Id);
        showToast(`Sending 1 combined email (${enqsToSend.length} buyer requirements) to ${vendor.Email}...`, 'info');

        try {
            const payload = {
                collectiveEnqIds: enqsToSend.map(e => e.Id),
                vendorIds: [vendor.Id],
                mode: 'submit-offer',
                enquiriesData: enqsToSend
            };

            const response = await axios.post('/api/send-enquiry-email', payload, {
                headers: getAuthHeaders(),
                timeout: 25000
            });

            if (response.data && response.data.success) {
                setSentEmailIds(prev => (prev.includes(vendor.Id) ? prev : [...prev, vendor.Id]));
                showToast(`1 combined enquiry email successfully sent to ${vendor.Company_Name} (${vendor.Email})!`, 'success');
            } else {
                throw new Error(response.data?.message || 'Failed to send email');
            }
        } catch (error) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                handleAuthError(error.response.status, navigate);
                return;
            }
            const errMsg = error.response?.data?.error || error.message || 'Could not send the email.';
            showToast(`Error sending to ${vendor.Email}: ${errMsg}`, 'error');
            // Handled via user toast
        } finally {
            setSendingEmailId(null);
        }
    };

    // Send emails for multiple manually checked vendors
    const handleSendNotification = async () => {
        if (selectedEnqIds.length === 0 || selectedVendorIds.length === 0) {
            showToast('Please select at least one enquiry requirement and one vendor.', 'error');
            return;
        }

        setSending(true);
        showToast('Sending enquiries to selected vendors...', 'info');

        try {
            const selectedEnquiries = enquiries.filter(e => selectedEnqIds.includes(e.Id));
            const payload = {
                collectiveEnqIds: selectedEnqIds,
                vendorIds: selectedVendorIds,
                mode: 'submit-offer',
                enquiriesData: selectedEnquiries
            };

            const response = await axios.post('/api/send-enquiry-email', payload, {
                headers: getAuthHeaders(),
                timeout: 30000
            });
            showToast(response.data.message || 'Enquiry successfully dispatched to vendors to submit offers!', 'success');
            setSentEmailIds(prev => Array.from(new Set([...prev, ...selectedVendorIds])));
        } catch (error) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                handleAuthError(error.response.status, navigate);
                return;
            }
            const errMsg = error.response?.data?.error || error.message || 'Could not send the emails.';
            showToast(errMsg, 'error');
            // Handled via user toast
        } finally {
            setSending(false);
        }
    };

    const toastIcon = toast.type === 'error' ? '⚠️' : toast.type === 'info' ? 'ℹ️' : '✅';

    return (
        <div className="sev-page">
            <style>{css}</style>

            <header className="sev-top">
                <div className="sev-top-in">
                    <div className="sev-brand">
                        <div className="sev-mark">S5</div>
                        <div>
                            <b>Synergy 5M</b>
                            <span>Collective Procurement • Vendor RFQ Dispatch</span>
                        </div>
                    </div>
                    <button type="button" className="sev-ghost" onClick={() => navigate(id ? `/admin/opportunity/${id}` : '/admin/opportunities')}>
                        ← Back to Opportunity
                    </button>
                </div>
            </header>

            {toast.show && (
                <div className={`sev-toast ${toast.type}`} role="status">
                    <span>{toastIcon}</span>{toast.message}
                </div>
            )}

            <div className="sev-wrap">
                <section className="sev-bar">
                    <div className="sev-bar-left">
                        <h2>
                            Dispatch Enquiry to Category Vendors
                            {oppData && (
                                <span className="sev-pill">
                                    {oppData.productName} ({oppData.category || 'Product'})
                                </span>
                            )}
                        </h2>
                        <p>
                            Click on any vendor's email address to send the enquiry requirement manually. Nothing is sent automatically.
                        </p>
                    </div>

                    <div className="sev-filter">
                        <input
                            type="text"
                            className="sev-cat-search"
                            placeholder="Filter categories..."
                            value={categorySearch}
                            onChange={(e) => setCategorySearch(e.target.value)}
                            aria-label="Search category"
                        />
                        <select
                            className="sev-select"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            aria-label="Select vendor category"
                        >
                            <option value="">All Categories ({categories.length})</option>
                            {filteredCategories.map((cat, idx) => (
                                <option key={idx} value={cat}>{cat}</option>
                            ))}
                        </select>
                        {selectedCategory && (
                            <button type="button" className="sev-clear" onClick={() => { setSelectedCategory(''); setCategorySearch(''); }}>
                                Clear ✕
                            </button>
                        )}
                    </div>
                </section>

                <div className="sev-grid">
                    {/* LEFT BLOCK: Buyer Enquiries */}
                    <section className="sev-card">
                        <div className="sev-card-h">
                            <div className="sev-card-h-left">
                                <h3>Buyer Demand Requirements</h3>
                                <span className="sev-count">{enquiries.length}</span>
                            </div>
                            <input
                                type="text"
                                className="sev-search-input"
                                placeholder="Search by Buyer, Company, Ref..."
                                value={enqSearch}
                                onChange={(e) => setEnqSearch(e.target.value)}
                            />
                            <span className={`sev-sel ${selectedEnqIds.length ? 'has' : ''}`}>
                                {selectedEnqIds.length} selected
                            </span>
                        </div>

                        <div className="sev-scroll">
                            <table className="sev-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 44 }}>
                                            <input
                                                type="checkbox"
                                                className="sev-chk"
                                                aria-label="Select all enquiries"
                                                checked={allEnquiriesChecked}
                                                onChange={() => {
                                                    if (allEnquiriesChecked) {
                                                        setSelectedEnqIds(prev => prev.filter(id => !filteredEnquiries.some(e => e.Id === id)));
                                                    } else {
                                                        const newIds = Array.from(new Set([...selectedEnqIds, ...filteredEnquiries.map(e => e.Id)]));
                                                        setSelectedEnqIds(newIds);
                                                    }
                                                }}
                                            />
                                        </th>
                                        <th>Ref ID</th>
                                        <th>Buyer / Company</th>
                                        <th>Demand Volume</th>
                                        <th>Delivery Destination</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="5" className="sev-empty">Loading enquiries...</td></tr>
                                    ) : filteredEnquiries.length === 0 ? (
                                        <tr><td colSpan="5" className="sev-empty">No buyer enquiries found for this product.</td></tr>
                                    ) : (
                                        filteredEnquiries.map(enq => {
                                            const isChecked = selectedEnqIds.includes(enq.Id);
                                            return (
                                                <tr key={enq.Id} className={isChecked ? 'on' : ''} onClick={() => toggle(setSelectedEnqIds, enq.Id)}>
                                                    <td onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            className="sev-chk"
                                                            checked={isChecked}
                                                            onChange={() => toggle(setSelectedEnqIds, enq.Id)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <span className="sev-code">#CE-{enq.Id}</span>
                                                    </td>
                                                    <td>
                                                        <strong>{enq.CompanyName || 'Verified Industrial Buyer'}</strong>
                                                        {enq.ContactPerson && enq.ContactPerson !== enq.CompanyName && (
                                                            <div style={{ fontSize: '11.5px', color: '#6b7c79' }}>
                                                                Contact: {enq.ContactPerson}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="sev-price">
                                                        {enq.RequiredQuantity} {enq.Uom || 'MT'}
                                                    </td>
                                                    <td style={{ fontSize: '12.5px', color: '#475569' }}>
                                                        {enq.DeliveryLocation || 'Ex-Works / Standard'}
                                                        {enq.TargetDeliveryDate && (
                                                            <div style={{ fontSize: '11px', color: '#8a9a97' }}>
                                                                By: {new Date(enq.TargetDeliveryDate).toLocaleDateString('en-IN')}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* RIGHT BLOCK: Potential Vendors of Category */}
                    <section className="sev-card">
                        <div className="sev-card-h">
                            <div className="sev-card-h-left">
                                <h3>Potential Vendors {selectedCategory ? `(${selectedCategory})` : ''}</h3>
                                <span className="sev-count">{vendorList.length}</span>
                            </div>
                            <input
                                type="text"
                                className="sev-search-input"
                                placeholder="Search vendor name, email..."
                                value={vendorSearch}
                                onChange={(e) => setVendorSearch(e.target.value)}
                            />
                            <span className={`sev-sel ${selectedVendorIds.length ? 'has' : ''}`}>
                                {selectedVendorIds.length} checked
                            </span>
                        </div>

                        <div className="sev-scroll">
                            <table className="sev-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 44 }}>
                                            <input
                                                type="checkbox"
                                                className="sev-chk"
                                                aria-label="Select all vendors"
                                                checked={allVendorsChecked}
                                                onChange={() => {
                                                    if (allVendorsChecked) {
                                                        setSelectedVendorIds(prev => prev.filter(id => !filteredVendors.some(v => v.Id === id)));
                                                    } else {
                                                        const newIds = Array.from(new Set([...selectedVendorIds, ...filteredVendors.map(v => v.Id)]));
                                                        setSelectedVendorIds(newIds);
                                                    }
                                                }}
                                            />
                                        </th>
                                        <th>Vendor / Category</th>
                                        <th>Email (Click to Send Manually)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredVendors.length === 0 ? (
                                        <tr><td colSpan="3" className="sev-empty">No vendors found for this category.</td></tr>
                                    ) : (
                                        filteredVendors.map(vendor => {
                                            const isChecked = selectedVendorIds.includes(vendor.Id);
                                            const isSending = sendingEmailId === vendor.Id;
                                            const isSent = sentEmailIds.includes(vendor.Id);

                                            return (
                                                <tr key={vendor.Id} className={isChecked ? 'on' : ''} onClick={() => toggle(setSelectedVendorIds, vendor.Id)}>
                                                    <td onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            className="sev-chk"
                                                            checked={isChecked}
                                                            onChange={() => toggle(setSelectedVendorIds, vendor.Id)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <strong>{vendor.Company_Name}</strong><br />
                                                        {vendor.Category ? <span className="sev-tag">{vendor.Category}</span> : '-'}
                                                    </td>
                                                    <td onClick={(e) => e.stopPropagation()}>
                                                        {vendor.Email ? (
                                                            <button
                                                                type="button"
                                                                className={`sev-email-btn ${isSent ? 'sent' : ''}`}
                                                                title={`Click to manually send enquiry email to ${vendor.Email}`}
                                                                onClick={() => handleSendToVendorEmail(vendor)}
                                                                disabled={isSending}
                                                            >
                                                                <span className="sev-email-icon">✉</span>
                                                                <span className="sev-email-text">{vendor.Email}</span>
                                                                {isSending ? (
                                                                    <span className="sev-email-badge sending">Sending...</span>
                                                                ) : isSent ? (
                                                                    <span className="sev-email-badge sent">Sent ✓</span>
                                                                ) : (
                                                                    <span className="sev-email-badge action">Send Mail →</span>
                                                                )}
                                                            </button>
                                                        ) : (
                                                            <span className="sev-mail none">No email registered</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </div>

            {/* Sticky Action Dock */}
            {selectedVendorIds.length > 0 && (
                <div className="sev-dock">
                    <div className="sev-dock-in">
                        <div className="sev-sum">
                            Dispatch <b>{selectedEnqIds.length}</b> buyer requirement {selectedEnqIds.length === 1 ? 'record' : 'records'} to{' '}
                            <b>{selectedVendorIds.length}</b> checked {selectedVendorIds.length === 1 ? 'vendor' : 'vendors'}
                        </div>
                        <button type="button" className="sev-send" onClick={handleSendNotification} disabled={!canSend}>
                            {sending ? 'Sending...' : 'Send to Checked Vendors'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
