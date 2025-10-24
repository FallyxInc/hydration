# Parse Care Plan PDFs to extract Resident Name and mL Goal (FLUID TARGET)
# and output a CSV file: /Users/ayaan/Downloads/hydration/hydration_goals.csv

import re
import os
import csv
from typing import Optional, Tuple, List

# We'll try pdfminer.six first (commonly available). If not, fall back to PyPDF2 text.
try:
    from pdfminer.high_level import extract_text
    PDFMINER_AVAILABLE = True
except Exception as e:
    PDFMINER_AVAILABLE = False

try:
    from PyPDF2 import PdfReader
    PYPDF2_AVAILABLE = True
except Exception as e:
    PYPDF2_AVAILABLE = False

# Automatically find all PDF files in the care-plans directory
import glob
CARE_PLAN_FILES = glob.glob("care-plans/*.pdf")

def read_pdf_text(path: str) -> str:
    """Return concatenated text of a PDF using available backends."""
    if PDFMINER_AVAILABLE:
        try:
            return extract_text(path) or ""
        except Exception as e:
            pass
    if PYPDF2_AVAILABLE:
        try:
            reader = PdfReader(path)
            texts = []
            for page in reader.pages:
                try:
                    texts.append(page.extract_text() or "")
                except Exception:
                    texts.append("")
            return "\n".join(texts)
        except Exception:
            pass
    raise RuntimeError("No PDF backend available to read PDF text. Install pdfminer.six or PyPDF2.")

def read_pdf_pages(path: str) -> List[str]:
    """Return list of text from each page of a PDF."""
    if PYPDF2_AVAILABLE:
        try:
            reader = PdfReader(path)
            pages = []
            for page in reader.pages:
                try:
                    pages.append(page.extract_text() or "")
                except Exception:
                    pages.append("")
            return pages
        except Exception:
            pass
    # Fallback: split the full text by page breaks if we can't get individual pages
    try:
        full_text = read_pdf_text(path)
        # Simple heuristic: split by multiple newlines that might indicate page breaks
        pages = [page.strip() for page in re.split(r'\n\s*\n\s*\n', full_text) if page.strip()]
        return pages if pages else [full_text]
    except Exception:
        return [read_pdf_text(path)]

def is_medication_or_instruction(text: str) -> bool:
    """
    Check if the text is likely a medication or instruction rather than a resident name.
    """
    text_lower = text.lower()
    
    # Common medication/instruction keywords
    medication_keywords = [
        'promote', 'regular', 'bowel', 'movements', 'med', 'pass', 'morning', 'evening',
        'tablet', 'capsule', 'mg', 'ml', 'dose', 'daily', 'twice', 'three times',
        'before', 'after', 'with', 'food', 'water', 'juice', 'milk', 'breakfast',
        'lunch', 'dinner', 'bedtime', 'as needed', 'prn', 'twice daily', 'tid', 'bid',
        'qid', 'qhs', 'qam', 'qpm', 'hs', 'ac', 'pc', 'po', 'iv', 'im', 'sc', 'sl',
        'topical', 'cream', 'ointment', 'drops', 'spray', 'inhaler', 'patch',
        'suppository', 'enema', 'injection', 'syringe', 'vial', 'bottle', 'packet',
        'pill', 'capsule', 'tablet', 'liquid', 'suspension', 'solution', 'gel',
        'lotion', 'powder', 'granules', 'chewable', 'extended release', 'sustained release',
        'controlled release', 'immediate release', 'delayed release', 'enteric coated',
        'film coated', 'sugar coated', 'uncoated', 'scored', 'unscored'
    ]
    
    # Check if text contains medication keywords
    if any(keyword in text_lower for keyword in medication_keywords):
        return True
    
    # Check if text is too long (likely not a name)
    if len(text) > 50:
        return True
    
    # Check if text contains numbers in the middle (likely medication)
    if re.search(r'\d+', text) and not re.search(r'\(\d{4,}\)', text):
        return True
    
    # Check if text contains common medication patterns
    medication_patterns = [
        r'\b\d+\s*mg\b',  # "10 mg"
        r'\b\d+\s*ml\b',  # "5 ml"
        r'\b\d+\s*times?\b',  # "2 times"
        r'\b\d+\s*x\s*\d+\b',  # "2x3"
        r'\b\d+\s*/\s*\d+\b',  # "1/2"
        r'\b\d+\s*-\s*\d+\b',  # "1-2"
        r'\b\d+\s*to\s*\d+\b',  # "1 to 2"
    ]
    
    if any(re.search(pattern, text_lower) for pattern in medication_patterns):
        return True
    
    return False

