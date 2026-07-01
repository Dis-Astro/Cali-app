import 'package:intl/intl.dart';

class SubscriptionModel {
  const SubscriptionModel({
    required this.id,
    required this.userId,
    this.planId,
    this.planName,
    required this.startDate,
    required this.endDate,
    required this.status,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String userId;
  final String? planId;
  final String? planName;
  final String startDate;
  final String endDate;
  final String status;
  final String? createdAt;
  final String? updatedAt;

  bool get isActive => status == 'attivo';
  bool get isExpired => status == 'scaduto';
  bool get isSuspended => status == 'sospeso';
  bool get isCancelled => status == 'cancellato';

  int get daysRemaining {
    final end = DateTime.tryParse(endDate);
    if (end == null) return 0;
    final diff = end.difference(DateTime.now()).inDays;
    return diff < 0 ? 0 : diff;
  }

  bool get isExpiringSoon =>
      isActive && daysRemaining <= 7 && daysRemaining > 0;

  bool get hasExpired {
    final end = DateTime.tryParse(endDate);
    if (end == null) return false;
    return end.isBefore(DateTime.now());
  }

  String get formattedEndDate {
    final date = DateTime.tryParse(endDate);
    if (date == null) return '';
    return DateFormat('dd/MM/yyyy').format(date);
  }

  String get formattedStartDate {
    final date = DateTime.tryParse(startDate);
    if (date == null) return '';
    return DateFormat('dd/MM/yyyy').format(date);
  }

  factory SubscriptionModel.fromJson(Map<String, dynamic> json) {
    String? planName;
    if (json['plan'] != null && json['plan'] is Map) {
      planName = (json['plan'] as Map)['name'] as String?;
    }

    return SubscriptionModel(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      planId: json['plan_id'] as String?,
      planName: planName,
      startDate: (json['start_date'] ?? '') as String,
      endDate: (json['end_date'] ?? '') as String,
      status: (json['status'] ?? '') as String,
      createdAt: json['created_at'] as String?,
      updatedAt: json['updated_at'] as String?,
    );
  }

  factory SubscriptionModel.fromDb(Map<String, Object?> row) {
    return SubscriptionModel(
      id: row['id'] as String,
      userId: row['user_id'] as String,
      planId: row['plan_id'] as String?,
      planName: row['plan_name'] as String?,
      startDate: (row['start_date'] ?? '') as String,
      endDate: (row['end_date'] ?? '') as String,
      status: (row['status'] ?? '') as String,
      createdAt: row['created_at'] as String?,
      updatedAt: row['updated_at'] as String?,
    );
  }

  Map<String, Object?> toDb() {
    return {
      'id': id,
      'user_id': userId,
      'plan_id': planId,
      'plan_name': planName,
      'start_date': startDate,
      'end_date': endDate,
      'status': status,
      'created_at': createdAt,
      'updated_at': updatedAt,
    };
  }
}
