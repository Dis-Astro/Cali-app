import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_card.dart';
import '../../data/models/error_report_model.dart';
import '../workout/workout_controller.dart';

class ReportIssueScreen extends StatefulWidget {
  const ReportIssueScreen({super.key});

  @override
  State<ReportIssueScreen> createState() => _ReportIssueScreenState();
}

class _ReportIssueScreenState extends State<ReportIssueScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    final workouts = context.read<WorkoutController>();
    final activePlan = workouts.activePlan;
    final coachId = activePlan?.coachId;
    final planId = activePlan?.id;

    if (coachId == null || coachId.trim().isEmpty) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Coach non disponibile: aggiorna la scheda e riprova.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    try {
      await workouts.saveReport(
        coachId: coachId,
        title: _titleController.text.trim(),
        description: _descriptionController.text.trim(),
        workoutPlanId: planId,
      );
    } catch (exception) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Invio non riuscito: $exception'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    if (!mounted) return;

    _titleController.clear();
    _descriptionController.clear();
    setState(() => _isSubmitting = false);

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Segnalazione inviata al coach'),
        backgroundColor: Colors.green,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final workouts = context.watch<WorkoutController>();
    final reports = workouts.reports;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Form(
          key: _formKey,
          child: AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'SEGNALA UN PROBLEMA',
                  style: TextStyle(
                    color: AppTheme.primary,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Hai dubbi su un esercizio? Vuoi segnalare un problema? Scrivici.',
                  style: TextStyle(
                    color: AppTheme.mutedForeground,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _titleController,
                  decoration: const InputDecoration(
                    labelText: 'Titolo *',
                    hintText: 'Es. Difficolta con l\'esercizio...',
                  ),
                  validator: (value) => value == null || value.trim().isEmpty
                      ? 'Inserisci un titolo'
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _descriptionController,
                  decoration: const InputDecoration(
                    labelText: 'Descrizione *',
                    hintText: 'Descrivi il problema in dettaglio...',
                  ),
                  minLines: 3,
                  maxLines: 5,
                  validator: (value) => value == null || value.trim().isEmpty
                      ? 'Inserisci una descrizione'
                      : null,
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _isSubmitting ? null : _submit,
                    icon: _isSubmitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send_outlined),
                    label: Text(
                      _isSubmitting
                          ? 'INVIO IN CORSO...'
                          : 'INVIA SEGNALAZIONE',
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
        const Text(
          'STORICO SEGNALAZIONI',
          style: TextStyle(
            color: AppTheme.mutedForeground,
            fontWeight: FontWeight.w900,
            letterSpacing: 1,
            fontSize: 12,
          ),
        ),
        const SizedBox(height: 12),
        if (reports.isEmpty)
          const AppCard(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Column(
                  children: [
                    Icon(
                      Icons.message_outlined,
                      color: AppTheme.mutedForeground,
                      size: 40,
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Nessuna segnalazione',
                      style: TextStyle(color: AppTheme.mutedForeground),
                    ),
                  ],
                ),
              ),
            ),
          )
        else
          ...reports.map(
            (report) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _ReportTile(report: report),
            ),
          ),
      ],
    );
  }
}

class _ReportTile extends StatefulWidget {
  const _ReportTile({required this.report});

  final ErrorReportModel report;

  @override
  State<_ReportTile> createState() => _ReportTileState();
}

class _ReportTileState extends State<_ReportTile> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final report = widget.report;
    final isOpen = report.isOpen || report.isInProgress;

    return AppCard(
      onTap: () => setState(() => _expanded = !_expanded),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isOpen
                      ? Colors.orange.withValues(alpha: 0.15)
                      : Colors.green.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(
                  isOpen ? 'Aperta' : 'Risolta',
                  style: TextStyle(
                    color: isOpen ? Colors.orange : Colors.green,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  report.title,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
              Icon(
                _expanded ? Icons.expand_less : Icons.expand_more,
                color: AppTheme.mutedForeground,
              ),
            ],
          ),
          if (_expanded) ...[
            const SizedBox(height: 8),
            Text(
              report.description,
              style: const TextStyle(
                color: AppTheme.mutedForeground,
                fontSize: 13,
              ),
            ),
            if (report.hasCoachResponse) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: 0.07),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: AppTheme.primary.withValues(alpha: 0.2),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.bolt, size: 14, color: AppTheme.primary),
                        SizedBox(width: 4),
                        Text(
                          'Risposta del coach',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            color: AppTheme.primary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      report.coachResponse!,
                      style: const TextStyle(fontSize: 13),
                    ),
                  ],
                ),
              ),
            ],
            if (report.pendingSync)
              const Padding(
                padding: EdgeInsets.only(top: 8),
                child: Row(
                  children: [
                    Icon(Icons.sync, size: 14, color: Colors.orange),
                    SizedBox(width: 4),
                    Text(
                      'In attesa di sincronizzazione',
                      style: TextStyle(color: Colors.orange, fontSize: 11),
                    ),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
}
