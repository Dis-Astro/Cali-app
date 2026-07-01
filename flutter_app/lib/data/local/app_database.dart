import 'package:path/path.dart' as path;
import 'package:sqflite/sqflite.dart';

class AppDatabase {
  AppDatabase._();

  static final AppDatabase instance = AppDatabase._();

  Database? _database;

  Future<Database> get database async {
    final existing = _database;
    if (existing != null) return existing;
    final dbPath = await getDatabasesPath();
    final db = await openDatabase(
      path.join(dbPath, 'power_gym_client.db'),
      version: 2,
      onCreate: _create,
      onUpgrade: _upgrade,
    );
    _database = db;
    return db;
  }

  Future<void> _create(Database db, int version) async {
    await _createAll(db);
  }

  Future<void> _upgrade(Database db, int oldVersion, int newVersion) async {
    if (oldVersion < 2) {
      await _createV2Tables(db);
    }
  }

  Future<void> _createAll(Database db) async {
    await db.execute('''
      CREATE TABLE profiles (
        id TEXT NOT NULL,
        user_id TEXT PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        role TEXT NOT NULL,
        phone TEXT,
        avatar_url TEXT,
        date_of_birth TEXT,
        address TEXT,
        fiscal_code TEXT,
        emergency_contact TEXT
      )
    ''');

    await db.execute('''
      CREATE TABLE workout_plans (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        coach_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        is_active INTEGER NOT NULL,
        coach_notes TEXT,
        plan_type TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        paused_at TEXT,
        total_paused_days INTEGER NOT NULL DEFAULT 0,
        test_reminder_days INTEGER NOT NULL DEFAULT 0,
        reminder_appointment_id TEXT
      )
    ''');

    await db.execute('''
      CREATE TABLE workout_plan_exercises (
        id TEXT PRIMARY KEY,
        workout_plan_id TEXT NOT NULL,
        exercise_id TEXT,
        video_id TEXT,
        day_of_week INTEGER,
        order_index INTEGER NOT NULL DEFAULT 0,
        sets INTEGER,
        reps TEXT,
        rest_seconds INTEGER,
        notes TEXT,
        exercise_name TEXT,
        created_at TEXT
      )
    ''');

    await db.execute('''
      CREATE TABLE exercise_videos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        video_url TEXT NOT NULL,
        thumbnail_url TEXT,
        duration_seconds INTEGER
      )
    ''');

    await db.execute('''
      CREATE TABLE coach_test_notes (
        id TEXT PRIMARY KEY,
        workout_plan_exercise_id TEXT NOT NULL,
        coach_id TEXT NOT NULL,
        note TEXT,
        rating INTEGER,
        created_at TEXT,
        updated_at TEXT
      )
    ''');

    await db.execute('''
      CREATE TABLE workout_completions (
        local_id TEXT PRIMARY KEY,
        remote_id TEXT,
        workout_plan_exercise_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        set_number INTEGER NOT NULL DEFAULT 1,
        completed_at TEXT NOT NULL,
        client_notes TEXT,
        difficulty_rating INTEGER,
        pending_sync INTEGER NOT NULL DEFAULT 0,
        sync_error TEXT,
        UNIQUE(workout_plan_exercise_id, client_id, set_number)
      )
    ''');

    await db.execute('''
      CREATE TABLE sync_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    ''');

    await _createV2Tables(db);

    await db.execute(
      'CREATE INDEX idx_plans_client ON workout_plans(client_id, end_date)',
    );
    await db.execute(
      'CREATE INDEX idx_exercises_plan_day ON workout_plan_exercises(workout_plan_id, day_of_week, order_index)',
    );
    await db.execute(
      'CREATE INDEX idx_completions_client ON workout_completions(client_id, pending_sync)',
    );
  }

  Future<void> _createV2Tables(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        client_id TEXT,
        coach_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        location TEXT,
        color TEXT,
        is_recurring INTEGER NOT NULL DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
      )
    ''');

    await db.execute('''
      CREATE TABLE IF NOT EXISTS client_documents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        file_url TEXT NOT NULL,
        file_type TEXT,
        file_size INTEGER,
        created_at TEXT,
        uploaded_by TEXT
      )
    ''');

    await db.execute('''
      CREATE TABLE IF NOT EXISTS error_reports (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        coach_id TEXT NOT NULL,
        description TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'aperta',
        exercise_id TEXT,
        workout_plan_id TEXT,
        reported_at TEXT,
        resolved_at TEXT,
        coach_response TEXT,
        pending_sync INTEGER NOT NULL DEFAULT 0
      )
    ''');

    await db.execute('''
      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        plan_id TEXT,
        plan_name TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT
      )
    ''');

    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id, start_time)',
    );
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_documents_user ON client_documents(user_id, created_at)',
    );
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_reports_client ON error_reports(client_id, status)',
    );
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id, status)',
    );
  }
}
