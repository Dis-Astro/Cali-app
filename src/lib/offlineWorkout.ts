import { supabase } from "@/integrations/supabase/client";
import { setOfflineCache } from "@/lib/offlineSync";

export interface OfflineWorkoutPlan {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  coach_notes: string | null;
  status?: string;
  plan_type?: string;
}

export interface OfflineWorkoutVideo {
  id: string;
  title: string;
  video_url: string;
}

export interface OfflineCoachNote {
  id: string;
  note: string | null;
  rating: number | null;
  workout_plan_exercise_id: string;
}

export interface OfflineWorkoutWeek {
  id?: string;
  week_number: number;
  client_notes: string;
  difficulty_rating: number;
  saved: boolean;
  pending?: boolean;
}

export interface OfflineWorkoutExercise {
  id: string;
  notes: string | null;
  rest_seconds: number | null;
  order_index: number;
  exercise_name: string | null;
  video: OfflineWorkoutVideo | null;
  coachTestNote?: OfflineCoachNote;
  weekCompletions: OfflineWorkoutWeek[];
}

export interface OfflineWorkoutDaySnapshot {
  plan: OfflineWorkoutPlan;
  exercises: OfflineWorkoutExercise[];
  currentWeek: number;
  totalWeeks: number;
}

export interface OfflineWorkoutDaySummary {
  day_of_week: number;
  exercise_count: number;
  completed_count: number;
}

export interface OfflineWorkoutPlanSnapshot {
  activePlan: OfflineWorkoutPlan;
  dayExercises: OfflineWorkoutDaySummary[];
}

type CompletionRow = {
  id: string;
  workout_plan_exercise_id: string;
  set_number: number;
  client_notes: string | null;
  difficulty_rating: number | null;
};

type ExerciseRow = {
  id: string;
  notes: string | null;
  rest_seconds: number | null;
  order_index: number;
  day_of_week: number | null;
  exercise_name: string | null;
  video: OfflineWorkoutVideo | OfflineWorkoutVideo[] | null;
};

export const workoutPlanCacheKey = (userId: string, requestedPlanId?: string | null) =>
  `workout-plan-days:${userId}:${requestedPlanId || "active"}`;

export const workoutDayCacheKey = (userId: string, dayNumber: number, requestedPlanId?: string | null) =>
  `workout-day:${userId}:${requestedPlanId || "active"}:${dayNumber}`;

export const calculateTotalWeeks = (startDate: string, endDate: string) =>
  Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 604800000));

export const calculateCurrentWeek = (startDate: string, endDate: string) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const reference = new Date() > end ? end : new Date();
  return Math.max(1, Math.floor((reference.getTime() - start.getTime()) / 604800000) + 1);
};

function normalizeVideo(video: ExerciseRow["video"]): OfflineWorkoutVideo | null {
  if (Array.isArray(video)) return video[0] || null;
  return video;
}

