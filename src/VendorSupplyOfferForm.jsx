import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  DollarSign,
  Truck,
  CheckCircle2,
  AlertCircle,
  Upload,
  Trash2,
  Plus,
  ArrowRight,
  ShieldCheck,
  Check,
  Layers,
  Printer,
  ChevronRight,
  RefreshCw,
  Eye,
  Send,
  Lock,
  FileSpreadsheet,
  File,
  X
} from 'lucide-react';
import './VendorSupplyOfferForm.css';

// Default / Fallback RFQ context if opened directly without query parameters
const DEFAULT_RFQ_CONTEXT = {
  rfqReference: 'RFQ-CB-2026-0042',
  vendorName: 'KETAN ALONI',
  contactPerson: 'Ketan Aloni',
  email: 'ketan.aloni@example.com',
  mobile: '+91 98220 12345',
  productName: 'Laptop',
  category: 'Industrial Chemicals',
  grade: 'Commercial Grade',
  totalDemand: 84,
  uom: 'MT',
  destination: 'Pune, Maharashtra',
  buyerEnquiries: [
    { enquiryRef: 'CE-3', buyerName: 'SALES', requiredQty: 9, destination: 'Pune' },
    { enquiryRef: 'CE-4', buyerName: 'SALES', requiredQty: 75, destination: 'Pune' }
  ]
};

