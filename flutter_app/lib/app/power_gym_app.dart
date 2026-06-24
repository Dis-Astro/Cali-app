import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/theme/app_theme.dart';
import '../data/local/app_database.dart';
import '../data/local/local_store.dart';
import '../data/repositories/auth_repository.dart';
import '../data/repositories/workout_repository.dart';
import '../features/auth/auth_controller.dart';
import '../features/auth/login_screen.dart';
import '../features/shared/app_shell.dart';
import '../features/sync/sync_service.dart';
import '../features/workout/workout_controller.dart';

class PowerGymApp extends StatelessWidget {
  const PowerGymApp({super.key});

  @override
  Widget build(BuildContext context) {
    final client = Supabase.instance.client;

    return MultiProvider(
      providers: [
        Provider<LocalStore>(
          create: (_) => LocalStore(AppDatabase.instance),
        ),
        ProxyProvider<LocalStore, SyncService>(
          update: (_, localStore, __) => SyncService(
            client: client,
            localStore: localStore,
          ),
        ),
        ProxyProvider<LocalStore, AuthRepository>(
          update: (_, localStore, __) => AuthRepository(
            client: client,
            localStore: localStore,
          ),
        ),
        ProxyProvider2<LocalStore, SyncService, WorkoutRepository>(
          update: (_, localStore, syncService, __) => WorkoutRepository(
            client: client,
            localStore: localStore,
            syncService: syncService,
          ),
        ),
        ChangeNotifierProvider<AuthController>(
          create: (context) =>
              AuthController(context.read<AuthRepository>())..initialize(),
        ),
        ChangeNotifierProvider<WorkoutController>(
          create: (context) =>
              WorkoutController(context.read<WorkoutRepository>()),
        ),
      ],
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'Power Gym',
        theme: AppTheme.dark(),
        home: const _AuthGate(),
      ),
    );
  }
}

class _AuthGate extends StatelessWidget {
  const _AuthGate();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();

    if (auth.loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final profile = auth.profile;
    if (profile == null) return const LoginScreen();

    return AppShell(
      key: ValueKey(profile.userId),
      profile: profile,
    );
  }
}
