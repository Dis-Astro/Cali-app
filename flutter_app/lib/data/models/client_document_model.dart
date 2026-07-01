class ClientDocumentModel {
  const ClientDocumentModel({
    required this.id,
    required this.userId,
    required this.name,
    required this.fileUrl,
    this.fileType,
    this.fileSize,
    this.createdAt,
    this.uploadedBy,
  });

  final String id;
  final String userId;
  final String name;
  final String fileUrl;
  final String? fileType;
  final int? fileSize;
  final String? createdAt;
  final String? uploadedBy;

  String get formattedSize {
    if (fileSize == null) return '';
    final kb = fileSize! / 1024;
    if (kb < 1024) return '${kb.toStringAsFixed(1)} KB';
    final mb = kb / 1024;
    return '${mb.toStringAsFixed(1)} MB';
  }

  bool get isImage => fileType?.toLowerCase().startsWith('image/') ?? false;
  bool get isPdf => fileType?.toLowerCase() == 'application/pdf';

  factory ClientDocumentModel.fromJson(Map<String, dynamic> json) {
    return ClientDocumentModel(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      name: (json['name'] ?? 'Documento') as String,
      fileUrl: json['file_url'] as String,
      fileType: json['file_type'] as String?,
      fileSize: json['file_size'] as int?,
      createdAt: json['created_at'] as String?,
      uploadedBy: json['uploaded_by'] as String?,
    );
  }

  factory ClientDocumentModel.fromDb(Map<String, Object?> row) {
    return ClientDocumentModel(
      id: row['id'] as String,
      userId: row['user_id'] as String,
      name: (row['name'] ?? 'Documento') as String,
      fileUrl: row['file_url'] as String,
      fileType: row['file_type'] as String?,
      fileSize: row['file_size'] as int?,
      createdAt: row['created_at'] as String?,
      uploadedBy: row['uploaded_by'] as String?,
    );
  }

  Map<String, Object?> toDb() {
    return {
      'id': id,
      'user_id': userId,
      'name': name,
      'file_url': fileUrl,
      'file_type': fileType,
      'file_size': fileSize,
      'created_at': createdAt,
      'uploaded_by': uploadedBy,
    };
  }
}
