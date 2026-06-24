import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/utils/date_formatters.dart';
import '../../features/sync/sync_service.dart';
import '../local/local_store.dart';
import '../models/coach_test_note_model.dart';
import '../models/exercise_video_model.dart';
import '../models/workout_completion_model.dart';
import '../models/workout_exercise_model.dart';
import '../models/workout_plan_model.dart';

class WorkoutRepository {
  WorkoutRepository({
    required SupabaseClient client,
    required LocalStore localStore,
    required SyncService syncService,
  })  : _client = client,
        _localStore = localStore,
        _syncService = syncService;

  final SupabaseClient _client;
  final LocalStore _localStore;
  final SyncService _syncService;

  Future<void> refreshFromRemote(String userId) async {
    await _syncService.syncPendingCompletions(userId);

    final planRows = await _client
        .from('workout_plans')
        .select()
        .eq('client_id', userId)
        .order('end_date', ascending: false) as List<dynamic>;

    final plans = planRows
        .cast<Map<String, dynamic>>()
        .map(WorkoutPlanModel.fromJson)
        .toList();
    await _localStore.cachePlans(plans);

    final visiblePlans = plans.where((plan) => !plan.isDeleted).toList();
    final allExercises = <WorkoutExerciseModel>[];

    for (final plan in visiblePlans) {
      final exerciseRows = await _client
          .from('workout_plan_exercises')
          .select()
          .eq('workout_plan_id', plan.id)
          .order('order_index', ascending: true) as List<dynamic>;

      allExercises.addAll(
        exerciseRows
            .cast<Map<String, dynamic>>()
            .map(WorkoutExerciseModel.fromJson),
      );
    }

    await _localStore.cacheExercises(allExercises);

    final videoIds = allExercises
        .map((exercise) => exercise.videoId)
        .whereType<String>()
        .where((id) => id.isNotEmpty)
        .toSet()
        .toList();
    if (videoIds.isNotEmpty) {
      try {
        final videoRows = await _client
            .from('exercise_videos')
            .select('id,title,video_url,thumbnail_url,duration_seconds')
            .inFilter('id', videoIds) as List<dynamic>;
        await _localStore.cacheVideos(
          videoRows
              .cast<Map<String, dynamic>>()
              .map(ExerciseVideoModel.fromJson)
              .toList(),
        );
      } catch (_) {
        // Video are optional for the offline workout flow.
      }
    }

    final exerciseIds = allExercises.map((exercise) => exercise.id).toList();
    if (exerciseIds.isNotEmpty) {
      final completionRows = await _client
          .from('workout_completions')
          .select()
          .eq('client_id', userId)
          .inFilter('workout_plan_exercise_id', exerciseIds) as List<dynamic>;
      await _localStore.cacheRemoteCompletions(
        completionRows
            .cast<Map<String, dynamic>>()
            .map(WorkoutCompletionModel.fromJson)
            .toList(),
      );

      try {
        final noteRows = await _client
            .from('coach_test_notes')
            .select()
            .inFilter('workout_plan_exercise_id', exerciseIds) as List<dynamic>;
        await _localStore.cacheCoachNotes(
          noteRows
              .cast<Map<String, dynamic>>()
              .map(CoachTestNoteModel.fromJson)
              .toList(),
        );
      } catch (_) {
        // Older RLS policies may hide these notes; keep the rest of the app usable.
      }
    }

    await _localStore.setMeta(
      'last_sync_$userId',
      DateTime.now().toIso8601String(),
    );
  }

  Future<List<WorkoutPlanModel>> localPlans(String userId) {
    return _localStore.plansForUser(userId);
  }

  WorkoutPlanModel? displayPlan(List<WorkoutPlanModel> plans) {
    if (plans.isEmpty) return null;
    final current = plans.where((plan) => plan.isInCurrentRange).toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    if (current.isNotEmpty) return current.first;

    final recent = [...plans]..sort((a, b) => b.endDate.compareTo(a.endDate));
    return recent.first;
  }

  Future<List<WorkoutDaySummary>> daySummaries({
    required String planId,
    required String clientId,
  }) async {
    final exercises = await _localStore.exercisesForPlan(planId);
    final exerciseIds = exercises.map((exercise) => exercise.id).toList();
    final completions = await _localStore.completionsForExercises(
      clientId: clientId,
      exerciseIds: exerciseIds,
    );
    final completedExerciseIds = completions
        .where((completion) =>
            (completion.clientNotes?.isNotEmpty ?? false) ||
            (completion.difficultyRating ?? 0) > 0 ||
            completion.saved ||
            completion.pendingSync)
        .map((completion) => completion.workoutPlanExerciseId)
        .toSet();

    final grouped = <int, List<WorkoutExerciseModel>>{};
    for (final exercise in exercises) {
      final day = exercise.dayOfWeek ?? 1;
      grouped.putIfAbsent(day, () => []).add(exercise);
    }

    final summaries = grouped.entries.map((entry) {
      final total = entry.value.length;
      final done = entry.value
          .where((exercise) => completedExerciseIds.contains(exercise.id))
          .length;
      return WorkoutDaySummary(
        dayOfWeek: entry.key,
        exerciseCount: total,
        completedCount: done,
      );
    }).toList()
      ..sort((a, b) => a.dayOfWeek.compareTo(b.dayOfWeek));

    return summaries;
  }