export default function VendorSupplyOfferForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // -------------------------------------------------------------
  // 1. Initial State Initialization from URL Query Params or Default
  // -------------------------------------------------------------
  const initialRfqRef = searchParams.get('rfq') || DEFAULT_RFQ_CONTEXT.rfqReference;
  const initialProdId = searchParams.get('prodId') || '';
  const initialVendorName = searchParams.get('vendor') || DEFAULT_RFQ_CONTEXT.vendorName;
  const initialEmail = searchParams.get('email') || DEFAULT_RFQ_CONTEXT.email;
  const initialProduct = searchParams.get('product') || DEFAULT_RFQ_CONTEXT.productName;
  const initialCategory = searchParams.get('category') || DEFAULT_RFQ_CONTEXT.category;
  const initialGrade = searchParams.get('grade') || DEFAULT_RFQ_CONTEXT.grade;
  const initialDemand = Number(searchParams.get('demand')) || DEFAULT_RFQ_CONTEXT.totalDemand;
  const initialUom = searchParams.get('uom') || DEFAULT_RFQ_CONTEXT.uom;
  const initialDest = searchParams.get('dest') || DEFAULT_RFQ_CONTEXT.destination;

  // RFQ Read-Only Details
  const [rfqDetails, setRfqDetails] = useState({
    rfqReference: initialRfqRef,
    opportunityId: initialProdId,
    vendorName: initialVendorName,
    productName: initialProduct,
    category: initialCategory,
    grade: initialGrade,
    totalDemand: initialDemand,
    uom: initialUom,
    destination: initialDest,
    buyerEnquiries: DEFAULT_RFQ_CONTEXT.buyerEnquiries
  });

  // Today's date in YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const defaultValidDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  }, []);

  // -------------------------------------------------------------
  // 2. Vendor Quotation & Offer Form State
  // -------------------------------------------------------------
  const [formData, setFormData] = useState({
    // Section 2 - Quotation Info
    vendorQuotationNo: `QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    quotationDate: todayStr,
    quotationValidUntil: defaultValidDate,
    contactPerson: initialVendorName || DEFAULT_RFQ_CONTEXT.contactPerson,
    emailAddress: initialEmail || DEFAULT_RFQ_CONTEXT.email,
    mobileNumber: DEFAULT_RFQ_CONTEXT.mobile,

    // Section 3 - Supply Offer Details
    canSupplyFull: true,
    offeredQuantity: initialDemand,
    moq: Math.min(10, initialDemand),
    maxSupplyCapacity: initialDemand * 1.5,
    offeredUnitPrice: '',
    currency: 'INR',
    priceBasis: 'FOR Destination',
    gstRate: '18%',
    freightIncluded: true,
    freightCharges: 0,
    otherCharges: 0,
    packagingType: 'Standard 25kg HDPE Bags',
    productAvailability: 'Ready Stock',

    // Section 4 - Allocations across buyer enquiries
    allocations: DEFAULT_RFQ_CONTEXT.buyerEnquiries.map((enq) => ({
      enquiryRef: enq.enquiryRef,
      buyerName: enq.buyerName,
      requiredQty: enq.requiredQty,
      offeredQty: enq.requiredQty,
      destination: enq.destination
    })),

    // Section 5 - Delivery & Payment Terms
    deliveryLeadTime: '7',
    expectedDispatchDate: todayStr,
    expectedDeliveryDate: defaultValidDate,
    deliverySchedule: 'Single', // 'Single' or 'Partial'
    staggeredSchedule: [
      { id: 1, sequence: 'Consignment #1', quantity: initialDemand, dispatchDate: todayStr, deliveryDate: defaultValidDate }
    ],
    transportationResponsibility: 'Vendor',
    paymentTerms: '30 Days Credit',
    advancePaymentPercentage: 0,
    creditPeriodDays: 30,

    // Section 6 - Attachments
    attachments: [],

    // Section 7 - Remarks & Declarations
    commercialRemarks: '',
    specialConditions: '',
    termsConfirmed: false,
    declarationConfirmed: false
  });

  // UI Flow States
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submittedOffer, setSubmittedOffer] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // Show temporary toast notification
  const triggerToast = (msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // -------------------------------------------------------------
  // 3. Fetch live RFQ data if opportunity ID is provided
  // -------------------------------------------------------------
  useEffect(() => {
    if (initialProdId) {
      setLoadingData(true);
      fetch(`/api/collective-buying/opportunity-data/${encodeURIComponent(initialProdId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.success && data.opportunity) {
            const opp = data.opportunity;
            const enquiries = Array.isArray(data.buyerEnquiries) && data.buyerEnquiries.length > 0
              ? data.buyerEnquiries.map((e, idx) => ({
                enquiryRef: e.enquiryReference || e.id || `CE-${idx + 1}`,
                buyerName: e.buyerName || e.companyName || 'Verified Buyer',
                requiredQty: Number(e.requiredQuantity || e.quantity || 0),
                destination: e.deliveryLocation || e.destination || opp.destination || 'India'
              }))
              : DEFAULT_RFQ_CONTEXT.buyerEnquiries;

            const computedTotal = enquiries.reduce((acc, curr) => acc + curr.requiredQty, 0);

            setRfqDetails((prev) => ({
              ...prev,
              productName: opp.productName || prev.productName,
              category: opp.category || prev.category,
              grade: opp.grade || opp.gradeVariant || prev.grade,
              totalDemand: computedTotal || opp.totalDemand || prev.totalDemand,
              uom: opp.uom || prev.uom,
              destination: opp.destination || prev.destination,
              buyerEnquiries: enquiries
            }));

            // Sync form allocations
            setFormData((prev) => ({
              ...prev,
              offeredQuantity: computedTotal || prev.offeredQuantity,
              allocations: enquiries.map((enq) => ({
                enquiryRef: enq.enquiryRef,
                buyerName: enq.buyerName,
                requiredQty: enq.requiredQty,
                offeredQty: enq.requiredQty,
                destination: enq.destination
              })),
              staggeredSchedule: [
                {
                  id: 1,
                  sequence: 'Consignment #1',
                  quantity: computedTotal || prev.offeredQuantity,
                  dispatchDate: todayStr,
                  deliveryDate: defaultValidDate
                }
              ]
            }));
          }
        })
        .catch(() => {
          // Keep defaults smoothly
        })
        .finally(() => setLoadingData(false));
    }
  }, [initialProdId, todayStr, defaultValidDate]);

  // Restore Draft from localStorage if available
  useEffect(() => {
    try {
      const draftKey = `syn_erp_supply_offer_draft_${initialRfqRef}`;
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          setFormData((prev) => ({ ...prev, ...parsed }));
          triggerToast('Draft restored from previous session.', 'info');
        }
      }
    } catch (e) {
      // Ignore
    }
  }, [initialRfqRef]);

  // -------------------------------------------------------------
  // 4. Calculations: Basic, GST, Total Value & Shortfalls
  // -------------------------------------------------------------
  const calculations = useMemo(() => {
    const qty = Math.max(0, parseFloat(formData.offeredQuantity) || 0);
    const unitPrice = Math.max(0, parseFloat(formData.offeredUnitPrice) || 0);
    const basicAmount = qty * unitPrice;

    // Freight calculation
    let freightAmt = 0;
    if (!formData.freightIncluded) {
      freightAmt = Math.max(0, parseFloat(formData.freightCharges) || 0);
    }

    const otherChargesAmt = Math.max(0, parseFloat(formData.otherCharges) || 0);
    const subtotal = basicAmount + freightAmt + otherChargesAmt;

    // GST percentage
    let gstPct = 0;
    if (formData.gstRate.includes('18')) gstPct = 0.18;
    else if (formData.gstRate.includes('12')) gstPct = 0.12;
    else if (formData.gstRate.includes('5')) gstPct = 0.05;
    else if (formData.gstRate.includes('28')) gstPct = 0.28;
    else gstPct = 0;

    const gstAmount = subtotal * gstPct;
    const grandTotal = subtotal + gstAmount;

    // Allocation totals
    const totalAllocated = formData.allocations.reduce((sum, item) => sum + (parseFloat(item.offeredQty) || 0), 0);
    const shortfall = Math.max(0, rfqDetails.totalDemand - qty);
    const allocationDiff = qty - totalAllocated;

    // Currency symbol
    let currencySymbol = '₹';
    if (formData.currency === 'USD') currencySymbol = '$';
    else if (formData.currency === 'EUR') currencySymbol = '€';
    else if (formData.currency === 'AED') currencySymbol = 'د.إ';

    return {
      qty,
      unitPrice,
      basicAmount,
      freightAmt,
      otherChargesAmt,
      subtotal,
      gstPct: gstPct * 100,
      gstAmount,
      grandTotal,
      totalAllocated,
      shortfall,
      allocationDiff,
      currencySymbol
    };
  }, [
    formData.offeredQuantity,
    formData.offeredUnitPrice,
    formData.freightIncluded,
    formData.freightCharges,
    formData.otherCharges,
    formData.gstRate,
    formData.currency,
    formData.allocations,
    rfqDetails.totalDemand
  ]);

  // Form Progress Completion %
  const formProgress = useMemo(() => {
    let completedSteps = 0;
    const totalSteps = 7;

    // 1. RFQ verified (always 1)
    completedSteps += 1;
    // 2. Vendor Quotation Details
    if (formData.vendorQuotationNo && formData.quotationDate && formData.quotationValidUntil && formData.contactPerson && formData.emailAddress && formData.mobileNumber) {
      completedSteps += 1;
    }
    // 3. Supply Offer Details
    if (formData.offeredQuantity > 0 && formData.offeredUnitPrice > 0 && formData.moq >= 0) {
      completedSteps += 1;
    }
    // 4. Allocation
    if (Math.abs(calculations.allocationDiff) < 0.01 && calculations.totalAllocated > 0) {
      completedSteps += 1;
    }
    // 5. Delivery & Payment Terms
    if (formData.deliveryLeadTime && formData.expectedDispatchDate && formData.paymentTerms) {
      completedSteps += 1;
    }
    // 6. Documents
    if (formData.attachments.length > 0) {
      completedSteps += 1;
    }
    // 7. Remarks & Declarations
    if (formData.termsConfirmed && formData.declarationConfirmed) {
      completedSteps += 1;
    }

    return Math.round((completedSteps / totalSteps) * 100);
  }, [formData, calculations]);

  // -------------------------------------------------------------
  // 5. Change Handlers
  // -------------------------------------------------------------
  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      // If user toggles "Can Supply Full Quantity = Yes", auto-fill demand
      if (field === 'canSupplyFull') {
        if (value === true) {
          updated.offeredQuantity = rfqDetails.totalDemand;
          updated.allocations = rfqDetails.buyerEnquiries.map((e) => ({
            enquiryRef: e.enquiryRef,
            buyerName: e.buyerName,
            requiredQty: e.requiredQty,
            offeredQty: e.requiredQty,
            destination: e.destination
          }));
        }
      }

      return updated;
    });

    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  // Handle individual enquiry allocation changes
  const handleAllocationChange = (index, value) => {
    const numericVal = parseFloat(value) || 0;
    setFormData((prev) => {
      const updatedAllocations = [...prev.allocations];
      updatedAllocations[index] = {
        ...updatedAllocations[index],
        offeredQty: numericVal
      };
      return { ...prev, allocations: updatedAllocations };
    });
  };

  // Auto-distribute offered quantity proportionally across enquiries
  const handleAutoDistributeAllocations = () => {
    const totalReq = rfqDetails.totalDemand || 1;
    const availableOffered = parseFloat(formData.offeredQuantity) || 0;

    setFormData((prev) => {
      const updatedAllocations = prev.allocations.map((item) => {
        const ratio = item.requiredQty / totalReq;
        const allocated = Math.round(availableOffered * ratio * 100) / 100;
        return { ...item, offeredQty: allocated };
      });
      return { ...prev, allocations: updatedAllocations };
    });

    triggerToast('Allocations distributed proportionally.', 'info');
  };

  // Staggered Delivery Schedule Handlers
  const handleAddScheduleRow = () => {
    setFormData((prev) => ({
      ...prev,
      staggeredSchedule: [
        ...prev.staggeredSchedule,
        {
          id: Date.now(),
          sequence: `Consignment #${prev.staggeredSchedule.length + 1}`,
          quantity: 0,
          dispatchDate: todayStr,
          deliveryDate: defaultValidDate
        }
      ]
    }));
  };

  const handleRemoveScheduleRow = (id) => {
    setFormData((prev) => {
      if (prev.staggeredSchedule.length <= 1) return prev;
      return {
        ...prev,
        staggeredSchedule: prev.staggeredSchedule.filter((row) => row.id !== id)
      };
    });
  };

  const handleScheduleChange = (id, field, value) => {
    setFormData((prev) => ({
      ...prev,
      staggeredSchedule: prev.staggeredSchedule.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    }));
  };

  // File Upload Simulator
  const handleFileUpload = (e, docCategory) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const newAttachments = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
      type: file.type || 'application/octet-stream',
      category: docCategory,
      uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));

    setFormData((prev) => ({
      ...prev,
      attachments: [...prev.attachments, ...newAttachments]
    }));

    triggerToast(`Attached ${files.length} document${files.length > 1 ? 's' : ''}.`);
    e.target.value = '';
  };

  const handleRemoveAttachment = (id) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((item) => item.id !== id)
    }));
  };

  // -------------------------------------------------------------
  // 6. Save as Draft
  // -------------------------------------------------------------
  const handleSaveDraft = () => {
    try {
      const draftKey = `syn_erp_supply_offer_draft_${rfqDetails.rfqReference}`;
      localStorage.setItem(draftKey, JSON.stringify(formData));
      triggerToast('Quotation offer draft saved to your local browser storage.', 'success');
    } catch (e) {
      triggerToast('Could not save draft. Local storage may be restricted.', 'error');
    }
  };

  // -------------------------------------------------------------
  // 7. Validation
  // -------------------------------------------------------------
  const validateForm = () => {
    const errors = {};

    if (!formData.vendorQuotationNo.trim()) errors.vendorQuotationNo = 'Quotation Number is required.';
    if (!formData.quotationDate) errors.quotationDate = 'Quotation Date is required.';
    if (!formData.quotationValidUntil) errors.quotationValidUntil = 'Validity Date is required.';
    if (formData.quotationValidUntil < formData.quotationDate) {
      errors.quotationValidUntil = 'Quotation validity cannot be earlier than quotation date.';
    }
    if (!formData.contactPerson.trim()) errors.contactPerson = 'Contact Person is required.';
    if (!formData.emailAddress.trim() || !formData.emailAddress.includes('@')) {
      errors.emailAddress = 'Valid Email Address is required.';
    }
    if (!formData.mobileNumber.trim()) errors.mobileNumber = 'Mobile Number is required.';

    const offeredQtyNum = parseFloat(formData.offeredQuantity);
    if (!offeredQtyNum || offeredQtyNum <= 0) errors.offeredQuantity = 'Offered quantity must be greater than zero.';
    if (formData.canSupplyFull && offeredQtyNum < rfqDetails.totalDemand) {
      errors.offeredQuantity = `Full supply requires covering ${rfqDetails.totalDemand} ${rfqDetails.uom}.`;
    }

    const unitPriceNum = parseFloat(formData.offeredUnitPrice);
    if (!unitPriceNum || unitPriceNum <= 0) errors.offeredUnitPrice = 'Offered unit price must be greater than zero.';

    const moqNum = parseFloat(formData.moq);
    if (isNaN(moqNum) || moqNum < 0) errors.moq = 'MOQ cannot be negative.';

    // Check allocations match offered quantity
    const totalAllocated = formData.allocations.reduce((sum, item) => sum + (parseFloat(item.offeredQty) || 0), 0);
    if (Math.abs(offeredQtyNum - totalAllocated) > 0.05) {
      errors.allocations = `Total enquiry allocation (${totalAllocated.toFixed(2)} ${rfqDetails.uom}) must match the total offered quantity (${offeredQtyNum.toFixed(2)} ${rfqDetails.uom}).`;
    }

    // Required documents check (vendor quotation document recommended)
    if (formData.attachments.length === 0) {
      errors.attachments = 'Please upload at least one quotation or technical verification document.';
    }

    if (!formData.termsConfirmed) errors.termsConfirmed = 'Please confirm acceptance of commercial terms.';
    if (!formData.declarationConfirmed) errors.declarationConfirmed = 'Please declare that the submitted terms are authorized and accurate.';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Trigger submission confirmation
  const handleOpenSubmitModal = (e) => {
    e.preventDefault();
    if (validateForm()) {
      setShowConfirmModal(true);
    } else {
      triggerToast('Please resolve validation errors before submitting.', 'error');
      // Scroll to first error
      window.scrollTo({ top: 400, behavior: 'smooth' });
    }
  };

  // -------------------------------------------------------------
  // 8. Final Submit to Backend Method
  // -------------------------------------------------------------
  const handleFinalSubmit = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);

    const payload = {
      offerReference: `OFFER-CB-${Date.now()}`,
      rfqReference: rfqDetails.rfqReference,
      opportunityId: rfqDetails.opportunityId,
      vendorQuotationNo: formData.vendorQuotationNo,
      quotationDate: formData.quotationDate,
      quotationValidUntil: formData.quotationValidUntil,
      vendorName: rfqDetails.vendorName,
      contactPerson: formData.contactPerson,
      vendorEmail: formData.emailAddress,
      mobileNumber: formData.mobileNumber,
      productName: rfqDetails.productName,
      category: rfqDetails.category,
      grade: rfqDetails.grade,
      totalRequiredDemand: rfqDetails.totalDemand,
      uom: rfqDetails.uom,
      destination: rfqDetails.destination,
      canSupplyFull: formData.canSupplyFull,
      offeredQuantity: calculations.qty,
      moq: parseFloat(formData.moq) || 1,
      maxSupplyCapacity: parseFloat(formData.maxSupplyCapacity) || calculations.qty,
      productAvailability: formData.productAvailability,
      packagingType: formData.packagingType,
      offeredUnitPrice: calculations.unitPrice,
      currency: formData.currency,
      priceBasis: formData.priceBasis,
      gstRate: formData.gstRate,
      gstAmount: calculations.gstAmount,
      freightIncluded: formData.freightIncluded,
      freightCharges: calculations.freightAmt,
      otherCharges: calculations.otherChargesAmt,
      totalBasicAmount: calculations.basicAmount,
      estimatedTotalValue: calculations.grandTotal,
      deliveryLeadTimeDays: parseInt(formData.deliveryLeadTime, 10) || null,
      expectedDispatchDate: formData.expectedDispatchDate,
      expectedDeliveryDate: formData.expectedDeliveryDate,
      deliverySchedule: formData.deliverySchedule,
      transportationResponsibility: formData.transportationResponsibility,
      paymentTerms: formData.paymentTerms,
      advancePaymentPercentage: parseFloat(formData.advancePaymentPercentage) || 0,
      creditPeriodDays: parseInt(formData.creditPeriodDays, 10) || 0,
      enquiryAllocationsJson: formData.allocations,
      staggeredScheduleJson: formData.deliverySchedule === 'Partial' ? formData.staggeredSchedule : [],
      attachmentsJson: formData.attachments.map((a) => ({ name: a.name, size: a.size, category: a.category })),
      commercialRemarks: formData.commercialRemarks,
      specialConditions: formData.specialConditions,
      declarationConfirmed: formData.declarationConfirmed,
      status: 'Quotation Received'
    };

    try {
      const response = await fetch('/api/supply-offer/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Clear draft
        try {
          localStorage.removeItem(`syn_erp_supply_offer_draft_${rfqDetails.rfqReference}`);
        } catch (e) { }

        setSubmittedOffer({
          rfqReference: rfqDetails.rfqReference,
          vendorQuotationNo: formData.vendorQuotationNo,
          submittedAt: new Date().toLocaleString(),
          offeredQuantity: `${calculations.qty} ${rfqDetails.uom}`,
          grandTotalFormatted: `${calculations.currencySymbol} ${calculations.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
          status: 'Quotation Received'
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        triggerToast(data.message || 'Submission failed. Please check database and try again.', 'error');
      }
    } catch (err) {
      triggerToast('Error connecting to database server. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // 9. Render Success Confirmation Screen
  // -------------------------------------------------------------
  if (submittedOffer) {
    return (
      <div className="syn-offer-page">
        <header className="syn-offer-nav">
          <div className="syn-nav-container">
            <div className="syn-brand-block">
              <span className="syn-logo-badge">SYN ERP 10</span>
              <span className="syn-portal-title">CollectiveBuy Procurement</span>
            </div>
            <div className="syn-nav-badge-done">
              <CheckCircle2 size={16} /> Submission Confirmed
            </div>
          </div>
        </header>

        <main className="syn-offer-main">
          <div className="syn-success-card">
            <div className="syn-success-icon-wrap">
              <Check className="syn-check-mark" size={48} />
            </div>

            <h1 className="syn-success-title">Your Supply Offer Has Been Submitted Successfully</h1>
            <p className="syn-success-desc">
              Thank you for submitting your formal commercial quotation to the SYN ERP 10 CollectiveBuy consortium.
              Our procurement committee and buyers have received your offer and will evaluate it against the consolidated requirement.
            </p>

            <div className="syn-receipt-grid">
              <div className="syn-receipt-item">
                <span className="syn-receipt-label">RFQ Reference</span>
                <span className="syn-receipt-value syn-mono">{submittedOffer.rfqReference}</span>
              </div>
              <div className="syn-receipt-item">
                <span className="syn-receipt-label">Vendor Quotation No</span>
                <span className="syn-receipt-value syn-mono">{submittedOffer.vendorQuotationNo}</span>
              </div>
              <div className="syn-receipt-item">
                <span className="syn-receipt-label">Submission Timestamp</span>
                <span className="syn-receipt-value">{submittedOffer.submittedAt}</span>
              </div>
              <div className="syn-receipt-item">
                <span className="syn-receipt-label">Total Offered Quantity</span>
                <span className="syn-receipt-value syn-highlight">{submittedOffer.offeredQuantity}</span>
              </div>
              <div className="syn-receipt-item">
                <span className="syn-receipt-label">Quotation Grand Total</span>
                <span className="syn-receipt-value syn-highlight">{submittedOffer.grandTotalFormatted}</span>
              </div>
              <div className="syn-receipt-item">
                <span className="syn-receipt-label">Quotation Status</span>
                <span className="syn-status-pill syn-status-pill-success">
                  <span className="syn-dot syn-dot-green"></span> {submittedOffer.status}
                </span>
              </div>
            </div>

            <div className="syn-success-actions">
              <button
                type="button"
                className="syn-btn syn-btn-secondary"
                onClick={() => window.print()}
              >
                <Printer size={16} /> Print / Save Confirmation PDF
              </button>
              <button
                type="button"
                className="syn-btn syn-btn-primary"
                onClick={() => navigate('/')}
              >
                Return to  Portal <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 10. Main Form Render
  // -------------------------------------------------------------
  return (
    <div className="syn-offer-page">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`syn-toast syn-toast-${toastMessage.type}`}>
          {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toastMessage.msg}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="syn-offer-nav">
        <div className="syn-nav-container">
          <div className="syn-brand-block">
            <span className="syn-logo-badge">SYN ERP 10</span>
            <div className="syn-brand-titles">
              <span className="syn-portal-title">CollectiveBuy Procurement Portal</span>
              <span className="syn-portal-sub">Industrial Consortium Sourcing & Demand Aggregation</span>
            </div>
          </div>

          <div className="syn-nav-meta">
            {loadingData && (
              <div className="syn-status-tag">
                <RefreshCw size={12} className="syn-spin" />
                Syncing Live RFQ Data...
              </div>
            )}
            <div className="syn-status-tag">
              <span className="syn-dot syn-dot-cyan syn-pulse"></span>
              Awaiting Vendor Offer
            </div>
            <div className="syn-rfq-pill">
              <span className="syn-pill-label">RFQ REF:</span>
              <strong className="syn-mono">{rfqDetails.rfqReference}</strong>
            </div>
          </div>
        </div>
      </header>

      {/* Progress & Title Banner */}
      <section className="syn-hero-banner">
        <div className="syn-banner-content">
          <div className="syn-banner-left">
            <div className="syn-badge-row">
              <span className="syn-corp-badge">Enterprise Module</span>
              <span className="syn-sep">•</span>
              <span className="syn-corp-vendor">Vendor: {rfqDetails.vendorName}</span>
            </div>
            <h1 className="syn-main-heading">Vendor Supply Offer Submission</h1>
            <p className="syn-sub-heading">
              CollectiveBuy – Consolidated RFQ Response & Commercial Quotation
            </p>
          </div>

          <div className="syn-banner-right">
            <div className="syn-progress-card">
              <div className="syn-progress-header">
                <span>Offer Completion</span>
                <strong>{formProgress}%</strong>
              </div>
              <div className="syn-progress-track">
                <div
                  className="syn-progress-bar"
                  style={{ width: `${formProgress}%` }}
                ></div>
              </div>
              <span className="syn-progress-hint">
                {formProgress === 100 ? 'All sections completed and validated' : 'Fill mandatory fields and accept terms'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Workspace Form Container */}
      <main className="syn-offer-main">
        <div className="syn-grid-layout">
          {/* LEFT COLUMN: Main Form Sections */}
          <div className="syn-form-column">

            {/* SECTION 1: RFQ Details (Read Only) */}
            <div className="syn-card syn-card-readonly">
              <div className="syn-card-header">
                <div className="syn-card-title-group">
                  <div className="syn-section-num">1</div>
                  <div>
                    <h2 className="syn-card-title">RFQ Details (Read Only)</h2>
                    <p className="syn-card-desc">
                      Verified consolidated demand information aggregated by SYN ERP 10.
                    </p>
                  </div>
                </div>
                <div className="syn-lock-pill">
                  <Lock size={14} /> Verified Specification
                </div>
              </div>

              <div className="syn-card-body">
                <div className="syn-meta-grid">
                  <div className="syn-meta-item">
                    <span className="syn-label">RFQ Reference</span>
                    <span className="syn-val syn-mono syn-highlight-text">{rfqDetails.rfqReference}</span>
                  </div>
                  <div className="syn-meta-item">
                    <span className="syn-label">Vendor Name</span>
                    <span className="syn-val">{rfqDetails.vendorName}</span>
                  </div>
                  <div className="syn-meta-item">
                    <span className="syn-label">Target Product</span>
                    <span className="syn-val font-semibold">{rfqDetails.productName}</span>
                  </div>
                  <div className="syn-meta-item">
                    <span className="syn-label">Product Category</span>
                    <span className="syn-val">{rfqDetails.category}</span>
                  </div>
                  <div className="syn-meta-item">
                    <span className="syn-label">Grade / Specification</span>
                    <span className="syn-val">{rfqDetails.grade}</span>
                  </div>
                  <div className="syn-meta-item">
                    <span className="syn-label">Total Aggregated Demand</span>
                    <span className="syn-val syn-demand-val">
                      {rfqDetails.totalDemand} {rfqDetails.uom}
                    </span>
                  </div>
                  <div className="syn-meta-item">
                    <span className="syn-label">Delivery Destination</span>
                    <span className="syn-val">{rfqDetails.destination}</span>
                  </div>
                  <div className="syn-meta-item">
                    <span className="syn-label">Active Buyer Enquiries</span>
                    <span className="syn-val font-semibold">
                      {rfqDetails.buyerEnquiries.length} Verified Buyers
                    </span>
                  </div>
                </div>

                {/* Enquiry Breakdown Table */}
                <div className="syn-enquiry-table-wrap">
                  <h3 className="syn-table-heading">
                    <Layers size={16} /> Consolidated Buyer Demand Breakdown
                  </h3>
                  <div className="syn-table-responsive">
                    <table className="syn-table">
                      <thead>
                        <tr>
                          <th>Enquiry Reference</th>
                          <th>Buyer</th>
                          <th className="syn-text-right">Required Quantity</th>
                          <th>Destination</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rfqDetails.buyerEnquiries.map((enq, index) => (
                          <tr key={index}>
                            <td className="syn-mono font-medium">{enq.enquiryRef}</td>
                            <td>{enq.buyerName}</td>
                            <td className="syn-text-right font-semibold">
                              {enq.requiredQty} {rfqDetails.uom}
                            </td>
                            <td>{enq.destination}</td>
                            <td>
                              <span className="syn-status-mini syn-status-mini-cyan">Verified</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="syn-table-total-row">
                          <td colSpan="2">
                            <strong>Total Aggregated Demand</strong>
                          </td>
                          <td className="syn-text-right">
                            <strong className="syn-total-demand-pill">
                              {rfqDetails.totalDemand} {rfqDetails.uom}
                            </strong>
                          </td>
                          <td colSpan="2"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: Vendor Quotation Details */}
            <div className="syn-card">
              <div className="syn-card-header">
                <div className="syn-card-title-group">
                  <div className="syn-section-num">2</div>
                  <div>
                    <h2 className="syn-card-title">Vendor Quotation Details</h2>
                    <p className="syn-card-desc">
                      Enter your official commercial quotation identifier, validity, and contact coordinates.
                    </p>
                  </div>
                </div>
              </div>

              <div className="syn-card-body">
                <div className="syn-field-grid syn-cols-3">
                  <div className="syn-form-group">
                    <label className="syn-input-label">
                      Vendor Quotation Number <span className="syn-required">*</span>
                    </label>
                    <input
                      type="text"
                      className={`syn-input ${formErrors.vendorQuotationNo ? 'syn-input-error' : ''}`}
                      placeholder="e.g. QT-2026-0891"
                      value={formData.vendorQuotationNo}
                      onChange={(e) => handleInputChange('vendorQuotationNo', e.target.value)}
                    />
                    {formErrors.vendorQuotationNo && <span className="syn-err-msg">{formErrors.vendorQuotationNo}</span>}
                  </div>

                  <div className="syn-form-group">
                    <label className="syn-input-label">
                      Quotation Date <span className="syn-required">*</span>
                    </label>
                    <input
                      type="date"
                      className={`syn-input ${formErrors.quotationDate ? 'syn-input-error' : ''}`}
                      value={formData.quotationDate}
                      onChange={(e) => handleInputChange('quotationDate', e.target.value)}
                    />
                    {formErrors.quotationDate && <span className="syn-err-msg">{formErrors.quotationDate}</span>}
                  </div>

                  <div className="syn-form-group">
                    <label className="syn-input-label">
                      Quotation Valid Until <span className="syn-required">*</span>
                    </label>
                    <input
                      type="date"
                      className={`syn-input ${formErrors.quotationValidUntil ? 'syn-input-error' : ''}`}
                      min={formData.quotationDate}
                      value={formData.quotationValidUntil}
                      onChange={(e) => handleInputChange('quotationValidUntil', e.target.value)}
                    />
                    {formErrors.quotationValidUntil && <span className="syn-err-msg">{formErrors.quotationValidUntil}</span>}
                  </div>
                </div>

                <div className="syn-field-grid syn-cols-3">
                  <div className="syn-form-group">
                    <label className="syn-input-label">
                      Contact Person <span className="syn-required">*</span>
                    </label>
                    <input
                      type="text"
                      className={`syn-input ${formErrors.contactPerson ? 'syn-input-error' : ''}`}
                      placeholder="Authorized Representative Name"
                      value={formData.contactPerson}
                      onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                    />
                    {formErrors.contactPerson && <span className="syn-err-msg">{formErrors.contactPerson}</span>}
                  </div>

                  <div className="syn-form-group">
                    <label className="syn-input-label">
                      Email Address <span className="syn-required">*</span>
                    </label>
                    <input
                      type="email"
                      className={`syn-input ${formErrors.emailAddress ? 'syn-input-error' : ''}`}
                      placeholder="commercial@vendor.com"
                      value={formData.emailAddress}
                      onChange={(e) => handleInputChange('emailAddress', e.target.value)}
                    />
                    {formErrors.emailAddress && <span className="syn-err-msg">{formErrors.emailAddress}</span>}
                  </div>

                  <div className="syn-form-group">
                    <label className="syn-input-label">
                      Mobile Number <span className="syn-required">*</span>
                    </label>
                    <input
                      type="tel"
                      className={`syn-input ${formErrors.mobileNumber ? 'syn-input-error' : ''}`}
                      placeholder="+91 98000 00000"
                      value={formData.mobileNumber}
                      onChange={(e) => handleInputChange('mobileNumber', e.target.value)}
                    />
                    {formErrors.mobileNumber && <span className="syn-err-msg">{formErrors.mobileNumber}</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: Supply Offer Details */}
            <div className="syn-card">
              <div className="syn-card-header">
                <div className="syn-card-title-group">
                  <div className="syn-section-num">3</div>
                  <div>
                    <h2 className="syn-card-title">Supply Offer Details</h2>
                    <p className="syn-card-desc">
                      Specify available capacity, unit pricing, taxes, and packaging parameters.
                    </p>
                  </div>
                </div>
              </div>

              <div className="syn-card-body">
                {/* Full Quantity Radio Toggle */}
                <div className="syn-full-toggle-box">
                  <label className="syn-toggle-title">
                    Can Supply Full Aggregated Quantity ({rfqDetails.totalDemand} {rfqDetails.uom})? <span className="syn-required">*</span>
                  </label>
                  <div className="syn-toggle-row">
                    <button
                      type="button"
                      className={`syn-choice-pill ${formData.canSupplyFull ? 'syn-choice-pill-active' : ''}`}
                      onClick={() => handleInputChange('canSupplyFull', true)}
                    >
                      <CheckCircle2 size={16} /> Yes, Can Supply Full {rfqDetails.totalDemand} {rfqDetails.uom}
                    </button>
                    <button
                      type="button"
                      className={`syn-choice-pill ${!formData.canSupplyFull ? 'syn-choice-pill-active' : ''}`}
                      onClick={() => handleInputChange('canSupplyFull', false)}
                    >
                      <AlertCircle size={16} /> No, Partial Quantity Only
                    </button>
                  </div>
                  {!formData.canSupplyFull && (
                    <div className="syn-inline-alert syn-alert-warning">
                      <span>You can allocate custom partial supply quantities against buyer enquiries in Section 4 below.</span>
                    </div>
                  )}
                </div>

                <div className="syn-field-grid syn-cols-4">
                  <div className="syn-form-group">
                    <label className="syn-input-label">
                      Offered Quantity ({rfqDetails.uom}) <span className="syn-required">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      className={`syn-input ${formErrors.offeredQuantity ? 'syn-input-error' : ''}`}
                      disabled={formData.canSupplyFull}
                      value={formData.offeredQuantity}
                      onChange={(e) => handleInputChange('offeredQuantity', e.target.value)}
                    />
                    {formErrors.offeredQuantity && <span className="syn-err-msg">{formErrors.offeredQuantity}</span>}
                  </div>

                  <div className="syn-form-group">
                    <label className="syn-input-label">
                      Minimum Order Quantity – MOQ ({rfqDetails.uom}) <span className="syn-required">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className={`syn-input ${formErrors.moq ? 'syn-input-error' : ''}`}
                      value={formData.moq}
                      onChange={(e) => handleInputChange('moq', e.target.value)}
                    />
                    {formErrors.moq && <span className="syn-err-msg">{formErrors.moq}</span>}
                  </div>

                  <div className="syn-form-group">
                    <label className="syn-input-label">
                      Max Supply Capacity ({rfqDetails.uom})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      className="syn-input"
                      placeholder="e.g. 150"
                      value={formData.maxSupplyCapacity}
                      onChange={(e) => handleInputChange('maxSupplyCapacity', e.target.value)}
                    />
                  </div>

                  <div className="syn-form-group">
                    <label className="syn-input-label">
                      Product Availability <span className="syn-required">*</span>
                    </label>
                    <select
                      className="syn-select"
                      value={formData.productAvailability}
                      onChange={(e) => handleInputChange('productAvailability', e.target.value)}
                    >
                      <option value="Ready Stock">Ready Stock (Immediate Dispatch)</option>
                      <option value="Made to Order">Made to Order (Fresh Production)</option>
                    </select>
                  </div>
                </div>

                {/* Pricing & Commercial Terms */}
                <div className="syn-field-grid syn-cols-4">
                  <div className="syn-form-group">
                    <label className="syn-input-label">
                      Offered Unit Price <span className="syn-required">*</span>
                    </label>
                    <div className="syn-input-addon-wrap">
                      <span className="syn-addon">{calculations.currencySymbol}</span>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        placeholder="e.g. 45000"
                        className={`syn-input syn-input-with-addon ${formErrors.offeredUnitPrice ? 'syn-input-error' : ''}`}
                        value={formData.offeredUnitPrice}
                        onChange={(e) => handleInputChange('offeredUnitPrice', e.target.value)}
                      />
                    </div>
                    {formErrors.offeredUnitPrice && <span className="syn-err-msg">{formErrors.offeredUnitPrice}</span>}
                  </div>

                  <div className="syn-form-group">
                    <label className="syn-input-label">Currency</label>
                    <select
                      className="syn-select"
                      value={formData.currency}
                      onChange={(e) => handleInputChange('currency', e.target.value)}
                    >
                      <option value="INR">INR (₹ - Indian Rupee)</option>
                      <option value="USD">USD ($ - US Dollar)</option>
                      <option value="EUR">EUR (€ - Euro)</option>
                      <option value="AED">AED (د.إ - UAE Dirham)</option>
                    </select>
                  </div>

                  <div className="syn-form-group">
                    <label className="syn-input-label">Price Basis</label>
                    <select
                      className="syn-select"
                      value={formData.priceBasis}
                      onChange={(e) => handleInputChange('priceBasis', e.target.value)}
                    >
                      <option value="FOR Destination">FOR Destination (Delivered)</option>
                      <option value="Ex-Works">Ex-Works (At Vendor Plant)</option>
                      <option value="FOB">FOB (Port of Loading)</option>
                      <option value="CIF">CIF (Cost, Insurance & Freight)</option>
                    </select>
                  </div>

                  <div className="syn-form-group">
                    <label className="syn-input-label">GST Rate</label>
                    <select
                      className="syn-select"
                      value={formData.gstRate}
                      onChange={(e) => handleInputChange('gstRate', e.target.value)}
                    >
                      <option value="18%">18% (Standard Industrial)</option>
                      <option value="12%">12%</option>
                      <option value="5%">5%</option>
                      <option value="28%">28%</option>
                      <option value="0%">0% / Exempt / SEZ</option>
                    </select>
                  </div>
                </div>

                <div className="syn-field-grid syn-cols-3">
                  <div className="syn-form-group">
                    <label className="syn-input-label">Freight Included in Price?</label>
                    <select
                      className="syn-select"
                      value={formData.freightIncluded ? 'yes' : 'no'}
                      onChange={(e) => handleInputChange('freightIncluded', e.target.value === 'yes')}
                    >
                      <option value="yes">Yes, Freight is Included in Unit Price</option>
                      <option value="no">No, Separate Freight Charges Apply</option>
                    </select>
                  </div>

                  {!formData.freightIncluded && (
                    <div className="syn-form-group">
                      <label className="syn-input-label">Freight Charges ({calculations.currencySymbol})</label>
                      <input
                        type="number"
                        min="0"
                        className="syn-input"
                        placeholder="Lump-sum or Total Freight"
                        value={formData.freightCharges}
                        onChange={(e) => handleInputChange('freightCharges', e.target.value)}
                      />
                    </div>
                  )}

                  <div className="syn-form-group">
                    <label className="syn-input-label">Other Charges ({calculations.currencySymbol})</label>
                    <input
                      type="number"
                      min="0"
                      className="syn-input"
                      placeholder="Packaging / Handling / Loading"
                      value={formData.otherCharges}
                      onChange={(e) => handleInputChange('otherCharges', e.target.value)}
                    />
                  </div>

                  <div className="syn-form-group">
                    <label className="syn-input-label">Packaging Type</label>
                    <select
                      className="syn-select"
                      value={formData.packagingType}
                      onChange={(e) => handleInputChange('packagingType', e.target.value)}
                    >
                      <option value="Standard 25kg HDPE Bags">Standard 25kg HDPE Bags</option>
                      <option value="50kg Bags on Pallets">50kg Bags on Pallets</option>
                      <option value="1 MT Jumbo Bag (FIBC)">1 MT Jumbo Bag (FIBC)</option>
                      <option value="200L Steel Drums">200L Steel Drums</option>
                      <option value="Bulk Tanker Dispatch">Bulk Tanker Dispatch</option>
                      <option value="Corrugated Master Cartons">Corrugated Master Cartons</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 4: Enquiry-wise Supply Allocation */}
            <div className="syn-card">
              <div className="syn-card-header">
                <div className="syn-card-title-group">
                  <div className="syn-section-num">4</div>
                  <div>
                    <h2 className="syn-card-title">Enquiry-wise Supply Allocation</h2>
                    <p className="syn-card-desc">
                      Distribute your offered quantity across verified buyer requirements.
                    </p>
                  </div>
                </div>
                {!formData.canSupplyFull && (
                  <button
                    type="button"
                    className="syn-btn-text"
                    onClick={handleAutoDistributeAllocations}
                  >
                    ⚡ Auto-Distribute Pro-Rata
                  </button>
                )}
              </div>

              <div className="syn-card-body">
                <div className="syn-table-responsive">
                  <table className="syn-table syn-table-interactive">
                    <thead>
                      <tr>
                        <th>Buyer Enquiry</th>
                        <th>Buyer Name</th>
                        <th className="syn-text-right">Required Demand</th>
                        <th className="syn-text-right" style={{ width: '180px' }}>
                          Offered Quantity ({rfqDetails.uom}) <span className="syn-required">*</span>
                        </th>
                        <th>Destination</th>
                        <th>Fulfillment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.allocations.map((item, idx) => {
                        const req = item.requiredQty || 0;
                        const off = parseFloat(item.offeredQty) || 0;
                        const pct = req > 0 ? Math.min(100, Math.round((off / req) * 100)) : 100;
                        return (
                          <tr key={item.enquiryRef}>
                            <td className="syn-mono font-medium">{item.enquiryRef}</td>
                            <td>{item.buyerName}</td>
                            <td className="syn-text-right font-medium">
                              {req} {rfqDetails.uom}
                            </td>
                            <td className="syn-text-right">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                max={req * 1.5}
                                disabled={formData.canSupplyFull}
                                className="syn-input syn-input-sm syn-text-right"
                                value={item.offeredQty}
                                onChange={(e) => handleAllocationChange(idx, e.target.value)}
                              />
                            </td>
                            <td>{item.destination}</td>
                            <td>
                              <span
                                className={`syn-status-mini ${pct >= 100
                                  ? 'syn-status-mini-green'
                                  : pct > 0
                                    ? 'syn-status-mini-amber'
                                    : 'syn-status-mini-red'
                                  }`}
                              >
                                {pct}% Covered
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {formErrors.allocations && (
                  <div className="syn-inline-alert syn-alert-error" style={{ marginTop: '12px' }}>
                    <AlertCircle size={16} />
                    <span>{formErrors.allocations}</span>
                  </div>
                )}

                {/* Allocation Summary Metrics Bar */}
                <div className="syn-alloc-metric-bar">
                  <div className="syn-alloc-metric">
                    <span className="syn-metric-label">Total Required Demand</span>
                    <strong className="syn-metric-val">
                      {rfqDetails.totalDemand} {rfqDetails.uom}
                    </strong>
                  </div>
                  <div className="syn-alloc-metric">
                    <span className="syn-metric-label">Total Offered Quantity</span>
                    <strong className="syn-metric-val syn-text-cyan">
                      {calculations.qty} {rfqDetails.uom}
                    </strong>
                  </div>
                  <div className="syn-alloc-metric">
                    <span className="syn-metric-label">Enquiry Allocation Sum</span>
                    <strong
                      className={`syn-metric-val ${Math.abs(calculations.allocationDiff) < 0.01 ? 'syn-text-green' : 'syn-text-amber'
                        }`}
                    >
                      {calculations.totalAllocated.toFixed(2)} {rfqDetails.uom}
                    </strong>
                  </div>
                  <div className="syn-alloc-metric">
                    <span className="syn-metric-label">Demand Shortfall</span>
                    <strong
                      className={`syn-metric-val ${calculations.shortfall > 0 ? 'syn-text-amber' : 'syn-text-green'
                        }`}
                    >
                      {calculations.shortfall > 0 ? `${calculations.shortfall.toFixed(2)} ${rfqDetails.uom}` : 'Zero (Fully Covered)'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 5: Delivery & Payment Terms */}
            <div className="syn-card">
              <div className="syn-card-header">
                <div className="syn-card-title-group">
                  <div className="syn-section-num">5</div>
                  <div>
                    <h2 className="syn-card-title">Delivery & Payment Terms</h2>
                    <p className="syn-card-desc">
                      Configure lead times, consignment dispatch schedules, and commercial payment conditions.
                    </p>
                  </div>
                </div>
              </div>

              <div className="syn-card-body">
                <div className="syn-field-grid syn-cols-3">
                  <div className="syn-form-group">
                    <label className="syn-input-label">
                      Delivery Lead Time (Days) <span className="syn-required">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="syn-input"
                      placeholder="e.g. 7"
                      value={formData.deliveryLeadTime}
                      onChange={(e) => handleInputChange('deliveryLeadTime', e.target.value)}
                    />
                  </div>

                  <div className="syn-form-group">
                    <label className="syn-input-label">Expected Dispatch Date</label>
                    <input
                      type="date"
                      className="syn-input"
                      value={formData.expectedDispatchDate}
                      onChange={(e) => handleInputChange('expectedDispatchDate', e.target.value)}
                    />
                  </div>

                  <div className="syn-form-group">
                    <label className="syn-input-label">Expected Delivery Date</label>
                    <input
                      type="date"
                      className="syn-input"
                      min={formData.expectedDispatchDate}
                      value={formData.expectedDeliveryDate}
                      onChange={(e) => handleInputChange('expectedDeliveryDate', e.target.value)}
                    />
                  </div>
                </div>

                <div className="syn-field-grid syn-cols-3">
                  <div className="syn-form-group">
                    <label className="syn-input-label">Delivery Schedule Mode</label>
                    <select
                      className="syn-select"
                      value={formData.deliverySchedule}
                      onChange={(e) => handleInputChange('deliverySchedule', e.target.value)}
                    >
                      <option value="Single">Single Complete Consignment</option>
                      <option value="Partial">Partial / Staggered Consignments</option>
                      <option value="Multiple">Multiple Dispatches per Buyer</option>
                    </select>
                  </div>

                  <div className="syn-form-group">
                    <label className="syn-input-label">Transportation Responsibility</label>
                    <select
                      className="syn-select"
                      value={formData.transportationResponsibility}
                      onChange={(e) => handleInputChange('transportationResponsibility', e.target.value)}
                    >
                      <option value="Vendor">Vendor Responsibility (Vendor Arranges Logistics)</option>
                      <option value="Buyer">Buyer Responsibility (Ex-Works Pickup by Buyer)</option>
                    </select>
                  </div>

                  <div className="syn-form-group">
                    <label className="syn-input-label">Payment Terms</label>
                    <select
                      className="syn-select"
                      value={formData.paymentTerms}
                      onChange={(e) => handleInputChange('paymentTerms', e.target.value)}
                    >
                      <option value="30 Days Credit">30 Days Credit (Standard)</option>
                      <option value="100% Advance">100% Advance against PI</option>
                      <option value="50% Advance + 50% Against BL/LR">50% Advance + 50% Against BL/LR</option>
                      <option value="60 Days Credit">60 Days Credit</option>
                      <option value="100% LC at Sight">100% Irrevocable LC at Sight</option>
                      <option value="Net 15 Days">Net 15 Days</option>
                    </select>
                  </div>
                </div>

                <div className="syn-field-grid syn-cols-2">
                  <div className="syn-form-group">
                    <label className="syn-input-label">Advance Payment (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="syn-input"
                      placeholder="0"
                      value={formData.advancePaymentPercentage}
                      onChange={(e) => handleInputChange('advancePaymentPercentage', e.target.value)}
                    />
                  </div>

                  <div className="syn-form-group">
                    <label className="syn-input-label">Credit Period (Days)</label>
                    <input
                      type="number"
                      min="0"
                      max="180"
                      className="syn-input"
                      placeholder="30"
                      value={formData.creditPeriodDays}
                      onChange={(e) => handleInputChange('creditPeriodDays', e.target.value)}
                    />
                  </div>
                </div>

                {/* Conditional Staggered Delivery Table */}
                {formData.deliverySchedule === 'Partial' && (
                  <div className="syn-staggered-box">
                    <div className="syn-staggered-header">
                      <h4 className="syn-sub-title">
                        <Truck size={16} /> Staggered Dispatch Schedule Breakdown
                      </h4>
                      <button
                        type="button"
                        className="syn-btn syn-btn-sm syn-btn-outline"
                        onClick={handleAddScheduleRow}
                      >
                        <Plus size={14} /> Add Delivery Lot
                      </button>
                    </div>

                    <div className="syn-table-responsive">
                      <table className="syn-table">
                        <thead>
                          <tr>
                            <th>Sequence</th>
                            <th className="syn-text-right">Quantity ({rfqDetails.uom})</th>
                            <th>Dispatch Date</th>
                            <th>Delivery Date</th>
                            <th className="syn-text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.staggeredSchedule.map((row) => (
                            <tr key={row.id}>
                              <td>
                                <input
                                  type="text"
                                  className="syn-input syn-input-sm"
                                  value={row.sequence}
                                  onChange={(e) => handleScheduleChange(row.id, 'sequence', e.target.value)}
                                />
                              </td>
                              <td className="syn-text-right">
                                <input
                                  type="number"
                                  step="any"
                                  min="1"
                                  className="syn-input syn-input-sm syn-text-right"
                                  value={row.quantity}
                                  onChange={(e) => handleScheduleChange(row.id, 'quantity', e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="date"
                                  className="syn-input syn-input-sm"
                                  value={row.dispatchDate}
                                  onChange={(e) => handleScheduleChange(row.id, 'dispatchDate', e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="date"
                                  className="syn-input syn-input-sm"
                                  value={row.deliveryDate}
                                  onChange={(e) => handleScheduleChange(row.id, 'deliveryDate', e.target.value)}
                                />
                              </td>
                              <td className="syn-text-center">
                                <button
                                  type="button"
                                  className="syn-btn-icon-danger"
                                  disabled={formData.staggeredSchedule.length <= 1}
                                  onClick={() => handleRemoveScheduleRow(row.id)}
                                  title="Remove delivery row"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 6: Documents & Attachments */}
            <div className="syn-card">
              <div className="syn-card-header">
                <div className="syn-card-title-group">
                  <div className="syn-section-num">6</div>
                  <div>
                    <h2 className="syn-card-title">Documents & Attachments</h2>
                    <p className="syn-card-desc">
                      Upload your formal commercial quotation, product specification sheet, and quality certificates.
                    </p>
                  </div>
                </div>
              </div>

              <div className="syn-card-body">
                <div className="syn-upload-slots-grid">
                  {/* Slot 1: Vendor Quotation (PDF/Excel) */}
                  <div className="syn-upload-slot">
                    <span className="syn-slot-title">
                      Vendor Quotation (PDF/Excel) <span className="syn-required">*</span>
                    </span>
                    <label className="syn-dropzone">
                      <input
                        type="file"
                        accept=".pdf,.xlsx,.xls,.csv"
                        className="syn-file-input"
                        onChange={(e) => handleFileUpload(e, 'Vendor Quotation')}
                      />
                      <FileSpreadsheet size={24} className="syn-upload-icon" />
                      <span className="syn-drop-main">Choose Quotation File</span>
                      <span className="syn-drop-sub">PDF, XLSX, XLS up to 15MB</span>
                    </label>
                  </div>

                  {/* Slot 2: Technical Data Sheet (TDS) */}
                  <div className="syn-upload-slot">
                    <span className="syn-slot-title">Technical Data Sheet (TDS)</span>
                    <label className="syn-dropzone">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="syn-file-input"
                        onChange={(e) => handleFileUpload(e, 'Technical Data Sheet')}
                      />
                      <FileText size={24} className="syn-upload-icon" />
                      <span className="syn-drop-main">Upload TDS</span>
                      <span className="syn-drop-sub">PDF or DOCX</span>
                    </label>
                  </div>

                  {/* Slot 3: Certificate of Analysis (COA) */}
                  <div className="syn-upload-slot">
                    <span className="syn-slot-title">Certificate of Analysis (COA)</span>
                    <label className="syn-dropzone">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.png"
                        className="syn-file-input"
                        onChange={(e) => handleFileUpload(e, 'Certificate of Analysis')}
                      />
                      <ShieldCheck size={24} className="syn-upload-icon" />
                      <span className="syn-drop-main">Upload COA</span>
                      <span className="syn-drop-sub">PDF or Image</span>
                    </label>
                  </div>

                  {/* Slot 4: Additional Supporting Documents */}
                  <div className="syn-upload-slot">
                    <span className="syn-slot-title">Product Test Certificate / Other</span>
                    <label className="syn-dropzone">
                      <input
                        type="file"
                        multiple
                        className="syn-file-input"
                        onChange={(e) => handleFileUpload(e, 'Supporting Document')}
                      />
                      <Upload size={24} className="syn-upload-icon" />
                      <span className="syn-drop-main">Upload Other Files</span>
                      <span className="syn-drop-sub">Any supporting specifications</span>
                    </label>
                  </div>
                </div>

                {formErrors.attachments && (
                  <div className="syn-inline-alert syn-alert-error" style={{ marginTop: '12px' }}>
                    <AlertCircle size={16} />
                    <span>{formErrors.attachments}</span>
                  </div>
                )}

                {/* Uploaded Files List */}
                {formData.attachments.length > 0 && (
                  <div className="syn-uploaded-list">
                    <h4 className="syn-sub-title">Attached Files ({formData.attachments.length})</h4>
                    <div className="syn-file-pills">
                      {formData.attachments.map((file) => (
                        <div key={file.id} className="syn-file-chip">
                          <File size={16} className="syn-text-cyan" />
                          <div className="syn-file-info">
                            <span className="syn-file-name" title={file.name}>
                              {file.name}
                            </span>
                            <span className="syn-file-meta">
                              {file.category} • {file.size}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="syn-chip-remove"
                            onClick={() => handleRemoveAttachment(file.id)}
                            title="Remove attachment"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 7: Remarks & Confirmation */}
            <div className="syn-card">
              <div className="syn-card-header">
                <div className="syn-card-title-group">
                  <div className="syn-section-num">7</div>
                  <div>
                    <h2 className="syn-card-title">Remarks & Declarations</h2>
                    <p className="syn-card-desc">
                      Provide special terms, commercial observations, and legal declarations.
                    </p>
                  </div>
                </div>
              </div>

              <div className="syn-card-body">
                <div className="syn-form-group">
                  <label className="syn-input-label">Additional Commercial Remarks</label>
                  <textarea
                    rows={3}
                    className="syn-textarea"
                    placeholder="Provide details regarding delivery flexibilities, batch sizes, test report inclusions, etc."
                    value={formData.commercialRemarks}
                    onChange={(e) => handleInputChange('commercialRemarks', e.target.value)}
                  />
                </div>

                <div className="syn-form-group">
                  <label className="syn-input-label">Special Conditions / Quality Tolerances</label>
                  <textarea
                    rows={2}
                    className="syn-textarea"
                    placeholder="Specify packing tolerances, sampling methods, or demurrage provisions, if any."
                    value={formData.specialConditions}
                    onChange={(e) => handleInputChange('specialConditions', e.target.value)}
                  />
                </div>

                <div className="syn-declarations-box">
                  <label className={`syn-checkbox-label ${formErrors.termsConfirmed ? 'syn-label-error' : ''}`}>
                    <input
                      type="checkbox"
                      checked={formData.termsConfirmed}
                      onChange={(e) => handleInputChange('termsConfirmed', e.target.checked)}
                    />
                    <span>
                      <strong>Commercial Terms Acceptance:</strong> We confirm that our company can deliver the offered quantities according to the indicated specifications, timelines, and commercial conditions above.
                    </span>
                  </label>

                  <label className={`syn-checkbox-label ${formErrors.declarationConfirmed ? 'syn-label-error' : ''}`}>
                    <input
                      type="checkbox"
                      checked={formData.declarationConfirmed}
                      onChange={(e) => handleInputChange('declarationConfirmed', e.target.checked)}
                    />
                    <span>
                      <strong>Authorized Declaration:</strong> We declare that the submitted prices, quantities, GST/freight provisions, and validity terms are accurate, binding, and authorized by our management.
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="syn-bottom-bar">
              <div className="syn-bottom-left">
                <button
                  type="button"
                  className="syn-btn syn-btn-secondary"
                  onClick={handleSaveDraft}
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  className="syn-btn syn-btn-outline"
                  onClick={() => setShowPreviewModal(true)}
                >
                  <Eye size={16} /> Preview Offer
                </button>
              </div>

              <div className="syn-bottom-right">
                <button
                  type="button"
                  className="syn-btn syn-btn-ghost"
                  onClick={() => navigate('/collective-buy')}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="syn-btn syn-btn-primary syn-btn-lg"
                  onClick={handleOpenSubmitModal}
                >
                  <Send size={18} /> Submit Supply Offer
                </button>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Sticky Real-time Calculation Summary Card */}
          <div className="syn-sidebar-column">
            <div className="syn-sticky-summary">
              <div className="syn-summary-card">
                <div className="syn-summary-header">
                  <DollarSign className="syn-text-cyan" size={20} />
                  <div>
                    <h3 className="syn-summary-title">Quotation Summary</h3>
                    <span className="syn-summary-subtitle">Live commercial breakdown</span>
                  </div>
                </div>

                <div className="syn-summary-body">
                  <div className="syn-sum-row">
                    <span>Offered Quantity</span>
                    <strong className="syn-mono">
                      {calculations.qty} {rfqDetails.uom}
                    </strong>
                  </div>

                  <div className="syn-sum-row">
                    <span>Offered Unit Price</span>
                    <strong className="syn-mono">
                      {calculations.unitPrice > 0
                        ? `${calculations.currencySymbol} ${calculations.unitPrice.toLocaleString('en-IN')}`
                        : '—'}
                    </strong>
                  </div>

                  <div className="syn-sum-divider"></div>

                  <div className="syn-sum-row">
                    <span>Total Basic Amount</span>
                    <span className="syn-mono font-semibold">
                      {calculations.currencySymbol}{' '}
                      {calculations.basicAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="syn-sum-row">
                    <span>
                      Freight Charges{' '}
                      <small className="syn-text-muted">
                        ({formData.freightIncluded ? 'Included' : 'Extra'})
                      </small>
                    </span>
                    <span className="syn-mono">
                      {formData.freightIncluded
                        ? 'Included'
                        : `${calculations.currencySymbol} ${calculations.freightAmt.toLocaleString('en-IN')}`}
                    </span>
                  </div>

                  {calculations.otherChargesAmt > 0 && (
                    <div className="syn-sum-row">
                      <span>Other Charges</span>
                      <span className="syn-mono">
                        {calculations.currencySymbol} {calculations.otherChargesAmt.toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}

                  <div className="syn-sum-row">
                    <span>GST ({formData.gstRate})</span>
                    <span className="syn-mono">
                      {calculations.currencySymbol}{' '}
                      {calculations.gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="syn-grand-total-box">
                    <span className="syn-grand-label">Estimated Total Quotation Value</span>
                    <div className="syn-grand-val">
                      <span className="syn-curr-sym">{calculations.currencySymbol}</span>
                      <span className="syn-grand-num">
                        {calculations.grandTotal.toLocaleString('en-IN', {
                          maximumFractionDigits: 2,
                          minimumFractionDigits: 2
                        })}
                      </span>
                    </div>
                    <span className="syn-grand-note">
                      Price basis: {formData.priceBasis} • Tax: {formData.gstRate}
                    </span>
                  </div>

                  {/* Quantity & Shortfall Status Pill */}
                  <div className="syn-status-box">
                    <div className="syn-stat-item">
                      <span>Consortium Demand</span>
                      <strong>{rfqDetails.totalDemand} {rfqDetails.uom}</strong>
                    </div>
                    <div className="syn-stat-item">
                      <span>Coverage</span>
                      <strong className={calculations.shortfall > 0 ? 'syn-text-amber' : 'syn-text-green'}>
                        {calculations.shortfall > 0 ? `${calculations.shortfall} ${rfqDetails.uom} Shortfall` : '100% Full Supply'}
                      </strong>
                    </div>
                  </div>

                  {/* Quick Action Button */}
                  <button
                    type="button"
                    className="syn-btn syn-btn-primary syn-btn-block"
                    onClick={handleOpenSubmitModal}
                  >
                    Submit Supply Offer <ArrowRight size={16} />
                  </button>

                  <button
                    type="button"
                    className="syn-btn syn-btn-ghost syn-btn-block"
                    onClick={handleSaveDraft}
                  >
                    Save Progress as Draft
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="syn-modal-backdrop">
          <div className="syn-modal-dialog">
            <div className="syn-modal-header">
              <div className="syn-modal-title-group">
                <ShieldCheck className="syn-text-cyan" size={24} />
                <h3 className="syn-modal-title">Confirm Supply Offer Submission</h3>
              </div>
              <button
                type="button"
                className="syn-btn-close"
                onClick={() => setShowConfirmModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="syn-modal-body">
              <p className="syn-modal-desc">
                Please review the key quotation parameters before committing your offer to the SYN ERP 10 CollectiveBuy consortium:
              </p>

              <div className="syn-confirm-grid">
                <div className="syn-confirm-row">
                  <span>RFQ Reference:</span>
                  <strong className="syn-mono">{rfqDetails.rfqReference}</strong>
                </div>
                <div className="syn-confirm-row">
                  <span>Quotation Number:</span>
                  <strong className="syn-mono">{formData.vendorQuotationNo}</strong>
                </div>
                <div className="syn-confirm-row">
                  <span>Product:</span>
                  <strong>{rfqDetails.productName} ({rfqDetails.grade})</strong>
                </div>
                <div className="syn-confirm-row">
                  <span>Offered Quantity:</span>
                  <strong className="syn-text-cyan">
                    {calculations.qty} {rfqDetails.uom}
                  </strong>
                </div>
                <div className="syn-confirm-row">
                  <span>Unit Price:</span>
                  <strong>{calculations.currencySymbol} {calculations.unitPrice} / {rfqDetails.uom}</strong>
                </div>
                <div className="syn-confirm-row">
                  <span>Grand Total Value:</span>
                  <strong className="syn-text-green font-bold">
                    {calculations.currencySymbol} {calculations.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </strong>
                </div>
                <div className="syn-confirm-row">
                  <span>Delivery Lead Time:</span>
                  <strong>{formData.deliveryLeadTime} Days ({formData.deliverySchedule} Schedule)</strong>
                </div>
                <div className="syn-confirm-row">
                  <span>Quotation Validity:</span>
                  <strong>Until {formData.quotationValidUntil}</strong>
                </div>
              </div>

              <div className="syn-inline-alert syn-alert-info" style={{ marginTop: '16px' }}>
                <CheckCircle2 size={16} />
                <span>
                  Once submitted, this offer will be logged in SYN ERP 10 Supply Registry and presented to consortium buyers.
                </span>
              </div>
            </div>

            <div className="syn-modal-footer">
              <button
                type="button"
                className="syn-btn syn-btn-secondary"
                disabled={submitting}
                onClick={() => setShowConfirmModal(false)}
              >
                Back to Edit
              </button>
              <button
                type="button"
                className="syn-btn syn-btn-primary"
                disabled={submitting}
                onClick={handleFinalSubmit}
              >
                {submitting ? (
                  <>
                    <RefreshCw className="syn-spin" size={16} /> Submitting Offer...
                  </>
                ) : (
                  <>
                    Confirm & Submit Offer <Check size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW OFFER MODAL */}
      {showPreviewModal && (
        <div className="syn-modal-backdrop">
          <div className="syn-modal-dialog syn-modal-lg">
            <div className="syn-modal-header">
              <div className="syn-modal-title-group">
                <FileText className="syn-text-cyan" size={24} />
                <h3 className="syn-modal-title">Official Commercial Quotation Preview</h3>
              </div>
              <button
                type="button"
                className="syn-btn-close"
                onClick={() => setShowPreviewModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="syn-modal-body syn-preview-sheet">
              {/* Quotation Header */}
              <div className="syn-quot-head">
                <div>
                  <h2 className="syn-quot-vendor">{rfqDetails.vendorName}</h2>
                  <p className="syn-quot-vendor-meta">
                    Contact: {formData.contactPerson} • {formData.emailAddress} • {formData.mobileNumber}
                  </p>
                </div>
                <div className="syn-text-right">
                  <div className="syn-quot-ref-badge">FORMAL QUOTATION</div>
                  <div className="syn-quot-no">{formData.vendorQuotationNo}</div>
                  <div className="syn-quot-date">Date: {formData.quotationDate}</div>
                  <div className="syn-quot-validity">Valid Until: {formData.quotationValidUntil}</div>
                </div>
              </div>

              {/* Target Consortium Info */}
              <div className="syn-quot-target">
                <strong>Recipient:</strong> SYN ERP 10 – CollectiveBuy Consortium
                <br />
                <strong>RFQ Ref:</strong> {rfqDetails.rfqReference} • <strong>Product:</strong> {rfqDetails.productName} ({rfqDetails.category} - {rfqDetails.grade})
              </div>

              {/* Items Table */}
              <table className="syn-table syn-table-preview">
                <thead>
                  <tr>
                    <th>Item & Specifications</th>
                    <th className="syn-text-right">Qty</th>
                    <th className="syn-text-right">Unit Price</th>
                    <th className="syn-text-right">Basic Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>{rfqDetails.productName}</strong>
                      <div className="syn-text-muted" style={{ fontSize: '12px' }}>
                        Grade: {rfqDetails.grade} • Packaging: {formData.packagingType} • Basis: {formData.priceBasis}
                      </div>
                    </td>
                    <td className="syn-text-right font-semibold">
                      {calculations.qty} {rfqDetails.uom}
                    </td>
                    <td className="syn-text-right">
                      {calculations.currencySymbol} {calculations.unitPrice.toLocaleString('en-IN')}
                    </td>
                    <td className="syn-text-right font-semibold">
                      {calculations.currencySymbol} {calculations.basicAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Financial Calculation Breakdown */}
              <div className="syn-quot-totals-wrap">
                <div className="syn-quot-terms-box">
                  <strong>Commercial Terms:</strong>
                  <ul>
                    <li>Payment: {formData.paymentTerms}</li>
                    <li>Delivery Lead Time: {formData.deliveryLeadTime} Days</li>
                    <li>Transportation: {formData.transportationResponsibility} Responsibility</li>
                    <li>Availability: {formData.productAvailability}</li>
                  </ul>
                </div>

                <div className="syn-quot-financials">
                  <div className="syn-quot-fin-row">
                    <span>Subtotal:</span>
                    <span>{calculations.currencySymbol} {calculations.basicAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                  {!formData.freightIncluded && (
                    <div className="syn-quot-fin-row">
                      <span>Freight Charges:</span>
                      <span>{calculations.currencySymbol} {calculations.freightAmt.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {calculations.otherChargesAmt > 0 && (
                    <div className="syn-quot-fin-row">
                      <span>Other Charges:</span>
                      <span>{calculations.currencySymbol} {calculations.otherChargesAmt.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="syn-quot-fin-row">
                    <span>GST ({formData.gstRate}):</span>
                    <span>{calculations.currencySymbol} {calculations.gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="syn-quot-fin-total">
                    <span>Grand Total:</span>
                    <strong>{calculations.currencySymbol} {calculations.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="syn-modal-footer">
              <button
                type="button"
                className="syn-btn syn-btn-secondary"
                onClick={() => setShowPreviewModal(false)}
              >
                Close Preview
              </button>
              <button
                type="button"
                className="syn-btn syn-btn-primary"
                onClick={() => {
                  setShowPreviewModal(false);
                  handleOpenSubmitModal({ preventDefault: () => { } });
                }}
              >
                Proceed to Submit <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

