"""Builds messy-leads.xlsx: 20 made-up home-services leads, deliberately messy for a cleanup demo.

    pip install openpyxl
    python make-messy-leads.py [path/to/messy-leads.xlsx]

All names are made up, phones are 555 numbers and emails are example.com/.net/.org.
"""
import random
import sys

from openpyxl import Workbook
from openpyxl.styles import Font

OUT = sys.argv[1] if len(sys.argv) > 1 else "messy-leads.xlsx"

# 16 unique leads: name, phone, email, service, date (phone None = missing)
leads = [
    ("JOHN smith", "555-201-3344", "john.smith@example.com", "Roof Repair", "2026-09-14"),
    ("sarah LEE", "(555) 318 2290", "sarah.lee@example.net", "HVAC Tune-Up", "09/15/2026"),
    ("Marcus  o'BRIEN", "5554427781", "marcus.obrien@example.com", "Water Heater Install", "Sep 16, 2026"),
    ("priya PATEL", "555-610-4452", "priya.p@example.org", "Gutter Cleaning", "17-Sep-26"),
    ("DANIEL kim", None, "dkim@example.com", "Plumbing Leak", "9/18/26"),
    ("Emily  carter", "(555) 774 1023", "emily.carter@example.net", "Roof Inspection", "2026/09/19"),
    ("luis HERNANDEZ", "5559023316", "luis.h@example.com", "AC Repair", "September 20, 2026"),
    ("grace WONG", "555-388-9014", "grace.wong@example.org", "Drain Cleaning", "21.09.2026"),
    ("TOM baker", "(555) 245 6670", "tom.baker@example.com", "Furnace Repair", "09-22-2026"),
    ("aisha  KHAN", None, "aisha.khan@example.net", "Solar Quote", "Sep 23 2026"),
    ("Ben FOSTER", "5551197742", "ben.foster@example.com", "Window Replacement", "2026-09-24"),
    ("nina rossi", "555-830-5521", "nina.rossi@example.org", "Deck Repair", "9/25/2026"),
    ("OMAR said", "(555) 467 3398", "omar.said@example.com", "Boiler Service", "26-Sep-2026"),
    ("chloe MARTIN", "5556609184", "chloe.m@example.net", "Landscaping", "Sept 27, 2026"),
    ("RYAN  cooper", None, "ryan.cooper@example.com", "Electrical Panel", "2026.09.28"),
    ("hannah  YOUNG", "555-952-0076", "hannah.young@example.org", "Siding Repair", "09/29/26"),
]

# 4 duplicates: same email as an earlier lead, re-entered differently
dupes = [
    (" john SMITH ", "(555) 201 3344", "john.smith@example.com", "Roof Repair", "Sep 14, 2026"),
    ("Sarah Lee", "5553182290", "sarah.lee@example.net", "HVAC Tune-Up", "2026-09-15"),
    ("TOM  BAKER", "555-245-6670", "tom.baker@example.com ", "Furnace Repair", "9/22/26"),
    ("nina ROSSI", "(555) 830 5521", "nina.rossi@example.org", " Deck Repair", "25-Sep-26"),
]

rows = leads + dupes
random.Random(7).shuffle(rows)

# A few extra spaces in cells
pad = {2: (0, "  "), 5: (3, " "), 9: (1, "  "), 13: (4, " "), 17: (3, "  ")}

wb = Workbook()
ws = wb.active
ws.title = "Leads"
ws.append(["Name", "Phone", "Email", "Service", "Date"])
for c in ws[1]:
    c.font = Font(bold=True)
for i, row in enumerate(rows):
    cells = ["" if v is None else v for v in row]
    if i in pad:
        col, extra = pad[i]
        cells[col] = cells[col] + extra
    ws.append(cells)
for col, width in zip("ABCDE", (22, 18, 28, 24, 20)):
    ws.column_dimensions[col].width = width
wb.save(OUT)

emails = [r[2].strip() for r in rows]
print("rows:", len(rows), "unique emails:", len(set(emails)), "no phone:", sum(r[1] is None for r in rows))
