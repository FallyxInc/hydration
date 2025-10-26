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

if __name__ == "__main__":
    generate_dashboard_data()
