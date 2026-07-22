/**
 * Calculate age from a birthdate string.
 * Handles both ISO (YYYY-MM-DD) and the DD/MM/YYYY format returned by OCR.
 * Correctly accounts for whether the birthday has occurred yet this year.
 */
export function calculateAge(birthDate) {
    if (!birthDate) return null;
    let d;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(birthDate)) {
        const [dd, mm, yyyy] = birthDate.split('/');
        d = new Date(+yyyy, +mm - 1, +dd);
    } else {
        d = new Date(birthDate);
    }
    if (isNaN(d.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const monthDiff = today.getMonth() - d.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d.getDate())) age--;
    return age;
}
