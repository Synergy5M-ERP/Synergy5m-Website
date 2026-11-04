import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import {
  Printer,
  ArrowLeft,
  CheckCircle2,
  Building,
  Mail,
  Phone,
  Package,
  MapPin,
  ShieldCheck,
  AlertCircle,

} from 'lucide-react';
import './SupplyOfferViewPage.css';

export default function SupplyOfferViewPage() {
  const [searchParams] = useSearchParams();
  const params = useParams();
  const navigate = useNavigate();

  const offerRef = searchParams.get('offerRef') || params.offerRef || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quote, setQuote] = useState(null);


  useEffect(() => {
    if (!offerRef) {
      setError('No Offer Reference provided in the URL. Please provide a valid reference.');
      setLoading(false);
      return;
    }

    const fetchQuote = async () => {
      setLoading(false);
      try {
        const res = await fetch(`/api/supply-offer/view/${encodeURIComponent(offerRef)}`);
        const json = await res.json();
        if (json.success && json.data) {
          setQuote(json.data);
        } else {
          setError(json.message || 'Quotation not found for this reference.');
        }
      } catch (err) {
        setError('Network error while retrieving quotation details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchQuote();
  }, [offerRef]);



  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="sov-loading-container">
        <div className="sov-spinner"></div>
        <h2>Loading Official Quotation Document...</h2>
        <p>Retrieving verified supply offer details for reference: {offerRef}</p>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="sov-error-container">
        <div className="sov-error-card">
          <AlertCircle size={48} className="sov-error-icon" />
          <h2>Unable to Load Quotation</h2>
          <p>{error || 'Quotation record could not be found.'}</p>
          <div className="sov-error-actions">
            <button
              type="button"
              className="sov-btn sov-btn-primary"
              onClick={() => navigate('/supply-offers')}
            >
              <ArrowLeft size={16} /> View All Dispatched RFQs
            </button>
            <button
              type="button"
              className="sov-btn sov-btn-secondary"
              onClick={() => navigate('/submittedoffer')}
            >
              View Submitted Offers
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Parse allocations JSON if available
  let allocations = [];
  try {
    if (quote.EnquiryAllocationsJson) {
      allocations = typeof quote.EnquiryAllocationsJson === 'string'
        ? JSON.parse(quote.EnquiryAllocationsJson)
        : quote.EnquiryAllocationsJson;
    }
  } catch (e) {
    allocations = [];
  }

  const currencySymbol = quote.Currency === 'USD' ? '$' : (quote.Currency === 'EUR' ? '€' : (quote.Currency === 'AED' ? 'AED ' : '₹'));
  const effectiveUnitRate = Number(quote.OfferedUnitPrice || 0) + Number(quote.OtherCharges || 0);

  return (
    <div className="sov-page">
      {/* Non-Printable Top Action Toolbar */}
      <header className="sov-action-bar no-print">
        <div className="sov-action-bar-inner">
          <div className="sov-action-left">
            <button
              type="button"
              className="sov-btn sov-btn-ghost"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <div className="sov-doc-title">
              <span>Official Quotation Document</span>
              <strong className="sov-ref-badge">{quote.OfferReference}</strong>
            </div>
          </div>

          <div className="sov-action-right">
            {/* <button
              type="button"
              className={`sov-btn sov-btn-secondary ${copied ? 'copied' : ''}`}
              onClick={handleCopyLink}
              title="Copy shareable link to this quotation"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
            </button> */}

            <button
              type="button"
              className="sov-btn sov-btn-primary"
              onClick={handlePrint}
              title="Print or Save as PDF"
            >
              <Printer size={16} />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Quotation Document Sheet (A4 Styled Format) */}
      <main className="sov-doc-wrapper">
        <article className="sov-sheet" id="quotation-print-sheet">

          {/* Header & Brand Letterhead */}
          <div className="sov-sheet-header">
            <div className="sov-brand-row">
              <div className="sov-brand-info">
                <div className="sov-brand-logo-badge">S5</div>
                <div>
                  <h1 className="sov-company-name">Synergy5M LLP</h1>
                  <p className="sov-company-sub">
                    CollectiveBuy Consortium • Verified Industrial Sourcing & Demand Aggregation
                  </p>
                  <p className="sov-company-contact">
                    Pune, Maharashtra, India • sales@synergy5m.com • www.synergy5m.com
                  </p>
                </div>
              </div>

              <div className="sov-doc-stamp-box">
                <div className="sov-stamp-title">OFFICIAL SUPPLY OFFER</div>
                <div className="sov-stamp-ref">{quote.OfferReference}</div>
                <div className="sov-verified-badge">
                  <CheckCircle2 size={12} /> VERIFIED QUOTATION
                </div>
              </div>
            </div>
          </div>

          {/* Reference & Metadata Strip */}
          <div className="sov-meta-strip">
            <div className="sov-meta-col">
              <span className="sov-meta-label">Vendor Quotation No</span>
              <strong className="sov-meta-val mono">{quote.VendorQuotationNo || 'N/A'}</strong>
            </div>
            <div className="sov-meta-col">
              <span className="sov-meta-label">RFQ Reference</span>
              <strong className="sov-meta-val mono orange">{quote.RfqReference || 'N/A'}</strong>
            </div>
            <div className="sov-meta-col">
              <span className="sov-meta-label">Quotation Date</span>
              <strong className="sov-meta-val">
                {quote.QuotationDate ? new Date(quote.QuotationDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
              </strong>
            </div>
            <div className="sov-meta-col">
              <span className="sov-meta-label">Offer Validity</span>
              <strong className="sov-meta-val">
                {quote.QuotationValidUntil ? new Date(quote.QuotationValidUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '15 Days'}
              </strong>
            </div>
          </div>

          {/* 2-Column Parties Block */}
          <div className="sov-parties-grid">
            {/* Supplier / Seller */}
            <div className="sov-party-card">
              <div className="sov-party-kicker seller">
                <Building size={13} /> ISSUED BY (SUPPLIER / SELLER)
              </div>
              <h3 className="sov-party-name">{quote.VendorName}</h3>
              <div className="sov-party-field">
                <span className="sov-p-lbl">Contact Person:</span>
                <span className="sov-p-val">{quote.ContactPerson || 'N/A'}</span>
              </div>
              <div className="sov-party-field">
                <span className="sov-p-lbl">Email Address:</span>
                <span className="sov-p-val highlight">
                  <Mail size={12} className="inline-icon" /> {quote.VendorEmail}
                </span>
              </div>
              {quote.MobileNumber && (
                <div className="sov-party-field">
                  <span className="sov-p-lbl">Contact Mobile:</span>
                  <span className="sov-p-val">
                    <Phone size={12} className="inline-icon" /> {quote.MobileNumber}
                  </span>
                </div>
              )}
            </div>

            {/* Buyer Consortium / Destination */}
            <div className="sov-party-card">
              <div className="sov-party-kicker buyer">
                <Package size={13} /> ISSUED TO (BUYER CONSORTIUM)
              </div>
              <h3 className="sov-party-name">Synergy5M CollectiveBuy Consortium</h3>
              <div className="sov-party-field">
                <span className="sov-p-lbl">Product Sourcing:</span>
                <span className="sov-p-val">{quote.ProductName}</span>
              </div>
              <div className="sov-party-field">
                <span className="sov-p-lbl">Consortium RFQ:</span>
                <span className="sov-p-val mono">{quote.RfqReference}</span>
              </div>
              <div className="sov-party-field">
                <span className="sov-p-lbl">Delivery Destination:</span>
                <span className="sov-p-val">
                  <MapPin size={12} className="inline-icon" /> {quote.Destination || 'As specified in RFQ'}
                </span>
              </div>
            </div>
          </div>

          {/* Product Specifications & Supply Scope */}
          <div className="sov-section">
            <h4 className="sov-section-title">1. Product Specifications & Supply Capacity</h4>
            <table className="sov-data-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Category / Industry</th>
                  <th>Grade / Specification</th>
                  <th>Total Required Demand</th>
                  <th>Offered Supply Qty</th>
                  <th>Supply Mode</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>{quote.ProductName}</strong></td>
                  <td>{quote.Category || 'Industrial'}</td>
                  <td>{quote.Grade || 'Standard Grade'}</td>
                  <td>{quote.TotalRequiredDemand} {quote.Uom || 'MT'}</td>
                  <td className="highlight-qty">
                    <strong>{quote.OfferedQuantity} {quote.Uom || 'MT'}</strong>
                  </td>
                  <td>
                    {quote.CanSupplyFull ? (
                      <span className="sov-tag-full">Full Aggregated Demand</span>
                    ) : (
                      <span className="sov-tag-partial">Partial Allocation</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="sov-sub-meta-grid">
              <div>
                <span className="sov-sm-lbl">MOQ:</span>
                <strong>{quote.Moq || '1'} {quote.Uom || 'MT'}</strong>
              </div>
              <div>
                <span className="sov-sm-lbl">Max Supply Capacity:</span>
                <strong>{quote.MaxSupplyCapacity ? `${quote.MaxSupplyCapacity} ${quote.Uom || 'MT'}` : 'As Offered'}</strong>
              </div>
              <div>
                <span className="sov-sm-lbl">Product Availability:</span>
                <strong>{quote.ProductAvailability || 'Ready Stock'}</strong>
              </div>
              <div>
                <span className="sov-sm-lbl">Packaging Type:</span>
                <strong>{quote.PackagingType || 'Standard Packaging'}</strong>
              </div>
            </div>
          </div>

          {/* Commercial Pricing Breakdown Table */}
          <div className="sov-section">
            <h4 className="sov-section-title">2. Commercial Valuation Breakdown</h4>
            <table className="sov-pricing-table">
              <thead>
                <tr>
                  <th>Item / Component Description</th>
                  <th style={{ textAlign: 'center' }}>Price Basis</th>
                  <th style={{ textAlign: 'right' }}>Unit Rate ({quote.Uom || 'MT'})</th>
                  <th style={{ textAlign: 'right' }}>Total Value ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>Base Unit Price</strong>
                    <div className="sov-td-desc">Agreed per-unit material supply quotation</div>
                  </td>
                  <td style={{ textAlign: 'center' }}>{quote.PriceBasis || 'FOR Destination'}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                    {currencySymbol}{Number(quote.OfferedUnitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>
                    {currencySymbol}{Number(quote.TotalBasicAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>

                {Number(quote.OtherCharges) > 0 && (
                  <tr>
                    <td>
                      <strong>Platform Fee (Per Unit)</strong>
                      <div className="sov-td-desc">Handling, documentation, or fixed ancillary cost added to base unit rate</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>Per Unit</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                      {currencySymbol}{Number(quote.OtherCharges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right', color: '#64748b' }}>
                      Effective: {currencySymbol}{effectiveUnitRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}/{quote.Uom || 'MT'}
                    </td>
                  </tr>
                )}

                <tr>
                  <td>
                    <strong>GST / Applicable Indirect Tax</strong>
                    <div className="sov-td-desc">Tax Rate: {quote.GstRate || '18%'}</div>
                  </td>
                  <td style={{ textAlign: 'center' }}>{quote.GstRate || '18%'}</td>
                  <td style={{ textAlign: 'right', color: '#64748b' }}>-</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                    {currencySymbol}{Number(quote.GstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>

                <tr>
                  <td>
                    <strong>Freight & Logistics Scope</strong>
                    <div className="sov-td-desc">
                      {quote.FreightIncluded
                        ? 'Freight Included in Unit Price (No extra freight charged)'
                        : (Number(quote.FreightCharges) > 0 ? 'Separate freight charge' : 'To be billed extra at actuals')}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>{quote.FreightIncluded ? 'Included' : 'Extra'}</td>
                  <td style={{ textAlign: 'right', color: '#64748b' }}>-</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                    {quote.FreightIncluded ? '₹0.00 (Included)' : `${currencySymbol}${Number(quote.FreightCharges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                  </td>
                </tr>

                {/* Grand Total Row */}
                <tr className="sov-grand-total-row">
                  <td colSpan="2">
                    <span className="sov-gt-label">GRAND ESTIMATED QUOTATION VALUE</span>
                    <div className="sov-gt-sub">
                      All inclusive estimated commercial value for {quote.OfferedQuantity} {quote.Uom || 'MT'}
                    </div>
                  </td>
                  <td colSpan="2" style={{ textAlign: 'right' }}>
                    <div className="sov-gt-amount">
                      {currencySymbol}{Number(quote.EstimatedTotalValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Buyer Allocations Breakdown (If partial allocation) */}
          {allocations.length > 0 && (
            <div className="sov-section">
              <h4 className="sov-section-title">3. Buyer Enquiries Allocation Breakdown</h4>
              <table className="sov-data-table">
                <thead>
                  <tr>
                    <th>Buyer Enq Ref</th>
                    <th>Buyer Name / Destination</th>
                    <th>Required Qty</th>
                    <th>Allocated Supply Qty</th>
                    <th>Scheduled Delivery</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((alloc, idx) => (
                    <tr key={idx}>
                      <td className="mono">{alloc.enquiryRef || `ENQ-${idx + 1}`}</td>
                      <td>{'Verified  Buyer From '} ({alloc.destination || 'Standard Dock'})</td>
                      <td>{alloc.requiredQty} {quote.Uom || 'MT'}</td>
                      <td className="highlight-qty"><strong>{alloc.allocatedQty} {quote.Uom || 'MT'}</strong></td>
                      <td>{alloc.targetDeliveryDate || 'As per schedule'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Logistics & Commercial Execution Terms */}
          <div className="sov-section">
            <h4 className="sov-section-title">4. Logistics & Commercial Terms of Supply</h4>
            <div className="sov-terms-grid">
              <div className="sov-term-item">
                <span className="sov-t-lbl">Delivery Lead Time:</span>
                <span className="sov-t-val">{quote.DeliveryLeadTimeDays || '7-14'} Days from PO Confirmation</span>
              </div>
              <div className="sov-term-item">
                <span className="sov-t-lbl">Expected Dispatch Date:</span>
                <span className="sov-t-val">
                  {quote.ExpectedDispatchDate ? new Date(quote.ExpectedDispatchDate).toLocaleDateString('en-IN') : 'As mutually scheduled'}
                </span>
              </div>
              <div className="sov-term-item">
                <span className="sov-t-lbl">Expected Delivery Date:</span>
                <span className="sov-t-val">
                  {quote.ExpectedDeliveryDate ? new Date(quote.ExpectedDeliveryDate).toLocaleDateString('en-IN') : 'As mutually scheduled'}
                </span>
              </div>
              <div className="sov-term-item">
                <span className="sov-t-lbl">Delivery Schedule:</span>
                <span className="sov-t-val">{quote.DeliverySchedule || 'Single'} Consignment</span>
              </div>
              <div className="sov-term-item">
                <span className="sov-t-lbl">Transportation Scope:</span>
                <span className="sov-t-val">{quote.TransportationResponsibility || 'Supplier Scope'}</span>
              </div>
              <div className="sov-term-item">
                <span className="sov-t-lbl">Payment Terms:</span>
                <span className="sov-t-val">{quote.PaymentTerms || '30 Days Net from Delivery'}</span>
              </div>
              {Number(quote.AdvancePaymentPercentage) > 0 && (
                <div className="sov-term-item">
                  <span className="sov-t-lbl">Advance Payment Required:</span>
                  <span className="sov-t-val">{quote.AdvancePaymentPercentage}% Advance</span>
                </div>
              )}
              {Number(quote.CreditPeriodDays) > 0 && (
                <div className="sov-term-item">
                  <span className="sov-t-lbl">Credit Period:</span>
                  <span className="sov-t-val">{quote.CreditPeriodDays} Days Credit</span>
                </div>
              )}
            </div>

            {quote.CommercialRemarks && (
              <div className="sov-remarks-box">
                <span className="sov-rem-title">Supplier Remarks & Notes:</span>
                <p className="sov-rem-text">"{quote.CommercialRemarks}"</p>
              </div>
            )}
          </div>

          {/* Platform Legal Disclaimer & Non-Liability Clause */}
          <div className="sov-disclaimer-box">
            <div className="sov-disclaimer-header">
              <ShieldCheck size={18} />
              <span>SYNERGY 5M PLATFORM LEGAL DECLARATION & NON-LIABILITY TERMS</span>
            </div>
            <p className="sov-disclaimer-body">
              Synergy5M operates strictly and exclusively as a B2B demand aggregation, volume pooling, and technology facilitation platform.
              Synergy5M is not a contracting buyer, seller, reseller, consignee, or financial guarantor of this transaction.
              Synergy5M shall not be responsible or liable under any circumstances for any direct, indirect, special, punitive, or consequential
              financial losses, lost profits, delayed payments, commercial disputes, default of contract, product defect, or transportation failures.
              The definitive sale contract, purchase order, tax invoicing, warranties, and financial settlements are concluded solely and directly
              between the verified buyer(s) and the registered supplier.
            </p>
            <div className="sov-disclaimer-ack">
              <CheckCircle2 size={14} />
              <span>Supplier Declaration Confirmed & Digitally Acknowledged upon submission on {new Date(quote.CreatedAt).toLocaleDateString('en-IN')}.</span>
            </div>
          </div>

          {/* Official Signature & Digital Registry Footer */}
          <div className="sov-sheet-footer">
            <div className="sov-audit-stamp">
              <div className="sov-stamp-badge">
                <CheckCircle2 size={16} /> DIGITALLY REGISTERED & VERIFIED
              </div>
              <div className="sov-audit-text">
                Recorded in Synergy5M Consortium Registry • Reference: {quote.OfferReference}
              </div>
            </div>

            <div className="sov-sign-block">
              <div className="sov-sign-line"></div>
              <div className="sov-sign-name">{quote.ContactPerson || quote.VendorName}</div>
              <div className="sov-sign-role">Authorized Supplier Signatory</div>
              <div className="sov-sign-comp">{quote.VendorName}</div>
            </div>
          </div>

        </article>
      </main>
    </div>
  );
}

