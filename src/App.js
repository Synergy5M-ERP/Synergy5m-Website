import React from 'react';
import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
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
import VendorSupplyOfferForm from './VendorSupplyOfferForm';
import SupplyOffersHub from './SupplyOffersHub';
import SupplyOfferViewPage from './SupplyOfferViewPage';
// eslint-disable-next-line no-unused-vars
import BuyerOfferViewPage from './BuyerOfferViewPage';

// Dispatches /supply-offer route:
// - If ?rfq=... query param is present, or mode=revise / counterRate / prevRate, load VendorSupplyOfferForm
// - If ?view=... or only ?offerRef=... is present, load the specific SupplyOfferViewPage (Official Document & PDF)
// - If no rfq/offer param is present, load the SupplyOffersHub showing all dispatched RFQs
function SupplyOfferRouteDispatcher() {
  const [searchParams] = useSearchParams();

  // 1. Explicit view parameter -> Document PDF View
  if (searchParams.get('view') === 'true' || searchParams.get('view') === '1') {
    return <SupplyOfferViewPage />;
  }

  // 2. Any RFQ offer submission or price revision -> VendorSupplyOfferForm
  if (
    searchParams.has('rfq') ||
    searchParams.get('mode') === 'revise' ||
    searchParams.has('counterRate') ||
    searchParams.has('prevRate') ||
    (searchParams.has('product') && !searchParams.has('view'))
  ) {
    return <VendorSupplyOfferForm />;
  }

  // 3. Isolated offerRef -> Document PDF View
  if (searchParams.has('offerRef')) {
    return <SupplyOfferViewPage />;
  }

  // 4. Default -> Hub
  return <SupplyOffersHub defaultTab="sent" />;
}

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

            {/* Supply Offers, Dispatched RFQs & Specific Offer View Routes */}
            <Route path="/supply-offers" element={<SupplyOffersHub defaultTab="sent" />} />
            <Route path="/supply-offer" element={<SupplyOfferRouteDispatcher />} />
            <Route path="/supply-offer/view" element={<SupplyOfferViewPage />} />
            <Route path="/offer-view/:offerRef" element={<SupplyOfferViewPage />} />
            <Route path="/submittedoffer" element={<SupplyOffersHub defaultTab="submitted" />} />
            <Route path="/submitted-offers" element={<SupplyOffersHub defaultTab="submitted" />} />
            <Route path="/submitted-offer" element={<SupplyOffersHub defaultTab="submitted" />} />
            <Route path="/commercial-evaluation" element={<SupplyOffersHub defaultTab="evaluation" />} />
            <Route path="/admin/commercial-evaluation" element={<SupplyOffersHub defaultTab="evaluation" />} />
            <Route path="/quote-evaluation" element={<SupplyOffersHub defaultTab="evaluation" />} />
            <Route path="/vendor/supply-offer" element={<VendorSupplyOfferForm />} />

            {/* Stage 7: Buyer-Specific Allocation & Offer View Routes */}
            <Route path="/buyer/offer/:allocationId" element={<BuyerOfferViewPage />} />
            <Route path="/buyer-offer/:allocationId" element={<BuyerOfferViewPage />} />
            <Route path="/buyer/offer" element={<BuyerOfferViewPage />} />

            <Route path="*" element={<NewLandingPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </HelmetProvider>
  );
}

export default App;
