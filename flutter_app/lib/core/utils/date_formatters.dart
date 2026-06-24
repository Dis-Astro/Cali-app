import 'package:intl/intl.dart';

final _italianDate = DateFormat('dd/MM/yyyy');

String formatDate(String? value) {
  if (value == null || value.isEmpty) return '-';
  final date = DateTime.tryParse(value);
  if (date == null) return value;
  return _italianDate.format(date);
}

int daysRemaining(String? endDate) {
  if (endDate == null || endDate.isEmpty) return 0;
  final end = DateTime.tryParse(endDate);
  if (end == null) return 0;
  final today = DateTime.now();
  final todayOnly = DateTime(today.year, today.month, today.day);
  final endOnly = DateTime(end.year, end.month, end.day);
  return endOnly.difference(todayOnly).inDays;
}

int totalWeeks(String startDate, String endDate) {
  final start = DateTime.parse(startDate);
  final end = DateTime.parse(endDate);
  final diffDays = end.difference(start).inDays;
  final weeks = (diffDays / 7).ceil();
  return weeks < 1 ? 1 : weeks;
}

int currentWeek(String startDate, String endDate) {
  final start = DateTime.parse(startDate);
  final end = DateTime.parse(endDate);
  final now = DateTime.now();
  final reference = now.isAfter(end) ? end : now;
  final diffDays = reference.difference(start).inDays;
  final week = (diffDays / 7).floor() + 1;
  final maxWeeks = totalWeeks(startDate, endDate);
  if (week < 1) return 1;
  return week > maxWeeks ? maxWeeks : week;
}
