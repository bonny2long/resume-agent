"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    localStorage.setItem("auth_token", "dev-token");
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="ra-panel w-full max-w-md p-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Login Disabled</h1>
        <p className="mt-2 text-sm text-slate-600">
          Dev mode uses automatic access. Redirecting to your dashboard.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
