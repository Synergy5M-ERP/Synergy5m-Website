import React, { useState, useEffect, useCallback } from "react";

/* --- SVG Icons --- */
const IconCheck = (props) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" {...props}>
    <path d="M3 8.5L6.2 11.7L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconX = (props) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" {...props}>
    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const IconLock = (props) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...props}>
    <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8 11V7.5a4 4 0 0 1 8 0V11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const IconLogout = (props) => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" {...props}>
    <path d="M6 2H3.5A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14H6M10.5 11.5L14 8L10.5 4.5M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconInbox = (props) => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M4 13.5L6.2 5.8A1.5 1.5 0 0 1 7.65 4.75h8.7a1.5 1.5 0 0 1 1.45 1.05L20 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M4 13.5h4.6a.5.5 0 0 1 .46.3l.7 1.6a.5.5 0 0 0 .46.3h3.56a.5.5 0 0 0 .46-.3l.7-1.6a.5.5 0 0 1 .46-.3H20V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18v-4.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);
const IconShieldCheck = (props) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" {...props}>
    <path d="M8 1.5l5.2 1.9v3.9c0 3.4-2.2 6.2-5.2 7.2C5 13.5 2.8 10.7 2.8 7.3V3.4L8 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M5.6 8.1L7.3 9.8L10.6 6.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconAlertTriangle = (props) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M12 4.5L21 19.5H3L12 4.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M12 10v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="12" cy="16.6" r="0.9" fill="currentColor" />
  </svg>
);

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem("admin_logged_in") === "true"
  );
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");

  const [activeTab, setActiveTab] = useState("erp");
  const [dataList, setDataList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [rejectItem, setRejectItem] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveItem, setApproveItem] = useState(null);

  // GST Validation State: keyed by row Id
  const [gstValidation, setGstValidation] = useState({});
  // Detailed Modal View State
  const [selectedGstDetails, setSelectedGstDetails] = useState(null);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("admin_logged_in");
    setIsAuthenticated(false);
    setDataList([]);
  }, []);

  const fetchData = useCallback(
    async (type) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/enquiries?type=${type}`, { credentials: "include" });
        if (res.status === 401) {
          handleLogout();
          return;
        }
        const json = await res.json();
        if (json.success) setDataList(json.data || []);
      } catch (err) {
        alert("Error fetching data: " + err.message);
      } finally {
        setLoading(false);
      }
    },
    [handleLogout]
  );

  useEffect(() => {
    if (isAuthenticated) fetchData(activeTab);
  }, [isAuthenticated, activeTab, fetchData]);

  useEffect(() => {
    if (document.getElementById("admin-panel-font")) return;
    const link = document.createElement("link");
    link.id = "admin-panel-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAuthenticated(true);
        localStorage.setItem("admin_logged_in", "true");
      } else {
        setLoginError(data.message || "Invalid credentials");
      }
    } catch (err) {
      setLoginError("Failed to communicate with backend server");
    }
  };

  const confirmApprove = async () => {
    if (!approveItem) return;
    const row = approveItem;
    const email = activeTab === "erp" ? row.Email : (row.CompanyEmail || row.RepresentativeEmail);
    const name = activeTab === "erp" ? row.ContactPerson : row.RepresentativeName;

    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: row.Id, type: activeTab, email, recipientName: name }),
      });
      const result = await res.json();
      if (result.success) {
        alert(result.message);
        setApproveItem(null);
        fetchData(activeTab);
      } else {
        alert("Approval failed: " + result.message);
      }
    } catch (err) {
      alert("Error approving: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      alert("Please provide a valid rejection reason");
      return;
    }
    const email = activeTab === "erp" ? rejectItem.Email : (rejectItem.CompanyEmail || rejectItem.RepresentativeEmail);
    const name = activeTab === "erp" ? rejectItem.ContactPerson : rejectItem.RepresentativeName;

    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: rejectItem.Id, type: activeTab, email, recipientName: name, reason: rejectReason }),
      });
      const result = await res.json();
      if (result.success) {
        alert(result.message);
        setRejectItem(null);
        setRejectReason("");
        fetchData(activeTab);
      } else {
        alert("Rejection failed: " + result.message);
      }
    } catch (err) {
      alert("Error rejecting: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Automated GST Validation Method
const [copiedGstId, setCopiedGstId] = useState(null);

const handleOpenGstPortal = (row) => {
  const gst = (row.GSTIN || row.GSTNo || row.GST || row.GstNo || "").trim();
  if (!gst || gst === "-") return;

  // 1. Copy the GST number to clipboard
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(gst);
  } else {
    // Fallback for older browsers / non-HTTPS dev setups
    const textArea = document.createElement("textarea");
    textArea.value = gst;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  }

  // 2. Show a temporary "Copied!" feedback state on that button
  setCopiedGstId(row.Id);
  setTimeout(() => setCopiedGstId(null), 3000);

  // 3. Open IRIS GSTIN search directly in a new tab
  window.open("https://irismsme.com/msme-tools/", "_blank", "noopener,noreferrer");
};

  if (!isAuthenticated) {
    return (
      <>
        <GlobalStyle />
        <div style={styles.loginPage}>
          <div style={styles.loginBrandPanel}>
            <div style={styles.brandMark}>S5</div>
            <h1 style={styles.brandTitle}>Synergy 5M</h1>
            <p style={styles.brandTagline}>Review incoming ERP trial requests and trade enquiries.</p>
          </div>
          <div style={styles.loginFormPanel}>
            <div style={styles.loginCard}>
              <div style={styles.loginIconWrap}><IconLock color="#14524A" /></div>
              <h2 style={styles.loginHeading}>Sign in to the admin panel</h2>
              <p style={styles.loginSubheading}>Use your administrator credentials to continue.</p>
              {loginError && (
                <div style={styles.errorAlert}>
                  <IconX color="#C4362E" style={{ flexShrink: 0 }} />
                  <span>{loginError}</span>
                </div>
              )}
              <form onSubmit={handleLogin}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Admin username</label>
                  <input
                    type="text"
                    required
                    className="ap-input"
                    style={styles.input}
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Password</label>
                  <input
                    type="password"
                    required
                    className="ap-input"
                    style={styles.input}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                  />
                </div>
                <button type="submit" className="ap-primary-btn" style={styles.primaryBtn}>Sign in</button>
              </form>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <GlobalStyle />
      <div style={styles.dashboardContainer}>
        {/* Top bar */}
        <div style={styles.topBar}>
          <div style={styles.topBarLeft}>
            <div style={styles.brandMarkSmall}>S5</div>
            <div>
              <div style={styles.topBarTitle}>Synergy 5M</div>
              <div style={styles.topBarSubtitle}>Admin panel</div>
            </div>
          </div>
          <button onClick={handleLogout} className="ap-logout-btn" style={styles.logoutBtn}>
            <IconLogout /> Log out
          </button>
        </div>

        <div style={styles.pageBody}>
          {/* Segmented switcher */}
          <div style={styles.segmentedControl} role="radiogroup">
            <label style={{ ...styles.segmentOption, ...(activeTab === "erp" ? styles.segmentOptionActive : {}) }}>
              <input
                type="radio"
                name="category"
                value="erp"
                checked={activeTab === "erp"}
                onChange={() => setActiveTab("erp")}
                style={styles.srOnlyInput}
              />
              ERP requests
              <span style={styles.segmentSubLabel}>TrialRequests</span>
            </label>
            <label style={{ ...styles.segmentOption, ...(activeTab === "buyingselling" ? styles.segmentOptionActive : {}) }}>
              <input
                type="radio"
                name="category"
                value="buyingselling"
                checked={activeTab === "buyingselling"}
                onChange={() => setActiveTab("buyingselling")}
                style={styles.srOnlyInput}
              />
              Buying &amp; selling
              <span style={styles.segmentSubLabel}>BusinessEnquiries</span>
            </label>
          </div>

          {/* Table Container */}
          <div style={styles.tableWrapper}>
            {loading ? (
              <div style={styles.loadingState}>
                <div className="ap-spinner" style={styles.spinner} />
                Loading records from SQL Server…
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeadRow}>
                      <th style={styles.th}>Actions</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Company name</th>
                      <th style={styles.th}>GST no.</th>
                      <th style={styles.th}>Contact person</th>
                      <th style={styles.th}>Email</th>
                      <th style={styles.th}>Contact number</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataList.length === 0 ? (
                      <tr>
                        <td colSpan="7">
                          <div style={styles.emptyState}>
                            <IconInbox color="#9AA5AF" />
                            <div style={styles.emptyTitle}>No records found</div>
                            <div style={styles.emptySubtitle}>New submissions for this category will show up here.</div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      dataList.map((row) => {
                        const status = activeTab === "erp" ? row.TrialStatus : row.Status;
                        const isPending = !status || status === "Pending" || status === "Pending Verification" || status === "Active";
                        const gst = row.GSTIN || row.GSTNo || row.GST || row.GstNo || "-";
                        const contactPerson = activeTab === "erp" ? row.ContactPerson : row.RepresentativeName;
                        const email = activeTab === "erp" ? row.Email : (row.CompanyEmail || row.RepresentativeEmail);
                        const mobile = activeTab === "erp" ? row.MobileNo : (row.Mobile || row.RepresentativeMobile);

                        const badgeStyle = status === "Approved" ? styles.badgeSuccess : status === "Rejected" ? styles.badgeDanger : styles.badgeWarning;

                        return (
                          <tr key={row.Id} className="ap-row" style={styles.tr}>
                            <td style={styles.td}>
                              {isPending ? (
                                <div style={{ display: "flex", gap: "8px" }}>
                                  <button
                                    disabled={actionLoading}
                                    onClick={() => setApproveItem(row)}
                                    className="ap-approve-btn"
                                    style={styles.approveBtn}
                                  >
                                    <IconCheck /> Approve
                                  </button>
                                  <button
                                    disabled={actionLoading}
                                    onClick={() => setRejectItem(row)}
                                    className="ap-reject-btn"
                                    style={styles.rejectBtn}
                                  >
                                    <IconX /> Reject
                                  </button>
                                </div>
                              ) : (
                                <span style={styles.processedLabel}>Processed</span>
                              )}
                            </td>
                            <td style={styles.td}>
                              <span style={badgeStyle}>
                                <span style={styles.badgeDot} />
                                {status || "Pending"}
                              </span>
                            </td>
                            <td style={styles.td}><strong style={{ color: "#14181C" }}>{row.CompanyName}</strong></td>
                           <td style={styles.td}>
  <div style={styles.gstCell}>
    <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{gst}</span>
    {gst !== "-" && (
      <button
        type="button"
        onClick={() => handleOpenGstPortal(row)}
        className="ap-validate-btn"
        style={styles.validateBtn}
        title="Copy GSTIN and open IRIS MSME verification in a new tab"
      >
        <IconShieldCheck />
        {copiedGstId === row.Id ? "Copied! Opening..." : "Verify on IRIS"}
      </button>
    )}
  </div>
</td>
                            <td style={styles.td}>{contactPerson || "-"}</td>
                            <td style={styles.td}>{email || "-"}</td>
                            <td style={styles.td}>{mobile || "-"}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* GST Full Detail Modal */}
        {selectedGstDetails && (
          <div style={styles.modalOverlay}>
            <div className="ap-modal-pop" style={styles.modalContentWide}>
              <div style={styles.modalHeaderRow}>
                <div style={styles.modalIconWrapApprove}>
                  <IconShieldCheck color="#14524A" width={22} height={22} />
                </div>
                <div>
                  <h3 style={{ ...styles.modalTitle, margin: 0 }}>GST Verification Details</h3>
                  <span style={{ fontSize: "12px", color: "#5B6570" }}>Official Taxpayer Master Record</span>
                </div>
              </div>

              <div style={styles.detailGrid}>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Legal Business Name</span>
                  <span style={styles.detailValue}>{selectedGstDetails.legalName || "Not Available"}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Trade Name</span>
                  <span style={styles.detailValue}>{selectedGstDetails.tradeName || "Not Available"}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>GSTIN</span>
                  <span style={{ ...styles.detailValue, fontFamily: "monospace", color: "#14524A" }}>
                    {selectedGstDetails.gstin}
                  </span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Registration Status</span>
                  <span style={{
                    ...styles.detailValue,
                    color: (selectedGstDetails.status || "").toLowerCase() === "active" ? "#1E7B45" : "#C4362E",
                    fontWeight: 700
                  }}>
                    {selectedGstDetails.status || "ACTIVE"}
                  </span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Constitution of Business</span>
                  <span style={styles.detailValue}>{selectedGstDetails.businessConstitution || "N/A"}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Taxpayer Classification</span>
                  <span style={styles.detailValue}>{selectedGstDetails.taxpayerType || "Regular"}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Associated PAN</span>
                  <span style={{ ...styles.detailValue, fontFamily: "monospace" }}>{selectedGstDetails.pan || "N/A"}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Registration Date</span>
                  <span style={styles.detailValue}>{selectedGstDetails.dateOfRegistration || "N/A"}</span>
                </div>
                <div style={{ ...styles.detailItem, gridColumn: "span 2" }}>
                  <span style={styles.detailLabel}>Principal Place of Business</span>
                  <span style={styles.detailValue}>{selectedGstDetails.address || "N/A"}</span>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px" }}>
                <button
                  type="button"
                  onClick={() => setSelectedGstDetails(null)}
                  className="ap-cancel-btn"
                  style={{ ...styles.cancelBtn, background: "#14524A", color: "#fff" }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Approve Confirmation Modal */}
        {approveItem && (
          <div style={styles.modalOverlay}>
            <div className="ap-modal-pop" style={styles.modalContentApprove}>
              <div style={styles.modalIconWrapApprove}>
                <IconCheck color="#14524A" width={20} height={20} />
              </div>
              <h3 style={styles.modalTitle}>Approve this company?</h3>
              <p style={styles.modalBody}>
                Credentials will be generated and emailed to{" "}
                <strong style={{ color: "#14181C" }}>
                  {activeTab === "erp" ? approveItem.Email : (approveItem.CompanyEmail || approveItem.RepresentativeEmail)}
                </strong>.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button type="button" onClick={() => setApproveItem(null)} style={styles.cancelBtn} disabled={actionLoading}>
                  Cancel
                </button>
                <button type="button" onClick={confirmApprove} disabled={actionLoading} style={styles.approveModalBtn}>
                  {actionLoading ? "Approving…" : "Confirm approval"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {rejectItem && (
          <div style={styles.modalOverlay}>
            <div className="ap-modal-pop" style={styles.modalContent}>
              <div style={styles.modalIconWrap}>
                <IconAlertTriangle color="#C4362E" />
              </div>
              <h3 style={styles.modalTitle}>Reject application</h3>
              <p style={styles.modalBody}>
                You are rejecting the request for <strong style={{ color: "#14181C" }}>{rejectItem.CompanyName}</strong>.
              </p>
              <form onSubmit={handleRejectSubmit}>
                <label style={styles.label}>Reason for rejection</label>
                <textarea
                  required
                  rows={4}
                  className="ap-input"
                  style={styles.textarea}
                  placeholder="e.g., GST details failed registry verification."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "18px" }}>
                  <button type="button" onClick={() => { setRejectItem(null); setRejectReason(""); }} style={styles.cancelBtn}>
                    Cancel
                  </button>
                  <button type="submit" disabled={actionLoading} style={styles.rejectModalBtn}>
                    {actionLoading ? "Submitting…" : "Send rejection"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function GlobalStyle() {
  return (
    <style>{`
      * { box-sizing: border-box; }
      body { font-family: 'Inter', -apple-system, 'Segoe UI', sans-serif; margin: 0; }
      .ap-input:focus { outline: none; border-color: #14524A !important; box-shadow: 0 0 0 3px rgba(20, 82, 74, 0.15); }
      .ap-primary-btn:hover { background: #0D3A34 !important; }
      .ap-logout-btn:hover { background: rgba(255,255,255,0.12) !important; }
      .ap-row:hover { background: #F7F9F8 !important; }
      .ap-approve-btn:hover:not(:disabled) { background: #0D3A34 !important; }
      .ap-reject-btn:hover:not(:disabled) { background: #FBEAE9 !important; }
      .ap-approve-btn:disabled, .ap-reject-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .ap-validate-btn:hover { background: #E4EEEC !important; border-color: #14524A !important; }
      .ap-modal-pop { animation: ap-modal-in 0.16s ease-out; }
      @keyframes ap-modal-in { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      .ap-spinner { animation: ap-spin 0.8s linear infinite; }
      @keyframes ap-spin { to { transform: rotate(360deg); } }
    `}</style>
  );
}

const FONT = "'Inter', -apple-system, 'Segoe UI', sans-serif";

const styles = {
  loginPage: { display: "flex", minHeight: "100vh", fontFamily: FONT, backgroundColor: "#F2F4F5" },
  loginBrandPanel: { flex: "0 0 42%", background: "linear-gradient(160deg, #14524A 0%, #0D3A34 100%)", color: "#EFF6F4", display: "flex", flexDirection: "column", justifyContent: "center", padding: "64px" },
  brandMark: { width: "48px", height: "48px", borderRadius: "10px", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "17px", marginBottom: "28px" },
  brandTitle: { fontSize: "30px", fontWeight: 700, margin: "0 0 14px 0" },
  brandTagline: { fontSize: "15px", lineHeight: 1.6, color: "rgba(239,246,244,0.8)", margin: 0 },
  loginFormPanel: { flex: "1", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px" },
  loginCard: { width: "100%", maxWidth: "380px" },
  loginIconWrap: { width: "44px", height: "44px", borderRadius: "10px", background: "#E4EEEC", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" },
  loginHeading: { fontSize: "22px", fontWeight: 700, color: "#14181C", margin: "0 0 6px 0" },
  loginSubheading: { fontSize: "14px", color: "#5B6570", margin: "0 0 26px 0" },
  errorAlert: { display: "flex", alignItems: "center", gap: "8px", background: "#FBEAE9", color: "#A72C25", padding: "11px 14px", borderRadius: "8px", marginBottom: "18px", fontSize: "13.5px" },
  formGroup: { marginBottom: "18px" },
  label: { display: "block", fontSize: "13px", fontWeight: 600, color: "#3C4550", marginBottom: "7px" },
  input: { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #D8DCE0", fontSize: "14px", fontFamily: FONT, background: "#FFFFFF" },
  textarea: { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #D8DCE0", fontSize: "14px", fontFamily: FONT, resize: "vertical" },
  primaryBtn: { width: "100%", padding: "12px", background: "#14524A", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "14.5px", fontFamily: FONT },
  dashboardContainer: { minHeight: "100vh", backgroundColor: "#F2F4F5", fontFamily: FONT },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 28px", background: "#14524A", color: "#fff" },
  topBarLeft: { display: "flex", alignItems: "center", gap: "12px" },
  brandMarkSmall: { width: "34px", height: "34px", borderRadius: "8px", background: "rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "13px" },
  topBarTitle: { fontSize: "15px", fontWeight: 700 },
  topBarSubtitle: { fontSize: "12px", color: "rgba(255,255,255,0.7)" },
  logoutBtn: { display: "flex", alignItems: "center", gap: "7px", background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.35)", padding: "8px 14px", borderRadius: "7px", cursor: "pointer", fontSize: "13px" },
  pageBody: { padding: "28px", maxWidth: "1250px", margin: "0 auto" },
  segmentedControl: { display: "inline-flex", gap: "4px", background: "#E7EAEC", padding: "4px", borderRadius: "10px", marginBottom: "20px" },
  segmentOption: { display: "flex", flexDirection: "column", alignItems: "flex-start", padding: "8px 18px", borderRadius: "7px", cursor: "pointer", fontSize: "13.5px", fontWeight: 600, color: "#5B6570" },
  segmentOptionActive: { background: "#FFFFFF", color: "#14181C", boxShadow: "0 1px 2px rgba(20,24,28,0.08)" },
  segmentSubLabel: { fontSize: "11px", fontWeight: 400, color: "#9AA5AF", marginTop: "1px" },
  srOnlyInput: { position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" },
  tableWrapper: { background: "#fff", borderRadius: "12px", border: "1px solid #E4E7E9", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13.5px" },
  tableHeadRow: { backgroundColor: "#FAFBFB", borderBottom: "1px solid #E4E7E9" },
  th: { padding: "13px 16px", fontWeight: 600, fontSize: "12.5px", color: "#5B6570", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid #EEF0F1" },
  td: { padding: "13px 16px", verticalAlign: "middle", color: "#3C4550" },
  processedLabel: { fontSize: "12.5px", color: "#9AA5AF" },
  gstCell: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
  validateBtn: { display: "flex", alignItems: "center", gap: "4px", background: "#F2F4F5", color: "#14524A", border: "1px solid #DDE6E4", padding: "3px 8px", borderRadius: "20px", cursor: "pointer", fontSize: "11px", fontWeight: 600 },
  gstStatusChecking: { display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "#9AA5AF", fontWeight: 600 },
  gstStatusValidBtn: { display: "inline-flex", alignItems: "center", gap: "4px", background: "#E3F3E8", color: "#1E7B45", border: "1px solid #C4E3D0", padding: "3px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 600, cursor: "pointer" },
  gstStatusInvalid: { display: "inline-flex", alignItems: "center", gap: "4px", background: "#FBEAE9", color: "#C4362E", padding: "3px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 600 },
  gstStatusRetry: { background: "#FCF1DE", color: "#966214", border: "none", padding: "3px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 600, cursor: "pointer" },
  spinnerTiny: { width: "11px", height: "11px", border: "2px solid #E4E7E9", borderTopColor: "#14524A", borderRadius: "50%", display: "inline-block" },
  approveBtn: { display: "flex", alignItems: "center", gap: "5px", background: "#14524A", color: "#fff", border: "none", padding: "7px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12.5px", fontWeight: 600 },
  rejectBtn: { display: "flex", alignItems: "center", gap: "5px", background: "#fff", color: "#C4362E", border: "1px solid #F1C7C4", padding: "7px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12.5px", fontWeight: 600 },
  badgeSuccess: { display: "inline-flex", alignItems: "center", gap: "6px", background: "#E3F3E8", color: "#1E7B45", padding: "4px 10px", borderRadius: "20px", fontSize: "11.5px", fontWeight: 600 },
  badgeDanger: { display: "inline-flex", alignItems: "center", gap: "6px", background: "#FBEAE9", color: "#C4362E", padding: "4px 10px", borderRadius: "20px", fontSize: "11.5px", fontWeight: 600 },
  badgeWarning: { display: "inline-flex", alignItems: "center", gap: "6px", background: "#FCF1DE", color: "#966214", padding: "4px 10px", borderRadius: "20px", fontSize: "11.5px", fontWeight: 600 },
  badgeDot: { width: "6px", height: "6px", borderRadius: "50%", background: "currentColor" },
  loadingState: { display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "60px 20px", color: "#5B6570" },
  spinner: { width: "16px", height: "16px", border: "2px solid #E4E7E9", borderTopColor: "#14524A", borderRadius: "50%" },
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "56px 20px" },
  emptyTitle: { fontSize: "14.5px", fontWeight: 600, color: "#3C4550", marginTop: "12px" },
  emptySubtitle: { fontSize: "13px", color: "#9AA5AF", marginTop: "4px" },
  modalOverlay: { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(15,20,23,0.55)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px" },
  modalContent: { background: "#fff", padding: "28px", borderRadius: "14px", width: "100%", maxWidth: "440px" },
  modalContentWide: { background: "#fff", padding: "28px", borderRadius: "14px", width: "100%", maxWidth: "620px", boxShadow: "0 20px 50px rgba(15,20,23,0.25)" },
  modalContentApprove: { background: "#fff", padding: "28px", borderRadius: "14px", width: "100%", maxWidth: "440px", borderTop: "4px solid #14524A" },
  modalHeaderRow: { display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px" },
  modalIconWrap: { width: "40px", height: "40px", borderRadius: "10px", background: "#FBEAE9", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" },
  modalIconWrapApprove: { width: "40px", height: "40px", borderRadius: "10px", background: "#E4EEEC", display: "flex", alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: "18px", fontWeight: 700, color: "#14181C" },
  modalBody: { fontSize: "13.5px", color: "#5B6570", lineHeight: 1.55, margin: "0 0 20px 0" },
  detailGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "#F7F9F8", border: "1px solid #E4E7E9", borderRadius: "10px", padding: "16px" },
  detailItem: { display: "flex", flexDirection: "column", gap: "3px" },
  detailLabel: { fontSize: "11.5px", color: "#6C757D", fontWeight: 500, textTransform: "uppercase" },
  detailValue: { fontSize: "13.5px", color: "#14181C", fontWeight: 600, wordBreak: "break-word" },
  approveModalBtn: { background: "#14524A", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "7px", cursor: "pointer", fontSize: "13.5px", fontWeight: 600 },
  cancelBtn: { background: "#F2F4F5", color: "#3C4550", border: "none", padding: "10px 16px", borderRadius: "7px", cursor: "pointer", fontSize: "13.5px", fontWeight: 600 },
  rejectModalBtn: { background: "#C4362E", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "7px", cursor: "pointer", fontSize: "13.5px", fontWeight: 600 },
};