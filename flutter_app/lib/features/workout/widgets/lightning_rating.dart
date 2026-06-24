import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

class LightningRating extends StatelessWidget {
  const LightningRating({
    super.key,
    required this.value,
    this.onChanged,
    this.readOnly = false,
  });

  final int value;
  final ValueChanged<int>? onChanged;
  final bool readOnly;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 2,
      runSpacing: 2,
      children: List.generate(10, (index) {
        final rating = index + 1;
        final selected = rating <= value;
        return InkResponse(
          radius: 20,
          onTap: readOnly ? null : () => onChanged?.call(rating),
          child: Padding(
            padding: const EdgeInsets.all(4),
            child: Icon(
              Icons.bolt,
              size: 22,
              color: selected
                  ? AppTheme.primary
                  : AppTheme.mutedForeground.withValues(alpha: 0.35),
            ),
          ),
        );
      }),
    );
  }
}
