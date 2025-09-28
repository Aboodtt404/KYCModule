import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import GlassCard from "./GlassCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit3, CheckCircle, User } from "lucide-react";
export function OcrResultStep({ ocrData, faceImage, onNext, onEdit, }) {
    console.log("OcrResultStep - ocrData:", ocrData);
    console.log("OcrResultStep - faceImage:", faceImage);
    // Define fields to display in order
    const fieldsToShow = [
        { key: "full_name", label: "Full Name", fallbackKeys: ["first_name", "second_name", "name"] },
        { key: "national_id", label: "National ID", fallbackKeys: ["id", "national_id_number"] },
        { key: "address", label: "Address", fallbackKeys: ["location", "residence"] },
        { key: "birth_date", label: "Birth Date", fallbackKeys: ["date_of_birth", "birthday"] },
        { key: "gender", label: "Gender", fallbackKeys: ["sex"] },
        { key: "governorate", label: "Governorate", fallbackKeys: ["state", "province"] },
    ];
    const getFieldValue = (fieldKey, fallbackKeys = []) => {
        let value = ocrData[fieldKey];
        if (value)
            return value;
        for (const fallbackKey of fallbackKeys) {
            value = ocrData[fallbackKey];
            if (value)
                return value;
        }
        if (fieldKey === "full_name") {
            const firstName = ocrData["first_name"] || ocrData["firstName"];
            const secondName = ocrData["second_name"] || ocrData["secondName"];
            if (firstName && secondName)
                return `${firstName} ${secondName}`;
            if (firstName)
                return firstName;
            if (secondName)
                return secondName;
        }
        return "";
    };
    return (<GlassCard>
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40 }} key="ocr-result" className="flex flex-col gap-6 items-center justify-center">
        {/* Title */}
        <div className="flex flex-col gap-2 text-center">
          <h2 className="text-2xl font-bold">Review Extracted Information</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
            Please review the details extracted from your document.  
            If everything looks correct, continue. If not, you can edit the details.
          </p>
        </div>

        {/* Face Preview */}
        {faceImage && (<motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex justify-center mb-4">
            <div className="relative">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-emerald-500 shadow-lg shadow-emerald-500/30">
                <img src={`data:image/jpeg;base64,${faceImage}`} alt="Face from ID" className="w-full h-full object-cover"/>
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-md">
                <User className="w-4 h-4 text-white"/>
              </div>
            </div>
          </motion.div>)}

        {/* Extracted fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
          {fieldsToShow.map(({ key, label, fallbackKeys }) => {
            const value = getFieldValue(key, fallbackKeys);
            return (<div className="grid w-full items-center gap-1.5" key={key}>
                <Label htmlFor={key} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {label}
                </Label>
                <Input id={key} value={value} disabled className="bg-white/10 dark:bg-gray-800 border border-gray-300/30 dark:border-gray-700/50 text-gray-900 dark:text-gray-100"/>
              </div>);
        })}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mt-6 w-full max-w-md">
          <Button onClick={onNext} className="flex-1 h-12 text-lg font-semibold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all">
            <div className="flex items-center gap-2 justify-center">
              <CheckCircle className="w-5 h-5"/>
              <span>Continue</span>
            </div>
          </Button>

          <Button onClick={onEdit} variant="outline" className="flex-1 h-12 text-lg font-semibold border-2 border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
            <div className="flex items-center gap-2 justify-center">
              <Edit3 className="w-5 h-5"/>
              <span>Edit Details</span>
            </div>
          </Button>
        </div>
      </motion.div>
    </GlassCard>);
}
