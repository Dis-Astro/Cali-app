import 'package:supabase_flutter/supabase_flutter.dart';

import '../local/local_store.dart';
import '../models/profile_model.dart';

class AuthRepository {
  AuthRepository({
    required SupabaseClient client,
    required LocalStore localStore,
  })  : _client = client,
        _localStore = localStore;

  final SupabaseClient _client;
  final LocalStore _localStore;

  String? get currentUserId => _client.auth.currentUser?.id;

  Session? get currentSession => _client.auth.currentSession;

  Stream<AuthState> get onAuthStateChange => _client.auth.onAuthStateChange;

  Future<ProfileModel?> signIn({
    required String email,
    required String password,
  }) async {
    final response = await _client.auth.signInWithPassword(
      email: email,
      password: password,
    );
    final userId = response.user?.id;
    if (userId == null) return null;
    return loadProfile(userId);
  }

  Future<void> signOut() {
    return _client.auth.signOut();
  }

  Future<ProfileModel?> loadProfile(String userId) async {
    try {
      final data = await _client
          .from('profiles')
          .select()
          .eq('user_id', userId)
          .single();
      final profile = ProfileModel.fromJson(data);
      await _localStore.cacheProfile(profile);
      return profile;
    } catch (_) {
      return _localStore.profile(userId);
    }
  }
}
