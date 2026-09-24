"use client";

import { useParams } from "next/navigation";
import OrdersView from "../OrdersView";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <OrdersView orderId={id} />;
}
