'use client';

import React, { useState, useEffect, useRef } from 'react';
import PhoneInput from 'react-phone-number-input';
import { getCountryCallingCode } from 'libphonenumber-js';
import 'react-phone-number-input/style.css';

// ─── Phone validation rules per country ───────────────────────────────────────
interface ValidationResult {
    valid: boolean;
    hint: string;
}

// ─── Calling-code → ISO map for auto-detection ────────────────────────────────
const CALLING_CODE_TO_ISO: Record<string, string> = {
    '92': 'PK', '91': 'IN', '1': 'US', '44': 'GB', '61': 'AU',
    '55': 'BR', '49': 'DE', '33': 'FR', '971': 'AE', '966': 'SA',
    '90': 'TR', '234': 'NG', '20': 'EG', '27': 'ZA', '880': 'BD',
    '86': 'CN', '81': 'JP', '54': 'AR', '52': 'MX', '39': 'IT',
};

// Detect ISO country code from an E.164 string (tries 3-digit, 2-digit, 1-digit codes)
function detectCountryFromE164(e164: string): string | undefined {
    const digits = e164.replace(/^\+/, '');
    for (const len of [3, 2, 1]) {
        const prefix = digits.slice(0, len);
        if (CALLING_CODE_TO_ISO[prefix]) return CALLING_CODE_TO_ISO[prefix];
    }
    return undefined;
}

