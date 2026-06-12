import { StudioWorkspace } from "@/components/studio-workspace";
import { AuthGuard } from "@/components/auth-guard";

export default function EcomStudio() {
  return (
    <AuthGuard>
      <StudioWorkspace initialMode="detail" />
    </AuthGuard>
  );
}
