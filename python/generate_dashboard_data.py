#!/usr/bin/env python3
"""
Generate JavaScript data file from hydration_goals.csv for the dashboard.
This creates a scalable way to update the dashboard data without modifying the HTML.
"""

import csv
import json
import os

def generate_dashboard_data():
    """Read hydration_goals.csv and generate JavaScript data file."""
    
    csv_path = "hydration_goals.csv"
    js_data_path = "dashboard_data.js"
    
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found!")
        return
    
    # Read CSV data
    residents_data = []
    
    with open(csv_path, 'r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            # Skip empty rows
            if not row.get('Resident Name', '').strip():
                continue
                
            # Parse the data
            name = row.get('Resident Name', '').strip().strip('"')
            goal = row.get('mL Goal', '').strip()
            source = row.get('Source File', '').strip()
            missed3_days = row.get('Missed 3 Days', '').strip().lower()
            day_14 = row.get('Day 14', '').strip()
            day_15 = row.get('Day 15', '').strip()
            day_16 = row.get('Day 16', '').strip()
            yesterday = row.get('Yesterdays', '').strip()
            
            # Convert goal to number
            try:
                goal_num = float(goal) if goal else 0
            except ValueError:
                goal_num = 0
            
            # Convert day values to numbers
            try:
                day_14_num = float(day_14) if day_14 else 0
            except ValueError:
                day_14_num = 0
                
            try:
                day_15_num = float(day_15) if day_15 else 0
            except ValueError:
                day_15_num = 0
                
            try:
                day_16_num = float(day_16) if day_16 else 0
            except ValueError:
                day_16_num = 0
            
            # Convert yesterday to number
            try:
                yesterday_num = float(yesterday) if yesterday else 0
            except ValueError:
                yesterday_num = 0
            
            # Convert missed3_days to yes/no
            missed3_days_clean = 'yes' if missed3_days == 'yes' else 'no'
            
            residents_data.append({
                "name": name,
                "goal": goal_num,
                "source": source,
                "missed3Days": missed3_days_clean,
                "day14": day_14_num,
                "day15": day_15_num,
                "day16": day_16_num,
                "yesterday": yesterday_num
            })
    
    # Generate JavaScript data file
    js_content = f"""// Auto-generated dashboard data from hydration_goals.csv
// Generated on: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
// Total residents: {len(residents_data)}

const hydrationData = {json.dumps(residents_data, indent=12)};
"""
    
    # Write to JavaScript file
    with open(js_data_path, 'w', encoding='utf-8') as file:
        file.write(js_content)
    
    print(f"✅ Generated {js_data_path} with {len(residents_data)} residents")
    print(f"📊 Data includes:")
    print(f"   - Total residents: {len(residents_data)}")
    
    # Calculate some stats
    goal_met = sum(1 for r in residents_data if r['goal'] > 0 and r['yesterday'] >= r['goal'])
    missed_3_days = sum(1 for r in residents_data if r['missed3Days'] == 'yes')
    
    print(f"   - Goal met today: {goal_met}")
    print(f"   - Missed 3 days: {missed_3_days}")
    if len(residents_data) > 0:
        print(f"   - Goal met percentage: {(goal_met/len(residents_data)*100):.1f}%")
    else:
        print(f"   - Goal met percentage: 0.0%")

def validate_and_clean_dashboard_data():
    """
    Validate dashboard data, check for duplicates, and merge them.
    Reads the generated dashboard_data.js file, identifies duplicates,
    and merges them by keeping the entry with the most recent/complete data.
    """
    import os
    import re
    
    js_data_path = "dashboard_data.js"
    
    if not os.path.exists(js_data_path):
        print("⚠️  No dashboard_data.js file found to validate")
        return
    
    print("\n🔍 Validating dashboard data...")
    
    # Read the JavaScript file
    with open(js_data_path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # Extract the JSON array from the JavaScript file
    match = re.search(r'const hydrationData = (\[.*?\]);', content, re.DOTALL)
    if not match:
        print("❌ Could not parse dashboard_data.js")
        return
    
    try:
        residents_data = json.loads(match.group(1))
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing JSON: {e}")
        return
    
    print(f"📊 Found {len(residents_data)} total entries")
    
    # Find duplicates by name
    name_groups = {}
    for resident in residents_data:
        name = resident['name']
        if name not in name_groups:
            name_groups[name] = []
        name_groups[name].append(resident)
    
    # Merge duplicates
    final_data = residents_data

    # Identify duplicates
    duplicates = {name: entries for name, entries in name_groups.items() if len(entries) > 1}
    
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
                    if entry.get('goal', 0) == 0:
                        zero_count += 1
                    if entry.get('yesterday', 0) == 0:
                        zero_count += 1
                    if entry.get('day16', 0) == 0:
                        zero_count += 1
                    if entry.get('day15', 0) == 0:
                        zero_count += 1
                    if entry.get('day14', 0) == 0:
                        zero_count += 1
                    return zero_count
                
                # Sort by zero count (lower is better)
                entries_sorted = sorted(entries, key=lambda e: count_zeros(e))
                best_entry = entries_sorted[0].copy()
                
                # Merge data from other entries if they have better values
                for entry in entries_sorted[1:]:
                    # Use the highest goal if available
                    if entry.get('goal', 0) > best_entry.get('goal', 0):
                        best_entry['goal'] = entry['goal']
                    
                    # Use the highest yesterday value
                    if entry.get('yesterday', 0) > best_entry.get('yesterday', 0):
                        best_entry['yesterday'] = entry['yesterday']
                    
                    # Use the highest day values
                    for day in ['day14', 'day15', 'day16']:
                        if entry.get(day, 0) > best_entry.get(day, 0):
                            best_entry[day] = entry[day]
                    
                    # Keep 'yes' for missed3Days if any entry has it
                    if entry.get('missed3Days') == 'yes':
                        best_entry['missed3Days'] = 'yes'
                
                print(f"   ✓ Merged into single entry with goal={best_entry.get('goal', 0)}, yesterday={best_entry.get('yesterday', 0)}")
                merged_data.append(best_entry)
        # Sort by name for consistency
        merged_data.sort(key=lambda x: x['name'])
        final_data = merged_data
        print(f"\n✅ Merged data: {len(residents_data)} → {len(final_data)} entries")
    else:
        print("✅ No duplicates found")
    
    

    # Filter out invalid entries with certain keywords
    invalid_keywords = [
        'admission',
        'admissiondate',
        'delusional',
        'delusions',
        'threatening',
        'bowel',
        'disorder',
        'stroke',
        'lacunar',
        'resisting',
        'fracture',
        'anxiety',
        'acute pain',
        'degeneration',
        'potential',
        'daily',
        'boost',
        'carb',
        'smart',
        'once',
        'corticobasal',
        'ganglia'
    ]
    filtered_data = []
    filtered_out = []
    print(f"🔍 Filtering out invalid entries with certain keywords: {invalid_keywords}")
    print(f"🔍 Starting with {len(final_data)}")
    for resident in final_data:
        name_lower = resident['name'].lower()
        # Check if any invalid keyword is in the name
        if any(keyword in name_lower for keyword in invalid_keywords):
            filtered_out.append(resident['name'])
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
// Generated on: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
// Total residents: {len(final_data)}
// Validated and cleaned (duplicates merged)

const hydrationData = {json.dumps(final_data, indent=12)};
"""
    
    # Write back to file
    with open(js_data_path, 'w', encoding='utf-8') as file:
        file.write(js_content)
    
    print(f"💾 Updated {js_data_path} with cleaned data")
    
    # Recalculate stats
    goal_met = sum(1 for r in final_data if r['goal'] > 0 and r['yesterday'] >= r['goal'])
    missed_3_days = sum(1 for r in final_data if r['missed3Days'] == 'yes')
    
    print(f"\n📊 Final statistics:")
    print(f"   - Total residents: {len(final_data)}")
    print(f"   - Goal met today: {goal_met}")
    print(f"   - Missed 3 days: {missed_3_days}")
    if len(final_data) > 0:
        print(f"   - Goal met percentage: {(goal_met/len(final_data)*100):.1f}%")


if __name__ == "__main__":
    generate_dashboard_data()

    # Validate and clean the generated data
    validate_and_clean_dashboard_data()
