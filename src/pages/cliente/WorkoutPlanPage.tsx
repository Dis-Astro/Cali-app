import { useParams } from "react-router-dom";
import ClientLayout from "@/components/coaching/ClientLayout";
import WorkoutPlanDays from "@/components/coaching/WorkoutPlanDays";
import OfflineWorkoutDayDetail from "@/components/coaching/OfflineWorkoutDayDetail";

const WorkoutPlanPage = () => {
  const { dayId } = useParams<{ dayId: string }>();

  if (dayId) {
    return (
      <ClientLayout title={`GIORNO ${dayId}`}>
        <OfflineWorkoutDayDetail />
      </ClientLayout>
    );
  }

  return (
    <ClientLayout title="LA MIA SCHEDA">
      <WorkoutPlanDays />
    </ClientLayout>
  );
};

export default WorkoutPlanPage;
