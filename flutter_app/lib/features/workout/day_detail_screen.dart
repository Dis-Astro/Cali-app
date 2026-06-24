import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_card.dart';
import '../../data/repositories/workout_repository.dart';
import 'widgets/lightning_rating.dart';
import 'workout_controller.dart';

class DayDetailScreen extends StatefulWidget {
  const DayDetailScreen({
    super.key,
    required this.planId,
    required this.day,
  });

  final String planId;
  final int day;

  @override
  State<DayDetailScreen> createState() => _DayDetailScreenState();
}

class _DayDetailScreenState extends State<DayDetailScreen> {
  late Future<DayDetailData?> _future;
  final _notesDraft = <String, String>{};
  final _ratingDraft = <String, int>{};

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<DayDetailData?> _load() {
    return context.read<WorkoutController>().dayDetail(
          planId: widget.planId,
          day: widget.day,
        );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('GIORNO ${widget.day}'),
      ),
      body: FutureBuilder<DayDetailData?>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final data = snapshot.data;
          if (data == null) {
            return const Center(
              child: Text(
                'Giorno non disponibile offline.',
                style: TextStyle(color: AppTheme.mutedForeground),
              ),
            );
          }

          _seedDrafts(data);

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                data.plan.name,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
              ),
              const SizedBox(height: 4),
              Text(
                'Settimana ${data.currentWeek} di ${data.totalWeeks}',
                style: const TextStyle(color: AppTheme.mutedForeground),
              ),
              const SizedBox(height: 16),
              if (data.exercises.isEmpty)
                const AppCard(
                  child: Text(
                    'Nessun esercizio per questo giorno.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppTheme.mutedForeground),
                  ),
                )
              else
                ...data.exercises.asMap().entries.map(
                      (entry) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _ExerciseTile(
                          index: entry.key + 1,
                          detail: entry.value,
                          currentWeek: data.currentWeek,
                          onRatingChanged: (week, rating) {
                            setState(() {
                              _ratingDraft[_draftKey(
                                  entry.value.exercise.id, week)] = rating;
                            });
                          },
                          onNotesChanged: (week, notes) {
                            _notesDraft[
                                    _draftKey(entry.value.exercise.id, week)] =
                                notes;
                          },
                          ratingFor: (week) =>
                              _ratingDraft[
                                  _draftKey(entry.value.exercise.id, week)] ??
                              0,
                          notesFor: (week) =>
                              _notesDraft[
                                  _draftKey(entry.value.exercise.id, week)] ??
                              '',
                          onSave: (week) =>
                              _save(entry.value.exercise.id, week),
                        ),
                      ),
                    ),
            ],
          );
        },
      ),
    );
  }

  void _seedDrafts(DayDetailData data) {
    for (final detail in data.exercises) {
      for (final week in detail.weeks) {
        final key = _draftKey(detail.exercise.id, week.weekNumber);
        _notesDraft.putIfAbsent(key, () => week.notes);
        _ratingDraft.putIfAbsent(key, () => week.rating);
      }
    }
  }

  Future<void> _save(String exerciseId, int week) async {
    final key = _draftKey(exerciseId, week);
    await context.read<WorkoutController>().saveCompletion(
          exerciseId: exerciseId,
          weekNumber: week,
          notes: _notesDraft[key] ?? '',
          rating: _ratingDraft[key] ?? 0,
        );
    if (!mounted) return;
    setState(() {
      _future = _load();
    });
  }

  String _draftKey(String exerciseId, int week) => '$exerciseId-$week';
}

class _ExerciseTile extends StatelessWidget {
  const _ExerciseTile({
    required this.index,
    required this.detail,
    required this.currentWeek,
    required this.onRatingChanged,
    required this.onNotesChanged,
    required this.ratingFor,
    required this.notesFor,
    required this.onSave,
  });

  final int index;
  final ExerciseDetail detail;
  final int currentWeek;
  final void Function(int week, int rating) onRatingChanged;
  final void Function(int week, String notes) onNotesChanged;
  final int Function(int week) ratingFor;
  final String Function(int week) notesFor;
  final Future<void> Function(int week) onSave;