export async function downloadWorkoutPlanForOffline(
  userId: string,
  requestedPlanId?: string | null,
): Promise<OfflineWorkoutPlanSnapshot | null> {
  const today = new Date().toISOString().split("T")[0];
  let selectedPlan: OfflineWorkoutPlan | null = null;

  if (requestedPlanId) {
    const { data, error } = await supabase
      .from("workout_plans")
      .select("id, name, description, start_date, end_date, coach_notes, status, plan_type")
      .eq("client_id", userId)
      .eq("id", requestedPlanId)
      .is("deleted_at" as never, null)
      .maybeSingle();
    if (error) throw error;
    selectedPlan = data as OfflineWorkoutPlan | null;
  } else {
    const { data, error } = await supabase
      .from("workout_plans")
      .select("id, name, description, start_date, end_date, coach_notes, status, plan_type")
      .eq("client_id", userId)
      .is("deleted_at" as never, null)
      .lte("start_date", today)
      .gte("end_date", today)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    selectedPlan = (data?.[0] || null) as OfflineWorkoutPlan | null;

    if (!selectedPlan) {
      const { data: recent, error: recentError } = await supabase
        .from("workout_plans")
        .select("id, name, description, start_date, end_date, coach_notes, status, plan_type")
        .eq("client_id", userId)
        .is("deleted_at" as never, null)
        .order("end_date", { ascending: false })
        .limit(1);
      if (recentError) throw recentError;
      selectedPlan = (recent?.[0] || null) as OfflineWorkoutPlan | null;
    }
  }

  if (!selectedPlan) return null;

  const { data: exerciseData, error: exerciseError } = await supabase
    .from("workout_plan_exercises")
    .select("id, notes, rest_seconds, order_index, day_of_week, exercise_name, video:exercise_videos(id, title, video_url)")
    .eq("workout_plan_id", selectedPlan.id)
    .order("day_of_week")
    .order("order_index");
  if (exerciseError) throw exerciseError;

  const exerciseRows = (exerciseData || []) as unknown as ExerciseRow[];
  const exerciseIds = exerciseRows.map((exercise) => exercise.id);
  const [completionResult, coachNoteResult] = exerciseIds.length
    ? await Promise.all([
        supabase
          .from("workout_completions")
          .select("id, workout_plan_exercise_id, set_number, client_notes, difficulty_rating")
          .eq("client_id", userId)
          .in("workout_plan_exercise_id", exerciseIds),
        supabase
          .from("coach_test_notes")
          .select("id, note, rating, workout_plan_exercise_id")
          .in("workout_plan_exercise_id", exerciseIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  if (completionResult.error) throw completionResult.error;
  if (coachNoteResult.error) throw coachNoteResult.error;

  const completions = (completionResult.data || []) as CompletionRow[];
  const coachNotes = (coachNoteResult.data || []) as OfflineCoachNote[];
  const totalWeeks = calculateTotalWeeks(selectedPlan.start_date, selectedPlan.end_date);
  const currentWeek = Math.min(calculateCurrentWeek(selectedPlan.start_date, selectedPlan.end_date), totalWeeks);
  const days = new Map<number, ExerciseRow[]>();

  exerciseRows.forEach((exercise) => {
    const day = exercise.day_of_week || 1;
    const entries = days.get(day) || [];
    entries.push(exercise);
    days.set(day, entries);
  });

  const dayExercises: OfflineWorkoutDaySummary[] = [];
  await Promise.all(
    Array.from(days.entries()).map(async ([dayNumber, dayRows]) => {
      const normalizedExercises: OfflineWorkoutExercise[] = dayRows.map((exercise) => {
        const weekCompletions = Array.from({ length: totalWeeks }, (_, index): OfflineWorkoutWeek => {
          const weekNumber = index + 1;
          const existing = completions.find(
            (completion) =>
              completion.workout_plan_exercise_id === exercise.id && completion.set_number === weekNumber,
          );
          return {
            id: existing?.id,
            week_number: weekNumber,
            client_notes: existing?.client_notes || "",
            difficulty_rating: existing?.difficulty_rating || 0,
            saved: Boolean(existing),
          };
        });

        return {
          id: exercise.id,
          notes: exercise.notes,
          rest_seconds: exercise.rest_seconds,
          order_index: exercise.order_index,
          exercise_name: exercise.exercise_name || "Esercizio",
          video: normalizeVideo(exercise.video),
          coachTestNote: coachNotes.find((note) => note.workout_plan_exercise_id === exercise.id),
          weekCompletions,
        };
      });

      const completedCount = normalizedExercises.filter((exercise) =>
        exercise.weekCompletions.some((week) => week.saved),
      ).length;
      dayExercises.push({
        day_of_week: dayNumber,
        exercise_count: normalizedExercises.length,
        completed_count: completedCount,
      });

      const daySnapshot: OfflineWorkoutDaySnapshot = {
        plan: selectedPlan,
        exercises: normalizedExercises,
        currentWeek,
        totalWeeks,
      };
      await setOfflineCache(workoutDayCacheKey(userId, dayNumber, requestedPlanId), daySnapshot);
    }),
  );

  dayExercises.sort((a, b) => a.day_of_week - b.day_of_week);
  const planSnapshot: OfflineWorkoutPlanSnapshot = { activePlan: selectedPlan, dayExercises };
  await setOfflineCache(workoutPlanCacheKey(userId, requestedPlanId), planSnapshot);
  return planSnapshot;
}
