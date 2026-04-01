import SiteShell from "../components/SiteShell";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SiteShell>{children}</SiteShell>;
}