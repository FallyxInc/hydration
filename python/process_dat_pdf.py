#!/usr/bin/env python3
"""
Process Dat.pdf to extract resident names and daily totals,
then update hydration_goals.csv with yesterday's consumption data.
"""

import csv
import os
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

# PDF parsing
try:
    from PyPDF2 import PdfReader
    PYPDF2_AVAILABLE = True
except Exception:
    PYPDF2_AVAILABLE = False

def read_pdf_text(path: str) -> str:
    if PYPDF2_AVAILABLE:
        try:
            reader = PdfReader(path)
            return "\n".join([(p.extract_text() or "") for p in reader.pages])
        except Exception:
            pass
    raise RuntimeError("Please install PyPDF2 to parse PDFs.")

def clean_name(name: str) -> str:
    """Clean name by normalizing Unicode whitespace (including non-breaking spaces) to regular spaces."""
    import unicodedata
    # Replace all Unicode whitespace characters (including \u00a0 non-breaking space) with regular spaces
    name = ''.join(c if unicodedata.category(c)[0] != 'Z' or c == ' ' else ' ' for c in name)
    # Collapse multiple spaces to single space and strip
    name = re.sub(r'\s+', ' ', name).strip()
    return name

def extract_resident_name(text: str) -> Optional[str]:
    """Extract the FULL resident name from PDF format."""
    # Pattern 1: Look for "Resident Name:" format in hydration-data PDFs
    # Format: "Total By Day 1125.0 1625.0 1125.0Resident Name: SE BOONG BAI Resident Location: 5A 522 - 2"
    if "Resident Name:" in text:
        parts = text.split("Resident Name:")
        if len(parts) > 1:
            after_name = parts[1]
            if "Resident Location:" in after_name:
                name_part = after_name.split("Resident Location:")[0]
                name = name_part.strip().upper()
                name = clean_name(name)
                
                # Remove trailing non-letter characters (like 'R' at the end)
                name = re.sub(r'[^A-Z\s'']+$', '', name).strip()
                
                # Remove trailing 'R' only if it's clearly a trailing character (not part of a name like SALAZAR)
                # Only remove if the name ends with 'R' and the second-to-last character is not a letter
                if name.endswith('R') and len(name) > 1:
                    # Check if the 'R' is likely a trailing character (preceded by non-letter or single letter)
                    second_last_char = name[-2] if len(name) >= 2 else ''
                    if not second_last_char.isalpha() or (len(name) == 2 and name[-1] == 'R'):
                        name = name[:-1]
                
                # Convert to "LAST, FIRST" format - simple rule: last word is last name, rest is first name
                parts = name.split()
                if len(parts) >= 2:
                    last_name = parts[-1]  # Last word is the last name
                    first_name = ' '.join(parts[:-1])  # Everything else is first name
                    return f"{last_name}, {first_name}"
                
                return name
    
    # Pattern 2: Look for "LAST, FIRST (ID)" format in care plan PDFs
    # This matches patterns like "BAI, SE BOONG (900051001725)" or "McCALLA, KITT ROY (900051001932)"
    m = re.search(r"([A-Z][A-Z\s'']+),\s*([A-Z][A-Z\s'']+)\s*\([0-9]+\)", text)
    if m:
        last_name = clean_name(m.group(1).strip())
        first_name = clean_name(m.group(2).strip())
        return f"{last_name}, {first_name}"
    
    # Pattern 3: Look for standalone name patterns like "BAI, SE BOONG" without ID
    m = re.search(r"([A-Z][A-Z\s'']+),\s*([A-Z][A-Z\s'']+)(?=\s*\(|\s*$|\s*\d)", text)
    if m:
        last_name = clean_name(m.group(1).strip())
        first_name = clean_name(m.group(2).strip())
        return f"{last_name}, {first_name}"
    
    return None

