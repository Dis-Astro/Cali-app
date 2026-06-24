import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/date_formatters.dart';
import '../../core/widgets/app_card.dart';
import '../../data/models/workout_plan_model.dart';
import '../../data/repositories/workout_repository.dart';
import 'day_detail_screen.dart';
import 'workout_controller.dart';

class WorkoutDaysScreen extends StatelessWidget {
  const WorkoutDaysScreen({
    super.key,
    this.planId,
  });

  final String? planId;

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<WorkoutController>();
    final plan = _selectedPlan(controller);

    if (controller.loading && plan == null) {
      return const Center(child: CircularProgressIndicator());
    }

    if (plan == null) {
      return const _NoWorkout();
    }

    return RefreshIndicator(
      onRefresh: () => context.read<WorkoutController>().refresh(),
      child: FutureBuilder<List<WorkoutDaySummary>>(
        future: context.read<WorkoutController>().daySummaries(plan.id),
        builder: (context, snapshot) {
          final days = snapshot.data ?? const <WorkoutDaySummary>[];
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _PlanHeader(plan: plan),
              const SizedBox(height: 16),
              if (snapshot.connectionState == ConnectionState.waiting)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 32),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (days.isEmpty)
                const AppCard(
                  child: Text(
                    'Nessun esercizio programmato in questa scheda.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppTheme.mutedForeground),
                  ),
                )
              else
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: days.length,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 1.05,
                  ),
                  itemBuilder: (context, index) {
                    final day = days[index];
                    return _DayCard(
                      summary: day,
                      onTap: () async {
                        await Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => DayDetailScreen(
                              planId: plan.id,
                              day: day.dayOfWeek,
                            ),
                          ),
                        );
                      },
                    );
                  },
                ),
            ],
          );
        },
      ),
    );
  }

  WorkoutPlanModel? _selectedPlan(WorkoutController controller) {
    if (planId == null) return controller.activePlan;
    for (final plan in controller.plans) {
      if (plan.id == planId) return plan;
    }
    return null;
  }
}

class _PlanHeader extends StatelessWidget {
  const _PlanHeader({required this.plan});

  final WorkoutPlanModel plan;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Icon(
                plan.isTest ? Icons.science_outlined : Icons.fitness_center,
                color: AppTheme.primary,
                size: 20,
              ),
              Text(
                plan.isTest
                    ? 'TEST IN CORSO'
                    : plan.isExpired
                        ? 'ULTIMA SCHEDA'
                        : 'SCHEDA ATTIVA',
                style: const TextStyle(
                  color: AppTheme.primary,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1,
                ),
              ),
              if (plan.isPaused)
                const _Badge(label: 'In pausa', icon: Icons.pause),
              if (plan.isExpired)
                _Badge(
                  label: 'Scaduta ${formatDate(plan.endDate)}',
                  icon: Icons.history,
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
          if (plan.coachNotes?.isNotEmpty == true) ...[
            const SizedBox(height: 12),
            Text(
              'Note del coach',
              style: Theme.of(context).textTheme.labelLarge,
            ),
            const SizedBox(height: 6),
            Text(plan.coachNotes!),
          ],
        ],
      ),
    );
  }
}

class _DayCard extends StatelessWidget {
  const _DayCard({
    required this.summary,
    required this.onTap,
  });

  final WorkoutDaySummary summary;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                '${summary.dayOfWeek}',
                style: Theme.of(context).textTheme.displaySmall?.copyWith(
                      fontWeight: FontWeight.w900,
                      color: summary.isComplete
                          ? AppTheme.primary
                          : AppTheme.foreground,
                    ),
              ),
              const Spacer(),
              Icon(
                summary.isComplete ? Icons.check_circle : Icons.chevron_right,
                color: summary.isComplete
                    ? AppTheme.primary
                    : AppTheme.mutedForeground,
              ),
            ],
          ),
          const Spacer(),
          Text(
            'DAY ${summary.dayOfWeek}',
            style: const TextStyle(
              color: AppTheme.mutedForeground,
              fontWeight: FontWeight.w800,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              minHeight: 6,
              value: summary.progress / 100,
              backgroundColor: AppTheme.surfaceMuted,
              color: AppTheme.primary,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '${summary.completedCount}/${summary.exerciseCount} esercizi',
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

class _Badge extends StatelessWidget {
  const _Badge({
    required this.label,
    required this.icon,
  });

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: AppTheme.surfaceMuted,
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppTheme.mutedForeground),
          const SizedBox(width: 5),
          Text(label, style: const TextStyle(fontSize: 12)),
        ],
      ),
    );
  }
}

class _NoWorkout extends StatelessWidget {
  const _NoWorkout();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Text(
          'Nessuna scheda disponibile. I dati scaricati appariranno qui.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppTheme.mutedForeground),
        ),
      ),
    );
  }
}
