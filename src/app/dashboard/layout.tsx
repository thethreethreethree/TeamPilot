import Sidebar from "@/components/layout/Sidebar";
import CommandPalette from "@/components/layout/CommandPalette";
import { ToastProvider } from "@/components/ui/toast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-[#0c0d16]">
        <Sidebar />
        <main className="flex-1 ml-64 min-h-screen overflow-x-hidden">
          {children}
        </main>
        <CommandPalette />
      </div>
    </ToastProvider>
  );
}