def extract_resident_names(text: str, debug=False) -> List[str]:
    """
    Find ALL resident names in text - capture the FULL name including all parts.
    Handles various name formats with ID numbers in parentheses.
    """
    names = []
    filtered_out = []  # Track what we're filtering out for debugging
    
    # Pattern 1: Standard format "LASTNAME, FIRSTNAME (ID)" - flexible ID length (4+ digits)
    for m in re.finditer(r"\b([A-Z][A-Za-z\s\'-]+,\s+[A-Z][A-Za-z\s\'-]+)\s*\(\d{4,}\)", text):
        name = m.group(1).strip().title()
        # Skip if the name starts with "Admission Date" or other non-name patterns
        if not any(skip_word in name for skip_word in ["Admission Date", "Facility", "Location", "Print Date"]):
            # Additional filtering for medication/instruction text
            if not is_medication_or_instruction(name):
                names.append(name)
                if debug:
                    print(f"✅ Added name: {name}")
            else:
                filtered_out.append(f"Medication filter: {name}")
        else:
            filtered_out.append(f"Skip word filter: {name}")
    
    # Pattern 2: Alternative format "LASTNAME, FIRSTNAME (ID)" with different spacing - flexible ID length
    for m in re.finditer(r"\b([A-Z][A-Za-z\s\'-]+,\s*[A-Z][A-Za-z\s\'-]+)\s*\(\d{4,}\)", text):
        name = m.group(1).strip().title()
        if not any(skip_word in name for skip_word in ["Admission Date", "Facility", "Location", "Print Date"]):
            if not is_medication_or_instruction(name):
                names.append(name)
    
    # Pattern 3: Handle names with multiple parts (e.g., "O'SHAUGHNESSY, RUTH") - flexible ID length
    for m in re.finditer(r"\b([A-Z][A-Za-z\s\'-]+,?\s+[A-Z][A-Za-z\s\'-]+)\s*\(\d{4,}\)", text):
        name = m.group(1).strip().title()
        # Clean up the name format
        name = re.sub(r'\s+', ' ', name)  # Normalize whitespace
        if not any(skip_word in name for skip_word in ["Admission Date", "Facility", "Location", "Print Date"]):
            if not is_medication_or_instruction(name):
                names.append(name)
    
    # Pattern 4: More flexible pattern for names with various formats
    # This catches names that might not follow the exact comma-space pattern
    for m in re.finditer(r"\b([A-Z][A-Za-z\s\'-]+,\s*[A-Z][A-Za-z\s\'-]+)\s*\(\d{3,}\)", text):
        name = m.group(1).strip().title()
        if not any(skip_word in name for skip_word in ["Admission Date", "Facility", "Location", "Print Date"]):
            if not is_medication_or_instruction(name):
                names.append(name)
    
    # Pattern 5: Names without parentheses but with clear name patterns
    # Look for "LASTNAME, FIRSTNAME" patterns that are likely names
    for m in re.finditer(r"\b([A-Z][A-Za-z\s\'-]+,\s+[A-Z][A-Za-z\s\'-]+)(?=\s|$)", text):
        name = m.group(1).strip().title()
        # Only include if it looks like a real name (not too long, contains common name patterns)
        if (len(name) < 50 and 
            not any(skip_word in name for skip_word in ["Admission Date", "Facility", "Location", "Print Date"]) and
            not is_medication_or_instruction(name) and
            re.search(r'[A-Z][a-z]+,\s+[A-Z][a-z]+', name)):  # Must have proper name format
            names.append(name)
    
    # Pattern 6: Handle names that might be on separate lines or have different formatting
    # Look for lines that contain name-like patterns
    lines = text.split('\n')
    for line in lines:
        line = line.strip()
        # Look for lines that contain name patterns
        if re.search(r'[A-Z][A-Za-z\s\'-]+,\s+[A-Z][A-Za-z\s\'-]+', line):
            # Extract all potential names from this line
            for m in re.finditer(r"([A-Z][A-Za-z\s\'-]+,\s+[A-Z][A-Za-z\s\'-]+)", line):
                name = m.group(1).strip().title()
                if (len(name) < 50 and 
                    not any(skip_word in name for skip_word in ["Admission Date", "Facility", "Location", "Print Date"]) and
                    not is_medication_or_instruction(name) and
                    re.search(r'[A-Z][a-z]+,\s+[A-Z][a-z]+', name)):
                    names.append(name)
    
    # Pattern 7: More aggressive pattern for names that might be formatted differently
    # Look for any text that follows "LASTNAME, FIRSTNAME" pattern, even without IDs
    for m in re.finditer(r"\b([A-Z][A-Za-z\s\'-]+,\s+[A-Z][A-Za-z\s\'-]+)(?=\s|$|\n)", text):
        name = m.group(1).strip().title()
        # More lenient filtering - just check it's not obviously wrong
        if (len(name) < 50 and 
            len(name) > 5 and  # Must be at least 5 characters
            not any(skip_word in name for skip_word in ["Admission Date", "Facility", "Location", "Print Date", "Resident List", "Report", "Generated"]) and
            not is_medication_or_instruction(name) and
            ',' in name and  # Must have comma
            not re.search(r'\d{4,}', name) and  # Must not be just numbers
            re.search(r'[A-Z][a-z]+,\s+[A-Z][a-z]+', name)):  # Must have proper name format
            names.append(name)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_names = []
    for name in names:
        if name not in seen:
            seen.add(name)
            unique_names.append(name)
    
    if debug:
        print(f"📊 Name extraction summary:")
        print(f"   Total names found: {len(names)}")
        print(f"   Unique names: {len(unique_names)}")
        print(f"   Filtered out: {len(filtered_out)}")
        if filtered_out:
            print(f"   Filtered examples: {filtered_out[:5]}")
    
    return unique_names

