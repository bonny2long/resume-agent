import Link from "next/link";
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

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-gray-900">
            Resume Agent
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Dev Mode</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <nav className="space-y-1">
            <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Resume
            </div>
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <FileText className="w-5 h-5" />
              All Resumes
            </Link>
            <Link
              href="/dashboard/upload"
              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <Upload className="w-5 h-5" />
              Upload New
            </Link>
            
            <div className="px-3 py-2 mt-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Personal
            </div>
            <Link
              href="/dashboard/stories"
              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <Users className="w-5 h-5" />
              My Story
            </Link>
            <Link
              href="/dashboard/tailor"
              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <Briefcase className="w-5 h-5" />
              Tailor Resume
            </Link>
            <Link
              href="/dashboard/cover-letter"
              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <Mail className="w-5 h-5" />
              Cover Letter
            </Link>
            <Link
              href="/dashboard/cover-letters"
              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <Mail className="w-5 h-5" />
              Saved Letters
            </Link>

            <div className="px-3 py-2 mt-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Track
            </div>
            <Link
              href="/dashboard/applications"
              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <Send className="w-5 h-5" />
              Applications
            </Link>
            <Link
              href="/dashboard/outputs"
              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <FolderOpen className="w-5 h-5" />
              Outputs
            </Link>
            
            <div className="px-3 py-2 mt-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Account
            </div>
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <Settings className="w-5 h-5" />
              Settings
            </Link>
          </nav>

          <main className="md:col-span-3">{children}</main>
        </div>
      </div>
    </div>
  );
}
