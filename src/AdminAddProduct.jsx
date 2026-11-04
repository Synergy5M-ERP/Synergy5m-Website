import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuthHeaders } from './AdminAuthGuard';
import {
  Package,
  Layers,
  Inbox,
  Plus,
  Trash2,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowLeft,
  Eye,
  Building2,
  Check,
  Calendar,
  X,
  FileText,
  AlertTriangle,
  Menu,
  ExternalLink,
  Search,
  Database,
  RefreshCw,
  Mail,
  Phone,
  MapPin,
  User,
  Warehouse,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  LayoutDashboard,
  ArrowRight,
  FileCheck,
  Send,
  TrendingUp,
  ArrowUpRight
} from 'lucide-react';
import './AdminAddProduct.css';

// Sample categories for industrial MSME raw materials
const CATEGORIES = [
  'PVC Resin',
  'Engineering Polymers',
  'Polyolefins (HDPE/LLDPE/PP)',
  'Industrial Chemicals',
  'Specialty Additives & Stabilizers',
  'Solvents & Plasticizers',
  'SOLVENTS',
  'GASES',
  'DRUG INTERMEDIATES',
  'BAGS, ROLLS, SHEETS, LINER(LD, HD, PP, HM)'
];

// Pre-defined import countries
const IMPORT_COUNTRIES = [
  'China',
  'Taiwan',
  'South Korea',
  'Japan',
  'USA',
  'Saudi Arabia',
  'UAE',
  'Germany',
  'Thailand',
  'Vietnam'
];

