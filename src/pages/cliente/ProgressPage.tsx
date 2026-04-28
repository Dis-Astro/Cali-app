import { useAuth } from "@/hooks/useAuth";
import ClientLayout from "@/components/coaching/ClientLayout";
import ClientProgressView from "@/components/coaching/ClientProgressView";
import { Loader2 } from "lucide-react";

const ProgressPage = () => {
  const { profile } = useAuth();

  return (
    <ClientLayout title="I MIEI PROGRESSI">
      {!profile?.user_id ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <ClientProgressView clientId={profile.user_id} />
      )}
    </ClientLayout>
  );
};

export default ProgressPage;
