import { Suspense } from "react";
import { CreateProject } from "@/components/client-servicing/create-project";

export default function Page() {
  return (
    <Suspense>
      <CreateProject />
    </Suspense>
  );
}
