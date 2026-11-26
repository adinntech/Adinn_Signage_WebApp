import { ShopApprovalDetail } from "@/components/project-approval/shop-review";

// Renders only after the client-side sign-in check in AppShell, so it cannot be prerendered.
export const instant = false;

export default async function Page({ params }: { params: Promise<{ projectId: string; shopId: string }> }) {
  const { projectId, shopId } = await params;
  return <ShopApprovalDetail projectId={projectId} siteId={shopId} />;
}
