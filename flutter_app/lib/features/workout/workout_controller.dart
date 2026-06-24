import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

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
  List<WorkoutPlanModel> plans = const [];
  WorkoutPlanModel? activePlan;

  List<WorkoutPlanModel> get archivePlans {
    final activeId = activePlan?.id;
    return plans.where((plan) => plan.id != activeId).toList();
  }

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
      pendingCount = await _repository.pendingCount(userId);
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

    pendingCount = await _repository.pendingCount(userId);
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
        pendingCount = await _repository.pendingCount(userId);
        notifyListeners();
      }
    });
  }

  Future<void> _loadLocal(String userId) async {
    plans = await _repository.localPlans(userId);
    activePlan = _repository.displayPlan(plans);
    pendingCount = await _repository.pendingCount(userId);
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
