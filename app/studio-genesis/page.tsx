import { StudioWorkspace } from "@/components/studio-workspace";
import { AuthGuard } from "@/components/auth-guard";

export default function StudioGenesis() {
  return (
    <AuthGuard>
      <StudioWorkspace initialMode="genesis" />
    </AuthGuard>
  );
}
