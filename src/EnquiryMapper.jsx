import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const FONT = "'Inter', -apple-system, 'Segoe UI', sans-serif";

const css = `
.em-page{min-height:100vh;background:#eef1f0;font-family:${FONT};color:#1b2a28;padding-bottom:110px}
.em-wrap{max-width:1440px;margin:0 auto;padding:0 24px}
.em-top{background:#14524A;color:#fff}
.em-top-in{max-width:1440px;margin:0 auto;padding:14px 24px;display:flex;justify-content:space-between;align-items:center}
.em-brand{display:flex;align-items:center;gap:12px}
.em-mark{width:36px;height:36px;border-radius:9px;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}
.em-brand b{display:block;font-size:15px}
.em-brand span{font-size:12px;color:rgba(255,255,255,.7)}
.em-ghost{display:flex;align-items:center;gap:7px;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.35);padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;font-family:inherit;transition:background .15s}
.em-ghost:hover{background:rgba(255,255,255,.12)}
.em-bar{background:#fff;border:1px solid #dde4e2;border-radius:16px;margin:12px 0 12px;padding:16px 24px;display:flex;flex-wrap:nowrap;gap:16px;align-items:center;justify-content:space-between;box-shadow:0 1px 2px rgba(20,82,74,.06)}
.em-bar h2{margin:0 0 2px;font-size:19px;font-weight:700;letter-spacing:-.4px;color:#0f2f2b}
.em-bar p{margin:0;font-size:13px;color:#5f716e}
.em-seg{display:inline-flex;background:#eef1f0;padding:4px;border-radius:11px;flex-shrink:0}
.em-seg button{border:0;background:transparent;padding:8px 14px;border-radius:8px;font:600 13px ${FONT};color:#5f716e;cursor:pointer;transition:all .15s}
.em-seg button.on{background:#14524A;color:#fff;box-shadow:0 2px 6px rgba(20,82,74,.28)}
.em-seg button:not(.on):hover{color:#14524A}
.em-filter{display:flex;gap:8px;align-items:center;flex-shrink:0}
.em-select,.em-cat-search{padding:9px 12px;border-radius:10px;border:1px solid #cbd6d3;font:13.5px ${FONT};background:#fff;color:#27403c}
.em-select{min-width:180px}
.em-cat-search{width:140px}
.em-select:focus,.em-cat-search:focus,.em-seg button:focus-visible,.em-ghost:focus-visible,.em-send:focus-visible,.em-search-input:focus{outline:2px solid #1f9d8a;outline-offset:2px}
.em-clear{background:#e6efed;border:0;padding:9px 12px;border-radius:9px;font:600 13px ${FONT};color:#14524A;cursor:pointer;white-space:nowrap}
.em-clear:hover{background:#d6e5e2}
.em-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}
@media(max-width:1100px){.em-grid{grid-template-columns:1fr}}
.em-card{background:#fff;border:1px solid #dde4e2;border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(20,82,74,.06)}
.em-card-h{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #e8eeec;gap:10px;flex-wrap:nowrap}
.em-card-h-left{display:flex;align-items:center;gap:8px;flex-shrink:0}
.em-card-h h3{margin:0;font-size:16px;font-weight:700;color:#0f2f2b}
.em-count{font-weight:600;font-size:12px;color:#6b7c79;background:#eef1f0;padding:3px 9px;border-radius:20px}
.em-search-input{flex:1;min-width:0;width:100%;padding:6px 10px;border-radius:8px;border:1px solid #cbd6d3;font:13px ${FONT};background:#fff;color:#27403c}
.em-sel{font-size:12px;font-weight:600;padding:4px 10px;border-radius:20px;background:#eef1f0;color:#6b7c79;white-space:nowrap;flex-shrink:0;transition:all .15s}
.em-sel.has{background:#14524A;color:#fff}
.em-scroll{max-height:500px;overflow:auto}
.em-table{width:100%;border-collapse:separate;border-spacing:0;font-size:14px;text-align:left}
.em-table th{position:sticky;top:0;z-index:2;background:#f5f8f7;color:#5f716e;font-weight:600;font-size:12.5px;padding:12px 16px;border-bottom:1px solid #dde4e2;white-space:nowrap}
.em-table td{padding:13px 16px;border-bottom:1px solid #eef2f1;vertical-align:middle}
.em-table tbody tr{cursor:pointer;transition:background .12s}
.em-table tbody tr:hover{background:#f4f9f8}
.em-table tbody tr.on{background:#e8f4f1}
.em-table tbody tr.on td:first-child{box-shadow:inset 3px 0 0 #14524A}
.em-table tbody tr:last-child td{border-bottom:0}
.em-chk{width:17px;height:17px;accent-color:#14524A;cursor:pointer}
.em-code{font-weight:700;color:#14524A;white-space:nowrap}
.em-tag{display:inline-block;background:#e9f0ee;color:#3d5753;padding:3px 10px;border-radius:6px;font-size:12.5px;font-weight:500}
.em-price{font-weight:600;white-space:nowrap;font-variant-numeric:tabular-nums}
.em-mail{color:#0b7a8c;font-size:13.5px;word-break:break-all}
.em-mail.none{color:#a2b0ad;font-style:italic}
.em-empty{text-align:center;color:#8a9a97;padding:56px 16px!important}
.em-dock{position:fixed;left:0;right:0;bottom:0;z-index:50;background:rgba(255,255,255,.94);backdrop-filter:blur(8px);border-top:1px solid #dde4e2;box-shadow:0 -6px 20px rgba(20,82,74,.08)}
.em-dock-in{max-width:1440px;margin:0 auto;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
.em-sum{font-size:14px;color:#4a5f5b}
.em-sum b{color:#14524A}
.em-send{padding:13px 30px;font:600 15px ${FONT};background:#14524A;color:#fff;border:0;border-radius:11px;cursor:pointer;box-shadow:0 4px 12px rgba(20,82,74,.3);transition:transform .15s,background .15s}
.em-send:hover:not(:disabled){background:#0f433c;transform:translateY(-1px)}
.em-send:disabled{background:#b9c7c4;box-shadow:none;cursor:not-allowed}
.em-toast{position:fixed;top:24px;right:24px;z-index:9999;padding:14px 20px;border-radius:12px;font-weight:600;font-size:14px;border:1px solid;box-shadow:0 12px 24px -6px rgba(0,0,0,.15);display:flex;align-items:center;gap:10px;max-width:420px}
.em-toast.success{background:#e3f6ee;color:#0b5a3e;border-color:#79d0aa}
.em-toast.error{background:#fdeaea;color:#8f1d1d;border-color:#f0a0a0}
.em-toast.info{background:#e4f2f8;color:#0a5670;border-color:#8cc9de}
`;

