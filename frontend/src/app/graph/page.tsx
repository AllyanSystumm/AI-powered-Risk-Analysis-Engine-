"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from "recharts";

const COLORS = ['#22c55e', '#eab308']; // Green for Ship, Yellow for Manual Review

export default function GraphAnalysis() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("http://localhost:3001/orders")
            .then(res => res.json())
            .then(data => {
                setOrders(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch orders:", err);
                setLoading(false);
            });
    }, []);

    // Aggregating Data
    const totalShip = orders.filter(o => o.riskAssessment?.recommendedAction?.toLowerCase() === 'ship').length;
    const totalManualReview = orders.filter(o => o.riskAssessment?.recommendedAction?.toLowerCase() === 'manual_review').length;

    const chartData = [
        { name: 'Ship', count: totalShip },
        { name: 'Manual Review', count: totalManualReview }
    ];

    // Daily Trends Data Parsing
    const dateCounts: Record<string, { date: string; ship: number; manual_review: number }> = {};

    orders.forEach(order => {
        const dateStr = new Date(order.createdAt).toLocaleDateString();
        if (!dateCounts[dateStr]) {
            dateCounts[dateStr] = { date: dateStr, ship: 0, manual_review: 0 };
        }
        const action = order.riskAssessment?.recommendedAction?.toLowerCase();
        if (action === 'ship') {
            dateCounts[dateStr].ship += 1;
        } else if (action === 'manual_review') {
            dateCounts[dateStr].manual_review += 1;
        }
    });

    const timeSeriesData = Object.values(dateCounts);

    return (
        <div className="flex flex-col flex-1 min-h-screen bg-slate-50 p-6 font-sans">
            <div className="max-w-6xl mx-auto w-full">
                {/* Header */}
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
                            <span className="bg-indigo-600 p-2 rounded-lg text-white">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </span>
                            Graph Analysis
                        </h1>
                        <p className="text-slate-600 font-medium">Visualizing risk assessment actions across all processed orders.</p>
                    </div>

                    <Link href="/" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-sm shadow-blue-500/20 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Dashboard
                    </Link>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                        {/* Pie Chart: Overall Distribution */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                            <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">Overall Risk Distribution</h2>
                            <div className="flex-1 min-h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
                                        <Pie
                                            data={chartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={65}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="count"
                                            label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                        >
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: 'bold' }} />
                                        <Legend wrapperStyle={{ fontWeight: 'bold' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Bar Chart: Time Series */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                            <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">Actions by Date</h2>
                            <div className="flex-1 min-h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={timeSeriesData}
                                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="date" tick={{ fill: '#64748b', fontWeight: 600 }} axisLine={{ stroke: '#cbd5e1' }} />
                                        <YAxis tick={{ fill: '#64748b', fontWeight: 600 }} axisLine={{ stroke: '#cbd5e1' }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                                            cursor={{ fill: '#f8fafc' }}
                                        />
                                        <Legend wrapperStyle={{ fontWeight: 'bold', paddingTop: '20px' }} />
                                        <Bar dataKey="ship" name="Ship" stackId="a" fill="#22c55e" radius={[timeSeriesData.some(d => d.manual_review > 0) ? 0 : 4, timeSeriesData.some(d => d.manual_review > 0) ? 0 : 4, 0, 0]} />
                                        <Bar dataKey="manual_review" name="Manual Review" stackId="a" fill="#eab308" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
}
