#!/usr/bin/env python3
"""
Generate JavaScript data file from hydration_goals.csv for the dashboard.
This creates a scalable way to update the dashboard data without modifying the HTML.
"""

import csv
import json
import os
import re
import unicodedata
from datetime import datetime


def normalize_to_last_first(name: str) -> str:
    """Normalize name to 'Last, First' format, removing middle names."""
    # Clean Unicode whitespace artifacts
    name = "".join(
        c if unicodedata.category(c)[0] != "Z" or c == " " else " " for c in name
    )
    name = re.sub(r"\s+", " ", name).strip()
    # Normalize to "Last, First" format
    if "," in name:
        parts = name.split(",", 1)
        if len(parts) == 2:
            last_name = parts[0].strip()
            first_parts = parts[1].strip().split()
            if first_parts:
                first_name = first_parts[0]  # Take only the first name
                return f"{last_name}, {first_name}"
    return name


def normalize_date_for_filename(date_str: str) -> str:
    """Convert date string MM/DD/YYYY to filename format MM_DD_YYYY"""
    return date_str.replace("/", "_")


def generate_dashboard_data():
    """Read hydration_goals.csv and generate JavaScript data files for each date column."""

    csv_path = "hydration_goals.csv"

    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found!")
        return

    # Read CSV data and identify date columns
    all_rows = []
    date_columns = []

    with open(csv_path, "r", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        headers = reader.fieldnames

        if headers:
            # Find all date columns (MM/DD/YYYY format)
            for header in headers:
                if re.match(r"\d{1,2}/\d{1,2}/\d{4}", header):
                    date_columns.append(header)

        # Read all rows
        for row in reader:
            all_rows.append(row)

    # Sort date columns chronologically
    def sort_dates(date_str):
        try:
            return datetime.strptime(date_str, "%m/%d/%Y")
        except ValueError:
            return datetime.min

    date_columns.sort(key=sort_dates)

    print(f"📅 Found {len(date_columns)} date columns: {', '.join(date_columns)}")

    if not date_columns:
        print("⚠️  No date columns found in CSV!")
        return

    # Process each date column and create a separate file
    for date_col in date_columns:
        residents_data = []

        for row in all_rows:
            # Skip empty rows
            if not row.get("Resident Name", "").strip():
                continue

            # Parse the data
            name = row.get("Resident Name", "").strip().strip('"')
            # Clean Unicode whitespace artifacts (non-breaking spaces, etc.)
            name = "".join(
                c if unicodedata.category(c)[0] != "Z" or c == " " else " "
                for c in name
            )
            name = re.sub(r"\s+", " ", name).strip()
            goal = row.get("mL Goal", "").strip()
            source = row.get("Source File", "").strip()
            missed3_days = row.get("Missed 3 Days", "").strip().lower()
            date_value = row.get(date_col, "").strip()

            # Convert goal to number
            try:
                goal_num = float(goal) if goal else 0
            except ValueError:
                goal_num = 0

            # Convert date value to number
            try:
                data_value = float(date_value) if date_value else 0
            except ValueError:
                data_value = 0

            # Convert missed3_days to yes/no
            missed3_days_clean = "yes" if missed3_days == "yes" else "no"

            # Check if IPC data exists for this resident
            ipc_found_raw = row.get("IPC Found", "").strip().lower()
            ipc_found = ipc_found_raw if ipc_found_raw in ["yes", "no"] else "no"

            # Read infection and infection_type values
            infection_raw = row.get("Infection", "").strip()
            infection_type_raw = row.get("Infection Type", "").strip()

            # Convert "None" (from process_ipc_csv.py) or empty values to "-"
            if not infection_raw or infection_raw.lower() == "none":
                infection = "-"
            else:
                infection = infection_raw

            if not infection_type_raw or infection_type_raw.lower() == "none":
                infection_type = "-"
            else:
                infection_type = infection_type_raw

            residents_data.append(
                {
                    "name": name,
                    "goal": goal_num,
                    "source": source,
                    "missed3Days": missed3_days_clean,
                    "data": data_value,
                    "ipc_found": ipc_found,
                    "infection": infection,
                    "infection_type": infection_type,
                }
            )

        # Generate filename from date
        date_filename = normalize_date_for_filename(date_col)
        js_data_path = f"dashboard_{date_filename}.js"

        # Generate JavaScript data file
        js_content = f"""// Auto-generated dashboard data from hydration_goals.csv
// Generated on: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
// Date: {date_col}
// Total residents: {len(residents_data)}

const hydrationData = {json.dumps(residents_data, indent=12)};
"""

        # Write to JavaScript file
        with open(js_data_path, "w", encoding="utf-8") as file:
            file.write(js_content)

        print(
            f"✅ Generated {js_data_path} with {len(residents_data)} residents (date: {date_col})"
        )

    print(f"\n📊 Generated {len(date_columns)} dashboard files")


def validate_and_clean_dashboard_data():
    """
    Validate dashboard data files, check for duplicates, and merge them.
    Processes all dashboard_{date}.js files, identifies duplicates,
    and merges them by keeping the entry with the most recent/complete data.
    """
    import glob

    print("\n🔍 Validating dashboard data...")

    # Find all dashboard files
    dashboard_files = glob.glob("dashboard_*.js")

    if not dashboard_files:
        print("⚠️  No dashboard_*.js files found to validate")
        return

    print(f"📁 Found {len(dashboard_files)} dashboard files to process")

    # Process each dashboard file
    for js_data_path in dashboard_files:
        print(f"\n📄 Processing {js_data_path}...")

        if not os.path.exists(js_data_path):
            print(f"⚠️  File {js_data_path} not found, skipping")
            continue

        # Read the JavaScript file
        with open(js_data_path, "r", encoding="utf-8") as file:
            content = file.read()

        # Extract the JSON array from the JavaScript file
        match = re.search(r"const hydrationData = (\[.*?\]);", content, re.DOTALL)
        if not match:
            print(f"❌ Could not parse {js_data_path}")
            continue

        try:
            residents_data = json.loads(match.group(1))
        except json.JSONDecodeError as e:
            print(f"❌ Error parsing JSON from {js_data_path}: {e}")
            continue

        # Clean Unicode whitespace artifacts from names
        for resident in residents_data:
            name = resident["name"]
            cleaned_name = "".join(
                c if unicodedata.category(c)[0] != "Z" or c == " " else " "
                for c in name
            )
            cleaned_name = re.sub(r"\s+", " ", cleaned_name).strip()
            resident["name"] = cleaned_name

        print(f"📊 Found {len(residents_data)} total entries")

        name_groups = {}
        for resident in residents_data:
            original_name = resident["name"]
            normalized_name = normalize_to_last_first(original_name)
            if normalized_name not in name_groups:
                name_groups[normalized_name] = []
            name_groups[normalized_name].append(resident)

        # Merge duplicates
        final_data = residents_data

        # Identify duplicates
        duplicates = {
            name: entries for name, entries in name_groups.items() if len(entries) > 1
        }

        if duplicates:
            print(f"⚠️  Found {len(duplicates)} residents with duplicate entries:")
            for name, entries in duplicates.items():
                print(f"   - {name}: {len(entries)} entries")

            merged_data = []
            for name, entries in name_groups.items():
                if len(entries) == 1:
                    # No duplicates, keep as is
                    merged_data.append(entries[0])
                else:
                    # Merge duplicates - prioritize entries with more complete data
                    print(f"\n🔄 Merging {len(entries)} entries for: {name}")

                    # Count zeros in each entry
                    def count_zeros(entry):
                        zero_count = 0
                        if entry.get("goal", 0) == 0:
                            zero_count += 1
                        if entry.get("data", 0) == 0:
                            zero_count += 1
                        return zero_count

                    # Sort by zero count (lower is better)
                    entries_sorted = sorted(entries, key=lambda e: count_zeros(e))
                    best_entry = entries_sorted[0].copy()

                    # Merge data from other entries if they have better values
                    for entry in entries_sorted[1:]:
                        # Use the highest goal if available
                        if entry.get("goal", 0) > best_entry.get("goal", 0):
                            best_entry["goal"] = entry["goal"]

                        # Use the highest data value
                        if entry.get("data", 0) > best_entry.get("data", 0):
                            best_entry["data"] = entry["data"]

                        # Keep 'yes' for missed3Days if any entry has it
                        if entry.get("missed3Days") == "yes":
                            best_entry["missed3Days"] = "yes"

                    print(
                        f"   ✓ Merged into single entry with goal={best_entry.get('goal', 0)}, data={best_entry.get('data', 0)}"
                    )
                    merged_data.append(best_entry)
            # Sort by name for consistency
            merged_data.sort(key=lambda x: x["name"])
            final_data = merged_data
            print(
                f"\n✅ Merged data: {len(residents_data)} → {len(final_data)} entries"
            )
        else:
            print("✅ No duplicates found")

        # Filter out invalid entries with certain keywords
        invalid_keywords = [
            "admission",
            "admissiondate",
            "delusional",
            "delusions",
            "threatening",
            "bowel",
            "disorder",
            "stroke",
            "lacunar",
            "resisting",
            "fracture",
            "anxiety",
            "acute pain",
            "degeneration",
            "potential",
            "daily",
            "boost",
            "carb",
            "smart",
            "once",
            "corticobasal",
            "ganglia",
            "physician",
            "location",
            "unspecified",
        ]
        filtered_data = []
        filtered_out = []
        print(f"🔍 Filtering out invalid entries with certain keywords")
        print(f"🔍 Starting with {len(final_data)}")
        for resident in final_data:
            name_lower = resident["name"].lower()
            # Check if any invalid keyword is in the name
            if any(keyword in name_lower for keyword in invalid_keywords):
                filtered_out.append(resident["name"])
            else:
                filtered_data.append(resident)
        if filtered_out:
            print(f"🗑️  Filtered out {len(filtered_out)} invalid entries:")
            for name in filtered_out[:10]:  # Show first 10
                print(f"   - {name}")
            if len(filtered_out) > 10:
                print(f"   ... and {len(filtered_out) - 10} more")
        final_data = filtered_data
        print(f"📊 After filtering: {len(final_data)} entries remain")

        # Generate updated JavaScript file
        js_content = f"""// Auto-generated dashboard data from hydration_goals.csv
// Generated on: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
// Total residents: {len(final_data)}
// Validated and cleaned (duplicates merged)

const hydrationData = {json.dumps(final_data, indent=12)};
"""

        # Write back to file
        with open(js_data_path, "w", encoding="utf-8") as file:
            file.write(js_content)

        print(f"💾 Updated {js_data_path} with cleaned data")

        # Recalculate stats
        goal_met = sum(
            1 for r in final_data if r["goal"] > 0 and r.get("data", 0) >= r["goal"]
        )
        missed_3_days = sum(1 for r in final_data if r["missed3Days"] == "yes")

        print(f"\n📊 Final statistics for {js_data_path}:")
        print(f"   - Total residents: {len(final_data)}")
        print(f"   - Goal met: {goal_met}")
        print(f"   - Missed 3 days: {missed_3_days}")
        if len(final_data) > 0:
            print(
                f"   - Goal met percentage: {(goal_met / len(final_data) * 100):.1f}%"
            )


if __name__ == "__main__":
    generate_dashboard_data()

    # Validate and clean the generated data
    validate_and_clean_dashboard_data()
