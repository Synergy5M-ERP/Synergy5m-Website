import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import './AdminDemo.css';
import { Link, useNavigate } from 'react-router-dom';

const DemoPanel = () => {
    const [requests, setRequests] = useState([]);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const IconLogout = (props) => (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" {...props}>
        <path d="M6 2H3.5A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14H6M10.5 11.5L14 8L10.5 4.5M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );

    const navigate = useNavigate();

    // Pagination & Filter States
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [limit, setLimit] = useState(10);
    const [statusFilter, setStatusFilter] = useState('All');

    // Form states for Approval Modal
    const [meetingDate, setMeetingDate] = useState('');
    const [meetingTime, setMeetingTime] = useState('');
    const [meetingLink, setMeetingLink] = useState('');
    const [hostName, setHostName] = useState('');
    const [ccEmails, setCcEmails] = useState(['sales@synergy5m.com', 'accounts@synergy5m.com']);

    const availableCcOptions = [
        'sales@synergy5m.com', 
        'accounts@synergy5m.com', 
        'management@synergy5m.com', 
        'support@synergy5m.com'
    ];

    useEffect(() => {
        fetchRequests(1, statusFilter, limit);
    }, [statusFilter, limit]);

    const fetchRequests = async (pageNum, status, rowLimit) => {
        try {
            setLoading(true);
            const response = await axios.get(`/api/admin/demo-requests?page=${pageNum}&limit=${rowLimit}&status=${status}`);
            setRequests(response.data.data);
            setTotalPages(response.data.pagination.totalPages);
            setTotalRecords(response.data.pagination.totalRecords);
            setPage(response.data.pagination.currentPage);
        } catch (error) {
            console.error('Error fetching requests', error);
            Swal.fire('Error', 'Failed to connect to server.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (newPage) => {
        setPage(newPage);
        fetchRequests(newPage, statusFilter, limit);
    };

    const handleOpenApproveModal = (req) => {
        if (req.DemoStatus === 'Submitted' || req.DemoStatus === 'Done') {
            Swal.fire({
                icon: 'info',
                title: 'Already Submitted',
                text: `You have already submitted the meeting link to this user (${req.fullName}).`,
                confirmButtonColor: '#4f46e5'
            });
            return;
        }

        setSelectedRequest(req);
        setMeetingDate(req.PreferredDate ? req.PreferredDate.split('T')[0] : '');
        setMeetingTime(req.TimeSlot || '');
        setMeetingLink('');
        setHostName('');
        setIsModalOpen(true);
    };

    const handleApproveSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`/api/admin/demo-requests/${selectedRequest.Id}/approve`, {
                meetingDate,
                meetingTime,
                meetingLink,
                hostName,
                ccEmails
            });
            
            setIsModalOpen(false);
            Swal.fire({
                icon: 'success',
                title: 'Meeting Link Sent!',
                text: 'Demo approved successfully and meeting details have been emailed.',
                confirmButtonColor: '#4f46e5'
            });

            fetchRequests(page, statusFilter, limit);
        } catch (error) {
            const errorMsg = error.response?.data?.error || 'Failed to process approval.';
            Swal.fire({
                icon: 'warning',
                title: 'Action Blocked',
                text: errorMsg,
                confirmButtonColor: '#4f46e5'
            });
        }
    };

    const handleFeedbackAction = async (item) => {
        if (item.DemoStatus === 'Done') {
            Swal.fire({
                icon: 'info',
                title: 'Demo Already Given',
                text: `The feedback form has already been sent and the demo is marked as done for ${item.fullName}.`,
                confirmButtonColor: '#059669'
            });
            return;
        }

        const confirmResult = await Swal.fire({
            title: 'Send Feedback Form?',
            text: `Mark demo as Done and send feedback form to ${item.BusinessEmail || item.Email}?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#059669',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, Send Feedback'
        });

        if (!confirmResult.isConfirmed) return;

        try {
            await axios.post(`/api/admin/demo-requests/${item.Id}/feedback`);
            Swal.fire({
                icon: 'success',
                title: 'Feedback Sent!',
                text: 'The demo is marked as Done and the feedback email has been sent successfully.',
                confirmButtonColor: '#059669'
            });

            fetchRequests(page, statusFilter, limit);
        } catch (error) {
            const errorMsg = error.response?.data?.error || 'Failed to trigger feedback email.';
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: errorMsg,
                confirmButtonColor: '#059669'
            });
        }
    };

    const handleCcSelectChange = (e) => {
        const options = e.target.options;
        const selected = [];
        for (let i = 0; i < options.length; i++) {
            if (options[i].selected) {
                selected.push(options[i].value);
            }
        }
        setCcEmails(selected);
    };

    return (
        <div className="admin-wrapper" style={styles.dashboardContainer}>
            <div style={styles.topBar}>
                <div style={styles.topBarLeft}>
                    <div style={styles.brandMarkSmall}>S5</div>
                    <div>
                        <div style={styles.topBarTitle}>
                            {/* Fixed: Capitalized Link component */}
                            <Link to="/demo-req" style={{ color: '#fff', textDecoration: 'none' }}>Synergy 5M</Link>
                        </div>
                        <div style={styles.topBarSubtitle}>Demo Admin Panel</div>
                    </div>
                </div>
                <button 
              type="button"
              onClick={() => navigate('/')} 
              style={styles.logoutBtn}
            >
              Website
            </button>
                <button 
                    type="button"
                    onClick={() => navigate('/admin')} 
                    style={styles.logoutBtn}
                >
                    <IconLogout /> Back to Admin Panel
                </button>
            </div>

            <div style={styles.pageBody}>
                <div className="table-card">
                    {/* Top Filter & Pagination Control Toolbar */}
                    <div className="table-toolbar">
                        <div className="filter-group">
                            <label>Filter Status:</label>
                            <select 
                                value={statusFilter} 
                                onChange={(e) => setStatusFilter(e.target.value)} 
                                className="toolbar-select"
                            >
                                <option value="All">All Statuses</option>
                                <option value="Pending">Pending</option>
                                <option value="Submitted">Submitted</option>
                                <option value="Done">Done</option>
                            </select>
                        </div>

                        <div className="filter-group">
                            <label>Rows per page:</label>
                            <select 
                                value={limit} 
                                onChange={(e) => setLimit(Number(e.target.value))} 
                                className="toolbar-select"
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                            </select>
                        </div>
                    </div>

                    {loading ? (
                        <div className="loader-container"><div className="spinner"></div></div>
                    ) : (
                        <>
                            <div className="table-responsive">
                                <table className="modern-table">
                                    <thead>
                                        <tr>
                                            <th>Client / Company</th>
                                            <th>Contact Info</th>
                                            <th>Requested Slot</th>
                                            <th>Platform & Requirements</th>
                                            <th>Status</th>
                                            <th className="text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {requests.length === 0 ? (
                                            <tr><td colSpan="6" className="no-data">No demo records found.</td></tr>
                                        ) : (
                                            requests.map((item) => (
                                                <tr key={item.Id}>
                                                    <td>
                                                        <div className="client-name">{item.fullName}</div>
                                                        <div className="company-badge">{item.CompanyName || 'Independent'}</div>
                                                    </td>
                                                    <td>
                                                        <div className="email-main">{item.Email}</div>
                                                        <div className="email-sub">{item.BusinessEmail || 'No Business Email'}</div>
                                                        <div className="phone-text">{item.OfficialMobile}</div>
                                                    </td>
                                                    <td>
                                                        <div className="date-badge">📅 {item.PreferredDate ? item.PreferredDate.split('T')[0] : 'N/A'}</div>
                                                        <div className="time-text">⏰ {item.TimeSlot}</div>
                                                    </td>
                                                    <td>
                                                        <div className="platform-tag">{item.MeetingPlatform || 'Online'}</div>
                                                        <div className="requirement-snippet" title={item.Requirement}>
                                                            {item.Requirement ? (item.Requirement.length > 40 ? item.Requirement.substring(0, 40) + '...' : item.Requirement) : 'No requirement specified'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`status-badge ${item.DemoStatus ? item.DemoStatus.toLowerCase() : 'pending'}`}>
                                                            {item.DemoStatus || 'Pending'}
                                                        </span>
                                                    </td>
                                                    <td className="actions-cell">
                                                        <button 
                                                            className="btn-action btn-approve" 
                                                            onClick={() => handleOpenApproveModal(item)}
                                                        >
                                                            {item.DemoStatus === 'Submitted' ? 'Reschedule / Sent' : 'Approve'}
                                                        </button>
                                                        <button 
                                                            className="btn-action btn-feedback" 
                                                            onClick={() => handleFeedbackAction(item)}
                                                        >
                                                            {item.DemoStatus === 'Done' ? 'Demo Given' : 'Feedback'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Bottom Pagination Bar */}
                            <div className="pagination-container">
                                <span className="pagination-info">
                                    Showing page <strong>{page}</strong> of <strong>{totalPages || 1}</strong> ({totalRecords} total records)
                                </span>
                                <div className="pagination-buttons">
                                    <button 
                                        className="pagination-btn" 
                                        onClick={() => handlePageChange(page - 1)} 
                                        disabled={page === 1 || loading}
                                    >
                                        ◀ Previous
                                    </button>
                                    <button 
                                        className="pagination-btn" 
                                        onClick={() => handlePageChange(page + 1)} 
                                        disabled={page >= totalPages || loading}
                                    >
                                        Next ▶
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Approval Interactive Modal */}
            {isModalOpen && (
                <div className="modal-backdrop">
                    <div className="modal-container animate-scale">
                        <div className="modal-header">
                            <h3>Schedule & Approve Demo</h3>
                            <button className="close-btn" onClick={() => setIsModalOpen(false)}>&times;</button>
                        </div>
                        <p className="modal-subtitle">Configuring meeting dispatch for <strong>{selectedRequest?.fullName}</strong></p>
                        
                        <form onSubmit={handleApproveSubmit} className="modal-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Meeting Date</label>
                                    <input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} required />
                                </div>
                                <div className="form-group">
                                    <label>Time Slot</label>
                                    <input type="text" placeholder="e.g. 03:00 PM - 04:00 PM" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} required />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Meeting Link (URL)</label>
                                <input type="url" placeholder="https://teams.microsoft.com/... or Zoom link" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} required />
                            </div>

                            <div className="form-group">
                                <label>Host Name (Who is giving demo)</label>
                                <input type="text" placeholder="e.g. Rahul Sharma" value={hostName} onChange={(e) => setHostName(e.target.value)} required />
                            </div>

                            <div className="form-group">
                                <label>CC Emails (Hold Ctrl/Cmd to select multiple options)</label>
                                <select multiple value={ccEmails} onChange={handleCcSelectChange} className="custom-multi-select">
                                    {availableCcOptions.map((email) => (
                                        <option key={email} value={email}>{email}</option>
                                    ))}
                                </select>
                                <small className="help-text">Default included: sales@synergy5m.com, accounts@synergy5m.com</small>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn-primary">Confirm & Dispatch Mail</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DemoPanel;

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