#!/usr/bin/env python3
"""
Process IPC CSV files to match residents and add IPC data to hydration_goals.csv.
Adds IPC Found, Infection, and Infection Type columns based on name matching.
"""

import csv
import os
import re
import glob
from typing import Dict, List, Optional, Set, Tuple

def normalize_name_for_matching(name: str) -> Set[str]:
    """
    Normalize name for matching:
    - Convert to lowercase
    - Remove punctuation
    - Remove extra spaces
    - Tokenize by spaces/commas
    - Return set of core tokens
    """
    if not name:
        return set()
    
    # Convert to lowercase
    name = name.lower()
    
    # Remove punctuation (keep spaces and letters)
    name = re.sub(r'[^\w\s]', ' ', name)
    
    # Remove extra spaces and split
    tokens = [t.strip() for t in re.split(r'[\s,]+', name) if t.strip()]
    
    # Filter out very short tokens (like single letters) unless they're the only token
    if len(tokens) > 1:
        tokens = [t for t in tokens if len(t) > 1]
        
    # Filter out tokens that are "No Middle Name"
    tokens = [t for t in tokens if t.lower() != "no" and t.lower() != "middle" and t.lower() != "name"]
    
    return set(tokens)

def names_match(name1: str, name2: str) -> bool:
    """
    Check if two names match based on token overlap.
    Names match if all core tokens from the shorter name are in the longer name.
    Handles both "Last, First" and "First Last" formats.
    """
    
    tokens1 = normalize_name_for_matching(name1)
    tokens2 = normalize_name_for_matching(name2)
    
    if not tokens1 or not tokens2:
        return False
    
    # If one set is a subset of the other, they match
    if tokens1.issubset(tokens2) or tokens2.issubset(tokens1):
        return True
    
    # If they share all tokens from the shorter set, they match
    shorter = tokens1 if len(tokens1) <= len(tokens2) else tokens2
    longer = tokens2 if len(tokens1) <= len(tokens2) else tokens1
    
    # All tokens from shorter must be in longer
    return shorter.issubset(longer)

