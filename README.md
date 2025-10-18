# Hydration Dashboard System

A comprehensive system for processing care plan PDFs and hydration data to generate a dashboard showing resident hydration goals and daily consumption.

## System Overview

This system consists of three main components that work together to process PDF data and generate a hydration dashboard:

```mermaid
graph TD
    A[Care Plan PDFs<br/>care-plans/] --> B[careplan.py]
    C[Hydration Data PDFs<br/>hydration-data/] --> D[process_dat_pdf.py]
    B --> E[hydration_goals.csv]
    D --> E
    E --> F[generate_dashboard_data.py]
    F --> G[dashboard_data.js]
    G --> H[hydration.html<br/>Dashboard]
```

## Files Description

### 1. `careplan.py` - Care Plan Processor

**Purpose**: Extracts resident names and hydration goals from care plan PDFs.

**Input**: PDF files in `care-plans/` directory
**Output**: `hydration_goals.csv` with resident names and mL goals

**Key Features**:
- Extracts resident names using flexible regex patterns (handles 4+ digit ID numbers)
- Finds hydration targets from "FLUID TARGET" sections
- Processes multiple PDF pages and associates names with goals
- Handles various name formats and ID number lengths

**Usage**:
```bash
python3 careplan.py
```

**Output Format**:
```csv
Resident Name,mL Goal,Source File
"Boere, Mary Antonia",1700,2.pdf - Page 83
"Smith, John",1500,1.pdf - Page 5
```

### 2. `process_dat_pdf.py` - Hydration Data Processor

**Purpose**: Processes daily hydration consumption data from hydration-data PDFs and updates the CSV.

**Input**: PDF files in `hydration-data/` directory
**Output**: Updates `hydration_goals.csv` with daily consumption data

**Key Features**:
- Extracts daily totals (Day 14, 15, 16) from PDFs
- Matches residents using fuzzy name matching
- Handles "Extra" hydration files (adds to existing values)
- Calculates "Missed 3 Days" status
- Preserves existing goal data from care plans

**Usage**:
```bash
python3 process_dat_pdf.py
```

**Data Flow**:
```mermaid
graph LR
    A[hydration-data/*.pdf] --> B[Extract Daily Totals]
    B --> C[Match Resident Names]
    C --> D[Update CSV]
    D --> E[Calculate Missed 3 Days]
```

### 3. `generate_dashboard_data.py` - Dashboard Data Generator

**Purpose**: Converts CSV data to JavaScript format for the dashboard.

**Input**: `hydration_goals.csv`
**Output**: `dashboard_data.js`

**Key Features**:
- Converts CSV data to JavaScript objects
- Calculates statistics (goal met percentage, missed days)
- Generates timestamped data file
- Provides summary statistics

**Usage**:
```bash
python3 generate_dashboard_data.py
```

## Complete Workflow

```mermaid
sequenceDiagram
    participant User
    participant CP as careplan.py
    participant PD as process_dat_pdf.py
    participant GD as generate_dashboard_data.py
    participant CSV as hydration_goals.csv
    participant JS as dashboard_data.js
    participant HTML as hydration.html

    User->>CP: Run careplan.py
    CP->>CSV: Extract names & goals from care-plans/
    CSV-->>CP: Create base CSV

    User->>PD: Run process_dat_pdf.py
    PD->>CSV: Read existing data
    PD->>PD: Process hydration-data/ PDFs
    PD->>CSV: Update with daily consumption
    CSV-->>PD: Updated with consumption data

    User->>GD: Run generate_dashboard_data.py
    GD->>CSV: Read final data
    GD->>JS: Generate JavaScript data
    JS-->>HTML: Dashboard displays data
```

## Directory Structure

```
hydration/
├── care-plans/              # Care plan PDFs (names & goals)
│   ├── 1.pdf
│   ├── 2.pdf
│   └── 3.pdf
├── hydration-data/          # Daily consumption PDFs
│   ├── CG.pdf
│   ├── HH.pdf
│   └── MG.pdf
├── careplan.py              # Extract names & goals
├── process_dat_pdf.py       # Process consumption data
├── generate_dashboard_data.py # Generate JS data
├── hydration_goals.csv     # Master data file
├── dashboard_data.js       # JavaScript data
└── hydration.html          # Dashboard interface
```

## Data Processing Pipeline

### Step 1: Extract Resident Information
```mermaid
graph TD
    A[Care Plan PDFs] --> B[Extract Names with Regex]
    B --> C[Find FLUID TARGET values]
    C --> D[Associate Names with Goals]
    D --> E[Create CSV with Names & Goals]
```

### Step 2: Process Daily Consumption
```mermaid
graph TD
    A[Hydration Data PDFs] --> B[Extract Daily Totals]
    B --> C[Match Resident Names]
    C --> D[Update CSV with Consumption]
    D --> E[Calculate Missed 3 Days Status]
```

### Step 3: Generate Dashboard Data
```mermaid
graph TD
    A[CSV Data] --> B[Convert to JavaScript Objects]
    B --> C[Calculate Statistics]
    C --> D[Generate dashboard_data.js]
    D --> E[Update Dashboard]
```

## Key Features

### Name Matching Algorithm
The system uses sophisticated name matching to handle:
- Different name formats (LAST, FIRST vs FIRST LAST)
- Prefixes (DE, VAN, VON, etc.)
- Compound surnames
- Fuzzy matching for slight variations

### Data Integrity
- Preserves existing goal data when processing consumption
- Handles "Extra" hydration files by adding to existing values
- Calculates "Missed 3 Days" based on final values
- Maintains data consistency across all processing steps

### Error Handling
- Graceful handling of missing data
- Validation of numeric values
- Fallback patterns for name extraction
- Comprehensive logging of processing steps

## Usage Instructions

1. **Initial Setup**: Place care plan PDFs in `care-plans/` directory
2. **Extract Goals**: Run `python3 careplan.py` to extract resident names and hydration goals
3. **Add Consumption Data**: Place hydration data PDFs in `hydration-data/` directory
4. **Process Consumption**: Run `python3 process_dat_pdf.py` to add daily consumption data
5. **Generate Dashboard**: Run `python3 generate_dashboard_data.py` to create JavaScript data
6. **View Dashboard**: Open `hydration.html` in a web browser

## Dependencies

- Python 3.6+
- PyPDF2 (for PDF processing)
- pdfminer.six (alternative PDF processing)
- Standard library modules: csv, re, os, json

## Output Files

- `hydration_goals.csv`: Master data file with all resident information
- `dashboard_data.js`: JavaScript data file for dashboard
- `hydration.html`: Interactive dashboard interface

## Statistics Generated

The system automatically calculates:
- Total number of residents
- Goal met percentage
- Number of residents who missed 3 consecutive days
- Daily consumption averages
- Individual resident progress tracking
