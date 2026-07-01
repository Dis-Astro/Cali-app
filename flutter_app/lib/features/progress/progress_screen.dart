import 'dart:math';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_card.dart';
import '../../data/models/subscription_model.dart';
import '../workout/workout_controller.dart';

class ProgressScreen extends StatelessWidget {
  const ProgressScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final workouts = context.watch<WorkoutController>();
    final subscription = workouts.subscription;
    final hasActivity =
        workouts.dailyCompletionCounts.any((count) => count > 0);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Expanded(
              child: _StatCard(
                icon: Icons.local_fire_department,
                label: 'Streak',
                value: '${workouts.activeDayStreak} gg',
                color: Colors.orange,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _StatCard(
                icon: Icons.fitness_center,
                label: 'Esercizi',
                value: '${workouts.completionCount}',
                color: AppTheme.primary,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _StatCard(
                icon: Icons.speed,
                label: 'Difficolta',
                value: workouts.averageDifficulty == 0
                    ? '-'
                    : '${workouts.averageDifficulty}/10',
                color: Colors.blueAccent,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'ATTIVITA ULTIMI 7 GIORNI',
                style: TextStyle(
                  color: AppTheme.primary,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                hasActivity
                    ? '${workouts.activeDaysLast7} giorni attivi negli ultimi 7'
                    : 'Nessuna attivita registrata negli ultimi 7 giorni',
                style: const TextStyle(
                  color: AppTheme.mutedForeground,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                height: 160,
                child: _ActivityChart(counts: workouts.dailyCompletionCounts),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        if (subscription != null)
          _SubscriptionInfoCard(subscription: subscription),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        children: [
          Icon(icon, color: color, size: 28),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 22,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              color: AppTheme.mutedForeground,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class _ActivityChart extends StatelessWidget {
  const _ActivityChart({required this.counts});

  final List<int> counts;

  @override
  Widget build(BuildContext context) {
    final safeCounts =
        counts.length == 7 ? counts : const [0, 0, 0, 0, 0, 0, 0];
    final maxCount = max(safeCounts.reduce(max), 1);
    final now = DateTime.now();
    final labels = List.generate(7, (index) {
      final day = now.subtract(Duration(days: 6 - index));
      return ['L', 'M', 'M', 'G', 'V', 'S', 'D'][day.weekday - 1];
    });

    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: List.generate(7, (index) {
        final count = safeCounts[index];
        final height = count == 0 ? 4.0 : (count / maxCount) * 120;

        return Column(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            if (count > 0)
              Text(
                '$count',
                style: const TextStyle(
                  fontSize: 10,
                  color: AppTheme.mutedForeground,
                ),
              ),
            const SizedBox(height: 4),
            Container(
              width: 24,
              height: height,
              decoration: BoxDecoration(
                color: count > 0 ? AppTheme.primary : AppTheme.surfaceMuted,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              labels[index],
              style: const TextStyle(
                fontSize: 11,
                color: AppTheme.mutedForeground,
              ),
            ),
          ],
        );
      }),
    );
  }
}

class _SubscriptionInfoCard extends StatelessWidget {
  const _SubscriptionInfoCard({required this.subscription});

  final SubscriptionModel subscription;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'ABBONAMENTO',
            style: TextStyle(
              color: AppTheme.primary,
              fontWeight: FontWeight.w900,
              letterSpacing: 1,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    subscription.planName ?? 'Piano',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Iniziato il ${subscription.formattedStartDate}',
                    style: const TextStyle(
                      color: AppTheme.mutedForeground,
                      fontSize: 12,
                    ),
                  ),
                  Text(
                    'Scade il ${subscription.formattedEndDate}',
                    style: const TextStyle(
                      color: AppTheme.mutedForeground,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: subscription.hasExpired
                      ? Colors.redAccent.withValues(alpha: 0.15)
                      : subscription.isExpiringSoon
                          ? Colors.orange.withValues(alpha: 0.15)
                          : AppTheme.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(
                  subscription.hasExpired
                      ? 'Scaduto'
                      : '${subscription.daysRemaining} gg',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: subscription.hasExpired
                        ? Colors.redAccent
                        : subscription.isExpiringSoon
                            ? Colors.orange
                            : AppTheme.primary,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
