import React, { useState, useEffect } from "react";

export default function AdminPanel() {
  const [token, setToken] = useState(localStorage.getItem("admin_token") || "");
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");

  const [activeTab, setActiveTab] = useState("erp"); // 'erp' or 'buyingselling'
  const [dataList, setDataList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Reject Modal State
  const [rejectItem, setRejectItem] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });
      const data = await res.json();
      if (data.success) {
        setToken(data.token);
        localStorage.setItem("admin_token", data.token);
      } else {
        setLoginError(data.message || "Invalid credentials");
      }
    } catch (err) {
      setLoginError("Failed to communicate with backend server");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setToken("");
    setDataList([]);
  };

  // Fetch Table Data
  const fetchData = async (type) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/enquiries?type=${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const json = await res.json();
      if (json.success) {
        setDataList(json.data || []);
      }
    } catch (err) {
      alert("Error fetching data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData(activeTab);
    }
  }, [token, activeTab]);

  // Approve Record
  const handleApprove = async (row) => {
    const email = activeTab === "erp" ? row.Email : (row.CompanyEmail || row.RepresentativeEmail);
    const name = activeTab === "erp" ? row.ContactPerson : row.RepresentativeName;

    if (!window.confirm(`Approve and generate credentials for ${email}?`)) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: row.Id,
          type: activeTab,
          email,
          recipientName: name,
        }),
      });
      const result = await res.json();
      if (result.success) {
        alert(result.message);
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

  // Submit Reject
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: rejectItem.Id,
          type: activeTab,
          email,
          recipientName: name,
          reason: rejectReason,
        }),
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

  // 1. RENDER LOGIN SCREEN
  if (!token) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginCard}>
          <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Admin Portal Login</h2>
          {loginError && <div style={styles.errorAlert}>{loginError}</div>}
          <form onSubmit={handleLogin}>
            <div style={styles.formGroup}>
              <label>Admin Username</label>
              <input
                type="text"
                required
                style={styles.input}
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
              />
            </div>
            <div style={styles.formGroup}>
              <label>Password</label>
              <input
                type="password"
                required
                style={styles.input}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
              />
            </div>
            <button type="submit" style={styles.primaryBtn}>
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. RENDER MAIN ADMIN DASHBOARD
  return (
    <div style={styles.dashboardContainer}>
      {/* Header */}
      <div style={styles.header}>
        <h2>Synergy 5M - Admin Panel</h2>
        <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
      </div>

      {/* Radio Switcher */}
      <div style={styles.radioContainer}>
        <label style={styles.radioLabel}>
          <input
            type="radio"
            name="category"
            value="erp"
            checked={activeTab === "erp"}
            onChange={() => setActiveTab("erp")}
          />
          <span style={{ marginLeft: "8px", fontWeight: "bold" }}>ERP Requests (TrialRequests)</span>
        </label>
        <label style={styles.radioLabel}>
          <input
            type="radio"
            name="category"
            value="buyingselling"
            checked={activeTab === "buyingselling"}
            onChange={() => setActiveTab("buyingselling")}
          />
          <span style={{ marginLeft: "8px", fontWeight: "bold" }}>Buying & Selling (BusinessEnquiries)</span>
        </label>
      </div>

      {/* Table Section */}
      <div style={styles.tableWrapper}>
        {loading ? (
          <p style={{ padding: "20px" }}>Loading data from SQL Server...</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeadRow}>
                <th style={styles.th}>Actions</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>ID</th>
                {activeTab === "buyingselling" && <th style={styles.th}>Code / Category</th>}
                <th style={styles.th}>Company Name</th>
                <th style={styles.th}>Contact Person</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Mobile</th>
                {activeTab === "erp" ? (
                  <>
                    <th style={styles.th}>Plan</th>
                    <th style={styles.th}>Trial Dates</th>
                    <th style={styles.th}>Users</th>
                  </>
                ) : (
                  <>
                    <th style={styles.th}>Product Details</th>
                    <th style={styles.th}>Qty / Target Price</th>
                    <th style={styles.th}>City / GST</th>
                  </>
                )}
                <th style={styles.th}>Created At</th>
              </tr>
            </thead>
            <tbody>
              {dataList.length === 0 ? (
                <tr>
                  <td colSpan="12" style={{ textAlign: "center", padding: "20px" }}>No records found.</td>
                </tr>
              ) : (
                dataList.map((row) => {
                  const status = activeTab === "erp" ? row.TrialStatus : row.Status;
                  const isPending = !status || status === "Pending" || status === "Pending Verification" || status === "Active";

                  return (
                    <tr key={row.Id} style={styles.tr}>
                      <td style={styles.td}>
                        {isPending ? (
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              disabled={actionLoading}
                              onClick={() => handleApprove(row)}
                              style={styles.approveBtn}
                            >
                              Approve
                            </button>
                            <button
                              disabled={actionLoading}
                              onClick={() => setRejectItem(row)}
                              style={styles.rejectBtn}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: "12px", color: "#666" }}>Processed</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <span style={status === "Approved" ? styles.badgeSuccess : status === "Rejected" ? styles.badgeDanger : styles.badgeWarning}>
                          {status || "Pending"}
                        </span>
                      </td>
                      <td style={styles.td}>{row.Id}</td>
                      {activeTab === "buyingselling" && (
                        <td style={styles.td}>
                          <strong>{row.Code}</strong> <br />
                          <small>{row.Category}</small>
                        </td>
                      )}
                      <td style={styles.td}><strong>{row.CompanyName}</strong></td>
                      <td style={styles.td}>{activeTab === "erp" ? row.ContactPerson : row.RepresentativeName}</td>
                      <td style={styles.td}>{activeTab === "erp" ? row.Email : (row.CompanyEmail || row.RepresentativeEmail)}</td>
                      <td style={styles.td}>{activeTab === "erp" ? row.MobileNo : (row.Mobile || row.RepresentativeMobile)}</td>
                      {activeTab === "erp" ? (
                        <>
                          <td style={styles.td}>{row.SubscriptionPlan}</td>
                          <td style={styles.td}>
                            {row.TrialStartDate ? new Date(row.TrialStartDate).toLocaleDateString() : "-"} to{" "}
                            {row.TrialEndDate ? new Date(row.TrialEndDate).toLocaleDateString() : "-"}
                          </td>
                          <td style={styles.td}>{row.NumberOfUsers}</td>
                        </>
                      ) : (
                        <>
                          <td style={styles.td}>
                            {row.ProductName} <br />
                            <small>{row.ProductCategory}</small>
                          </td>
                          <td style={styles.td}>
                            {row.RequiredQuantity || "-"} {row.Unit || ""} <br />
                            <small>{row.TargetPrice || row.PriceOrRange || "N/A"}</small>
                          </td>
                          <td style={styles.td}>
                            {row.DeliveryLocation || row.Address || "-"} <br />
                            <small>{row.GSTIN || "-"}</small>
                          </td>
                        </>
                      )}
                      <td style={styles.td}>{row.CreatedAt ? new Date(row.CreatedAt).toLocaleString() : "-"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Reject Modal */}
      {rejectItem && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3>Reject Application</h3>
            <p>
              Are you sure you want to reject the application for{" "}
              <strong>{rejectItem.CompanyName}</strong>?
            </p>
            <form onSubmit={handleRejectSubmit}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
                Reason for Rejection (will be emailed to user):
              </label>
              <textarea
                required
                rows={4}
                style={styles.textarea}
                placeholder="e.g., Incomplete GST verification documents or invalid contact details."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "15px" }}>
                <button
                  type="button"
                  onClick={() => { setRejectItem(null); setRejectReason(""); }}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} style={styles.rejectModalBtn}>
                  {actionLoading ? "Submitting..." : "Send Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  loginContainer: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "#f0f2f5" },
  loginCard: { background: "#fff", padding: "30px", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", width: "100%", maxWidth: "380px" },
  errorAlert: { background: "#ffebee", color: "#c62828", padding: "10px", borderRadius: "4px", marginBottom: "15px", fontSize: "14px" },
  formGroup: { marginBottom: "16px" },
  input: { width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #ccc", marginTop: "6px", boxSizing: "border-box" },
  textarea: { width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" },
  primaryBtn: { width: "100%", padding: "12px", background: "#0b5ed7", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" },
  dashboardContainer: { padding: "24px", fontFamily: "Segoe UI, Tahoma, sans-serif", backgroundColor: "#fafafa", minHeight: "100vh" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #e0e0e0", paddingBottom: "12px" },
  logoutBtn: { background: "#dc3545", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "4px", cursor: "pointer" },
  radioContainer: { display: "flex", gap: "24px", margin: "20px 0", padding: "12px 16px", background: "#fff", borderRadius: "6px", border: "1px solid #ddd" },
  radioLabel: { display: "flex", alignItems: "center", cursor: "pointer" },
  tableWrapper: { background: "#fff", borderRadius: "8px", border: "1px solid #ddd", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" },
  tableHeadRow: { backgroundColor: "#f4f6f8", borderBottom: "2px solid #ddd" },
  th: { padding: "12px", borderBottom: "1px solid #ddd", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid #eee" },
  td: { padding: "10px 12px", verticalAlign: "middle" },
  approveBtn: { background: "#28a745", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "12px" },
  rejectBtn: { background: "#dc3545", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "12px" },
  cancelBtn: { background: "#6c757d", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "4px", cursor: "pointer" },
  rejectModalBtn: { background: "#dc3545", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "4px", cursor: "pointer" },
  badgeSuccess: { background: "#d4edda", color: "#155724", padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "bold" },
  badgeDanger: { background: "#f8d7da", color: "#721c24", padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "bold" },
  badgeWarning: { background: "#fff3cd", color: "#856404", padding: "3px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "bold" },
  modalOverlay: { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modalContent: { background: "#fff", padding: "24px", borderRadius: "8px", width: "100%", maxWidth: "450px" }
};