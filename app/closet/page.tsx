import ClosetApp from "./closet-app";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Your Closet — WERA",
  description:
    "Add your clothes, choose an occasion, and create an outfit from what you own.",
  alternates: { canonical: "/closet" },
};
export default async function ClosetPage({
  searchParams,
}: {
  searchParams: Promise<{ embed?: string }>;
}) {
  const embedded = (await searchParams).embed === "1";
  return (
    <main
      style={{
        maxWidth: 1400,
        margin: "0 auto",
        padding: embedded ? "0" : "24px 16px",
      }}
    >
      <ClosetApp standalone={!embedded} />
    </main>
  );
}
