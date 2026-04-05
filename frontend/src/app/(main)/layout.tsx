import SiteShell from "../../components/layout/SiteShell";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SiteShell>{children}</SiteShell>;
}