import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fraud Detection Dashboard",
  description: "Enterprise Fraud Detection & Risk Scoring",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 font-sans min-h-screen selection:bg-indigo-500/30 flex">

        {/* Left Sidebar */}
        <aside className="w-64 shrink-0 bg-[#0B1B3D] text-slate-300 flex flex-col h-screen sticky top-0 border-r border-slate-700 shadow-xl overflow-y-auto">
          {/* Logo Brand Area */}
          <div className="h-20 flex items-center px-6 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <a href="/" className="font-bold text-xl tracking-wide text-white">AI-Risk Analyzer</a>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-8 space-y-2">
            <a href="/" className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium bg-[#1a85ff] text-white shadow-md shadow-blue-500/20">
              <svg className="w-5 h-5 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Dashboard
            </a>
            <a href="/store" className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-slate-400 hover:bg-[#152a55] hover:text-white group">
              <svg className="w-5 h-5 group-hover:text-amber-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              Store Checkout
            </a>

          </nav>

          {/* Bottom user settings area */}
          <div className="p-4 border-t border-slate-700/50">
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-screen bg-white relative">
          <div className="w-full flex-1 flex flex-col pt-2">
            {/* Top Status Bar within Main Area */}
            <header className="h-12 flex items-center justify-between mb-2 px-1">
              <h1 className="text-xl font-bold text-slate-800">AI-Risk Analyzer Engine</h1>

              <div className="flex items-center gap-4">
                <div className="text-sm font-medium text-slate-500 bg-slate-100 px-4 py-2 rounded-full flex items-center gap-2 border border-slate-200 shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></span>
                  System Monitoring Active
                </div>
              </div>
            </header>

            <main className="flex-1 w-full min-h-0">
              {children}
            </main>
          </div>
        </div>

      </body>
    </html>
  );
}
