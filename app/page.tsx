"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) {
      router.push("/products");
    } else {
      router.push("/login");
    }
  }, [router]);

  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h1>Redirecting...</h1>
    </div>
  );
}
