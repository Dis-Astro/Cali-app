class WorkoutPlanModel {
  const WorkoutPlanModel({
    required this.id,
    required this.clientId,
    required this.coachId,
    required this.name,
    required this.startDate,
    required this.endDate,
    required this.isActive,
    required this.planType,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    this.description,
    this.coachNotes,
    this.deletedAt,
    this.pausedAt,
    this.totalPausedDays = 0,
    this.testReminderDays = 0,
    this.reminderAppointmentId,
  });

  final String id;
  final String clientId;
  final String coachId;
  final String name;
  final String? description;
  final String startDate;
  final String endDate;
  final bool isActive;
  final String? coachNotes;
  final String planType;
  final String status;
  final String createdAt;
  final String updatedAt;
  final String? deletedAt;
  final String? pausedAt;
  final int totalPausedDays;
  final int testReminderDays;
  final String? reminderAppointmentId;

  bool get isDeleted => deletedAt != null;
  bool get isPaused => status == 'in_pausa';
  bool get isTest => planType == 'test';

  bool get isExpired {
    final end = DateTime.tryParse(endDate);
    if (end == null) return false;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final endOnly = DateTime(end.year, end.month, end.day);
    return today.isAfter(endOnly);
  }

  bool get isInCurrentRange {
    final start = DateTime.tryParse(startDate);
    final end = DateTime.tryParse(endDate);
    if (start == null || end == null) return false;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final startOnly = DateTime(start.year, start.month, start.day);
    final endOnly = DateTime(end.year, end.month, end.day);
    return !today.isBefore(startOnly) && !today.isAfter(endOnly);
  }

  factory WorkoutPlanModel.fromJson(Map<String, dynamic> json) {
    return WorkoutPlanModel(
      id: json['id'] as String,
      clientId: json['client_id'] as String,
      coachId: json['coach_id'] as String,
      name: (json['name'] ?? 'Scheda') as String,
      description: json['description'] as String?,
      startDate: (json['start_date'] ?? '') as String,
      endDate: (json['end_date'] ?? '') as String,
      isActive: (json['is_active'] ?? true) as bool,
      coachNotes: json['coach_notes'] as String?,
      planType: (json['plan_type'] ?? 'workout_plan') as String,
      status: (json['status'] ?? 'attiva') as String,
      createdAt: (json['created_at'] ?? '') as String,
      updatedAt: (json['updated_at'] ?? '') as String,
      deletedAt: json['deleted_at'] as String?,
      pausedAt: json['paused_at'] as String?,
      totalPausedDays: (json['total_paused_days'] ?? 0) as int,
      testReminderDays: (json['test_reminder_days'] ?? 0) as int,
      reminderAppointmentId: json['reminder_appointment_id'] as String?,
    );
  }

  factory WorkoutPlanModel.fromDb(Map<String, Object?> row) {
    return WorkoutPlanModel(
      id: row['id'] as String,
      clientId: row['client_id'] as String,
      coachId: row['coach_id'] as String,
      name: (row['name'] ?? 'Scheda') as String,
      description: row['description'] as String?,
      startDate: (row['start_date'] ?? '') as String,
      endDate: (row['end_date'] ?? '') as String,
      isActive: row['is_active'] == 1,
      coachNotes: row['coach_notes'] as String?,
      planType: (row['plan_type'] ?? 'workout_plan') as String,
      status: (row['status'] ?? 'attiva') as String,
      createdAt: (row['created_at'] ?? '') as String,
      updatedAt: (row['updated_at'] ?? '') as String,
      deletedAt: row['deleted_at'] as String?,
      pausedAt: row['paused_at'] as String?,
      totalPausedDays: (row['total_paused_days'] ?? 0) as int,
      testReminderDays: (row['test_reminder_days'] ?? 0) as int,
      reminderAppointmentId: row['reminder_appointment_id'] as String?,
    );
  }

  Map<String, Object?> toDb() {
    return {
      'id': id,
      'client_id': clientId,
      'coach_id': coachId,
      'name': name,
      'description': description,
      'start_date': startDate,
      'end_date': endDate,
      'is_active': isActive ? 1 : 0,
      'coach_notes': coachNotes,
      'plan_type': planType,
      'status': status,
      'created_at': createdAt,
      'updated_at': updatedAt,
      'deleted_at': deletedAt,
      'paused_at': pausedAt,
      'total_paused_days': totalPausedDays,
      'test_reminder_days': testReminderDays,
      'reminder_appointment_id': reminderAppointmentId,
    };
  }
}