  Future<DayDetailData?> dayDetail({
    required String planId,
    required String clientId,
    required int day,
  }) async {
    final plan = await _localStore.planById(planId);
    if (plan == null) return null;

    final exercises = await _localStore.exercisesForDay(
      planId: planId,
      day: day,
    );
    final exerciseIds = exercises.map((exercise) => exercise.id).toList();
    final videos = await _localStore.videosByIds(
      exercises
          .map((exercise) => exercise.videoId)
          .whereType<String>()
          .toList(),
    );
    final notes = await _localStore.coachNotesForExercises(exerciseIds);
    final completions = await _localStore.completionsForExercises(
      clientId: clientId,
      exerciseIds: exerciseIds,
    );

    final completionsByExercise = <String, List<WorkoutCompletionModel>>{};
    for (final completion in completions) {
      completionsByExercise
          .putIfAbsent(completion.workoutPlanExerciseId, () => [])
          .add(completion);
    }

    final weeks = totalWeeks(plan.startDate, plan.endDate);
    final activeWeek = currentWeek(plan.startDate, plan.endDate);

    final details = exercises.map((exercise) {
      final existing = completionsByExercise[exercise.id] ?? const [];
      final weekCompletions = <WeekCompletionDraft>[];

      for (var week = 1; week <= weeks; week++) {
        WorkoutCompletionModel? completion;
        for (final item in existing) {
          if (item.setNumber == week) {
            completion = item;
            break;
          }
        }
        weekCompletions.add(
          WeekCompletionDraft(
            localId: completion?.localId,
            remoteId: completion?.remoteId,
            weekNumber: week,
            notes: completion?.clientNotes ?? '',
            rating: completion?.difficultyRating ?? 0,
            saved: completion != null && !completion.pendingSync,
            pending: completion?.pendingSync ?? false,
          ),
        );
      }

      return ExerciseDetail(
        exercise: exercise,
        video: exercise.videoId == null ? null : videos[exercise.videoId],
        coachNote: notes[exercise.id],
        weeks: weekCompletions,
      );
    }).toList();

    return DayDetailData(
      plan: plan,
      dayNumber: day,
      currentWeek: activeWeek,
      totalWeeks: weeks,
      exercises: details,
    );
  }

  Future<void> saveCompletion({
    required String exerciseId,
    required String clientId,
    required int weekNumber,
    required String notes,
    required int rating,
  }) async {
    await _localStore.upsertPendingCompletion(
      exerciseId: exerciseId,
      clientId: clientId,
      weekNumber: weekNumber,
      notes: notes,
      rating: rating,
    );
  }

  Future<int> pendingCount(String clientId) {
    return _localStore.pendingCount(clientId);
  }
}

class WorkoutDaySummary {
  const WorkoutDaySummary({
    required this.dayOfWeek,
    required this.exerciseCount,
    required this.completedCount,
  });

  final int dayOfWeek;
  final int exerciseCount;
  final int completedCount;

  int get progress {
    if (exerciseCount == 0) return 0;
    return ((completedCount / exerciseCount) * 100).round();
  }

  bool get isComplete => exerciseCount > 0 && completedCount >= exerciseCount;
}

class DayDetailData {
  const DayDetailData({
    required this.plan,
    required this.dayNumber,
    required this.currentWeek,
    required this.totalWeeks,
    required this.exercises,
  });

  final WorkoutPlanModel plan;
  final int dayNumber;
  final int currentWeek;
  final int totalWeeks;
  final List<ExerciseDetail> exercises;
}

class ExerciseDetail {
  const ExerciseDetail({
    required this.exercise,
    required this.weeks,
    this.video,
    this.coachNote,
  });

  final WorkoutExerciseModel exercise;
  final ExerciseVideoModel? video;
  final CoachTestNoteModel? coachNote;
  final List<WeekCompletionDraft> weeks;
}

class WeekCompletionDraft {
  const WeekCompletionDraft({
    required this.weekNumber,
    required this.notes,
    required this.rating,
    required this.saved,
    required this.pending,
    this.localId,
    this.remoteId,
  });

  final String? localId;
  final String? remoteId;
  final int weekNumber;
  final String notes;
  final int rating;
  final bool saved;
  final bool pending;

  bool get hasContent =>
      notes.trim().isNotEmpty || rating > 0 || saved || pending;

  WeekCompletionDraft copyWith({
    String? notes,
    int? rating,
    bool? saved,
    bool? pending,
  }) {
    return WeekCompletionDraft(
      localId: localId,
      remoteId: remoteId,
      weekNumber: weekNumber,
      notes: notes ?? this.notes,
      rating: rating ?? this.rating,
      saved: saved ?? this.saved,
      pending: pending ?? this.pending,
    );
  }
}
