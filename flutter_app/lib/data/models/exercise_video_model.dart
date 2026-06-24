class ExerciseVideoModel {
  const ExerciseVideoModel({
    required this.id,
    required this.title,
    required this.videoUrl,
    this.thumbnailUrl,
    this.durationSeconds,
  });

  final String id;
  final String title;
  final String videoUrl;
  final String? thumbnailUrl;
  final int? durationSeconds;

  factory ExerciseVideoModel.fromJson(Map<String, dynamic> json) {
    return ExerciseVideoModel(
      id: json['id'] as String,
      title: (json['title'] ?? 'Video') as String,
      videoUrl: (json['video_url'] ?? '') as String,
      thumbnailUrl: json['thumbnail_url'] as String?,
      durationSeconds: json['duration_seconds'] as int?,
    );
  }

  factory ExerciseVideoModel.fromDb(Map<String, Object?> row) {
    return ExerciseVideoModel(
      id: row['id'] as String,
      title: (row['title'] ?? 'Video') as String,
      videoUrl: (row['video_url'] ?? '') as String,
      thumbnailUrl: row['thumbnail_url'] as String?,
      durationSeconds: row['duration_seconds'] as int?,
    );
  }

  Map<String, Object?> toDb() {
    return {
      'id': id,
      'title': title,
      'video_url': videoUrl,
      'thumbnail_url': thumbnailUrl,
      'duration_seconds': durationSeconds,
    };
  }
}
