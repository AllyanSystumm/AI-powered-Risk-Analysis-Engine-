'use client';

import React, { useState, useEffect } from 'react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

const HARDCODED_IPS = [
    { city: "Karachi", ip: "103.226.240.10", province: "Sindh" },
    { city: "Lahore", ip: "103.226.241.10", province: "Punjab" },
    { city: "Faisalabad", ip: "103.226.242.10", province: "Punjab" },
    { city: "Peshawar", ip: "103.226.243.10", province: "Khyber Pakhtunkhwa" },
    { city: "Quetta", ip: "103.226.244.10", province: "Balochistan" },
    { city: "Islamabad", ip: "103.226.245.10", province: "Punjab" },
    { city: "Hyderabad", ip: "103.226.246.10", province: "Sindh" },
    { city: "Multan", ip: "103.226.247.10", province: "Punjab" },
    { city: "Gujranwala", ip: "103.226.248.10", province: "Punjab" },
    { city: "Sukkur", ip: "103.226.249.10", province: "Sindh" },
    { city: "Rahim Yar Khan", ip: "103.226.250.10", province: "Punjab" },
    { city: "Sialkot", ip: "103.226.251.10", province: "Punjab" },
    { city: "Bahawalpur", ip: "103.226.252.10", province: "Punjab" },
    { city: "Shikarpur", ip: "103.226.253.10", province: "Sindh" },
    { city: "Sadiqabad", ip: "103.226.254.10", province: "Punjab" }
];

