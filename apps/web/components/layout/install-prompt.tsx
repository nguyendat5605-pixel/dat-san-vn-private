"use client";

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only run on client
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isStandaloneMode = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;
    
    setIsIOS(isIOSDevice);
    setIsStandalone(isStandaloneMode);

    // Show only on mobile, if not standalone, and if user hasn't dismissed it
    const dismissed = localStorage.getItem("datsanvn-install-dismissed");
    
    if (!isStandaloneMode && !dismissed && window.innerWidth < 768) {
      setIsVisible(true);
    }
  }, []);

  if (!isVisible) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("datsanvn-install-dismissed", "true");
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-safe animate-in slide-in-from-bottom-10 md:hidden">
      <div className="mx-auto max-w-sm overflow-hidden rounded-2xl bg-white p-4 shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Download className="h-5 w-5" />
          </div>
          <div className="text-sm font-medium text-slate-800 leading-tight">
            Thêm DatSanVN vào màn hình chính {isIOS ? "(Share > Add to Home Screen)" : "để trải nghiệm nhanh hơn"}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full" onClick={handleDismiss}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
