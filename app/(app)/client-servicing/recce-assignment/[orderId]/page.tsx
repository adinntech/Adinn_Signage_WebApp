import { RecceAssignment } from "@/components/client-servicing/recce-assignment";

export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <RecceAssignment orderId={orderId} />;
}