def extract_total_by_day(text: str) -> List[float]:
    """Extract the three 'Total By Day' values."""
    totals: List[float] = []
    
    # Pattern 1: Concatenated format like "Total By Day2200.02250.01275.0" or "Total By Day1675.01600.0950.0"
    m = re.search(r"Total\s*By\s*Day(\d{3,4})\.0(\d{3,4})\.0(\d{3,4})\.0", text, flags=re.IGNORECASE)
    if m:
        try:
            day1 = float(m.group(1) + ".0")  # "1675.0" or "2200.0"
            day2 = float(m.group(2) + ".0")  # "1600.0" or "2250.0" 
            day3 = float(m.group(3) + ".0")  # "950.0" or "1275.0"
            totals = [day1, day2, day3]
        except ValueError:
            pass
    
    # Pattern 2: Space-separated format like "Total By Day 1775.0 1850.0 1750.0" or "0.0 0.0 0.0"
    if not totals:
        m = re.search(r"Total\s*By\s*Day\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)", text, flags=re.IGNORECASE)
        if m:
            try:
                day1 = float(m.group(1))
                day2 = float(m.group(2))
                day3 = float(m.group(3))
                totals = [day1, day2, day3]
            except ValueError:
                pass
    
    # Fallback: look for "Total By Day" followed by any numbers
    if not totals:
        lines = text.splitlines()
        for line in lines:
            if "Total By Day" in line:
                # Extract all numbers after "Total By Day"
                numbers = re.findall(r"(\d{3,}(?:\.\d+)?)", line)
                if len(numbers) >= 3:
                    try:
                        totals = [float(x.replace(",", "")) for x in numbers[:3]]
                    except ValueError:
                        pass
                break
    
    return totals

def extract_start_date(text: str) -> Optional[datetime]:
    """Extract the start date from PDF text in format 'Start Date: 10/14/2025'."""
    m = re.search(r"Start\s*Date:\s*(\d{1,2})/(\d{1,2})/(\d{4})", text, flags=re.IGNORECASE)
    if m:
        try:
            month = int(m.group(1))
            day = int(m.group(2))
            year = int(m.group(3))
            return datetime(year, month, day)
        except (ValueError, IndexError):
            pass
    return None

def calculate_date_columns(start_date: datetime) -> List[str]:
    """Calculate the three date column names based on start date."""
    dates = []
    for i in range(3):
        date = start_date + timedelta(days=i)
        dates.append(date.strftime("%m/%d/%Y"))
    return dates

def normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip()).upper()

