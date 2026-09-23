import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx'; // Make sure to run: npm install xlsx

const INITIAL_VENDORS = [
  { id: 1, name: 'Apex Electronics & Parts', phone: '+15550192834', category: 'Hardware', rating: 4.8, avatar: 'https://placehold.co/100x100/3b82f6/ffffff?text=AE' },
  { id: 2, name: 'Global Textile Sourcing', phone: '+15550143920', category: 'Fabrics', rating: 4.5, avatar: 'https://placehold.co/100x100/10b981/ffffff?text=GT' },
  { id: 3, name: 'Metro Packaging Solutions', phone: '+15550183746', category: 'Packaging', rating: 4.9, avatar: 'https://placehold.co/100x100/f59e0b/ffffff?text=MP' },
  { id: 4, name: 'Apex Industrial Supplies', phone: '+15550129384', category: 'Hardware', rating: 4.2, avatar: 'https://placehold.co/100x100/8b5cf6/ffffff?text=AI' },
  { id: 5, name: 'EcoCraft Raw Materials', phone: '+15550174839', category: 'Eco Goods', rating: 4.7, avatar: 'https://placehold.co/100x100/ec4899/ffffff?text=EC' }
];

const IconLogout = (props) => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" {...props}>
    <path d="M6 2H3.5A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14H6M10.5 11.5L14 8L10.5 4.5M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DEFAULT_IMAGES = [
  { id: 'img1', url: 'https://placehold.co/300x300/e0f2fe/0369a1?text=Catalog+A', name: 'Catalog_A.jpg' },
  { id: 'img2', url: 'https://placehold.co/300x300/fce7f3/be185d?text=Price+Sheet', name: 'PriceSheet.jpg' },
  { id: 'img3', url: 'https://placehold.co/300x300/fef3c7/b45309?text=Sample+B', name: 'Design_B.jpg' }
];

