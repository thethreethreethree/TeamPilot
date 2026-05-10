import Sidebar from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#0c0d16]">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
