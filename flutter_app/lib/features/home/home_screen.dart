import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/date_formatters.dart';
import '../../core/widgets/app_card.dart';
import '../../data/models/appointment_model.dart';
import '../../data/models/subscription_model.dart';
import '../../data/models/workout_plan_model.dart';
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
    final subscription = workouts.subscription;
    final nextAppt = workouts.upcomingAppointments.isNotEmpty
        ? workouts.upcomingAppointments.first
        : null;

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
          else ...[
            if (plan != null)
              _WorkoutPlanCard(plan: plan, onOpenWorkout: onOpenWorkout),
            const SizedBox(height: 12),
            if (nextAppt != null) _NextAppointmentCard(apt: nextAppt),
            if (nextAppt == null)
              AppCard(
                child: Row(
                  children: [
                    Icon(
                      Icons.event_outlined,
                      color: AppTheme.mutedForeground,
                      size: 20,
                    ),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Text(
                        'Nessun appuntamento in programma',
                        style: TextStyle(color: AppTheme.mutedForeground),
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 12),
            _SubscriptionCard(subscription: subscription),
            const SizedBox(height: 12),
            _WeeklyProgressCard(
              plan: plan,
              weekNumber: workouts.weeklyProgressWeek,
              completed: workouts.weeklyCompletedExercises,
              total: workouts.weeklyTotalExercises,
              percent: workouts.weeklyProgressPercent,
            ),
          ],
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

class _WorkoutPlanCard extends StatelessWidget {
  const _WorkoutPlanCard({required this.plan, required this.onOpenWorkout});

  final WorkoutPlanModel plan;
  final VoidCallback onOpenWorkout;

  @override
  Widget build(BuildContext context) {
    return AppCard(
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
    );
  }
}

class _NextAppointmentCard extends StatelessWidget {
  const _NextAppointmentCard({required this.apt});

  final AppointmentModel apt;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.event, color: AppTheme.primary, size: 20),
              const SizedBox(width: 8),
              const Text(
                'PROSSIMO APPUNTAMENTO',
                style: TextStyle(
                  color: AppTheme.primary,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1,
                  fontSize: 12,
                ),
              ),
              if (apt.isToday)
                Container(
                  margin: const EdgeInsets.only(left: 8),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.green.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: const Text(
                    'Oggi',
                    style: TextStyle(
                        color: Colors.green,
                        fontSize: 11,
                        fontWeight: FontWeight.w800),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            apt.title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            '${formatDate(apt.startTime)} - ${apt.formattedTime}',
            style: const TextStyle(color: AppTheme.mutedForeground),
          ),
          if (apt.location?.isNotEmpty == true) ...[
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.location_on_outlined,
                    size: 14, color: AppTheme.mutedForeground),
                const SizedBox(width: 4),
                Text(
                  apt.location!,
                  style: const TextStyle(
                      color: AppTheme.mutedForeground, fontSize: 13),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _SubscriptionCard extends StatelessWidget {
  const _SubscriptionCard({required this.subscription});

  final SubscriptionModel? subscription;

  @override
  Widget build(BuildContext context) {
    final currentSubscription = subscription;
    if (currentSubscription == null) {
      return AppCard(
        child: Row(
          children: [
            Icon(Icons.credit_card_off_outlined,
                color: AppTheme.mutedForeground, size: 20),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'Nessun abbonamento attivo',
                style: TextStyle(color: AppTheme.mutedForeground),
              ),
            ),
          ],
        ),
      );
    }

    final daysLeft = currentSubscription.daysRemaining;
    final isExpiring = currentSubscription.isExpiringSoon;
    final expired = currentSubscription.hasExpired;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                expired ? Icons.error_outline : Icons.credit_card,
                color: expired ? Colors.redAccent : AppTheme.primary,
                size: 20,
              ),
              const SizedBox(width: 8),
              const Text(
                'ABBONAMENTO',
                style: TextStyle(
                  color: AppTheme.primary,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1,
                  fontSize: 12,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                currentSubscription.planName ?? 'Piano',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: expired
                      ? Colors.redAccent.withValues(alpha: 0.15)
                      : isExpiring
                          ? Colors.orange.withValues(alpha: 0.15)
                          : AppTheme.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(
                  expired
                      ? 'Scaduto'
                      : daysLeft <= 1
                          ? '$daysLeft giorno'
                          : '$daysLeft giorni',
                  style: TextStyle(
                    color: expired
                        ? Colors.redAccent
                        : isExpiring
                            ? Colors.orange
                            : AppTheme.primary,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Scade il ${currentSubscription.formattedEndDate}',
            style:
                const TextStyle(color: AppTheme.mutedForeground, fontSize: 13),
          ),
          if (isExpiring && !expired) ...[
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.orange.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'L\'abbonamento sta per scadere. Contatta la reception per rinnovare.',
                style: TextStyle(color: Colors.orange, fontSize: 12),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _WeeklyProgressCard extends StatelessWidget {
  const _WeeklyProgressCard({
    required this.plan,
    required this.weekNumber,
    required this.completed,
    required this.total,
    required this.percent,
  });

  final WorkoutPlanModel? plan;
  final int weekNumber;
  final int completed;
  final int total;
  final int percent;

  @override
  Widget build(BuildContext context) {
    final currentPlan = plan;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.trending_up, color: AppTheme.primary, size: 20),
              const SizedBox(width: 8),
              const Text(
                'PROGRESSO SETTIMANALE',
                style: TextStyle(
                  color: AppTheme.primary,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1,
                  fontSize: 12,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      currentPlan != null
                          ? currentPlan.name
                          : 'Continua ad allenarti!',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(99),
                      child: LinearProgressIndicator(
                        minHeight: 8,
                        value: total == 0 ? 0 : percent.clamp(0, 100) / 100,
                        backgroundColor: AppTheme.surfaceMuted,
                        color: AppTheme.primary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      total == 0
                          ? 'Nessun esercizio pianificato'
                          : '$completed di $total esercizi - settimana $weekNumber ($percent%)',
                      style: const TextStyle(
                        color: AppTheme.mutedForeground,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
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
