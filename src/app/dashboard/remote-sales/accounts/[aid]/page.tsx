import { RemoteAccount } from "@/components/remote-sales/RemoteAccount";

/** Remote Sales → one account (revenue Phase 1, 0370): its timeline, deals and contacts. */
export default async function RemoteSalesAccountPage({ params }: { params: Promise<{ aid: string }> }) {
  const { aid } = await params;
  return <RemoteAccount id={aid} />;
}
