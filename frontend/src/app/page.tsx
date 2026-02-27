"use client";
import { useState, useEffect } from "react";

import Link from "next/link";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("all");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [modalTab, setModalTab] = useState<"risk" | "history">("risk");
  const [customerHistory, setCustomerHistory] = useState<any | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  // Whenever a new order is selected, reset modal state and fetch customer history
  useEffect(() => {
    if (!selectedOrder) {
      setCustomerHistory(null);
      setModalTab("risk");
      return;
    }
    const email = selectedOrder.userProfile?.email;
    if (!email) return;
    setHistoryLoading(true);
    setCustomerHistory(null);
    fetch(`http://localhost:3001/orders/customer/${encodeURIComponent(email)}`)
      .then(res => res.json())
      .then(data => {
        setCustomerHistory(data);
        setHistoryLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch customer history:", err);
        setHistoryLoading(false);
      });
  }, [selectedOrder]);

  const handleDelete = async (orderId: string, dbId: string) => {
    if (confirm(`Are you sure you want to delete order ${orderId}?`)) {
      try {
        const response = await fetch(`http://localhost:3001/orders/${dbId}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          setOrders(orders.filter(o => o.id !== dbId));
        } else {
          console.error("Failed to delete order");
        }
      } catch (err) {
        console.error("Error deleting order:", err);
      }
    }
  };

  const filteredOrders = orders.filter(o => {
    if (activeTab === "all") return true;
    const action = o.riskAssessment?.recommendedAction?.toLowerCase() || "";
    if (activeTab === "medium risk" && action === "manual_review") return true;
    if (activeTab === "low risk" && action === "ship") return true;
    return false;
  });

  const totalOrders = orders.length;
  const totalShip = orders.filter(o => o.riskAssessment?.recommendedAction?.toLowerCase() === 'ship').length;
  const totalManualReview = orders.filter(o => o.riskAssessment?.recommendedAction?.toLowerCase() === 'manual_review').length;

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-0.5">Incoming Orders</h1>
          <p className="text-slate-500">AI-powered risk analysis and automated actioning</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-blue-50 border border-blue-200 shadow-sm rounded-xl p-3 px-5 flex flex-col items-center">
            <span className="text-xs text-blue-700 uppercase font-bold tracking-wider">Processed</span>
            <span className="text-2xl font-bold text-blue-800">{totalOrders}</span>
          </div>
          <div className="bg-green-400 border border-green-500 shadow-sm rounded-xl p-3 px-5 flex flex-col items-center">
            <span className="text-xs text-green-900 uppercase font-bold tracking-wider">Total Ship</span>
            <span className="text-2xl font-bold text-green-950">{totalShip}</span>
          </div>
          <div className="bg-yellow-400 border border-yellow-500 shadow-sm rounded-xl p-3 px-5 flex flex-col items-center">
            <span className="text-xs text-yellow-900 uppercase font-bold tracking-wider">Total Manual Review</span>
            <span className="text-2xl font-bold text-yellow-950">{totalManualReview}</span>
          </div>
        </div>
      </div>

      <div className="border border-slate-200 bg-white overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="border-b border-slate-200 bg-slate-50 p-2 flex gap-1">
          {[
            { label: "All", value: "all", color: "blue" },
            { label: "Risk detection (1-40 → manual review)", value: "medium risk", color: "yellow" },
            { label: "No Risk detection (0 → ship)", value: "low risk", color: "green" }
          ].map(tab => {
            const isActive = activeTab === tab.value;
            let colorClasses = "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 shadow-sm border border-slate-200";

            if (tab.color === "yellow") {
              colorClasses = isActive
                ? "bg-yellow-400 text-yellow-900 shadow-md border border-yellow-500"
                : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-300";
            } else if (tab.color === "green") {
              colorClasses = isActive
                ? "bg-green-400 text-green-900 shadow-md border border-green-500"
                : "bg-green-100 text-green-800 hover:bg-green-200 border border-green-300";
            } else if (isActive) {
              colorClasses = "bg-blue-600 text-white shadow-md border border-blue-700";
            }

            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-5 py-2.5 rounded-lg text-base font-bold transition-all duration-200 ${colorClasses}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[1300px]">
            <colgroup><col style={{ width: '40px' }} /><col style={{ width: '120px' }} /><col style={{ width: '100px' }} /><col style={{ width: '170px' }} /><col style={{ width: '110px' }} /><col style={{ width: '160px' }} /><col style={{ width: '90px' }} /><col style={{ width: '70px' }} /><col style={{ width: '90px' }} /><col style={{ width: '70px' }} /><col style={{ width: '110px' }} /><col style={{ width: '120px' }} /><col style={{ width: '90px' }} /><col style={{ width: '70px' }} /></colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-300 text-xs uppercase text-slate-700 font-bold border-b border-slate-400">
                <th className="py-3 px-2 tracking-wider">Count</th>
                <th className="py-3 px-2 tracking-wider">Order ID</th>
                <th className="py-3 px-2 tracking-wider">Customer</th>
                <th className="py-3 px-2 tracking-wider">Email</th>
                <th className="py-3 px-2 tracking-wider">Contact</th>
                <th className="py-3 px-2 tracking-wider">Address</th>
                <th className="py-3 px-2 tracking-wider">Postal Code</th>
                <th className="py-3 px-2 tracking-wider">Country</th>
                <th className="py-3 px-2 tracking-wider">Time</th>
                <th className="py-3 px-2 tracking-wider">Amount</th>
                <th className="py-3 px-2 tracking-wider">Risk Score</th>
                <th className="py-3 px-2 tracking-wider">Recommendation</th>
                <th className="py-3 px-2 tracking-wider text-right">Analysis</th>
                <th className="py-3 px-2 tracking-wider text-right">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-solid divide-black">
              {loading ? (
                <tr><td colSpan={14} className="py-8 text-center text-slate-500 font-medium">Loading orders...</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan={14} className="py-8 text-center text-slate-500 font-medium">No orders found.</td></tr>
              ) : filteredOrders.map((order, i) => {
                const riskScore = order.riskAssessment?.riskScore || 0;
                const recommended = order.riskAssessment?.recommendedAction || 'N/A';

                return (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-3 px-2 text-sm text-black font-bold">{i + 1}</td>
                    <td className="py-3 px-2 font-bold text-sm text-slate-800 group-hover:text-indigo-600 transition-colors break-all">{order.orderIdString}</td>
                    <td className="py-3 px-2 text-sm text-slate-700 font-medium break-words">{order.userProfile?.fullName || '—'}</td>
                    <td className="py-3 px-2 text-sm text-slate-500 break-all">{order.userProfile?.email || '—'}</td>
                    <td className="py-3 px-2 text-sm text-slate-500 break-all">{order.userProfile?.phone || '—'}</td>
                    <td className="py-3 px-2 text-sm text-slate-500 break-words">{order.address ? `${order.address.street}` : '—'}</td>
                    <td className="py-3 px-2 text-sm text-slate-500">{order.address?.postalCode || '—'}</td>
                    <td className="py-3 px-2 text-sm text-slate-500">{order.userProfile?.country || '—'}</td>
                    <td className="py-3 px-2 text-sm text-slate-500 font-medium whitespace-nowrap">{new Date(order.createdAt).toLocaleTimeString()}</td>
                    <td className="py-3 px-2 text-sm text-slate-700 font-medium">${order.totalAmount}</td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden shadow-inner">
                          <div
                            className={`h-full rounded-full ${riskScore >= 1 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min((riskScore / 40) * 100, 100)}%` }}
                          ></div>
                        </div>
                        <span className={`text-sm font-bold shrink-0 ${riskScore >= 1 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {riskScore}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold border shadow-sm ${recommended.toLowerCase() === 'manual_review' ? 'bg-yellow-400 text-yellow-900 border-yellow-500' :
                        'bg-green-400 text-green-900 border-green-500'
                        }`}>
                        {recommended}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="text-white bg-blue-600 hover:bg-blue-700 transition-colors px-3 py-1.5 rounded-lg text-xs font-semibold border border-blue-600 shadow-sm whitespace-nowrap"
                      >
                        Details
                      </button>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <button
                        onClick={() => handleDelete(order.orderIdString, order.id)}
                        className="text-white bg-red-600 hover:bg-red-700 transition-colors px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-600 shadow-sm whitespace-nowrap"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Risk Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  Order Details <span className="text-slate-400 text-base font-normal ml-2">{selectedOrder.orderIdString}</span>
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">{selectedOrder.userProfile?.fullName} &mdash; {selectedOrder.userProfile?.email}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 bg-white px-6">
              <button
                onClick={() => setModalTab("risk")}
                className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors ${modalTab === "risk" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
              >
                Risk Analysis
              </button>
              <button
                onClick={() => setModalTab("history")}
                className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${modalTab === "history" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
              >
                Customer History
                {customerHistory && (
                  <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold ${customerHistory.totalOrders > 1 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"}`}>
                    {customerHistory.totalOrders}
                  </span>
                )}
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto">

              {/* --- RISK ANALYSIS TAB --- */}
              {modalTab === "risk" && (() => {
                const riskScore = selectedOrder.riskAssessment?.riskScore || 0;
                const recommended = selectedOrder.riskAssessment?.recommendedAction || 'N/A';
                const allFlags = selectedOrder.riskAssessment?.riskFlags || [];
                const triggeredFlags = allFlags.filter((f: any) => f.triggered);
                const passedFlags = allFlags.filter((f: any) => !f.triggered);
                const scorePercent = Math.min((riskScore / 40) * 100, 100);
                const isRisky = riskScore >= 1;

                return (
                  <>
                    {/* Risk Score Overview */}
                    <div className={`mb-5 p-5 rounded-xl border-2 ${isRisky ? 'border-yellow-400 bg-gradient-to-r from-yellow-50 to-orange-50' : 'border-green-400 bg-gradient-to-r from-green-50 to-emerald-50'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Risk Score</h3>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className={`text-4xl font-black ${isRisky ? 'text-yellow-600' : 'text-green-600'}`}>{riskScore}</span>
                            <span className="text-lg text-slate-400 font-medium">/ 40</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold border-2 shadow-sm ${isRisky ? 'bg-yellow-400 text-yellow-900 border-yellow-500' : 'bg-green-400 text-green-900 border-green-500'}`}>
                            {recommended === 'manual_review' ? '⚠️ Manual Review' : '✅ Ship'}
                          </span>
                          <p className="text-xs text-slate-400 mt-1.5 font-medium">
                            {isRisky ? 'Chances of Risk Delivery' : 'No Risk Detected'}
                          </p>
                        </div>
                      </div>
                      {/* Score Progress Bar */}
                      <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${riskScore >= 20 ? 'bg-red-500' : isRisky ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${scorePercent}%` }}
                        />
                      </div>
                      {/* Rule Stats */}
                      <div className="flex gap-4 mt-3">
                        <span className="text-xs font-bold text-red-600 bg-red-100 px-2.5 py-1 rounded-full border border-red-200">
                          {triggeredFlags.length} Triggered
                        </span>
                        <span className="text-xs font-bold text-green-600 bg-green-100 px-2.5 py-1 rounded-full border border-green-200">
                          {passedFlags.length} Passed
                        </span>
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                          {allFlags.length} Total Rules
                        </span>
                      </div>
                    </div>

                    {/* AI Summary */}
                    <div className="mb-5 p-4 rounded-xl border border-blue-300 bg-blue-50">
                      <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1.5">AI Summary</h3>
                      <p className="text-slate-800 text-sm leading-relaxed font-medium">
                        {selectedOrder.riskAssessment?.summary || "No summary available."}
                      </p>
                    </div>

                    {/* Triggered Rules */}
                    {triggeredFlags.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <span>⚠️ Triggered Rules</span>
                          <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200">+{triggeredFlags.length * 5} pts</span>
                        </h4>
                        <div className="space-y-2.5">
                          {triggeredFlags.map((flag: any, index: number) => (
                            <div key={`triggered-${index}`} className="flex gap-3 p-3.5 rounded-xl border border-red-300 bg-red-50">
                              <div className="flex flex-col items-center gap-1 shrink-0">
                                <div className="text-red-600 bg-red-200 rounded-full p-1">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                  </svg>
                                </div>
                                <span className="text-[10px] font-black text-red-500">+5</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-bold text-red-400 bg-red-100 px-1.5 py-0.5 rounded">#{flag.ruleId || index + 1}</span>
                                  <h4 className="font-bold text-slate-800 text-sm">{flag.ruleName}</h4>
                                </div>
                                <p className="text-sm text-slate-600 leading-relaxed">{flag.explanation}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No Risks Message */}
                    {triggeredFlags.length === 0 && (
                      <div className="mb-4 p-4 rounded-xl border-2 border-green-300 bg-green-50 text-center">
                        <p className="text-green-700 font-bold text-lg">🎉 No risk flags triggered!</p>
                        <p className="text-green-600 text-sm mt-1">This order appears extremely safe.</p>
                      </div>
                    )}

                    {/* Passed Rules */}
                    {passedFlags.length > 0 && (
                      <div className="pt-3 border-t border-slate-200">
                        <h4 className="text-xs font-bold text-green-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <span>✅ Passed Checks</span>
                          <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full border border-green-200">{passedFlags.length} rules</span>
                        </h4>
                        <div className="space-y-2">
                          {passedFlags.map((flag: any, index: number) => (
                            <div key={`passed-${index}`} className="flex gap-3 p-3 rounded-xl border border-green-200 bg-green-50/50">
                              <div className="shrink-0">
                                <div className="text-green-600 bg-green-200 rounded-full p-1">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-[10px] font-bold text-green-400 bg-green-100 px-1.5 py-0.5 rounded">#{flag.ruleId || index + 1}</span>
                                  <h4 className="font-bold text-slate-700 text-sm">{flag.ruleName}</h4>
                                </div>
                                <p className="text-xs text-slate-500 leading-relaxed">{flag.explanation}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* --- CUSTOMER HISTORY TAB --- */}
              {modalTab === "history" && (
                <>
                  {historyLoading ? (
                    <div className="py-10 text-center text-slate-500 font-medium">Loading customer history...</div>
                  ) : !customerHistory ? (
                    <div className="py-10 text-center text-slate-500 font-medium">No history data available.</div>
                  ) : (
                    <>
                      {/* Summary Stats */}
                      <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-center">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Orders</p>
                          <p className={`text-3xl font-bold ${customerHistory.totalOrders > 1 ? "text-orange-600" : "text-slate-700"}`}>
                            {customerHistory.totalOrders}
                          </p>
                        </div>
                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-center">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Spent</p>
                          <p className="text-3xl font-bold text-slate-700">${customerHistory.totalSpent.toFixed(2)}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-center">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Avg Order</p>
                          <p className="text-3xl font-bold text-slate-700">
                            ${customerHistory.totalOrders > 0 ? (customerHistory.totalSpent / customerHistory.totalOrders).toFixed(2) : "0.00"}
                          </p>
                        </div>
                      </div>

                      {/* Order list */}
                      {customerHistory.totalOrders === 0 ? (
                        <div className="p-6 rounded-xl border border-green-200 bg-green-50 text-center">
                          <p className="text-green-700 font-semibold text-lg">🎉 First-time customer</p>
                          <p className="text-green-600 text-sm mt-1">No previous order history found for this email.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Order History</h3>
                          {customerHistory.orders.map((histOrder: any, idx: number) => {
                            const isCurrentOrder = histOrder.id === selectedOrder.id;
                            const hRiskScore = histOrder.riskAssessment?.riskScore ?? null;
                            const hAction = histOrder.riskAssessment?.recommendedAction ?? null;
                            return (
                              <div
                                key={histOrder.id}
                                className={`rounded-xl border p-4 ${isCurrentOrder ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-slate-50"}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-bold text-slate-800 text-sm truncate">{histOrder.orderIdString}</span>
                                      {isCurrentOrder && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200 whitespace-nowrap">
                                          Current Order
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-500">{new Date(histOrder.createdAt).toLocaleString()}</p>
                                    {histOrder.address && (
                                      <p className="text-xs text-slate-400 mt-1">
                                        {histOrder.address.street}, {histOrder.address.postalCode}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                                    <span className="text-base font-bold text-slate-700">${histOrder.totalAmount}</span>
                                    {hRiskScore !== null && (
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${hRiskScore >= 1 ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-green-50 text-green-700 border-green-200"}`}>
                                        Risk: {hRiskScore}
                                      </span>
                                    )}
                                    {hAction && (
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${hAction === "manual_review" ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-green-50 text-green-700 border-green-200"}`}>
                                        {hAction}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
