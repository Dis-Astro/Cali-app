import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

import '../../data/models/appointment_model.dart';
import '../../data/models/client_document_model.dart';
import '../../data/models/error_report_model.dart';
import '../../data/models/subscription_model.dart';
import '../../data/models/workout_plan_model.dart';
import '../../data/repositories/workout_repository.dart';
import '../sync/sync_state.dart';

class WorkoutController extends ChangeNotifier {
  WorkoutController(this._repository);

  final WorkoutRepository _repository;
  StreamSubscription<dynamic>? _connectivitySubscription;

  String? _userId;
  bool loading = false;
  String? error;
  SyncState syncState = SyncState.idle;
  int pendingCount = 0;
  int pendingCompletionsCount = 0;
  int pendingReportsCount = 0;
  int weeklyProgressWeek = 1;
  int weeklyCompletedExercises = 0;
  int weeklyTotalExercises = 0;
  int weeklyProgressPercent = 0;
  int activeDayStreak = 0;
  int completionCount = 0;
  int activeDaysLast7 = 0;
  int averageDifficulty = 0;
  List<int> dailyCompletionCounts = const [0, 0, 0, 0, 0, 0, 0];
  List<WorkoutPlanModel> plans = const [];
  WorkoutPlanModel? activePlan;
  List<AppointmentModel> appointments = const [];
  List<ClientDocumentModel> documents = const [];
  List<ErrorReportModel> reports = const [];
  SubscriptionModel? subscription;

  List<WorkoutPlanModel> get archivePlans {
    final activeId = activePlan?.id;
    return plans.where((plan) => plan.id != activeId).toList();
  }

  List<AppointmentModel> get upcomingAppointments =>
      appointments.where((a) => !a.isPast).toList();

  List<AppointmentModel> get pastAppointments =>
      appointments.where((a) => a.isPast).toList();

  Future<void> load(String userId, {bool refreshRemote = false}) async {
    _userId = userId;
    loading = true;
    error = null;
    notifyListeners();

    await _loadLocal(userId);

    if (refreshRemote) {
      await refresh();
    }

    loading = false;
    notifyListeners();
  }

  Future<void> refresh() async {
    final userId = _userId;
    if (userId == null) return;

    if (!await _hasConnection()) {
      syncState = SyncState.offline;
      await _loadPendingCounts(userId);
      notifyListeners();
      return;
    }

    syncState = SyncState.syncing;
    notifyListeners();

    try {
      await _repository.refreshFromRemote(userId);
      await _loadLocal(userId);
      syncState = pendingCount > 0 ? SyncState.error : SyncState.synced;
    } catch (exception) {
      error = exception.toString();
      syncState = SyncState.error;
      await _loadLocal(userId);
    }

    notifyListeners();
  }

  Future<List<WorkoutDaySummary>> daySummaries(String planId) async {
    final userId = _userId;
    if (userId == null) return const [];
    return _repository.daySummaries(planId: planId, clientId: userId);
  }

  Future<DayDetailData?> dayDetail({
    required String planId,
    required int day,
  }) async {
    final userId = _userId;
    if (userId == null) return null;
    return _repository.dayDetail(planId: planId, clientId: userId, day: day);
  }

  Future<void> saveCompletion({
    required String exerciseId,
    required int weekNumber,
    required String notes,
    required int rating,
  }) async {
    final userId = _userId;
    if (userId == null) return;

    await _repository.saveCompletion(
      exerciseId: exerciseId,
      clientId: userId,
      weekNumber: weekNumber,
      notes: notes,
      rating: rating,
    );

    await _loadPendingCounts(userId);
    await _loadWeeklyProgress(userId);
    await _loadProgressStats(userId);
    syncState = await _hasConnection() ? SyncState.idle : SyncState.offline;
    notifyListeners();

    if (syncState != SyncState.offline) {
      await refresh();
    }
  }

  Future<void> saveReport({
    required String coachId,
    required String title,
    required String description,
    String? exerciseId,
    String? workoutPlanId,
  }) async {
    final userId = _userId;
    if (userId == null) return;
    if (coachId.trim().isEmpty) {
      throw StateError('Coach non disponibile per questa segnalazione.');
    }

    final report = ErrorReportModel(
      id: '',
      clientId: userId,
      coachId: coachId.trim(),
      title: title.trim(),
      description: description.trim(),
      exerciseId: exerciseId,
      workoutPlanId: workoutPlanId,
      pendingSync: true,
      reportedAt: DateTime.now().toIso8601String(),
    );

    await _repository.saveReport(report);

    await _loadPendingCounts(userId);
    reports = await _repository.localReports(userId);
    syncState = await _hasConnection() ? SyncState.idle : SyncState.offline;
    notifyListeners();

    if (syncState != SyncState.offline) {
      await refresh();
    }
  }

  void startAutoSync(String userId) {
    _userId = userId;
    _connectivitySubscription?.cancel();
    _connectivitySubscription =
        Connectivity().onConnectivityChanged.listen((result) async {
      if (_isOnline(result)) {
        await refresh();
      } else {
        syncState = SyncState.offline;
        await _loadPendingCounts(userId);
        notifyListeners();
      }
    });
  }

  Future<void> _loadLocal(String userId) async {
    plans = await _repository.localPlans(userId);
    activePlan = _repository.displayPlan(plans);
    appointments = await _repository.localAppointments(userId);
    documents = await _repository.localDocuments(userId);
    reports = await _repository.localReports(userId);
    subscription = await _repository.localSubscription(userId);
    await _loadPendingCounts(userId);
    await _loadWeeklyProgress(userId);
    await _loadProgressStats(userId);
  }

  Future<void> _loadPendingCounts(String userId) async {
    pendingCompletionsCount = await _repository.pendingCount(userId);
    pendingReportsCount = await _repository.pendingReportCount(userId);
    pendingCount = pendingCompletionsCount + pendingReportsCount;
  }

  Future<void> _loadWeeklyProgress(String userId) async {
    final plan = activePlan;
    if (plan == null) {
      weeklyProgressWeek = 1;
      weeklyCompletedExercises = 0;
      weeklyTotalExercises = 0;
      weeklyProgressPercent = 0;
      return;
    }

    final progress = await _repository.weeklyProgress(
      planId: plan.id,
      clientId: userId,
    );
    weeklyProgressWeek = progress.weekNumber;
    weeklyCompletedExercises = progress.completedCount;
    weeklyTotalExercises = progress.exerciseCount;
    weeklyProgressPercent = progress.progress;
  }

  Future<void> _loadProgressStats(String userId) async {
    final stats = await _repository.progressStats(userId);
    activeDayStreak = stats.activeDayStreak;
    completionCount = stats.completionCount;
    activeDaysLast7 = stats.activeDaysLast7;
    averageDifficulty = stats.averageDifficulty;
    dailyCompletionCounts = stats.dailyCompletionCounts;
  }

  Future<bool> _hasConnection() async {
    final result = await Connectivity().checkConnectivity();
    return _isOnline(result);
  }

  bool _isOnline(dynamic result) {
    if (result is ConnectivityResult) {
      return result != ConnectivityResult.none;
    }
    if (result is List<ConnectivityResult>) {
      return result.any((item) => item != ConnectivityResult.none);
    }
    return true;
  }

  @override
  void dispose() {
    _connectivitySubscription?.cancel();
    super.dispose();
  }
}