export default function AdminAddProduct({ initialTab }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine initial active view: 'dashboard' | 'form' | 'table' | 'enquiries'
  const getTabFromLocation = useCallback(() => {
    if (initialTab) return initialTab;
    const path = (location.pathname || '').toLowerCase();
    if (path.includes('dashboard')) return 'dashboard';
    if (path.includes('enquiries') || path.includes('collective-enquiries')) return 'enquiries';
    const params = new URLSearchParams(location.search || '');
    const tabParam = params.get('tab');
    if (tabParam && ['dashboard', 'form', 'table', 'enquiries'].includes(tabParam)) return tabParam;
    if (path.includes('products') && !path.includes('/add')) return 'table';
    if (path.includes('/add')) return 'form';
    return 'dashboard';
  }, [initialTab, location.pathname, location.search]);

  // View switch: 'dashboard' | 'form' | 'table' | 'enquiries'
  const [activeAdminTab, setActiveAdminTab] = useState(getTabFromLocation);

  // Database Products (CollectiveProducts table) state
  const [dbProducts, setDbProducts] = useState([]);
  const [loadingDbProducts, setLoadingDbProducts] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [tableCategoryFilter, setTableCategoryFilter] = useState('All');
  const [productViewMode, setProductViewMode] = useState('table'); // 'table' | 'cards'
  const [selectedProductForDetail, setSelectedProductForDetail] = useState(null);

  // Collective Enquiries (CollectiveEnquiries table) state
  const [enquiries, setEnquiries] = useState([]);
  const [loadingEnquiries, setLoadingEnquiries] = useState(false);
  const [enquirySearch, setEnquirySearch] = useState('');
  const [enquiryStatusFilter, setEnquiryStatusFilter] = useState('All');

  // Potential Vendor Categories state (dynamically fetched from Potential_Vendor)
  const [categories, setCategories] = useState(CATEGORIES);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Sidebar mobile toggle
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Sidebar desktop collapse toggle (minimized to icon only)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Mobile preview view switch ('form' | 'preview')
  const [mobileTab, setMobileTab] = useState('form');

  // Status & toast notifications
  const [toast, setToast] = useState(null); // { type: 'success' | 'info' | 'error', message: '' }
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // File drag states
  const [isDraggingImage, setIsDraggingImage] = useState(false);

  // Form State (no pre-entered dummy data)
  const [formData, setFormData] = useState({
    // 1. Basic details
    productName: '',
    category: '',
    gradeVariant: '',
    sku: '',
    hsnCode: '',
    shortDescription: '',
    primaryImage: null, // { name: '', size: '', url: '' }
    additionalImages: [], // array of { name: '', size: '', url: '' }

    // 2. Specifications (starts empty, no pre-entered values)
    specifications: [],
    applicationEndUse: '',
    packagingType: '',
    tdsDocument: null, // { name: '', size: '', url: '' }

    // 3. Quantity and units
    uom: 'MT', // 'MT' | 'kg'
    minEnquiryQuantity: '',
    maxEnquiryQuantity: '',

    // 4. Sourcing
    sourcingOptions: ['Domestic'], // 'Domestic' and/or 'Import'
    allowedImportOrigins: [],
    defaultDeliveryWindow: '',

    // 5. Enquiry window
    opportunityStatus: 'Open for Enquiries', // 'Upcoming' | 'Open for Enquiries' | 'Closing Soon' | 'Closed'
    enquiryOpeningDate: '',
    enquiryClosingDate: '',

    // 6. Public display and visibility
    showOnHomepage: true,
    showEnquiryCountPublicly: false,
    showAggregateDemandPublicly: false,
    showToSuppliers: false,
    eligibleSuppliers: [],
    displayOrder: 1,

    // 7. Commercial settings (Admin only)
    successFeeDomesticPercent: '',
    successFeeImportPercent: '',
    feeNotes: '',
    internalNotes: '',

    // 8. SEO
    seoTitle: '',
    seoDescription: ''
  });

  // Notification helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Change handlers
  const updateField = (field, value) => {
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Image upload handling
  const handleImageFileSelect = (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Only JPG, PNG, and WebP images are allowed.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setIsDirty(true);
      setFormData((prev) => ({
        ...prev,
        primaryImage: {
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          url: e.target.result
        }
      }));
    };
    reader.readAsDataURL(file);
  };

  // Additional image gallery handling
  const handleAdditionalImageSelect = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setIsDirty(true);
      setFormData((prev) => ({
        ...prev,
        additionalImages: [
          ...prev.additionalImages,
          {
            name: file.name,
            size: `${(file.size / 1024).toFixed(1)} KB`,
            url: e.target.result
          }
        ]
      }));
    };
    reader.readAsDataURL(file);
  };

  // Sourcing checkboxes
  const toggleSourcingOption = (option) => {
    setIsDirty(true);
    setFormData((prev) => {
      const exists = prev.sourcingOptions.includes(option);
      let updated;
      if (exists) {
        updated = prev.sourcingOptions.filter((o) => o !== option);
      } else {
        updated = [...prev.sourcingOptions, option];
      }
      return { ...prev, sourcingOptions: updated };
    });
  };

  // Allowed import origin tag toggle
  const toggleImportOrigin = (country) => {
    setIsDirty(true);
    setFormData((prev) => {
      const exists = prev.allowedImportOrigins.includes(country);
      const updated = exists
        ? prev.allowedImportOrigins.filter((c) => c !== country)
        : [...prev.allowedImportOrigins, country];
      return { ...prev, allowedImportOrigins: updated };
    });
  };

  // Data Loaders from Database
  const loadDbProducts = async () => {
    try {
      setLoadingDbProducts(true);
      const res = await fetch('/api/admin/products', { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setDbProducts(json.data);
          setLoadingDbProducts(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Could not load db products:', e);
    }

    // Fallback to localStorage if API is empty or unavailable
    try {
      const local = JSON.parse(localStorage.getItem('s5m_published_products') || '[]');
      if (Array.isArray(local)) {
        setDbProducts(local);
      }
    } catch (e) {
      setDbProducts([]);
    } finally {
      setLoadingDbProducts(false);
    }
  };

  const loadEnquiries = async () => {
    try {
      setLoadingEnquiries(true);
      const res = await fetch('/api/admin/collective-enquiries', { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setEnquiries(json.data);
        }
      }
    } catch (e) {
      console.warn('Could not load collective enquiries:', e);
    } finally {
      setLoadingEnquiries(false);
    }
  };

  const handleUpdateEnquiryStatus = async (id, status) => {
    try {
      const res = await fetch(`/api/admin/collective-enquiries/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast(`Enquiry #${id} marked as ${status}`, 'success');
        loadEnquiries();
      } else {
        showToast('Failed to update status', 'error');
      }
    } catch (err) {
      showToast('Error updating enquiry: ' + err.message, 'error');
    }
  };

  const handleDeleteEnquiry = async (id, company) => {
    if (!window.confirm(`Delete enquiry #${id} from "${company}"?`)) return;
    try {
      const res = await fetch(`/api/admin/collective-enquiries/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast(`Enquiry #${id} deleted from database`, 'success');
        loadEnquiries();
      } else {
        showToast('Failed to delete enquiry', 'error');
      }
    } catch (err) {
      showToast('Error deleting enquiry: ' + err.message, 'error');
    }
  };

  // Fetch Potential Vendor Categories (matching other pages)
  const loadVendorCategories = async () => {
    try {
      setLoadingCategories(true);
      const res = await fetch('/api/vendor-filters', { credentials: 'include', headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.categories) && data.categories.length > 0) {
          const sorted = [...data.categories].filter(Boolean).sort((a, b) => a.localeCompare(b));
          setCategories(sorted);
          return;
        }
      }
    } catch (e) {
      // Fallback if needed
    }

    try {
      const fallbackRes = await fetch('/api/enquiry-categories');
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        if (Array.isArray(fallbackData) && fallbackData.length > 0) {
          setCategories(fallbackData.filter(Boolean).sort((a, b) => a.localeCompare(b)));
        }
      }
    } catch (e) {
    } finally {
      setLoadingCategories(false);
    }
  };

  // Live Supply Offer & RFQ Metrics state
  const [supplyMetrics, setSupplyMetrics] = useState({
    totalSent: 0,
    distinctProducts: 0,
    totalSubmitted: 0,
    responseRate: 0
  });

  const loadSupplyMetrics = useCallback(async () => {
    try {
      const [sentRes, subRes] = await Promise.all([
        fetch('/api/supply-offers/sent').then(r => r.json()).catch(() => ({ success: false, data: [] })),
        fetch('/api/supply-offers/submitted').then(r => r.json()).catch(() => ({ success: false, data: [] }))
      ]);

      const sentData = (sentRes.success && Array.isArray(sentRes.data)) ? sentRes.data : [];
      const subData = (subRes.success && Array.isArray(subRes.data)) ? subRes.data : [];

      const totalSent = sentData.length;
      const totalSubmitted = subData.length;
      const distinctProducts = new Set([
        ...sentData.map(s => s.ProductName),
        ...subData.map(o => o.ProductName)
      ].filter(Boolean)).size;

      const sentWithSubmissions = sentData.filter(s => (s.SubmittedOffersCount || 0) > 0).length;
      const responseRate = totalSent > 0 ? Math.round((sentWithSubmissions / totalSent) * 100) : (totalSubmitted > 0 ? 100 : 0);

      setSupplyMetrics({
        totalSent,
        distinctProducts,
        totalSubmitted,
        responseRate
      });
    } catch (e) { }
  }, []);

  // Initial load from Database on mount
  useEffect(() => {
    loadDbProducts();
    loadEnquiries();
    loadVendorCategories();
    loadSupplyMetrics();
  }, [loadSupplyMetrics]);

  // Sync activeAdminTab if location or initialTab changes
  useEffect(() => {
    const tab = getTabFromLocation();
    setActiveAdminTab(tab);
    if (tab === 'dashboard') {
      loadDbProducts();
      loadEnquiries();
      loadSupplyMetrics();
    } else if (tab === 'enquiries') {
      loadEnquiries();
    } else if (tab === 'table') {
      loadDbProducts();
    }
  }, [getTabFromLocation, loadSupplyMetrics]);

  // Tab switch handler with URL synchronization
  const switchTab = (tab) => {
    setActiveAdminTab(tab);
    if (tab === 'dashboard') {
      loadDbProducts();
      loadEnquiries();
      loadSupplyMetrics();
      navigate('/admin/dashboard', { replace: false });
    } else if (tab === 'enquiries') {
      loadEnquiries();
      navigate('/admin/collective-enquiries', { replace: false });
    } else if (tab === 'table') {
      loadDbProducts();
      navigate('/admin/products', { replace: false });
    } else {
      navigate('/admin/products/add', { replace: false });
    }
  };

  // Delete product from Database table
  const handleDeleteProduct = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name || id}" from the database table?`)) return;
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json();
      if (res.ok && json.success) {
        // Also remove from localStorage cache to prevent zombie records
        try {
          const local = JSON.parse(localStorage.getItem('s5m_published_products') || '[]');
          const updated = local.filter((p) => p.id !== id);
          localStorage.setItem('s5m_published_products', JSON.stringify(updated));
        } catch (e) { }

        showToast(json.message || 'Product removed from database', 'success');
        loadDbProducts();
      } else {
        showToast('Failed to delete product', 'error');
      }
    } catch (err) {
      showToast('Error deleting product: ' + err.message, 'error');
    }
  };

  // Filtered DB products for the Database Table view
  const availableCategories = useMemo(() => {
    const cats = new Set();
    dbProducts.forEach((p) => {
      const c = p.productMaster?.category || p.category;
      if (c) cats.add(c);
    });
    return Array.from(cats);
  }, [dbProducts]);

  const filteredDbProducts = useMemo(() => {
    return dbProducts.filter((item) => {
      const name = item.productMaster?.productName || item.productName || '';
      const cat = item.productMaster?.category || item.category || '';
      const grade = item.productMaster?.gradeVariant || item.gradeVariant || '';
      const sku = item.productMaster?.sku || item.sku || '';
      const q = tableSearch.toLowerCase().trim();

      const matchesSearch =
        !q ||
        name.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q) ||
        grade.toLowerCase().includes(q) ||
        sku.toLowerCase().includes(q) ||
        (item.id && item.id.toLowerCase().includes(q));

      const matchesCat =
        tableCategoryFilter === 'All' ||
        cat.toLowerCase() === tableCategoryFilter.toLowerCase();

      return matchesSearch && matchesCat;
    });
  }, [dbProducts, tableSearch, tableCategoryFilter]);

  // Filtered enquiries for the Enquiries Table view
  const filteredEnquiries = useMemo(() => {
    return enquiries.filter((item) => {
      const q = enquirySearch.toLowerCase().trim();
      const company = (item.CompanyName || item.companyName || '').toLowerCase();
      const person = (item.ContactPerson || item.contactPerson || '').toLowerCase();
      const product = (item.ProductName || item.productName || '').toLowerCase();
      const email = (item.Email || item.email || '').toLowerCase();
      const phone = (item.Phone || item.phone || '').toLowerCase();
      const location = (item.DeliveryLocation || item.deliveryLocation || '').toLowerCase();
      const idStr = String(item.Id || item.id || '');

      const matchesSearch =
        !q ||
        company.includes(q) ||
        person.includes(q) ||
        product.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        location.includes(q) ||
        idStr.includes(q);

      const status = item.Status || item.status || 'Submitted';
      const matchesStatus =
        enquiryStatusFilter === 'All' || status === enquiryStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [enquiries, enquirySearch, enquiryStatusFilter]);

  // Validation rules
  const validationErrors = useMemo(() => {
    const errors = {};

    if (!formData.productName.trim()) {
      errors.productName = 'Product name is required';
    }
    if (!formData.category) {
      errors.category = 'Category selection is required';
    }
    if (!formData.gradeVariant.trim()) {
      errors.gradeVariant = 'Grade / variant is required';
    }
    if (!formData.shortDescription.trim()) {
      errors.shortDescription = 'Short description is required';
    } else if (formData.shortDescription.length > 150) {
      errors.shortDescription = 'Description must not exceed 150 characters';
    }
    if (!formData.primaryImage) {
      errors.primaryImage = 'Product image is required';
    }
    if (!formData.uom) {
      errors.uom = 'Unit of measure is required';
    }
    if (!formData.minEnquiryQuantity || parseFloat(formData.minEnquiryQuantity) <= 0) {
      errors.minEnquiryQuantity = 'Valid minimum enquiry quantity is required';
    }
    if (
      formData.maxEnquiryQuantity &&
      parseFloat(formData.maxEnquiryQuantity) < parseFloat(formData.minEnquiryQuantity || 0)
    ) {
      errors.maxEnquiryQuantity = 'Maximum quantity must be greater than or equal to minimum quantity';
    }
    if (formData.sourcingOptions.length === 0) {
      errors.sourcingOptions = 'At least one sourcing option (Domestic or Import) must be selected';
    }
    if (!formData.opportunityStatus) {
      errors.opportunityStatus = 'Opportunity status is required';
    }
    if (!formData.enquiryClosingDate) {
      errors.enquiryClosingDate = 'Enquiry closing date is required';
    } else if (
      formData.enquiryOpeningDate &&
      new Date(formData.enquiryClosingDate) < new Date(formData.enquiryOpeningDate)
    ) {
      errors.enquiryClosingDate = 'Closing date must be equal to or after the opening date';
    }

    return errors;
  }, [formData]);

  const isValid = Object.keys(validationErrors).length === 0;

  // Duplicate master product warning check against live DB products
  const duplicateWarning = useMemo(() => {
    const nameMatch = formData.productName.trim().toLowerCase();
    const gradeMatch = formData.gradeVariant.trim().toLowerCase();
    if (!nameMatch || !gradeMatch) return null;

    const exists = dbProducts.some((item) => {
      const pm = item.productMaster || {};
      return (pm.productName || '').toLowerCase() === nameMatch &&
        (pm.gradeVariant || '').toLowerCase() === gradeMatch;
    });

    if (exists) {
      return `Notice: A product record for "${formData.productName} (${formData.gradeVariant})" already exists in the database. Publishing will update or add a new round.`;
    }
    return null;
  }, [formData.productName, formData.gradeVariant, dbProducts]);

  // Form Completion Percentage
  const completionPercentage = useMemo(() => {
    const requiredChecks = [
      Boolean(formData.productName.trim()),
      Boolean(formData.category),
      Boolean(formData.gradeVariant.trim()),
      Boolean(formData.shortDescription.trim() && formData.shortDescription.length <= 150),
      Boolean(formData.primaryImage),
      Boolean(formData.uom),
      Boolean(formData.minEnquiryQuantity && parseFloat(formData.minEnquiryQuantity) > 0),
      formData.sourcingOptions.length > 0,
      Boolean(formData.opportunityStatus),
      Boolean(
        formData.enquiryClosingDate &&
        (!formData.enquiryOpeningDate || new Date(formData.enquiryClosingDate) >= new Date(formData.enquiryOpeningDate))
      )
    ];

    const completed = requiredChecks.filter(Boolean).length;
    return Math.round((completed / requiredChecks.length) * 100);
  }, [formData]);

  // Structured payload separating Product Master and Opportunity Round
  const formattedPayload = useMemo(
    () => ({
      productMaster: {
        productName: formData.productName,
        category: formData.category,
        gradeVariant: formData.gradeVariant,
        sku: formData.sku || null,
        hsnCode: formData.hsnCode || null,
        shortDescription: formData.shortDescription,
        primaryImage: formData.primaryImage,
        additionalImages: formData.additionalImages,
        specifications: formData.specifications,
        applicationEndUse: formData.applicationEndUse || null,
        packagingType: formData.packagingType || null,
        tdsDocument: formData.tdsDocument || null,
        uom: formData.uom
      },
      opportunity: {
        status: formData.opportunityStatus,
        enquiryOpeningDate: formData.enquiryOpeningDate || null,
        enquiryClosingDate: formData.enquiryClosingDate,
        minEnquiryQuantity: formData.minEnquiryQuantity ? parseFloat(formData.minEnquiryQuantity) : 0,
        maxEnquiryQuantity: formData.maxEnquiryQuantity ? parseFloat(formData.maxEnquiryQuantity) : null,
        sourcingOptions: formData.sourcingOptions,
        allowedImportOrigins: formData.allowedImportOrigins,
        defaultDeliveryWindow: formData.defaultDeliveryWindow || null,
        visibility: {
          showOnHomepage: formData.showOnHomepage,
          showEnquiryCountPublicly: formData.showEnquiryCountPublicly,
          showAggregateDemandPublicly: formData.showAggregateDemandPublicly,
          showToSuppliers: formData.showToSuppliers,
          eligibleSuppliers: formData.eligibleSuppliers,
          displayOrder: formData.displayOrder
        },
        commercial: {
          successFeeDomesticPercent: formData.successFeeDomesticPercent || null,
          successFeeImportPercent: formData.successFeeImportPercent || null,
          feeNotes: formData.feeNotes || null,
          internalNotes: formData.internalNotes || null
        },
        seo: {
          title: formData.seoTitle || null,
          description: formData.seoDescription || null
        }
      }
    }),
    [formData]
  );


  // Actions
  const handleSaveDraft = () => {
    setIsSubmitting(true);
    try {
      localStorage.setItem('s5m_product_draft', JSON.stringify(formData));
    } catch (e) {
      console.warn('LocalStorage draft save error:', e);
    }
    setTimeout(() => {
      setIsSubmitting(false);
      setIsDirty(false);
      showToast('Product draft saved to browser storage (localStorage)! You can resume editing anytime.', 'info');
    }, 600);
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);

    if (!isValid) {
      showToast('Please fix all highlighted errors before publishing.', 'error');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    const newId = `PROD-${Date.now()}`;
    const newProductRecord = {
      id: newId,
      publishedAt: new Date().toISOString(),
      ...formattedPayload
    };

    // Post to backend database
    try {
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(newProductRecord)
      });
      const result = await response.json();
      setIsSubmitting(false);

      if (response.ok && result.success) {
        // Sync to local storage only on verified success
        try {
          const existing = JSON.parse(localStorage.getItem('s5m_published_products') || '[]');
          existing.unshift(newProductRecord);
          localStorage.setItem('s5m_published_products', JSON.stringify(existing));
          localStorage.removeItem('s5m_product_draft');
        } catch (err) {
          console.warn('LocalStorage publish save warning:', err);
        }

        setIsDirty(false);
        showToast(result.message || 'Product published successfully!', 'success');
        loadDbProducts();
        setTimeout(() => switchTab('table'), 1200);
      } else {
        showToast(result.message || 'Failed to publish product. Please verify inputs and try again.', 'error');
      }
    } catch (apiErr) {
      console.error('Backend API dispatch error:', apiErr);
      setIsSubmitting(false);
      showToast('Unable to reach the server. Please check your network connection and try again.', 'error');
    }
  };

  const handleCancelClick = () => {
    if (isDirty) {
      setShowCancelModal(true);
    } else {
      navigate('/admin');
    }
  };

  // Status badge styling helper
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Open for Enquiries':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Closing Soon':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Upcoming':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'Closed':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="b2b-dashboard-page flex flex-col min-h-screen">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-lg shadow-xl border text-sm font-medium transition-all transform animate-bounce-subtle ${toast.type === 'error'
            ? 'bg-rose-50 text-rose-900 border-rose-200'
            : toast.type === 'info'
              ? 'bg-sky-50 text-sky-900 border-sky-200'
              : 'bg-emerald-50 text-emerald-900 border-emerald-200'
            }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          ) : toast.type === 'info' ? (
            <HelpCircle className="w-5 h-5 text-sky-600 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-slate-400 hover:text-slate-600 focus:outline-none"
            aria-label="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Unsaved Changes Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-scale-up">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-slate-900">Unsaved Changes</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              You have unsaved changes in this product record. If you leave now, your modifications will be discarded.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCancelModal(false);
                  navigate('/admin');
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-md shadow-sm transition-colors"
              >
                Discard & Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Layout Wrapper: Sidebar + Main Workspace */}
      <div className="flex flex-1">
        {/* Left Sidebar (Collapsible on Mobile and Desktop) */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 bg-[#0F2A47] text-slate-200 transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            } ${sidebarCollapsed ? 'w-64 lg:w-[68px]' : 'w-64'}`}
        >
          {/* Sidebar Header */}
          <div className={`h-16 flex items-center border-b border-slate-700/60 bg-[#0A1E33] transition-all duration-300 ${sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'
            }`}>
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
                {/* Floating Tooltip when collapsed */}
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                    Expand Sidebar
                  </div>
                </div>
              </button>
            )}

            {/* Desktop collapse toggle button */}
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

            {/* Mobile close button */}
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
              <a
                href="/admin/dashboard"
                onClick={(e) => {
                  e.preventDefault();
                  switchTab('dashboard');
                  setSidebarOpen(false);
                }}
                className={`flex items-center rounded-md transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  } ${activeAdminTab === 'dashboard'
                    ? 'bg-[#0E7C86] text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                title="Dashboard"
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <LayoutDashboard className="w-4 h-4 text-teal-100 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Dashboard</span>}
                </div>
              </a>

              {/* Tooltip on hover when sidebar is minimized */}
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
              <a
                href="/admin/products/add"
                onClick={(e) => {
                  e.preventDefault();
                  switchTab('form');
                  setSidebarOpen(false);
                }}
                className={`flex items-center rounded-md transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  } ${activeAdminTab === 'form'
                    ? 'bg-[#0E7C86] text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                title="Add Product"
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <Warehouse className="w-4 h-4 text-teal-100 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Add Product</span>}
                </div>
              </a>

              {/* Tooltip on hover when sidebar is minimized */}
              {sidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                    Add Product
                  </div>
                </div>
              )}
            </div>

            {/* 2. View Products */}
            <div className="relative group">
              <a
                href="/admin/products/add?tab=table"
                onClick={(e) => {
                  e.preventDefault();
                  switchTab('table');
                  setSidebarOpen(false);
                }}
                className={`flex items-center rounded-md transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  } ${activeAdminTab === 'table'
                    ? 'bg-[#0E7C86] text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                title={`View Products (${dbProducts.length})`}
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <Database className="w-4 h-4 text-teal-100 flex-shrink-0" />
                  {!sidebarCollapsed && <span>View Products</span>}
                </div>
                {!sidebarCollapsed && (
                  <span className={`text-[11px] px-2 py-0.5 rounded ${activeAdminTab === 'table' ? 'bg-teal-900/50 text-teal-200' : 'bg-slate-700/80 text-slate-300'
                    }`}>
                    {dbProducts.length}
                  </span>
                )}
              </a>

              {/* Tooltip on hover when sidebar is minimized */}
              {sidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap flex items-center gap-2">
                    <span>View Products</span>
                    <span className="bg-[#0E7C86] text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                      {dbProducts.length}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Aggregate Enquiries */}
            <div className="relative group">
              <a
                href="/admin/collective-enquiries"
                onClick={(e) => {
                  e.preventDefault();
                  switchTab('enquiries');
                  setSidebarOpen(false);
                }}
                className={`flex items-center rounded-md transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  } ${activeAdminTab === 'enquiries'
                    ? 'bg-[#0E7C86] text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                title={`Aggregate Enquiries (${enquiries.length})`}
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <Inbox className="w-4 h-4 text-teal-300 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Aggregate Enquiries</span>}
                </div>
                {!sidebarCollapsed && (
                  <span className={`text-[11px] px-2 py-0.5 rounded font-bold ${activeAdminTab === 'enquiries' ? 'bg-teal-900/60 text-teal-100' : 'bg-slate-700/80 text-slate-300'
                    }`}>
                    {enquiries.length}
                  </span>
                )}
              </a>

              {/* Tooltip on hover when sidebar is minimized */}
              {sidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap flex items-center gap-2">
                    <span>Aggregate Enquiries</span>
                    <span className="bg-[#0E7C86] text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                      {enquiries.length}
                    </span>
                  </div>
                </div>
              )}
            </div>


            {/* 5. Opportunity View */}
            <div className="relative group">
              <a
                href="/admin/opportunity-view"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/admin/opportunity-view');
                  setSidebarOpen(false);
                }}
                className={`flex items-center rounded-md text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  }`}
                title="Opportunity View (SG-5)"
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <FileCheck className="w-4 h-4 text-teal-300 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Opportunity View</span>}
                </div>
                {!sidebarCollapsed && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-900/60 text-teal-200 font-bold uppercase tracking-wider">
                    SG-5
                  </span>
                )}
              </a>

              {/* Tooltip on hover when sidebar is minimized */}
              {sidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap flex items-center gap-2">
                    <span>Opportunity View</span>
                    <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                      Live Pool
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Section Divider: Procurement & Offers */}
            <div className="pt-3 pb-1 border-t border-slate-700/60 mt-3">
              {!sidebarCollapsed && (
                <div className="px-3 text-[10.5px] font-bold uppercase tracking-wider text-teal-400/80 mb-1">
                  Procurement & Offers
                </div>
              )}
            </div>

            {/* 6. Dispatch RFQ */}
            <div className="relative group">
              <a
                href="/supply-offers"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/supply-offers');
                  setSidebarOpen(false);
                }}
                className={`flex items-center rounded-md text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  }`}
                title="Dispatch RFQ"
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <Send className="w-4 h-4 text-orange-400 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Dispatch RFQ</span>}
                </div>
                {!sidebarCollapsed && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-bold uppercase tracking-wider">
                    Sent
                  </span>
                )}
              </a>
              {sidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                    Dispatch RFQ
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
                  <Send className="w-4 h-4 text-orange-400 flex-shrink-0" />
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

            {/* 8. Submitted Offer */}
            <div className="relative group">
              <a
                href="/submittedoffer"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/submittedoffer');
                  setSidebarOpen(false);
                }}
                className={`flex items-center rounded-md text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all ${sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  }`}
                title="Submitted Offer"
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <FileText className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Submitted Offer</span>}
                </div>
                {!sidebarCollapsed && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase tracking-wider">
                    Quotes
                  </span>
                )}
              </a>
              {sidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden lg:flex items-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="bg-[#0A1E33] text-white text-xs font-semibold px-2.5 py-1.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                    Submitted Offer
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
            className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          ></div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar Header */}
          <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Mobile menu trigger */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md focus:outline-none"
                aria-label="Open sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Desktop sidebar toggle button */}
              <button
                type="button"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden lg:flex items-center justify-center p-2 text-slate-600 hover:text-[#0E7C86] hover:bg-slate-100 rounded-md transition-colors"
                title={sidebarCollapsed ? "Expand sidebar" : "Minimize sidebar"}
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Minimize sidebar"}
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="w-5 h-5" />
                ) : (
                  <ChevronLeft className="w-5 h-5" />
                )}
              </button>

              {/* Breadcrumb Navigation */}
              {/* <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <span className="text-slate-500">
                  {activeAdminTab === 'enquiries' ? 'Procurement Core' : 'Master Data'}
                </span>
                <span className="text-slate-400">/</span>
                <span className="text-slate-500 font-medium">Collective Buy</span>
                <span className="text-slate-400">/</span>
                <span className="text-[#0F2A47] font-semibold">
                  {activeAdminTab === 'form' ? 'Add Product Form' : activeAdminTab === 'table' ? 'Products Table' : 'Collective Enquiries'}
                </span>
              </nav> */}
            </div>

            {/* View Switcher: Dashboard vs Add Form vs Database Products Table vs Collective Enquiries */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => switchTab('dashboard')}
                className={`db-tab-btn ${activeAdminTab === 'dashboard' ? 'active' : ''}`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dashboard</span>
                <span className="sm:hidden">Dash</span>
              </button>
              <button
                type="button"
                onClick={() => switchTab('form')}
                className={`db-tab-btn ${activeAdminTab === 'form' ? 'active' : ''}`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Add Product Form</span>
                <span className="sm:hidden">Form</span>
              </button>
              <button
                type="button"
                onClick={() => switchTab('table')}
                className={`db-tab-btn ${activeAdminTab === 'table' ? 'active' : ''}`}
              >
                <Database className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">View Products</span>
                <span className="sm:hidden">Products</span>
                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-slate-200 text-slate-700 rounded-full font-bold">
                  {dbProducts.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => switchTab('enquiries')}
                className={`db-tab-btn ${activeAdminTab === 'enquiries' ? 'active' : ''}`}
              >
                <Inbox className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Collective Enquiries</span>
                <span className="sm:hidden">Enquiries</span>
                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-emerald-200 text-emerald-800 rounded-full font-bold">
                  {enquiries.length}
                </span>
              </button>
            </div>

            {/* Quick Actions in Header */}
            <div className="flex items-center gap-2 sm:gap-3">
              {activeAdminTab === 'form' ? (
                <>
                  <button
                    type="button"
                    onClick={handleCancelClick}
                    className="b2b-btn-secondary text-xs sm:text-sm !min-h-[38px] !py-1.5 !px-3"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={!isValid || isSubmitting}
                    className="b2b-btn-primary text-xs sm:text-sm !min-h-[38px] !py-1.5 !px-4"
                    title={!isValid ? 'Complete all required fields marked with * to publish' : 'Publish product'}
                  >
                    {isSubmitting ? (
                      <span className="inline-block animate-spin mr-1">⌛</span>
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>Publish Product</span>
                  </button>
                </>
              ) : null}
            </div>
          </header>

          {/* Mobile View Tab Switcher (Visible on mobile/tablet) */}
          <div className="lg:hidden flex border-b border-slate-200 bg-white px-4 pt-2">
            <button
              type="button"
              onClick={() => setMobileTab('form')}
              className={`flex-1 py-2.5 text-sm font-semibold text-center border-b-2 transition-colors ${mobileTab === 'form'
                ? 'border-[#0E7C86] text-[#0E7C86]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              Add Product Form ({completionPercentage}%)
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('preview')}
              className={`flex-1 py-2.5 text-sm font-semibold text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${mobileTab === 'preview'
                ? 'border-[#0E7C86] text-[#0E7C86]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              <Eye className="w-4 h-4" />
              <span>Public Card Preview</span>
            </button>
          </div>

          {/* Main Body Layout */}
          <main className="flex-1 p-4 sm:p-6  max-w-7xl mx-auto w-full">
            {/* Top Page Title & Subtitle */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                {/* <h1 className="text-2xl font-bold text-[#0F2A47] tracking-tight">
                  {activeAdminTab === 'dashboard'
                    ? 'Procurement Dashboard'
                    : activeAdminTab === 'form'
                      ? 'Add New Product'
                      : activeAdminTab === 'table'
                        ? 'Products'
                        : 'Collective Enquiries'}
                </h1> */}
                <p className="text-xl ">
                  {activeAdminTab === 'dashboard'
                    ? 'Overview of collective buying catalogue, pooling rounds, and buyer demands.'
                    : activeAdminTab === 'form'
                      ? 'Create a product listing and set requirements for collective buying.'
                      : activeAdminTab === 'table'
                        ? 'View and manage all active collective buy products.'
                        : 'Review and manage incoming buyer requirements and volume requests.'}
                </p>
              </div>

              {/* Duplicate Catalog Warning if triggered */}
              {activeAdminTab === 'form' && duplicateWarning && (
                <div className="max-w-md bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-3 text-xs flex items-start gap-2 shadow-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p>{duplicateWarning}</p>
                </div>
              )}
            </div>

            {/* Error summary banner on failed submit */}
            {activeAdminTab === 'form' && hasAttemptedSubmit && !isValid && (
              <div
                role="alert"
                className="mb-6 bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-lg shadow-xs"
              >
                <div className="flex items-center gap-2 text-rose-800 font-semibold text-sm mb-1">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>Please review and complete the following required fields:</span>
                </div>
                <ul className="list-disc list-inside text-xs text-rose-700 space-y-0.5 ml-1">
                  {Object.values(validationErrors).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {activeAdminTab === 'dashboard' ? (
              /* Dedicated Procurement & Collective Buy Dashboard */
              <div className="space-y-6">
                {/* 1. Metric Summary Cards - Dashboard of Numbers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total Products */}
                  <div className="b2b-card p-5 flex items-center gap-4 bg-gradient-to-br from-white to-slate-50/70 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-xl bg-teal-50 text-[#0E7C86] flex items-center justify-center flex-shrink-0 border border-teal-100">
                      <Package className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Products</p>
                      <h4 className="text-2xl font-bold text-[#0F2A47] mt-0.5">{dbProducts.length}</h4>
                      <p className="text-xs text-teal-700 font-medium mt-0.5">Active Catalogue</p>
                    </div>
                  </div>

                  {/* Open Rounds */}
                  <div className="b2b-card p-5 flex items-center gap-4 bg-gradient-to-br from-white to-slate-50/70 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-100">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Open Rounds</p>
                      <h4 className="text-2xl font-bold text-[#0F2A47] mt-0.5">
                        {dbProducts.filter(p => (p.opportunity?.status || p.opportunityStatus || p.status || 'Open for Enquiries') === 'Open for Enquiries').length}
                      </h4>
                      <p className="text-xs text-emerald-700 font-medium mt-0.5">Accepting Demands</p>
                    </div>
                  </div>

                  {/* Categories */}
                  <div className="b2b-card p-5 flex items-center gap-4 bg-gradient-to-br from-white to-slate-50/70 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#0F2A47] flex items-center justify-center flex-shrink-0 border border-blue-100">
                      <Layers className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Categories</p>
                      <h4 className="text-2xl font-bold text-[#0F2A47] mt-0.5">{availableCategories.length}</h4>
                      <p className="text-xs text-blue-700 font-medium mt-0.5">Chemical & Polymer</p>
                    </div>
                  </div>

                  {/* Buyer Enquiries */}
                  <div className="b2b-card p-5 flex items-center gap-4 bg-gradient-to-br from-white to-slate-50/70 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 border border-amber-100">
                      <Inbox className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Buyer Enquiries</p>
                      <h4 className="text-2xl font-bold text-[#0F2A47] mt-0.5">{enquiries.length}</h4>
                      <p className="text-xs text-amber-700 font-medium mt-0.5">Aggregated Leads</p>
                    </div>
                  </div>
                </div>

                {/* 2. Interactive Collective Procurement & RFQ Lifecycle Metric Block */}
                <div className="bg-gradient-to-r from-[#0F2A47] via-[#133357] to-[#0A1E33] p-5 sm:p-6 rounded-2xl border border-slate-700/60 shadow-lg text-white">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-white/10">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse"></span>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-teal-300">
                          RFQ Dispatches & Supplier Quotes Pipeline
                        </h3>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Interactive metrics linked directly to your collective procurement & supplier response records.
                      </p>
                    </div>
                    <span className="text-[11px] text-teal-200 font-medium self-start sm:self-auto bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/30">
                      Click any card to open specific data view
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card 1: Dispatched RFQ Emails -> /supply-offers */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate('/supply-offers')}
                      onKeyDown={(e) => { if (e.key === 'Enter') navigate('/supply-offers'); }}
                      className="group cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 hover:border-teal-400/60 rounded-xl p-4 transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-lg relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-teal-400"
                      title="Click to view all Dispatched RFQ Emails"
                    >
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-500/30 group-hover:scale-105 transition-transform">
                          <Send className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-teal-300 opacity-80 group-hover:opacity-100 transition-opacity">
                          <span>View</span>
                          <ArrowUpRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                          Dispatched RFQ Emails
                        </p>
                        <h4 className="text-3xl font-extrabold text-white mt-1 group-hover:text-teal-300 transition-colors">
                          {supplyMetrics.totalSent}
                        </h4>
                        <p className="text-xs text-teal-200/90 font-medium mt-1">
                          Vendor procurement invites sent
                        </p>
                      </div>
                    </div>

                    {/* Card 2: Active Aggregated Products -> /admin/opportunity-view */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate('/admin/opportunity-view')}
                      onKeyDown={(e) => { if (e.key === 'Enter') navigate('/admin/opportunity-view'); }}
                      className="group cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-400/60 rounded-xl p-4 transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-lg relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-amber-400"
                      title="Click to view Active Aggregated Products and live pooling"
                    >
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30 group-hover:scale-105 transition-transform">
                          <Package className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-amber-300 opacity-80 group-hover:opacity-100 transition-opacity">
                          <span>View</span>
                          <ArrowUpRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                          Active Aggregated Products
                        </p>
                        <h4 className="text-3xl font-extrabold text-white mt-1 group-hover:text-amber-300 transition-colors">
                          {supplyMetrics.distinctProducts}
                        </h4>
                        <p className="text-xs text-amber-200/90 font-medium mt-1">
                          Categories undergoing pooling
                        </p>
                      </div>
                    </div>

                    {/* Card 3: Offers Submitted -> /submittedoffer */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate('/submittedoffer')}
                      onKeyDown={(e) => { if (e.key === 'Enter') navigate('/submittedoffer'); }}
                      className="group cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-400/60 rounded-xl p-4 transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-lg relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      title="Click to view all Submitted Offers and formal supplier quotations"
                    >
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30 group-hover:scale-105 transition-transform">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-emerald-300 opacity-80 group-hover:opacity-100 transition-opacity">
                          <span>View</span>
                          <ArrowUpRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                          Offers Submitted
                        </p>
                        <h4 className="text-3xl font-extrabold text-white mt-1 group-hover:text-emerald-300 transition-colors">
                          {supplyMetrics.totalSubmitted}
                        </h4>
                        <p className="text-xs text-emerald-200/90 font-medium mt-1">
                          Formal supplier quotations
                        </p>
                      </div>
                    </div>

                    {/* Card 4: Supplier Response Rate -> /submittedoffer */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate('/submittedoffer')}
                      onKeyDown={(e) => { if (e.key === 'Enter') navigate('/submittedoffer'); }}
                      className="group cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-400/60 rounded-xl p-4 transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-lg relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-400"
                      title="Click to view supplier response quotations and rate breakdown"
                    >
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center border border-blue-500/30 group-hover:scale-105 transition-transform">
                          <TrendingUp className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-blue-300 opacity-80 group-hover:opacity-100 transition-opacity">
                          <span>View</span>
                          <ArrowUpRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                          Supplier Response Rate
                        </p>
                        <h4 className="text-3xl font-extrabold text-white mt-1 group-hover:text-blue-300 transition-colors">
                          {supplyMetrics.responseRate}%
                        </h4>
                        <p className="text-xs text-blue-200/90 font-medium mt-1">
                          RFQs with active quotations
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Quick Actions Bar */}
                {/* <div className="b2b-card p-4 sm:p-5 bg-gradient-to-r from-[#0F2A47] to-[#163a61] text-white">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Warehouse className="w-5 h-5 text-teal-300" />
                        <span>Procurement & Demand Management Hub</span>
                      </h3>
                      <p className="text-xs text-slate-300 mt-1 max-w-xl">
                        Add raw materials, aggregate collective volume demands across MSME buyers, or review inbound procurement leads.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => switchTab('form')}
                        className="px-3.5 py-2 bg-[#0E7C86] hover:bg-[#0a626a] text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add New Product</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => switchTab('table')}
                        className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 border border-white/20"
                      >
                        <Database className="w-4 h-4" />
                        <span>View All Products ({dbProducts.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => switchTab('enquiries')}
                        className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 border border-white/20"
                      >
                        <Inbox className="w-4 h-4" />
                        <span>View Enquiries ({enquiries.length})</span>
                      </button>
                    </div>
                  </div>
                </div> */}

                {/* 3. Two-Column Dashboard Content Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Recent Products (~60%) */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className="b2b-card overflow-hidden">
                      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-[#0E7C86]" />
                          <h3 className="text-sm font-bold text-[#0F2A47]">Recent Published Products</h3>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-semibold border border-teal-100">
                            {dbProducts.length} Total
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => switchTab('table')}
                          className="text-xs text-[#0E7C86] hover:text-[#0a5c63] font-bold flex items-center gap-1"
                        >
                          <span>Explore All</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {dbProducts.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                          <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                          <p className="text-xs font-semibold text-slate-600">No products published yet</p>
                          <button
                            type="button"
                            onClick={() => switchTab('form')}
                            className="b2b-btn-primary text-xs !py-1.5 !px-3 mt-3 mx-auto"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add First Product</span>
                          </button>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {dbProducts.slice(0, 4).map((p) => {
                            const name = p.productMaster?.productName || p.productName || 'Raw Material';
                            const cat = p.productMaster?.category || p.category || 'Chemicals';
                            const grade = p.productMaster?.gradeVariant || p.gradeVariant || '-';
                            const minQty = p.opportunity?.minEnquiryQuantity || p.minEnquiryQuantity || '1';
                            const uom = p.productMaster?.uom || p.uom || 'MT';
                            const status = p.opportunity?.status || p.opportunityStatus || p.status || 'Open for Enquiries';
                            const imgUrl = p.productMaster?.primaryImage?.url || p.primaryImage?.url || p.image;

                            return (
                              <div key={p.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                  {imgUrl ? (
                                    <img
                                      src={imgUrl}
                                      alt={name}
                                      className="w-11 h-11 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
                                      <Package className="w-5 h-5" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-bold text-xs text-[#0F2A47] truncate">{name}</p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                      {cat} • <span className="text-slate-600 font-medium">Grade: {grade}</span>
                                    </p>
                                    <span className="text-[10px] text-teal-700 font-bold mt-0.5 block">
                                      Min: {minQty} {uom}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${status === 'Open for Enquiries'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600'
                                    }`}>
                                    {status}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedProductForDetail(p)}
                                    className="px-2.5 py-1 text-xs font-semibold text-[#0E7C86] bg-teal-50 hover:bg-teal-100 rounded border border-teal-200 transition-colors flex items-center gap-1"
                                    title="View Product Details"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>View</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Recent Inbound Enquiries & Platform Guide (~40%) */}
                  <div className="lg:col-span-5 space-y-6">
                    <div className="b2b-card overflow-hidden">
                      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Inbox className="w-4 h-4 text-amber-600" />
                          <h3 className="text-sm font-bold text-[#0F2A47]">Recent Inbound Enquiries</h3>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-100">
                            {enquiries.length} Total
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => switchTab('enquiries')}
                          className="text-xs text-[#0E7C86] hover:text-[#0a5c63] font-bold flex items-center gap-1"
                        >
                          <span>Manage</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {enquiries.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                          <Inbox className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                          <p className="text-xs font-semibold text-slate-600">No buyer enquiries yet</p>
                          <p className="text-[11px] text-slate-400 mt-1">Enquiries submitted by buyers in public portal will appear here.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {enquiries.slice(0, 4).map((enq) => {
                            const company = enq.CompanyName || enq.companyName || 'MSME Buyer';
                            const contact = enq.ContactPerson || enq.contactPerson || '-';
                            const prod = enq.ProductName || enq.productName || 'Material';
                            const qty = enq.Quantity || enq.quantity || '-';
                            const uom = enq.UOM || enq.uom || 'MT';
                            const status = enq.Status || enq.status || 'Submitted';

                            return (
                              <div key={enq.Id || enq.id} className="p-3.5 hover:bg-slate-50/70 transition-colors">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-bold text-xs text-[#0F2A47] truncate">{company}</p>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    {status}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                                  <span>{prod}</span>
                                  <span className="font-bold text-slate-700">{qty} {uom}</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5">Contact: {contact}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* How Collective Buy Works Guide Card */}

                  </div>
                </div>
              </div>
            ) : activeAdminTab === 'form' ? (
              /* Two Column Layout Grid */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Form Section Cards (~70%) */}
                <div className={`lg:col-span-8 space-y-6 ${mobileTab === 'preview' ? 'hidden lg:block' : 'block'}`}>
                  {/* 1. Basic Details Card */}
                  <section className="b2b-card p-6 " aria-labelledby="section-basic-details">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                      <div>
                        <h2 id="section-basic-details" className="text-base font-bold text-[#0F2A47] flex items-center gap-2">
                          <span>1. Basic Details</span>
                          <span className="text-rose-500 text-sm font-normal">* required</span>
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Core product identification for the master catalogue.
                        </p>
                      </div>
                      <span className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 text-slate-600 rounded">
                        Step 1 of 6
                      </span>
                    </div>



                    <div className="space-y-4">
                      {/* Product Name & Category */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="productName" className="block text-xs font-semibold text-slate-700 mb-1">
                            Product Name <span className="text-rose-500">*</span>
                          </label>
                          <input
                            id="productName"
                            type="text"
                            className={`b2b-input ${hasAttemptedSubmit && validationErrors.productName ? 'has-error' : ''}`}
                            placeholder="e.g. Suspension PVC Resin"
                            value={formData.productName}
                            onChange={(e) => updateField('productName', e.target.value)}
                            aria-invalid={Boolean(validationErrors.productName)}
                          />
                          {hasAttemptedSubmit && validationErrors.productName && (
                            <p className="text-xs text-rose-600 mt-1">{validationErrors.productName}</p>
                          )}
                        </div>

                        <div>
                          <label htmlFor="category" className="block text-xs font-semibold text-slate-700 mb-1">
                            Category <span className="text-rose-500">*</span>
                          </label>
                          <select
                            id="category"
                            className={`b2b-input ${hasAttemptedSubmit && validationErrors.category ? 'has-error' : ''}`}
                            value={formData.category}
                            onChange={(e) => updateField('category', e.target.value)}
                            aria-invalid={Boolean(validationErrors.category)}
                          >
                            <option value="">
                              {loadingCategories ? '-- Loading Categories... --' : '-- Select Material Category --'}
                            </option>
                            {categories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                          {hasAttemptedSubmit && validationErrors.category && (
                            <p className="text-xs text-rose-600 mt-1">{validationErrors.category}</p>
                          )}
                        </div>
                      </div>

                      {/* Grade & SKU */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="gradeVariant" className="block text-xs font-semibold text-slate-700 mb-1">
                            Grade / Variant <span className="text-rose-500">*</span>
                          </label>
                          <input
                            id="gradeVariant"
                            type="text"
                            className={`b2b-input ${hasAttemptedSubmit && validationErrors.gradeVariant ? 'has-error' : ''}`}
                            placeholder="e.g. K-67 / Injection Grade"
                            value={formData.gradeVariant}
                            onChange={(e) => updateField('gradeVariant', e.target.value)}
                          />
                          {hasAttemptedSubmit && validationErrors.gradeVariant && (
                            <p className="text-xs text-rose-600 mt-1">{validationErrors.gradeVariant}</p>
                          )}
                        </div>

                        <div>
                          <label htmlFor="sku" className="block text-xs font-semibold text-slate-700 mb-1">
                            Product Code / SKU <span className="text-slate-400 font-normal">(Optional)</span>
                          </label>
                          <input
                            id="sku"
                            type="text"
                            className="b2b-input"
                            placeholder="e.g. SYN-PVC-K67-DOM"
                            value={formData.sku}
                            onChange={(e) => updateField('sku', e.target.value)}
                          />
                        </div>
                      </div>

                      {/* HSN Code */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="hsnCode" className="block text-xs font-semibold text-slate-700 mb-1">
                            HSN Code <span className="text-slate-400 font-normal">(GST Classification)</span>
                          </label>
                          <input
                            id="hsnCode"
                            type="text"
                            className="b2b-input"
                            placeholder="e.g. 39041000"
                            value={formData.hsnCode}
                            onChange={(e) => updateField('hsnCode', e.target.value)}
                          />
                        </div>

                        <div className="flex items-center text-xs text-slate-500 p-3 bg-slate-50 rounded-md border border-slate-200 mt-1 sm:mt-5">
                          <HelpCircle className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
                          <span>HSN ensures automated GST calculation on invoices and delivery challans.</span>
                        </div>
                      </div>

                      {/* Short Description with 150 char counter */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label htmlFor="shortDescription" className="text-xs font-semibold text-slate-700">
                            Short Description <span className="text-rose-500">*</span>
                          </label>
                          <span
                            className={`text-xs font-mono font-medium ${formData.shortDescription.length > 150 ? 'text-rose-600 font-bold' : 'text-slate-400'
                              }`}
                          >
                            {formData.shortDescription.length} / 150 characters
                          </span>
                        </div>
                        <textarea
                          id="shortDescription"
                          rows={3}
                          className={`b2b-input resize-none ${hasAttemptedSubmit && validationErrors.shortDescription ? 'has-error' : ''
                            }`}
                          placeholder="Provide a concise summary highlighting purity, molecular weight, or industrial end uses..."
                          value={formData.shortDescription}
                          onChange={(e) => updateField('shortDescription', e.target.value)}
                          maxLength={160}
                        />
                        {hasAttemptedSubmit && validationErrors.shortDescription && (
                          <p className="text-xs text-rose-600 mt-1">{validationErrors.shortDescription}</p>
                        )}
                      </div>

                      {/* Product Image Upload with Drag & Drop */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Product Primary Image <span className="text-rose-500">*</span>
                        </label>

                        {!formData.primaryImage ? (
                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsDraggingImage(true);
                            }}
                            onDragLeave={() => setIsDraggingImage(false)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setIsDraggingImage(false);
                              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                handleImageFileSelect(e.dataTransfer.files[0]);
                              }
                            }}
                            className={`b2b-dropzone ${isDraggingImage ? 'active' : ''} ${hasAttemptedSubmit && validationErrors.primaryImage ? 'border-rose-400 bg-rose-50/50' : ''
                              }`}
                          >
                            <UploadCloud className="w-8 h-8 text-[#0E7C86] mb-2" />
                            <p className="text-sm font-semibold text-[#0F2A47]">
                              Drag & drop product photo or{' '}
                              <label className="text-[#0E7C86] underline cursor-pointer hover:text-teal-700">
                                browse files
                                <input
                                  type="file"
                                  accept="image/png, image/jpeg, image/webp"
                                  className="hidden"
                                  onChange={(e) => handleImageFileSelect(e.target.files[0])}
                                />
                              </label>
                            </p>
                            <p className="text-xs text-slate-400 mt-1">Accepts JPG, PNG, WebP (Max 5MB)</p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                            <img
                              src={formData.primaryImage.url}
                              alt="Product preview"
                              className="w-16 h-16 object-cover rounded-md border border-slate-200 shadow-2xs"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">
                                {formData.primaryImage.name}
                              </p>
                              <p className="text-xs text-slate-400">{formData.primaryImage.size}</p>
                              <span className="inline-block mt-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                Primary Image Loaded
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => updateField('primaryImage', null)}
                              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                              aria-label="Remove image"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {hasAttemptedSubmit && validationErrors.primaryImage && (
                          <p className="text-xs text-rose-600 mt-1">{validationErrors.primaryImage}</p>
                        )}

                        {/* Additional Gallery Images */}
                        <div className="mt-3">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Additional Gallery Images <span className="text-slate-400 font-normal">(Optional)</span>
                          </label>
                          <div className="flex flex-wrap items-center gap-2.5">
                            {formData.additionalImages.map((img, idx) => (
                              <div
                                key={idx}
                                className="relative group w-14 h-14 rounded border border-slate-200 overflow-hidden shadow-2xs"
                              >
                                <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      additionalImages: prev.additionalImages.filter((_, i) => i !== idx)
                                    }))
                                  }
                                  className="absolute inset-0 bg-slate-900/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                            <label className="w-14 h-14 border border-dashed border-slate-300 rounded flex flex-col items-center justify-center text-slate-400 hover:text-[#0E7C86] hover:border-[#0E7C86] hover:bg-teal-50/50 cursor-pointer transition-colors">
                              <Plus className="w-4 h-4" />
                              <span className="text-[9px] font-semibold mt-0.5">Add</span>
                              <input
                                type="file"
                                accept="image/png, image/jpeg, image/webp"
                                className="hidden"
                                onChange={(e) => handleAdditionalImageSelect(e.target.files[0])}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>



                  {/* 3. Quantity and Units Card */}
                  <section className="b2b-card p-6" aria-labelledby="section-quantities">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                      <div>
                        <h2 id="section-quantities" className="text-base font-bold text-[#0F2A47]">
                          3. Quantity and Units
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Define allowable enquiry thresholds per MSME buyer.
                        </p>
                      </div>
                      <span className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 text-slate-600 rounded">
                        Step 3 of 6
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Unit of Measure */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Unit of Measure (UOM) <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex rounded-md border border-slate-200 p-1 bg-slate-50">
                          {['MT', 'kg'].map((unit) => (
                            <button
                              key={unit}
                              type="button"
                              onClick={() => updateField('uom', unit)}
                              className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${formData.uom === unit
                                ? 'bg-[#0E7C86] text-white shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                              {unit}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Minimum Enquiry Quantity */}
                      <div>
                        <label htmlFor="minEnquiryQuantity" className="block text-xs font-semibold text-slate-700 mb-1">
                          Min. Enquiry Qty ({formData.uom}) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          id="minEnquiryQuantity"
                          type="number"
                          min="1"
                          step="any"
                          className={`b2b-input ${hasAttemptedSubmit && validationErrors.minEnquiryQuantity ? 'has-error' : ''
                            }`}
                          placeholder="e.g. 5"
                          value={formData.minEnquiryQuantity}
                          onChange={(e) => updateField('minEnquiryQuantity', e.target.value)}
                        />
                        {hasAttemptedSubmit && validationErrors.minEnquiryQuantity && (
                          <p className="text-xs text-rose-600 mt-1">{validationErrors.minEnquiryQuantity}</p>
                        )}
                      </div>

                      {/* Maximum Enquiry Quantity */}
                      <div>
                        <label htmlFor="maxEnquiryQuantity" className="block text-xs font-semibold text-slate-700 mb-1">
                          Max. Enquiry Qty ({formData.uom}) <span className="text-slate-400 font-normal">(Cap)</span>
                        </label>
                        <input
                          id="maxEnquiryQuantity"
                          type="number"
                          min="1"
                          step="any"
                          className={`b2b-input ${hasAttemptedSubmit && validationErrors.maxEnquiryQuantity ? 'has-error' : ''
                            }`}
                          placeholder="e.g. 100"
                          value={formData.maxEnquiryQuantity}
                          onChange={(e) => updateField('maxEnquiryQuantity', e.target.value)}
                        />
                        {hasAttemptedSubmit && validationErrors.maxEnquiryQuantity && (
                          <p className="text-xs text-rose-600 mt-1">{validationErrors.maxEnquiryQuantity}</p>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* 4. Sourcing Card */}
                  <section className="b2b-card p-6" aria-labelledby="section-sourcing">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                      <div>
                        <h2 id="section-sourcing" className="text-base font-bold text-[#0F2A47]">
                          4. Sourcing & Origin Channels
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Specify origin options and logistics delivery timelines.
                        </p>
                      </div>
                      <span className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 text-slate-600 rounded">
                        Step 4 of 6
                      </span>
                    </div>

                    <div className="space-y-4">
                      {/* Checkboxes: Domestic vs Import */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2">
                          Sourcing Options <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex flex-wrap items-center gap-6">
                          <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-800">
                            <input
                              type="checkbox"
                              checked={formData.sourcingOptions.includes('Domestic')}
                              onChange={() => toggleSourcingOption('Domestic')}
                              className="w-4 h-4 text-[#0E7C86] rounded border-slate-300 focus:ring-[#0E7C86]"
                            />
                            <span>Domestic (India)</span>
                          </label>

                          <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-800">
                            <input
                              type="checkbox"
                              checked={formData.sourcingOptions.includes('Import')}
                              onChange={() => toggleSourcingOption('Import')}
                              className="w-4 h-4 text-[#0E7C86] rounded border-slate-300 focus:ring-[#0E7C86]"
                            />
                            <span>Import (International Supply)</span>
                          </label>
                        </div>
                        {hasAttemptedSubmit && validationErrors.sourcingOptions && (
                          <p className="text-xs text-rose-600 mt-1">{validationErrors.sourcingOptions}</p>
                        )}
                      </div>

                      {/* Conditional Allowed Import Origins */}
                      {formData.sourcingOptions.includes('Import') && (
                        <div className="p-4 bg-teal-50/40 rounded-lg border border-teal-200 animate-fade-in">
                          <label className="block text-xs font-semibold text-[#0F2A47] mb-1.5">
                            Allowed Import Origins <span className="text-slate-400 font-normal">(Select all approved origins)</span>
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {IMPORT_COUNTRIES.map((country) => {
                              const isSelected = formData.allowedImportOrigins.includes(country);
                              return (
                                <button
                                  key={country}
                                  type="button"
                                  onClick={() => toggleImportOrigin(country)}
                                  className={`px-2.5 py-1 text-xs rounded-full border transition-all ${isSelected
                                    ? 'bg-[#0E7C86] text-white border-[#0E7C86] shadow-2xs'
                                    : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                                    }`}
                                >
                                  {isSelected ? '✓ ' : '+ '}
                                  {country}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Default delivery window */}
                      <div>
                        <label htmlFor="defaultDeliveryWindow" className="block text-xs font-semibold text-slate-700 mb-1">
                          Default Delivery Window
                        </label>
                        <input
                          id="defaultDeliveryWindow"
                          type="text"
                          className="b2b-input"
                          placeholder="e.g. 7 - 10 working days from order confirmation (Ex-Warehouse / Port)"
                          value={formData.defaultDeliveryWindow}
                          onChange={(e) => updateField('defaultDeliveryWindow', e.target.value)}
                        />
                      </div>
                    </div>
                  </section>

                  {/* 5. Enquiry Window Card */}
                  <section className="b2b-card p-6" aria-labelledby="section-window">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                      <div>
                        <h2 id="section-window" className="text-base font-bold text-[#0F2A47]">
                          5. Collective Buy Enquiry Window
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Set active bidding lifecycle and status for this procurement round.
                        </p>
                      </div>
                      <span className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 text-slate-600 rounded">
                        Step 5 of 6
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Status Selection */}
                      <div>
                        <label htmlFor="opportunityStatus" className="block text-xs font-semibold text-slate-700 mb-1">
                          Opportunity Status <span className="text-rose-500">*</span>
                        </label>
                        <select
                          id="opportunityStatus"
                          className="b2b-input font-medium"
                          value={formData.opportunityStatus}
                          onChange={(e) => updateField('opportunityStatus', e.target.value)}
                        >
                          <option value="Upcoming">Upcoming</option>
                          <option value="Open for Enquiries">Open for Enquiries</option>
                          <option value="Closing Soon">Closing Soon</option>
                          <option value="Closed">Closed</option>
                        </select>
                      </div>

                      {/* Opening Date */}
                      <div>
                        <label htmlFor="enquiryOpeningDate" className="block text-xs font-semibold text-slate-700 mb-1">
                          Opening Date <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          id="enquiryOpeningDate"
                          type="date"
                          className="b2b-input"
                          value={formData.enquiryOpeningDate}
                          onChange={(e) => updateField('enquiryOpeningDate', e.target.value)}
                        />
                      </div>

                      {/* Closing Date */}
                      <div>
                        <label htmlFor="enquiryClosingDate" className="block text-xs font-semibold text-slate-700 mb-1">
                          Enquiry Closing Date <span className="text-rose-500">*</span>
                        </label>
                        <input
                          id="enquiryClosingDate"
                          type="date"
                          className={`b2b-input ${hasAttemptedSubmit && validationErrors.enquiryClosingDate ? 'has-error' : ''
                            }`}
                          value={formData.enquiryClosingDate}
                          onChange={(e) => updateField('enquiryClosingDate', e.target.value)}
                        />
                        {hasAttemptedSubmit && validationErrors.enquiryClosingDate && (
                          <p className="text-xs text-rose-600 mt-1">{validationErrors.enquiryClosingDate}</p>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* 6. Public Display and Visibility Card */}
                  {/* <section className="b2b-card p-6" aria-labelledby="section-visibility">
                    <div className="pb-4 border-b border-slate-100 mb-5">
                      <h2 id="section-visibility" className="text-base font-bold text-[#0F2A47]">
                        6. Public Display & Visibility Rules
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Configure transparency, aggregator displays, and targeted supplier access.
                      </p>
                    </div>

                    <div className="space-y-4">
      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                        <label className="b2b-toggle-wrapper justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50">
                          <span className="text-xs font-semibold text-slate-800">
                            Show on Homepage
                            <span className="block text-[11px] font-normal text-slate-400">
                              Promote on collective buy showcase
                            </span>
                          </span>
                          <div className="b2b-toggle ml-3">
                            <input
                              type="checkbox"
                              checked={formData.showOnHomepage}
                              onChange={(e) => updateField('showOnHomepage', e.target.checked)}
                            />
                            <span className="b2b-toggle-slider"></span>
                          </div>
                        </label>

                   
                        <label className="b2b-toggle-wrapper justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50">
                          <span className="text-xs font-semibold text-slate-800">
                            Show Enquiry Count Publicly
                            <span className="block text-[11px] font-normal text-slate-400">
                              Display total buyers participating
                            </span>
                          </span>
                          <div className="b2b-toggle ml-3">
                            <input
                              type="checkbox"
                              checked={formData.showEnquiryCountPublicly}
                              onChange={(e) => updateField('showEnquiryCountPublicly', e.target.checked)}
                            />
                            <span className="b2b-toggle-slider"></span>
                          </div>
                        </label>

                     
                        <label className="b2b-toggle-wrapper justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50">
                          <span className="text-xs font-semibold text-slate-800">
                            Show Aggregate Demand Publicly
                            <span className="block text-[11px] font-normal text-slate-400">
                              Show live cumulative MT booked
                            </span>
                          </span>
                          <div className="b2b-toggle ml-3">
                            <input
                              type="checkbox"
                              checked={formData.showAggregateDemandPublicly}
                              onChange={(e) => updateField('showAggregateDemandPublicly', e.target.checked)}
                            />
                            <span className="b2b-toggle-slider"></span>
                          </div>
                        </label>

                   
                        <label className="b2b-toggle-wrapper justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50">
                          <span className="text-xs font-semibold text-slate-800">
                            Show to Suppliers for Quotation
                            <span className="block text-[11px] font-normal text-slate-400">
                              Allow manufacturers to place counter-offers
                            </span>
                          </span>
                          <div className="b2b-toggle ml-3">
                            <input
                              type="checkbox"
                              checked={formData.showToSuppliers}
                              onChange={(e) => updateField('showToSuppliers', e.target.checked)}
                            />
                            <span className="b2b-toggle-slider"></span>
                          </div>
                        </label>
                      </div>

             
                      <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Eligible Suppliers for RFQ Broadcast <span className="text-slate-400 font-normal">(Optional)</span>
                          </label>
                          <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200">
                            {AVAILABLE_SUPPLIERS.map((supplier) => {
                              const isSelected = formData.eligibleSuppliers.includes(supplier);
                              return (
                                <button
                                  key={supplier}
                                  type="button"
                                  onClick={() => toggleSupplier(supplier)}
                                  className={`text-[11px] px-2.5 py-1 rounded border transition-colors ${isSelected
                                    ? 'bg-[#0F2A47] text-white border-[#0F2A47]'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                  {isSelected ? '✓ ' : '+ '}
                                  {supplier}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <label htmlFor="displayOrder" className="block text-xs font-semibold text-slate-700 mb-1">
                            Display Priority / Sort Order
                          </label>
                          <input
                            id="displayOrder"
                            type="number"
                            min="1"
                            className="b2b-input"
                            value={formData.displayOrder}
                            onChange={(e) => updateField('displayOrder', parseInt(e.target.value, 10) || 1)}
                          />
                          <p className="text-[11px] text-slate-400 mt-1">Lower numbers appear first on the public catalogue.</p>
                        </div>
                      </div>
                    </div>
                  </section> */}

                  {/* 7. Commercial Settings Card (Admin Only) */}
                  {/* <section
                    className="b2b-card p-6 border-l-4 border-l-[#0E7C86] bg-gradient-to-br from-white to-slate-50/50"
                    aria-labelledby="section-commercial"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-[#0E7C86]">
                          <Lock className="w-4 h-4" />
                        </div>
                        <div>
                          <h2 id="section-commercial" className="text-sm font-bold text-[#0F2A47]">
                            7. Commercial & Platform Fee Settings
                          </h2>
                          <span className="text-[11px] font-semibold text-teal-800 bg-teal-100 px-2 py-0.5 rounded">
                            Visible to admins only
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 italic mb-4">
                      * Helper notice: Use the rate agreed in the supplier master agreement.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="successFeeDomesticPercent"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Success Fee % (Domestic Fulfillment)
                        </label>
                        <div className="relative">
                          <input
                            id="successFeeDomesticPercent"
                            type="number"
                            step="0.01"
                            placeholder="e.g. 0.75"
                            className="b2b-input pr-8"
                            value={formData.successFeeDomesticPercent}
                            onChange={(e) => updateField('successFeeDomesticPercent', e.target.value)}
                          />
                          <span className="absolute right-3 top-3 text-slate-400 text-xs font-bold">%</span>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="successFeeImportPercent"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Success Fee % (Import High Seas / Direct)
                        </label>
                        <div className="relative">
                          <input
                            id="successFeeImportPercent"
                            type="number"
                            step="0.01"
                            placeholder="e.g. 1.25"
                            className="b2b-input pr-8"
                            value={formData.successFeeImportPercent}
                            onChange={(e) => updateField('successFeeImportPercent', e.target.value)}
                          />
                          <span className="absolute right-3 top-3 text-slate-400 text-xs font-bold">%</span>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="feeNotes" className="block text-xs font-semibold text-slate-700 mb-1">
                          Fee Terms & Commission Notes
                        </label>
                        <textarea
                          id="feeNotes"
                          rows={2}
                          className="b2b-input text-xs resize-none"
                          placeholder="e.g. Rate negotiated with regional distributor; invoiced net-15 post delivery."
                          value={formData.feeNotes}
                          onChange={(e) => updateField('feeNotes', e.target.value)}
                        />
                      </div>

                      <div>
                        <label htmlFor="internalNotes" className="block text-xs font-semibold text-slate-700 mb-1">
                          Internal Sourcing Desk Notes
                        </label>
                        <textarea
                          id="internalNotes"
                          rows={2}
                          className="b2b-input text-xs resize-none"
                          placeholder="Internal allocation details, factory contacts, or payment credit lines..."
                          value={formData.internalNotes}
                          onChange={(e) => updateField('internalNotes', e.target.value)}
                        />
                      </div>
                    </div>
                  </section> */}

                  {/* 8. SEO Card (Accordion, Collapsed by default) */}
                  {/* <section className="b2b-card overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setSeoOpen(!seoOpen)}
                      className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                      aria-expanded={seoOpen}
                    >
                      <div>
                        <h2 className="text-sm font-bold text-[#0F2A47] flex items-center gap-2">
                          <Globe className="w-4 h-4 text-slate-500" />
                          <span>8. Search Engine Optimization (SEO) Metadata</span>
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Customize meta title and description for search engines.
                        </p>
                      </div>
                      {seoOpen ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </button>

                    {seoOpen && (
                      <div className="p-6 pt-0 border-t border-slate-100 space-y-4 animate-fade-in">
                        <div>
                          <label htmlFor="seoTitle" className="block text-xs font-semibold text-slate-700 mb-1">
                            SEO Page Title
                          </label>
                          <input
                            id="seoTitle"
                            type="text"
                            className="b2b-input"
                            placeholder="e.g. Buy Virgin PVC Resin K67 Bulk - Synergy5M Collective Buy"
                            value={formData.seoTitle}
                            onChange={(e) => updateField('seoTitle', e.target.value)}
                          />
                        </div>

                        <div>
                          <label htmlFor="seoDescription" className="block text-xs font-semibold text-slate-700 mb-1">
                            SEO Meta Description
                          </label>
                          <textarea
                            id="seoDescription"
                            rows={2}
                            className="b2b-input text-xs resize-none"
                            placeholder="Compelling 160-character description for Google search snippets..."
                            value={formData.seoDescription}
                            onChange={(e) => updateField('seoDescription', e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </section> */}

                  {/* Bottom Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 pb-8">
                    <button
                      type="button"
                      onClick={handleCancelClick}
                      className="b2b-btn-secondary w-full sm:w-auto"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Cancel</span>
                    </button>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleSaveDraft}
                        disabled={isSubmitting}
                        className="b2b-btn-secondary flex-1 sm:flex-initial"
                      >
                        Save as Draft
                      </button>

                      <button
                        type="button"
                        onClick={handlePublish}
                        disabled={!isValid || isSubmitting}
                        className="b2b-btn-primary flex-1 sm:flex-initial"
                      >
                        {isSubmitting ? (
                          <span className="inline-block animate-spin mr-1">⌛</span>
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        <span>Publish Product</span>
                      </button>
                    </div>
                  </div>

                  {/* Developer Preview Collapsible Box */}
                  {/* <div className="border border-slate-200 rounded-lg bg-slate-900 text-slate-200 overflow-hidden mt-6">
                    <button
                      type="button"
                      onClick={() => setDevJsonOpen(!devJsonOpen)}
                      className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Code className="w-4 h-4 text-teal-400" />
                        <span className="text-xs font-mono font-semibold text-teal-300">
                          Data Structure Preview
                        </span>
                      </div>
                      {devJsonOpen ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    {devJsonOpen && (
                      <div className="p-4 border-t border-slate-800 bg-[#0A131F]">
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                          <span className="text-[11px] text-slate-400">
                            Product record structure:
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyJson}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-teal-300 transition-colors"
                          >
                            {jsonCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{jsonCopied ? 'Copied' : 'Copy JSON'}</span>
                          </button>
                        </div>
                        <pre className="text-xs font-mono text-emerald-400 overflow-x-auto p-2 bg-black/40 rounded b2b-custom-scrollbar max-h-72">
                          {JSON.stringify(formattedPayload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div> */}
                </div>

                {/* Right Column: Sticky Live Preview Panel (~30%) */}
                <div
                  className={`lg:col-span-4 lg:b2b-sticky-preview space-y-5 ${mobileTab === 'form' ? 'hidden lg:block' : 'block'
                    }`}
                >
                  {/* Form Progress Card */}
                  <div className="b2b-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[#0F2A47] uppercase tracking-wider">
                        Readiness Indicator
                      </span>
                      <span
                        className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${completionPercentage === 100
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                          }`}
                      >
                        {completionPercentage}% Complete
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-3">
                      <div
                        className={`h-full transition-all duration-300 ${completionPercentage === 100 ? 'bg-[#0E7C86]' : 'bg-amber-500'
                          }`}
                        style={{ width: `${completionPercentage}%` }}
                      ></div>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      {completionPercentage === 100
                        ? '✓ All mandatory fields completed. Ready to publish to MSME buyers.'
                        : `${Object.keys(validationErrors).length} required field(s) remaining before publish can be enabled.`}
                    </p>
                  </div>

                  {/* Header label for live preview */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                      <Eye className="w-3.5 h-3.5 text-[#0E7C86]" />
                      <span>Public Card Live Preview</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Updates live</span>
                  </div>

                  {/* THE LIVE PRODUCT CARD (Matching Public "Products Open for Enquiries" specification) */}
                  <div className="public-card-preview">
                    {/* Card Image Banner */}
                    <div className="relative h-44 bg-slate-100 overflow-hidden flex items-center justify-center">
                      {formData.primaryImage?.url ? (
                        <img
                          src={formData.primaryImage.url}
                          alt={formData.productName || 'Product'}
                          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                        />
                      ) : (
                        <div className="text-center p-6 text-slate-400 flex flex-col items-center">
                          <Package className="w-10 h-10 stroke-1 text-slate-300 mb-2" />
                          <span className="text-xs font-medium">[Product Image Placeholder]</span>
                        </div>
                      )}

                      {/* Sourcing Badges */}
                      <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                        {formData.sourcingOptions.includes('Domestic') && (
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-white/95 text-slate-800 shadow-xs border border-slate-200">
                            Domestic
                          </span>
                        )}
                        {formData.sourcingOptions.includes('Import') && (
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-[#0F2A47] text-white shadow-xs">
                            Import
                          </span>
                        )}
                      </div>

                      {/* Opportunity Status Badge */}
                      <div className="absolute top-2.5 right-2.5">
                        <span
                          className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border shadow-2xs ${getStatusBadgeClass(
                            formData.opportunityStatus
                          )}`}
                        >
                          {formData.opportunityStatus}
                        </span>
                      </div>
                    </div>

                    {/* Card Content Body */}
                    <div className="p-4 sm:p-5">
                      {/* Category Pill */}
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#0E7C86] bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                        {formData.category || 'Category Placeholder'}
                      </span>

                      {/* Product Name */}
                      <h3 className="text-base font-bold text-[#0F2A47] mt-2 line-clamp-1">
                        {formData.productName || 'Product Name Placeholder'}
                      </h3>

                      {/* Grade / Variant */}
                      <p className="text-xs font-semibold text-slate-600 mb-2.5">
                        Grade: <span className="text-[#0E7C86]">{formData.gradeVariant || 'Standard Grade'}</span>
                      </p>

                      {/* Short Description */}
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4 min-h-[32px]">
                        {formData.shortDescription || 'Short description outlining technical utility and specifications...'}
                      </p>

                      {/* Sourcing Origin detail if import */}
                      {formData.sourcingOptions.includes('Import') && formData.allowedImportOrigins.length > 0 && (
                        <div className="mb-3 text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
                          <span className="font-semibold text-slate-700">Origins:</span>{' '}
                          {formData.allowedImportOrigins.join(', ')}
                        </div>
                      )}

                      {/* Specification Highlights Grid */}
                      {formData.specifications.filter((s) => s.key && s.value).length > 0 && (
                        <div className="grid grid-cols-2 gap-1.5 py-2.5 my-2 border-y border-slate-100 text-[11px]">
                          {formData.specifications
                            .filter((s) => s.key && s.value)
                            .slice(0, 4)
                            .map((spec, i) => (
                              <div key={i} className="truncate">
                                <span className="text-slate-400">{spec.key}: </span>
                                <span className="font-medium text-slate-700">{spec.value}</span>
                              </div>
                            ))}
                        </div>
                      )}

                      {/* Min Quantity & Window Grid */}
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 mb-4 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[11px] text-slate-400 block font-medium">Min. Order Qty</span>
                          <span className="font-bold text-[#0F2A47] text-sm">
                            {formData.minEnquiryQuantity || '0'} {formData.uom}
                          </span>
                        </div>

                        <div>
                          <span className="text-[11px] text-slate-400 block font-medium">Round Closes</span>
                          <span className="font-semibold text-slate-700 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {formData.enquiryClosingDate
                              ? new Date(formData.enquiryClosingDate).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short'
                              })
                              : 'Date TBD'}
                          </span>
                        </div>
                      </div>

                      {/* Mandatory Rule Requirement Notice */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400 italic mb-4">
                        <span>Demand: live system data only</span>
                        <span className="not-italic text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                          Verified S5M
                        </span>
                      </div>

                      {/* Public Action CTA Button Preview */}
                      <button
                        type="button"
                        disabled
                        className="w-full py-2.5 rounded-lg bg-[#0E7C86] text-white font-bold text-xs uppercase tracking-wider text-center shadow-xs cursor-default flex items-center justify-center gap-1.5 opacity-90"
                      >
                        <span>Submit Enquiry</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Quick Helper Guide Card */}
                  <div className="b2b-card p-4 text-xs text-slate-600 bg-slate-50/70 border-dashed">
                    <div className="flex items-center gap-2 font-bold text-[#0F2A47] mb-1.5">
                      <HelpCircle className="w-4 h-4 text-[#0E7C86]" />
                      <span>How Collective Buy Rounds Work</span>
                    </div>
                    <p className="leading-relaxed text-[11px] text-slate-500">
                      Once published, MSMEs aggregate their volume requirements. Synergy5M then negotiates direct ex-plant or high-seas pricing with primary manufacturers on behalf of the pool.
                    </p>
                  </div>
                </div>
              </div>
            ) : activeAdminTab === 'table' ? (
              /* Database Products Table / Cards Catalogue View */
              <div className="space-y-6">
                {/* Database Table Search & Category Filter + View Switcher Bar */}
                <div className="b2b-card p-4 sm:p-5">
                  <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={tableSearch}
                          onChange={(e) => setTableSearch(e.target.value)}
                          placeholder="Search published products by name, grade, SKU, category, or ID..."
                          className="b2b-input !pl-9 text-xs"
                        />
                        {tableSearch && (
                          <button
                            type="button"
                            onClick={() => setTableSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="w-full sm:w-56">
                        <select
                          value={tableCategoryFilter}
                          onChange={(e) => setTableCategoryFilter(e.target.value)}
                          className="b2b-input text-xs"
                        >
                          <option value="All">All Categories ({dbProducts.length})</option>
                          {availableCategories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* View Switcher: Table vs Cards */}
                    <div className="flex items-center gap-2 self-end md:self-auto">
                      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                        <button
                          type="button"
                          onClick={() => setProductViewMode('table')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${productViewMode === 'table'
                            ? 'bg-white text-[#0F2A47] shadow-sm'
                            : 'text-slate-500 hover:text-slate-900'
                            }`}
                          title="Table List View"
                        >
                          <List className="w-3.5 h-3.5" />
                          <span>Table</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setProductViewMode('cards')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${productViewMode === 'cards'
                            ? 'bg-white text-[#0F2A47] shadow-sm'
                            : 'text-slate-500 hover:text-slate-900'
                            }`}
                          title="Card / Cart Grid View"
                        >
                          <LayoutGrid className="w-3.5 h-3.5" />
                          <span>Cards</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => switchTab('form')}
                        className="b2b-btn-primary text-xs !py-1.5 !px-3 flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Product</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Table Card */}
                <div className="b2b-card overflow-hidden">
                  {loadingDbProducts ? (
                    <div className="p-12 text-center text-slate-500">
                      <div className="inline-block animate-spin text-[#0E7C86] mb-3">
                        <RefreshCw className="w-8 h-8" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">Loading products...</p>
                      <p className="text-xs text-slate-400 mt-1">Please wait while we fetch the latest catalogue.</p>
                    </div>
                  ) : filteredDbProducts.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                        <Package className="w-7 h-7" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-700">No products found</h3>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                        {dbProducts.length === 0
                          ? 'No products have been added yet. Use the Add Product form to publish your first product.'
                          : 'No products match your search or filter criteria. Try clearing your search.'}
                      </p>
                      {dbProducts.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => switchTab('form')}
                          className="b2b-btn-primary text-xs !py-1.5 !px-3 mx-auto"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Go to Add Product Form</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setTableSearch('');
                            setTableCategoryFilter('All');
                          }}
                          className="b2b-btn-secondary text-xs !py-1.5 !px-3 mx-auto"
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  ) : productViewMode === 'cards' ? (
                    /* Cards / Cart Grid View */
                    <div className="p-4 sm:p-5 space-y-4 bg-slate-50/50">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredDbProducts.map((p) => {
                          const name = p.productMaster?.productName || p.productName || 'Unnamed Raw Material';
                          const cat = p.productMaster?.category || p.category || 'Industrial Chemicals';
                          const grade = p.productMaster?.gradeVariant || p.gradeVariant || '-';
                          const sku = p.productMaster?.sku || p.sku || '-';
                          const minQty = p.opportunity?.minEnquiryQuantity || p.minEnquiryQuantity || '1';
                          const uom = p.productMaster?.uom || p.uom || 'MT';
                          const status = p.opportunity?.status || p.opportunityStatus || p.status || 'Open for Enquiries';
                          const imgUrl = p.productMaster?.primaryImage?.url || p.primaryImage?.url || p.image;
                          const targetPrice = p.opportunity?.targetPrice || p.targetPrice;
                          const id = p.id;

                          return (
                            <div
                              key={id}
                              className="bg-white rounded-xl border border-slate-200/90 overflow-hidden flex flex-col justify-between hover:shadow-md hover:border-[#0E7C86]/30 transition-all group"
                            >
                              <div>
                                {/* Card Image & Badges */}
                                <div className="relative h-44 bg-slate-100 overflow-hidden border-b border-slate-100 flex items-center justify-center">
                                  {imgUrl ? (
                                    <img
                                      src={imgUrl}
                                      alt={name}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                  ) : (
                                    <div className="text-slate-300 flex flex-col items-center gap-1.5">
                                      <Package className="w-12 h-12" />
                                      <span className="text-[10px] uppercase font-mono tracking-wider">No Image</span>
                                    </div>
                                  )}
                                  <span className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm ${status === 'Open for Enquiries'
                                    ? 'bg-emerald-600 text-white'
                                    : status === 'Closing Soon'
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-slate-700 text-white'
                                    }`}>
                                    {status}
                                  </span>
                                  <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded text-[10px] font-bold bg-[#0F2A47]/85 text-white backdrop-blur-xs">
                                    {cat}
                                  </span>
                                </div>

                                {/* Card Content */}
                                <div className="p-4 space-y-2.5">
                                  <div>
                                    <h4 className="font-bold text-[#0F2A47] text-sm leading-snug line-clamp-2" title={name}>
                                      {name}
                                    </h4>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {id} • SKU: {sku}</p>
                                  </div>

                                  <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                                    <div className="flex items-center justify-between text-slate-600">
                                      <span className="text-slate-400">Grade / Variant:</span>
                                      <span className="font-semibold text-slate-800 truncate max-w-[140px]">{grade}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-slate-600">
                                      <span className="text-slate-400">Min. Pool Qty:</span>
                                      <span className="font-bold text-teal-700">{minQty} {uom}</span>
                                    </div>
                                    {targetPrice && (
                                      <div className="flex items-center justify-between text-slate-600">
                                        <span className="text-slate-400">Target Price:</span>
                                        <span className="font-bold text-[#0F2A47]">₹{targetPrice}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Card Footer Actions */}
                              <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedProductForDetail(p)}
                                  className="b2b-btn-primary flex-1 text-xs !py-1.5 flex items-center justify-center gap-1.5 shadow-none"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View Details</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => window.open(`/collective-buying-opportunities`, '_blank')}
                                  className="p-1.5 text-slate-500 hover:text-[#0E7C86] hover:bg-white rounded border border-transparent hover:border-slate-200 transition-colors"
                                  title="Open Public Showcase"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteProduct(id, name)}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                                  title="Delete Product"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="b2b-table-scroll-container overflow-x-auto overflow-y-auto max-h-[600px] b2b-custom-scrollbar">
                      <table className="db-table w-full">
                        <thead className="sticky top-0 z-10 bg-[#F8FAFC]">
                          <tr>
                            <th>Product & Name</th>
                            <th>Category</th>
                            <th>Grade / Variant</th>
                            <th>SKU & HSN</th>
                            <th>Min. Enquiry Qty</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDbProducts.map((p) => {
                            const name = p.productMaster?.productName || p.productName || 'Unnamed Raw Material';
                            const cat = p.productMaster?.category || p.category || 'Industrial Chemicals';
                            const grade = p.productMaster?.gradeVariant || p.gradeVariant || '-';
                            const sku = p.productMaster?.sku || p.sku || '-';
                            const hsn = p.productMaster?.hsnCode || p.hsnCode || '-';
                            const minQty = p.opportunity?.minEnquiryQuantity || p.minEnquiryQuantity || '1';
                            const uom = p.productMaster?.uom || p.uom || 'MT';
                            const status = p.opportunity?.status || p.opportunityStatus || p.status || 'Open for Enquiries';
                            const imgUrl = p.productMaster?.primaryImage?.url || p.primaryImage?.url || p.image;
                            const id = p.id;

                            return (
                              <tr key={id}>
                                <td>
                                  <div className="flex items-center gap-3">
                                    {imgUrl ? (
                                      <img
                                        src={imgUrl}
                                        alt={name}
                                        className="w-10 h-10 rounded object-cover border border-slate-200 flex-shrink-0"
                                      />
                                    ) : (
                                      <div className="w-10 h-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
                                        <Package className="w-5 h-5" />
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <p className="font-bold text-[#0F2A47] text-xs truncate max-w-[240px]" title={name}>
                                        {name}
                                      </p>
                                      <p className="text-[11px] text-slate-400 font-mono">
                                        ID: {id}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span className="inline-block px-2 py-0.5 text-[11px] font-semibold bg-[#0E7C86]/10 text-[#0E7C86] rounded">
                                    {cat}
                                  </span>
                                </td>
                                <td>
                                  <span className="text-xs font-medium text-slate-700">{grade}</span>
                                </td>
                                <td>
                                  <div className="text-xs">
                                    <span className="font-mono text-slate-600 block">{sku}</span>
                                    {hsn && <span className="text-[10px] text-slate-400">HSN: {hsn}</span>}
                                  </div>
                                </td>
                                <td>
                                  <span className="text-xs font-bold text-slate-800">
                                    {minQty} {uom}
                                  </span>
                                </td>
                                <td>
                                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${status === 'Open for Enquiries'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : status === 'Closing Soon'
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-slate-100 text-slate-600'
                                    }`}>
                                    {status}
                                  </span>
                                </td>
                                <td>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedProductForDetail(p)}
                                      className="px-2 py-1 text-[#0E7C86] bg-teal-50 hover:bg-teal-100 rounded border border-teal-200 transition-colors flex items-center gap-1 text-xs font-semibold"
                                      title="View Product Details"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>View</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => window.open(`/collective-buying-opportunities`, '_blank')}
                                      className="p-1.5 text-slate-500 hover:text-[#0E7C86] hover:bg-slate-100 rounded transition-colors"
                                      title="View in Public Showcase"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteProduct(id, name)}
                                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                                      title="Delete from Database Table"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
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

                  {/* Table Footer */}
                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Showing {filteredDbProducts.length} of {dbProducts.length} published products
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Inbound Collective Enquiries Table View */
              <div className="space-y-6">
                {/* Enquiries Header & Search Card */}
                <div className="b2b-card p-5">


                  {/* Enquiries Metrics Summary */}
                  {/* <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 border-b border-slate-100">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Total Enquiries</p>
                      <p className="text-xl font-bold text-[#0F2A47] mt-1">{enquiries.length}</p>
                      <span className="text-[10px] text-teal-600 font-medium">Buyer Requirements</span>
                    </div>
                    <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100">
                      <p className="text-[11px] text-blue-700 font-medium uppercase tracking-wider">Submitted (New)</p>
                      <p className="text-xl font-bold text-blue-900 mt-1">
                        {enquiries.filter(e => (e.Status || e.status) === 'Submitted').length}
                      </p>
                      <span className="text-[10px] text-blue-600 font-medium">Awaiting Review</span>
                    </div>
                    <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-100">
                      <p className="text-[11px] text-amber-700 font-medium uppercase tracking-wider">In Review</p>
                      <p className="text-xl font-bold text-amber-900 mt-1">
                        {enquiries.filter(e => (e.Status || e.status) === 'In Review').length}
                      </p>
                      <span className="text-[10px] text-amber-600 font-medium">Under Evaluation</span>
                    </div>
                    <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-100">
                      <p className="text-[11px] text-emerald-700 font-medium uppercase tracking-wider">Total Volume</p>
                      <p className="text-xl font-bold text-emerald-900 mt-1">
                        {enquiries.reduce((acc, curr) => acc + (parseFloat(curr.RequiredQuantity || curr.requiredQuantity) || 0), 0)} MT
                      </p>
                      <span className="text-[10px] text-emerald-600 font-medium">Total Quantity</span>
                    </div>
                  </div> */}

                  {/* Filters: Search + Status */}
                  <div className="pt-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-8 relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={enquirySearch}
                        onChange={(e) => setEnquirySearch(e.target.value)}
                        placeholder="Search enquiries by Company, Buyer, Product, Email, Phone, Location or ID..."
                        className="b2b-input !pl-9 text-xs"
                      />
                      {enquirySearch && (
                        <button
                          type="button"
                          onClick={() => setEnquirySearch('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="sm:col-span-4">
                      <select
                        value={enquiryStatusFilter}
                        onChange={(e) => setEnquiryStatusFilter(e.target.value)}
                        className="b2b-input text-xs"
                      >
                        <option value="All">All Statuses ({enquiries.length})</option>
                        <option value="Submitted">Submitted</option>
                        <option value="In Review">In Review</option>
                        <option value="Allocated to Pool">Allocated to Pool</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="b2b-card overflow-hidden">
                  {loadingEnquiries ? (
                    <div className="p-12 text-center text-slate-500">
                      <div className="inline-block animate-spin text-[#0E7C86] mb-3">
                        <RefreshCw className="w-8 h-8" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">Loading enquiries...</p>
                      <p className="text-xs text-slate-400 mt-1">Please wait while we fetch buyer enquiries.</p>
                    </div>
                  ) : filteredEnquiries.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                        <Inbox className="w-7 h-7" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-700">No enquiries found</h3>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                        {enquiries.length === 0
                          ? 'No buyer enquiries received yet. Once buyers submit requirements through the public portal, they will appear here.'
                          : 'No enquiries match your search or filter criteria. Try clearing your search.'}
                      </p>
                      {enquiries.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setEnquirySearch('');
                            setEnquiryStatusFilter('All');
                          }}
                          className="b2b-btn-secondary text-xs !py-1.5 !px-3 mx-auto"
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="b2b-table-scroll-container overflow-x-auto overflow-y-auto max-h-[600px] b2b-custom-scrollbar">
                      <table className="db-table w-full">
                        <thead className="sticky top-0 z-10 bg-[#F8FAFC]">
                          <tr>
                            <th>Enquiry ID & Date</th>
                            <th>Buyer Company & Contact</th>
                            <th>Product Requested</th>
                            <th>Volume & Location</th>
                            <th>Target Date</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEnquiries.map((enq) => {
                            const id = enq.Id || enq.id;
                            const company = enq.CompanyName || enq.companyName || 'Unknown Company';
                            const person = enq.ContactPerson || enq.contactPerson || company;
                            const email = enq.Email || enq.email;
                            const phone = enq.Phone || enq.phone;
                            const product = enq.ProductName || enq.productName || 'Collective Buy Product';
                            const qty = enq.RequiredQuantity || enq.requiredQuantity || '—';
                            const uom = enq.Uom || enq.uom || 'MT';
                            const location = enq.DeliveryLocation || enq.deliveryLocation || '—';
                            const targetDate = enq.TargetDeliveryDate || enq.targetDeliveryDate;
                            const status = enq.Status || enq.status || 'Submitted';
                            const comments = enq.Comments || enq.comments;
                            const createdAt = enq.CreatedAt || enq.createdAt;

                            return (
                              <tr key={id}>
                                <td>
                                  <span className="font-mono font-bold text-xs text-[#0F2A47] block">
                                    #{id}
                                  </span>
                                  <span className="text-[11px] text-slate-400 block mt-0.5">
                                    {createdAt ? new Date(createdAt).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    }) : '—'}
                                  </span>
                                </td>
                                <td>
                                  <div className="space-y-0.5">
                                    <p className="font-bold text-xs text-[#0F2A47] flex items-center gap-1.5">
                                      <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                      <span>{company}</span>
                                    </p>
                                    {person && person !== company && (
                                      <p className="text-[11px] text-slate-600 flex items-center gap-1.5">
                                        <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                        <span>{person}</span>
                                      </p>
                                    )}
                                    <div className="flex items-center gap-3 text-[11px] pt-1">
                                      {email && (
                                        <a
                                          href={`mailto:${email}`}
                                          className="text-[#0E7C86] hover:underline flex items-center gap-1"
                                          title={email}
                                        >
                                          <Mail className="w-3 h-3" />
                                          <span className="truncate max-w-[140px]">{email}</span>
                                        </a>
                                      )}
                                      {phone && (
                                        <a
                                          href={`tel:${phone}`}
                                          className="text-slate-600 hover:text-slate-900 flex items-center gap-1 font-mono"
                                          title={phone}
                                        >
                                          <Phone className="w-3 h-3 text-slate-400" />
                                          <span>{phone}</span>
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <p className="font-bold text-xs text-[#0F2A47]">
                                    {product}
                                  </p>
                                  {comments && (
                                    <p className="text-[11px] text-slate-500 italic mt-0.5 max-w-[200px] truncate" title={comments}>
                                      "{comments}"
                                    </p>
                                  )}
                                </td>
                                <td>
                                  <div className="text-xs">
                                    <span className="font-bold text-slate-900 block text-sm">
                                      {qty} {uom}
                                    </span>
                                    {location && location !== '—' && (
                                      <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                        <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                        <span className="truncate max-w-[150px]">{location}</span>
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <span className="text-xs font-medium text-slate-700 flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-slate-400" />
                                    <span>
                                      {targetDate ? new Date(targetDate).toLocaleDateString('en-IN', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric'
                                      }) : 'Immediate / Open'}
                                    </span>
                                  </span>
                                </td>
                                <td>
                                  <select
                                    value={status}
                                    onChange={(e) => handleUpdateEnquiryStatus(id, e.target.value)}
                                    className={`text-[11px] font-bold px-2 py-1 rounded border cursor-pointer focus:outline-none ${status === 'Submitted'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : status === 'In Review'
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : status === 'Allocated to Pool'
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          : 'bg-slate-100 text-slate-600 border-slate-200'
                                      }`}
                                  >
                                    <option value="Submitted">Submitted</option>
                                    <option value="In Review">In Review</option>
                                    <option value="Allocated to Pool">Allocated to Pool</option>
                                    <option value="Closed">Closed</option>
                                  </select>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteEnquiry(id, company)}
                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                                    title="Delete from Database Table"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Table Footer */}
                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Showing {filteredEnquiries.length} of {enquiries.length} buyer enquiries
                    </span>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* =====================================================================
          Product Detail Modal (Shows complete specifications & attributes)
          ===================================================================== */}
      {selectedProductForDetail && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setSelectedProductForDetail(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-[#0E7C86]/10 flex items-center justify-center text-[#0E7C86] flex-shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#0E7C86] bg-teal-50 px-2 py-0.5 rounded border border-teal-200/50">
                      {selectedProductForDetail.productMaster?.category || selectedProductForDetail.category || 'General'}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${(selectedProductForDetail.opportunity?.status || selectedProductForDetail.status) === 'Open for Enquiries'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-700'
                      }`}>
                      {selectedProductForDetail.opportunity?.status || selectedProductForDetail.status || 'Active'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#0F2A47] mt-0.5 truncate" title={selectedProductForDetail.productMaster?.productName || selectedProductForDetail.productName}>
                    {selectedProductForDetail.productMaster?.productName || selectedProductForDetail.productName}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProductForDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 sm:p-6 overflow-y-auto b2b-custom-scrollbar space-y-5 text-xs text-slate-700">
              {/* Product Snapshot: Image + Basic Info */}
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-start">
                {(selectedProductForDetail.productMaster?.primaryImage?.url || selectedProductForDetail.image) ? (
                  <img
                    src={selectedProductForDetail.productMaster?.primaryImage?.url || selectedProductForDetail.image}
                    alt={selectedProductForDetail.productMaster?.productName}
                    className="w-28 h-28 object-cover rounded-lg border border-slate-200 shadow-xs flex-shrink-0"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
                    <Package className="w-10 h-10" />
                  </div>
                )}

                <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2.5 w-full">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Grade / Model</span>
                    <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                      {selectedProductForDetail.productMaster?.gradeVariant || selectedProductForDetail.gradeVariant || '—'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">SKU Code</span>
                    <span className="font-mono font-bold text-slate-800 text-xs mt-0.5 block truncate">
                      {selectedProductForDetail.productMaster?.sku || selectedProductForDetail.sku || '—'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">HSN Code</span>
                    <span className="font-mono font-bold text-slate-800 text-xs mt-0.5 block">
                      {selectedProductForDetail.productMaster?.hsnCode || selectedProductForDetail.hsnCode || '—'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Min. Enquiry (MOQ)</span>
                    <span className="font-bold text-[#0E7C86] text-xs mt-0.5 block">
                      {selectedProductForDetail.opportunity?.minEnquiryQuantity || selectedProductForDetail.minEnquiryQuantity || 1} {selectedProductForDetail.productMaster?.uom || 'MT'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Max Target Qty</span>
                    <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                      {selectedProductForDetail.opportunity?.maxEnquiryQuantity ? `${selectedProductForDetail.opportunity.maxEnquiryQuantity} MT` : 'Open Round'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Closing Date</span>
                    <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                      {selectedProductForDetail.opportunity?.enquiryClosingDate
                        ? new Date(selectedProductForDetail.opportunity.enquiryClosingDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })
                        : 'Open'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Short Description */}
              {selectedProductForDetail.productMaster?.shortDescription && (
                <div>
                  <h4 className="text-xs font-bold text-[#0F2A47] uppercase tracking-wider mb-1">Product Description</h4>
                  <p className="text-slate-600 leading-relaxed bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                    {selectedProductForDetail.productMaster.shortDescription}
                  </p>
                </div>
              )}

              {/* Technical Specifications Table */}
              <div>
                <h4 className="text-xs font-bold text-[#0F2A47] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#0E7C86]" />
                  <span>Technical Compliance Specifications</span>
                </h4>
                {selectedProductForDetail.productMaster?.specifications?.length > 0 ? (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Parameter / Property</th>
                          <th className="py-2 px-3">Compliance Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedProductForDetail.productMaster.specifications.map((spec, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-semibold text-slate-700">{spec.key}</td>
                            <td className="py-2 px-3 text-slate-900">{spec.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-400 italic bg-slate-50 p-3 rounded border border-slate-100 text-center">
                    No technical parameters specified for this product.
                  </p>
                )}
              </div>

              {/* Packaging & Application */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Packaging Information</span>
                  <span className="text-slate-700 font-medium mt-1 block">
                    {selectedProductForDetail.productMaster?.packagingType || 'Standard Industrial Palletized Packaging'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Target Application & End-Use</span>
                  <span className="text-slate-700 font-medium mt-1 block">
                    {selectedProductForDetail.productMaster?.applicationEndUse || 'Industrial Raw Material Processing'}
                  </span>
                </div>
              </div>

              {/* Technical Data Sheet Link */}
              {selectedProductForDetail.productMaster?.tdsDocument?.url && (
                <div className="p-3 bg-teal-50/60 rounded-lg border border-teal-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#0E7C86]" />
                    <span className="font-semibold text-slate-800">
                      {selectedProductForDetail.productMaster.tdsDocument.name || 'Technical Data Sheet (TDS)'}
                    </span>
                  </div>
                  <a
                    href={selectedProductForDetail.productMaster.tdsDocument.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-[#0E7C86] hover:underline flex items-center gap-1"
                  >
                    <span>Download TDS</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">
                Product ID: {selectedProductForDetail.id}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedProductForDetail(null)}
                  className="b2b-btn-secondary text-xs !py-1.5 !px-3"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const pid = selectedProductForDetail.id;
                    setSelectedProductForDetail(null);
                    navigate(pid ? `/admin/opportunity/${pid}` : '/admin/opportunity-view');
                  }}
                  className="b2b-btn-primary text-xs !py-1.5 !px-3 flex items-center gap-1.5 bg-[#0F2A47] hover:bg-[#163a61]"
                  title="Open collective-buying opportunity details"
                >
                  <FileCheck className="w-3.5 h-3.5 text-teal-300" />
                  <span>Opportunity View</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProductForDetail(null);
                    window.open('/products-open-for-enquiries', '_blank');
                  }}
                  className="b2b-btn-primary text-xs !py-1.5 !px-3 flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Public Portal</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
