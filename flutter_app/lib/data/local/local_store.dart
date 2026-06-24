import 'package:sqflite/sqflite.dart';
import 'package:uuid/uuid.dart';

import '../models/coach_test_note_model.dart';
import '../models/exercise_video_model.dart';
import '../models/profile_model.dart';
import '../models/workout_completion_model.dart';
import '../models/workout_exercise_model.dart';
import '../models/workout_plan_model.dart';
import 'app_database.dart';

class LocalStore {
  LocalStore(this._database);

  final AppDatabase _database;
  final _uuid = const Uuid();

  Future<Database> get _db => _database.database;

  Future<void> cacheProfile(ProfileModel profile) async {
    final db = await _db;
    await db.insert(
      'profiles',
      profile.toDb(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<ProfileModel?> profile(String userId) async {
    final db = await _db;
    final rows = await db.query(
      'profiles',
      where: 'user_id = ?',
      whereArgs: [userId],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return ProfileModel.fromDb(rows.first);
  }

  Future<void> cachePlans(List<WorkoutPlanModel> plans) async {
    final db = await _db;
    final batch = db.batch();
    for (final plan in plans) {
      batch.insert(
        'workout_plans',
        plan.toDb(),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  Future<List<WorkoutPlanModel>> plansForUser(String userId) async {
    final db = await _db;
    final rows = await db.query(
      'workout_plans',
      where: 'client_id = ? AND deleted_at IS NULL',
      whereArgs: [userId],
      orderBy: 'end_date DESC, created_at DESC',
    );
    return rows.map(WorkoutPlanModel.fromDb).toList();
  }

  Future<WorkoutPlanModel?> planById(String planId) async {
    final db = await _db;
    final rows = await db.query(
      'workout_plans',
      where: 'id = ?',
      whereArgs: [planId],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return WorkoutPlanModel.fromDb(rows.first);
  }

  Future<void> cacheExercises(List<WorkoutExerciseModel> exercises) async {
    final db = await _db;
    final batch = db.batch();
    for (final exercise in exercises) {
      batch.insert(
        'workout_plan_exercises',
        exercise.toDb(),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  Future<List<WorkoutExerciseModel>> exercisesForPlan(String planId) async {
    final db = await _db;
    final rows = await db.query(
      'workout_plan_exercises',
      where: 'workout_plan_id = ?',
      whereArgs: [planId],
      orderBy: 'day_of_week ASC, order_index ASC',
    );
    return rows.map(WorkoutExerciseModel.fromDb).toList();
  }

  Future<List<WorkoutExerciseModel>> exercisesForDay({
    required String planId,
    required int day,
  }) async {
    final db = await _db;
    final rows = await db.query(
      'workout_plan_exercises',
      where: 'workout_plan_id = ? AND day_of_week = ?',
      whereArgs: [planId, day],
      orderBy: 'order_index ASC',
    );
    return rows.map(WorkoutExerciseModel.fromDb).toList();
  }

  Future<void> cacheVideos(List<ExerciseVideoModel> videos) async {
    final db = await _db;
    final batch = db.batch();
    for (final video in videos) {
      batch.insert(
        'exercise_videos',
        video.toDb(),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  Future<Map<String, ExerciseVideoModel>> videosByIds(List<String> ids) async {
    if (ids.isEmpty) return {};
    final db = await _db;
    final rows = await db.query(
      'exercise_videos',
      where: 'id IN (${_placeholders(ids.length)})',
      whereArgs: ids,
    );
    return {
      for (final row in rows)
        row['id'] as String: ExerciseVideoModel.fromDb(row),
    };
  }

  Future<void> cacheCoachNotes(List<CoachTestNoteModel> notes) async {
    final db = await _db;
    final batch = db.batch();
    for (final note in notes) {
      batch.insert(
        'coach_test_notes',
        note.toDb(),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  Future<Map<String, CoachTestNoteModel>> coachNotesForExercises(
    List<String> exerciseIds,
  ) async {
    if (exerciseIds.isEmpty) return {};
    final db = await _db;
    final rows = await db.query(
      'coach_test_notes',
      where:
          'workout_plan_exercise_id IN (${_placeholders(exerciseIds.length)})',
      whereArgs: exerciseIds,
    );
    return {
      for (final row in rows)
        row['workout_plan_exercise_id'] as String:
            CoachTestNoteModel.fromDb(row),
    };
  }

  Future<void> cacheRemoteCompletions(
    List<WorkoutCompletionModel> completions,
  ) async {
    final db = await _db;
    final batch = db.batch();
    for (final completion in completions) {
      final existing = await _completionByUnique(
        completion.workoutPlanExerciseId,
        completion.clientId,
        completion.setNumber,
      );
      if (existing?.pendingSync == true) continue;
      batch.insert(
        'workout_completions',
        completion.toDb(),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  Future<List<WorkoutCompletionModel>> completionsForExercises({
    required String clientId,
    required List<String> exerciseIds,
  }) async {
    if (exerciseIds.isEmpty) return [];
    final db = await _db;
    final rows = await db.query(
      'workout_completions',
      where:
          'client_id = ? AND workout_plan_exercise_id IN (${_placeholders(exerciseIds.length)})',
      whereArgs: [clientId, ...exerciseIds],
      orderBy: 'set_number ASC',
    );
    return rows.map(WorkoutCompletionModel.fromDb).toList();
  }

  Future<int> pendingCount(String clientId) async {
    final db = await _db;
    final result = Sqflite.firstIntValue(await db.rawQuery(
      'SELECT COUNT(*) FROM workout_completions WHERE client_id = ? AND pending_sync = 1',
      [clientId],
    ));
    return result ?? 0;
  }

  Future<List<WorkoutCompletionModel>> pendingCompletions(
    String clientId,
  ) async {
    final db = await _db;
    final rows = await db.query(
      'workout_completions',
      where: 'client_id = ? AND pending_sync = 1',
      whereArgs: [clientId],
      orderBy: 'completed_at ASC',
    );
    return rows.map(WorkoutCompletionModel.fromDb).toList();
  }

  Future<WorkoutCompletionModel> upsertPendingCompletion({
    required String exerciseId,
    required String clientId,
    required int weekNumber,
    required String notes,
    required int rating,
  }) async {
    final existing =
        await _completionByUnique(exerciseId, clientId, weekNumber);
    final completion = WorkoutCompletionModel(
      localId: existing?.localId ?? _uuid.v4(),
      remoteId: existing?.remoteId,
      workoutPlanExerciseId: exerciseId,
      clientId: clientId,
      setNumber: weekNumber,
      completedAt: DateTime.now().toIso8601String(),
      clientNotes: notes,
      difficultyRating: rating > 0 ? rating : null,
      pendingSync: true,
    );

    final db = await _db;
    await db.insert(
      'workout_completions',
      completion.toDb(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
    return completion;
  }

  Future<void> markCompletionSynced({
    required String localId,
    required String remoteId,
  }) async {
    final db = await _db;
    await db.update(
      'workout_completions',
      {
        'remote_id': remoteId,
        'pending_sync': 0,
        'sync_error': null,
      },
      where: 'local_id = ?',
      whereArgs: [localId],
    );
  }

  Future<void> markCompletionSyncError({
    required String localId,
    required String error,
  }) async {
    final db = await _db;
    await db.update(
      'workout_completions',
      {'sync_error': error},
      where: 'local_id = ?',
      whereArgs: [localId],
    );
  }

  Future<void> setMeta(String key, String value) async {
    final db = await _db;
    await db.insert(
      'sync_meta',
      {'key': key, 'value': value},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<String?> meta(String key) async {
    final db = await _db;
    final rows = await db.query(
      'sync_meta',
      where: 'key = ?',
      whereArgs: [key],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return rows.first['value'] as String?;
  }

  Future<WorkoutCompletionModel?> _completionByUnique(
    String exerciseId,
    String clientId,
    int setNumber,
  ) async {
    final db = await _db;
    final rows = await db.query(
      'workout_completions',
      where:
          'workout_plan_exercise_id = ? AND client_id = ? AND set_number = ?',
      whereArgs: [exerciseId, clientId, setNumber],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return WorkoutCompletionModel.fromDb(rows.first);
  }

  String _placeholders(int count) => List.filled(count, '?').join(',');
}
