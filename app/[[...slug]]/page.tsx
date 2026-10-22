import { Suspense } from "react";
import { RetailApp } from "@/components/retail-app";

export default function Page() {
  return <Suspense fallback={<div className="app-loading"><strong>Everyday Essentials</strong><span>Loading your workspace…</span></div>}><RetailApp /></Suspense>;
}
