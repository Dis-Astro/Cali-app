import { useParams } from "react-router-dom";
import ClientLayout from "@/components/coaching/ClientLayout";
import WorkoutPlanDays from "@/components/coaching/WorkoutPlanDays";
import WorkoutDayDetail from "@/components/coaching/WorkoutDayDetail";

const WorkoutPlanPage = () => {
  const { dayId } = useParams<{ dayId: string }>();

  // If dayId is present, show day detail, otherwise show days grid
  if (dayId) {
    return (
      <ClientLayout title={`GIORNO ${dayId}`}>
        <WorkoutDayDetail />
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
