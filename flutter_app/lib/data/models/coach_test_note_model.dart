class CoachTestNoteModel {
  const CoachTestNoteModel({
    required this.id,
    required this.workoutPlanExerciseId,
    required this.coachId,
    this.note,
    this.rating,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String workoutPlanExerciseId;
  final String coachId;
  final String? note;
  final int? rating;
  final String? createdAt;
  final String? updatedAt;

  bool get hasContent =>
      (note?.trim().isNotEmpty ?? false) || (rating ?? 0) > 0;

  factory CoachTestNoteModel.fromJson(Map<String, dynamic> json) {
    return CoachTestNoteModel(
      id: json['id'] as String,
      workoutPlanExerciseId: json['workout_plan_exercise_id'] as String,
      coachId: json['coach_id'] as String,
      note: json['note'] as String?,
      rating: json['rating'] as int?,
      createdAt: json['created_at'] as String?,
      updatedAt: json['updated_at'] as String?,
    );
  }

  factory CoachTestNoteModel.fromDb(Map<String, Object?> row) {
    return CoachTestNoteModel(
      id: row['id'] as String,
      workoutPlanExerciseId: row['workout_plan_exercise_id'] as String,
      coachId: row['coach_id'] as String,
      note: row['note'] as String?,
      rating: row['rating'] as int?,
      createdAt: row['created_at'] as String?,
      updatedAt: row['updated_at'] as String?,
    );
  }

  Map<String, Object?> toDb() {
    return {
      'id': id,
      'workout_plan_exercise_id': workoutPlanExerciseId,
      'coach_id': coachId,
      'note': note,
      'rating': rating,
      'created_at': createdAt,
      'updated_at': updatedAt,
    };
  }
}
