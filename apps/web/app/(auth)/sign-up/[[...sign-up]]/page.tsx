"use client";

import { SignUp, ClerkLoaded, ClerkLoading } from "@clerk/nextjs";
import { Loader2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

export default function SignUpPage() {
  const [error, setError] = useState(false);

  useEffect(() => {
    // Timeout fallback if Clerk doesn't load within 5s
    const t = setTimeout(() => {
      // It might be loaded and just hidden, but if it hasn't fired ClerkLoaded, show error
      if (!document.querySelector('.clerk-component')) {
        setError(true);
      }
    }, 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center py-12 px-4">
      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-center text-sm text-rose-800 max-w-sm">
          <AlertCircle className="mx-auto h-8 w-8 mb-2 text-rose-500" />
          <p className="font-semibold">Clerk sign-up could not render.</p>
          <p className="mt-1">
            Check allowed origins/redirect URLs for the LAN host. <br />
            Current origin: {typeof window !== 'undefined' ? window.location.origin : ''}
          </p>
        </div>
      )}

      <ClerkLoading>
        <div className="flex flex-col items-center gap-2 text-emerald-600">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-sm font-medium">Đang tải đăng ký...</span>
        </div>
      </ClerkLoading>

      <ClerkLoaded>
        <div className="clerk-component w-full flex justify-center">
          <SignUp 
            fallbackRedirectUrl="/"
            forceRedirectUrl="/"
            routing="path"
            path="/sign-up"
          />
        </div>
      </ClerkLoaded>
    </div>
  );
}
