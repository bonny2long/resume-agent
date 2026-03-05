"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Upload,
  Settings,
  Users,
  Briefcase,
  Mail,
  Send,
  FolderOpen,
} from "lucide-react";

const navSections = [
  {
    label: "Resume",
    items: [
      { href: "/dashboard", icon: FileText, label: "All Resumes", exact: true },
      { href: "/dashboard/upload", icon: Upload, label: "Upload New" },
    ],
  },
  {
    label: "Personal",
    items: [
      { href: "/dashboard/stories", icon: Users, label: "My Story" },
      { href: "/dashboard/tailor", icon: Briefcase, label: "Tailor Resume" },
      { href: "/dashboard/cover-letter", icon: Mail, label: "Cover Letter" },
      { href: "/dashboard/cover-letters", icon: Mail, label: "Saved Letters" },
    ],
  },
  {
    label: "Track",
    items: [
      { href: "/dashboard/applications", icon: Send, label: "Applications" },
      { href: "/dashboard/outputs", icon: FolderOpen, label: "Outputs" },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/dashboard/settings", icon: Settings, label: "Settings" }],
  },
];

function isNavItemActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1680px] items-center justify-between px-5 py-4 md:px-8">
          <Link href="/dashboard" className="text-2xl font-extrabold tracking-tight text-slate-900">
            Resume Agent
          </Link>
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Dev Mode
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1680px] px-5 py-7 md:px-8">
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-12">
          <aside className="lg:col-span-3 xl:col-span-2">
            <nav className="ra-panel sticky top-[90px] p-4 md:p-5">
              {navSections.map((section) => (
                <div key={section.label} className="mb-6 last:mb-0">
                  <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-[0.11em] text-slate-400">
                    {section.label}
                  </p>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const active = isNavItemActive(pathname, item.href, item.exact);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                            active
                              ? "bg-slate-900 text-white shadow-sm"
                              : "text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          <main className="min-w-0 lg:col-span-9 xl:col-span-10">
            <div className="ra-page">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
