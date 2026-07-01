import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_card.dart';
import '../../data/models/client_document_model.dart';
import '../workout/workout_controller.dart';

class DocumentsScreen extends StatelessWidget {
  const DocumentsScreen({super.key});

  Future<void> _openDocument(
    BuildContext context,
    ClientDocumentModel document,
  ) async {
    final uri = Uri.tryParse(document.fileUrl);
    if (uri == null) return;

    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Impossibile aprire il documento')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final workouts = context.watch<WorkoutController>();
    final documents = workouts.documents;

    if (documents.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.folder_open_outlined,
              color: AppTheme.mutedForeground,
              size: 56,
            ),
            SizedBox(height: 12),
            Text(
              'Nessun documento disponibile',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 18,
                color: AppTheme.mutedForeground,
              ),
            ),
            SizedBox(height: 6),
            Text(
              'I documenti caricati dal coach appariranno qui.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppTheme.mutedForeground),
            ),
          ],
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          'DOCUMENTI CONDIVISI',
          style: TextStyle(
            color: AppTheme.primary,
            fontWeight: FontWeight.w900,
            letterSpacing: 1,
            fontSize: 12,
          ),
        ),
        const SizedBox(height: 12),
        ...documents.map(
          (document) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: _DocumentTile(
              document: document,
              onTap: () => _openDocument(context, document),
            ),
          ),
        ),
      ],
    );
  }
}

class _DocumentTile extends StatelessWidget {
  const _DocumentTile({
    required this.document,
    required this.onTap,
  });

  final ClientDocumentModel document;
  final VoidCallback onTap;

  IconData _iconForType() {
    if (document.isPdf) return Icons.picture_as_pdf;
    if (document.isImage) return Icons.image;
    return Icons.insert_drive_file_outlined;
  }

  Color _colorForType() {
    if (document.isPdf) return Colors.redAccent;
    if (document.isImage) return Colors.blueAccent;
    return AppTheme.mutedForeground;
  }

  @override
  Widget build(BuildContext context) {
    final metadata = [
      if (document.fileType != null && document.fileType!.trim().isNotEmpty)
        document.fileType!,
      if (document.formattedSize.isNotEmpty) document.formattedSize,
    ].join(' - ');

    return AppCard(
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: _colorForType().withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(_iconForType(), color: _colorForType(), size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  document.name,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (metadata.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    metadata,
                    style: const TextStyle(
                      color: AppTheme.mutedForeground,
                      fontSize: 12,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const Icon(Icons.download_outlined,
              color: AppTheme.primary, size: 20),
        ],
      ),
    );
  }
}