def extract_fluid_targets_ml(text: str, debug=False) -> List[int]:
    """
    Find ALL 'FLUID TARGET' values followed by numbers (ml or mL). Return list of integer mL values.
    Handles various formats including:
    - 'FLUID TARGET: Encourage [Name] to drink a minimum of [amount]ml per day'
    - 'FLUID TARGET: [Name] to drink a minimum of [amount]ml per day'
    - 'FLUID TARGET: Encourage [Name] to drink up to [amount]ml/day'
    - Any other variations with hydration-related keywords
    """
    targets = []
    
    if debug:
        print("=== DEBUGGING FLUID TARGET EXTRACTION ===")
        print(f"Text length: {len(text)} characters")
        
        # Look for any mention of FLUID TARGET
        fluid_target_lines = [line for line in text.splitlines() if re.search(r"FLUID\s*TARGET", line, flags=re.IGNORECASE)]
        print(f"Lines containing 'FLUID TARGET': {len(fluid_target_lines)}")
        for i, line in enumerate(fluid_target_lines):
            print(f"  Line {i+1}: {line.strip()}")
    
    # Pattern 1: FLUID TARGET followed by any text and then number with ml/mL
    # This handles: "FLUID TARGET: Encourage [Name] to drink a minimum of 1160ml per day"
    for m in re.finditer(r"FLUID\s*TARGET[^0-9]*?(\d{3,})\s*(mL|ml)", text, flags=re.IGNORECASE):
        num = m.group(1).replace(",", "")
        try:
            targets.append(int(num))
            if debug:
                print(f"Found target via pattern 1: {num} ml")
        except ValueError:
            continue
    
    # Pattern 2: Look for any line containing "FLUID TARGET" and extract all numbers with ml/mL
    for line in text.splitlines():
        if re.search(r"FLUID\s*TARGET", line, flags=re.IGNORECASE):
            # Look for 3+ digit numbers followed by ml/mL in the same line
            numbers = re.findall(r"(\d{3,})\s*(mL|ml)", line, flags=re.IGNORECASE)
            for num, unit in numbers:
                try:
                    targets.append(int(num.replace(",", "")))
                    if debug:
                        print(f"Found target via pattern 2: {num} ml")
                except ValueError:
                    pass
    
    # Pattern 3: Look for ml/mL numbers in lines that contain hydration-related keywords
    hydration_keywords = ['drink', 'minimum', 'target', 'goal', 'fluid', 'hydration']
    for line in text.splitlines():
        line_lower = line.lower()
        if any(keyword in line_lower for keyword in hydration_keywords):
            # Look for 3+ digit numbers followed by ml/mL in the same line
            numbers = re.findall(r"(\d{3,})\s*(mL|ml)", line, flags=re.IGNORECASE)
            for num, unit in numbers:
                try:
                    targets.append(int(num.replace(",", "")))
                    if debug:
                        print(f"Found target via pattern 3 (hydration keywords): {num} ml")
                except ValueError:
                    pass
    
    # Additional patterns to catch more cases
    all_ml_numbers = re.findall(r"(\d{3,})\s*(mL|ml)", text, flags=re.IGNORECASE)
    if debug:
        print(f"All ml/mL numbers found in text: {all_ml_numbers}")
    
    # If we still haven't found targets, try broader patterns
    if not targets:
        # Look for any reasonable ml amounts (500-5000ml range) in the text
        for m in re.finditer(r"(\d{3,})\s*(mL|ml)", text, flags=re.IGNORECASE):
            num = int(m.group(1).replace(",", ""))
            # Reasonable range for daily fluid intake
            if 500 <= num <= 5000:
                targets.append(num)
                if debug:
                    print(f"Found target via pattern 4 (reasonable range): {num} ml")
    
    # Remove duplicates while preserving order
    seen = set()
    unique_targets = []
    for target in targets:
        if target not in seen:
            seen.add(target)
            unique_targets.append(target)
    
    if debug:
        print(f"Final unique targets: {unique_targets}")
        print("=== END FLUID TARGET DEBUGGING ===\n")
    
    return unique_targets