export default function App() {
  const [vendors, setVendors] = useState(INITIAL_VENDORS);
  const [selectedVendorIds, setSelectedVendorIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const navigate = useNavigate();

  // Manual Add Form States
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorPhone, setNewVendorPhone] = useState('');
 
const [newVendorCategory] = useState('General');
  const [message, setMessage] = useState('Hello! We are requesting a quotation for the attached product designs and specifications. Please review and respond.');
  const [images, setImages] = useState(DEFAULT_IMAGES);
  const [selectedImageIds, setSelectedImageIds] = useState(['img1']);
  
  const [sendingMode, setSendingMode] = useState('sequential');
  const [isProcessing, setIsProcessing] = useState(false);
  const [simulationLogs, setSimulationLogs] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [toastMessage, setToastMessage] = useState(null);

  const fileInputRef = useRef(null);
  const excelInputRef = useRef(null);

  const categories = ['All', ...new Set(vendors.map(v => v.category))];

  const filteredVendors = vendors.filter(v => {
    const matchesSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase()) || v.phone.includes(searchQuery);
    const matchesCategory = selectedCategory === 'All' || v.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleSelectAll = () => {
    if (selectedVendorIds.length === filteredVendors.length) {
      setSelectedVendorIds([]);
    } else {
      setSelectedVendorIds(filteredVendors.map(v => v.id));
    }
  };

  const toggleVendor = (id) => {
    setSelectedVendorIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleImage = (id) => {
    setSelectedImageIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // ➕ Handle Manual Vendor Addition
  const handleAddSingleVendor = (e) => {
    e.preventDefault();
    if (!newVendorName.trim() || !newVendorPhone.trim()) {
      showToast('⚠️ Please enter both vendor name and phone number.');
      return;
    }

    const newObj = {
      id: Date.now(),
      name: newVendorName.trim(),
      phone: newVendorPhone.trim().startsWith('+') ? newVendorPhone.trim() : `+${newVendorPhone.trim()}`,
      category: newVendorCategory.trim() || 'General',
      rating: 5.0,
      avatar: `https://placehold.co/100x100/10b981/ffffff?text=${newVendorName.substring(0, 2).toUpperCase()}`
    };

    setVendors(prev => [newObj, ...prev]);
    setSelectedVendorIds(prev => [...prev, newObj.id]); // Automatically select the newly added vendor
    setNewVendorName('');
    setNewVendorPhone('');
    showToast(`✅ Successfully added ${newObj.name}!`);
  };

  // 📊 Handle Excel / CSV File Upload
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonRows = XLSX.utils.sheet_to_json(worksheet);

        let addedCount = 0;
        const newVendorsList = [...vendors];
        const newlySelectedIds = [...selectedVendorIds];

        jsonRows.forEach((row, idx) => {
          // Flexible field mapping for common Excel column names
          const name = row.name || row.Name || row.VENDOR_NAME || row.VendorName;
          const phone = row.phone || row.Phone || row.MOBILE || row.Mobile || row.CONTACT || row.Contact;
          const category = row.category || row.Category || 'Imported';

          if (name && phone) {
            const formattedPhone = String(phone).startsWith('+') ? String(phone) : `+${String(phone)}`;
            const newEntry = {
              id: Date.now() + idx,
              name: String(name).trim(),
              phone: formattedPhone.trim(),
              category: String(category).trim(),
              rating: 4.5,
              avatar: `https://placehold.co/100x100/6366f1/ffffff?text=IMP`
            };
            newVendorsList.unshift(newEntry);
            newlySelectedIds.push(newEntry.id);
            addedCount++;
          }
        });

        setVendors(newVendorsList);
        setSelectedVendorIds(newlySelectedIds);
        showToast(`🎉 Successfully imported ${addedCount} vendors from Excel!`);
      } catch (err) {
        console.error(err);
        showToast('❌ Failed to parse Excel file. Check format.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const newImg = {
          id: 'custom-' + Date.now() + '-' + index,
          url: uploadEvent.target.result,
          name: file.name
        };
        setImages(prev => [...prev, newImg]);
        setSelectedImageIds(prev => [...prev, newImg.id]);
      };
      reader.readAsDataURL(file);
    });
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const startSendingProcess = () => {
    if (selectedVendorIds.length === 0) {
      showToast('⚠️ Please select at least one vendor.');
      return;
    }
    if (selectedImageIds.length === 0) {
      showToast('⚠️ Please select at least one image or catalog to send.');
      return;
    }

    if (sendingMode === 'sequential') {
      setCurrentIndex(0);
      processNextSequentialItem(0);
    } else {
      runAutomatedSimulation();
    }
  };

  const processNextSequentialItem = (index) => {
    if (index >= selectedVendorIds.length) {
      setIsProcessing(false);
      showToast('✅ All vendor WhatsApp links generated and processed!');
      return;
    }

    setIsProcessing(true);
    setCurrentIndex(index);
    const vendorId = selectedVendorIds[index];
    const vendor = vendors.find(v => v.id === vendorId);

    if (!vendor) return;

    const selectedImgNames = images.filter(img => selectedImageIds.includes(img.id)).map(i => i.name).join(', ');
    const fullText = `${message}\n\n[Attached Files (${selectedImageIds.length}): ${selectedImgNames}]`;
    const encodedMessage = encodeURIComponent(fullText);
    
    const cleanPhone = vendor.phone.replace(/[^0-9]/g, '');
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

    window.open(waUrl, '_blank');
  };

  const runAutomatedSimulation = () => {
    setIsProcessing(true);
    setSimulationLogs([]);
    const selectedVendorsList = vendors.filter(v => selectedVendorIds.includes(v.id));
    
    let step = 0;
    const interval = setInterval(() => {
      if (step < selectedVendorsList.length) {
        const currentV = selectedVendorsList[step];
        const timestamp = new Date().toLocaleTimeString();
        setSimulationLogs(prev => [
          ...prev, 
          { 
            time: timestamp, 
            vendor: currentV.name, 
            phone: currentV.phone, 
            status: 'Success', 
            details: `Sent text + ${selectedImageIds.length} image(s) via Cloud API` 
          }
        ]);
        step++;
      } else {
        clearInterval(interval);
        setIsProcessing(false);
        showToast('🚀 Automated broadcast simulation completed successfully!');
      }
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 sm:p-6 lg:p-8">
      {/* Top Navigation Bar */}
      <div style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <div style={styles.brandMarkSmall}>S5</div>
          <div>
            <div style={styles.topBarTitle}>Synergy 5M</div>
            <div style={styles.topBarSubtitle}>Vendor WhatsApp Dispatch Center</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/')} style={styles.logoutBtn}>
            Website
          </button>
          <button type="button" onClick={() => navigate('/admin')} style={styles.logoutBtn}>
            <IconLogout /> Back to Admin Panel
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center space-x-3 transition transform animate-bounce">
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-8 mt-6">
        
        {/* Header */}
        <header className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <span className="bg-emerald-100 text-emerald-600 p-2 rounded-xl">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
              </span>
              Multi-Vendor WhatsApp Broadcast
            </h1>
            <p className="text-slate-500 mt-1">Add individual vendors, import via Excel, attach custom product images, and dispatch messages instantly.</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <button 
              onClick={() => setSendingMode('sequential')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${sendingMode === 'sequential' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Sequential Queue
            </button>
            <button 
              onClick={() => setSendingMode('simulated')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${sendingMode === 'simulated' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Simulated API
            </button>
          </div>
        </header>

        {/* Main Grid Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left 2 Columns */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* ADD VENDOR / EXCEL IMPORT PANEL */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Add New Vendors / Import Excel</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Manual Form */}
                <form onSubmit={handleAddSingleVendor} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">Add Single Vendor</h3>
                  <div>
                    <input 
                      type="text" 
                      placeholder="Vendor Name (e.g. Acme Ltd)" 
                      value={newVendorName} 
                      onChange={(e) => setNewVendorName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <input 
                      type="text" 
                      placeholder="Phone with Country Code (+1555...)" 
                      value={newVendorPhone} 
                      onChange={(e) => setNewVendorPhone(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded-lg text-xs transition cursor-pointer"
                  >
                    + Add & Select Vendor
                  </button>
                </form>

                {/* Excel Upload Box */}
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex flex-col justify-between items-center text-center">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-800 mb-1">Import from Excel / CSV</h3>
                    <p className="text-xs text-slate-500 mb-3">Upload spreadsheet containing columns for <code className="bg-white px-1 py-0.5 rounded border text-emerald-700">name</code> and <code className="bg-white px-1 py-0.5 rounded border text-emerald-700">phone</code>.</p>
                  </div>
                  <input 
                    type="file" 
                    ref={excelInputRef} 
                    onChange={handleExcelUpload} 
                    accept=".xlsx, .xls, .csv" 
                    className="hidden" 
                  />
                  <button 
                    type="button"
                    onClick={() => excelInputRef.current.click()}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition shadow-sm cursor-pointer flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                    Upload Excel Spreadsheet
                  </button>
                </div>
              </div>
            </div>

            {/* Vendor Selector Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">1. Select Vendors ({selectedVendorIds.length} selected)</h2>
                  <p className="text-sm text-slate-500">Choose recipients for your WhatsApp broadcast.</p>
                </div>
                <button 
                  onClick={toggleSelectAll}
                  className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg transition cursor-pointer"
                >
                  {selectedVendorIds.length === filteredVendors.length ? 'Deselect All' : 'Select All Filtered'}
                </button>
              </div>

              {/* Search and Category Filter */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <input 
                  type="text" 
                  placeholder="Search by vendor name or phone..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              {/* Vendor List Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                {filteredVendors.map(vendor => {
                  const isSelected = selectedVendorIds.includes(vendor.id);
                  return (
                    <div 
                      key={vendor.id}
                      onClick={() => toggleVendor(vendor.id)}
                      className={`cursor-pointer border rounded-xl p-3.5 flex items-center space-x-3 transition ${isSelected ? 'border-emerald-500 bg-emerald-50/40 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                    >
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                      />
                      <img src={vendor.avatar} alt={vendor.name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-slate-900 truncate">{vendor.name}</h4>
                        <p className="text-xs text-slate-500">{vendor.phone} • <span className="text-emerald-600 font-medium">{vendor.category}</span></p>
                      </div>
                    </div>
                  );
                })}
                {filteredVendors.length === 0 && (
                  <div className="col-span-full py-8 text-center text-slate-400 text-sm">
                    No vendors found matching your criteria.
                  </div>
                )}
              </div>
            </div>

            {/* Message & Image Attachment Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">2. Compose Message & Attach Images</h2>
                <p className="text-sm text-slate-500">Personalize your broadcast text and select images to accompany it.</p>
              </div>

              {/* Message Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Message Body</label>
                <textarea 
                  rows="3"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                ></textarea>
              </div>

              {/* Image Attachments */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Select Images ({selectedImageIds.length} selected)</label>
                  <button 
                    onClick={() => fileInputRef.current.click()}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition cursor-pointer"
                  >
                    + Upload Custom Image
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    multiple 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {images.map(img => {
                    const isImgSelected = selectedImageIds.includes(img.id);
                    return (
                      <div 
                        key={img.id}
                        onClick={() => toggleImage(img.id)}
                        className={`cursor-pointer relative border rounded-xl p-2 flex flex-col items-center group transition ${isImgSelected ? 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <div className="absolute top-3 right-3 z-10">
                          <input 
                            type="checkbox" 
                            checked={isImgSelected}
                            onChange={() => {}}
                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                          />
                        </div>
                        <img src={img.url} alt={img.name} className="w-full h-28 object-cover rounded-lg mb-2 bg-slate-100" />
                        <span className="text-xs font-medium text-slate-700 truncate w-full text-center">{img.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

          </div>

          {/* Right Column: Execution & Summary Panel */}
          <div className="space-y-6">
            
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 sticky top-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">3. Summary & Dispatch</h2>
              
              <div className="space-y-4 mb-6 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Selected Vendors:</span>
                  <span className="font-semibold text-slate-900">{selectedVendorIds.length} recipients</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Attached Images:</span>
                  <span className="font-semibold text-slate-900">{selectedImageIds.length} files</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Dispatch Mode:</span>
                  <span className="font-semibold text-emerald-600 capitalize">{sendingMode}</span>
                </div>
              </div>

              {/* Action Button */}
              <button 
                onClick={startSendingProcess}
                disabled={isProcessing || selectedVendorIds.length === 0}
                className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer ${isProcessing || selectedVendorIds.length === 0 ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'}`}
              >
                {isProcessing ? (
                  <span>Processing Broadcast...</span>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                    <span>Start Broadcast Now</span>
                  </>
                )}
              </button>

              {sendingMode === 'sequential' && selectedVendorIds.length > 0 && isProcessing && (
                <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-center space-y-2">
                  <p className="text-xs text-emerald-800 font-medium">Processing Vendor {currentIndex + 1} of {selectedVendorIds.length}</p>
                  <button 
                    onClick={() => processNextSequentialItem(currentIndex + 1)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-lg text-xs shadow cursor-pointer"
                  >
                    Open Next Vendor WhatsApp Tab ➔
                  </button>
                </div>
              )}

              {sendingMode === 'simulated' && simulationLogs.length > 0 && (
                <div className="mt-6 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Dispatch Logs</h4>
                  <div className="bg-slate-900 text-slate-200 font-mono text-xs rounded-xl p-3 max-h-48 overflow-y-auto space-y-2">
                    {simulationLogs.map((log, i) => (
                      <div key={i} className="border-b border-slate-800 pb-1">
                        <span className="text-slate-500">[{log.time}]</span> <span className="text-emerald-400">{log.vendor}</span>: {log.details}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}



const styles = {
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 28px", background: "#14524A", color: "#fff" },
  topBarLeft: { display: "flex", alignItems: "center", gap: "12px" },
  brandMarkSmall: { width: "34px", height: "34px", borderRadius: "8px", background: "rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "13px" },
  topBarTitle: { fontSize: "15px", fontWeight: 700 },
  topBarSubtitle: { fontSize: "12px", color: "rgba(255,255,255,0.7)" },
  logoutBtn: { display: "flex", alignItems: "center", gap: "7px", background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.35)", padding: "8px 14px", borderRadius: "7px", cursor: "pointer", fontSize: "13px" }
};