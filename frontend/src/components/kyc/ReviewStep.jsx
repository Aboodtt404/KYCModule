"use client";
import React, { useState, useEffect } from "react";
import GlassCard from "./GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateAge } from "@/utils/age";

const GOVERNORATES = [
    "Cairo", "Alexandria", "Giza", "Dakahlia", "Sharqia", "Qalyubiya",
    "Beheira", "Menoufia", "Kafr El Sheikh", "Gharbia", "Damietta",
    "Ismailia", "Port Said", "Suez", "North Sinai", "South Sinai",
    "Minya", "Beni Suef", "Fayoum", "Assiut", "Sohag", "Qena",
    "Luxor", "Aswan", "New Valley", "Red Sea", "Matrouh",
];

const GENDERS = ["Male", "Female"];
const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"];

export default function ReviewStep({ userData, onNext, isSubmitting = false }) {
    const [editableData, setEditableData] = useState(() => ({
        ...(userData.ocrData || {}),
    }));
    const [errors, setErrors] = useState({});

    // Back-of-card fields exist on the National ID flow (not passport). Show them
    // if any back key is present on the OCR data, even if the value is blank.
    const hasBackFields = userData.ocrData != null && [
        'serial_number', 'marital_status', 'occupation', 'issue_date', 'expiry_date',
    ].some((k) => k in userData.ocrData);

    // Sync if parent passes fresh OCR data (e.g. mobile handoff)
    useEffect(() => {
        setEditableData((prev) => ({
            ...userData.ocrData,
            // Preserve any manual edits the user already made
            ...Object.fromEntries(
                Object.entries(prev).filter(([, v]) => v && v.trim && v.trim() !== '')
            ),
        }));
    }, [userData.ocrData]);

    const validate = () => {
        const newErrors = {};
        if (!editableData.full_name)   newErrors.full_name   = "Full name is required.";
        if (!editableData.national_id) newErrors.national_id = "National ID is required.";
        if (!editableData.birth_date) {
            newErrors.birth_date = "Birth date is required.";
        } else if (!/^\d{2}\/\d{2}\/\d{4}$/.test(editableData.birth_date)) {
            newErrors.birth_date = "Birth date must be in DD/MM/YYYY format.";
        } else {
            const [dd, mm, yyyy] = editableData.birth_date.split('/').map(Number);
            const year = Number(yyyy);
            const thisYear = new Date().getFullYear();
            if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || year < 1900 || year > thisYear) {
                newErrors.birth_date = "Birth date is not valid.";
            }
        }
        if (!editableData.governorate || editableData.governorate === 'Unknown')
            newErrors.governorate = "Please select a governorate.";
        if (!editableData.gender || editableData.gender === 'Unknown')
            newErrors.gender = "Please select a gender.";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditableData((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: null }));
        }
    };

    const handleSaveChanges = () => {
        if (validate()) {
            onNext(editableData); // Pass the final, edited data to the parent for submission
        }
    };

    // Fields are editable when OCR couldn't read them (empty) or always for freeform fields
    const displayFields = [
        { key: 'full_name',   label: 'Full Name',   required: true,  maxLength: 200 },
        { key: 'national_id', label: 'National ID', required: true,  maxLength: 14  },
        { key: 'birth_date',  label: 'Birth Date',  required: true,  placeholder: 'DD/MM/YYYY', maxLength: 10 },
        { key: 'address',     label: 'Address',     required: false, maxLength: 500 },
        { key: 'governorate', label: 'Governorate', required: true,  options: GOVERNORATES },
        { key: 'gender',      label: 'Gender',      required: true,  options: GENDERS },
        // Back-of-card fields — only shown when present (National ID flow, not passport)
        ...(hasBackFields ? [
            { key: 'serial_number',  label: 'Serial Number',  required: false, maxLength: 30 },
            { key: 'marital_status', label: 'Marital Status', required: false, options: MARITAL_STATUSES },
            { key: 'occupation',     label: 'Occupation',     required: false, maxLength: 100 },
            { key: 'issue_date',     label: 'Issue Date',     required: false, placeholder: 'YYYY/MM/DD', maxLength: 10 },
            { key: 'expiry_date',    label: 'Expiry Date',    required: false, placeholder: 'YYYY/MM/DD', maxLength: 10 },
        ] : []),
    ];

    const age = calculateAge(editableData.birth_date);
    const isFormValid = Object.values(errors).every(x => x === null);

    return (
        <GlassCard className="space-y-4 sm:space-y-6">
            <div>
                <h3 className="text-base sm:text-xl font-semibold text-white">Review & Confirm Your Information</h3>
                <p className="text-xs sm:text-sm text-gray-300 mt-1">
                Please review the information extracted from your document. Edit if necessary.
            </p>
            </div>

            {/* Editable Form */}
            <div className="space-y-3 sm:space-y-4">
                {displayFields.map(({ key, label, required, placeholder, options, maxLength }) => (
                    <div key={key}>
                        <Label htmlFor={key} className="text-xs sm:text-sm font-medium text-gray-400">
                            {label} {required && <span className="text-red-500">*</span>}
                        </Label>
                        <div className="flex items-center gap-2 mt-1">
                            {options ? (
                                <select
                                    id={key}
                                    name={key}
                                    value={editableData[key] || ''}
                                    onChange={handleInputChange}
                                    className={`w-full bg-white/10 border border-white/20 text-white text-sm h-9 sm:h-10 rounded-md px-3 ${errors[key] ? 'border-red-500' : ''}`}
                                >
                                    <option value="" disabled className="bg-gray-800">Select {label}</option>
                                    {options.map(o => (
                                        <option key={o} value={o} className="bg-gray-800">{o}</option>
                                    ))}
                                </select>
                            ) : (
                                <Input
                                    id={key}
                                    name={key}
                                    value={editableData[key] || ''}
                                    onChange={handleInputChange}
                                    placeholder={placeholder || ''}
                                    maxLength={maxLength}
                                    className={`w-full bg-white/10 border-white/20 text-white text-sm h-9 sm:h-10 ${errors[key] ? 'border-red-500' : ''}`}
                                />
                            )}
                            {key === 'birth_date' && age !== null && (
                                <div className="flex-shrink-0 whitespace-nowrap rounded-md bg-white/10 px-2 sm:px-3 py-2 text-xs sm:text-sm text-gray-300">
                                    Age: {age}
                                </div>
                            )}
                        </div>
                        {errors[key] && <p className="mt-1 text-xs text-red-500">{errors[key]}</p>}
                    </div>
                ))}
            </div>

            {/* Submit */}
            <div className="pt-2 sm:pt-4">
                <Button onClick={handleSaveChanges} className="w-full h-10 sm:h-12 text-sm sm:text-base md:text-lg font-semibold touch-manipulation min-h-[44px]" disabled={!isFormValid || isSubmitting} style={{ WebkitTapHighlightColor: 'transparent' }}>
                    {isSubmitting ? "Submitting…" : "Save & Continue"}
                </Button>
            </div>
        </GlassCard>
    );
}
