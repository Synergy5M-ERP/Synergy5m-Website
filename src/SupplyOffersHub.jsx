import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Send,
  FileText,
  CheckCircle2,
  Clock,
  ExternalLink,
  Search,
  RefreshCw,
  Building,
  Mail,
  MapPin,
  Calendar,
  ArrowUpRight,
  Info,
  ShieldCheck,
  X,
  Menu,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  Warehouse,
  Database,
  Inbox,
  FileCheck,
  VenusAndMarsIcon,
  Award,
  Scale,
  MessageSquare,
  Split,
  Users,
  SlidersHorizontal,
  CreditCard,
  Printer,
  Download,
  Table as TableIcon,
  LayoutGrid
} from 'lucide-react';
import './AdminAddProduct.css';
import './SupplyOffersHub.css';

export default function SupplyOffersHub({ defaultTab = 'sent' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Active tab state: 'sent' | 'submitted' | 'evaluation'
  const initialTab = searchParams.get('tab') || defaultTab;
  const [activeTab, setActiveTab] = useState(
    initialTab === 'submitted' ? 'submitted' : initialTab === 'evaluation' ? 'evaluation' : 'sent'
  );

  // Sidebar toggle states
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Data states
  const [sentOffers, setSentOffers] = useState([]);
  const [submittedOffers, setSubmittedOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Selected quotation for modal preview
  const [selectedQuote, setSelectedQuote] = useState(null);

  // Evaluation action states (Step 5)
  const [selectedEvalKey, setSelectedEvalKey] = useState('');
  const [awardModal, setAwardModal] = useState(null); // { quote, group }
  const [awardRemarks, setAwardRemarks] = useState('');

  const [counterModal, setCounterModal] = useState(null); // { quote, group }
  const [counterPrice, setCounterPrice] = useState('');
  const [counterRemarks, setCounterRemarks] = useState('');

  const [splitModal, setSplitModal] = useState(null); // { group }
  const [splitState, setSplitState] = useState({}); // { [offerRef]: { allocatedQty, splitPercent, remarks } }

  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  // Commercial Evaluation Comparison & Smart Recommendation States (default: normal mode)
  const [compareMode, setCompareMode] = useState(false);
  const [evalFilterCriterion, setEvalFilterCriterion] = useState('smart'); // 'smart' | 'location_match' | 'price_asc' | 'speed_asc' | 'credit_desc' | 'capacity_desc'
  const [compareViewType, setCompareViewType] = useState('chart'); // 'chart' | 'cards'

  // Stage 7: Buyer Allocation states
  const [buyerAllocations, setBuyerAllocations] = useState([]);
  const [allocationsLoading, setAllocationsLoading] = useState(false);
  const [allocationsGenerating, setAllocationsGenerating] = useState(false);
  const [emailSendingState, setEmailSendingState] = useState({});
  const [emailConfirmModal, setEmailConfirmModal] = useState(null); // { allocation }

  // Fetch both sent and submitted records
  const fetchHubData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sentRes, subRes] = await Promise.all([
        fetch('/api/supply-offers/sent').then(r => r.json()).catch(() => ({ success: false, data: [] })),
        fetch('/api/supply-offers/submitted').then(r => r.json()).catch(() => ({ success: false, data: [] }))
      ]);

      if (sentRes.success && Array.isArray(sentRes.data)) {
        setSentOffers(sentRes.data);
      } else {
        setSentOffers([]);
      }

      if (subRes.success && Array.isArray(subRes.data)) {
        setSubmittedOffers(subRes.data);
      } else {
        setSubmittedOffers([]);
      }
    } catch (err) {
      console.error('Error fetching hub data:', err);
      setError('Could not load supply offer records. Please check the network connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHubData();
  }, [fetchHubData]);

  // Sync tab with URL parameter if passed
  useEffect(() => {
    if (defaultTab && (defaultTab === 'sent' || defaultTab === 'submitted' || defaultTab === 'evaluation')) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  // Group submitted offers by RFQ Reference and Product Name for Step 5: Commercial Evaluation
  const evaluationGroups = useMemo(() => {
    const map = {};
    (submittedOffers || []).forEach(quote => {
      const rfq = quote.RfqReference || 'N/A';
      const prod = quote.ProductName || 'Unknown Product';
      const key = `${rfq}:::${prod}`;
      if (!map[key]) {
        const matchingSent = sentOffers.find(
          s => s.RfqReference === rfq &&
            String(s.ProductName || '').trim().toLowerCase() === String(prod).trim().toLowerCase()
        );
        map[key] = {
          key,
          rfqReference: rfq,
          productName: prod,
          category: quote.Category || matchingSent?.Category || '',
          grade: quote.Grade || matchingSent?.Grade || '',
          productCode: quote.OpportunityId || matchingSent?.OpportunityId || matchingSent?.ProductId || quote.RfqReference || '',
          totalDemand: matchingSent?.TotalDemand || quote.TotalRequiredDemand || 0,
          uom: quote.Uom || matchingSent?.Uom || 'MT',
          destination: quote.Destination || matchingSent?.Destination || '',
          sendStatus: matchingSent?.SendStatus || matchingSent?.Status || 'Sent',
          quotes: []
        };
      }
      map[key].quotes.push(quote);
    });

    return Object.values(map);
  }, [submittedOffers, sentOffers]);

  // Initialize selected evaluation product
  useEffect(() => {
    if (evaluationGroups.length > 0 && !selectedEvalKey) {
      setSelectedEvalKey(evaluationGroups[0].key);
    }
  }, [evaluationGroups, selectedEvalKey]);

  const activeEvalGroup = useMemo(() => {
    return evaluationGroups.find(g => g.key === selectedEvalKey) || evaluationGroups[0] || null;
  }, [evaluationGroups, selectedEvalKey]);

  // Multi-Factor Comparison & Intelligent Recommendation Engine
  const comparisonAnalysis = useMemo(() => {
    if (!activeEvalGroup || !Array.isArray(activeEvalGroup.quotes) || activeEvalGroup.quotes.length === 0) {
      return { evaluatedList: [], sortedList: [], recommendation: null, bestQuoteRef: '', lowestPriceRef: '' };
    }

    const quotes = activeEvalGroup.quotes;
    const targetDest = String(activeEvalGroup.destination || '').toLowerCase().trim();
    const targetDemand = Number(activeEvalGroup.totalDemand || 0);

    // 1. Calculate raw and normalized metrics for each quotation
    const scoredQuotes = quotes.map(quote => {
      const basePrice = Number(quote.OfferedUnitPrice || 0);
      const freightExtra = !quote.FreightIncluded ? Number(quote.FreightCharges || 0) : 0;
      const otherCharges = Number(quote.OtherCharges || 0);
      const netLandedRate = basePrice + freightExtra + otherCharges;

      const offeredQty = Number(quote.OfferedQuantity || 0);
      const turnaroundDays = Number(quote.DeliveryLeadTimeDays || 14);
      const creditDays = Number(quote.CreditPeriodDays || 0);
      const advancePct = Number(quote.AdvancePaymentPercentage || 0);
      const quoteDest = String(quote.Destination || '').toLowerCase().trim();

      // Factor 1: Location Matching (Weight: 35 points)
      // If delivery is at buyer destination or door delivery / freight included:
      const isExactLocation = Boolean(targetDest && (
        quoteDest.includes(targetDest) ||
        targetDest.includes(quoteDest) ||
        (quoteDest.includes('pune') && targetDest.includes('pune'))
      ));
      const isDoorDelivery = quote.PriceBasis === 'FOR Destination' || Boolean(quote.FreightIncluded);

      let locationScore = 10;
      let locationReason = '';
      if (isExactLocation) {
        locationScore = 35;
        locationReason = `Direct plant delivery at ${activeEvalGroup.destination || 'target location'}`;
      } else if (isDoorDelivery) {
        locationScore = 28;
        locationReason = `Delivered to dock (${quote.Destination || 'Destination'})`;
      } else {
        locationScore = 12;
        locationReason = `Ex-factory / Dispatch to ${quote.Destination || 'Vendor Plant'} (Buyer incurs extra transport)`;
      }

      // Factor 2: Delivery Speed & Readiness (Weight: 20 points)
      let speedScore = 10;
      if (turnaroundDays <= 3) speedScore = 20;
      else if (turnaroundDays <= 7) speedScore = 17;
      else if (turnaroundDays <= 14) speedScore = 13;
      else speedScore = 8;

      // Factor 3: Commercial Credit Terms (Weight: 15 points)
      let creditScore = 5;
      if (creditDays >= 60) creditScore = 15;
      else if (creditDays >= 30) creditScore = 12;
      else if (creditDays >= 15) creditScore = 9;
      else if (advancePct === 0) creditScore = 7;
      else creditScore = 4;

      // Factor 4: Supply Volume Capacity (Weight: 10 points)
      const supplyRatio = targetDemand > 0 ? (offeredQty / targetDemand) : 1;
      let capacityScore = Math.min(10, Math.round(supplyRatio * 10));
      if (quote.CanSupplyFull || offeredQty >= targetDemand) capacityScore = 10;

      return {
        quote,
        basePrice,
        netLandedRate,
        offeredQty,
        turnaroundDays,
        creditDays,
        advancePct,
        quoteDest,
        isExactLocation,
        isDoorDelivery,
        locationScore,
        locationReason,
        speedScore,
        creditScore,
        capacityScore
      };
    });

    // Find lowest landed rate in this product group
    const positiveRates = scoredQuotes.map(q => q.netLandedRate).filter(r => r > 0);
    const minLanded = positiveRates.length > 0 ? Math.min(...positiveRates) : 1;

    // 2. Normalize Price Score (Weight: 35 points) and compute Total Score out of 100
    const evaluatedList = scoredQuotes.map(item => {
      const priceRatio = item.netLandedRate > 0 ? (minLanded / item.netLandedRate) : 0.8;
      const priceScore = Math.round(35 * priceRatio);

      const totalScore = Math.min(100, Math.round(
        item.locationScore + priceScore + item.speedScore + item.creditScore + item.capacityScore
      ));

      return {
        ...item,
        priceScore,
        totalScore
      };
    });

    // 3. Formulate AI / Smart Recommendation
    const sortedBySmart = [...evaluatedList].sort((a, b) => b.totalScore - a.totalScore);
    const sortedByPrice = [...evaluatedList].sort((a, b) => a.netLandedRate - b.netLandedRate);
    const bestOverall = sortedBySmart[0];
    const lowestPrice = sortedByPrice[0];

    let recommendation = null;
    if (bestOverall) {
      const isLowestPrice = bestOverall.quote.OfferReference === lowestPrice?.quote?.OfferReference;
      const priceDiff = lowestPrice && !isLowestPrice ? Math.abs(bestOverall.netLandedRate - lowestPrice.netLandedRate) : 0;

      let reasonText = '';
      if (isLowestPrice) {
        reasonText = `Offers the lowest net landed rate (₹${bestOverall.netLandedRate.toLocaleString('en-IN')}/${activeEvalGroup.uom}) combined with direct delivery to ${activeEvalGroup.destination || 'plant'} and fast ${bestOverall.turnaroundDays}-day turnaround.`;
      } else if (bestOverall.isExactLocation && !lowestPrice.isExactLocation) {
        reasonText = `Although ${lowestPrice.quote.VendorName} has a ₹${priceDiff.toLocaleString('en-IN')}/${activeEvalGroup.uom} lower nominal rate, their dispatch destination is ${lowestPrice.quote.Destination || 'remote plant'} which requires secondary inter-city transport. ${bestOverall.quote.VendorName} delivers directly to ${activeEvalGroup.destination || 'your destination'} (Freight Included), eliminating extra logistics expenditure, while offering ${bestOverall.turnaroundDays}-day turnaround and ${bestOverall.creditDays > 0 ? `${bestOverall.creditDays} days credit` : 'direct terms'}.`;
      } else {
        reasonText = `Provides the optimal balance of competitive landed pricing (₹${bestOverall.netLandedRate.toLocaleString('en-IN')}/${activeEvalGroup.uom}), direct plant delivery (${bestOverall.locationReason}), ${bestOverall.turnaroundDays}-day turnaround, and ${bestOverall.creditDays} days credit period.`;
      }

      recommendation = {
        bestQuote: bestOverall.quote,
        bestScore: bestOverall.totalScore,
        vendorName: bestOverall.quote.VendorName,
        quotationNo: bestOverall.quote.VendorQuotationNo || bestOverall.quote.OfferReference,
        netRate: bestOverall.netLandedRate,
        reasonText,
        lowestPriceQuote: lowestPrice?.quote,
        lowestPriceRate: lowestPrice?.netLandedRate,
        isSameAsLowestPrice: isLowestPrice
      };
    }

    // 4. Sort quotes based on the selected user filter criterion
    let sortedList = evaluatedList;
    if (evalFilterCriterion === 'price_asc') {
      sortedList = [...evaluatedList].sort((a, b) => a.netLandedRate - b.netLandedRate);
    } else if (evalFilterCriterion === 'location_match') {
      sortedList = [...evaluatedList].sort((a, b) => b.locationScore - a.locationScore || a.netLandedRate - b.netLandedRate);
    } else if (evalFilterCriterion === 'speed_asc') {
      sortedList = [...evaluatedList].sort((a, b) => a.turnaroundDays - b.turnaroundDays || a.netLandedRate - b.netLandedRate);
    } else if (evalFilterCriterion === 'credit_desc') {
      sortedList = [...evaluatedList].sort((a, b) => b.creditDays - a.creditDays || a.netLandedRate - b.netLandedRate);
    } else if (evalFilterCriterion === 'capacity_desc') {
      sortedList = [...evaluatedList].sort((a, b) => b.offeredQty - a.offeredQty || a.netLandedRate - b.netLandedRate);
    } else {
      // Default: 'smart' composite score
      sortedList = sortedBySmart;
    }

    return {
      evaluatedList,
      sortedList,
      recommendation,
      bestQuoteRef: bestOverall?.quote?.OfferReference,
      lowestPriceRef: lowestPrice?.quote?.OfferReference
    };
  }, [activeEvalGroup, evalFilterCriterion]);

  // Processed Quotations specifically formatted for the Horizontal Quotation Comparison Chart
  const comparisonQuotes = useMemo(() => {
    if (!activeEvalGroup || !Array.isArray(activeEvalGroup.quotes)) return [];

    const mapped = activeEvalGroup.quotes.map((quote, idx) => {
      const basicPrice = Number(quote.OfferedUnitPrice || 0);
      const qtyOffered = Number(quote.OfferedQuantity || 0);
      const discountPct = Number(quote.DiscountPercentage || 0);
      const discountValue = (basicPrice * discountPct) / 100;
      const netPrice = basicPrice - discountValue;

      const gstRateRaw = String(quote.GstRate || '18%');
      const gstRateNum = parseFloat(gstRateRaw.replace(/[^0-9.]/g, '')) || 18;
      const gstValue = Number(quote.GstAmount || ((netPrice * gstRateNum) / 100));

      const isFreightInc = Boolean(quote.FreightIncluded);
      const freightCharges = !isFreightInc ? Number(quote.FreightCharges || 0) : 0;

      // Net of GST Landed Rate = Net Basic + Freight
      const netOfGstPrice = netPrice + freightCharges;
      const totalLandedPrice = netOfGstPrice + gstValue;

      const source = String(quote.Source || (quote.Country && String(quote.Country).toUpperCase() !== 'INDIA' ? 'INTERNATIONAL' : 'DOMESTIC')).toUpperCase();
      const country = String(quote.Country || 'INDIA').toUpperCase();
      const uom = quote.Uom || activeEvalGroup.uom || 'MT';
      const quotationNo = quote.VendorQuotationNo || quote.OfferReference || `OFF-${quote.Id}`;
      const quotationDate = quote.QuotationDate
        ? new Date(quote.QuotationDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : (quote.CreatedAt ? new Date(quote.CreatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }));
      const paymentTerms = quote.PaymentTerms || (quote.CreditPeriodDays ? `${quote.CreditPeriodDays} Days Credit` : 'Standard Terms');
      const priceBasis = quote.PriceBasis || (isFreightInc ? 'FOR Destination' : 'Ex-Works');
      const validity = quote.QuotationValidUntil
        ? new Date(quote.QuotationValidUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '30 Days';
      const moq = `${quote.Moq || '1'} ${uom}`;

      return {
        quote,
        index: idx + 1,
        source,
        country,
        uom,
        quotationNo,
        quotationDate,
        paymentTerms,
        priceBasis,
        validity,
        moq,
        basicPrice,
        qtyOffered,
        discountPct,
        discountValue,
        netPrice,
        gstRateNum,
        gstRateRaw,
        gstValue,
        isFreightInc,
        freightCharges,
        netOfGstPrice,
        totalLandedPrice
      };
    });

    // Rank suppliers by lowest Net Landed Rate (Net of GST Price) to assign L1, L2, L3...
    const sorted = [...mapped].sort((a, b) => a.netOfGstPrice - b.netOfGstPrice);
    const rankMap = {};
    sorted.forEach((item, rIdx) => {
      rankMap[item.quote.OfferReference || item.quote.Id] = `L${rIdx + 1}`;
    });

    return mapped.map(item => {
      const evalData = comparisonAnalysis.evaluatedList.find(
        e => (e.quote.OfferReference || e.quote.Id) === (item.quote.OfferReference || item.quote.Id)
      );
      const isGoodFit = Boolean(
        comparisonAnalysis.bestQuoteRef &&
        (item.quote.OfferReference || item.quote.Id) === comparisonAnalysis.bestQuoteRef
      );
      return {
        ...item,
        rating: rankMap[item.quote.OfferReference || item.quote.Id] || `L${item.index}`,
        isL1: rankMap[item.quote.OfferReference || item.quote.Id] === 'L1',
        isGoodFit,
        evalData,
        score: evalData?.totalScore || 0
      };
    });
  }, [activeEvalGroup, comparisonAnalysis]);

  // Export comparison table to CSV
  const handleExportComparisonCsv = () => {
    if (!activeEvalGroup || comparisonQuotes.length === 0) return;

    const rows = [
      ['QUOTATION COMPARISON CHART', '', '', '', '', '', '', `DATE: ${new Date().toLocaleDateString('en-IN')}`],
      [],
      ['--- SUPPLIER DETAILS ---'],
      ['SOURCE', 'SUPPLIER DETAILS', 'NAME', 'COUNTRY', 'UOM', 'QUOTATION NO', 'DATE', 'BASIC PRICE', 'OFFERED QUANTITY', 'PAYMENT TERMS', 'PRICE BASIS', 'OFFER VALIDITY', 'MOQ'],
      ...comparisonQuotes.map(q => [
        q.source,
        q.index,
        `"${q.quote.VendorName}"`,
        q.country,
        q.uom,
        `"${q.quotationNo}"`,
        q.quotationDate,
        q.basicPrice,
        `"${q.qtyOffered} ${q.uom}"`,
        `"${q.paymentTerms}"`,
        `"${q.priceBasis}"`,
        `"${q.validity}"`,
        `"${q.moq}"`
      ]),
      [],
      ['--- PRODUCT & COMMERCIAL OFFER EVALUATION ---'],
      ['PRODUCT DETAILS', ...comparisonQuotes.map((q, idx) => idx === 0 ? `CODE: ${activeEvalGroup.productCode || activeEvalGroup.rfqReference}` : idx === 1 ? `DESC: ${activeEvalGroup.productName}` : idx === 2 ? `GRADE: ${activeEvalGroup.grade || 'Commercial Grade'}` : `PRODUCT: ${activeEvalGroup.productName}`)],
      ['SUPPLIERS OFFER', ...comparisonQuotes.map(q => `${q.index}. ${q.quote.VendorName}`)],
      ['BASIC PRICE', ...comparisonQuotes.map(q => q.basicPrice)],
      ['QTY OFFERED', ...comparisonQuotes.map(q => `${q.qtyOffered} ${q.uom}`)],
      ['DISCOUNT %', ...comparisonQuotes.map(q => `${q.discountPct}%`)],
      ['DISCOUNT VALUE', ...comparisonQuotes.map(q => q.discountValue)],
      ['NET PRICE', ...comparisonQuotes.map(q => q.netPrice)],
      ['GST TAX %', ...comparisonQuotes.map(q => `${q.gstRateNum}%`)],
      ['GST TAX VALUE', ...comparisonQuotes.map(q => q.gstValue)],
      ['FREIGHT', ...comparisonQuotes.map(q => q.isFreightInc ? 'Included' : q.freightCharges)],
      ['NET OF GST PRICE', ...comparisonQuotes.map(q => q.netOfGstPrice)],
      ['TOTAL LANDED (INCL GST)', ...comparisonQuotes.map(q => q.totalLandedPrice)],
      ['SUPPLIER RATING', ...comparisonQuotes.map(q => q.rating)],
      [],
      ['PREPARED BY: Synergy5M Sourcing Desk', '', '', 'CHECKED BY: Consortium Procurement Committee']
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Quotation_Comparison_Chart_${activeEvalGroup.rfqReference || 'RFQ'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Execute Step 5 Evaluation action
  const handleEvaluateAction = async (payload) => {
    setActionLoading(true);
    setActionSuccess('');
    setError(null);
    try {
      const res = await fetch('/api/supply-offers/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to process evaluation action.');
      }

      setActionSuccess(data.message || 'Action executed successfully.');
      setAwardModal(null);
      setCounterModal(null);
      setSplitModal(null);
      await fetchHubData();

      // Automatically generate allocations if quote is awarded or split awarded
      if (payload.action === 'award' || payload.action === 'multi-source-split') {
        try {
          await fetch('/api/buyer-allocations/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rfqReference: payload.rfqReference,
              productName: payload.productName,
              offerRef: payload.offerRef
            })
          });
          if (activeEvalGroup) {
            await fetchAllocationsForActiveGroup(activeEvalGroup.rfqReference, activeEvalGroup.productName);
          }
        } catch (allocErr) {
          console.warn('Auto-generation of allocations notice:', allocErr);
        }
      }
    } catch (err) {
      console.error('Evaluation action error:', err);
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Fetch buyer allocations for the current active product & RFQ
  const fetchAllocationsForActiveGroup = useCallback(async (rfq, prod) => {
    if (!rfq || !prod) {
      setBuyerAllocations([]);
      return;
    }
    setAllocationsLoading(true);
    try {
      const res = await fetch(`/api/buyer-allocations?rfqReference=${encodeURIComponent(rfq)}&productName=${encodeURIComponent(prod)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setBuyerAllocations(data.data);
      } else {
        setBuyerAllocations([]);
      }
    } catch (err) {
      console.error('Error fetching allocations:', err);
      setBuyerAllocations([]);
    } finally {
      setAllocationsLoading(false);
    }
  }, []);

  // Sync allocations whenever active product or tab changes
  useEffect(() => {
    if (activeTab === 'evaluation' && activeEvalGroup) {
      fetchAllocationsForActiveGroup(activeEvalGroup.rfqReference, activeEvalGroup.productName);
    }
  }, [activeTab, activeEvalGroup, fetchAllocationsForActiveGroup]);

  // Generate or refresh buyer allocations for active product
  const handleGenerateAllocations = async (quoteOfferRef = null) => {
    if (!activeEvalGroup) return;
    setAllocationsGenerating(true);
    setActionSuccess('');
    setError(null);
    try {
      const res = await fetch('/api/buyer-allocations/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfqReference: activeEvalGroup.rfqReference,
          productName: activeEvalGroup.productName,
          offerRef: quoteOfferRef
        })
      });

      const contentType = res.headers.get('content-type') || '';
      let data = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text.includes('Error occurred')
          ? 'Backend server proxy timeout or connection reset. Please retry in a few moments.'
          : `Server responded with status ${res.status}: ${text.slice(0, 120)}`
        );
      }

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to generate buyer allocations.');
      }
      setActionSuccess(data.message);
      await fetchAllocationsForActiveGroup(activeEvalGroup.rfqReference, activeEvalGroup.productName);
    } catch (err) {
      console.error('Error generating allocations:', err);
      setError(err.message);
    } finally {
      setAllocationsGenerating(false);
    }
  };

  // Dispatch buyer offer email strictly upon manual UI action (never automatically)
  const handleSendBuyerOfferEmail = async (allocationRef) => {
    if (!allocationRef) return;
    setEmailSendingState(prev => ({ ...prev, [allocationRef]: true }));
    setError(null);
    try {
      const res = await fetch('/api/buyer-allocations/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocationRef })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to dispatch offer email to buyer.');
      }
      setActionSuccess(data.message);
      setEmailConfirmModal(null);
      if (activeEvalGroup) {
        await fetchAllocationsForActiveGroup(activeEvalGroup.rfqReference, activeEvalGroup.productName);
      }
    } catch (err) {
      console.error('Error sending buyer email:', err);
      setError(err.message);
    } finally {
      setEmailSendingState(prev => ({ ...prev, [allocationRef]: false }));
    }
  };

  // Open Submit Offer page
  const handleOpenSubmitOffer = (url, fallbackRfq = '') => {
    if (url) {
      if (url.startsWith('http')) {
        const parsed = new URL(url);
        navigate(`${parsed.pathname}${parsed.search}`);
      } else {
        navigate(url);
      }
    } else {
      navigate(`/supply-offer?rfq=${encodeURIComponent(fallbackRfq)}`);
    }
  };

  // Filter Dispatched Offers (Deduplicated so 1 vendor and 1 product shows only once)
  const filteredSentOffers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const seen = new Set();
    const deduped = [];
    for (const item of (sentOffers || [])) {
      const key = `${item.RfqReference || ''}:::${(item.ProductName || '').toLowerCase().trim()}:::${(item.VendorName || item.VendorEmail || '').toLowerCase().trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(item);
      }
    }

    return deduped.filter(item => {
      const matchesSearch =
        !q ||
        (item.RfqReference && item.RfqReference.toLowerCase().includes(q)) ||
        (item.VendorName && item.VendorName.toLowerCase().includes(q)) ||
        (item.VendorEmail && item.VendorEmail.toLowerCase().includes(q)) ||
        (item.ProductName && item.ProductName.toLowerCase().includes(q)) ||
        (item.Destination && item.Destination.toLowerCase().includes(q)) ||
        (item.Category && item.Category.toLowerCase().includes(q));

      return matchesSearch;
    });
  }, [sentOffers, searchQuery]);

  // Filter Submitted Offers
  const filteredSubmittedOffers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return submittedOffers.filter(item => {
      if (!q) return true;
      return (
        (item.OfferReference && item.OfferReference.toLowerCase().includes(q)) ||
        (item.RfqReference && item.RfqReference.toLowerCase().includes(q)) ||
        (item.VendorName && item.VendorName.toLowerCase().includes(q)) ||
        (item.VendorEmail && item.VendorEmail.toLowerCase().includes(q)) ||
        (item.ContactPerson && item.ContactPerson.toLowerCase().includes(q)) ||
        (item.ProductName && item.ProductName.toLowerCase().includes(q)) ||
        (item.VendorQuotationNo && item.VendorQuotationNo.toLowerCase().includes(q)) ||
        (item.Destination && item.Destination.toLowerCase().includes(q))
      );
    });
  }, [submittedOffers, searchQuery]);

  return (
    <div className="b2b-dashboard-page flex flex-col min-h-screen">
      <div className="flex flex-1 min-h-screen">
        {/* Left Sidebar (Collapsible on Mobile and Desktop) */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 bg-[#0F2A47] text-slate-200 transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            } ${sidebarCollapsed ? 'w-64 lg:w-[68px]' : 'w-64'}`}
        >
          {/* Sidebar Header */}
          <div
            className={`h-16 flex items-center border-b border-slate-700/60 bg-[#0A1E33] transition-all duration-300 ${sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'
              }`}
          >
            {!sidebarCollapsed ? (
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#0E7C86] flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                  S5
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-sm tracking-tight text-white block truncate">Synergy5M</span>
                  <span className="text-[10px] text-teal-300 tracking-wider uppercase font-semibold block truncate">
                    Collective Buy
                  </span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                className="w-9 h-9 rounded-lg bg-[#0E7C86] hover:bg-[#0A626A] flex items-center justify-center text-white font-bold text-sm shadow-sm transition-colors group relative"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                S5
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                    Expand Sidebar
                  </div>
                </div>
              </button>
            )}

            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                className="hidden lg:flex text-slate-400 hover:text-white hover:bg-slate-800/80 p-1.5 rounded-md transition-colors"
                title="Minimize sidebar (show icons only)"
                aria-label="Minimize sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white p-1 rounded"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto b2b-custom-scrollbar text-sm font-medium">
            {/* 1. Dashboard */}
            <div className="relative group">
              <Link
                to="/admin/dashboard"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center rounded-md text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  }`}
                title="Dashboard"
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <LayoutDashboard className="w-4 h-4 text-teal-100 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Dashboard</span>}
                </div>
              </Link>
              {sidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                    Dashboard
                  </div>
                </div>
              )}
            </div>

            {/* 2. Add Product */}
            <div className="relative group">
              <Link
                to="/admin/products/add"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center rounded-md text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  }`}
                title="Add Product"
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <Warehouse className="w-4 h-4 text-teal-100 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Add Product</span>}
                </div>
              </Link>
              {sidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                    Add Product
                  </div>
                </div>
              )}
            </div>

            {/* 3. View Products */}
            <div className="relative group">
              <Link
                to="/admin/products"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center rounded-md text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  }`}
                title="View Products"
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <Database className="w-4 h-4 text-teal-100 flex-shrink-0" />
                  {!sidebarCollapsed && <span>View Products</span>}
                </div>
              </Link>
              {sidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                    View Products
                  </div>
                </div>
              )}
            </div>

            {/* 4. Aggregate Enquiries */}
            <div className="relative group">
              <Link
                to="/admin/collective-enquiries"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center rounded-md text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  }`}
                title="Aggregate Enquiries"
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <Inbox className="w-4 h-4 text-teal-300 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Aggregate Enquiries</span>}
                </div>
              </Link>
              {sidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                    Aggregate Enquiries
                  </div>
                </div>
              )}
            </div>

            {/* 5. Opportunity View */}
            <div className="relative group">
              <Link
                to="/admin/opportunity-view"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center rounded-md text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  }`}
                title="Opportunity View (SG-5)"
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <FileCheck className="w-4 h-4 text-teal-300 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Opportunity View</span>}
                </div>

              </Link>
              {sidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                    Opportunity View
                  </div>
                </div>
              )}
            </div>



            {/* 6. Sent Supply Offer */}
            <div className="relative group">
              <Link
                to="/supply-offers"
                onClick={() => {
                  setActiveTab('sent');
                  setSidebarOpen(false);
                }}
                className={`flex items-center rounded-md transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  } ${activeTab === 'sent'
                    ? 'bg-[#0E7C86] text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                title="Sent Supply Offer"
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <Send className={`w-4 h-4 flex-shrink-0 ${activeTab === 'sent' ? 'text-teal-100' : 'text-orange-400'}`} />
                  {!sidebarCollapsed && <span>Sent Supply Offer</span>}
                </div>

              </Link>
              {sidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                    Sent Supply Offer
                  </div>
                </div>
              )}
            </div>




            {/* 8. Submitted Offer */}
            <div className="relative group">
              <Link
                to="/submittedoffer"
                onClick={() => {
                  setActiveTab('submitted');
                  setSidebarOpen(false);
                }}
                className={`flex items-center rounded-md transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  } ${activeTab === 'submitted'
                    ? 'bg-[#0E7C86] text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                title="Submitted Offer"
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <FileText className={`w-4 h-4 flex-shrink-0 ${activeTab === 'submitted' ? 'text-teal-100' : 'text-emerald-400'}`} />
                  {!sidebarCollapsed && <span>Submitted Offer</span>}
                </div>

              </Link>
              {sidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                    Submitted Offer
                  </div>
                </div>
              )}
            </div>

            {/* 9. Commercial Evaluation (Step 5) */}
            <div className="relative group">
              <Link
                to="/commercial-evaluation"
                onClick={() => {
                  setActiveTab('evaluation');
                  window.history.replaceState(null, '', '/commercial-evaluation');
                  setSidebarOpen(false);
                }}
                className={`flex items-center rounded-md transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  } ${activeTab === 'evaluation'
                    ? 'bg-[#0E7C86] text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                title="Commercial Evaluation & Comparison (Step 5)"
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <Award className={`w-4 h-4 flex-shrink-0 ${activeTab === 'evaluation' ? 'text-teal-100' : 'text-amber-400'}`} />
                  {!sidebarCollapsed && <span>Commercial Evaluation</span>}
                </div>

              </Link>
              {sidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                    Commercial Evaluation
                  </div>
                </div>
              )}
            </div>



            {/* 7. Admin Panel */}
            <div className="relative group">
              <a
                href="/admin"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/admin');
                  setSidebarOpen(false);
                }}
                className={`flex items-center rounded-md text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  }`}
                title="Admin Panel"
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <VenusAndMarsIcon className="w-4 h-4 text-orange-400 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Admin Panel</span>}
                </div>
                {!sidebarCollapsed && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-bold uppercase tracking-wider">
                    Admin
                  </span>
                )}
              </a>
              {sidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                    Admin Panel
                  </div>
                </div>
              )}
            </div>
          </nav>
        </aside>

        {/* Backdrop for mobile sidebar */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          />
        )}

        {/* Main Content Workspace */}
        <div className="flex-1 flex flex-col min-w-0 soh-container" style={{ paddingBottom: '60px' }}>
          {/* Top Navigation Bar */}
          {/* Top Navigation Bar with Tabs & Search Bar */}
          <header className="soh-navbar">
            <div className="soh-nav-inner flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Mobile menu trigger */}
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-md focus:outline-none"
                  aria-label="Open sidebar"
                >
                  <Menu className="w-5 h-5" />
                </button>

                {/* Desktop sidebar toggle button */}
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="hidden lg:flex items-center justify-center p-2 text-slate-400 hover:text-teal-300 hover:bg-slate-800/80 rounded-md transition-colors"
                  title={sidebarCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
                  aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
                >
                  {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </button>
              </div>

              {/* Tabs Switcher and Search Bar directly in the header */}
              <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 min-w-0">
                <div className="soh-tab-switch">
                  <button
                    type="button"
                    className={`soh-tab-btn ${activeTab === 'sent' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab('sent');
                      window.history.replaceState(null, '', '/supply-offers');
                    }}
                  >
                    <Send size={15} />
                    <span>Submit Supply Offer (Sent Emails)</span>
                    <span className="soh-tab-badge">{sentOffers.length}</span>
                  </button>

                  <button
                    type="button"
                    className={`soh-tab-btn ${activeTab === 'submitted' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab('submitted');
                      window.history.replaceState(null, '', '/submittedoffer');
                    }}
                  >
                    <FileText size={15} />
                    <span>Submitted Offers</span>
                    <span className="soh-tab-badge">{submittedOffers.length}</span>
                  </button>

                  <button
                    type="button"
                    className={`soh-tab-btn ${activeTab === 'evaluation' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab('evaluation');
                      window.history.replaceState(null, '', '/commercial-evaluation');
                    }}
                  >
                    <Award size={15} />
                    <span>Commercial Evaluation (Step 5)</span>
                    <span className="soh-tab-badge">{evaluationGroups.length}</span>
                  </button>
                </div>

                {/* Search bar displayed right in the tabs row */}
                <div className="soh-search-box w-full sm:w-64 md:w-80">
                  <Search size={15} className="soh-search-icon" />
                  <input
                    type="text"
                    placeholder={
                      activeTab === 'sent'
                        ? 'Search RFQ Ref, Vendor, Product...'
                        : activeTab === 'submitted'
                          ? 'Search Offer Ref, Quotation, Vendor...'
                          : 'Search Evaluation Products, Quotes, Vendors...'
                    }
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="soh-search-input"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="soh-clear-btn"
                      onClick={() => setSearchQuery('')}
                      title="Clear search"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </header>

          <div className="soh-content">
            {/* Error Banner */}
            {error && (
              <div className="soh-error-banner">
                <Info size={18} />
                <span>{error}</span>
              </div>
            )}
            {/* <div className="soh-error-banner">
              <Info size={18} />
              <span>{error}</span>
            </div> */}


            {/* ========================================================================= */}
            {/* TAB 1: DISPATCHED RFQ EMAILS */}
            {/* ========================================================================= */}
            {activeTab === 'sent' && (
              <div className="soh-card">
                <div className="soh-card-header">
                  <div>
                    <h2 className="soh-card-title">All Sent Supply Offer Emails</h2>
                    <p className="soh-card-subtitle">
                      List of all sent RFQ emails. Click "Open Submit Offer Page" to open the pre-filled quotation submission form.
                    </p>
                  </div>
                  <div className="soh-table-count">
                    Showing <b>{filteredSentOffers.length}</b> of {sentOffers.length} sent emails
                  </div>
                </div>

                {loading ? (
                  <div className="soh-loading">
                    <RefreshCw size={28} className="soh-spin" />
                    <p>Loading dispatched RFQ offers...</p>
                  </div>
                ) : filteredSentOffers.length === 0 ? (
                  <div className="soh-empty">

                    <h3>No Dispatched RFQ Offers Found</h3>
                    <p>
                      {searchQuery
                        ? 'No sent offers match your search criteria. Try clearing the filter.'
                        : 'No vendor RFQ emails have been dispatched yet from the Admin Opportunities page.'}
                    </p>
                    <button
                      type="button"
                      className="soh-btn-primary"
                      onClick={() => navigate('/admin/opportunity-view')}
                    >
                      Go to Opportunities to Sent Supply Offer
                    </button>
                  </div>
                ) : (
                  <div className="soh-table-responsive">
                    <table className="soh-table">
                      <thead>
                        <tr>
                          <th style={{ width: '16%' }}>RFQ Reference</th>
                          <th style={{ width: '22%' }}>To Whom Sent (Vendor)</th>
                          <th style={{ width: '24%' }}>For Which Product & Demand</th>
                          <th style={{ width: '16%' }}>Offers Submitted</th>
                          <th style={{ width: '22%', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSentOffers.map((item) => {
                          const count = Number(item.SubmittedOffersCount) || 0;
                          const hasSubmitted = count > 0;
                          const submitUrl = item.SubmitOfferUrl || `/supply-offer?rfq=${encodeURIComponent(item.RfqReference)}`;

                          return (
                            <tr key={item.Id || item.RfqReference} className="soh-row">
                              {/* 1. RFQ Reference & Sent Date */}
                              <td>
                                <div className="soh-ref-badge">{item.RfqReference}</div>
                                <div className="soh-timestamp">
                                  <Calendar size={12} />
                                  <span>
                                    {item.SentAt
                                      ? new Date(item.SentAt).toLocaleDateString('en-IN', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric'
                                      })
                                      : 'Recently Sent'}
                                  </span>
                                </div>
                              </td>

                              {/* 2. To Whom The Offer Is Sent */}
                              <td>
                                <div className="soh-vendor-name">
                                  <Building size={14} className="soh-inline-icon" />
                                  <strong>{item.VendorName || 'Registered Vendor'}</strong>
                                </div>
                                <div className="soh-vendor-email">
                                  <Mail size={13} className="soh-inline-icon" />
                                  <span>{item.VendorEmail}</span>
                                </div>
                              </td>

                              {/* 3. For Which Product */}
                              <td>
                                <div className="soh-product-title">
                                  <strong>{item.ProductName}</strong>
                                  {item.Category && (
                                    <span className="soh-cat-pill">{item.Category}</span>
                                  )}
                                </div>
                                <div className="soh-product-specs">
                                  <span className="soh-demand-metric">
                                    Total Demand: <b>{item.TotalDemand} {item.Uom || 'MT'}</b>
                                  </span>
                                  {item.Grade && <span className="soh-grade"> • {item.Grade}</span>}
                                </div>
                                {item.Destination && (
                                  <div className="soh-dest-text">
                                    <MapPin size={12} />
                                    <span>{item.Destination}</span>
                                  </div>
                                )}
                              </td>

                              {/* 4. How Many Users Submitted Offer */}
                              <td>
                                {hasSubmitted ? (
                                  <div className="soh-count-badge success">
                                    <CheckCircle2 size={14} />
                                    <span>
                                      <b>{count}</b> {count === 1 ? 'Offer Submitted' : 'Offers Submitted'}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="soh-count-badge pending">
                                    <Clock size={14} />
                                    <span>0 Submitted (Pending)</span>
                                  </div>
                                )}

                                {hasSubmitted && item.LatestTotalValue && (
                                  <div className="soh-value-sub">
                                    Latest: ₹{Number(item.LatestTotalValue).toLocaleString('en-IN')}
                                  </div>
                                )}
                              </td>

                              {/* 5. Actions */}
                              <td style={{ textAlign: 'right' }}>
                                <div className="soh-actions-cell">
                                  <button
                                    type="button"
                                    className="soh-btn-submit-action"
                                    title="Open the exact pre-filled Supply Offer quotation form sent in email"
                                    onClick={() => handleOpenSubmitOffer(submitUrl, item.RfqReference)}
                                  >
                                    <span>Open Submit Offer Page</span>
                                    <ExternalLink size={13} />
                                  </button>


                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: SUBMITTED VENDOR QUOTATIONS */}
            {/* ========================================================================= */}
            {activeTab === 'submitted' && (
              <div className="soh-card">
                <div className="soh-card-header">
                  <div>
                    <h2 className="soh-card-title">Submitted Vendor Quotations</h2>
                    <p className="soh-card-subtitle">
                      Formal supply offers and pricing details submitted by vendors against aggregated RFQs.
                    </p>
                  </div>
                  <div className="soh-table-count">
                    Showing <b>{filteredSubmittedOffers.length}</b> of {submittedOffers.length} quotations
                  </div>
                </div>

                {loading ? (
                  <div className="soh-loading">
                    <RefreshCw size={28} className="soh-spin" />
                    <p>Loading submitted quotations...</p>
                  </div>
                ) : filteredSubmittedOffers.length === 0 ? (
                  <div className="soh-empty">

                    <h3>No Submitted Offers Found</h3>
                    <p>
                      {searchQuery
                        ? 'No quotations match your search criteria. Try a different term.'
                        : 'No vendors have submitted formal supply offers yet.'}
                    </p>
                    <button
                      type="button"
                      className="soh-btn-primary"
                      onClick={() => navigate('/supply-offer')}
                    >
                      Open Supply Offer Form
                    </button>
                  </div>
                ) : (
                  <div className="soh-table-responsive">
                    <table className="soh-table">
                      <thead>
                        <tr>
                          <th style={{ width: '15%' }}>Offer & Quotation No</th>
                          <th style={{ width: '13%' }}>RFQ Reference</th>
                          <th style={{ width: '18%' }}>Vendor Company</th>
                          <th style={{ width: '18%' }}>Product & Quantity</th>
                          <th style={{ width: '16%' }}>Offered Price & Total</th>
                          <th style={{ width: '20%', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSubmittedOffers.map((quote) => {
                          const rfqLink = `/supply-offer?rfq=${encodeURIComponent(quote.RfqReference)}&prodId=${encodeURIComponent(quote.OpportunityId || '')}&vendor=${encodeURIComponent(quote.VendorName)}&email=${encodeURIComponent(quote.VendorEmail)}&product=${encodeURIComponent(quote.ProductName)}&demand=${encodeURIComponent(quote.TotalRequiredDemand || quote.OfferedQuantity || 0)}&uom=${encodeURIComponent(quote.Uom || 'MT')}&dest=${encodeURIComponent(quote.Destination || '')}`;

                          return (
                            <tr key={quote.Id || quote.OfferReference} className="soh-row">
                              {/* 1. Offer Ref & Date */}
                              <td>
                                <div className="soh-ref-badge">{quote.OfferReference || `OFF-${quote.Id}`}</div>
                                <div className="soh-quotation-no">
                                  Quote #{quote.VendorQuotationNo || 'N/A'}
                                </div>
                                <div className="soh-timestamp">
                                  <Calendar size={12} />
                                  <span>
                                    {quote.CreatedAt
                                      ? new Date(quote.CreatedAt).toLocaleDateString('en-IN', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric'
                                      })
                                      : 'Recently'}
                                  </span>
                                </div>
                              </td>

                              {/* 2. RFQ Reference */}
                              <td>
                                <span className="soh-rfq-pill">{quote.RfqReference}</span>
                                <div className="soh-status-tag">
                                  <CheckCircle2 size={12} />
                                  <span>{quote.Status || 'Active'}</span>
                                </div>
                              </td>

                              {/* 3. Vendor Details */}
                              <td>
                                <div className="soh-vendor-name">
                                  <strong>{quote.VendorName}</strong>
                                </div>
                                <div className="soh-vendor-contact">{quote.ContactPerson}</div>
                                <div className="soh-vendor-email">{quote.VendorEmail}</div>
                              </td>

                              {/* 4. Product & Quantity */}
                              <td>
                                <div className="soh-product-title">
                                  <strong>{quote.ProductName}</strong>
                                </div>
                                <div className="soh-offered-qty">
                                  Offered: <b>{quote.OfferedQuantity} {quote.Uom || 'MT'}</b>
                                  {quote.CanSupplyFull ? (
                                    <span className="soh-full-badge">Full</span>
                                  ) : (
                                    <span className="soh-partial-badge">Partial</span>
                                  )}
                                </div>
                                <div className="soh-dest-text">
                                  <MapPin size={12} />
                                  <span>{quote.Destination || 'As per RFQ'}</span>
                                </div>
                              </td>

                              {/* 5. Commercial Breakdown */}
                              <td>
                                <div className="soh-unit-price">
                                  ₹{Number(quote.OfferedUnitPrice || 0).toLocaleString('en-IN')}/{quote.Uom || 'MT'}
                                </div>
                                <div className="soh-gst-info">
                                  + GST {quote.GstRate || '18%'}
                                  {quote.FreightIncluded ? ' • Freight Inc.' : ''}
                                </div>
                                <div className="soh-grand-total">
                                  Total: <b>₹{Number(quote.EstimatedTotalValue || 0).toLocaleString('en-IN')}</b>
                                </div>
                              </td>

                              {/* 6. Actions */}
                              <td style={{ textAlign: 'right' }}>
                                <div className="soh-actions-cell">
                                  <button
                                    type="button"
                                    className="soh-btn-submit-action"
                                    title="Open the submit offer page preloaded for this RFQ"
                                    onClick={() => handleOpenSubmitOffer(rfqLink, quote.RfqReference)}
                                  >
                                    <span>Open Submit Offer Page</span>
                                    <ExternalLink size={13} />
                                  </button>

                                  <button
                                    type="button"
                                    className="soh-btn-view-details"
                                    title="Open official quotation document & printable PDF"
                                    onClick={() => navigate(`/supply-offer/view?offerRef=${encodeURIComponent(quote.OfferReference)}`)}
                                  >
                                    📄 View PDF
                                  </button>

                                  <button
                                    type="button"
                                    className="soh-btn-secondary"
                                    style={{ padding: '6px 10px', fontSize: '11.5px' }}
                                    title="Quick inspection drawer"
                                    onClick={() => setSelectedQuote(quote)}
                                  >
                                    Details
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: COMMERCIAL EVALUATION & COMPARISON MATRIX (STEP 5) */}
            {/* ========================================================================= */}
            {activeTab === 'evaluation' && (
              <div className="soh-card">
                <div className="soh-card-header" style={{ borderBottom: 'none', paddingBottom: '8px' }}>

                </div>

                {/* Success Message Banner */}
                {actionSuccess && (
                  <div style={{ margin: '0 24px 16px 24px', padding: '12px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', color: '#065f46', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', fontWeight: '600' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} />
                      <span>{actionSuccess}</span>
                    </div>
                    <button type="button" onClick={() => setActionSuccess('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46' }}>
                      <X size={15} />
                    </button>
                  </div>
                )}

                {loading ? (
                  <div className="soh-loading">
                    <RefreshCw size={28} className="soh-spin" />
                    <p>Loading quotations for commercial evaluation...</p>
                  </div>
                ) : evaluationGroups.length === 0 ? (
                  <div className="soh-empty">
                    <Scale size={42} style={{ color: '#94a3b8', margin: '0 auto 16px auto' }} />
                    <h3>No Quotations Available for Evaluation</h3>
                    <p>
                      No sellers have submitted quotations yet. Once vendors respond to dispatched RFQs, their offers will appear here for commercial evaluation.
                    </p>
                    <button
                      type="button"
                      className="soh-btn-primary"
                      onClick={() => setActiveTab('sent')}
                    >
                      View Dispatched RFQ Offers
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: '0 24px 24px 24px' }}>
                    {/* Unified Commercial Evaluation Header: Product Info, Actions & Product Selector Dropdown */}
                    {activeEvalGroup && (
                      <div className="soh-eval-header-bar">
                        {/* 1. Product Info & Pooled Demand Parameters */}
                        <div className="soh-eval-header-info">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                              {activeEvalGroup.productName}
                            </h3>
                            <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                              {activeEvalGroup.rfqReference}
                            </span>
                            {activeEvalGroup.category && (
                              <span style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '4px' }}>
                                {activeEvalGroup.category}
                              </span>
                            )}
                          </div>
                          {/* <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', fontSize: '12.5px', color: '#475569', flexWrap: 'wrap' }}>
                            <span>Total Pooled Demand: <strong style={{ color: '#0f172a' }}>{activeEvalGroup.totalDemand} {activeEvalGroup.uom}</strong></span>
                            {activeEvalGroup.destination && <span>• Destination: <strong>{activeEvalGroup.destination}</strong></span>}
                            <span>• Competing Quotations: <strong>{activeEvalGroup.quotes.length}</strong></span>
                          </div> */}
                        </div>

                        {/* 2. Top Group Actions & Products Ready Dropdown (at last side) */}
                        <div className="soh-eval-header-controls">
                          {/* 1. Compare & Intelligent Ranking Button */}
                          <button
                            type="button"
                            style={{
                              background: compareMode ? '#0e7c86' : '#ffffff',
                              border: '1.5px solid #0e7c86',
                              color: compareMode ? '#ffffff' : '#0e7c86',
                              padding: '7px 14px',
                              borderRadius: '6px',
                              fontSize: '12.5px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: compareMode ? '0 1px 4px rgba(14, 124, 134, 0.25)' : 'none',
                              transition: 'all 0.15s ease'
                            }}
                            title={compareMode ? "Click to exit comparison" : "Compare competing quotations side-by-side with smart ranking"}
                            onClick={() => {
                              const next = !compareMode;
                              setCompareMode(next);
                              if (next) setCompareViewType('chart');
                            }}
                          >
                            <Scale size={14} />
                            <span>{compareMode ? 'Comparing' : 'Compare'}</span>
                            <span style={{
                              background: compareMode ? 'rgba(255,255,255,0.25)' : '#e0f2fe',
                              color: compareMode ? '#ffffff' : '#0369a1',
                              fontSize: '11px',
                              padding: '1px 6px',
                              borderRadius: '8px',
                              fontWeight: '700'
                            }}>
                              {activeEvalGroup.quotes.length} Quotes
                            </span>
                          </button>

                          {/* 2. Multi-Source Split Button */}
                          <button
                            type="button"
                            style={{
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              color: '#334155',
                              padding: '7px 12px',
                              borderRadius: '6px',
                              fontSize: '12.5px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.15s ease'
                            }}
                            title="Execute multi-source volume split across competing vendors"
                            onClick={() => {
                              const initSplits = {};
                              const count = activeEvalGroup.quotes.length;
                              const eachQty = count > 0 ? (activeEvalGroup.totalDemand / count).toFixed(1) : 0;
                              const eachPct = count > 0 ? (100 / count).toFixed(1) : 0;
                              activeEvalGroup.quotes.forEach(q => {
                                initSplits[q.OfferReference] = {
                                  allocatedQty: eachQty,
                                  splitPercent: eachPct,
                                  remarks: ''
                                };
                              });
                              setSplitState(initSplits);
                              setSplitModal({ group: activeEvalGroup });
                            }}
                          >
                            <Split size={14} className="text-purple-600" />
                            <span>Multi-Source Split</span>
                          </button>



                          {/* Divider */}
                          <div className="soh-eval-divider" />

                          {/* 4. Products Ready Dropdown at Last Side */}
                          <div className="soh-eval-product-dropdown-group">
                            <label htmlFor="eval-product-select" className="soh-eval-dropdown-label">
                              Products:
                            </label>
                            <div className="soh-eval-select-wrapper">
                              <select
                                id="eval-product-select"
                                className="soh-eval-select"
                                value={activeEvalGroup.key}
                                onChange={(e) => setSelectedEvalKey(e.target.value)}
                              >
                                {evaluationGroups.map((group) => {
                                  const hasAwarded = group.quotes.some(q => q.Status === 'Awarded' || q.Status === 'Split Awarded');
                                  const hasNegotiation = group.quotes.some(q => q.Status === 'Under Negotiation');
                                  const suffix = hasAwarded ? ' (Awarded)' : hasNegotiation ? ' (Negotiation)' : '';
                                  return (
                                    <option key={group.key} value={group.key}>
                                      {group.productName} ({group.rfqReference}) — {group.quotes.length} {group.quotes.length === 1 ? 'Quote' : 'Quotes'}{suffix}
                                    </option>
                                  );
                                })}
                              </select>
                              <ChevronDown size={14} className="soh-eval-select-arrow" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}



                    {/* Comparison Toolbar & Mode Selector */}
                    {activeEvalGroup && compareMode && (
                      <div className="soh-qcc-toolbar" style={{ marginTop: '16px', borderRadius: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a' }}>
                            Comparison Format:
                          </span>
                          <div className="soh-qcc-view-toggle">
                            <button
                              type="button"
                              className={`soh-qcc-view-btn ${compareViewType === 'chart' ? 'active' : ''}`}
                              onClick={() => setCompareViewType('chart')}
                              title="Corporate Excel Quotation Comparison Matrix"
                            >
                              <TableIcon size={14} />
                              <span>Quotation Comparison Chart</span>
                            </button>
                            <button
                              type="button"
                              className={`soh-qcc-view-btn ${compareViewType === 'cards' ? 'active' : ''}`}
                              onClick={() => setCompareViewType('cards')}
                              title="Detailed individual supplier offer cards"
                            >
                              <LayoutGrid size={14} />
                              <span>Cards View</span>
                            </button>
                          </div>
                        </div>

                        <div className="soh-qcc-tools-group">
                          <button
                            type="button"
                            className="soh-qcc-btn-tool"
                            onClick={() => window.print()}
                            title="Print or save comparison chart as PDF"
                          >
                            <Printer size={13} />
                            <span>Print / Save PDF</span>
                          </button>
                          <button
                            type="button"
                            className="soh-qcc-btn-tool"
                            onClick={handleExportComparisonCsv}
                            title="Download comparison sheet as CSV"
                          >
                            <Download size={13} />
                            <span>Export CSV</span>
                          </button>
                          <button
                            type="button"
                            className="soh-qcc-btn-tool"
                            style={{ background: '#f8fafc', color: '#64748b' }}
                            title="Exit comparison and return to normal view"
                            onClick={() => setCompareMode(false)}
                          >
                            <span>✕ Exit Comparison</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* VIEW OPTION A: QUOTATION COMPARISON CHART (HORIZONTAL SPREADSHEET MATRIX) */}
                    {activeEvalGroup && compareMode && compareViewType === 'chart' && (
                      <div className="soh-qcc-card">
                        <div className="soh-qcc-sheet-container">
                          <div className="soh-qcc-printable-area">
                            {/* Top Title Bar */}
                            <div className="soh-qcc-sheet-header">
                              <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#475569' }}>
                                RFQ: {activeEvalGroup.rfqReference}
                              </div>
                              <h2 className="soh-qcc-sheet-title">Quotation Comparison Chart</h2>
                              <div className="soh-qcc-sheet-date">
                                Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </div>
                            </div>

                            {/* 1. Supplier Master Summary Table (Subtle Warm Sand Header) */}
                            <table className="soh-qcc-table">
                              <thead>
                                <tr>
                                  <th className="soh-qcc-th-yellow" style={{ width: '90px' }}>Source</th>
                                  <th className="soh-qcc-th-yellow" style={{ width: '70px' }}>Supplier</th>
                                  <th className="soh-qcc-th-yellow" style={{ textAlign: 'left', minWidth: '170px' }}>Name</th>
                                  <th className="soh-qcc-th-yellow" style={{ width: '80px' }}>Country</th>

                                  <th className="soh-qcc-th-yellow" style={{ width: '120px' }}>Quotation No</th>
                                  <th className="soh-qcc-th-yellow" style={{ width: '95px' }}>Date</th>
                                  <th className="soh-qcc-th-yellow" style={{ minWidth: '120px', textAlign: 'right' }}>Basic Price</th>
                                  <th className="soh-qcc-th-yellow" style={{ minWidth: '110px', textAlign: 'right' }}>Offered Quantity</th>
                                  <th className="soh-qcc-th-yellow" style={{ minWidth: '120px' }}>Payment Terms</th>
                                  <th className="soh-qcc-th-yellow" style={{ minWidth: '110px' }}>Price Basis</th>
                                  <th className="soh-qcc-th-yellow" style={{ width: '90px' }}>Validity</th>
                                  <th className="soh-qcc-th-yellow" style={{ width: '80px' }}>MOQ</th>
                                </tr>
                              </thead>
                              <tbody>
                                {comparisonQuotes.map((q, idx) => (
                                  <tr
                                    key={q.quote.OfferReference || q.quote.Id}
                                    className={q.isGoodFit ? 'soh-qcc-row-good-fit' : ''}
                                  >
                                    {idx === 0 && (
                                      <td
                                        rowSpan={comparisonQuotes.length}
                                        className="soh-qcc-source-cell"
                                      >
                                        {comparisonQuotes.every(c => c.source === comparisonQuotes[0].source)
                                          ? (comparisonQuotes[0].source === 'DOMESTIC' ? 'Domestic' : 'International')
                                          : 'Domestic'}
                                      </td>
                                    )}
                                    <td className={`soh-qcc-supplier-index-cell ${q.isGoodFit ? 'good-fit' : ''}`}>{q.index}</td>
                                    <td style={{ fontWeight: '500', textAlign: 'left' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                        <div style={{ color: '#0f172a', fontWeight: '600' }}>{q.quote.VendorName}</div>
                                        {/* {q.isGoodFit && (
                                          <span className="soh-qcc-good-fit-pill">
                                            <CheckCircle2 size={10} />
                                            <span>Good Fit · All Factors ({q.score}/100)</span>
                                          </span>
                                        )} */}
                                      </div>
                                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                                        {q.quote.ContactPerson || q.quote.VendorEmail}
                                      </div>
                                    </td>
                                    <td style={{ textAlign: 'center', color: '#334155' }}>{q.country}</td>

                                    <td style={{ textAlign: 'center', fontWeight: '500', fontVariantNumeric: 'tabular-nums' }}>{q.quotationNo}</td>
                                    <td style={{ textAlign: 'center', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{q.quotationDate}</td>
                                    <td style={{ textAlign: 'right', fontWeight: '700', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                                      ₹{q.basicPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: '600', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                                      {q.qtyOffered.toLocaleString('en-IN')} {q.uom}
                                    </td>
                                    <td style={{ textAlign: 'center', color: '#334155' }}>{q.paymentTerms}</td>
                                    <td style={{ textAlign: 'center', color: '#334155' }}>{q.priceBasis}</td>
                                    <td style={{ textAlign: 'center', color: '#475569' }}>{q.validity}</td>
                                    <td style={{ textAlign: 'center', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>{q.moq}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            {/* 2. Product Details Header & Suppliers Offer Comparison Matrix */}
                            <table className="soh-qcc-table">
                              <thead>
                                {/* Product Details Header Row */}
                                <tr>
                                  <th className="soh-qcc-th-orange left-label" style={{ width: '220px' }}>
                                    Product Details
                                  </th>
                                  {comparisonQuotes.map((q, idx) => {
                                    let label = 'Product Code';
                                    let val = activeEvalGroup.productCode || activeEvalGroup.rfqReference || 'PROD-001';
                                    if (idx === 1) {
                                      label = 'Description';
                                      val = activeEvalGroup.productName;
                                    } else if (idx === 2) {
                                      label = 'Specification / Grade';
                                      val = activeEvalGroup.grade || 'Commercial Grade';
                                    } else if (idx > 2) {
                                      label = 'Specification / Grade';
                                      val = activeEvalGroup.grade || activeEvalGroup.productName;
                                    }
                                    return (
                                      <th
                                        key={q.quote.OfferReference || q.quote.Id}
                                        className={`soh-qcc-th-orange ${q.isGoodFit ? 'is-good-fit' : ''}`}
                                      >
                                        {/* {q.isGoodFit && (
                                          <div className="soh-qcc-col-good-fit-banner">
                                            <Award size={10} />
                                            <span>Good Fit ({q.score}/100)</span>
                                          </div>
                                        )} */}
                                        <div style={{ fontSize: '11px', color: '#78350f', fontWeight: '500' }}>{label}</div>
                                        <div style={{ fontSize: '12px', fontWeight: '600', marginTop: '2px', color: '#1e293b' }}>
                                          {val}
                                        </div>
                                      </th>
                                    );
                                  })}
                                </tr>
                              </thead>
                              <tbody>
                                {/* Row 1: Suppliers Offer */}
                                <tr>
                                  <td className="soh-qcc-th-cyan">Suppliers Offer</td>
                                  {comparisonQuotes.map(q => (
                                    <td
                                      key={q.quote.OfferReference || q.quote.Id}
                                      className={`soh-qcc-data-cell ${q.isGoodFit ? 'is-good-fit' : ''}`}
                                      style={{ fontWeight: '600' }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                                        <span style={{ fontSize: '13.5px', color: '#0f172a' }}>{q.index}</span>
                                        {q.isGoodFit && (
                                          <span className="soh-qcc-good-fit-pill">
                                            Good Fit
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ fontSize: '11.5px', color: '#475569', fontWeight: '500', marginTop: '2px' }}>
                                        {q.quote.VendorName}
                                      </div>
                                    </td>
                                  ))}
                                </tr>

                                {/* Row 2: Basic Price */}
                                <tr>
                                  <td className="soh-qcc-th-cyan">Basic Price</td>
                                  {comparisonQuotes.map(q => (
                                    <td
                                      key={q.quote.OfferReference || q.quote.Id}
                                      className={`soh-qcc-data-cell bold-price ${q.isGoodFit ? 'is-good-fit' : ''}`}
                                    >
                                      ₹{q.basicPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      <span style={{ fontSize: '11px', fontWeight: '400', color: '#64748b' }}> /{q.uom}</span>
                                    </td>
                                  ))}
                                </tr>

                                {/* Row 3: Offered Quantity */}
                                <tr>
                                  <td className="soh-qcc-th-cyan">Offered Quantity</td>
                                  {comparisonQuotes.map(q => (
                                    <td
                                      key={q.quote.OfferReference || q.quote.Id}
                                      className={`soh-qcc-data-cell ${q.isGoodFit ? 'is-good-fit' : ''}`}
                                      style={{ fontWeight: '500' }}
                                    >
                                      {q.qtyOffered.toLocaleString('en-IN')} {q.uom}
                                    </td>
                                  ))}
                                </tr>



                                {/* Row 6: Net Basic Price */}
                                <tr>
                                  <td className="soh-qcc-th-cyan">Net Basic Price</td>
                                  {comparisonQuotes.map(q => (
                                    <td
                                      key={q.quote.OfferReference || q.quote.Id}
                                      className={`soh-qcc-data-cell net-price ${q.isGoodFit ? 'is-good-fit' : ''}`}
                                    >
                                      ₹{q.netPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                  ))}
                                </tr>

                                {/* Row 7: GST Rate */}
                                <tr>
                                  <td className="soh-qcc-th-cyan">GST Rate</td>
                                  {comparisonQuotes.map(q => (
                                    <td
                                      key={q.quote.OfferReference || q.quote.Id}
                                      className={`soh-qcc-data-cell ${q.isGoodFit ? 'is-good-fit' : ''}`}
                                    >
                                      {q.gstRateNum}%
                                    </td>
                                  ))}
                                </tr>

                                {/* Row 8: GST Amount */}
                                <tr>
                                  <td className="soh-qcc-th-cyan">GST Amount</td>
                                  {comparisonQuotes.map(q => (
                                    <td
                                      key={q.quote.OfferReference || q.quote.Id}
                                      className={`soh-qcc-data-cell ${q.isGoodFit ? 'is-good-fit' : ''}`}
                                    >
                                      ₹{q.gstValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                  ))}
                                </tr>

                                {/* Row 9: Freight Charges */}
                                <tr>
                                  <td className="soh-qcc-th-cyan">Freight Charges</td>
                                  {comparisonQuotes.map(q => (
                                    <td
                                      key={q.quote.OfferReference || q.quote.Id}
                                      className={`soh-qcc-data-cell ${q.isGoodFit ? 'is-good-fit' : ''}`}
                                    >
                                      {q.isFreightInc ? (
                                        <span style={{ color: '#047857', fontWeight: '500' }}>Included</span>
                                      ) : (
                                        `₹${q.freightCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                      )}
                                    </td>
                                  ))}
                                </tr>

                                {/* Row 10: Net Landed Price (Excl. GST) */}
                                <tr>
                                  <td className="soh-qcc-th-cyan">Net Landed Price (Excl. GST)</td>
                                  {comparisonQuotes.map(q => (
                                    <td
                                      key={q.quote.OfferReference || q.quote.Id}
                                      className={`soh-qcc-data-cell ${q.isGoodFit ? 'is-good-fit' : ''}`}
                                      style={{ fontWeight: '600', fontSize: '13.5px', background: q.isGoodFit ? '#f0fdf9' : '#f8fafc' }}
                                    >
                                      ₹{q.netOfGstPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                  ))}
                                </tr>

                                {/* Row 11: Supplier Rating */}
                                <tr>
                                  <td className="soh-qcc-th-cyan">Supplier Rating</td>
                                  {comparisonQuotes.map(q => (
                                    <td
                                      key={q.quote.OfferReference || q.quote.Id}
                                      className={`soh-qcc-rating-cell ${q.isL1 ? 'is-l1' : q.rating === 'L2' ? 'is-l2' : 'is-l3'} ${q.isGoodFit ? 'is-good-fit-cell' : ''}`}
                                    >
                                      <div>{q.isL1 ? `${q.rating} · Lowest Landed` : q.rating}</div>
                                      {/* {q.isGoodFit && (
                                        <div style={{ fontSize: '10px', color: '#047857', fontWeight: '700', marginTop: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                                          <CheckCircle2 size={10} />
                                          <span>Good Fit · All Factors</span>
                                        </div>
                                      )} */}
                                    </td>
                                  ))}
                                </tr>

                                {/* Row 12: Actions & Decision (Interactive Row) */}
                                <tr className="soh-qcc-action-btns">
                                  <td className="soh-qcc-th-cyan" style={{ background: '#f1f5f9', color: '#0f172a' }}>
                                    Action / Decision
                                  </td>
                                  {comparisonQuotes.map(q => {
                                    const quote = q.quote;
                                    const isAwarded = quote.Status === 'Awarded';
                                    const isNegotiation = quote.Status === 'Under Negotiation';
                                    const isSplit = quote.Status === 'Split Awarded';

                                    return (
                                      <td
                                        key={quote.OfferReference || quote.Id}
                                        style={{
                                          padding: '12px 10px',
                                          textAlign: 'center',
                                          background: q.isGoodFit ? '#f0fdf9' : '#ffffff',
                                          verticalAlign: 'top',
                                          borderLeft: q.isGoodFit ? '2px solid #0e7c86' : undefined,
                                          borderRight: q.isGoodFit ? '2px solid #0e7c86' : undefined
                                        }}
                                      >
                                        <div style={{ marginBottom: '8px' }}>
                                          {isAwarded ? (
                                            <span className="soh-eval-status-badge awarded">
                                              <Award size={12} /> Awarded
                                            </span>
                                          ) : isSplit ? (
                                            <span className="soh-eval-status-badge" style={{ background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1' }}>
                                              <Split size={12} /> Split Award
                                            </span>
                                          ) : isNegotiation ? (
                                            <span className="soh-eval-status-badge negotiation">
                                              <MessageSquare size={12} /> Under Negotiation
                                            </span>
                                          ) : (
                                            <span className="soh-eval-status-badge received">
                                              <Clock size={12} /> Under Review
                                            </span>
                                          )}
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                          {!isAwarded && (
                                            <button
                                              type="button"
                                              style={{
                                                background: q.isGoodFit ? '#0e7c86' : q.isL1 ? '#047857' : '#1e293b',
                                                color: '#ffffff',
                                                border: 'none',
                                                padding: '6px 10px',
                                                borderRadius: '6px',
                                                fontSize: '11.5px',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '4px',
                                                boxShadow: q.isGoodFit ? '0 2px 6px rgba(14, 124, 134, 0.25)' : 'none',
                                                transition: 'background-color 140ms ease'
                                              }}
                                              onClick={() => {
                                                setAwardRemarks(`Approved based on competitive unit rate ₹${quote.OfferedUnitPrice}/${quote.Uom || 'MT'} and confirmed delivery lead time.`);
                                                setAwardModal({ quote, group: activeEvalGroup });
                                              }}
                                            >
                                              <Award size={12} />
                                              <span>{q.isGoodFit ? 'Award (Good Fit)' : 'Award Quotation'}</span>
                                            </button>
                                          )}

                                          {!isAwarded && (
                                            <button
                                              type="button"
                                              style={{
                                                background: '#ffffff',
                                                border: '1px solid #cbd5e1',
                                                color: '#334155',
                                                padding: '5px 8px',
                                                borderRadius: '6px',
                                                fontSize: '11px',
                                                fontWeight: '500',
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '4px',
                                                transition: 'background-color 140ms ease'
                                              }}
                                              onClick={() => {
                                                const suggestedCounter = Math.round(Number(quote.OfferedUnitPrice || 0) * 0.95);
                                                setCounterPrice(suggestedCounter > 0 ? String(suggestedCounter) : '');
                                                setCounterRemarks(`We have pooled ${activeEvalGroup.totalDemand} ${activeEvalGroup.uom} from verified buyers ready for immediate order if pricing can be matched.`);
                                                setCounterModal({ quote, group: activeEvalGroup });
                                              }}
                                            >
                                              <MessageSquare size={12} />
                                              <span>Counter-Offer</span>
                                            </button>
                                          )}

                                          <button
                                            type="button"
                                            style={{
                                              background: '#f8fafc',
                                              border: '1px solid #e2e8f0',
                                              color: '#64748b',
                                              padding: '5px 8px',
                                              borderRadius: '6px',
                                              fontSize: '11px',
                                              fontWeight: '500',
                                              cursor: 'pointer',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              gap: '4px',
                                              transition: 'background-color 140ms ease'
                                            }}
                                            onClick={() => navigate(`/supply-offer/view?offerRef=${encodeURIComponent(quote.OfferReference)}`)}
                                          >
                                            <span>View PDF</span>
                                            <ExternalLink size={11} />
                                          </button>
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              </tbody>
                            </table>


                          </div>
                        </div>
                      </div>
                    )}

                    {/* VIEW OPTION B (OR NORMAL VIEW): CARDS GRID */}
                    {activeEvalGroup && (!compareMode || compareViewType === 'cards') && (
                      <>
                        {compareMode && (
                          <div style={{
                            marginTop: '14px',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            flexWrap: 'wrap'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: '#475569' }}>
                                <SlidersHorizontal size={13} className="text-teal-600" />
                                <span>Filter & Rank by:</span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                {[
                                  { id: 'smart', label: 'Smart Match', tip: 'Overall multi-factor score (Location + Price + Speed + Credit)' },
                                  { id: 'location_match', label: `Location (${activeEvalGroup.destination || 'Plant'})`, tip: 'Vendors delivering directly to your target destination' },
                                  { id: 'price_asc', label: 'Lowest Landed Price', tip: 'Cheapest total landed unit cost' },
                                  { id: 'speed_asc', label: 'Fastest Lead Time', tip: 'Quickest turnaround & ready stock' },
                                  { id: 'credit_desc', label: 'Best Credit Terms', tip: 'Longest credit period (30/60 Days)' },
                                  { id: 'capacity_desc', label: 'Highest Capacity', tip: 'Vendors offering full volume' }
                                ].map(tab => (
                                  <button
                                    key={tab.id}
                                    type="button"
                                    style={{
                                      background: evalFilterCriterion === tab.id ? '#0e7c86' : '#f8fafc',
                                      color: evalFilterCriterion === tab.id ? '#ffffff' : '#334155',
                                      border: evalFilterCriterion === tab.id ? '1px solid #0e7c86' : '1px solid #e2e8f0',
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: evalFilterCriterion === tab.id ? '600' : '500',
                                      cursor: 'pointer',
                                      transition: 'all 140ms ease'
                                    }}
                                    onClick={() => setEvalFilterCriterion(tab.id)}
                                    title={tab.tip}
                                  >
                                    {tab.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '12px', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                                Showing <b>{comparisonAnalysis.sortedList.length}</b> competing quotes
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="soh-eval-matrix-grid" style={{ marginTop: '16px' }}>
                          {(compareMode ? comparisonAnalysis.sortedList : comparisonAnalysis.evaluatedList).map((item, idx) => {
                            const quote = item.quote;
                            const isAwarded = quote.Status === 'Awarded';
                            const isNegotiation = quote.Status === 'Under Negotiation';
                            const isSplit = quote.Status === 'Split Awarded';
                            const isNotSelected = quote.Status === 'Not Selected';

                            // Landed Unit Price Calculation
                            const basePrice = item.basePrice;
                            const freightExtra = !quote.FreightIncluded ? (Number(quote.FreightCharges || 0)) : 0;
                            const otherCharges = Number(quote.OtherCharges || 0);
                            const netLandedRate = item.netLandedRate;
                            const isBestOverall = quote.OfferReference === comparisonAnalysis.bestQuoteRef;
                            const isLowestPrice = quote.OfferReference === comparisonAnalysis.lowestPriceRef;

                            const offeredQty = item.offeredQty;
                            const totalDemand = Number(activeEvalGroup.totalDemand || 0);
                            const supplyPercent = totalDemand > 0 ? Math.min(100, Math.round((offeredQty / totalDemand) * 100)) : 100;

                            return (
                              <div
                                key={quote.Id || quote.OfferReference}
                                className={`soh-eval-card ${isAwarded ? 'is-awarded' : isNegotiation ? 'is-negotiation' : ''}`}
                              >
                                {/* Card Rank Header Ribbon */}
                                {compareMode && (
                                  <div style={{
                                    background: idx === 0 ? '#0e7c86' : '#f8fafc',
                                    color: idx === 0 ? '#ffffff' : '#64748b',
                                    borderBottom: '1px solid #e2e8f0',
                                    padding: '5px 14px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontVariantNumeric: 'tabular-nums'
                                  }}>
                                    <span>
                                      {idx === 0 ? `Rank 1 · ${isBestOverall ? 'Recommended Bid' : evalFilterCriterion.replace('_', ' ')}` : `Rank ${idx + 1}`}
                                    </span>
                                    <span>
                                      Score {item.totalScore}/100 {item.isExactLocation && ' · Direct Location'}
                                    </span>
                                  </div>
                                )}
                                {/* Card Header */}
                                <div className="soh-eval-card-header">
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                      <span className="soh-eval-bid-tag">Bid {idx + 1}</span>
                                      <span className="soh-ref-badge">{quote.OfferReference || `OFF-${quote.Id}`}</span>
                                      {quote.VendorQuotationNo && (
                                        <span style={{ fontSize: '11px', color: '#64748b' }}>Quote #{quote.VendorQuotationNo}</span>
                                      )}
                                    </div>
                                    <h4 className="soh-eval-card-vendor" title={quote.VendorName}>
                                      {quote.VendorName}
                                    </h4>
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                                      {quote.ContactPerson ? `${quote.ContactPerson} • ` : ''}{quote.VendorEmail || ''}
                                    </div>
                                  </div>

                                  {/* Status Badge & Lowest Landed Indicator */}
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                    {isAwarded ? (
                                      <span className="soh-eval-status-badge awarded">
                                        <Award size={12} />
                                        <span>Awarded</span>
                                      </span>
                                    ) : isSplit ? (
                                      <span className="soh-eval-status-badge" style={{ background: '#f5f3ff', color: '#5b21b6', border: '1px solid #ddd6fe' }}>
                                        <Split size={12} />
                                        <span>Split Award</span>
                                      </span>
                                    ) : isNegotiation ? (
                                      <span className="soh-eval-status-badge negotiation">
                                        <MessageSquare size={12} />
                                        <span>Negotiation</span>
                                      </span>
                                    ) : isNotSelected ? (
                                      <span className="soh-eval-status-badge not-selected">
                                        <span>Not Selected</span>
                                      </span>
                                    ) : (
                                      <span className="soh-eval-status-badge received">
                                        <Clock size={12} />
                                        <span>Under Review</span>
                                      </span>
                                    )}
                                    {isLowestPrice && (
                                      <span style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontSize: '10px', fontWeight: '600', padding: '1px 5px', borderRadius: '4px' }}>
                                        Lowest Landed
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Card Body: High-Density Institutional Layout */}
                                <div className="soh-eval-card-body">
                                  {/* 1. Commercial Pricing Strip */}
                                  <div className="soh-eval-card-pricing-bar">
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div className="soh-eval-field-label">1. Net Landed Unit Rate</div>
                                      <div className="soh-eval-rate-val">
                                        ₹{Number(netLandedRate).toLocaleString('en-IN')}
                                        <span className="soh-eval-uom">/{quote.Uom || 'MT'}</span>
                                      </div>
                                      <div className="soh-eval-formula">
                                        Basic: ₹{Number(basePrice).toLocaleString('en-IN')}
                                        {quote.FreightIncluded ? ' · Freight Included' : freightExtra > 0 ? ` · +₹${freightExtra} Frt` : ''}
                                        {otherCharges > 0 && ` · +₹${otherCharges} Platform Fee`}
                                        {quote.GstRate && ` · +${quote.GstRate} GST`}
                                      </div>
                                    </div>

                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                      <div className="soh-eval-field-label">Total Contract Value</div>
                                      <div className="soh-eval-total-val">
                                        ₹{Number(quote.EstimatedTotalValue || 0).toLocaleString('en-IN')}
                                      </div>
                                      <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                                        Full Landed Estimate
                                      </div>
                                    </div>
                                  </div>

                                  {/* 2. Three-Quadrant Parameter Grid (Capacity, Logistics, Payment) */}
                                  <div className="soh-eval-params-grid">
                                    {/* Parameter 1: Capacity & Availability */}
                                    <div className="soh-eval-param-cell">
                                      <div className="soh-eval-param-title">
                                        <Warehouse size={11} className="text-blue-600" />
                                        <span>2. Supply Capacity</span>
                                      </div>
                                      <div className="soh-eval-param-main">
                                        <span>{quote.OfferedQuantity} {quote.Uom || 'MT'}</span>
                                        <span className="soh-eval-pct-pill">
                                          {supplyPercent}% demand
                                        </span>
                                      </div>
                                      <div className="soh-eval-param-sub">
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded mr-1 ${quote.CanSupplyFull ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                          {quote.CanSupplyFull ? 'Full Supply' : 'Partial'}
                                        </span>
                                        MOQ: <b>{quote.Moq || '1'} {quote.Uom || 'MT'}</b> · {quote.ProductAvailability || 'Ready Stock'}
                                      </div>
                                    </div>

                                    {/* Parameter 2: Delivery & Transport */}
                                    <div className="soh-eval-param-cell">
                                      <div className="soh-eval-param-title">
                                        <Clock size={11} className="text-orange-600" />
                                        <span>3. Lead Time & Transport</span>
                                      </div>
                                      <div className="soh-eval-param-main">
                                        <span>{quote.DeliveryLeadTimeDays ? `${quote.DeliveryLeadTimeDays} Days turnaround` : 'Standard turnaround'}</span>
                                      </div>
                                      <div className="soh-eval-param-sub">
                                        Scope: <b>{quote.TransportationResponsibility || 'Vendor'}</b>
                                        {quote.ExpectedDispatchDate && ` · Dispatch: ${new Date(quote.ExpectedDispatchDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                                      </div>
                                      <div className="soh-eval-dest-tag">
                                        {item.isExactLocation ? (
                                          <span className="text-emerald-700">📍 Direct: {activeEvalGroup.destination || quote.Destination || 'Plant'}</span>
                                        ) : (
                                          <span className="text-amber-800">🚚 Dest: {quote.Destination || 'Vendor Plant'}</span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Parameter 3: Payment Terms & Credit */}
                                    <div className="soh-eval-param-cell">
                                      <div className="soh-eval-param-title">
                                        <CreditCard size={11} className="text-indigo-600" />
                                        <span>4. Payment & Credit</span>
                                      </div>
                                      <div className="soh-eval-param-main">
                                        <span>{quote.PaymentTerms || 'Standard Terms'}</span>
                                      </div>
                                      <div className="soh-eval-param-sub">
                                        Advance: <b>{quote.AdvancePaymentPercentage || 0}%</b> · Credit: <b>{quote.CreditPeriodDays || 0} Days</b>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Split Allocation or Vendor Remarks */}
                                  {quote.CommercialRemarks && (
                                    <div className="soh-eval-remarks-box">
                                      {quote.CommercialRemarks.includes('[SPLIT ALLOCATION]') ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#5b21b6', fontSize: '11.5px', fontWeight: '600' }}>
                                          <Split size={13} className="text-purple-600 flex-shrink-0" />
                                          <span>{quote.CommercialRemarks.replace(/\[SPLIT ALLOCATION\]:?\s*/i, 'Split Award Allocation: ')}</span>
                                        </div>
                                      ) : (
                                        <div style={{ fontSize: '11px', color: '#475569' }}>
                                          <strong style={{ color: '#334155' }}>Vendor Remarks:</strong> {quote.CommercialRemarks}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Card Footer: Compact Single-Row Action Strip */}
                                <div className="soh-eval-card-footer-compact">
                                  {!isAwarded && (
                                    <button
                                      type="button"
                                      className="soh-eval-btn-award-compact"
                                      onClick={() => {
                                        setAwardRemarks(`Approved based on competitive unit rate ₹${quote.OfferedUnitPrice}/${quote.Uom || 'MT'} and confirmed delivery lead time.`);
                                        setAwardModal({ quote, group: activeEvalGroup });
                                      }}
                                      title="Award & Approve Quotation"
                                    >
                                      <Award size={13} />
                                      <span>Award</span>
                                    </button>
                                  )}

                                  {isAwarded && (
                                    <div className="soh-eval-awarded-pill">
                                      <CheckCircle2 size={13} />
                                      <span>Winning Seller Awarded</span>
                                    </div>
                                  )}

                                  {!isAwarded && (
                                    <button
                                      type="button"
                                      className="soh-eval-btn-negotiate-compact"
                                      onClick={() => {
                                        const suggestedCounter = Math.round(Number(quote.OfferedUnitPrice || 0) * 0.95);
                                        setCounterPrice(suggestedCounter > 0 ? String(suggestedCounter) : '');
                                        setCounterRemarks(`We have pooled ${activeEvalGroup.totalDemand} ${activeEvalGroup.uom} from verified buyers ready for immediate order if pricing can be matched.`);
                                        setCounterModal({ quote, group: activeEvalGroup });
                                      }}
                                      title="Request Price Revision / Counter-Offer"
                                    >
                                      <MessageSquare size={13} />
                                      <span>Counter-Offer</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    className="soh-eval-btn-pdf-compact"
                                    onClick={() => navigate(`/supply-offer/view?offerRef=${encodeURIComponent(quote.OfferReference)}`)}
                                    title="View Official Quotation PDF"
                                  >
                                    <FileText size={12} />
                                    <span>View PDF</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* ========================================================================= */}
                    {/* STAGE 7: BUYER ALLOCATION ENGINE & INDIVIDUAL CONSORTIUM OFFERS */}
                    {/* ========================================================================= */}
                    {activeEvalGroup && (
                      <div className="soh-alloc-section">
                        <div className="soh-alloc-header">
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ background: '#0e7c86', color: '#ffffff', fontSize: '10.5px', fontWeight: '800', padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Stage 7
                              </span>
                              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                                Buyer Allocation Engine & Consortium Offers
                              </h3>
                              <span style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px' }}>
                                {buyerAllocations.length} {buyerAllocations.length === 1 ? 'Buyer Allocation' : 'Buyer Allocations'}
                              </span>
                            </div>
                            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                              Proportional volume quotas allocated across participating buyers. Sourcing terms are direct from manufacturer with zero intermediary fee. <b>Emails are dispatched strictly upon clicking "Send Offer Email".</b>
                            </p>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button
                              type="button"
                              onClick={() => handleGenerateAllocations()}
                              disabled={allocationsGenerating}
                              style={{
                                background: '#0e7c86',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '8px 14px',
                                fontSize: '12.5px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 2px 6px rgba(14, 124, 134, 0.2)'
                              }}
                              title="Compute and sync buyer quotas based on the awarded quotation"
                            >
                              <RefreshCw size={14} className={allocationsGenerating ? 'soh-spin' : ''} />
                              <span>{allocationsGenerating ? 'Generating Allocations...' : '⚡ Generate / Sync Allocations'}</span>
                            </button>
                          </div>
                        </div>

                        {allocationsLoading ? (
                          <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                            <RefreshCw size={24} className="soh-spin" style={{ margin: '0 auto 10px auto' }} />
                            <p style={{ margin: 0, fontSize: '13px' }}>Loading buyer allocations...</p>
                          </div>
                        ) : buyerAllocations.length === 0 ? (
                          <div style={{ padding: '36px 20px', textAlign: 'center', background: '#fafaf9' }}>
                            <Users size={36} style={{ color: '#cbd5e1', margin: '0 auto 12px auto' }} />
                            <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: '#334155', fontWeight: '700' }}>
                              No Buyer Allocations Generated Yet
                            </h4>
                            <p style={{ margin: '0 auto 16px auto', maxWidth: '520px', fontSize: '12.5px', color: '#64748b', lineHeight: '1.5' }}>
                              Once a quotation is awarded for <b>{activeEvalGroup.productName}</b>, you can generate individual buyer quotas. Each buyer will receive direct factory pricing and a live 48-hour reservation countdown.
                            </p>
                            <button
                              type="button"
                              className="soh-alloc-btn-email"
                              style={{ padding: '8px 16px', fontSize: '12.5px' }}
                              onClick={() => handleGenerateAllocations()}
                              disabled={allocationsGenerating}
                            >
                              <RefreshCw size={14} className={allocationsGenerating ? 'soh-spin' : ''} />
                              <span>Generate Allocations from Winning Quote</span>
                            </button>
                          </div>
                        ) : (
                          <div className="soh-alloc-table-wrapper">
                            <table className="soh-alloc-table">
                              <thead>
                                <tr>
                                  <th>Allocation Ref</th>
                                  <th>Buyer Company (Admin Only)</th>
                                  <th>Location</th>
                                  <th>Volume Quota</th>
                                  <th>Factory Price & Landed Value</th>
                                  <th>Status & Validity</th>
                                  <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {buyerAllocations.map((alloc) => {
                                  const statusLower = (alloc.Status || 'allocated').toLowerCase().replace(/\s+/g, '');
                                  const isSending = Boolean(emailSendingState[alloc.AllocationRef]);
                                  const isAccepted = alloc.Status === 'Accepted';
                                  const isDeclined = alloc.Status === 'Declined';
                                  const isSent = alloc.Status === 'Offer Sent';

                                  return (
                                    <tr key={alloc.AllocationRef || alloc.Id}>
                                      {/* 1. Allocation Ref */}
                                      <td>
                                        <div style={{ fontWeight: '700', color: '#0f172a', fontFamily: 'monospace', fontSize: '12px' }}>
                                          {alloc.AllocationRef}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                          RFQ: {alloc.RfqReference}
                                        </div>
                                      </td>

                                      {/* 2. Buyer Details (Admin View Only) */}
                                      <td>
                                        <div style={{ fontWeight: '700', color: '#0f172a' }}>
                                          {alloc.BuyerCompanyName}
                                        </div>
                                        <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '2px' }}>
                                          {alloc.BuyerContactPerson && <span>{alloc.BuyerContactPerson} • </span>}
                                          <span style={{ color: '#0e7c86' }}>{alloc.BuyerEmail}</span>
                                        </div>
                                        {alloc.BuyerPhone && (
                                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                                            Ph: {alloc.BuyerPhone}
                                          </div>
                                        )}
                                      </td>

                                      {/* 3. Destination */}
                                      <td>
                                        <div style={{ fontSize: '12.5px', color: '#1e293b', fontWeight: '500' }}>
                                          {alloc.DeliveryLocation || 'Domestic Delivery'}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                                          Region: {alloc.Region || 'Domestic'}
                                        </div>
                                      </td>

                                      {/* 4. Volume Quota */}
                                      <td>
                                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                                          {alloc.AllocatedQuantity} {alloc.Uom}
                                        </div>
                                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                                          Requested: {alloc.RequestedQuantity} {alloc.Uom}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#0e7c86', fontWeight: '600' }}>
                                          {alloc.TotalPoolDemand > 0 ? `${Math.round((alloc.AllocatedQuantity / alloc.TotalPoolDemand) * 100)}% of Pooled Demand` : ''}
                                        </div>
                                      </td>

                                      {/* 5. Pricing & Valuation */}
                                      <td>
                                        <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                                          {alloc.Currency === 'USD' ? '$' : '₹'}{Number(alloc.OfferedUnitPrice).toLocaleString('en-IN')}/{alloc.Uom}
                                        </div>
                                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                                          Freight: {alloc.FreightIncluded ? 'Included' : `₹${alloc.FreightCharges}`} • GST: {alloc.GstRate}
                                        </div>
                                        <div style={{ fontSize: '12px', fontWeight: '800', color: '#047857', marginTop: '2px' }}>
                                          Total: {alloc.Currency === 'USD' ? '$' : '₹'}{Number(alloc.TotalEstimatedValue).toLocaleString('en-IN')}
                                        </div>
                                      </td>

                                      {/* 6. Status & Timer */}
                                      <td>
                                        <div>
                                          <span className={`soh-alloc-badge ${statusLower}`}>
                                            {isAccepted ? <CheckCircle2 size={11} /> : isSent ? <Mail size={11} /> : <Clock size={11} />}
                                            <span>{alloc.Status}</span>
                                          </span>
                                        </div>
                                        {alloc.OfferEmailSentAt && (
                                          <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '4px' }}>
                                            Sent: {new Date(alloc.OfferEmailSentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                          </div>
                                        )}
                                        {alloc.OfferValidUntil && !isAccepted && !isDeclined && (
                                          <div style={{ fontSize: '10.5px', color: '#d97706', fontWeight: '600', marginTop: '2px' }}>
                                            Valid: {new Date(alloc.OfferValidUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                          </div>
                                        )}
                                      </td>

                                      {/* 7. Action Buttons */}
                                      <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                                          {/* View Buyer Page */}
                                          <a
                                            href={`/buyer/offer/${encodeURIComponent(alloc.AllocationRef)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="soh-alloc-btn-view"
                                            title="Preview the exact confidential offer page the buyer views"
                                          >
                                            <ExternalLink size={12} />
                                            <span>View Page</span>
                                          </a>

                                          {/* Manual Email Trigger Button */}
                                          {!isAccepted && !isDeclined && (
                                            <button
                                              type="button"
                                              className="soh-alloc-btn-email"
                                              disabled={isSending}
                                              onClick={() => setEmailConfirmModal({ allocation: alloc })}
                                              title="Send official offer email to this buyer with 48h reservation timer"
                                            >
                                              {isSending ? (
                                                <>
                                                  <RefreshCw size={12} className="soh-spin" />
                                                  <span>Sending...</span>
                                                </>
                                              ) : (
                                                <>
                                                  <Mail size={12} />
                                                  <span>{isSent ? 'Resend Email' : 'Send Offer Email'}</span>
                                                </>
                                              )}
                                            </button>
                                          )}

                                          {isAccepted && (
                                            <span style={{ fontSize: '11px', color: '#065f46', fontWeight: '700', padding: '4px 8px', background: '#ecfdf5', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                                              ✓ Order Accepted
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* QUOTATION DETAILS MODAL */}
          {/* ========================================================================= */}
          {selectedQuote && (
            <div className="soh-modal-overlay" onClick={() => setSelectedQuote(null)}>
              <div className="soh-modal-card" onClick={e => e.stopPropagation()}>
                <div className="soh-modal-header">
                  <div className="soh-modal-title-group">
                    <span className="soh-modal-badge">{selectedQuote.OfferReference || 'Quotation'}</span>
                    <h2>Quotation Details: {selectedQuote.VendorQuotationNo}</h2>
                  </div>
                  <button
                    type="button"
                    className="soh-modal-close"
                    onClick={() => setSelectedQuote(null)}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="soh-modal-body">
                  {/* Top Summary Bar */}
                  <div className="soh-modal-summary-bar">
                    <div className="soh-sum-item">
                      <span className="soh-sum-label">Vendor Company</span>
                      <strong className="soh-sum-value">{selectedQuote.VendorName}</strong>
                    </div>
                    <div className="soh-sum-item">
                      <span className="soh-sum-label">RFQ Reference</span>
                      <strong className="soh-sum-value">{selectedQuote.RfqReference}</strong>
                    </div>
                    <div className="soh-sum-item">
                      <span className="soh-sum-label">Quotation Date</span>
                      <strong className="soh-sum-value">{selectedQuote.QuotationDate || 'N/A'}</strong>
                    </div>
                    <div className="soh-sum-item">
                      <span className="soh-sum-label">Valid Until</span>
                      <strong className="soh-sum-value">{selectedQuote.QuotationValidUntil || '15 Days'}</strong>
                    </div>
                  </div>

                  {/* Product & Scope */}
                  <div className="soh-section-box">
                    <h4 className="soh-section-title">Product & Supply Parameters</h4>
                    <div className="soh-grid-3">
                      <div>
                        <span className="soh-detail-label">Product Name</span>
                        <p className="soh-detail-val">{selectedQuote.ProductName}</p>
                      </div>
                      <div>
                        <span className="soh-detail-label">Category / Grade</span>
                        <p className="soh-detail-val">{selectedQuote.Category || 'Industrial'} / {selectedQuote.Grade || 'Standard'}</p>
                      </div>
                      <div>
                        <span className="soh-detail-label">Supply Capability</span>
                        <p className="soh-detail-val">
                          {selectedQuote.CanSupplyFull ? 'Full Aggregated Demand' : 'Partial Supply Only'}
                        </p>
                      </div>
                      <div>
                        <span className="soh-detail-label">Offered Quantity</span>
                        <p className="soh-detail-val">{selectedQuote.OfferedQuantity} {selectedQuote.Uom}</p>
                      </div>
                      <div>
                        <span className="soh-detail-label">MOQ</span>
                        <p className="soh-detail-val">{selectedQuote.Moq || '1'} {selectedQuote.Uom}</p>
                      </div>
                      <div>
                        <span className="soh-detail-label">Packaging Type</span>
                        <p className="soh-detail-val">{selectedQuote.PackagingType || 'Standard'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Commercial Pricing Breakdown */}
                  <div className="soh-section-box highlight">
                    <h4 className="soh-section-title">Commercials & Valuation</h4>
                    <div className="soh-grid-4">
                      <div>
                        <span className="soh-detail-label">Offered Unit Price</span>
                        <p className="soh-detail-val price">
                          ₹{Number(selectedQuote.OfferedUnitPrice || 0).toLocaleString('en-IN')}/{selectedQuote.Uom}
                        </p>
                      </div>
                      <div>
                        <span className="soh-detail-label">GST Rate / Amount</span>
                        <p className="soh-detail-val">
                          {selectedQuote.GstRate || '18%'} (₹{Number(selectedQuote.GstAmount || 0).toLocaleString('en-IN')})
                        </p>
                      </div>
                      <div>
                        <span className="soh-detail-label">Freight Charges</span>
                        <p className="soh-detail-val">
                          {selectedQuote.FreightIncluded ? 'Included in Unit Price' : `₹${Number(selectedQuote.FreightCharges || 0).toLocaleString('en-IN')}`}
                        </p>
                      </div>
                      <div>
                        <span className="soh-detail-label">Estimated Grand Total</span>
                        <p className="soh-detail-val total">
                          ₹{Number(selectedQuote.EstimatedTotalValue || 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Logistics & Payment Terms */}
                  <div className="soh-section-box">
                    <h4 className="soh-section-title">Logistics & Commercial Terms</h4>
                    <div className="soh-grid-3">
                      <div>
                        <span className="soh-detail-label">Delivery Lead Time</span>
                        <p className="soh-detail-val">{selectedQuote.DeliveryLeadTimeDays || '7-14'} Days</p>
                      </div>
                      <div>
                        <span className="soh-detail-label">Payment Terms</span>
                        <p className="soh-detail-val">{selectedQuote.PaymentTerms || '30 Days Net'}</p>
                      </div>
                      <div>
                        <span className="soh-detail-label">Transportation</span>
                        <p className="soh-detail-val">{selectedQuote.TransportationResponsibility || 'Supplier Scope'}</p>
                      </div>
                    </div>
                    {selectedQuote.CommercialRemarks && (
                      <div style={{ marginTop: '12px' }}>
                        <span className="soh-detail-label">Supplier Remarks / Notes</span>
                        <p className="soh-detail-val remarks">{selectedQuote.CommercialRemarks}</p>
                      </div>
                    )}
                  </div>

                  {/* Platform Declaration Note */}
                  <div className="soh-disclaimer-note">
                    <ShieldCheck size={16} />
                    <span>
                      Synergy5M operates exclusively as a B2B aggregation, demand pooling, and facilitation platform.
                      Commercial execution, warranties, and billing are concluded directly between matched buyers and suppliers.
                    </span>
                  </div>
                </div>

                <div className="soh-modal-footer">
                  <button
                    type="button"
                    className="soh-btn-secondary"
                    onClick={() => setSelectedQuote(null)}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="soh-btn-secondary"
                    onClick={() => {
                      const ref = selectedQuote.OfferReference;
                      setSelectedQuote(null);
                      navigate(`/supply-offer/view?offerRef=${encodeURIComponent(ref)}`);
                    }}
                  >
                    <FileText size={14} />
                    <span>View Official Document (PDF)</span>
                  </button>
                  <button
                    type="button"
                    className="soh-btn-primary"
                    onClick={() => {
                      setSelectedQuote(null);
                      handleOpenSubmitOffer(
                        `/supply-offer?rfq=${encodeURIComponent(selectedQuote.RfqReference)}&prodId=${encodeURIComponent(selectedQuote.OpportunityId || '')}&vendor=${encodeURIComponent(selectedQuote.VendorName)}&email=${encodeURIComponent(selectedQuote.VendorEmail)}&product=${encodeURIComponent(selectedQuote.ProductName)}&demand=${encodeURIComponent(selectedQuote.TotalRequiredDemand || selectedQuote.OfferedQuantity || 0)}&uom=${encodeURIComponent(selectedQuote.Uom || 'MT')}&dest=${encodeURIComponent(selectedQuote.Destination || '')}`,
                        selectedQuote.RfqReference
                      );
                    }}
                  >
                    <span>Open in Supply Offer Form</span>
                    <ArrowUpRight size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODAL 1: AWARD & APPROVE QUOTATION CONFIRMATION */}
          {/* ========================================================================= */}
          {awardModal && (
            <div className="soh-modal-overlay" onClick={() => !actionLoading && setAwardModal(null)}>
              <div className="soh-modal-card" style={{ maxWidth: '540px' }} onClick={e => e.stopPropagation()}>
                <div className="soh-modal-header">
                  <div className="soh-modal-title-group">
                    <span className="soh-modal-badge" style={{ background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' }}>
                      Option A · Awarding
                    </span>
                    <h2>Award Quotation to {awardModal.quote.VendorName}</h2>
                  </div>
                  <button type="button" className="soh-modal-close" onClick={() => setAwardModal(null)}>
                    <X size={18} />
                  </button>
                </div>

                <div className="soh-modal-body">
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', color: '#15803d', fontWeight: '700', marginBottom: '6px' }}>
                      Award Commercial Summary:
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#166534', lineHeight: '1.6' }}>
                      <div>• <strong>Product:</strong> {awardModal.quote.ProductName} ({awardModal.quote.Grade || 'Standard'})</div>
                      <div>• <strong>Offered Rate:</strong> ₹{Number(awardModal.quote.OfferedUnitPrice).toLocaleString('en-IN')}/{awardModal.quote.Uom || 'MT'}</div>
                      <div>• <strong>Awarded Volume:</strong> {awardModal.quote.OfferedQuantity} {awardModal.quote.Uom || 'MT'}</div>
                      <div>• <strong>Total Contract Value:</strong> ₹{Number(awardModal.quote.EstimatedTotalValue || 0).toLocaleString('en-IN')}</div>
                    </div>
                  </div>

                  <p style={{ fontSize: '12.5px', color: '#475569', margin: '0 0 12px 0' }}>
                    Confirming will mark this quotation status as <span style={{ color: '#059669', fontWeight: '700' }}>Awarded</span>, mark the RFQ opportunity as <span style={{ color: '#059669', fontWeight: '700' }}>Closed / Won</span>, and dispatch an official award notice email to the vendor.
                  </p>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                      Award Notes / Decision Remarks (Optional):
                    </label>
                    <textarea
                      rows={3}
                      value={awardRemarks}
                      onChange={e => setAwardRemarks(e.target.value)}
                      placeholder="e.g. Sourcing committee selected vendor due to prompt delivery lead time and confirmed factory capacity."
                      style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div className="soh-modal-footer">
                  <button
                    type="button"
                    className="soh-btn-secondary"
                    disabled={actionLoading}
                    onClick={() => setAwardModal(null)}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="soh-btn-primary"
                    style={{ background: '#10b981', borderColor: '#10b981' }}
                    disabled={actionLoading}
                    onClick={() => {
                      handleEvaluateAction({
                        action: 'award',
                        offerRef: awardModal.quote.OfferReference,
                        rfqReference: awardModal.quote.RfqReference,
                        productName: awardModal.quote.ProductName,
                        awardRemarks
                      });
                    }}
                  >
                    {actionLoading ? 'Processing Award...' : 'Confirm & Award Winning Offer'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODAL 2: REQUEST PRICE REVISION / COUNTER-OFFER */}
          {/* ========================================================================= */}
          {counterModal && (
            <div className="soh-modal-overlay" onClick={() => !actionLoading && setCounterModal(null)}>
              <div className="soh-modal-card" style={{ maxWidth: '540px' }} onClick={e => e.stopPropagation()}>
                <div className="soh-modal-header">
                  <div className="soh-modal-title-group">
                    <span className="soh-modal-badge" style={{ background: '#fff7ed', color: '#c2410c', borderColor: '#fed7aa' }}>
                      Option B · Price Revision
                    </span>
                    <h2>Request Counter-Offer from {counterModal.quote.VendorName}</h2>
                  </div>
                  <button type="button" className="soh-modal-close" onClick={() => setCounterModal(null)}>
                    <X size={18} />
                  </button>
                </div>

                <div className="soh-modal-body">
                  <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '12.5px', color: '#9a3412', lineHeight: '1.6' }}>
                      <div>• <strong>Product:</strong> {counterModal.quote.ProductName}</div>
                      <div>• <strong>Current Quoted Price:</strong> ₹{Number(counterModal.quote.OfferedUnitPrice).toLocaleString('en-IN')}/{counterModal.quote.Uom || 'MT'}</div>
                      <div>• <strong>Total Demand at Stake:</strong> {counterModal.group.totalDemand} {counterModal.group.uom}</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                      Consortium Target Counter-Price (₹ / {counterModal.quote.Uom || 'MT'}): <span style={{ color: '#e11d48' }}>*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={counterPrice}
                      onChange={e => setCounterPrice(e.target.value)}
                      placeholder={`e.g. ${Math.round(Number(counterModal.quote.OfferedUnitPrice || 0) * 0.95)}`}
                      style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', fontWeight: '700' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                      Negotiation Terms / Message to Vendor:
                    </label>
                    <textarea
                      rows={3}
                      value={counterRemarks}
                      onChange={e => setCounterRemarks(e.target.value)}
                      placeholder="e.g. Our pooled buyers have 1000 MT volume ready for immediate commitment if rate can be revised to ₹X/MT Ex-Works."
                      style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div className="soh-modal-footer">
                  <button
                    type="button"
                    className="soh-btn-secondary"
                    disabled={actionLoading}
                    onClick={() => setCounterModal(null)}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="soh-btn-primary"
                    style={{ background: '#ea580c', borderColor: '#ea580c' }}
                    disabled={actionLoading || !counterPrice}
                    onClick={() => {
                      handleEvaluateAction({
                        action: 'counter-offer',
                        offerRef: counterModal.quote.OfferReference,
                        rfqReference: counterModal.quote.RfqReference,
                        productName: counterModal.quote.ProductName,
                        counterUnitPrice: counterPrice,
                        counterRemarks
                      });
                    }}
                  >
                    {actionLoading ? 'Dispatching...' : 'Dispatch Counter-Offer Request'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODAL 3: MULTI-SOURCE SPLIT ALLOCATION */}
          {/* ========================================================================= */}
          {splitModal && (
            <div className="soh-modal-overlay" onClick={() => !actionLoading && setSplitModal(null)}>
              <div className="soh-modal-card" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
                <div className="soh-modal-header">
                  <div className="soh-modal-title-group">
                    <span className="soh-modal-badge" style={{ background: '#f5f3ff', color: '#5b21b6', borderColor: '#ddd6fe' }}>
                      Option C · Split Sourcing
                    </span>
                    <h2>Multi-Source Split: {splitModal.group.productName}</h2>
                  </div>
                  <button type="button" className="soh-modal-close" onClick={() => setSplitModal(null)}>
                    <X size={18} />
                  </button>
                </div>

                <div className="soh-modal-body">
                  <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#5b21b6', fontWeight: '700' }}>
                      <span>Total Required Demand: {splitModal.group.totalDemand} {splitModal.group.uom}</span>
                      <span>
                        Allocated Sum: {Object.values(splitState).reduce((acc, curr) => acc + (parseFloat(curr.allocatedQty) || 0), 0)} / {splitModal.group.totalDemand} {splitModal.group.uom}
                      </span>
                    </div>
                  </div>

                  <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px 0' }}>
                    Distribute the pooled volume across multiple vendors to mitigate supply risk or satisfy partial capacity:
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {splitModal.group.quotes.map(q => {
                      const cur = splitState[q.OfferReference] || { allocatedQty: '', splitPercent: '', remarks: '' };
                      return (
                        <div key={q.OfferReference} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', background: '#f8fafc' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>{q.VendorName}</strong>
                            <span style={{ fontSize: '12px', color: '#0e7c86', fontWeight: '700' }}>₹{q.OfferedUnitPrice}/{splitModal.group.uom} (Offered: {q.OfferedQuantity} {splitModal.group.uom})</span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#475569', marginBottom: '2px' }}>
                                Allocated Volume ({splitModal.group.uom}):
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={cur.allocatedQty}
                                onChange={e => {
                                  const val = e.target.value;
                                  const pct = splitModal.group.totalDemand > 0 ? ((parseFloat(val) || 0) / splitModal.group.totalDemand * 100).toFixed(1) : 0;
                                  setSplitState(prev => ({
                                    ...prev,
                                    [q.OfferReference]: { ...cur, allocatedQty: val, splitPercent: pct }
                                  }));
                                }}
                                style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                              />
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#475569', marginBottom: '2px' }}>
                                Split Share (%):
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={cur.splitPercent}
                                onChange={e => {
                                  const pct = e.target.value;
                                  const qty = splitModal.group.totalDemand > 0 ? ((parseFloat(pct) || 0) / 100 * splitModal.group.totalDemand).toFixed(1) : 0;
                                  setSplitState(prev => ({
                                    ...prev,
                                    [q.OfferReference]: { ...cur, splitPercent: pct, allocatedQty: qty }
                                  }));
                                }}
                                style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="soh-modal-footer">
                  <button
                    type="button"
                    className="soh-btn-secondary"
                    disabled={actionLoading}
                    onClick={() => setSplitModal(null)}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="soh-btn-primary"
                    style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
                    disabled={actionLoading}
                    onClick={() => {
                      const splits = Object.entries(splitState)
                        .filter(([_, data]) => parseFloat(data.allocatedQty) > 0)
                        .map(([offerRef, data]) => ({
                          offerRef,
                          allocatedQty: data.allocatedQty,
                          splitPercent: data.splitPercent,
                          remarks: data.remarks
                        }));

                      if (splits.length === 0) {
                        alert('Please allocate volume to at least one vendor.');
                        return;
                      }

                      handleEvaluateAction({
                        action: 'multi-source-split',
                        rfqReference: splitModal.group.rfqReference,
                        productName: splitModal.group.productName,
                        splits
                      });
                    }}
                  >
                    {actionLoading ? 'Processing...' : 'Confirm Multi-Source Split'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODAL 4: CONFIRM DISPATCH OF BUYER ALLOCATION EMAIL (MANUAL TRIGGER ONLY) */}
          {/* ========================================================================= */}
          {emailConfirmModal && (
            <div className="soh-modal-overlay" onClick={() => !actionLoading && setEmailConfirmModal(null)}>
              <div className="soh-modal-card" style={{ maxWidth: '580px' }} onClick={e => e.stopPropagation()}>
                <div className="soh-modal-header">
                  <div className="soh-modal-title-group">
                    <span className="soh-modal-badge" style={{ background: '#f0fdfa', color: '#0f766e', borderColor: '#ccfbf1' }}>
                      Stage 7 · Offer Email
                    </span>
                    <h2>Dispatch Consortium Offer to Buyer</h2>
                  </div>
                  <button type="button" className="soh-modal-close" onClick={() => setEmailConfirmModal(null)}>
                    <X size={18} />
                  </button>
                </div>

                <div className="soh-modal-body">
                  <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <Building size={16} className="text-teal-700" />
                      <strong style={{ fontSize: '15px', color: '#0f172a' }}>
                        {emailConfirmModal.allocation.BuyerCompanyName}
                      </strong>
                    </div>
                    <div style={{ fontSize: '13px', color: '#0f766e', marginBottom: '12px' }}>
                      Destination Contact: <b>{emailConfirmModal.allocation.BuyerEmail}</b>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12.5px', background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Product</span>
                        <strong style={{ color: '#0f172a' }}>{emailConfirmModal.allocation.ProductName}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Allocated Volume</span>
                        <strong style={{ color: '#0f172a' }}>{emailConfirmModal.allocation.AllocatedQuantity} {emailConfirmModal.allocation.Uom}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Direct Factory Rate</span>
                        <strong style={{ color: '#0e7c86' }}>₹{Number(emailConfirmModal.allocation.OfferedUnitPrice).toLocaleString('en-IN')}/{emailConfirmModal.allocation.Uom}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Total Landed Value</span>
                        <strong style={{ color: '#047857' }}>₹{Number(emailConfirmModal.allocation.TotalEstimatedValue).toLocaleString('en-IN')}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Confidentiality Notice */}
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: '#1e40af', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#2563eb' }} />
                    <div style={{ lineHeight: '1.45' }}>
                      <b>Strict Mutual Confidentiality Guaranteed:</b>
                      <div style={{ marginTop: '2px', color: '#3b82f6' }}>
                        The seller's company name is strictly masked as <i>"Verified Synergy5M Consortium Partner"</i>. The buyer will receive a secure email containing their factory bulk rate and a live 48-hour reservation countdown timer.
                      </div>
                    </div>
                  </div>

                  <p style={{ margin: '14px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    Clicking below will dispatch the official notification to <b>{emailConfirmModal.allocation.BuyerEmail}</b> and start their 48-hour acceptance window.
                  </p>
                </div>

                <div className="soh-modal-footer">
                  <button
                    type="button"
                    className="soh-btn-secondary"
                    onClick={() => setEmailConfirmModal(null)}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="soh-btn-primary"
                    style={{ background: '#0e7c86', borderColor: '#0e7c86' }}
                    onClick={() => handleSendBuyerOfferEmail(emailConfirmModal.allocation.AllocationRef)}
                  >
                    <Mail size={14} />
                    <span>Confirm & Dispatch Offer Email</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