def find_matching_resident(name: str, name_to_idx: Dict[str, int]) -> Optional[int]:
    """Find matching resident, trying multiple name variations."""
    normalized = normalize_name(name)
    
    # Try exact match first
    if normalized in name_to_idx:
        return name_to_idx[normalized]
    
    # Try different name order variations
    # For names like "SE BOONG BAI" -> try "BAI, SE BOONG"
    if ',' not in normalized and ' ' in normalized:
        parts = normalized.split()
        if len(parts) >= 2:
            # Try moving the last part to the front: "SE BOONG BAI" -> "BAI, SE BOONG"
            last_name = parts[-1]
            first_names = ' '.join(parts[:-1])
            reversed_name = f"{last_name}, {first_names}"
            if reversed_name in name_to_idx:
                return name_to_idx[reversed_name]
            
            # Try moving the first part to the end: "SE BOONG BAI" -> "BOONG BAI, SE"
            if len(parts) >= 3:
                first_name = parts[0]
                last_names = ' '.join(parts[1:])
                alternative_name = f"{last_names}, {first_name}"
                if alternative_name in name_to_idx:
                    return name_to_idx[alternative_name]
    
    # Try without common prefixes (including variations with different apostrophe types)
    prefixes = {'DE ', 'VAN ', 'VON ', 'LE ', 'LA ', 'EL ', 'DA ', 'DOS ', 'DAS ', 'DI ', 'DEL ', 'DU ', 'MAC ', 'MC ', "O'", 'O`', 'SAINT ', 'ST '}
    
    for prefix in prefixes:
        if normalized.startswith(prefix):
            # Try without the prefix
            without_prefix = normalized[len(prefix):].strip()
            if without_prefix in name_to_idx:
                return name_to_idx[without_prefix]
        elif ' ' + prefix in normalized:
            # For names like "CARLOS DE FARIA", try "FARIA, CARLOS" format
            parts = normalized.split()
            for i, part in enumerate(parts):
                if part == prefix.strip() and i > 0:
                    # Move prefix to the end: "CARLOS DE FARIA" -> "FARIA, CARLOS"
                    new_parts = parts[:i] + parts[i+1:] + [part]
                    new_name = ' '.join(new_parts)
                    if new_name in name_to_idx:
                        return name_to_idx[new_name]
                    break
    
    # Try fuzzy matching - check if any name in the CSV contains the key parts
    # Split the name into parts and try to match with existing names
    name_parts = set(normalized.replace(',', '').split())
    if name_parts and len(name_parts) >= 2:
        best_match = None
        best_match_count = 0
        
        for existing_name, idx in name_to_idx.items():
            existing_parts = set(existing_name.replace(',', '').split())
            common_parts = name_parts & existing_parts
            
            # Require that the last name (first part after comma) matches exactly
            # Extract last names from both
            if ',' in normalized:
                extracted_last = normalized.split(',')[0].strip()
            else:
                extracted_last = normalized.split()[-1]
            
            if ',' in existing_name:
                csv_last = existing_name.split(',')[0].strip()
            else:
                csv_last = existing_name.split()[-1] if ' ' in existing_name else existing_name
            
            # Last name must match for fuzzy matching to work
            # But handle prefixes like "DA SILVA" vs "SILVA"
            prefixes = {'DE', 'VAN', 'VON', 'LE', 'LA', 'EL', 'DA', 'DOS', 'DAS', 'DI', 'DEL', 'DU', 'MAC', 'MC', 'SAINT', 'ST'}
            
            # Try to match last names, considering prefixes and compound surnames
            last_names_match = False
            
            
            # Direct match
            if extracted_last == csv_last:
                last_names_match = True
            else:
                # Try removing prefixes from both
                for prefix in prefixes:
                    # Remove prefix from extracted_last
                    if extracted_last.startswith(prefix + ' '):
                        extracted_without_prefix = extracted_last[len(prefix + ' '):].strip()
                    else:
                        extracted_without_prefix = extracted_last
                    
                    # Remove prefix from csv_last
                    if csv_last.startswith(prefix + ' '):
                        csv_without_prefix = csv_last[len(prefix + ' '):].strip()
                    else:
                        csv_without_prefix = csv_last
                    
                    # Check if they match without prefixes
                    if extracted_without_prefix == csv_without_prefix:
                        last_names_match = True
                        break
                    
                    # Check if one has prefix and other doesn't
                    if (extracted_without_prefix == csv_last) or (extracted_last == csv_without_prefix):
                        last_names_match = True
                        break
                
                # Try compound surname matching (e.g., "SHILLINGFORD JACKSON" vs "JACKSON SHILLINGFORD")
                if not last_names_match:
                    extracted_words = set(extracted_last.split())
                    csv_words = set(csv_last.split())
                    
                    # If they have the same words but in different order, it's a match
                    if extracted_words == csv_words and len(extracted_words) > 1:
                        last_names_match = True
                    
                    # Also try matching any part of the compound surname
                    if not last_names_match and (len(extracted_words) > 1 or len(csv_words) > 1):
                        # Check if any significant word from one matches any from the other
                        common_words = extracted_words.intersection(csv_words)
                        if len(common_words) >= 1:
                            # If they share at least one significant word, consider it a match
                            last_names_match = True
            
            if not last_names_match:
                continue
            
            # Count matching parts
            match_count = len(common_parts)
            
            # If this is a better match, remember it
            if match_count > best_match_count and match_count >= min(2, len(name_parts)):
                best_match = idx
                best_match_count = match_count
        
        if best_match is not None:
            return best_match
    
    return None

def load_goals(csv_path: str) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    if not os.path.exists(csv_path):
        return rows
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)
    return rows

def save_goals(csv_path: str, rows: List[Dict[str, str]], all_date_columns: set = None) -> None:
    """Save goals with all date columns. all_date_columns should contain date strings in MM/DD/YYYY format."""
    base_fieldnames = ["Resident Name", "mL Goal", "Source File", "Has Feeding Tube", "Missed 3 Days"]
    
    if rows:
        existing_fieldnames = set(rows[0].keys())
        date_columns = set()
        
        for row in rows:
            for key in row.keys():
                if re.match(r'\d{1,2}/\d{1,2}/\d{4}', key):
                    date_columns.add(key)
        
        if all_date_columns:
            date_columns.update(all_date_columns)
        
        sorted_date_columns = sorted(date_columns, key=lambda x: datetime.strptime(x, "%m/%d/%Y"))
        
        fieldnames = base_fieldnames + sorted_date_columns
        other_columns = [f for f in existing_fieldnames if f not in base_fieldnames and f not in date_columns]
        fieldnames.extend(sorted(other_columns))
    else:
        fieldnames = base_fieldnames
        if all_date_columns:
            sorted_date_columns = sorted(all_date_columns, key=lambda x: datetime.strptime(x, "%m/%d/%Y"))
            fieldnames.extend(sorted_date_columns)
    
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            r.setdefault("Missed 3 Days", "")
            for fieldname in fieldnames:
                r.setdefault(fieldname, "")
            writer.writerow(r)

