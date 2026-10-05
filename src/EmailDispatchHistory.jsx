import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const IconBack = (props) => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" {...props}>
    <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconSearch = (props) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" {...props}>
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.7" />
    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const IconMail = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function EmailDispatchHistory() {
  const navigate = useNavigate();
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/email-dispatch-history', { credentials: 'include' });
        const data = await res.json();
        if (data.success) {
          setHistoryData(data.data || []);
        }
      } catch (err) {
        console.error('Error fetching email dispatch history:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const filteredData = historyData.filter(item => {
    const matchesSearch = 
      (item.Company_Name && item.Company_Name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.Email && item.Email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.Industry && item.Industry.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.Category && item.Category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.Subject && item.Subject.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter ? item.Status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  // Handler to trigger a follow-up email for a specific vendor
  const handleFollowUp = (vendor) => {
    navigate('/vendor-emails', { 
      state: { 
        preselectedVendor: {
          Id: vendor.Vendor_Id,
          Company_Name: vendor.Company_Name,
          Email: vendor.Email,
          industry: vendor.Industry,
          Category: vendor.Category
        },
        defaultSubject: `Follow-up: Further updates regarding previous implementation`
      } 
    });
  };

  return (
    <div style={styles.container}>
      <GlobalStyle />

      <div style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <div style={styles.brandMarkSmall}>S5</div>
          <div>
            <div style={styles.topBarTitle}>Synergy 5M</div>
            <div style={styles.topBarSubtitle}>Email Dispatch Audit Tracker</div>
          </div>
        </div>
        <button 
          type="button"
          onClick={() => navigate('/admin')} 
          style={styles.backBtn}
        >
          <IconBack /> Back to Admin
        </button>
      </div>

      <div style={styles.pageBody}>
        <div style={{ marginBottom: "20px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#14181C", margin: "0 0 4px 0" }}>Email Tracker For Followup</h1>
          <p style={{ fontSize: "13.5px", color: "#5B6570", margin: 0 }}>Review previously sent logs and initiate quick follow-up emails to vendors.</p>
        </div>

        <div style={styles.filterCard}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", flex: 1, minWidth: "240px" }}>
            <IconSearch color="#788693" style={{ position: "absolute", left: "12px" }} />
            <input 
              type="text"
              placeholder="Search by company, email, subject, industry..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ap-input"
              style={styles.searchInput}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="ap-input"
            style={styles.selectInput}
          >
            <option value="">All Statuses</option>
            <option value="Sent">Sent</option>
            <option value="Failed">Failed</option>
          </select>
        </div>

        <div style={styles.tableCard}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "50px", color: "#9AA5AF", fontSize: "14px" }}>Loading dispatch history...</div>
          ) : filteredData.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px", color: "#9AA5AF", fontSize: "14px" }}>No tracked dispatch records found.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#FAFBFB", borderBottom: "1px solid #E4E7E9", color: "#5B6570", fontWeight: 600 }}>
                    <th style={{ padding: "12px 16px" }}>Company Name</th>
                    <th style={{ padding: "12px 16px" }}>Email</th>
                    <th style={{ padding: "12px 16px" }}>Industry</th>
                    <th style={{ padding: "12px 16px" }}>Category</th>
                    <th style={{ padding: "12px 16px" }}>Email Subject</th>
                    <th style={{ padding: "12px 16px" }}>Status</th>
                    <th style={{ padding: "12px 16px" }}>Dispatched At</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #EEF0F1" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: "#14181C" }}>{row.Company_Name}</td>
                      <td style={{ padding: "12px 16px", color: "#5B6570" }}>{row.Email || "No Email"}</td>
                      <td style={{ padding: "12px 16px", color: "#3C4550" }}>{row.Industry || "—"}</td>
                      <td style={{ padding: "12px 16px", color: "#3C4550" }}>{row.Category || "—"}</td>
                      <td style={{ padding: "12px 16px", color: "#3C4550", maxWidth: "180px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={row.Subject}>
                        {row.Subject}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          padding: "3px 8px",
                          borderRadius: "4px",
                          fontSize: "11.5px",
                          fontWeight: 600,
                          background: row.Status === 'Sent' ? '#E3F3E8' : '#FBEAE9',
                          color: row.Status === 'Sent' ? '#1E7B45' : '#C4362E'
                        }}>
                          {row.Status}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#788693", whiteSpace: "nowrap" }}>
                        {new Date(row.Dispatched_At).toLocaleString()}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => handleFollowUp(row)}
                          style={styles.followUpBtn}
                          title="Send follow-up email"
                        >
                          <IconMail /> Follow-up
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
    `}</style>
  );
}

const FONT = "'Inter', -apple-system, 'Segoe UI', sans-serif";

const styles = {
  container: { minHeight: "100vh", backgroundColor: "#F2F4F5", fontFamily: FONT },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 28px", background: "#14524A", color: "#fff" },
  topBarLeft: { display: "flex", alignItems: "center", gap: "12px" },
  brandMarkSmall: { width: "34px", height: "34px", borderRadius: "8px", background: "rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "13px" },
  topBarTitle: { fontSize: "15px", fontWeight: 700 },
  topBarSubtitle: { fontSize: "12px", color: "rgba(255,255,255,0.7)" },
  backBtn: { display: "flex", alignItems: "center", gap: "7px", background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.35)", padding: "8px 14px", borderRadius: "7px", cursor: "pointer", fontSize: "13px" },
  pageBody: { padding: "28px", maxWidth: "1280px", margin: "0 auto" },
  filterCard: { display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" },
  searchInput: { width: "100%", padding: "9px 12px 9px 34px", borderRadius: "8px", border: "1px solid #D8DCE0", fontSize: "13.5px", background: "#fff" },
  selectInput: { padding: "9px 14px", borderRadius: "8px", border: "1px solid #D8DCE0", fontSize: "13.5px", background: "#fff", cursor: "pointer", minWidth: "160px" },
  tableCard: { background: "#fff", borderRadius: "12px", border: "1px solid #E4E7E9", overflow: "hidden" },
  followUpBtn: { display: "inline-flex", alignItems: "center", gap: "5px", background: "#E4EEEC", color: "#14524A", border: "1px solid #14524A", padding: "5px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: 600 }
};