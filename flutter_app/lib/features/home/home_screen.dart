import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/date_formatters.dart';
import '../../core/widgets/app_card.dart';
import '../auth/auth_controller.dart';
import '../workout/workout_controller.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({
    super.key,
    required this.onOpenWorkout,
  });

  final VoidCallback onOpenWorkout;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final workouts = context.watch<WorkoutController>();
    final profile = auth.profile;
    final plan = workouts.activePlan;

    return RefreshIndicator(
      onRefresh: () => context.read<WorkoutController>().refresh(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AppCard(
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: AppTheme.primary.withValues(alpha: 0.18),
                  child: Text(
                    profile?.initials ?? '',
                    style: const TextStyle(
                      color: AppTheme.primary,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        profile?.fullName ?? 'Cliente',
                        style:
                            Theme.of(context).textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w800,
                                ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Cliente Premium',
                        style: TextStyle(color: AppTheme.primary),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (workouts.loading && plan == null)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 48),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (plan == null)
            const _EmptyPlan()
          else
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        plan.isExpired ? Icons.history : Icons.fitness_center,
                        color: AppTheme.primary,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        plan.isExpired ? 'ULTIMA SCHEDA' : 'SCHEDA ATTIVA',
                        style: const TextStyle(
                          color: AppTheme.primary,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    plan.name,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1,
                        ),
                  ),
                  if (plan.description?.isNotEmpty == true) ...[
                    const SizedBox(height: 8),
                    Text(
                      plan.description!,
                      style: const TextStyle(color: AppTheme.mutedForeground),
                    ),
                  ],
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _InfoChip(
                        icon: Icons.calendar_today_outlined,
                        label: 'Scade ${formatDate(plan.endDate)}',
                      ),
                      _InfoChip(
                        icon: Icons.timer_outlined,
                        label: plan.isExpired
                            ? 'Scaduta'
                            : '${daysRemaining(plan.endDate)} giorni',
                      ),
                      if (plan.isPaused)
                        const _InfoChip(
                          icon: Icons.pause_circle_outline,
                          label: 'In pausa',
                        ),
                    ],
                  ),
                  if (plan.coachNotes?.isNotEmpty == true) ...[
                    const SizedBox(height: 16),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.surfaceMuted,
                        borderRadius: BorderRadius.circular(8),
                        border: const Border(
                          left: BorderSide(color: AppTheme.primary, width: 3),
                        ),
                      ),
                      child: Text(plan.coachNotes!),
                    ),
                  ],
                  const SizedBox(height: 18),
                  ElevatedButton.icon(
                    onPressed: onOpenWorkout,
                    icon: const Icon(Icons.play_arrow),
                    label: const Text('VEDI SCHEDA'),
                  ),
                ],
              ),
            ),
          if (workouts.error != null) ...[
            const SizedBox(height: 16),
            Text(
              workouts.error!,
              style: const TextStyle(color: Colors.redAccent),
            ),
          ],
        ],
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: AppTheme.surfaceMuted,
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: AppTheme.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: AppTheme.primary),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(fontSize: 12)),
        ],
      ),
    );
  }
}

class _EmptyPlan extends StatelessWidget {
  const _EmptyPlan();

  @override
  Widget build(BuildContext context) {
    return const AppCard(
      child: Column(
        children: [
          Icon(Icons.fitness_center, color: AppTheme.mutedForeground, size: 44),
          SizedBox(height: 12),
          Text(
            'Nessuna scheda',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
          ),
          SizedBox(height: 6),
          Text(
            'Attendi la tua scheda personalizzata dal coach.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppTheme.mutedForeground),
          ),
        ],
      ),
    );
  }
}
