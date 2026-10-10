import { createFileRoute } from "@tanstack/react-router";
import { Encourager } from "@/components/encourager";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <Encourager />;
}