const IconAdmin = (props) => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" {...props}>
    <path d="M6 2H3.5A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14H6M10.5 11.5L14 8L10.5 4.5M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function EnquiryMapper() {
    const [mode, setMode] = useState('vendor-buying');
    const [leftList, setLeftList] = useState([]);
    const [vendorList, setVendorList] = useState([]);
    const [categories, setCategories] = useState([]);
    const navigate = useNavigate();
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedLeftIds, setSelectedLeftIds] = useState([]);
    const [selectedVendorIds, setSelectedVendorIds] = useState([]);
    const [sending, setSending] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    // Search query states
    const [leftSearchQuery, setLeftSearchQuery] = useState('');
    const [vendorSearchQuery, setVendorSearchQuery] = useState('');
    const [categorySearchQuery, setCategorySearchQuery] = useState('');

    const isBuying = mode === 'vendor-buying';

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
    };

    useEffect(() => {
        axios.get('/api/enquiry-categories')
            .then(res => setCategories(res.data))
            .catch(err => console.error("Failed to load categories:", err));
    }, []);

    useEffect(() => {
        const endpoint = isBuying ? 'api/buying' : 'api/selling';
        axios.get(`/${endpoint}${selectedCategory ? `?category=${encodeURIComponent(selectedCategory)}` : ''}`)
            .then(res => setLeftList(res.data))
            .catch(err => console.error(err));
        setSelectedLeftIds([]);
        setLeftSearchQuery('');
    }, [isBuying, selectedCategory]);

    useEffect(() => {
        axios.get(`/api/potential-vendors${selectedCategory ? `?category=${encodeURIComponent(selectedCategory)}` : ''}`)
            .then(res => setVendorList(res.data))
            .catch(err => console.error(err));
        setSelectedVendorIds([]);
        setVendorSearchQuery('');
    }, [selectedCategory]);

    const toggle = (setter, id) =>
        setter(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    // Filter lists based on search queries
    const filteredLeftList = leftList.filter(item => 
        (item.ProdName || '').toLowerCase().includes(leftSearchQuery.toLowerCase())
    );

    const filteredVendorList = vendorList.filter(vendor => 
        (vendor.Company_Name || '').toLowerCase().includes(vendorSearchQuery.toLowerCase())
    );

    const filteredCategories = categories.filter(cat => 
        (cat || '').toLowerCase().includes(categorySearchQuery.toLowerCase())
    );

    const allLeft = filteredLeftList.length > 0 && filteredLeftList.every(i => selectedLeftIds.includes(i.Id));
    const allVendors = filteredVendorList.length > 0 && filteredVendorList.every(v => selectedVendorIds.includes(v.Id));
    const canSend = selectedLeftIds.length > 0 && selectedVendorIds.length > 0 && !sending;

    const enquiryLabel = isBuying ? 'buying enquiry' : 'selling enquiry';

    const handleSendNotification = async () => {
        if (selectedLeftIds.length === 0 || selectedVendorIds.length === 0) {
            showToast(`Please select at least one ${enquiryLabel} and one vendor.`, 'error');
            return;
        }
        setSending(true);
        showToast('Sending emails to vendors...', 'info');
        try {
            const payload = isBuying
                ? { buyerEnqIds: selectedLeftIds, vendorIds: selectedVendorIds, mode: 'vendor-buying' }
                : { sellerEnqIds: selectedLeftIds, vendorIds: selectedVendorIds, mode: 'vendor-selling' };
            const response = await axios.post('/api/send-enquiry-email', payload);
            showToast(response.data.message || 'Enquiries sent to the selected vendors.', 'success');
        } catch (error) {
            showToast('Could not send the emails. Check the console for details.', 'error');
            console.error(error);
        } finally {
            setSending(false);
        }
    };

    const toastIcon = toast.type === 'error' ? '⚠️' : toast.type === 'info' ? 'ℹ️' : '✅';

    return (
        <div className="em-page">
            <style>{css}</style>

            <header className="em-top">
                <div className="em-top-in">
                    <div className="em-brand">
                        <div className="em-mark">S5</div>
                        <div>
                            <b>Synergy 5M</b>
                            <span>Vendor Email Dispatch Center</span>
                        </div>
                    </div>
                    <button type="button" className="em-ghost" onClick={() => navigate('/admin')}>
                        <IconAdmin /> Admin Panel
                    </button>
                </div>
            </header>

            {toast.show && (
                <div className={`em-toast ${toast.type}`} role="status">
                    <span>{toastIcon}</span>{toast.message}
                </div>
            )}

            <div className="em-wrap">
                <section className="em-bar">
                    <div>
                        <h2>Buyer Seller Connect</h2>
                        <p>Send buying or selling enquiries to vendors that match the category.</p>
                    </div>

                    <div className="em-seg" role="tablist" aria-label="Enquiry type">
                        <button type="button" className={isBuying ? 'on' : ''} onClick={() => setMode('vendor-buying')}>
                            Buying enquiries
                        </button>
                        <button type="button" className={!isBuying ? 'on' : ''} onClick={() => setMode('vendor-selling')}>
                            Selling enquiries
                        </button>
                    </div>

                    <div className="em-filter">
                        <input
                            type="text"
                            className="em-cat-search"
                            placeholder="Filter categories..."
                            value={categorySearchQuery}
                            onChange={(e) => setCategorySearchQuery(e.target.value)}
                            aria-label="Filter categories search"
                        />
                        <select
                            className="em-select"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            aria-label="Filter by category"
                        >
                            <option value="">All categories</option>
                            {filteredCategories.map((cat, idx) => (
                                <option key={idx} value={cat}>{cat}</option>
                            ))}
                        </select>
                        {(selectedCategory || categorySearchQuery) && (
                            <button type="button" className="em-clear" onClick={() => { setSelectedCategory(''); setCategorySearchQuery(''); }}>
                                Clear ✕
                            </button>
                        )}
                    </div>
                </section>

                <div className="em-grid">
                    {/* Enquiries Block */}
                    <section className="em-card">
                        <div className="em-card-h">
                            <div className="em-card-h-left">
                                <h3>{isBuying ? 'Buying enquiries' : 'Selling enquiries'}</h3>
                                <span className="em-count">{leftList.length}</span>
                            </div>
                            <input
                                type="text"
                                className="em-search-input"
                                placeholder="Search by product name..."
                                value={leftSearchQuery}
                                onChange={(e) => setLeftSearchQuery(e.target.value)}
                            />
                            <span className={`em-sel ${selectedLeftIds.length ? 'has' : ''}`}>
                                {selectedLeftIds.length} selected
                            </span>
                        </div>
                        <div className="em-scroll">
                            <table className="em-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 44 }}>
                                            <input
                                                type="checkbox"
                                                className="em-chk"
                                                aria-label="Select all enquiries"
                                                checked={allLeft}
                                                onChange={() => {
                                                    if (allLeft) {
                                                        setSelectedLeftIds(prev => prev.filter(id => !filteredLeftList.some(i => i.Id === id)));
                                                    } else {
                                                        const newIds = Array.from(new Set([...selectedLeftIds, ...filteredLeftList.map(i => i.Id)]));
                                                        setSelectedLeftIds(newIds);
                                                    }
                                                }}
                                            />
                                        </th>
                                        <th>{isBuying ? 'Enq No' : 'Offer No'}</th>
                                        <th>Product name</th>
                                        <th>Category</th>
                                        <th>{isBuying ? 'Target price' : 'Price / unit'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLeftList.length === 0 ? (
                                        <tr><td colSpan="5" className="em-empty">No enquiries found for this category.</td></tr>
                                    ) : (
                                        filteredLeftList.map(item => {
                                            const isChecked = selectedLeftIds.includes(item.Id);
                                            const catValue = isBuying ? item.ProdCat : item.ItemCat;
                                            const priceVal = isBuying ? item.TgtPrice : item.PricePerUnit;
                                            const codeVal = isBuying ? item.EnqNo : item.OfferNo;
                                            return (
                                                <tr key={item.Id} className={isChecked ? 'on' : ''} onClick={() => toggle(setSelectedLeftIds, item.Id)}>
                                                    <td onClick={(e) => e.stopPropagation()}>
                                                        <input type="checkbox" className="em-chk" checked={isChecked} onChange={() => toggle(setSelectedLeftIds, item.Id)} />
                                                    </td>
                                                    <td><span className="em-code">{codeVal || '-'}</span></td>
                                                    <td>{item.ProdName}</td>
                                                    <td>{catValue ? <span className="em-tag">{catValue}</span> : '-'}</td>
                                                    <td className="em-price">{priceVal ? `${priceVal} ${item.Currency || ''}` : '-'}</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Vendors Block */}
                    <section className="em-card">
                        <div className="em-card-h">
                            <div className="em-card-h-left">
                                <h3>Potential vendors</h3>
                                <span className="em-count">{vendorList.length}</span>
                            </div>
                            <input
                                type="text"
                                className="em-search-input"
                                placeholder="Search by vendor name..."
                                value={vendorSearchQuery}
                                onChange={(e) => setVendorSearchQuery(e.target.value)}
                            />
                            <span className={`em-sel ${selectedVendorIds.length ? 'has' : ''}`}>
                                {selectedVendorIds.length} selected
                            </span>
                        </div>
                        <div className="em-scroll">
                            <table className="em-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 44 }}>
                                            <input
                                                type="checkbox"
                                                className="em-chk"
                                                aria-label="Select all vendors"
                                                checked={allVendors}
                                                onChange={() => {
                                                    if (allVendors) {
                                                        setSelectedVendorIds(prev => prev.filter(id => !filteredVendorList.some(v => v.Id === id)));
                                                    } else {
                                                        const newIds = Array.from(new Set([...selectedVendorIds, ...filteredVendorList.map(v => v.Id)]));
                                                        setSelectedVendorIds(newIds);
                                                    }
                                                }}
                                            />
                                        </th>
                                        <th>Vendor / Category</th>
                                        <th>Email</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredVendorList.length === 0 ? (
                                        <tr><td colSpan="3" className="em-empty">No vendors found for this category.</td></tr>
                                    ) : (
                                        filteredVendorList.map(vendor => {
                                            const isChecked = selectedVendorIds.includes(vendor.Id);
                                            return (
                                                <tr key={vendor.Id} className={isChecked ? 'on' : ''} onClick={() => toggle(setSelectedVendorIds, vendor.Id)}>
                                                    <td onClick={(e) => e.stopPropagation()}>
                                                        <input type="checkbox" className="em-chk" checked={isChecked} onChange={() => toggle(setSelectedVendorIds, vendor.Id)} />
                                                    </td>
                                                    <td>
                                                        <strong>{vendor.Company_Name}</strong><br/>
                                                        {vendor.Category ? <span className="em-tag">{vendor.Category}</span> : '-'}
                                                    </td>
                                                    <td className={`em-mail ${vendor.Email ? '' : 'none'}`}>{vendor.Email || 'No email'}</td>
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

            {/* Sticky action bar */}
            <div className="em-dock">
                <div className="em-dock-in">
                    <div className="em-sum">
                        <b>{selectedLeftIds.length}</b> {isBuying ? 'buying' : 'selling'} {selectedLeftIds.length === 1 ? 'enquiry' : 'enquiries'} to{' '}
                        <b>{selectedVendorIds.length}</b> {selectedVendorIds.length === 1 ? 'vendor' : 'vendors'}
                    </div>
                    <button type="button" className="em-send" onClick={handleSendNotification} disabled={!canSend}>
                        {sending ? 'Sending...' : `Send ${isBuying ? 'buying' : 'selling'} enquiries`}
                    </button>
                </div>
            </div>
        </div>
    );
}