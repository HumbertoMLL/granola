import { notFound } from "next/navigation";
import { UIShowcase } from "./showcase";

export default function UIPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <UIShowcase />;
}