  @override
  Widget build(BuildContext context) {
    final valuedWeeks = detail.weeks
        .where((week) => week.hasContent && week.weekNumber != currentWeek)
        .toList();
    final completed = detail.weeks.where((week) => week.hasContent).length;

    return AppCard(
      padding: EdgeInsets.zero,
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
        leading: CircleAvatar(
          backgroundColor: AppTheme.primary.withValues(alpha: 0.16),
          child: Text(
            '$index',
            style: const TextStyle(
              color: AppTheme.primary,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        title: Text(
          detail.exercise.displayName,
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        subtitle: Text(
          '$completed/${detail.weeks.length} sett. valutate',
          style: const TextStyle(color: AppTheme.mutedForeground),
        ),
        trailing: Wrap(
          spacing: 4,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            if (detail.video?.videoUrl.isNotEmpty == true)
              IconButton(
                tooltip: 'Video',
                onPressed: () => _openVideo(detail.video!.videoUrl),
                icon: const Icon(Icons.play_circle_outline),
              ),
            const Icon(Icons.expand_more),
          ],
        ),
        children: [
          if (detail.exercise.notes?.isNotEmpty == true)
            _CoachBox(
              title: 'Nota del coach',
              body: detail.exercise.notes!,
              icon: Icons.message_outlined,
            ),
          if (detail.coachNote?.hasContent == true)
            _CoachBox(
              title: detail.coachNote?.rating == null
                  ? 'Correzione test'
                  : 'Correzione test - ${detail.coachNote!.rating}/10',
              body: detail.coachNote?.note ?? '',
              icon: Icons.bolt,
            ),
          if (valuedWeeks.isNotEmpty) ...[
            const SizedBox(height: 10),
            _HistoryList(weeks: valuedWeeks),
          ],
          const SizedBox(height: 10),
          ...detail.weeks
              .where((week) => week.weekNumber >= currentWeek)
              .map((week) {
            if (week.weekNumber > currentWeek) {
              return _FutureWeek(weekNumber: week.weekNumber);
            }
            return _WeekEditor(
              week: week,
              rating: ratingFor(week.weekNumber),
              notes: notesFor(week.weekNumber),
              onRatingChanged: (value) =>
                  onRatingChanged(week.weekNumber, value),
              onNotesChanged: (value) => onNotesChanged(week.weekNumber, value),
              onSave: () => onSave(week.weekNumber),
            );
          }),
        ],
      ),
    );
  }

  Future<void> _openVideo(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

class _CoachBox extends StatelessWidget {
  const _CoachBox({
    required this.title,
    required this.body,
    required this.icon,
  });

  final String title;
  final String body;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.surfaceMuted,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppTheme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: AppTheme.primary),
              const SizedBox(width: 6),
              Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
            ],
          ),
          if (body.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(body),
          ],
        ],
      ),
    );
  }
}

class _HistoryList extends StatelessWidget {
  const _HistoryList({required this.weeks});

  final List<WeekCompletionDraft> weeks;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surfaceMuted.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppTheme.border),
      ),
      child: Column(
        children: [
          const Padding(
            padding: EdgeInsets.all(10),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Storico settimane',
                style: TextStyle(
                  color: AppTheme.mutedForeground,
                  fontWeight: FontWeight.w800,
                  fontSize: 12,
                ),
              ),
            ),
          ),
          for (final week in weeks)
            ListTile(
              dense: true,
              title: Text('Sett. ${week.weekNumber}'),
              subtitle: Text(
                week.notes.isEmpty ? 'Nessuna nota' : week.notes,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: week.pending
                  ? const Text(
                      'Pending',
                      style: TextStyle(color: Colors.orange, fontSize: 12),
                    )
                  : week.rating > 0
                      ? Text(
                          '${week.rating}/10',
                          style: const TextStyle(color: AppTheme.primary),
                        )
                      : null,
            ),
        ],
      ),
    );
  }
}

class _WeekEditor extends StatelessWidget {
  const _WeekEditor({
    required this.week,
    required this.rating,
    required this.notes,
    required this.onRatingChanged,
    required this.onNotesChanged,
    required this.onSave,
  });

  final WeekCompletionDraft week;
  final int rating;
  final String notes;
  final ValueChanged<int> onRatingChanged;
  final ValueChanged<String> onNotesChanged;
  final Future<void> Function() onSave;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.primary.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppTheme.primary.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'Settimana ${week.weekNumber}',
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
              const SizedBox(width: 8),
              if (week.pending)
                const _StatusChip(
                    label: 'Da sincronizzare', color: Colors.orange)
              else if (week.saved)
                const _StatusChip(label: 'Modifica', color: AppTheme.primary)
              else
                const _StatusChip(
                    label: 'Corrente', color: AppTheme.mutedForeground),
            ],
          ),
          const SizedBox(height: 12),
          const Text(
            "Come e' andato l'esercizio questa settimana? (1-10)",
            style: TextStyle(color: AppTheme.mutedForeground),
          ),
          const SizedBox(height: 6),
          LightningRating(value: rating, onChanged: onRatingChanged),
          const SizedBox(height: 10),
          TextFormField(
            key: ValueKey(
                'notes-${week.weekNumber}-${week.pending}-${week.saved}'),
            initialValue: notes,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(
              hintText: 'Note sulla settimana (opzionale)...',
            ),
            onChanged: onNotesChanged,
          ),
          const SizedBox(height: 10),
          ElevatedButton.icon(
            onPressed: onSave,
            icon: const Icon(Icons.save_outlined),
            label: Text(week.saved || week.pending ? 'AGGIORNA' : 'SALVA'),
          ),
        ],
      ),
    );
  }
}

class _FutureWeek extends StatelessWidget {
  const _FutureWeek({required this.weekNumber});

  final int weekNumber;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.surfaceMuted.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppTheme.border),
      ),
      child: Row(
        children: [
          Text('Sett. $weekNumber'),
          const Spacer(),
          const Text(
            'Non ancora disponibile',
            style: TextStyle(color: AppTheme.mutedForeground, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({
    required this.label,
    required this.color,
  });

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}