function validatePhone(e164: string | undefined, country: string | undefined): ValidationResult {
    if (!e164 || e164.length < 4) {
        return { valid: false, hint: 'Phone number is required.' };
    }

    const nationalRules: Record<string, { code: string; validate: (national: string) => ValidationResult }> = {
        PK: {
            code: '92',
            validate: (n) => {
                if (n.length !== 10 || !n.startsWith('3'))
                    return { valid: false, hint: 'Pakistani mobile numbers must start with 3 and be exactly 10 digits after +92 (e.g. +92 3XX XXXXXXX).' };

                const prefix = parseInt(n.slice(0, 3), 10);
                const jazz = (prefix >= 300 && prefix <= 309) || (prefix >= 320 && prefix <= 325);
                const zong = (prefix >= 310 && prefix <= 319) || prefix === 370 || prefix === 371;
                const ufone = (prefix >= 330 && prefix <= 339);
                const telenor = (prefix >= 340 && prefix <= 348);
                const scom = prefix === 355;

                if (!jazz && !zong && !ufone && !telenor && !scom)
                    return {
                        valid: false,
                        hint: `+92${n.slice(0, 3)} is not a valid Pakistani operator prefix. ` +
                            `Valid: Jazz 300–309/320–325 · Zong 310–319/370–371 · Ufone 330–339 · Telenor 340–348 · SCOM 355.`,
                    };

                const operator = jazz ? 'Jazz' : zong ? 'Zong' : ufone ? 'Ufone' : telenor ? 'Telenor' : 'SCOM';
                return { valid: true, hint: `✅ Valid Pakistani mobile number (${operator}).` };
            },
        },
        IN: {
            code: '91',
            validate: (n) => {
                if (n.length !== 10)
                    return { valid: false, hint: `Indian mobile numbers must be exactly 10 digits after +91, but got ${n.length} digit${n.length === 1 ? '' : 's'}.` };
                if (!/^[6-9]/.test(n))
                    return { valid: false, hint: 'Indian mobile numbers must start with 6, 7, 8, or 9 after +91.' };
                return { valid: true, hint: '✅ Valid Indian mobile number.' };
            },
        },
        US: {
            code: '1',
            validate: (n) => {
                if (n.length !== 10)
                    return { valid: false, hint: `US numbers must be exactly 10 digits after +1, but got ${n.length}.` };
                return { valid: true, hint: '✅ Valid US number.' };
            },
        },
        CA: {
            code: '1',
            validate: (n) => {
                if (n.length !== 10)
                    return { valid: false, hint: `Canadian numbers must be exactly 10 digits after +1, but got ${n.length}.` };
                return { valid: true, hint: '✅ Valid Canadian number.' };
            },
        },
        GB: {
            code: '44',
            validate: (n) => {
                if (n.length < 9 || n.length > 10)
                    return { valid: false, hint: `UK numbers must be 9–10 digits after +44, but got ${n.length}.` };
                return { valid: true, hint: '✅ Valid UK number.' };
            },
        },
        AU: {
            code: '61',
            validate: (n) => {
                if (n.length !== 9)
                    return { valid: false, hint: `Australian numbers must be exactly 9 digits after +61, but got ${n.length}.` };
                if (!n.startsWith('4'))
                    return { valid: false, hint: 'Australian mobile numbers must start with 4 after +61 (e.g. +61 4XX XXX XXX).' };
                return { valid: true, hint: '✅ Valid Australian mobile number.' };
            },
        },
        BR: {
            code: '55',
            validate: (n) => {
                if (n.length < 10 || n.length > 11)
                    return { valid: false, hint: `Brazilian numbers must be 10–11 digits after +55, but got ${n.length}.` };
                return { valid: true, hint: '✅ Valid Brazilian number.' };
            },
        },
        DE: {
            code: '49',
            validate: (n) => {
                if (n.length < 10 || n.length > 12)
                    return { valid: false, hint: `German numbers must be 10–12 digits after +49, but got ${n.length}.` };
                return { valid: true, hint: '✅ Valid German number.' };
            },
        },
        FR: {
            code: '33',
            validate: (n) => {
                if (n.length !== 9)
                    return { valid: false, hint: `French numbers must be exactly 9 digits after +33, but got ${n.length}.` };
                return { valid: true, hint: '✅ Valid French number.' };
            },
        },
        AE: {
            code: '971',
            validate: (n) => {
                if (n.length !== 9)
                    return { valid: false, hint: `UAE numbers must be exactly 9 digits after +971, but got ${n.length}.` };
                return { valid: true, hint: '✅ Valid UAE number.' };
            },
        },
        SA: {
            code: '966',
            validate: (n) => {
                if (n.length !== 9)
                    return { valid: false, hint: `Saudi numbers must be exactly 9 digits after +966, but got ${n.length}.` };
                return { valid: true, hint: '✅ Valid Saudi number.' };
            },
        },
        TR: {
            code: '90',
            validate: (n) => {
                if (n.length !== 10)
                    return { valid: false, hint: `Turkish numbers must be exactly 10 digits after +90, but got ${n.length}.` };
                return { valid: true, hint: '✅ Valid Turkish number.' };
            },
        },
        NG: {
            code: '234',
            validate: (n) => {
                if (n.length !== 10)
                    return { valid: false, hint: `Nigerian numbers must be exactly 10 digits after +234, but got ${n.length}.` };
                return { valid: true, hint: '✅ Valid Nigerian number.' };
            },
        },
        EG: {
            code: '20',
            validate: (n) => {
                if (n.length !== 10)
                    return { valid: false, hint: `Egyptian numbers must be exactly 10 digits after +20, but got ${n.length}.` };
                return { valid: true, hint: '✅ Valid Egyptian number.' };
            },
        },
        ZA: {
            code: '27',
            validate: (n) => {
                if (n.length !== 9)
                    return { valid: false, hint: `South African numbers must be exactly 9 digits after +27, but got ${n.length}.` };
                return { valid: true, hint: '✅ Valid South African number.' };
            },
        },
        BD: {
            code: '880',
            validate: (n) => {
                if (n.length !== 10 || !n.startsWith('1'))
                    return { valid: false, hint: 'Bangladeshi mobile numbers must be 10 digits after +880 and start with 1.' };
                return { valid: true, hint: '✅ Valid Bangladeshi number.' };
            },
        },
    };

    // ── Resolve the country to apply: prefer passed-in country, fallback to E.164 auto-detection
    const cleanDigits = (str: string) => str.replace(/\D/g, '');
    let resolvedCountry = country && nationalRules[country] ? country : detectCountryFromE164(e164);
    const rule = resolvedCountry ? nationalRules[resolvedCountry] : undefined;

    if (rule) {
        // Extract national portion: strip '+' and country code, then strip ALL non-digit chars
        const withoutPlus = e164.replace(/^\+/, '');
        const raw = withoutPlus.startsWith(rule.code) ? withoutPlus.slice(rule.code.length) : withoutPlus;
        const national = cleanDigits(raw);   // removes any stray spaces/dashes the library may have left
        return rule.validate(national);
    }

    // Generic fallback only for truly unknown country codes
    const totalDigits = cleanDigits(e164).length;
    if (totalDigits < 7 || totalDigits > 15)
        return { valid: false, hint: 'Phone number must be between 7 and 15 digits.' };
    return { valid: true, hint: '✅ Valid phone number.' };
}

// ─── Hardcoded IP list ─────────────────────────────────────────────────────────
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

