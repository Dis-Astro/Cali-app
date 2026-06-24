import 'package:flutter/material.dart';

import '../../features/sync/sync_state.dart';

class SyncStatusPill extends StatelessWidget {
  const SyncStatusPill({
    super.key,
    required this.status,
    required this.pendingCount,
  });

  final SyncState status;
  final int pendingCount;

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      SyncState.offline => Colors.orange,
      SyncState.syncing => Theme.of(context).colorScheme.primary,
      SyncState.error => Colors.redAccent,
      SyncState.synced || SyncState.idle => Colors.greenAccent,
    };
    final text = switch (status) {
      SyncState.offline =>
        pendingCount > 0 ? 'Offline - $pendingCount' : 'Offline',
      SyncState.syncing => 'Sync...',
      SyncState.error => 'Da sincronizzare',
      SyncState.synced => 'Aggiornato',
      SyncState.idle => pendingCount > 0 ? 'Da sincronizzare' : 'Aggiornato',
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        border: Border.all(color: color.withValues(alpha: 0.35)),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
