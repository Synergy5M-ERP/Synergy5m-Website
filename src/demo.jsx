import React, { useState, useEffect } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import {
  User, Phone, Mail, Building2, ChevronDown, Layers, Database,
  Settings2, Repeat, ClipboardCheck, TrendingUp, CreditCard,
  Handshake, LayoutGrid, Truck, FileText, ShoppingCart,
  BarChart3, Package, Users, Factory, Briefcase, Settings, Sparkles,
  Zap, Check, ArrowRight, PieChart, Search, MapPin,
  Facebook, HomeIcon, Instagram, Linkedin, LinkedinIcon, MailIcon, PhoneCall, Twitter,
  DollarSign, Crown, Award, Cloud, Code
} from 'lucide-react';
import Logo from './logo (1).png';

const EnhancedERPPage = () => {
  // ALL HOOKS AT TOP - Fixed ESLint errors
  const [activeModule, setActiveModule] = useState(null);
  const [isVisible, setIsVisible] = useState({});
  const [scrollY, setScrollY] = useState(0);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [activeBullet, setActiveBullet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedCard, setSelectedCard] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Intersection Observer useEffect
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible((prev) => ({ ...prev, [entry.target.id]: true }));
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll('[id^="animate-"]').forEach((el) => {
      observer.observe(el);
    });

    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const lightenColor = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return hex;
    let r = parseInt(result[1], 16);
    let g = parseInt(result[2], 16);
    let b = parseInt(result[3], 16);
    r = Math.min(255, Math.floor(r * 1.2));
    g = Math.min(255, Math.floor(g * 1.2));
    b = Math.min(255, Math.floor(b * 1.2));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  const modules = [
    { name: "MRP", info: "Material Requirements Planning", icon: <Settings size={22} />, color: "#e91e63" },
    { name: "BOM", info: "Bill of Materials Management", icon: <FileText size={22} />, color: "#f39c12" },
    { name: "Sales", info: "Revenue & Order Tracking", icon: <BarChart3 size={22} />, color: "#ffeb3b" },
    { name: "Purchase", info: "Procurement & Vendor Logs", icon: <ShoppingCart size={22} />, color: "#8bc34a" },
    { name: "Inventory", info: "Stock & Warehouse Control", icon: <Package size={22} />, color: "#00bcd4" },
    { name: "Finance", info: "Accounts & GST Compliance", icon: <Database size={22} />, color: "#2196f3" },
    { name: "Quality", info: "Customer Relations & Leads", icon: <Users size={22} />, color: "#3f51b5" },
    { name: "Production", info: "Shop Floor & Manufacturing", icon: <Factory size={22} />, color: "#673ab7" },
    { name: "HR", info: "Employee Lifecycle & Pay", icon: <Briefcase size={22} />, color: "#9c27b0" },
    { name: "Planning", info: "Strategic Resource Forecast", icon: <Settings size={22} />, color: "#f44336" },
  ];

  const partners = [
    { id: 1, name: "Shripad Polymer", logo: "https://shripad-syn8erp.azurewebsites.net/Images/Shripad%20LOGO.png" },
    { id: 2, name: "Vistta", logo: "https://synergy5m-visttaerp8-uat.azurewebsites.net/Images/VistaLOGOEdited.JPG" },
    { id: 3, name: "Chemikar", logo: "https://synergy5m-chemikarerp8.azurewebsites.net/Images/Logo(1).jpg" },
    { id: 4, name: "Swami Samarth", logo: "https://synergy5m-swamisamartherp8.azurewebsites.net/Images/SwamiSamarthLogo.png" },
  ];

  const integratedModules = [
    {
      title: 'Sales & Distribution',
      icon: <PieChart size={40} />,
      color: '#6B1B5E',
      features: ['Customer Management', 'Sales Orders', 'Dispatch & Delivery', 'Warehouse Inventory']
    },
    {
      title: 'Materials Management (Procurement & RM Inventory)',
      icon: <FileText size={40} />,
      color: '#6B1B5E',
      features: ['Vendor Management', 'Purchase Orders', 'Raw Material Inventory', 'Goods Receipt & Issue', 'Material Cost Tracking']
    },
    {
      title: 'Production Management',
      icon: <Search size={40} />,
      color: '#6B1B5E',
      features: ['Production Planning', 'Work Orders', 'Semi-Finished Inventory', 'Process Tracking', 'Production Reporting']
    },
    {
      title: 'Quality Control',
      icon: <BarChart3 size={40} />,
      color: '#6B1B5E',
      features: ['Inward Quality Inspection', 'Outward Quality Checks', 'Quality Standards', 'Rejection & Rework Tracking', 'Compliance Records']
    },
    {
      title: 'Human Resource Management (HRM)',
      icon: <Handshake size={40} />,
      color: '#6B1B5E',
      features: ['Employee Master', 'Attendance Management', 'Payroll Processing', 'Leave Management', 'HR Reports']
    },
    {
      title: 'Masters (Standardization & Control)',
      icon: <CreditCard size={40} />,
      color: '#6B1B5E',
      features: ['Item & Product Masters', 'Vendor & Customer Masters', 'Process Standards', 'Quality Parameters']
    },
  ];

  const gradients = {
    0: { from: '#c42fe2', to: '#f17dc5' },
    1: { from: '#e26ac4', to: '#e247c8' },
    2: { from: '#d169d4', to: '#d77fe2' },
    3: { from: '#e797d3', to: '#d862d8' },
  };

  const services = [
    {
      title: "Complete Module Coverage for MSME Operations",
      icon: <Handshake size={48} />,
      gradientIndex: 0,
    },
    {
      title: "Fully Tailored to Your Business",
      icon: <Zap size={48} />,
      gradientIndex: 1,
    },
    {
      title: "White Label ERP – Under Your Brand",
      icon: <Crown size={48} />,
      gradientIndex: 2,
    },
    {
      title: "One-Time Cost (No Recurring Subscription)",
      icon: <DollarSign size={48} />,
      gradientIndex: 3,
    },
  ];

  const teamMembers = [
    { name: "Ajay Gokhale", designation: "Founder & Director", image: "https://www.jotform.com/uploads/TOOLS_sales/agent_files/avatar_images/764638853698c7115408343.18725757_icon.png" },
    { name: "Supriya Jadhav", designation: "SR.Software Developer", image: "https://www.jotform.com/uploads/TOOLS_sales/agent_files/avatar_images/611494537698c5395bbff46.63878094_icon.png" },
    { name: "Shubhangi shejwal", designation: "Software Developer", image: "https://www.jotform.com/uploads/TOOLS_sales/agent_files/avatar_images/611494537698c5395bbff46.63878094_icon.png" },
    { name: "Neha Varma", designation: "Software Developer", image: "https://www.jotform.com/uploads/TOOLS_sales/agent_files/avatar_images/611494537698c5395bbff46.63878094_icon.png" },
    { name: "Mayuri Jamdade", designation: "Software Developer", image: "https://www.jotform.com/uploads/TOOLS_sales/agent_files/avatar_images/611494537698c5395bbff46.63878094_icon.png" }
  ];

  const contactCards = [
    {
      icon: MapPin,
      title: 'OUR OFFICE',
      line1: '501,Fortuna Business center',
      line2: 'opp.McDonalds , Pimple Saudagar Pune-411027 Maharashtra India',
      mapUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3780.4266267707835!2d73.78667731490292!3d18.595833!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2b91ed56196533A0x9e0f7613d1ce8b8b!2sWakad%20-%20Nashik%20Phata%20BRTS%20Rd%2C%20Pimple%20Saudagar%2C%20Pimpri-Chinchwad%2C%20Maharashtra%20411027!5e0!3m2!1sen!2sin!4v1698345678901!5m2!1sen!2sin'
    },
    {
      icon: Phone,
      title: 'PHONE NUMBER',
      line1: '+91 20 48646699',
      line2: '+91 9423579446',
      mapUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3780.4266267707835!2d73.78667731490292!3d18.595833!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2b91ed56196533A0x9e0f7613d1ce8b8b!2sWakad%20-%20Nashik%20Phata%20BRTS%20Rd%2C%20Pimple%20Saudagar%2C%20Pimpri-Chinchwad%2C%20Maharashtra%20411027!5e0!3m2!1sen!2sin!4v1698345678901!5m2!1sen!2sin'
    },
    {
      icon: Mail,
      title: 'EMAIL',
      line1: 'info@synergy5m.com',
      line2: '',
      mapUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3780.4266267707835!2d73.78667731490292!3d18.595833!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2b91ed56196533A0x9e0f7613d1ce8b8b!2sWakad%20-%20Nashik%20Phata%20BRTS%20Rd%2C%20Pimple%20Saudagar%2C%20Pimpri-Chinchwad%2C%20Maharashtra%20411027!5e0!3m2!1sen!2sin!4v1698345678901!5m2!1sen!2sin'
    }
  ];

  // ✅ FIXED FORM HANDLER - No redirect, toast notifications
  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    
    const formData = new FormData(event.target);
    formData.append("access_key", "51347f60-c4d6-4c66-ad1d-71f5ca2f8c0b");

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('Thank you! Your demo request sent successfully! 🎉');
        event.target.reset();
      } else {
        toast.error(data.message || 'Submission failed. Try again.');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: { margin: '2rem auto', maxWidth: '1000px', fontFamily: 'Arial, sans-serif', textAlign: 'center' },
    heading: { color: '#667eea', marginBottom: '1rem' },
    marquee: { overflow: 'hidden', whiteSpace: 'nowrap', borderRadius: '10px', border: '1px solid #ddd', backgroundColor: '#f9f9f9', padding: '10px 0' },
    track: { display: 'inline-flex', animation: 'scroll 20s linear infinite' },
    logoWrapper: { flex: '0 0 auto', width: '150px', height: '100px', margin: '0 15px' },
    logoImage: { width: '100%', height: '100%', objectFit: 'contain' }
  };

  return (
    <div className="page-wrapper">
      <style jsx>{`
        @keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
      `}</style>

      {/* Header Section */}
      <header className="header-animate">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={Logo} alt="SYNERGY 5M Logo" style={{ height: '60px', width: 'auto', objectFit: 'contain' }} />
          <h1 style={{ margin: 0, fontSize: 'clamp(1rem, 4vw, 1.8rem)', fontWeight: 'bold', color: 'inherit' }}>
            SYNERGY 5M LLP
          </h1>
        </div>
        <div className="contact-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Phone size={18} />
            <span>+91 9423579446</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-top">
          <h2>SYNERGY 5M LLP INTEGRATING BUSINESSES - <span style={{ color: 'yellow' }}>Cloud-Based ERP for Indian MSMEs & Manufacturers<br/>One-Time Cost, Full Data Control, White-Label ERP for Seamless Growth.</span></h2>
        </div>

        <div className="hero-main">
          {/* Animated Wheel */}
          <div className="wheel-outer">
            <div className="spinning-conic"></div>
            <div className="wheel-center-hub">
              {activeModule ? (
                <>
                  <div style={{ color: activeModule.color, marginBottom: '10px' }}>
                    {activeModule.icon}
                  </div>
                  <h2>{activeModule.name}</h2>
                  <p>{activeModule.info}</p>
                </>
              ) : (
                <>
                  <h2>ERP</h2>
                  <p>Enterprise Resource Planning</p>
                </>
              )}
            </div>

            {modules.map((m, i) => {
              const angle = i * 36;
              const radius = `clamp(90px, 22vw, 140px)`;
              const nodeOffset = `clamp(28px, 8vw, 42px)`;
              const x = Math.cos((angle - 90) * (Math.PI / 180)) * 140;
              const y = Math.sin((angle - 90) * (Math.PI / 180)) * 140;

              return (
                <div
                  key={i}
                  className="module-node"
                  style={{
                    top: `calc(50% + ${y}px - ${nodeOffset})`,
                    left: `calc(50% + ${x}px - ${nodeOffset})`,
                    animationDelay: `${i * 0.1}s`,
                    width: `clamp(56px, 14vw, 84px)`,
                    height: `clamp(52px, 13vw, 84px)`
                  }}
                  onMouseEnter={() => setActiveModule(m)}
                  onMouseLeave={() => setActiveModule(null)}
                >
                  <div style={{
                    color: 'white',
                    fontSize: `clamp(18px, 4.5vw, 24px)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '70%'
                  }}>
                    {m.icon}
                  </div>
                  <span style={{ fontSize: `clamp(10px, 2.8vw, 13px)` }}>
                    {m.name}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ✅ FIXED CONTACT FORM - Web3Forms + Toast */}
          <form className="form-card" onSubmit={onSubmit}>
            <h3 style={{ animation: 'fadeInDown 0.6s ease-out' }}>Get Your Free Demo</h3>
            
            {/* First Row: Name and Phone */}
            <div className="">
              <div className="input-row">
                <div className="icon-wrap"><User size={20} /></div>
                <input type="text" name="name" placeholder="Full Name*" required />
              </div>
              <div className="input-row">
                <div className="icon-wrap"><Phone size={20} /></div>
                <div style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                  <span className="phone-prefix">🇮🇳 +91 </span>
                  <input type="tel" name="phone" placeholder="Phone Number*" required />
                </div>
              </div>
            </div>

            {/* Second Row: Email and Company */}
            <div className="">
              <div className="input-row">
                <div className="icon-wrap"><Mail size={20} /></div>
                <input type="email" name="email" placeholder="Email ID*" required />
              </div>
              <div className="input-row">
                <div className="icon-wrap"><Building2 size={20} /></div>
                <input type="text" name="company" placeholder="Company Name*" required />
              </div>
            </div>

            <button className="btn-submit" type="submit" disabled={loading} style={{ alignContent: 'center' }}>
              {loading ? 'Sending...' : 'Contact Us'}
            </button>
          </form>
        </div>
      </section>

      {/* TOASTER - Shows success/error messages */}
      <Toaster position="top-right" />

      {/* About Us Section */}
      <section style={{
        position: 'relative',
        overflow: 'hidden',
        paddingBottom: '10px',
        display: 'flex',
        alignItems: 'center'
      }}>
        <div style={{
          position: 'absolute',
          top: '-10%',
          right: '-5%',
          width: '400px',
          height: '400px',
          filter: 'blur(80px)',
          animation: 'pulse 6s ease-in-out infinite'
        }}></div>
        <div style={{
          position: 'absolute',
          bottom: '10%',
          left: '-5%',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(112, 13, 93, 0.08), transparent 70%)',
          filter: 'blur(60px)',
          animation: 'pulse 4s ease-in-out infinite'
        }}></div>
        <div style={{ maxWidth: '1200px', margin: '20px auto', position: 'relative', zIndex: 2 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-block', marginBottom: '2rem' }}>
              <h2 style={{
                fontSize: 'clamp(2.2rem, 6vw, 3.5rem)',
                fontWeight: '800',
                background: 'linear-gradient(90deg, #700d5d, #ea580c)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                margin: 0,
                letterSpacing: '-1px'
              }}>
                About Us
              </h2>
              <div style={{
                height: '5px',
                width: '60%',
                margin: '10px auto 0',
                background: 'linear-gradient(90deg, #ea580c, #f59e0b)',
                borderRadius: '10px'
              }}></div>
            </div>
            <div style={{
              backdropFilter: 'blur(10px)',
              padding: 'clamp(10px, 5vw, 50px)',
              borderRadius: '24px',
              animation: 'fadeInUp 1.2s ease-out'
            }}>
              <p style={{
                color: '#374151',
                fontSize: 'clamp(1rem, 2.8vw, 1.25rem)',
                lineHeight: '1.8',
                margin: 0,
                fontWeight: '500'
              }}>
                <strong style={{ color: '#ea580c' }}>Synergy5M LLP</strong>, founded by Ajay Gokhale, empowers MSMEs with owner-centric digital solutions.
                Our flagship MSME ERP <span style={{ color: '#700d5d', fontWeight: 'bold' }}>SYN-8</span> is built by
                talented young female professionals using <span style={{ textDecoration: 'underline', color: '#ea580c' }}>ASP.NET Core & MVC</span>.
                <br /><br />
                Seamlessly deployed on <strong>Microsoft Azure Cloud</strong>, we provide manufacturers
                with complete visibility and the tools for scalable, sustainable growth.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="services-section">
        <div style={{
          position: 'absolute',
          top: '80px',
          left: '40px',
          width: '80px',
          height: '80px',
          background: 'radial-gradient(circle, #fde047, #fb923c)',
          borderRadius: '50%',
          filter: 'blur(60px)',
          opacity: 0.3,
          animation: 'pulse 3s ease-in-out infinite'
        }}></div>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(1rem, 4vw, 4rem)' }}>
            <div style={{ display: 'inline-block' }}>
              <h2 style={{
                fontSize: 'clamp(2rem, 5vw, 3rem)',
                fontWeight: 'bold',
                background: 'linear-gradient(90deg, #ea580c, #f59e0b, #eab308)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                marginBottom: '1rem',
                animation: 'fadeInDown 1s ease-out'
              }}>
                Our Services
              </h2>
              <div style={{
                height: '6px',
                background: 'linear-gradient(90deg, #fb923c, #fbbf24, #facc15)',
                borderRadius: '9999px'
              }}></div>
            </div>
            <p style={{
              color: '#6b7280',
              fontSize: 'clamp(1rem, 2.5vw, 1.125rem)',
              margin: '1.5rem auto 0'
            }}>
              Empowering businesses with innovative solutions for sustainable growth
            </p>
          </div>

          <div className="services-grid">
            {services.map((service, idx) => {
              const isHovered = hoveredCard === idx;
              const gradient = gradients[service.gradientIndex];
              return (
                <div
                  key={idx}
                  className="service-card"
                  onMouseEnter={() => setHoveredCard(idx)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{ animation: `fadeInUp 0.8s ease-out ${idx * 0.1}s backwards` }}
                >
                  <div style={{
                    position: 'absolute',
                    top: '-64px',
                    right: '-64px',
                    width: '128px',
                    height: '128px',
                    background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
                    opacity: isHovered ? 0.2 : 0.1,
                    borderRadius: '50%',
                    filter: 'blur(60px)',
                    transition: 'opacity 0.5s ease'
                  }}></div>

                  <div style={{
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 'clamp(60px, 12vw, 80px)',
                    height: 'clamp(60px, 12vw, 80px)',
                    borderRadius: '1rem',
                    background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    marginBottom: '1.5rem',
                    transform: isHovered ? 'scale(1.1) rotate(6deg)' : 'scale(1) rotate(0deg)',
                    transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    color: '#ffffff'
                  }}>
                    {service.icon}
                  </div>

                  <h3 style={{
                    fontSize: 'clamp(1.2rem, 3vw, 1.5rem)',
                    fontWeight: 'bold',
                    color: isHovered ? 'transparent' : '#1f2937',
                    background: isHovered ? 'linear-gradient(90deg, #ea580c, #f59e0b)' : 'none',
                    WebkitBackgroundClip: isHovered ? 'text' : 'unset',
                    WebkitTextFillColor: isHovered ? 'transparent' : 'unset',
                    backgroundClip: isHovered ? 'text' : 'unset',
                    marginBottom: '1rem',
                    transition: 'all 0.3s ease'
                  }}>
                    {service.title}
                  </h3>

                  <div style={{
                    color: '#6b7280',
                    lineHeight: '1.75',
                    fontSize: 'clamp(0.9rem, 2vw, 1rem)'
                  }}>
                    Tailored solutions for your business growth
                  </div>

                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    height: '4px',
                    width: isHovered ? '100%' : '0%',
                    background: `linear-gradient(90deg, ${gradient.from}, ${gradient.to})`,
                    transition: 'width 0.5s ease'
                  }}></div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Partners Section */}
      <section style={styles.container}>
        <h2 style={{
          fontSize: 'clamp(2rem, 5vw, 3rem)',
          fontWeight: 'bold',
          background: 'linear-gradient(90deg, #ea580c, #f59e0b, #eab308)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: '1rem',
          animation: 'fadeInDown 1s ease-out'
        }}>Our Partners</h2>
        <div style={styles.marquee}>
          <div style={styles.track}>
            {partners.concat(partners).map((partner, index) => (
              <div key={index} style={styles.logoWrapper} title={partner.name}>
                <img src={partner.logo} alt={partner.name} style={styles.logoImage} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="contact-container">
        <div className="contact-layout">
          <div className="contact-cards">
            {contactCards.map((card, index) => {
              const Icon = card.icon;
              const isSelected = selectedCard === index;
              return (
                <div
                  key={index}
                  className="contact-card"
                  style={{
                    border: isSelected ? '3px solid #ff5722' : '3px solid transparent',
                    animation: `fadeInLeft 0.8s ease-out ${index * 0.15}s backwards`
                  }}
                  onClick={() => setSelectedCard(index)}
                >
                  <div style={{
                    width: 'clamp(50px, 10vw, 60px)',
                    height: 'clamp(50px, 10vw, 60px)',
                    background: '#fff',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}>
                    <Icon size={32} color="#ff5722" strokeWidth={1} />
                  </div>
                  <h3 style={{
                    color: '#ff5722',
                    fontSize: 'clamp(0.75rem, 2vw, 0.85rem)',
                    fontWeight: '700',
                    letterSpacing: '1px',
                    marginBottom: '0.75rem'
                  }}>
                    {card.title}
                  </h3>
                  <p style={{
                    color: '#333',
                    fontSize: 'clamp(0.85rem, 2vw, 0.9rem)',
                    margin: '0.25rem 0',
                    lineHeight: '1.5'
                  }}>
                    {card.line1}
                  </p>
                  {card.line2 && (
                    <p style={{
                      color: '#333',
                      fontSize: 'clamp(0.85rem, 2vw, 0.9rem)',
                      margin: '0.25rem 0',
                      lineHeight: '1.5'
                    }}>
                      {card.line2}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="map-container">
            <iframe
              title="Office Location Map"
              src={contactCards[selectedCard].mapUrl}
              className="map-iframe"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-section">
            <h3>Contact</h3>
            <p style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <HomeIcon style={{ color: '#3b82f6', minWidth: '20px', marginTop: '4px' }} size={20} />
              <span>501, FORTUNA BUSINESS CENTER, OPP. McDONALDS, PIMPLE SAUDAGAR PUNE - 411027, MAHARASHTRA, INDIA</span>
            </p>
            <p style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MailIcon style={{ color: '#10b981', minWidth: '20px' }} size={20} />
              <a href="mailto:info@synergy5m.com" style={{ color: '#bbb', textDecoration: 'none' }}>info@synergy5m.com</a>
            </p>
            <p style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PhoneCall style={{ color: '#f97316', minWidth: '20px' }} size={20} />
              +91 20 48646699
            </p>
          </div>
          <div className="footer-section">
            <h3>Follow Us</h3>
            <div className="social-icons">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" style={{ color: '#bbb', transition: 'color 0.3s' }}>
                <Facebook size={28} />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" style={{ color: '#bbb', transition: 'color 0.3s' }}>
                <Twitter size={28} />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" style={{ color: '#bbb', transition: 'color 0.3s' }}>
                <LinkedinIcon size={28} />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" style={{ color: '#bbb', transition: 'color 0.3s' }}>
                <Instagram size={28} />
              </a>
            </div>
          </div>
        </div>
        <div className="copyright">
          © {new Date().getFullYear()} Synergy. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default EnhancedERPPage;