def load_ipc_data(ipc_data_dir: str) -> Dict[str, Tuple[str, str]]:
    """
    Load all IPC CSV files from ipc-data directory.
    Returns dict mapping normalized resident name to (infection_type, infection).
    If multiple entries exist for same resident, use the first non-empty one.
    """
    ipc_data: Dict[str, Tuple[str, str]] = {}
    
    if not os.path.exists(ipc_data_dir):
        print(f"  Warning: IPC data directory not found: {ipc_data_dir}")
        return ipc_data
    
    # Find all CSV files in ipc-data directory
    csv_files = glob.glob(os.path.join(ipc_data_dir, "*.csv"))
    
    if not csv_files:
        print(f"  Warning: No CSV files found in {ipc_data_dir}")
        return ipc_data
    
    print(f"  Found {len(csv_files)} IPC CSV file(s)")
    
    for csv_file in csv_files:
        print(f"  Processing {os.path.basename(csv_file)}...")
        try:
            with open(csv_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                for row in reader:
                    resident_name = row.get("Resident Name", "").strip()
                    infection_type = row.get("Infection Type", "").strip()
                    infection = row.get("Infection", "").strip()
                    
                    if not resident_name:
                        continue
                    
                    # Treat "Empty" as empty string
                    if infection_type.lower() == "empty":
                        infection_type = ""
                    if infection.lower() == "empty":
                        infection = ""
                    
                    # Use the resident name as-is for matching (we'll normalize during matching)
                    # If we already have data for this resident, prefer non-empty values
                    if resident_name in ipc_data:
                        existing_type, existing_infection = ipc_data[resident_name]
                        # Update if current values are non-empty and existing are empty
                        if not existing_type and infection_type:
                            ipc_data[resident_name] = (infection_type, existing_infection)
                        if not existing_infection and infection:
                            ipc_data[resident_name] = (existing_type, infection)
                    else:
                        ipc_data[resident_name] = (infection_type, infection)
        
        except Exception as e:
            print(f"  Error processing {csv_file}: {e}")
            continue
    
    print(f"  Loaded IPC data for {len(ipc_data)} unique residents")
    return ipc_data

def find_matching_ipc_resident(resident_name: str, ipc_data: Dict[str, Tuple[str, str]]) -> Optional[Tuple[str, str, str]]:
    """
    Find matching IPC resident for a given resident name.
    Returns (matched_ipc_name, infection_type, infection) or None.
    """
    for ipc_name, (infection_type, infection) in ipc_data.items():
        if names_match(resident_name, ipc_name):
            return (ipc_name, infection_type, infection)
    return None

def process_ipc_csv():
    """
    Main function to process IPC CSV files and update hydration_goals.csv.
    """
    csv_path = "hydration_goals.csv"
    ipc_data_dir = "ipc-data"
    
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found!")
        return
    
    # Load IPC data
    print("Loading IPC data...")
    ipc_data = load_ipc_data(ipc_data_dir)
    
    if not ipc_data:
        print("No IPC data found. Exiting.")
        return
    
    # Load hydration_goals.csv
    print(f"\nLoading {csv_path}...")
    rows: List[Dict[str, str]] = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        for row in reader:
            rows.append(row)
    
    if not rows:
        print("No rows found in hydration_goals.csv")
        return
    
    print(f"Found {len(rows)} residents in hydration_goals.csv")
    
    # Process each resident
    matches_found = 0
    for row in rows:
        resident_name = row.get("Resident Name", "").strip()
        if not resident_name:
            continue
        
        # Find matching IPC resident
        match = find_matching_ipc_resident(resident_name, ipc_data)
        
        if match:
            matched_ipc_name, infection_type, infection = match
            matches_found += 1
            print(f"  Match: '{resident_name}' -> '{matched_ipc_name}' (Infection: {infection}, Type: {infection_type})")
            
            # Set IPC data
            row["IPC Found"] = "yes"
            row["Infection"] = infection if infection else "-"
            row["Infection Type"] = infection_type if infection_type else "-"
        else:
            row["IPC Found"] = "no"
            row["Infection"] = "-"
            row["Infection Type"] = "-"
    
    print(f"\nFound {matches_found} matches out of {len(rows)} residents")
    
    # Update fieldnames to include IPC columns
    ipc_columns = ["IPC Found", "Infection", "Infection Type"]
    if fieldnames:
        # Add IPC columns after "Missed 3 Days" if it exists, otherwise at the end
        new_fieldnames = list(fieldnames)
        
        # Remove IPC columns if they already exist
        for col in ipc_columns:
            if col in new_fieldnames:
                new_fieldnames.remove(col)
        
        # Find position after "Missed 3 Days"
        if "Missed 3 Days" in new_fieldnames:
            idx = new_fieldnames.index("Missed 3 Days") + 1
            new_fieldnames[idx:idx] = ipc_columns
        else:
            # Add after base columns
            base_columns = ["Resident Name", "mL Goal", "Source File", "Has Feeding Tube"]
            last_base_idx = -1
            for i, col in enumerate(new_fieldnames):
                if col in base_columns:
                    last_base_idx = i
            
            if last_base_idx >= 0:
                new_fieldnames[last_base_idx + 1:last_base_idx + 1] = ipc_columns
            else:
                new_fieldnames.extend(ipc_columns)
        
        fieldnames = new_fieldnames
    else:
        fieldnames = ["Resident Name", "mL Goal", "Source File", "Has Feeding Tube", "Missed 3 Days"] + ipc_columns
    
    # Ensure all rows have IPC columns
    for row in rows:
        for col in ipc_columns:
            if col not in row:
                row[col] = ""
    
    # Save updated CSV
    print(f"\nSaving updated {csv_path}...")
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    
    print(f"✅ Successfully updated {csv_path} with IPC data")

if __name__ == "__main__":
    process_ipc_csv()