def process_dat_pdf(rows: List[Dict[str, str]], pdf_path: str, is_extra: bool = False) -> Tuple[List[Dict[str, str]], set]:
    """Process Dat.pdf and update the CSV rows. If is_extra=True, add values to existing data.
    Returns (updated rows, set of all date columns encountered)"""
    name_to_idx: Dict[str, int] = {}
    for i, r in enumerate(rows):
        r.setdefault("Missed 3 Days", "")
        n = normalize_name(r.get("Resident Name", ""))
        if n:
            name_to_idx[n] = i

    all_date_columns = set()
    default_start_date = None
    
    # Read the PDF and process each page
    from PyPDF2 import PdfReader
    reader = PdfReader(pdf_path)
    
    # First pass: find the most common start date to use as fallback
    start_date_counts = {}
    for page_num, page in enumerate(reader.pages):
        page_text = page.extract_text()
        start_date = extract_start_date(page_text)
        if start_date:
            date_str = start_date.strftime("%m/%d/%Y")
            start_date_counts[date_str] = start_date_counts.get(date_str, 0) + 1
    
    if start_date_counts:
        most_common_date_str = max(start_date_counts, key=start_date_counts.get)
        try:
            default_start_date = datetime.strptime(most_common_date_str, "%m/%d/%Y")
        except ValueError:
            pass
    
    # If no start dates found in file, use yesterday minus 2 days as default
    if default_start_date is None:
        default_start_date = datetime.now() - timedelta(days=2)
        print(f"  Warning: No start dates found in PDF, using default: {default_start_date.strftime('%m/%d/%Y')}")
    
    # Second pass: process all pages
    reader = PdfReader(pdf_path)
    for page_num, page in enumerate(reader.pages):
        page_text = page.extract_text()
        res_name = extract_resident_name(page_text)
        totals = extract_total_by_day(page_text)
        start_date = extract_start_date(page_text)
        
        if not res_name or not totals:
            continue
        
        # Use default start date if not found on this page
        if not start_date:
            start_date = default_start_date
            print(f"  Warning: No start date found for {res_name} on page {page_num + 1}, using default: {start_date.strftime('%m/%d/%Y')}")

        # Calculate the three date columns based on start date
        date_columns = calculate_date_columns(start_date)
        all_date_columns.update(date_columns)
        
        # Store individual day values
        day1_value = totals[0] if len(totals) > 0 else 0
        day2_value = totals[1] if len(totals) > 1 else 0
        day3_value = totals[2] if len(totals) > 2 else 0
        
        idx = find_matching_resident(res_name, name_to_idx)
        if idx is None:
            print(f"  Skipping {res_name} - not found in existing residents")
            continue
        
        if is_extra:
            # This is extra hydration - ADD to existing values for each date
            try:
                existing_day1 = float(rows[idx].get(date_columns[0], "") or 0)
                existing_day2 = float(rows[idx].get(date_columns[1], "") or 0)
                existing_day3 = float(rows[idx].get(date_columns[2], "") or 0)
                
                new_day1 = existing_day1 + day1_value
                new_day2 = existing_day2 + day2_value
                new_day3 = existing_day3 + day3_value
                
                print(f"Processing EXTRA {res_name}: {totals} ({date_columns[0]}: {day1_value} + {existing_day1} = {new_day1}, {date_columns[1]}: {day2_value} + {existing_day2} = {new_day2}, {date_columns[2]}: {day3_value} + {existing_day3} = {new_day3})")
                
                rows[idx][date_columns[0]] = f"{new_day1}"
                rows[idx][date_columns[1]] = f"{new_day2}"
                rows[idx][date_columns[2]] = f"{new_day3}"
            except ValueError as e:
                print(f"  Warning: Could not parse existing values for {res_name}, setting to new values: {e}")
                rows[idx][date_columns[0]] = f"{day1_value}"
                rows[idx][date_columns[1]] = f"{day2_value}"
                rows[idx][date_columns[2]] = f"{day3_value}"
        else:
            # Regular hydration - set all values
            print(f"Processing {res_name}: {totals} (dates: {date_columns})")
            
            existing_source = rows[idx].get("Source File", "")
            if not existing_source:
                rows[idx]["Source File"] = f"{os.path.basename(pdf_path)} - Page {page_num + 1}"
            
            rows[idx][date_columns[0]] = f"{day1_value}"
            rows[idx][date_columns[1]] = f"{day2_value}"
            rows[idx][date_columns[2]] = f"{day3_value}"

    return rows, all_date_columns

