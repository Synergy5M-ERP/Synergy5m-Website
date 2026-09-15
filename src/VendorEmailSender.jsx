import React, { useState, useEffect ,useCallback} from 'react';
import { useNavigate } from 'react-router-dom';

/* --- SVG Icons --- */
const IconLogout = (props) => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" {...props}>
    <path d="M6 2H3.5A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14H6M10.5 11.5L14 8L10.5 4.5M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconSearch = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" {...props}>
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.7" />
    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export default function VendorEmailSender() {
  const navigate = useNavigate();

  const [vendors, setVendors] = useState([]);
  const [search, setSearch] = useState('');
  
  // Filter States & Options Lists
  const [industryFilter, setIndustryFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [availableIndustries, setAvailableIndustries] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);

  const [selectedIds, setSelectedIds] = useState([]);
  
  // Email Form Fields
  const [subject, setSubject] = useState('New implementation of functionality');
  const [bodyTemplate, setBodyTemplate] = useState(
`Hi {{Contact_Person}},

We’re pleased to inform you that the new functionality has been successfully implemented for {{Company_Name}}.
Your registered GST Number is {{GST_Number}}. 

Please review the update and share your feedback or let us know if any additional changes are required.

Thank you for your support and cooperation.`
  );

  const [cursorPosition, setCursorPosition] = useState(0);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Fetch filter dropdown options on mount
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Fetch vendors when search query or dropdown filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVendors();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, industryFilter, categoryFilter]);

  const fetchFilterOptions = async () => {
    try {
      const res = await fetch('/api/vendor-filters', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setAvailableIndustries(data.industries || []);
        setAvailableCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Error loading filter options:', err);
    }
  };

// Fetch vendors with useCallback to satisfy react-hooks/exhaustive-deps
  const fetchVendors = useCallback(async () => {
    setFetching(true);
    try {
      const queryParams = new URLSearchParams({
        search,
        industry: industryFilter,
        category: categoryFilter
      });
      const res = await fetch(`/api/vendors?${queryParams.toString()}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setVendors(data.data);
      }
    } catch (err) {
      console.error('Error fetching vendors:', err);
    } finally {
      setFetching(false);
    }
  }, [search, industryFilter, categoryFilter]);

  // Fetch vendors when search query or filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVendors();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, industryFilter, categoryFilter, fetchVendors]);

  const toggleSelectVendor = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === vendors.length && vendors.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(vendors.map(v => v.Id));
    }
  };

  const handleTextareaSelection = (e) => {
    setCursorPosition(e.target.selectionStart);
  };

  const insertTextAtCursor = (textToInsert) => {
    const textBefore = bodyTemplate.substring(0, cursorPosition);
    const textAfter = bodyTemplate.substring(cursorPosition);
    setBodyTemplate(textBefore + textToInsert + textAfter);
    setCursorPosition(cursorPosition + textToInsert.length);
  };

  const handleInsertMyDetails = () => {
    const myDetailsBlock = 
`\n\nAjay Bhai
CEO
Synergy5M LLP
501, Fortuna Business Centre, Opp. McDonald's, 
Pimple Saudagar, Pune, Maharashtra, India. 
PIN - 411027
Website: synergy5m.com    
Contact : +91- 9423579446`;
    insertTextAtCursor(myDetailsBlock);
  };

  const handleSendEmails = async (e) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      alert('Please select at least one vendor to send emails.');
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    const formData = new FormData();
    formData.append('vendorIds', JSON.stringify(selectedIds));
    formData.append('subject', subject);
    formData.append('bodyTemplate', bodyTemplate);
    if (attachmentFile) {
      formData.append('attachment', attachmentFile);
    }

    try {
      const res = await fetch('/api/send-vendor-emails-attachment', {
        method: 'POST',
        credentials: 'include',
        body: formData 
      });
      
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: data.message });
        setSelectedIds([]);
        setAttachmentFile(null);
      } else {
        setStatusMessage({ type: 'error', text: data.message || 'Failed to dispatch emails.' });
      }
    } catch (err) {
      console.error('Network error:', err);
      setStatusMessage({ type: 'error', text: 'Network or server error occurred during dispatch.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.dashboardContainer}>
      <GlobalStyle />
      
      {/* Top Navigation Bar */}
      <div style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <div style={styles.brandMarkSmall}>S5</div>
          <div>
            <div style={styles.topBarTitle}>Synergy 5M</div>
            <div style={styles.topBarSubtitle}>Vendor Email Dispatch Center</div>
          </div>
        </div>
        <button 
          type="button"
          onClick={() => navigate('/admin')} 
          style={styles.logoutBtn}
        >
          <IconLogout /> Back to Admin Panel
        </button>
      </div>

      <div style={styles.pageBody}>
        <div style={{ marginBottom: "20px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#14181C", margin: "0 0 4px 0" }}>Broadcast Plain Text Emails</h1>
          <p style={{ fontSize: "13.5px", color: "#5B6570", margin: 0 }}>Filter target vendors using dropdown selections, compose updates, and attach documents.</p>
        </div>

        {statusMessage && (
          <div style={{
            padding: "12px 16px",
            marginBottom: "20px",
            borderRadius: "8px",
            fontSize: "13.5px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: statusMessage.type === 'success' ? '#E3F3E8' : '#FBEAE9',
            color: statusMessage.type === 'success' ? '#1E7B45' : '#C4362E',
            border: `1px solid ${statusMessage.type === 'success' ? '#B8E7C5' : '#F1C7C4'}`
          }}>
            <span>{statusMessage.text}</span>
            <button 
              onClick={() => setStatusMessage(null)} 
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '12px', color: 'inherit', marginLeft: 'auto' }}
            >
              DISMISS
            </button>
          </div>
        )}

        <div className="ap-email-grid" style={styles.emailDispatchGrid}>
          
          {/* LEFT PANEL: Vendor Selection Grid with Dropdown Selectors */}
          <div style={styles.emailLeftCard}>
            <div style={{ padding: "16px", borderBottom: "1px solid #E4E7E9", background: "#FAFBFB" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#14181C", margin: 0 }}>
                  Select Vendors ({selectedIds.length} chosen)
                </h3>
              </div>
              
              {/* Search & Dropdown Filters */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <IconSearch color="#788693" style={{ position: "absolute", left: "10px" }} />
                  <input 
                    type="text"
                    placeholder="Search company, email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="ap-input"
                    style={{ width: "100%", padding: "8px 10px 8px 32px", borderRadius: "6px", border: "1px solid #D8DCE0", fontSize: "13px", background: "#fff" }}
                  />
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  {/* Industry Dropdown */}
                  <select
                    value={industryFilter}
                    onChange={(e) => setIndustryFilter(e.target.value)}
                    className="ap-input"
                    style={{ width: "50%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #D8DCE0", fontSize: "12.5px", background: "#fff", cursor: "pointer" }}
                  >
                    <option value="">All Industries</option>
                    {availableIndustries.map((ind, idx) => (
                      <option key={idx} value={ind}>{ind}</option>
                    ))}
                  </select>

                  {/* Category Dropdown */}
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="ap-input"
                    style={{ width: "50%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #D8DCE0", fontSize: "12.5px", background: "#fff", cursor: "pointer" }}
                  >
                    <option value="">All Categories</option>
                    {availableCategories.map((cat, idx) => (
                      <option key={idx} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Vendor List Scroll Container */}
            <div style={{ maxHeight: "500px", overflowY: "auto", padding: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", paddingBottom: "10px", marginBottom: "8px", borderBottom: "1px solid #EEF0F1", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>
                <input 
                  type="checkbox"
                  checked={vendors.length > 0 && selectedIds.length === vendors.length}
                  onChange={toggleSelectAll}
                  style={{ width: "15px", height: "15px", cursor: "pointer" }}
                />
                <span style={{ marginLeft: "10px", fontSize: "12.5px", fontWeight: 600, color: "#5B6570" }}>
                  Select All Visible ({vendors.length})
                </span>
              </div>

              {fetching ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#9AA5AF", fontSize: "13px" }}>Loading vendors...</div>
              ) : vendors.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#9AA5AF", fontSize: "13px" }}>No vendors found.</div>
              ) : (
                vendors.map(vendor => {
                  const isChecked = selectedIds.includes(vendor.Id);
                  return (
                    <div 
                      key={vendor.Id} 
                      onClick={() => toggleSelectVendor(vendor.Id)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        padding: "10px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        background: isChecked ? "#E4EEEC" : "transparent",
                        marginBottom: "6px",
                        border: "1px solid",
                        borderColor: isChecked ? "#14524A" : "transparent",
                      }}
                    >
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} 
                        style={{ marginTop: "2px", cursor: "pointer" }}
                      />
                      <div style={{ fontSize: "13px", width: "100%" }}>
                        <div style={{ fontWeight: 600, color: "#14181C" }}>{vendor.Company_Name}</div>
                        <div style={{ color: "#5B6570", fontSize: "12px" }}>{vendor.Email || "No Email Listed"}</div>
                        <div style={{ color: "#788693", fontSize: "11px", marginTop: "2px" }}>
                          {vendor.industry && <span>Ind: {vendor.industry} </span>}
                          {vendor.Category && <span>| Cat: {vendor.Category}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT PANEL: Plain Text Email Composer Form */}
          <div style={styles.emailRightCard}>
            <div style={{ padding: "16px", borderBottom: "1px solid #E4E7E9", background: "#FAFBFB" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#14181C", margin: 0 }}>Compose Plain Text Email &amp; Attach File</h3>
            </div>

            <form onSubmit={handleSendEmails} style={{ maxHeight: "500px", overflowY: "auto", padding: "20px" }}>
              <div style={{ marginBottom: "16px" }}>
                <label style={styles.label}>Subject line</label>
                <input 
                  type="text"
                  required
                  placeholder="Enter subject line..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="ap-input"
                  style={styles.input}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={styles.label}>Attach PDF / Image / Document</label>
                <input 
                  type="file"
                  onChange={(e) => setAttachmentFile(e.target.files[0])}
                  style={{ fontSize: "13px", padding: "4px 0", color: "#3C4550", cursor: "pointer", width: "100%" }}
                />
                {attachmentFile && (
                  <p style={{ fontSize: "12px", color: "#14524A", marginTop: "4px" }}>Attached: {attachmentFile.name}</p>
                )}
              </div>

              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "7px", flexWrap: "wrap", gap: "6px" }}>
                  <label style={{ ...styles.label, marginBottom: 0 }}>Plain Text Content &amp; Insert Elements</label>
                  
                  <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                    <button type="button" onClick={() => insertTextAtCursor('{{Company_Name}}')} style={styles.tokenBtn}>+ Company Name</button>
                    <button type="button" onClick={() => insertTextAtCursor('{{Contact_Person}}')} style={styles.tokenBtn}>+ Contact Person</button>
                    <button type="button" onClick={() => insertTextAtCursor('{{GST_Number}}')} style={styles.tokenBtn}>+ GST No</button>
                    <button type="button" onClick={handleInsertMyDetails} style={{ ...styles.tokenBtn, background: "#14524A", color: "#fff", borderColor: "#14524A" }}>+ Add My Details</button>
                  </div>
                </div>

                <textarea 
                  rows="8"
                  required
                  value={bodyTemplate}
                  onChange={(e) => setBodyTemplate(e.target.value)}
                  onSelect={handleTextareaSelection}
                  onClick={handleTextareaSelection}
                  onKeyUp={handleTextareaSelection}
                  className="ap-input"
                  style={{ ...styles.textarea, fontFamily: "monospace", fontSize: "13px", lineHeight: "1.5" }}
                  placeholder="Type your plain text message here..."
                ></textarea>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button 
                  type="submit"
                  disabled={loading || selectedIds.length === 0}
                  style={{
                    ...styles.primaryBtn,
                    width: "auto",
                    padding: "10px 22px",
                    opacity: loading || selectedIds.length === 0 ? 0.6 : 1,
                    cursor: loading || selectedIds.length === 0 ? "not-allowed" : "pointer"
                  }}
                >
                  {loading ? 'Processing Dispatch...' : `Send Email with Attachment (${selectedIds.length})`}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}

function GlobalStyle() {
  return (
    <style>{`
      * { box-sizing: border-box; }
      body { font-family: 'Inter', -apple-system, 'Segoe UI', sans-serif; margin: 0; background: #F2F4F5; }
      .ap-input:focus { outline: none; border-color: #14524A !important; box-shadow: 0 0 0 3px rgba(20, 82, 74, 0.12); }
      .ap-primary-btn:hover { background: #0D3A34 !important; }
      @media (max-width: 768px) {
        .ap-email-grid { grid-template-columns: 1fr !important; }
      }
    `}</style>
  );
}

const FONT = "'Inter', -apple-system, 'Segoe UI', sans-serif";

const styles = {
  dashboardContainer: { minHeight: "100vh", backgroundColor: "#F2F4F5", fontFamily: FONT },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 28px", background: "#14524A", color: "#fff" },
  topBarLeft: { display: "flex", alignItems: "center", gap: "12px" },
  brandMarkSmall: { width: "34px", height: "34px", borderRadius: "8px", background: "rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "13px" },
  topBarTitle: { fontSize: "15px", fontWeight: 700 },
  topBarSubtitle: { fontSize: "12px", color: "rgba(255,255,255,0.7)" },
  logoutBtn: { display: "flex", alignItems: "center", gap: "7px", background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.35)", padding: "8px 14px", borderRadius: "7px", cursor: "pointer", fontSize: "13px" },
  pageBody: { padding: "28px", maxWidth: "1280px", margin: "0 auto" },
  label: { display: "block", fontSize: "13px", fontWeight: 600, color: "#3C4550", marginBottom: "7px" },
  input: { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #D8DCE0", fontSize: "14px", fontFamily: FONT, background: "#FFFFFF" },
  textarea: { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #D8DCE0", fontSize: "14px", fontFamily: FONT, resize: "vertical", background: "#FFFFFF" },
  primaryBtn: { padding: "12px", background: "#14524A", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "14.5px", fontFamily: FONT },
  emailDispatchGrid: { display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "20px" },
  emailLeftCard: { background: "#fff", borderRadius: "12px", border: "1px solid #E4E7E9", overflow: "hidden", height: "fit-content" },
  emailRightCard: { background: "#fff", borderRadius: "12px", border: "1px solid #E4E7E9", overflow: "hidden", height: "fit-content" },
  tokenBtn: { background: "#F2F4F5", border: "1px solid #D8DCE0", color: "#3C4550", padding: "4px 9px", borderRadius: "5px", fontSize: "11.5px", cursor: "pointer", fontWeight: 500 }
};