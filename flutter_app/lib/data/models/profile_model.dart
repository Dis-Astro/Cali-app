class ProfileModel {
  const ProfileModel({
    required this.id,
    required this.userId,
    required this.firstName,
    required this.lastName,
    required this.role,
    this.phone,
    this.avatarUrl,
    this.dateOfBirth,
    this.address,
    this.fiscalCode,
    this.emergencyContact,
  });

  final String id;
  final String userId;
  final String firstName;
  final String lastName;
  final String role;
  final String? phone;
  final String? avatarUrl;
  final String? dateOfBirth;
  final String? address;
  final String? fiscalCode;
  final String? emergencyContact;

  String get fullName => '$firstName $lastName'.trim();

  String get initials {
    final first = firstName.isNotEmpty ? firstName[0] : '';
    final last = lastName.isNotEmpty ? lastName[0] : '';
    return (first + last).toUpperCase();
  }

  bool get isCoachingClient => role == 'cliente_coaching';

  factory ProfileModel.fromJson(Map<String, dynamic> json) {
    return ProfileModel(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      firstName: (json['first_name'] ?? '') as String,
      lastName: (json['last_name'] ?? '') as String,
      role: (json['role'] ?? 'cliente_palestra') as String,
      phone: json['phone'] as String?,
      avatarUrl: json['avatar_url'] as String?,
      dateOfBirth: json['date_of_birth'] as String?,
      address: json['address'] as String?,
      fiscalCode: json['fiscal_code'] as String?,
      emergencyContact: json['emergency_contact'] as String?,
    );
  }

  factory ProfileModel.fromDb(Map<String, Object?> row) {
    return ProfileModel(
      id: row['id'] as String,
      userId: row['user_id'] as String,
      firstName: (row['first_name'] ?? '') as String,
      lastName: (row['last_name'] ?? '') as String,
      role: (row['role'] ?? 'cliente_palestra') as String,
      phone: row['phone'] as String?,
      avatarUrl: row['avatar_url'] as String?,
      dateOfBirth: row['date_of_birth'] as String?,
      address: row['address'] as String?,
      fiscalCode: row['fiscal_code'] as String?,
      emergencyContact: row['emergency_contact'] as String?,
    );
  }

  Map<String, Object?> toDb() {
    return {
      'id': id,
      'user_id': userId,
      'first_name': firstName,
      'last_name': lastName,
      'role': role,
      'phone': phone,
      'avatar_url': avatarUrl,
      'date_of_birth': dateOfBirth,
      'address': address,
      'fiscal_code': fiscalCode,
      'emergency_contact': emergencyContact,
    };
  }
}
