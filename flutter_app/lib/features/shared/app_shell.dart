import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/widgets/sync_status_pill.dart';
import '../../data/models/profile_model.dart';
import '../archive/archive_screen.dart';
import '../auth/auth_controller.dart';
import '../home/home_screen.dart';
import '../workout/workout_controller.dart';
import '../workout/workout_days_screen.dart';

class AppShell extends StatefulWidget {
  const AppShell({
    super.key,
    required this.profile,
  });

  final ProfileModel profile;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;
  bool _started = false;

  static const _titles = ['LA TUA GIORNATA', 'LA MIA SCHEDA', 'ARCHIVIO'];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final userId = context.read<AuthController>().userId;
      if (userId == null) return;
      final workouts = context.read<WorkoutController>();
      await workouts.load(userId, refreshRemote: true);
      if (!mounted) return;
      workouts.startAutoSync(userId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      HomeScreen(onOpenWorkout: () => setState(() => _index = 1)),
      const WorkoutDaysScreen(),
      const ArchiveScreen(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(
          _titles[_index],
          style: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1),
        ),
        actions: [
          Consumer<WorkoutController>(
            builder: (_, controller, __) => Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Center(
                child: SyncStatusPill(
                  status: controller.syncState,
                  pendingCount: controller.pendingCount,
                ),
              ),
            ),
          ),
          IconButton(
            tooltip: 'Esci',
            onPressed: () => context.read<AuthController>().signOut(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        onTap: (value) => setState(() => _index = value),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            activeIcon: Icon(Icons.dashboard),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.fitness_center_outlined),
            activeIcon: Icon(Icons.fitness_center),
            label: 'Scheda',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.archive_outlined),
            activeIcon: Icon(Icons.archive),
            label: 'Archivio',
          ),
        ],
      ),
    );
  }
}
