import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-next';
import NewLandingPage from './NewLandingPage';
import VendorEmailSender from './VendorEmailSender';
import AdminPanel from './AdminPanel';
import './App.css';
import './index.css';
import DemoPanel from './DemoPanel';
import WhatsappBroadcast from './WhatsappBroadcast';
import EmailDispatchHistory from './EmailDispatchHistory';
import EnquiryMapper from './EnquiryMapper';
import AdminAuthGuard from './AdminAuthGuard';
import AdminAddProduct from './AdminAddProduct';
import ProductsOpenForEnquiries from './ProductsOpenForEnquiries';
import OpportunityView from './OpportunityView';
import SendEnquiryToVendors from './SendEnquiryToVendors';

function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <div className="App">
          <Routes>
            <Route path="/" element={<NewLandingPage />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route
              path="/vendor-emails"
              element={
                <AdminAuthGuard>
                  <VendorEmailSender />
                </AdminAuthGuard>
              }
            />
            <Route
              path="/demo-req"
              element={
                <AdminAuthGuard>
                  <DemoPanel />
                </AdminAuthGuard>
              }
            />
            <Route
              path="/whatsapp"
              element={
                <AdminAuthGuard>
                  <WhatsappBroadcast />
                </AdminAuthGuard>
              }
            />
            <Route
              path="/admin/email-history"
              element={
                <AdminAuthGuard>
                  <EmailDispatchHistory />
                </AdminAuthGuard>
              }
            />
            <Route
              path="/enquiryMapper"
              element={
                <AdminAuthGuard>
                  <EnquiryMapper />
                </AdminAuthGuard>
              }
            />
            <Route path="/admin/dashboard" element={<AdminAddProduct initialTab="dashboard" />} />
            <Route path="/admin/products/add" element={<AdminAddProduct initialTab="form" />} />
            <Route path="/admin/add-product" element={<AdminAddProduct initialTab="form" />} />
            <Route path="/admin/collective-enquiries" element={<AdminAddProduct initialTab="enquiries" />} />
            <Route path="/admin/enquiries" element={<AdminAddProduct initialTab="enquiries" />} />
            <Route path="/admin/products" element={<AdminAddProduct initialTab="table" />} />
            <Route path="/admin/opportunity-view" element={<OpportunityView />} />
            <Route path="/admin/opportunity/:id" element={<OpportunityView />} />
            <Route
              path="/admin/opportunity/:id/send-to-vendors"
              element={
                <AdminAuthGuard>
                  <SendEnquiryToVendors />
                </AdminAuthGuard>
              }
            />
            <Route
              path="/admin/opportunity-send-to-vendors"
              element={
                <AdminAuthGuard>
                  <SendEnquiryToVendors />
                </AdminAuthGuard>
              }
            />
            <Route path="/admin/opportunities" element={<OpportunityView />} />
            <Route path="/products-open-for-enquiries" element={<ProductsOpenForEnquiries embedded={false} />} />
            <Route path="/collective-buy" element={<ProductsOpenForEnquiries embedded={false} />} />
            <Route path="*" element={<NewLandingPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </HelmetProvider>
  );
}

export default App;