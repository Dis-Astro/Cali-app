import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/date_formatters.dart';
import '../../core/widgets/app_card.dart';
import '../workout/workout_controller.dart';
import '../workout/workout_days_screen.dart';

class ArchiveScreen extends StatelessWidget {
  const ArchiveScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<WorkoutController>();
    final plans = controller.archivePlans;

    return RefreshIndicator(
      onRefresh: () => context.read<WorkoutController>().refresh(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (plans.isEmpty)
            const AppCard(
              child: Column(
                children: [
                  Icon(Icons.archive_outlined,
                      size: 42, color: AppTheme.mutedForeground),
                  SizedBox(height: 12),
                  Text(
                    'Archivio vuoto',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
                  ),
                  SizedBox(height: 6),
                  Text(
                    'Le schede precedenti appariranno qui dopo il primo aggiornamento.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppTheme.mutedForeground),
                  ),
                ],
              ),
            )
          else
            ...plans.map(
              (plan) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: AppCard(
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => Scaffold(
                          appBar: AppBar(title: Text(plan.name)),
                          body: WorkoutDaysScreen(planId: plan.id),
                        ),
                      ),
                    );
                  },
                  child: Row(
                    children: [
                      Icon(
                        plan.isTest ? Icons.science_outlined : Icons.history,
                        color: AppTheme.primary,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              plan.name,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 16,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${formatDate(plan.startDate)} - ${formatDate(plan.endDate)}',
                              style: const TextStyle(
                                color: AppTheme.mutedForeground,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right,
                          color: AppTheme.mutedForeground),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
