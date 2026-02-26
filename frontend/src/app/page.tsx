"use client";
import { useState, useEffect } from "react";

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
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-3 px-5 flex flex-col items-center">
            <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Processed</span>
            <span className="text-2xl font-bold text-slate-800">{totalOrders}</span>
          </div>
          <div className="bg-green-50 border border-green-200 shadow-sm rounded-xl p-3 px-5 flex flex-col items-center">
            <span className="text-xs text-green-700 uppercase font-bold tracking-wider">Total Ship</span>
            <span className="text-2xl font-bold text-green-800">{totalShip}</span>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 shadow-sm rounded-xl p-3 px-5 flex flex-col items-center">
            <span className="text-xs text-yellow-700 uppercase font-bold tracking-wider">Total Manual Review</span>
            <span className="text-2xl font-bold text-yellow-800">{totalManualReview}</span>
          </div>
        </div>
      </div>

      <div className="border border-slate-200 bg-white overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="border-b border-slate-200 bg-slate-50 p-2 flex gap-1">
          {[
            { label: "All", value: "all" },
            { label: "Risk detection(1-30 → manual review)", value: "medium risk", color: "yellow" },
            { label: "No Risk detection (0 → ship)", value: "low risk", color: "green" }
          ].map(tab => {
            const isActive = activeTab === tab.value;
            let colorClasses = "text-slate-500 hover:text-slate-900 hover:bg-slate-200";

            if (isActive) {
              if (tab.color === "red") colorClasses = "bg-red-50 text-red-700 shadow-sm ring-1 ring-red-200";
              else if (tab.color === "yellow") colorClasses = "bg-yellow-50 text-yellow-700 shadow-sm ring-1 ring-yellow-200";
              else if (tab.color === "green") colorClasses = "bg-green-50 text-green-700 shadow-sm ring-1 ring-green-200";
              else colorClasses = "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200";
            }

            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${colorClasses}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[1300px]">
            <colgroup>
              <col style={{ width: '40px' }} />   {/* # */}
              <col style={{ width: '120px' }} />  {/* Order ID */}
              <col style={{ width: '100px' }} />  {/* Customer */}
              <col style={{ width: '170px' }} />  {/* Email */}
              <col style={{ width: '110px' }} />  {/* Contact */}
              <col style={{ width: '160px' }} />  {/* Address */}
              <col style={{ width: '90px' }} />   {/* Postal Code */}
              <col style={{ width: '70px' }} />   {/* Country */}
              <col style={{ width: '90px' }} />   {/* Time */}
              <col style={{ width: '70px' }} />   {/* Amount */}
              <col style={{ width: '110px' }} />  {/* Risk Score */}
              <col style={{ width: '120px' }} />  {/* Recommendation */}
              <col style={{ width: '90px' }} />   {/* Analysis */}
              <col style={{ width: '70px' }} />   {/* Delete */}
            </colgroup>
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
                    <td className="py-3 px-2 text-sm text-slate-500 break-words">{order.address ? `${order.address.street}, ${order.address.city}` : '—'}</td>
                    <td className="py-3 px-2 text-sm text-slate-500">{order.address?.postalCode || '—'}</td>
                    <td className="py-3 px-2 text-sm text-slate-500">{order.userProfile?.country || '—'}</td>
                    <td className="py-3 px-2 text-sm text-slate-500 font-medium whitespace-nowrap">{new Date(order.createdAt).toLocaleTimeString()}</td>
                    <td className="py-3 px-2 text-sm text-slate-700 font-medium">${order.totalAmount}</td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden shadow-inner">
                          <div
                            className={`h-full rounded-full ${riskScore >= 1 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min((riskScore / 30) * 100, 100)}%` }}
                          ></div>
                        </div>
                        <span className={`text-sm font-bold shrink-0 ${riskScore >= 1 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {riskScore}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold border ${recommended.toLowerCase() === 'manual_review' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                        'bg-green-50 text-green-700 border-green-200'
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
                        className="text-red-600 hover:text-red-700 transition-colors bg-white hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 hover:border-red-300 shadow-sm whitespace-nowrap"
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
              {modalTab === "risk" && (
                <>
                  <div className="mb-6 p-4 rounded-xl border border-blue-300 bg-blue-100">
                    <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-2">AI Summary</h3>
                    <p className="text-slate-800 text-lg leading-relaxed font-medium">
                      {selectedOrder.riskAssessment?.summary || "No summary available."}
                    </p>
                  </div>

                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Risk Rules Analysis</h3>

                  <div className="space-y-4">
                    {/* Triggered (Failed) Rules */}
                    <div className="space-y-3">
                      {selectedOrder.riskAssessment?.riskFlags?.filter((flag: any) => flag.triggered).length > 0 ? (
                        selectedOrder.riskAssessment?.riskFlags?.filter((flag: any) => flag.triggered).map((flag: any, index: number) => (
                          <div key={`triggered-${index}`} className="flex gap-4 p-4 rounded-xl border border-red-300 bg-red-100">
                            <div className="text-red-800 mt-1">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-800 text-sm mb-1">{flag.ruleName}</h4>
                              <p className="text-sm text-slate-600 leading-relaxed font-medium">{flag.explanation}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 rounded-xl border border-green-300 bg-green-100 text-green-800 font-medium text-center">
                          No risk flags triggered. This order appears extremely safe.
                        </div>
                      )}
                    </div>

                    {/* Passed Rules */}
                    {selectedOrder.riskAssessment?.riskFlags?.filter((flag: any) => !flag.triggered).length > 0 && (
                      <div className="pt-2 border-t border-slate-200">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 mt-2">Passed Checks</h4>
                        <div className="space-y-3">
                          {selectedOrder.riskAssessment?.riskFlags?.filter((flag: any) => !flag.triggered).map((flag: any, index: number) => (
                            <div key={`passed-${index}`} className="flex gap-4 p-4 rounded-xl border border-green-200 bg-green-100">
                              <div className="text-green-800 mt-1">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-800 text-sm mb-1">{flag.ruleName}</h4>
                                <p className="text-sm text-slate-500 leading-relaxed font-medium">{flag.explanation}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

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
                                        {histOrder.address.street}, {histOrder.address.city}, {histOrder.address.postalCode}
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
