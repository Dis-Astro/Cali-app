class WorkoutExerciseModel {
  const WorkoutExerciseModel({
    required this.id,
    required this.workoutPlanId,
    required this.orderIndex,
    this.exerciseId,
    this.videoId,
    this.dayOfWeek,
    this.sets,
    this.reps,
    this.restSeconds,
    this.notes,
    this.exerciseName,
    this.createdAt,
  });

  final String id;
  final String workoutPlanId;
  final String? exerciseId;
  final String? videoId;
  final int? dayOfWeek;
  final int orderIndex;
  final int? sets;
  final String? reps;
  final int? restSeconds;
  final String? notes;
  final String? exerciseName;
  final String? createdAt;

  String get displayName {
    final value = exerciseName?.trim();
    return value == null || value.isEmpty ? 'Esercizio' : value;
  }

  factory WorkoutExerciseModel.fromJson(Map<String, dynamic> json) {
    return WorkoutExerciseModel(
      id: json['id'] as String,
      workoutPlanId: json['workout_plan_id'] as String,
      exerciseId: json['exercise_id'] as String?,
      videoId: json['video_id'] as String?,
      dayOfWeek: json['day_of_week'] as int?,
      orderIndex: (json['order_index'] ?? 0) as int,
      sets: json['sets'] as int?,
      reps: json['reps'] as String?,
      restSeconds: json['rest_seconds'] as int?,
      notes: json['notes'] as String?,
      exerciseName: json['exercise_name'] as String?,
      createdAt: json['created_at'] as String?,
    );
  }

  factory WorkoutExerciseModel.fromDb(Map<String, Object?> row) {
    return WorkoutExerciseModel(
      id: row['id'] as String,
      workoutPlanId: row['workout_plan_id'] as String,
      exerciseId: row['exercise_id'] as String?,
      videoId: row['video_id'] as String?,
      dayOfWeek: row['day_of_week'] as int?,
      orderIndex: (row['order_index'] ?? 0) as int,
      sets: row['sets'] as int?,
      reps: row['reps'] as String?,
      restSeconds: row['rest_seconds'] as int?,
      notes: row['notes'] as String?,
      exerciseName: row['exercise_name'] as String?,
      createdAt: row['created_at'] as String?,
    );
  }

  Map<String, Object?> toDb() {
    return {
      'id': id,
      'workout_plan_id': workoutPlanId,
      'exercise_id': exerciseId,
      'video_id': videoId,
      'day_of_week': dayOfWeek,
      'order_index': orderIndex,
      'sets': sets,
      'reps': reps,
      'rest_seconds': restSeconds,
      'notes': notes,
      'exercise_name': exerciseName,
      'created_at': createdAt,
    };
  }
}
