"""
Egyptian governorate code -> name table.

The 8th-9th digits of the National ID encode the governorate of registration.
Codes are NOT sequential (they follow the Ministry of Interior's official
assignment); 88 means "born abroad". This table is the single source of truth
for the verifier and is kept byte-identical to the mapping Wael's server.py
uses, so the cross-field governorate check agrees with the live pipeline.
"""

from __future__ import annotations

# Official 2-digit governorate registration codes.
GOVERNORATES: dict[str, str] = {
    "01": "Cairo",
    "02": "Alexandria",
    "03": "Port Said",
    "04": "Suez",
    "11": "Damietta",
    "12": "Dakahlia",
    "13": "Sharqia",
    "14": "Qalyubia",
    "15": "Kafr el-Sheikh",
    "16": "Gharbia",
    "17": "Menoufia",
    "18": "Beheira",
    "19": "Ismailia",
    "21": "Giza",
    "22": "Beni Suef",
    "23": "Fayoum",
    "24": "Minya",
    "25": "Asyut",
    "26": "Sohag",
    "27": "Qena",
    "28": "Aswan",
    "29": "Luxor",
    "31": "Red Sea",
    "32": "New Valley",
    "33": "Matruh",
    "34": "North Sinai",
    "35": "South Sinai",
    "88": "Foreign",
}

# Valid code set, for fast membership tests in the verifier.
VALID_GOV_CODES: frozenset[str] = frozenset(GOVERNORATES.keys())


def governorate_name(code: str) -> str:
    """Return the governorate name for a 2-digit code, or 'Unknown'."""
    return GOVERNORATES.get(code, "Unknown")


def is_valid_gov_code(code: str) -> bool:
    """True iff `code` is an officially-assigned governorate code."""
    return code in VALID_GOV_CODES
