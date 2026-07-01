import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_card.dart';
import '../workout/workout_controller.dart';

class AppointmentsScreen extends StatelessWidget {
  const AppointmentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final workouts = context.watch<WorkoutController>();
    final upcoming = workouts.upcomingAppointments;
    final past = workouts.pastAppointments;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          'PROSSIMI APPUNTAMENTI',
          style: TextStyle(
            color: AppTheme.primary,
            fontWeight: FontWeight.w900,
            letterSpacing: 1,
            fontSize: 12,
          ),
        ),
        const SizedBox(height: 12),
        if (upcoming.isEmpty)
          const AppCard(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Column(
                  children: [
                    Icon(Icons.event_busy_outlined,
                        color: AppTheme.mutedForeground, size: 40),
                    SizedBox(height: 8),
                    Text(
                      'Nessun appuntamento in programma',
                      style: TextStyle(color: AppTheme.mutedForeground),
                    ),
                  ],
                ),
              ),
            ),
          )
        else
          ...upcoming.map((apt) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _AppointmentTile(apt: apt),
              )),
        const SizedBox(height: 24),
        const Text(
          'APPUNTAMENTI PASSATI',
          style: TextStyle(
            color: AppTheme.mutedForeground,
            fontWeight: FontWeight.w900,
            letterSpacing: 1,
            fontSize: 12,
          ),
        ),
        const SizedBox(height: 12),
        if (past.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(
              child: Text(
                'Nessun appuntamento passato',
                style: TextStyle(color: AppTheme.mutedForeground),
              ),
            ),
          )
        else
          ...past.map((apt) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _AppointmentTile(apt: apt, isPast: true),
              )),
      ],
    );
  }
}

class _AppointmentTile extends StatelessWidget {
  const _AppointmentTile({required this.apt, this.isPast = false});

  final dynamic apt;
  final bool isPast;

  @override
  Widget build(BuildContext context) {
    final color = isPast ? AppTheme.mutedForeground : Colors.white;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (apt.isToday)
                Container(
                  margin: const EdgeInsets.only(right: 8),
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
              Expanded(
                child: Text(
                  apt.title ?? 'Appuntamento',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: color,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.access_time,
                  size: 14, color: AppTheme.mutedForeground),
              const SizedBox(width: 4),
              Text(
                apt.formattedTime,
                style: TextStyle(
                    fontSize: 13,
                    color: isPast ? AppTheme.mutedForeground : color),
              ),
            ],
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
          if (apt.description?.isNotEmpty == true) ...[
            const SizedBox(height: 6),
            Text(
              apt.description!,
              style: const TextStyle(
                  color: AppTheme.mutedForeground, fontSize: 13),
            ),
          ],
        ],
      ),
    );
  }
}
