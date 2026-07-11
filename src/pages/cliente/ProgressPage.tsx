import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import ClientLayout from "@/components/coaching/ClientLayout";
import OfflineClientProgressView from "@/components/coaching/OfflineClientProgressView";

const ProgressPage = () => {
  const { profile } = useAuth();

  return (
    <ClientLayout title="I MIEI PROGRESSI">
      {!profile?.user_id ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <OfflineClientProgressView clientId={profile.user_id} />
      )}
    </ClientLayout>
  );
};

export default ProgressPage;
