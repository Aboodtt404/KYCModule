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
    const [editableData, setEditableData] = useState(userData.ocrData || {});

    // Sync state if userData changes from parent
    useEffect(() => {
        setEditableData(userData.ocrData || {});
    }, [userData.ocrData]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditableData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSaveChanges = () => {
        onNext(editableData); // Pass the final, edited data to the parent for submission
    };

    const displayFields = [
        { key: 'full_name', label: 'Full Name' },
        { key: 'national_id', label: 'National ID' },
        { key: 'birth_date', label: 'Birth Date' },
        { key: 'address', label: 'Address' },
        { key: 'governorate', label: 'Governorate' },
        { key: 'gender', label: 'Gender' },
    ];

    const age = calculateAge(editableData.birth_date);

    return (
        <GlassCard className="space-y-6">
            <h3 className="text-xl font-semibold">Review & Confirm Your Information</h3>
            <p className="text-sm text-gray-300">
                Please review the information extracted from your document. Edit if necessary.
            </p>

            {/* Editable Form */}
            <div className="space-y-4">
                {displayFields.map(({ key, label }) => (
                    <div key={key}>
                        <Label htmlFor={key} className="text-sm font-medium text-gray-400">
                            {label}
                        </Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id={key}
                                name={key}
                                value={editableData[key] || ''}
                                onChange={handleInputChange}
                                className={`mt-1 w-full bg-white/10 border-white/20`}
                            />
                            {key === 'birth_date' && age !== null && (
                                <div className="mt-1 flex-shrink-0 whitespace-nowrap rounded-md bg-white/10 px-3 py-2 text-sm text-gray-300">
                                    Age: {age}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Extracted Face Image (Read-only) */}
            {editableData.face_image && (
                <div className="mt-4 pt-4 border-t border-gray-600">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Extracted Face Photo</h4>
                    <img
                        src={`data:image/jpeg;base64,${editableData.face_image}`}
                        alt="Extracted face from ID"
                        className="w-28 h-28 object-cover rounded-lg border-2 border-white/20"
                    />
                </div>
            )}

            {/* Submit */}
            <div className="pt-4">
                <Button onClick={handleSaveChanges} className="w-full h-12 text-lg">
                    Save & Continue
                </Button>
            </div>
        </GlassCard>
    );
}