def process_care_plan_comprehensive(path: str, debug=False) -> List[Tuple[str, Optional[int], str]]:
    """Process PDF and return list of (name, ml_goal, page_info) tuples for ALL residents found."""
    pages = read_pdf_pages(path)
    resident_targets = {}  # Dictionary to store resident -> target mapping
    all_names_found = []  # Track all names found for debugging
    
    if debug:
        print(f"\n=== PROCESSING {os.path.basename(path)} ===")
        print(f"Total pages: {len(pages)}")
    
    # First pass: Find all pages with fluid targets and associate them with residents
    for page_num, page_text in enumerate(pages, 1):
        names = extract_resident_names(page_text, debug=debug and page_num <= 3)
        targets = extract_fluid_targets_ml(page_text, debug=debug and page_num <= 3)  # Debug first few pages
        
        # Track all names found for debugging
        all_names_found.extend(names)
        
        if debug and page_num <= 5:  # Debug first few pages
            print(f"\n--- Page {page_num} ---")
            print(f"Names found: {names}")
            print(f"Targets found: {targets}")
        
        if names and targets:
            # Found both names and targets on this page - associate them
            for name in names:
                # Use the first (main) target for each resident
                main_target = targets[0] if targets else None
                if main_target:
                    resident_targets[name] = main_target
                    if debug:
                        print(f"Associated {name} with target {main_target}")
        
        # Second pass: For pages with names but no targets, try to find hydration info in nearby pages
        elif names and not targets:
            # Look in nearby pages for hydration information (both forward and backward)
            for look_offset in range(1, 6):  # Look up to 5 pages away
                # Try forward
                forward_page_idx = page_num + look_offset - 1
                if forward_page_idx < len(pages):
                    forward_page_text = pages[forward_page_idx]
                    forward_targets = extract_fluid_targets_ml(forward_page_text)
                    if forward_targets:
                        for name in names:
                            if name not in resident_targets:
                                resident_targets[name] = forward_targets[0]
                                if debug:
                                    print(f"Associated {name} with target {forward_targets[0]} from page {page_num + look_offset}")
                        break
                
                # Try backward
                backward_page_idx = page_num - look_offset - 1
                if backward_page_idx >= 0:
                    backward_page_text = pages[backward_page_idx]
                    backward_targets = extract_fluid_targets_ml(backward_page_text)
                    if backward_targets:
                        for name in names:
                            if name not in resident_targets:
                                resident_targets[name] = backward_targets[0]
                                if debug:
                                    print(f"Associated {name} with target {backward_targets[0]} from page {page_num - look_offset}")
                        break
    
    # Third pass: For residents still without targets, do a comprehensive search
    for name in resident_targets.copy():
        if resident_targets[name] is None:
            # Search the entire document for any hydration info
            for search_page_num, search_page_text in enumerate(pages, 1):
                search_targets = extract_fluid_targets_ml(search_page_text)
                if search_targets:
                    # Check if this page belongs to this resident by looking for the full name
                    last_name = name.split(',')[0].strip().lower()
                    first_name = name.split(',')[1].strip().lower()
                    
                    # More precise matching - look for both last and first name
                    if (last_name in search_page_text.lower() and first_name in search_page_text.lower()) or \
                       name.lower() in search_page_text.lower():
                        resident_targets[name] = search_targets[0]
                        if debug:
                            print(f"Found hydration target for {name} via comprehensive search on page {search_page_num}")
                        break
    
    # Fourth pass: Collect all unique residents and their targets
    all_residents = []
    seen_residents = set()
    
    for page_num, page_text in enumerate(pages, 1):
        names = extract_resident_names(page_text, debug=debug and page_num <= 3)
        
        for name in names:
            if name not in seen_residents:
                seen_residents.add(name)
                target_ml = resident_targets.get(name, None)
                all_residents.append((name, target_ml, f"Page {page_num}"))
                
                if debug and target_ml is None:
                    print(f"WARNING: No hydration target found for {name} on page {page_num}")
                    # This could be normal - some residents may not have hydration goals documented
    
    if debug:
        print(f"\nTotal residents found: {len(all_residents)}")
        print(f"Residents with targets: {len([r for r in all_residents if r[1] is not None])}")
        print(f"Residents without targets: {len([r for r in all_residents if r[1] is None])}")
        print(f"Total names found across all pages: {len(set(all_names_found))}")
        print(f"Unique names found: {list(set(all_names_found))[:10]}...")  # Show first 10 names
        print("=== END PROCESSING ===\n")
    
    return all_residents

rows: List[Tuple[str, Optional[int], str]] = []  # (Resident Name, mL Goal, Source File)

for pdf_path in CARE_PLAN_FILES:
    if os.path.exists(pdf_path):
        try:
            # Enable debugging for the first PDF to see what's happening (disabled for production)
            debug_mode = True  # pdf_path == CARE_PLAN_FILES[0]
            residents = process_care_plan_comprehensive(pdf_path, debug=debug_mode)
            if residents:
                # Add all residents found
                for name, ml, page_info in residents:
                    rows.append((name, ml, f"{os.path.basename(pdf_path)} - {page_info}"))
            else:
                rows.append(("", None, os.path.basename(pdf_path) + " (no residents found)"))
        except Exception as e:
            rows.append(("", None, os.path.basename(pdf_path) + f" (error: {e})"))
    else:
        rows.append(("", None, os.path.basename(pdf_path) + " (not found)"))

# Write CSV
out_path = "hydration_goals.csv"
with open(out_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["Resident Name", "mL Goal", "Source File"])
    for r in rows:
        writer.writerow([r[0], r[1] if r[1] is not None else "", r[2]])

print(f"Processed {len(rows)} entries and saved to {out_path}")
out_path