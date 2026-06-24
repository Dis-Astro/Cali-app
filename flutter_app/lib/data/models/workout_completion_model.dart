class WorkoutCompletionModel {
  const WorkoutCompletionModel({
    required this.localId,
    required this.workoutPlanExerciseId,
    required this.clientId,
    required this.setNumber,
    required this.completedAt,
    required this.pendingSync,
    this.remoteId,
    this.clientNotes,
    this.difficultyRating,
    this.syncError,
  });

  final String localId;
  final String? remoteId;
  final String workoutPlanExerciseId;
  final String clientId;
  final int setNumber;
  final String completedAt;
  final String? clientNotes;
  final int? difficultyRating;
  final bool pendingSync;
  final String? syncError;

  bool get saved => !pendingSync;

  factory WorkoutCompletionModel.fromJson(Map<String, dynamic> json) {
    final id = json['id'] as String;
    return WorkoutCompletionModel(
      localId: id,
      remoteId: id,
      workoutPlanExerciseId: json['workout_plan_exercise_id'] as String,
      clientId: json['client_id'] as String,
      setNumber: (json['set_number'] ?? 1) as int,
      completedAt:
          (json['completed_at'] ?? DateTime.now().toIso8601String()) as String,
      clientNotes: json['client_notes'] as String?,
      difficultyRating: json['difficulty_rating'] as int?,
      pendingSync: false,
    );
  }

  factory WorkoutCompletionModel.fromDb(Map<String, Object?> row) {
    return WorkoutCompletionModel(
      localId: row['local_id'] as String,
      remoteId: row['remote_id'] as String?,
      workoutPlanExerciseId: row['workout_plan_exercise_id'] as String,
      clientId: row['client_id'] as String,
      setNumber: (row['set_number'] ?? 1) as int,
      completedAt:
          (row['completed_at'] ?? DateTime.now().toIso8601String()) as String,
      clientNotes: row['client_notes'] as String?,
      difficultyRating: row['difficulty_rating'] as int?,
      pendingSync: row['pending_sync'] == 1,
      syncError: row['sync_error'] as String?,
    );
  }

  Map<String, Object?> toDb() {
    return {
      'local_id': localId,
      'remote_id': remoteId,
      'workout_plan_exercise_id': workoutPlanExerciseId,
      'client_id': clientId,
      'set_number': setNumber,
      'completed_at': completedAt,
      'client_notes': clientNotes,
      'difficulty_rating': difficultyRating,
      'pending_sync': pendingSync ? 1 : 0,
      'sync_error': syncError,
    };
  }

  Map<String, Object?> toPayload() {
    return {
      'workout_plan_exercise_id': workoutPlanExerciseId,
      'client_id': clientId,
      'set_number': setNumber,
      'completed_at': completedAt,
      'client_notes': clientNotes,
      'difficulty_rating': difficultyRating,
    };
  }

  WorkoutCompletionModel copyWith({
    String? localId,
    String? remoteId,
    String? workoutPlanExerciseId,
    String? clientId,
    int? setNumber,
    String? completedAt,
    String? clientNotes,
    int? difficultyRating,
    bool? pendingSync,
    String? syncError,
  }) {
    return WorkoutCompletionModel(
      localId: localId ?? this.localId,
      remoteId: remoteId ?? this.remoteId,
      workoutPlanExerciseId:
          workoutPlanExerciseId ?? this.workoutPlanExerciseId,
      clientId: clientId ?? this.clientId,
      setNumber: setNumber ?? this.setNumber,
      completedAt: completedAt ?? this.completedAt,
      clientNotes: clientNotes ?? this.clientNotes,
      difficultyRating: difficultyRating ?? this.difficultyRating,
      pendingSync: pendingSync ?? this.pendingSync,
      syncError: syncError,
    );
  }
}
