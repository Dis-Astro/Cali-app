import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../data/models/profile_model.dart';
import '../../data/repositories/auth_repository.dart';

class AuthController extends ChangeNotifier {
  AuthController(this._repository);

  final AuthRepository _repository;
  StreamSubscription<AuthState>? _subscription;

  ProfileModel? profile;
  String? error;
  bool loading = true;
  bool signingIn = false;

  String? get userId => _repository.currentUserId;
  bool get isSignedIn => userId != null && profile != null;

  Future<void> initialize() async {
    _subscription = _repository.onAuthStateChange.listen((state) async {
      if (state.session == null) {
        profile = null;
        notifyListeners();
      } else if (profile == null) {
        profile = await _repository.loadProfile(state.session!.user.id);
        notifyListeners();
      }
    });

    final existingUserId = _repository.currentUserId;
    if (existingUserId != null) {
      profile = await _repository.loadProfile(existingUserId);
    }
    loading = false;
    notifyListeners();
  }

  Future<void> signIn(String email, String password) async {
    signingIn = true;
    error = null;
    notifyListeners();

    try {
      final loadedProfile = await _repository.signIn(
        email: email.trim(),
        password: password,
      );
      if (loadedProfile == null) {
        error = 'Profilo non trovato. Contatta la palestra.';
      } else {
        profile = loadedProfile;
      }
    } on AuthException catch (exception) {
      if (exception.message.contains('Invalid login credentials')) {
        error = 'Email o password non corretti';
      } else if (exception.message.contains('Email not confirmed')) {
        error = 'Email non confermata. Contatta la palestra.';
      } else {
        error = exception.message;
      }
    } catch (exception) {
      error = exception.toString();
    } finally {
      signingIn = false;
      notifyListeners();
    }
  }

  Future<void> signOut() async {
    await _repository.signOut();
    profile = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}
