import { Suspense } from "react";
import ReturnDetails from "@/app/return-details";

export const metadata = {
  title: "Return details | ReturnDesk",
  description: "Review and manage a return request in ReturnDesk.",
};

async function ReturnDetailsContent({ params }) {
  const { identifier } = await params;
  return <ReturnDetails identifier={identifier} />;
}

export default function ReturnDetailsPage({ params }) {
  return (
    <Suspense fallback={
      <main className="dashboard-shell">
        <section aria-live="polite" className="detail-state-card">
          <span aria-hidden="true" className="loading-mark" />Loading request details…
        </section>
      </main>
    }>
      <ReturnDetailsContent params={params} />
    </Suspense>
  );
}