export default function Storefront() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        userId: 'CUST-' + Math.floor(Math.random() * 10000),
        fullName: '',
        email: '',
        phone: '',
        country: 'PK',
        createdAt: new Date().toISOString().split('T')[0],

        totalAmount: '',
        itemCount: '1',
        method: 'Credit Card',

        street: '',
        city: '',
        state: '',
        postalCode: '',

        ipAddress: '103.226.240.10',
        pastOrders: '0',
        failedDeliveries: '0'
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    // Load from local storage on mount
    useEffect(() => {
        const savedData = localStorage.getItem('storeCheckoutData');
        if (savedData) {
            try {
                setFormData(JSON.parse(savedData));
            } catch (err) {
                console.error("Failed to parse saved checkout data", err);
            }
        }
    }, []);

    // Save to local storage on change
    useEffect(() => {
        localStorage.setItem('storeCheckoutData', JSON.stringify(formData));
    }, [formData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setResult(null);

        const matchingIpData = HARDCODED_IPS.find(loc => loc.city.toLowerCase() === formData.city.toLowerCase()) || HARDCODED_IPS[0];

        // Construct Payload matching the expected RiskGuard format
        const payload = {
            user_profile: {
                user_id: 'CUST-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000),
                full_name: formData.fullName,
                created_at: formData.createdAt + "T00:00:00Z",
                email: formData.email,
                phone: formData.phone,
                country: formData.country,
            },
            order_details: {
                order_id: 'ORD-' + Date.now().toString().slice(-6),
                total_amount: parseFloat(formData.totalAmount || "0"),
                item_count: parseInt(formData.itemCount || "1"),
                created_at: new Date().toISOString(),
                items: [],
                method: formData.method
            },
            address: {
                street: formData.street,
                city: formData.city,
                state: formData.state,
                postal_code: formData.postalCode,
                country: formData.country // Keeping same as user profile for simplicity in UI
            },
            ip_info: {
                ip_address: matchingIpData.ip,
                ip_country: "Pakistan",
                ip_region: matchingIpData.province,
                ip_city: matchingIpData.city,
                latitude: 0,
                longitude: 0
            },
            history: {
                past_orders: parseInt(formData.pastOrders || "0"),
                account_flags: 0,
                failed_deliveries: parseInt(formData.failedDeliveries || "0"),
                blacklist_info: false
            }
        };

        try {
            const response = await fetch('http://localhost:3001/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error('Failed to submit order');

            const data = await response.json();
            setResult({
                success: true,
                message: 'Order Placed Successfully!',
                data: data
            });

        } catch (error: any) {
            setResult({
                success: false,
                message: error.message || 'An error occurred during checkout.'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 p-8 font-sans">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-semibold text-slate-900 mb-2 flex items-center gap-3">
                            <span className="bg-blue-600 p-2 rounded-lg">🛒</span>
                            Store Checkout
                        </h1>
                        <p className="text-slate-600">Complete your simulated purchase below to test the RiskGuard AI engine.</p>
                    </div>
                    <a href="/" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm shadow-blue-500/20 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Dashboard
                    </a>
                </div>

                {result && (
                    <div className={`p-4 mb-6 rounded-lg border ${result.success ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                        <h3 className="font-semibold">{result.message}</h3>
                        {result.data && (
                            <div className="mt-2 text-sm opacity-90">
                                <p>AI Action: <strong className="uppercase">{result.data.action}</strong></p>
                                <p>Risk Score: <strong>{result.data.riskScore}</strong></p>
                            </div>
                        )}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 shadow-xl">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Customer Details section */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium text-slate-900 border-b border-slate-200 pb-2">Customer Profile</h3>

                            <div>
                                <label className="block text-sm mb-1 text-slate-600">Full Name <span className="text-red-500">*</span></label>
                                <input required type="text" name="fullName" value={formData.fullName} onChange={handleChange} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="John Doe" />
                            </div>

                            <div>
                                <label className="block text-sm mb-1 text-slate-600">Email Address <span className="text-red-500">*</span></label>
                                <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="customer@example.com" />
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm mb-1 text-slate-600">Phone <span className="text-red-500">*</span></label>
                                    <PhoneInput
                                        placeholder="Enter phone number"
                                        value={formData.phone}
                                        onChange={(value) => setFormData(prev => ({ ...prev, phone: value || '' }))}
                                        defaultCountry="PK"
                                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus-within:ring-2 focus-within:ring-blue-500 focus-within:outline-none focus:outline-none"
                                        style={{ "--PhoneInputCountrySelectArrow-color": "#64748b" } as React.CSSProperties}
                                    />
                                </div>
                            </div>



                            <h3 className="text-lg font-medium text-slate-900 border-b border-slate-200 pb-2 pt-4">History (Simulated)</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm mb-1 text-slate-600">Past Orders Count</label>
                                    <input type="number" name="pastOrders" value={formData.pastOrders} onChange={handleChange} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" min="0" />
                                </div>
                                <div>
                                    <label className="block text-sm mb-1 text-slate-600">Failed Deliveries</label>
                                    <input type="number" name="failedDeliveries" value={formData.failedDeliveries} onChange={handleChange} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" min="0" />
                                </div>
                            </div>
                        </div>

                        {/* Order & Address section */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium text-slate-900 border-b border-slate-200 pb-2">Order & Delivery</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm mb-1 text-slate-600">Total Amount ($) <span className="text-red-500">*</span></label>
                                    <input required type="number" name="totalAmount" value={formData.totalAmount} onChange={handleChange} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" min="1" placeholder="99.99" />
                                </div>
                                <div>
                                    <label className="block text-sm mb-1 text-slate-600">Payment Method <span className="text-red-500">*</span></label>
                                    <select name="method" value={formData.method} onChange={handleChange} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none">
                                        <option>Credit Card</option>
                                        <option>PayPal</option>
                                        <option>COD</option>
                                        <option>Crypto</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm mb-1 text-slate-600">Delivery Address <span className="text-red-500">*</span></label>
                                <input required type="text" name="street" value={formData.street} onChange={handleChange} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="123 Shopping Avenue" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm mb-1 text-slate-600">City <span className="text-red-500">*</span></label>
                                    <input required type="text" name="city" value={formData.city} onChange={handleChange} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="New York" />
                                </div>
                                <div>
                                    <label className="block text-sm mb-1 text-slate-600">State/Province <span className="text-red-500">*</span></label>
                                    <input required type="text" name="state" value={formData.state} onChange={handleChange} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="NY" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm mb-1 text-slate-600">Country <span className="text-red-500">*</span></label>
                                    <input required type="text" name="country" value={formData.country} onChange={handleChange} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="PK or Pakistan" />
                                </div>
                                <div>
                                    <label className="block text-sm mb-1 text-slate-600">Postal Code <span className="text-red-500">*</span></label>
                                    <input required type="text" name="postalCode" value={formData.postalCode} onChange={handleChange} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="10001" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-200">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                        >
                            {loading && (
                                <svg className="animate-spin h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            )}
                            <span>{loading ? 'Processing Order...' : 'Complete Purchase'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