// ─── Component ─────────────────────────────────────────────────────────────────
export default function Storefront() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);

    // Phone validation state
    const [phoneCountry, setPhoneCountry] = useState<string | undefined>('PK');
    const phoneCountryRef = useRef<string | undefined>('PK'); // always-current ref, avoids stale closures
    const [phoneTouched, setPhoneTouched] = useState(false);
    const [phoneValidation, setPhoneValidation] = useState<ValidationResult>({ valid: false, hint: '' });

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

    // Handle phone value change (E.164 string from library)
    const handlePhoneChange = (value: string | undefined) => {
        const newPhone = value || '';
        setFormData(prev => ({ ...prev, phone: newPhone }));
        setPhoneTouched(true);
        // Use ref instead of state to always read the CURRENT country (avoids stale closure)
        setPhoneValidation(validatePhone(newPhone, phoneCountryRef.current));
    };

    // Handle country change in the phone dropdown
    const handlePhoneCountryChange = (country: string | undefined) => {
        setPhoneCountry(country);
        phoneCountryRef.current = country; // keep ref in sync immediately
        setPhoneTouched(false);

        let prefilled = '';
        if (country) {
            try {
                const callingCode = getCountryCallingCode(country as any);
                prefilled = `+${callingCode}`;
            } catch {
                prefilled = '';
            }
        }
        setFormData(prev => ({ ...prev, phone: prefilled }));
        setPhoneValidation(validatePhone(prefilled, country));
    };

    // Load from local storage on mount
    useEffect(() => {
        const savedData = localStorage.getItem('storeCheckoutData');
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                setFormData(parsed);
                if (parsed.phone) {
                    setPhoneValidation(validatePhone(parsed.phone, parsed.country || 'PK'));
                }
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

        // Force phone validation on submit
        setPhoneTouched(true);
        const validation = validatePhone(formData.phone, phoneCountry);
        setPhoneValidation(validation);
        if (!validation.valid) return;

        setLoading(true);
        setResult(null);

        const matchingIpData = HARDCODED_IPS.find(loc => loc.city.toLowerCase() === formData.city.toLowerCase()) || HARDCODED_IPS[0];

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
                country: formData.country
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error('Failed to submit order');

            const data = await response.json();
            setResult({ success: true, message: 'Order Placed Successfully!', data });

        } catch (error: any) {
            setResult({ success: false, message: error.message || 'An error occurred during checkout.' });
        } finally {
            setLoading(false);
        }
    };

    // Determine phone field border color
    const phoneFieldClass = (() => {
        if (!phoneTouched) return 'border-slate-300';
        return phoneValidation.valid ? 'border-green-500 ring-1 ring-green-400' : 'border-red-400 ring-1 ring-red-400';
    })();

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
                                <input
                                    required
                                    type="text"
                                    name="fullName"
                                    value={formData.fullName}
                                    onChange={handleChange}
                                    onKeyDown={(e) => {
                                        // Block digits (0-9) and decimal point — names are letters only
                                        if (/[\d.]/.test(e.key)) e.preventDefault();
                                    }}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    placeholder="John Doe"
                                />
                            </div>

                            <div>
                                <label className="block text-sm mb-1 text-slate-600">Email Address <span className="text-red-500">*</span></label>
                                <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="customer@example.com" />
                            </div>

                            {/* ── Phone Field with Validation ── */}
                            <div>
                                <label className="block text-sm mb-1 text-slate-600">
                                    Phone <span className="text-red-500">*</span>
                                    <span className="ml-2 text-xs text-slate-400 font-normal">Select country flag → country code auto-fills</span>
                                </label>
                                <PhoneInput
                                    placeholder="Enter phone number"
                                    value={formData.phone}
                                    onChange={handlePhoneChange}
                                    onCountryChange={handlePhoneCountryChange}
                                    defaultCountry="PK"
                                    className={`w-full bg-slate-50 border rounded-lg p-2.5 focus-within:outline-none transition-colors ${phoneFieldClass}`}
                                    style={{ "--PhoneInputCountrySelectArrow-color": "#64748b" } as React.CSSProperties}
                                />
                                {/* Inline hint */}
                                {phoneTouched && phoneValidation.hint && (
                                    <p className={`mt-1.5 text-xs font-medium flex items-start gap-1 ${phoneValidation.valid ? 'text-green-600' : 'text-red-500'}`}>
                                        {!phoneValidation.valid && (
                                            <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                            </svg>
                                        )}
                                        {phoneValidation.hint}
                                    </p>
                                )}
                                {/* Format helper text based on country */}
                                {!phoneTouched && phoneCountry && (
                                    <p className="mt-1 text-xs text-slate-400">
                                        {phoneCountry === 'PK' && 'Format: +92 3XX XXXXXXX (10 digits after +92, starts with 3)'}
                                        {phoneCountry === 'IN' && 'Format: +91 XXXXXXXXXX (10 digits, starts with 6–9)'}
                                        {phoneCountry === 'US' && 'Format: +1 XXXXXXXXXX (10-digit NANP)'}
                                        {phoneCountry === 'CA' && 'Format: +1 XXXXXXXXXX (10-digit NANP)'}
                                        {phoneCountry === 'GB' && 'Format: +44 XXXXXXXXXX (9–10 digits after +44)'}
                                        {phoneCountry === 'AU' && 'Format: +61 XXXXXXXXX (9 digits after +61)'}
                                        {phoneCountry === 'BR' && 'Format: +55 XXXXXXXXXX (10–11 digits after +55)'}
                                        {phoneCountry === 'AE' && 'Format: +971 XXXXXXXXX (9 digits after +971)'}
                                        {phoneCountry === 'SA' && 'Format: +966 XXXXXXXXX (9 digits after +966)'}
                                        {!['PK', 'IN', 'US', 'CA', 'GB', 'AU', 'BR', 'AE', 'SA'].includes(phoneCountry) && 'Enter number — country code will be added automatically.'}
                                    </p>
                                )}
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
                            className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                        >
                            {loading && (
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
