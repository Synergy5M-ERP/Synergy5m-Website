import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Printer,
  XCircle,
  Building,
  Calendar,
  Layers,
  Info
} from 'lucide-react';
import './BuyerOfferViewPage.css';

export default function BuyerOfferViewPage() {
  const { allocationId } = useParams();
  const [searchParams] = useSearchParams();

  const refParam = allocationId || searchParams.get('id') || searchParams.get('ref');

  const [allocation, setAllocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Acceptance / Decline Modal
  const [responseModal, setResponseModal] = useState(null); // 'accept' | 'decline'
  const [buyerRemarks, setBuyerRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  // 48-Hour Countdown Timer state
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0, isExpired: false });

  // Fetch allocation details
  const fetchAllocation = useCallback(async () => {
    if (!refParam) {
      setError('No allocation reference provided in URL.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/buyer-allocations/view/${encodeURIComponent(refParam)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Unable to load allocation offer.');
      }
      setAllocation(data.data);
    } catch (err) {
      console.error('Error fetching buyer offer:', err);
      setError(err.message || 'Error loading offer details.');
    } finally {
      setLoading(false);
    }
  }, [refParam]);

  useEffect(() => {
    fetchAllocation();
  }, [fetchAllocation]);

  // Live Countdown Timer
  useEffect(() => {
    if (!allocation || !allocation.OfferValidUntil) return;

    const targetTime = new Date(allocation.OfferValidUntil).getTime();

    const updateCountdown = () => {
      const now = new Date().getTime();
      const difference = targetTime - now;

      if (difference <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isExpired: true });
      } else {
        const hours = Math.floor(difference / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ hours, minutes, seconds, isExpired: false });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [allocation]);

  // Handle Response (Accept / Decline)
  const handleRespond = async (responseType) => {
    if (!allocation) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/buyer-allocations/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocationRef: allocation.AllocationRef,
          response: responseType,
          remarks: buyerRemarks
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit response.');
      }

      setActionSuccess(data.message);
      setResponseModal(null);
      await fetchAllocation();
    } catch (err) {
      console.error('Response error:', err);
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Calculations
  const calculatedLandedUnitRate = useMemo(() => {
    if (!allocation) return 0;
    const base = Number(allocation.OfferedUnitPrice || 0);
    const freightExtra = !allocation.FreightIncluded ? Number(allocation.FreightCharges || 0) : 0;
    const otherCharges = Number(allocation.OtherCharges || 0);
    return base + freightExtra + otherCharges;
  }, [allocation]);

  const poolSharePercent = useMemo(() => {
    if (!allocation || !allocation.TotalPoolDemand) return 100;
    const share = (Number(allocation.AllocatedQuantity || 0) / Number(allocation.TotalPoolDemand)) * 100;
    return Math.min(100, Math.round(share));
  }, [allocation]);

  if (loading) {
    return (
      <div className="bov-loading-wrapper">
        <div className="bov-spinner" />
        <p>Loading your allocated consortium offer...</p>
      </div>
    );
  }

  if (error || !allocation) {
    return (
      <div className="bov-error-wrapper">
        <div className="bov-error-card">
          <AlertTriangle size={36} className="text-amber-500" />
          <h2>Offer Unavailable</h2>
          <p>{error || 'The requested allocation offer could not be found or has expired.'}</p>
          <a href="https://synergy5m.com/" className="bov-btn-primary">
            Return to Marketplace
          </a>
        </div>
      </div>
    );
  }

  const isAccepted = allocation.Status === 'Accepted';
  const isDeclined = allocation.Status === 'Declined';

  return (
    <div className="bov-page-container">
      {/* Top Banner Navigation (Hidden in Print) */}
      <header className="bov-top-bar no-print">
        <div className="bov-top-inner">
          <div className="bov-brand">
            <div className="bov-logo-icon">S5</div>
            <div>
              <span className="bov-brand-title">Synergy5M Consortium</span>
              <span className="bov-brand-sub">Demand Pooling & Facilitated Procurement</span>
            </div>
          </div>

          <div className="bov-top-actions">
            <button type="button" className="bov-btn-print" onClick={() => window.print()}>
              <Printer size={14} />
              <span>Print / Save PDF</span>
            </button>
            <a href="https://synergy5m.com/" className="bov-btn-home">
              Marketplace
            </a>
          </div>
        </div>
      </header>

      {/* Main Document Content */}
      <main className="bov-content-wrapper">
        {/* Success Alert Banner */}
        {actionSuccess && (
          <div className="bov-alert-success no-print">
            <CheckCircle2 size={18} />
            <span>{actionSuccess}</span>
          </div>
        )}

        <div className="bov-doc-card">
          {/* Document Header */}
          <div className="bov-doc-header">
            <div className="bov-doc-brand">
              <div className="bov-doc-logo">S5</div>
              <div>
                <h1 className="bov-company-name">Synergy5M LLP</h1>
                <p className="bov-consortium-tag">Collective Procurement Consortium • Facilitated Trade</p>
                <p className="bov-contact-line">Pune, Maharashtra, India • sales@synergy5m.com • https://synergy5m.com/</p>
              </div>
            </div>

            <div className="bov-doc-badge-group">
              <span className="bov-badge-title">OFFICIAL ALLOCATION OFFER</span>
              <div className="bov-alloc-ref">{allocation.AllocationRef}</div>
              <div className={`bov-status-tag ${allocation.Status.toLowerCase().replace(/\s+/g, '-')}`}>
                {isAccepted ? <CheckCircle2 size={12} /> : <ShieldCheck size={12} />}
                <span>Status: {allocation.Status}</span>
              </div>
            </div>
          </div>

          {/* 48-Hour Live Countdown Banner */}
          {!isAccepted && !isDeclined && (
            <div className={`bov-countdown-banner ${timeLeft.isExpired ? 'expired' : ''}`}>
              <div className="bov-countdown-left">
                <Clock size={18} />
                <div>
                  <strong>{timeLeft.isExpired ? 'Offer Validity Expired' : 'Consortium Reservation Countdown:'}</strong>
                  <span> This factory bulk rate is reserved for your account for 48 hours.</span>
                </div>
              </div>

              {!timeLeft.isExpired && (
                <div className="bov-countdown-digits">
                  <div className="bov-time-unit">
                    <span className="bov-time-val">{String(timeLeft.hours).padStart(2, '0')}</span>
                    <span className="bov-time-label">HRS</span>
                  </div>
                  <span className="bov-time-colon">:</span>
                  <div className="bov-time-unit">
                    <span className="bov-time-val">{String(timeLeft.minutes).padStart(2, '0')}</span>
                    <span className="bov-time-label">MIN</span>
                  </div>
                  <span className="bov-time-colon">:</span>
                  <div className="bov-time-unit">
                    <span className="bov-time-val">{String(timeLeft.seconds).padStart(2, '0')}</span>
                    <span className="bov-time-label">SEC</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sourcing Partner & Buyer Anonymity Notice */}
          <div className="bov-confidential-banner">
            <ShieldCheck size={16} />
            <span>
              <strong>Facilitated Consortium Model:</strong> Sourcing is fulfilled by a <strong>{allocation.SourcingPartner || 'Verified Synergy5M Consortium Partner'}</strong>. Commercial terms are direct from supplier to buyer.
            </span>
          </div>

          {/* Summary Metric Highlights */}
          <div className="bov-metric-grid">
            <div className="bov-metric-card">
              <span className="bov-m-label">Your Allocated Volume</span>
              <div className="bov-m-val highlight">
                {allocation.AllocatedQuantity} {allocation.Uom}
              </div>
              <span className="bov-m-sub">
                Requested: {allocation.RequestedQuantity} {allocation.Uom}
              </span>
            </div>

            <div className="bov-metric-card">
              <span className="bov-m-label">Total Consortium Pool</span>
              <div className="bov-m-val">
                {allocation.TotalPoolDemand} {allocation.Uom}
              </div>
              <span className="bov-m-sub">
                Your Share: {poolSharePercent}% of Pool
              </span>
            </div>

            <div className="bov-metric-card">
              <span className="bov-m-label">Delivered Unit Rate</span>
              <div className="bov-m-val price">
                {allocation.Currency === 'USD' ? '$' : '₹'}{Number(calculatedLandedUnitRate).toLocaleString('en-IN')}/{allocation.Uom}
              </div>
              <span className="bov-m-sub">
                Basic Rate: ₹{Number(allocation.OfferedUnitPrice).toLocaleString('en-IN')}/{allocation.Uom}
              </span>
            </div>

            <div className="bov-metric-card">
              <span className="bov-m-label">Total Landed Value</span>
              <div className="bov-m-val total">
                {allocation.Currency === 'USD' ? '$' : '₹'}{Number(allocation.TotalEstimatedValue).toLocaleString('en-IN')}
              </div>
              <span className="bov-m-sub">
                Includes Taxes & Transport
              </span>
            </div>
          </div>

          {/* Two-Column Specification & Party Section */}
          <div className="bov-grid-2">
            {/* Buyer Account Details */}
            <div className="bov-card-section">
              <h3 className="bov-section-heading">
                <Building size={15} />
                <span>Consortium Participant Details</span>
              </h3>
              <table className="bov-spec-table">
                <tbody>
                  <tr>
                    <td className="bov-lbl">Purchasing Company:</td>
                    <td className="bov-val font-bold">{allocation.BuyerCompanyName}</td>
                  </tr>
                  <tr>
                    <td className="bov-lbl">Contact Representative:</td>
                    <td className="bov-val">{allocation.BuyerContactPerson || 'Authorized Procurement'}</td>
                  </tr>
                  <tr>
                    <td className="bov-lbl">Delivery Plant Destination:</td>
                    <td className="bov-val font-bold">📍 {allocation.DeliveryLocation}</td>
                  </tr>
                  <tr>
                    <td className="bov-lbl">Sourcing Channel:</td>
                    <td className="bov-val">{allocation.Region || 'Domestic Direct'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Sourcing Specification */}
            <div className="bov-card-section">
              <h3 className="bov-section-heading">
                <Layers size={15} />
                <span>Material & Supply Scope</span>
              </h3>
              <table className="bov-spec-table">
                <tbody>
                  <tr>
                    <td className="bov-lbl">Product Name:</td>
                    <td className="bov-val font-bold">{allocation.ProductName}</td>
                  </tr>
                  <tr>
                    <td className="bov-lbl">Grade / Specification:</td>
                    <td className="bov-val">{allocation.Grade || 'Standard Technical Grade'}</td>
                  </tr>
                  <tr>
                    <td className="bov-lbl">Category:</td>
                    <td className="bov-val">{allocation.Category || 'Industrial'}</td>
                  </tr>
                  <tr>
                    <td className="bov-lbl">Sourcing Partner:</td>
                    <td className="bov-val" style={{ color: '#0e7c86', fontWeight: '700' }}>
                      {allocation.SourcingPartner || 'Verified Synergy5M Consortium Partner'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Itemized Commercial Pricing Breakdown */}
          <div className="bov-table-section">
            <h3 className="bov-section-heading">
              <span>Itemized Commercial Pricing Breakdown</span>
            </h3>
            <div className="bov-table-responsive">
              <table className="bov-price-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Quantity</th>
                    <th style={{ textAlign: 'right' }}>Unit Rate</th>
                    <th style={{ textAlign: 'right' }}>Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>{allocation.ProductName}</strong>
                      <div className="bov-dim-text">Grade: {allocation.Grade || 'Standard'} • Price Basis: {allocation.PriceBasis || 'FOR Destination'}</div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '700' }}>
                      {allocation.AllocatedQuantity} {allocation.Uom}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      ₹{Number(allocation.OfferedUnitPrice).toLocaleString('en-IN')}/{allocation.Uom}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '700' }}>
                      ₹{Number(allocation.TotalBasicAmount).toLocaleString('en-IN')}
                    </td>
                  </tr>

                  {/* Freight row if applicable */}
                  <tr>
                    <td>
                      <strong>Freight / Transportation</strong>
                      <div className="bov-dim-text">
                        Scope: {allocation.TransportationResponsibility || 'Supplier Scope'} • {allocation.FreightIncluded ? 'Included in Base Price' : 'Extra Freight Applicable'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>{allocation.AllocatedQuantity} {allocation.Uom}</td>
                    <td style={{ textAlign: 'right' }}>
                      {allocation.FreightIncluded ? '₹0' : `₹${allocation.FreightCharges}/${allocation.Uom}`}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {allocation.FreightIncluded ? 'Included' : `₹${(Number(allocation.FreightCharges || 0) * Number(allocation.AllocatedQuantity)).toLocaleString('en-IN')}`}
                    </td>
                  </tr>

                  {/* Taxes row */}
                  <tr>
                    <td>
                      <strong>Applicable GST ({allocation.GstRate || '18%'})</strong>
                      <div className="bov-dim-text">Direct tax invoice from supplier</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>-</td>
                    <td style={{ textAlign: 'right' }}>{allocation.GstRate || '18%'}</td>
                    <td style={{ textAlign: 'right' }}>
                      ₹{Number(allocation.GstAmount).toLocaleString('en-IN')}
                    </td>
                  </tr>

                  {/* Landed Grand Total */}
                  <tr className="bov-total-row">
                    <td colSpan={3}>
                      <span className="bov-grand-title">Total Landed Commercial Value (Direct Payable to Supplier):</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="bov-grand-price">
                        {allocation.Currency === 'USD' ? '$' : '₹'}{Number(allocation.TotalEstimatedValue).toLocaleString('en-IN')}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Logistics & Payment Terms */}
          <div className="bov-grid-2">
            <div className="bov-card-section">
              <h3 className="bov-section-heading">
                <Calendar size={15} />
                <span>Logistics & Delivery Schedule</span>
              </h3>
              <ul className="bov-terms-list">
                <li>
                  <strong>Turnaround / Lead Time:</strong> {allocation.DeliveryLeadTimeDays ? `${allocation.DeliveryLeadTimeDays} Days` : '7-14 Days'} from PO issuance.
                </li>
                {allocation.ExpectedDispatchDate && (
                  <li>
                    <strong>Expected Dispatch Window:</strong> {new Date(allocation.ExpectedDispatchDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </li>
                )}
                {allocation.ExpectedDeliveryDate && (
                  <li>
                    <strong>Expected Delivery Arrival:</strong> {new Date(allocation.ExpectedDeliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </li>
                )}
                <li>
                  <strong>Consignment Logistics:</strong> Dispatched directly to buyer's destination plant: <b>{allocation.DeliveryLocation}</b>.
                </li>
              </ul>
            </div>

            <div className="bov-card-section">
              <h3 className="bov-section-heading">
                <Info size={15} />
                <span>Commercial Settlement Terms</span>
              </h3>
              <ul className="bov-terms-list">
                <li>
                  <strong>Payment Structure:</strong> {allocation.SupplierPaymentTerms || 'Standard Commercial Terms'}.
                </li>
                <li>
                  <strong>Advance Deposit:</strong> {allocation.AdvancePaymentPercentage || 0}% payable directly to supplier upon PO confirmation.
                </li>
                <li>
                  <strong>Credit Period:</strong> {allocation.CreditPeriodDays ? `${allocation.CreditPeriodDays} Days` : 'Against Delivery / BL'}.
                </li>
                <li>
                  <strong>Direct Invoicing:</strong> Supplier will invoice {allocation.BuyerCompanyName} directly with GST input tax credit.
                </li>
              </ul>
            </div>
          </div>

          {/* Action Bar (Hidden in Print) */}
          <div className="bov-action-bar no-print">
            {isAccepted ? (
              <div className="bov-status-confirmed-box">
                <CheckCircle2 size={22} className="text-emerald-600" />
                <div>
                  <h4>Offer Accepted by Buyer</h4>
                  <p>
                    Thank you! Your allocation acceptance was recorded on {allocation.BuyerAcceptedAt ? new Date(allocation.BuyerAcceptedAt).toLocaleDateString('en-IN') : 'recently'}. Please proceed to issue your company Purchase Order (PO).
                  </p>
                </div>
              </div>
            ) : isDeclined ? (
              <div className="bov-status-declined-box">
                <XCircle size={22} className="text-rose-600" />
                <div>
                  <h4>Offer Declined</h4>
                  <p>You have opted out of this consortium allocation round.</p>
                </div>
              </div>
            ) : (
              <div className="bov-cta-group">
                <button
                  type="button"
                  className="bov-btn-accept"
                  onClick={() => {
                    setBuyerRemarks('');
                    setResponseModal('accept');
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>Accept Allocation & Confirm Order</span>
                </button>

                <button
                  type="button"
                  className="bov-btn-decline"
                  onClick={() => {
                    setBuyerRemarks('');
                    setResponseModal('decline');
                  }}
                >
                  <XCircle size={15} />
                  <span>Decline Offer</span>
                </button>
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="bov-doc-footer">
            <p>
              Synergy5M LLP acts as an aggregate demand facilitator. All purchase contracts and payments are direct between buyer and supplier.
            </p>
            <p className="bov-footer-url">https://synergy5m.com/</p>
          </div>
        </div>
      </main>

      {/* Confirmation Modal */}
      {responseModal && (
        <div className="bov-modal-backdrop" onClick={() => !actionLoading && setResponseModal(null)}>
          <div className="bov-modal-card" onClick={e => e.stopPropagation()}>
            <div className={`bov-modal-header ${responseModal === 'accept' ? 'accept' : 'decline'}`}>
              <h3>
                {responseModal === 'accept' ? 'Confirm Allocation Acceptance' : 'Decline Consortium Offer'}
              </h3>
            </div>

            <div className="bov-modal-body">
              {responseModal === 'accept' ? (
                <>
                  <p>
                    You are confirming your allocation of <strong>{allocation.AllocatedQuantity} {allocation.Uom}</strong> for <strong>{allocation.ProductName}</strong> at <strong>₹{Number(calculatedLandedUnitRate).toLocaleString('en-IN')}/{allocation.Uom}</strong>.
                  </p>
                  <p style={{ fontSize: '12.5px', color: '#64748b' }}>
                    Next Step: You will be asked to upload / issue your company Purchase Order (PO) directly to the supplier under the confirmed terms.
                  </p>
                </>
              ) : (
                <p>
                  Are you sure you want to decline this consortium offer? Your reserved quota will be released back to the consortium pool.
                </p>
              )}

              <div style={{ marginTop: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  {responseModal === 'accept' ? 'Delivery Notes / Plant Instructions (Optional):' : 'Reason for Declining (Optional):'}
                </label>
                <textarea
                  rows={3}
                  value={buyerRemarks}
                  onChange={e => setBuyerRemarks(e.target.value)}
                  placeholder={responseModal === 'accept' ? 'e.g. Please arrange delivery between 9 AM and 5 PM at Gate No. 2.' : 'e.g. Requirement delayed or sourced elsewhere.'}
                  className="bov-textarea"
                />
              </div>
            </div>

            <div className="bov-modal-footer">
              <button
                type="button"
                className="bov-btn-modal-cancel"
                disabled={actionLoading}
                onClick={() => setResponseModal(null)}
              >
                Cancel
              </button>

              <button
                type="button"
                className={responseModal === 'accept' ? 'bov-btn-modal-confirm' : 'bov-btn-modal-decline'}
                disabled={actionLoading}
                onClick={() => handleRespond(responseModal)}
              >
                {actionLoading ? 'Submitting...' : responseModal === 'accept' ? 'Yes, Confirm & Accept' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
