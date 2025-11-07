#!/usr/bin/env python3
"""
Compare resident list report (PDF) with dashboard file (JS) to find differences.
Usage: python compare_residents.py <resident_list_pdf> <dashboard_js>
"""

import sys
import re
import json
import os
from typing import List, Set, Dict
from pathlib import Path

# PDF parsing
try:
    from PyPDF2 import PdfReader
    PYPDF2_AVAILABLE = True
except Exception:
    PYPDF2_AVAILABLE = False

try:
    from pdfminer.high_level import extract_text
    PDFMINER_AVAILABLE = True
except Exception:
    PDFMINER_AVAILABLE = False


def clean_name(name: str) -> str:
    """Clean name by normalizing Unicode whitespace."""
    import unicodedata
    name = ''.join(c if unicodedata.category(c)[0] != 'Z' or c == ' ' else ' ' for c in name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def normalize_name(name: str) -> str:
    """Normalize name for comparison."""
    return re.sub(r"\s+", " ", name.strip()).upper()


def extract_first_last_name(name: str) -> tuple:
    """Extract first and last name from a full name, ignoring middle names.
    Handles formats like 'Smith, John' or 'Smith, John Michael' or 'Smith, John Robert Michael'.
    Returns (last_name, first_name) tuple, both normalized."""
    name = normalize_name(name)
    
    # Handle "LAST, FIRST" or "LAST, FIRST MIDDLE" format
    if ',' in name:
        parts = name.split(',', 1)
        last_name = parts[0].strip()
        first_part = parts[1].strip() if len(parts) > 1 else ""
        
        # Get first name (first word) from the first part
        first_name_parts = first_part.split()
        first_name = first_name_parts[0] if first_name_parts else ""
        
        return (last_name, first_name)
    
    # Handle format without comma: "FIRST MIDDLE LAST" or "FIRST LAST"
    # Assume last word is last name, first word is first name
    parts = name.split()
    if len(parts) >= 2:
        first_name = parts[0]
        last_name = parts[-1]
        return (last_name, first_name)
    elif len(parts) == 1:
        # Only one word, treat as last name
        return (parts[0], "")
    
    return ("", "")


def get_match_key(name: str) -> str:
    """Create a match key from a name based on first and last name only.
    This allows matching even if middle names differ."""
    last_name, first_name = extract_first_last_name(name)
    # Return normalized key: "LASTNAME, FIRSTNAME"
    return f"{last_name}, {first_name}".strip()


def extract_names_from_pdf(pdf_path: str, debug_output_path: str = None) -> List[str]:
    """Extract resident names from PDF file."""
    names = []
    skip_words = ["Admission Date", "Facility", "Location", "Print Date", "Admissiondate", "Delusional", "Disorder"]
    
    # Read PDF text - prefer pdfminer as it's more accurate
    text = ""
    if PDFMINER_AVAILABLE:
        try:
            text = extract_text(pdf_path) or ""
        except Exception as e:
            print(f"Warning: pdfminer extraction failed: {e}")
            pass
    
    if not text and PYPDF2_AVAILABLE:
        try:
            reader = PdfReader(pdf_path)
            page_texts = []
            for page in reader.pages:
                try:
                    page_texts.append(page.extract_text() or "")
                except Exception:
                    page_texts.append("")
            text = "\n".join(page_texts)
        except Exception as e:
            print(f"Warning: PyPDF2 extraction failed: {e}")
            pass
    
    if not text:
        raise RuntimeError("Could not extract text from PDF. Install PyPDF2 or pdfminer.six.")
    
    # Debug: show extraction method used
    if PDFMINER_AVAILABLE and text:
        print(f"  Using pdfminer for text extraction")
    elif PYPDF2_AVAILABLE and text:
        print(f"  Using PyPDF2 for text extraction (pdfminer not available)")
    
    # Write extracted text to debug file
    if debug_output_path:
        try:
            with open(debug_output_path, 'w', encoding='utf-8') as f:
                f.write(text)
            print(f"  Debug: Extracted text written to {debug_output_path}")
            print(f"  Debug: Text length: {len(text)} characters")
        except Exception as e:
            print(f"  Warning: Could not write debug output: {e}")
    
    # Debug: track matches per pattern
    pattern_matches = [0, 0, 0, 0]
    
    # Pattern 1: Standard format "LASTNAME, FIRSTNAME (ID)" - most common format
    # Handles both single and double parentheses
    # Use more restrictive pattern to avoid matching header text
    # Last name should be 2-30 chars, first name should be 2-30 chars
    # Use [ \t]+ instead of \s+ to avoid matching across newlines
    for m in re.finditer(r"([A-Z][A-Za-z\'-]{1,20}(?:[ \t]+[A-Z][A-Za-z\'-]{1,10})*,[ \t]+[A-Z][A-Za-z\'-]{1,20}(?:[ \t]+[A-Z][A-Za-z\'-]{1,10})*)\s*(?:\(\(|\()\d+(?:\)|\)\))", text):
        name = m.group(1).strip().title()
        name = clean_name(name)
        name_lower = name.lower()
        
        # Split name to check if header words are in the actual name parts
        name_parts = name.split(',')
        if len(name_parts) != 2:
            continue
        last_name = name_parts[0].strip().lower()
        first_name = name_parts[1].strip().lower()
        
        # Only skip if header words are in the actual name parts, not before the match
        header_words = ["name", "user", "date", "time", "page", "report"]
        if any(header_word in last_name or header_word in first_name for header_word in header_words):
            continue
        
        # Ensure reasonable name lengths
        if len(last_name) < 2 or len(first_name) < 2:
            continue
        
        if not any(skip_word.lower() in name_lower for skip_word in skip_words):
            names.append(name)
            pattern_matches[0] += 1
    
    # Pattern 2: Alternative format with different spacing - use same restrictions as Pattern 1
    # Use [ \t]+ instead of \s+ to avoid matching across newlines
    for m in re.finditer(r"([A-Z][A-Za-z\'-]{1,20}(?:[ \t]+[A-Z][A-Za-z\'-]{1,10})*,[ \t]*[A-Z][A-Za-z\'-]{1,20}(?:[ \t]+[A-Z][A-Za-z\'-]{1,10})*)\s*(?:\(\(|\()\d+(?:\)|\)\))", text):
        name = m.group(1).strip().title()
        name = clean_name(name)
        name_lower = name.lower()
        
        # Split name to check if header words are in the actual name parts
        name_parts = name.split(',')
        if len(name_parts) != 2:
            continue
        last_name = name_parts[0].strip().lower()
        first_name = name_parts[1].strip().lower()
        
        # Only skip if header words are in the actual name parts
        header_words = ["name", "user", "date", "time", "page", "report"]
        if any(header_word in last_name or header_word in first_name for header_word in header_words):
            continue
        
        # Ensure reasonable name lengths
        if len(last_name) < 2 or len(first_name) < 2:
            continue
        
        if not any(skip_word.lower() in name_lower for skip_word in skip_words):
            names.append(name)
            pattern_matches[1] += 1
    
    # Pattern 3: Simpler pattern - just look for "LAST, FIRST (ID)" with length restrictions
    # Use [ \t]+ instead of \s+ to avoid matching across newlines
    for m in re.finditer(r"([A-Z][A-Za-z\'-]{1,20}(?:[ \t]+[A-Z][A-Za-z\'-]{1,10})*,[ \t]*[A-Z][A-Za-z\'-]{1,20}(?:[ \t]+[A-Z][A-Za-z\'-]{1,10})*)\s*\(\d+\)", text):
        name = m.group(1).strip().title()
        name = clean_name(name)
        name_lower = name.lower()
        
        # Split name to check if header words are in the actual name parts
        name_parts = name.split(',')
        if len(name_parts) != 2:
            continue
        last_name = name_parts[0].strip().lower()
        first_name = name_parts[1].strip().lower()
        
        # Only skip if header words are in the actual name parts
        header_words = ["name", "user", "date", "time", "page", "report"]
        if any(header_word in last_name or header_word in first_name for header_word in header_words):
            continue
        
        # Ensure reasonable name lengths
        if len(last_name) < 2 or len(first_name) < 2:
            continue
        
        if (not any(skip_word.lower() in name_lower for skip_word in skip_words) and
            len(name.split()) >= 2):  # Must have at least 2 words
            names.append(name)
            pattern_matches[2] += 1
    
    # Pattern 4: Names without IDs - "LASTNAME, FIRSTNAME" format
    # Look for names that appear to be in a list/table format, but be more specific
    # Require that it looks like a proper name (starts with capital, has reasonable length)
    # Use [ \t]+ instead of \s+ to avoid matching across newlines
    # Include apostrophes in character class to handle names like "O'Dowd"
    for m in re.finditer(r"\b([A-Z][A-Za-z\'-]{2,}(?:[ \t]+[A-Z][A-Za-z\'-]+)*,[ \t]+[A-Z][A-Za-z\'-]{2,}(?:[ \t]+[A-Z][A-Za-z\'-]+)*)(?=\s|$|\n|[,\d])", text):
        name = m.group(1).strip().title()
        name = clean_name(name)
        name_lower = name.lower()
        # Skip if contains header words
        header_words = ["name", "user", "date", "time", "page", "report"]
        if any(header_word in name_lower for header_word in header_words):
            continue
        # Skip if it looks like a header or contains skip words
        # Also require minimum length to avoid false positives
        if (not any(skip_word.lower() in name_lower for skip_word in skip_words) and
            len(name) >= 5 and  # Minimum reasonable name length
            len(name.split()) >= 2 and  # Must have at least 2 words
            ',' in name and  # Must have comma (LAST, FIRST format)
            not re.search(r'\d{4,}', name)):  # Don't match if it contains long numbers
            names.append(name)
            pattern_matches[3] += 1
    
    # Remove duplicates while preserving order
    seen = set()
    unique_names = []
    for name in names:
        if name not in seen:
            seen.add(name)
            unique_names.append(name)
    
    # Debug: print pattern match statistics
    if debug_output_path:
        print(f"  Debug: Pattern matches - P1:{pattern_matches[0]} P2:{pattern_matches[1]} P3:{pattern_matches[2]} P4:{pattern_matches[3]}")
        print(f"  Debug: Total matches before dedup: {len(names)}, after dedup: {len(unique_names)}")
    
    return unique_names


def extract_names_from_dashboard(js_path: str) -> List[str]:
    """Extract resident names from dashboard JavaScript file."""
    with open(js_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find the hydrationData array
    # Look for const hydrationData = [...] or hydrationData = [...]
    match = re.search(r'(?:const\s+)?hydrationData\s*=\s*(\[[\s\S]*?\])', content)
    if not match:
        raise ValueError("Could not find hydrationData array in JavaScript file")
    
    # Extract the JSON array
    json_str = match.group(1)
    
    # Try to parse as JSON
    try:
        data = json.loads(json_str)
    except json.JSONDecodeError:
        # If JSON parsing fails, try to extract names directly using regex
        names = []
        for m in re.finditer(r'"name"\s*:\s*"([^"]+)"', content):
            names.append(m.group(1))
        return names
    
    # Extract names from parsed data
    names = []
    for item in data:
        if isinstance(item, dict) and 'name' in item:
            names.append(item['name'])
    
    return names


def compare_residents(pdf_names: List[str], dashboard_names: List[str]) -> Dict[str, Set[str]]:
    """Compare two lists of resident names and return differences.
    Matches based on first and last name only, ignoring middle names."""
    # Create match keys based on first and last name only
    # Map from match_key -> list of original names with that key
    pdf_by_key: Dict[str, List[str]] = {}
    dashboard_by_key: Dict[str, List[str]] = {}
    
    for name in pdf_names:
        key = get_match_key(name)
        if key not in pdf_by_key:
            pdf_by_key[key] = []
        pdf_by_key[key].append(name)
    
    for name in dashboard_names:
        key = get_match_key(name)
        if key not in dashboard_by_key:
            dashboard_by_key[key] = []
        dashboard_by_key[key].append(name)
    
    pdf_keys = set(pdf_by_key.keys())
    dashboard_keys = set(dashboard_by_key.keys())
    
    # Find differences
    only_in_pdf_keys = pdf_keys - dashboard_keys
    only_in_dashboard_keys = dashboard_keys - pdf_keys
    in_both_keys = pdf_keys & dashboard_keys
    
    # Convert back to original names (use first name from each list)
    result = {
        'only_in_pdf': {pdf_by_key[key][0] for key in only_in_pdf_keys},
        'only_in_dashboard': {dashboard_by_key[key][0] for key in only_in_dashboard_keys},
        'in_both': set()
    }
    
    # For matches, show both names if they differ (e.g., one has middle name, other doesn't)
    for key in in_both_keys:
        pdf_name = pdf_by_key[key][0]
        dashboard_name = dashboard_by_key[key][0]
        # If names are exactly the same, just add one
        if normalize_name(pdf_name) == normalize_name(dashboard_name):
            result['in_both'].add(pdf_name)
        else:
            # If they differ (e.g., middle name), show both
            result['in_both'].add(f"{pdf_name} <-> {dashboard_name}")
    
    return result


def main():
    if len(sys.argv) != 3:
        print("Usage: python compare_residents.py <resident_list_pdf> <dashboard_js>")
        print("\nExample:")
        print("  python compare_residents.py files/arbour/Resident\\ List/Resident\\ List\\ Report.pdf data/Arbour\\ Test/dashboard_10_30_2025.js")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    js_path = sys.argv[2]
    
    # Check if files exist
    if not os.path.exists(pdf_path):
        print(f"Error: PDF file not found: {pdf_path}")
        sys.exit(1)
    
    if not os.path.exists(js_path):
        print(f"Error: Dashboard file not found: {js_path}")
        sys.exit(1)
    
    print(f"Reading resident list from: {pdf_path}")
    
    # Generate debug output path
    pdf_basename = os.path.splitext(os.path.basename(pdf_path))[0]
    pdf_dir = os.path.dirname(pdf_path)
    debug_output_path = os.path.join(pdf_dir, f"{pdf_basename}_extracted_text.txt")
    
    try:
        pdf_names = extract_names_from_pdf(pdf_path, debug_output_path=debug_output_path)
        print(f"Found {len(pdf_names)} residents in PDF")
    except Exception as e:
        print(f"Error reading PDF: {e}")
        sys.exit(1)
    
    print(f"Reading dashboard from: {js_path}")
    try:
        dashboard_names = extract_names_from_dashboard(js_path)
        print(f"Found {len(dashboard_names)} residents in dashboard")
    except Exception as e:
        print(f"Error reading dashboard: {e}")
        sys.exit(1)
    
    # Compare
    print("\n" + "=" * 80)
    print("COMPARING RESIDENTS")
    print("=" * 80)
    
    comparison = compare_residents(pdf_names, dashboard_names)
    
    print(f"\n✅ Residents in both: {len(comparison['in_both'])}")
    print(f"📄 Only in PDF (resident list): {len(comparison['only_in_pdf'])}")
    print(f"📊 Only in dashboard: {len(comparison['only_in_dashboard'])}")
    
    if comparison['only_in_pdf']:
        print("\n" + "-" * 80)
        print("RESIDENTS ONLY IN PDF (not in dashboard):")
        print("-" * 80)
        for name in sorted(comparison['only_in_pdf']):
            print(f"  - {name}")
    
    print("\n" + "-" * 80)
    print("RESIDENTS ONLY IN DASHBOARD (not in PDF):")
    print("-" * 80)
    if comparison['only_in_dashboard']:
        for name in sorted(comparison['only_in_dashboard']):
            print(f"  - {name}")
    else:
        print("  (none)")
    
    if comparison['in_both']:
        print("\n" + "-" * 80)
        print(f"RESIDENTS IN BOTH ({len(comparison['in_both'])}):")
        print("-" * 80)
        # Show first 10 matches as sample
        sample = sorted(comparison['in_both'])[:10]
        for name in sample:
            print(f"  ✓ {name}")
        if len(comparison['in_both']) > 10:
            print(f"  ... and {len(comparison['in_both']) - 10} more")
    
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total in PDF: {len(pdf_names)}")
    print(f"Total in dashboard: {len(dashboard_names)}")
    print(f"Matches: {len(comparison['in_both'])}")
    print(f"Missing from dashboard: {len(comparison['only_in_pdf'])}")
    print(f"Extra in dashboard: {len(comparison['only_in_dashboard'])}")


if __name__ == "__main__":
    main()

