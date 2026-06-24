import 'package:supabase_flutter/supabase_flutter.dart';

import '../../data/local/local_store.dart';

class SyncResult {
  const SyncResult({
    required this.sent,
    required this.failed,
  });

  final int sent;
  final int failed;

  bool get hasErrors => failed > 0;
}

class SyncService {
  SyncService({
    required SupabaseClient client,
    required LocalStore localStore,
  })  : _client = client,
        _localStore = localStore;

  final SupabaseClient _client;
  final LocalStore _localStore;

  Future<SyncResult> syncPendingCompletions(String clientId) async {
    final pending = await _localStore.pendingCompletions(clientId);
    var sent = 0;
    var failed = 0;

    for (final completion in pending) {
      try {
        if (completion.remoteId != null && completion.remoteId!.isNotEmpty) {
          await _client
              .from('workout_completions')
              .update(completion.toPayload())
              .eq('id', completion.remoteId!);
          await _localStore.markCompletionSynced(
            localId: completion.localId,
            remoteId: completion.remoteId!,
          );
        } else {
          final data = await _client
              .from('workout_completions')
              .upsert(
                completion.toPayload(),
                onConflict: 'workout_plan_exercise_id,client_id,set_number',
              )
              .select('id')
              .single();

          await _localStore.markCompletionSynced(
            localId: completion.localId,
            remoteId: data['id'] as String,
          );
        }
        sent++;
      } catch (error) {
        failed++;
        await _localStore.markCompletionSyncError(
          localId: completion.localId,
          error: error.toString(),
        );
      }
    }

    return SyncResult(sent: sent, failed: failed);
  }
}
