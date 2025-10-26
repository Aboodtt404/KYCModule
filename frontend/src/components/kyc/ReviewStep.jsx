"use client";
import React, { useState, useEffect } from "react";
import GlassCard from "./GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function calculateAge(birthDate) {
    if (!birthDate) return null;
    const today = new Date();
    const birthDateObj = new Date(birthDate);
    let age = today.getFullYear() - birthDateObj.getFullYear();
    const monthDifference = today.getMonth() - birthDateObj.getMonth();
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDateObj.getDate())) {
        age--;
    }
    return age;
}

export default function ReviewStep({ userData, onNext }) {
    const [editableData, setEditableData] = useState(() => {
        const initialData = userData.ocrData || {};
        return {
            ...initialData,
            full_name: '', // Start with an empty name field
            address: '',   // Start with an empty address field
        };
    });
    const [errors, setErrors] = useState({});

    // Sync state if userData changes from parent, but preserve the blank fields
    useEffect(() => {
        setEditableData((prev) => ({
            ...userData.ocrData,
            full_name: prev.full_name || '', // Keep user's input or stay blank
            address: prev.address || '',     // Keep user's input or stay blank
        }));
    }, [userData.ocrData]);

    const validate = () => {
        const newErrors = {};
        if (!editableData.full_name) newErrors.full_name = "Full name is required.";
        if (!editableData.address) newErrors.address = "Address is required.";
        if (!editableData.governorate) newErrors.governorate = "Governorate is required.";
        if (!editableData.gender) newErrors.gender = "Gender is required.";
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

    const displayFields = [
        { key: 'full_name', label: 'Full Name', editable: true, required: true },
        { key: 'national_id', label: 'National ID', editable: false },
        { key: 'birth_date', label: 'Birth Date', editable: false },
        { key: 'address', label: 'Address', editable: true, required: true },
        { key: 'governorate', label: 'Governorate', editable: true, required: true },
        { key: 'gender', label: 'Gender', editable: true, required: true },
    ];

    const age = calculateAge(editableData.birth_date);
    const isFormValid = Object.values(errors).every(x => x === null);

    return (
        <GlassCard className="space-y-6">
            <h3 className="text-xl font-semibold">Review & Confirm Your Information</h3>
            <p className="text-sm text-gray-300">
                Please review the information extracted from your document. Edit if necessary.
            </p>

            {/* Editable Form */}
            <div className="space-y-4">
                {displayFields.map(({ key, label, editable, required }) => (
                    <div key={key}>
                        <Label htmlFor={key} className="text-sm font-medium text-gray-400">
                            {label} {required && <span className="text-red-500">*</span>}
                        </Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id={key}
                                name={key}
                                value={editableData[key] || ''}
                                onChange={editable ? handleInputChange : undefined}
                                readOnly={!editable}
                                className={`mt-1 w-full bg-white/10 border-white/20 ${!editable ? 'text-gray-400 cursor-not-allowed' : ''} ${errors[key] ? 'border-red-500' : ''}`}
                            />
                            {key === 'birth_date' && age !== null && (
                                <div className="mt-1 flex-shrink-0 whitespace-nowrap rounded-md bg-white/10 px-3 py-2 text-sm text-gray-300">
                                    Age: {age}
                                </div>
                            )}
                        </div>
                        {errors[key] && <p className="mt-1 text-sm text-red-500">{errors[key]}</p>}
                    </div>
                ))}
            </div>

            {/* Submit */}
            <div className="pt-4">
                <Button onClick={handleSaveChanges} className="w-full h-12 text-lg" disabled={!isFormValid}>
                    Save & Continue
                </Button>
            </div>
        </GlassCard>
    );
}
