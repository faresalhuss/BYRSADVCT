import { AppShell } from "@/components/shell";
import { signOut } from "@/app/login/actions";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell signOutAction={signOut}>{children}</AppShell>;
}
