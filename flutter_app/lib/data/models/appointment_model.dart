class AppointmentModel {
  const AppointmentModel({
    required this.id,
    this.clientId,
    required this.coachId,
    required this.title,
    this.description,
    required this.startTime,
    required this.endTime,
    this.location,
    this.color,
    this.isRecurring = false,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String? clientId;
  final String coachId;
  final String title;
  final String? description;
  final String startTime;
  final String endTime;
  final String? location;
  final String? color;
  final bool isRecurring;
  final String? createdAt;
  final String? updatedAt;

  bool get isToday {
    final start = DateTime.tryParse(startTime);
    if (start == null) return false;
    final now = DateTime.now();
    return start.year == now.year &&
        start.month == now.month &&
        start.day == now.day;
  }

  bool get isPast {
    final end = DateTime.tryParse(endTime);
    if (end == null) return false;
    return end.isBefore(DateTime.now());
  }

  String get formattedTime {
    final start = DateTime.tryParse(startTime);
    final end = DateTime.tryParse(endTime);
    if (start == null || end == null) return '';
    final h1 = start.hour.toString().padLeft(2, '0');
    final m1 = start.minute.toString().padLeft(2, '0');
    final h2 = end.hour.toString().padLeft(2, '0');
    final m2 = end.minute.toString().padLeft(2, '0');
    return '$h1:$m1 - $h2:$m2';
  }

  factory AppointmentModel.fromJson(Map<String, dynamic> json) {
    return AppointmentModel(
      id: json['id'] as String,
      clientId: json['client_id'] as String?,
      coachId: json['coach_id'] as String,
      title: (json['title'] ?? '') as String,
      description: json['description'] as String?,
      startTime: (json['start_time'] ?? '') as String,
      endTime: (json['end_time'] ?? '') as String,
      location: json['location'] as String?,
      color: json['color'] as String?,
      isRecurring: (json['is_recurring'] ?? false) as bool,
      createdAt: json['created_at'] as String?,
      updatedAt: json['updated_at'] as String?,
    );
  }

  factory AppointmentModel.fromDb(Map<String, Object?> row) {
    return AppointmentModel(
      id: row['id'] as String,
      clientId: row['client_id'] as String?,
      coachId: row['coach_id'] as String,
      title: (row['title'] ?? '') as String,
      description: row['description'] as String?,
      startTime: (row['start_time'] ?? '') as String,
      endTime: (row['end_time'] ?? '') as String,
      location: row['location'] as String?,
      color: row['color'] as String?,
      isRecurring: row['is_recurring'] == 1,
      createdAt: row['created_at'] as String?,
      updatedAt: row['updated_at'] as String?,
    );
  }

  Map<String, Object?> toDb() {
    return {
      'id': id,
      'client_id': clientId,
      'coach_id': coachId,
      'title': title,
      'description': description,
      'start_time': startTime,
      'end_time': endTime,
      'location': location,
      'color': color,
      'is_recurring': isRecurring ? 1 : 0,
      'created_at': createdAt,
      'updated_at': updatedAt,
    };
  }
}
