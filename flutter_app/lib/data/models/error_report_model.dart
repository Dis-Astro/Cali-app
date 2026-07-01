class ErrorReportModel {
  const ErrorReportModel({
    required this.id,
    required this.clientId,
    required this.coachId,
    required this.title,
    required this.description,
    this.status = 'aperta',
    this.exerciseId,
    this.workoutPlanId,
    this.reportedAt,
    this.resolvedAt,
    this.coachResponse,
    this.pendingSync = false,
  });

  final String id;
  final String clientId;
  final String coachId;
  final String title;
  final String description;
  final String status;
  final String? exerciseId;
  final String? workoutPlanId;
  final String? reportedAt;
  final String? resolvedAt;
  final String? coachResponse;
  final bool pendingSync;

  bool get isOpen => status == 'aperta';
  bool get isInProgress => status == 'in_lavorazione';
  bool get isResolved => status == 'risolta';
  bool get isClosed => status == 'chiusa';
  bool get hasCoachResponse =>
      coachResponse != null && coachResponse!.trim().isNotEmpty;

  factory ErrorReportModel.fromJson(Map<String, dynamic> json) {
    return ErrorReportModel(
      id: json['id'] as String,
      clientId: json['client_id'] as String,
      coachId: json['coach_id'] as String,
      title: (json['title'] ?? '') as String,
      description: (json['description'] ?? '') as String,
      status: (json['status'] ?? 'aperta') as String,
      exerciseId: json['exercise_id'] as String?,
      workoutPlanId: json['workout_plan_id'] as String?,
      reportedAt: json['reported_at'] as String?,
      resolvedAt: json['resolved_at'] as String?,
      coachResponse: json['coach_response'] as String?,
      pendingSync: false,
    );
  }

  factory ErrorReportModel.fromDb(Map<String, Object?> row) {
    return ErrorReportModel(
      id: row['id'] as String,
      clientId: row['client_id'] as String,
      coachId: row['coach_id'] as String,
      title: (row['title'] ?? '') as String,
      description: (row['description'] ?? '') as String,
      status: (row['status'] ?? 'aperta') as String,
      exerciseId: row['exercise_id'] as String?,
      workoutPlanId: row['workout_plan_id'] as String?,
      reportedAt: row['reported_at'] as String?,
      resolvedAt: row['resolved_at'] as String?,
      coachResponse: row['coach_response'] as String?,
      pendingSync: row['pending_sync'] == 1,
    );
  }

  Map<String, Object?> toDb() {
    return {
      'id': id,
      'client_id': clientId,
      'coach_id': coachId,
      'title': title,
      'description': description,
      'status': status,
      'exercise_id': exerciseId,
      'workout_plan_id': workoutPlanId,
      'reported_at': reportedAt,
      'resolved_at': resolvedAt,
      'coach_response': coachResponse,
      'pending_sync': pendingSync ? 1 : 0,
    };
  }

  Map<String, dynamic> toPayload() {
    return {
      'client_id': clientId,
      'coach_id': coachId,
      'title': title,
      'description': description,
      'exercise_id': exerciseId,
      'workout_plan_id': workoutPlanId,
    };
  }

  ErrorReportModel copyWith({
    String? id,
    String? clientId,
    String? coachId,
    String? title,
    String? description,
    String? status,
    String? exerciseId,
    String? workoutPlanId,
    String? reportedAt,
    String? resolvedAt,
    String? coachResponse,
    bool? pendingSync,
  }) {
    return ErrorReportModel(
      id: id ?? this.id,
      clientId: clientId ?? this.clientId,
      coachId: coachId ?? this.coachId,
      title: title ?? this.title,
      description: description ?? this.description,
      status: status ?? this.status,
      exerciseId: exerciseId ?? this.exerciseId,
      workoutPlanId: workoutPlanId ?? this.workoutPlanId,
      reportedAt: reportedAt ?? this.reportedAt,
      resolvedAt: resolvedAt ?? this.resolvedAt,
      coachResponse: coachResponse ?? this.coachResponse,
      pendingSync: pendingSync ?? this.pendingSync,
    );
  }
}
