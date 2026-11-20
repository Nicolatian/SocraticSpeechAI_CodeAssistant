
import sqlite3
import json
import csv
from pathlib import Path
from urllib.parse import quote

# Paths
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "pear_logs.db"
EXPORT_DIR = BASE_DIR / "pear_exports"

EXPORT_DIR.mkdir(exist_ok=True)

# Connect to database
connection = sqlite3.connect(DB_PATH)
connection.row_factory = sqlite3.Row

conversation_columns = {
    row["name"] for row in connection.execute("PRAGMA table_info(conversations)")
}

# Retrieve all database information
data = {
    "users": [
        dict(row) for row in connection.execute("""
            SELECT * FROM users ORDER BY user_id
        """)
    ],
    "events": [
        dict(row) for row in connection.execute("""
            SELECT * FROM events ORDER BY event_id
        """)
    ],
    "conversations": [
        dict(row) for row in connection.execute("""
            SELECT * FROM conversations ORDER BY conversation_id
        """)
    ]
}
if "exercise_id" not in conversation_columns:
    for conversation in data["conversations"]:
        conversation["exercise_id"] = None

# Add code-run outcome and timing fields to the event exports.
for event in data["events"]:
    details = json.loads(event["details"] or "{}")
    is_code_run = event["event_type"] == "run_code"
    event.update({
        "run_number": details.get("run_number") if is_code_run else None,
        "exercise_id": details.get("exercise_id") if is_code_run else None,
        "started_at": (
            details.get("started_at", event["created_at"]) if is_code_run else None
        ),
        "completed": details.get("completed") if is_code_run else None,
        "completed_at": details.get("completed_at") if is_code_run else None,
        "duration_seconds": details.get("duration_seconds") if is_code_run else None,
    })

# Count questions for each participant
question_counts = {
    row["user_id"]: row["question_count"]
    for row in connection.execute("""
        SELECT user_id, COUNT(*) AS question_count
        FROM conversations
        GROUP BY user_id
    """)
}

# Add question count to each user
for user in data["users"]:
    user["question_count"] = question_counts.get(user["user_id"], 0)
    
connection.close()

# ----------------------------------
# Export everything to one JSON file
# ----------------------------------

json_path = EXPORT_DIR / "pear_logs.json"

with open(json_path, "w", encoding="utf-8") as file:
    json.dump(data, file, indent=4, ensure_ascii=False)

print(f"JSON exported: {json_path}")


# ----------------------------------
# Export each table to a CSV file
# ----------------------------------

for table_name, rows in data.items():

    csv_path = EXPORT_DIR / f"{table_name}.csv"

    if rows:
        fieldnames = list(rows[0].keys())

        with open(csv_path, "w", newline="", encoding="utf-8-sig") as file:
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    else:
        print(f"No data in {table_name}, CSV not created.")
        continue

    print(f"CSV exported: {csv_path}")


# Export conversations separately by exercise ID as well as in the combined CSV.
conversations_by_exercise = {}
for conversation in data["conversations"]:
    exercise_id = conversation["exercise_id"]
    if exercise_id is not None:
        conversations_by_exercise.setdefault(exercise_id, []).append(conversation)

for exercise_id, rows in sorted(conversations_by_exercise.items()):
    safe_exercise_id = quote(exercise_id, safe="")
    csv_path = EXPORT_DIR / f"conversations_{safe_exercise_id}.csv"
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"Exercise conversations exported: {csv_path}")


print("\nExport completed successfully!")