def calculate_missed_3_days(rows: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """Calculate 'Missed 3 Days' status - checks if there are any 3 consecutive days below goal.
    Also checks if there are 3 consecutive days with value 0 (no data)."""
    for row in rows:
        goal_raw = row.get("mL Goal", "")
        try:
            goal = float(str(goal_raw).replace(",", "")) if str(goal_raw).strip() else None
        except Exception:
            goal = None

        if goal is not None:
            # Find all date columns and sort them
            date_columns = []
            for key in row.keys():
                if re.match(r'\d{1,2}/\d{1,2}/\d{4}', key):
                    try:
                        date_obj = datetime.strptime(key, "%m/%d/%Y")
                        date_columns.append((date_obj, key))
                    except ValueError:
                        continue
            
            date_columns.sort()
            missed_3_days = False
            
            # Check all possible 3 consecutive day windows
            if len(date_columns) >= 3:
                for i in range(len(date_columns) - 2):
                    date1 = date_columns[i]
                    date2 = date_columns[i + 1]
                    date3 = date_columns[i + 2]
                    
                    # Check if these dates are consecutive
                    if (date2[0] - date1[0]).days == 1 and (date3[0] - date2[0]).days == 1:
                        try:
                            val1 = float(row.get(date1[1], "") or 0)
                            val2 = float(row.get(date2[1], "") or 0)
                            val3 = float(row.get(date3[1], "") or 0)
                            
                            # Check if all three days are 0 (no data) OR all three are below goal
                            if (val1 == 0 and val2 == 0 and val3 == 0) or (val1 < goal and val2 < goal and val3 < goal):
                                missed_3_days = True
                                break
                        except ValueError:
                            continue
            
            row["Missed 3 Days"] = "yes" if missed_3_days else "no"
        else:
            row["Missed 3 Days"] = "no"
    
    return rows

def main():
    csv_path = "hydration_goals.csv"
    
    # Automatically find all PDF files in the hydration-data directory only
    import glob
    pdf_files = glob.glob("hydration-data/**/*.pdf", recursive=True)
    
    # Separate regular files from extra files
    regular_files = []
    extra_files = []
    
    for pdf_file in pdf_files:
        if 'extra' in pdf_file.lower():
            extra_files.append(pdf_file)
        else:
            regular_files.append(pdf_file)
    
    # Sort the files for consistent processing order
    regular_files.sort()
    extra_files.sort()
    
    if not regular_files and not extra_files:
        print("No PDF files found in hydration-data/ directory")
        return
    
    print(f"Found {len(regular_files)} regular PDF files and {len(extra_files)} extra PDF files")
    print("\nRegular files:")
    for pdf_file in regular_files:
        print(f"  {pdf_file}")
    if extra_files:
        print("\nExtra files (will be added to existing data):")
        for pdf_file in extra_files:
            print(f"  {pdf_file}")
    
    rows = load_goals(csv_path)
    all_date_columns = set()
    
    # Process regular PDF files first
    for pdf_path in regular_files:
        print(f"\nProcessing {pdf_path}...")
        rows, date_cols = process_dat_pdf(rows, pdf_path, is_extra=False)
        all_date_columns.update(date_cols)
    
    # Then process extra files (these ADD to the existing values)
    if extra_files:
        print("\n" + "=" * 80)
        print("PROCESSING EXTRA HYDRATION FILES (adding to existing values)")
        print("=" * 80)
        for pdf_path in extra_files:
            print(f"\nProcessing EXTRA file {pdf_path}...")
            rows, date_cols = process_dat_pdf(rows, pdf_path, is_extra=True)
            all_date_columns.update(date_cols)
    
    # Calculate "Missed 3 Days" status after all processing is complete
    print("\nCalculating 'Missed 3 Days' status based on final values...")
    rows = calculate_missed_3_days(rows)
    
    save_goals(csv_path, rows, all_date_columns)
    print(f"\nUpdated {csv_path} using {len(regular_files)} regular PDF file(s) and {len(extra_files)} extra PDF file(s)")
    print(f"Created {len(all_date_columns)} date columns: {sorted(all_date_columns, key=lambda x: datetime.strptime(x, '%m/%d/%Y'))}")

if __name__ == "__main__":
    main()
